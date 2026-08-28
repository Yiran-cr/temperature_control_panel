import type { AlertEvent, TemperaturePoint } from '../domain/temperature';
import { ALERT_THRESHOLD, buildAlertMessage, evaluateAlert } from '../domain/alertPolicy';
import type { DataSourceConfig, TemperatureSource } from './ports';

/** TDengine REST API 返回结构 */
interface TDengineResponse {
  status?: string;
  code?: number;
  desc?: string;
  head?: string[];
  column_meta?: Array<[string, number, number]>; // [列名, 类型, 长度]
  data?: (string | number | null)[][];
  rows?: number;
}

/** 温度字段候选名（自动探测时使用） */
const TEMP_FIELD_CANDIDATES = [
  'temperature', 'temperature_val', 'temp', 'cur_temp', 'current_temp',
  'in_temp', 'inside_temp', 'ref_temp',
  't1', 't2', 't3', // 常见 SCADA 字段简写
  'value', 'val',
];

/** 设备标签候选名（自动探测时使用） */
const TAG_FIELD_CANDIDATES = [
  'device_id', 'equ_id', 'equ_code', 'equipment_id',
  'refrigerator_id', 'storage_id', 'cold_storage_id',
  'tag', 'tags', 'location', 'name',
];

/**
 * TDengineTemperatureSource - TDengine 时序数据库数据源实现
 *
 * 使用 REST API (端口6041) 直接访问，无需安装原生驱动
 * - 自动探测超级表结构（字段名/类型/TAG）
 * - 用定时轮询 + 去重 模拟实时订阅（REST 无法真正订阅）
 * - storageId 提供且探测到 TAG 列时，查询按 TAG 过滤（多冷库扩展点）
 */
export class TDengineTemperatureSource implements TemperatureSource {
  // ========== 配置 ==========
  private baseUrl = '/api/tdengine';
  private authHeader = 'Basic cm9vdDp0YW9zZGF0YQ==';
  private database = 'scada';
  private stable = 'equ_refrigerator';
  private pollInterval = 1000;

  // 字段名（探测后确定）
  private tsField = 'ts';
  private tempField = '';
  private tagField = ''; // 设备标识的 TAG 名

  // ========== 运行时状态 ==========
  private subscribers = new Set<(data: TemperaturePoint) => void>();
  private alertCallbacks = new Set<(alert: AlertEvent) => void>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastTs: string | null = null; // 上次收到的最新时间戳，用于去重
  private storageId: string;

  constructor(storageId = 'cold-storage-01') {
    this.storageId = storageId;
  }

  // ========== 工具：REST 查询 ==========
  private async query(sql: string, db: string = this.database): Promise<TDengineResponse> {
    const url = `${this.baseUrl}/rest/sql/${encodeURIComponent(db)}?tz=Asia/Shanghai`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'text/plain;charset=UTF-8',
      },
      body: sql,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`TDengine HTTP ${res.status}: ${text || res.statusText}`);
    }

    const json: TDengineResponse = await res.json();
    if (json.code !== undefined && json.code !== 0) {
      throw new Error(`TDengine 错误 (code=${json.code}): ${json.desc || json.status}`);
    }
    if (json.status && json.status !== 'succ') {
      throw new Error(`TDengine 错误: ${json.status} - ${json.desc || ''}`);
    }
    return json;
  }

  /** 设备 TAG 过滤条件（未探测到 TAG 列或未指定 storageId 时返回空串） */
  private tagWhere(storageId?: string): string {
    if (storageId && this.tagField) return ` AND ${this.tagField} = '${storageId}'`;
    return '';
  }

  // ========== 工具：从响应中提取列名 ==========
  private extractHead(res: TDengineResponse): string[] {
    if (res.head && res.head.length > 0) return res.head;
    if (res.column_meta && res.column_meta.length > 0) {
      return res.column_meta.map((col) => String(col[0]));
    }
    return [];
  }

  // ========== 自动探测表结构 ==========
  private async probeTableSchema(): Promise<void> {
    const res = await this.query(`DESCRIBE ${this.stable}`);
    const rows = res.data || [];
    // DESCRIBE 返回：name | type | length | note (note: TAG 或空表示普通列)

    const allFields: Array<{ name: string; type: string; note: string }> = [];
    for (const row of rows) {
      allFields.push({
        name: String(row[0]),
        type: String(row[1]).toLowerCase(),
        note: String(row[3] == null ? '' : row[3]).toLowerCase().trim(),
      });
    }

    if (import.meta.env.DEV) {
      console.debug(
        '[TSDB] DESCRIBE 原始字段列表:',
        allFields.map((f) => `${f.name}[${f.type}]${f.note ? '{TAG}' : ''}`).join(', '),
      );
    }

    // 1) 时间戳列
    const tsCol = allFields.find((f) => f.type.includes('timestamp'));
    if (tsCol) this.tsField = tsCol.name;

    // 2) 温度列：优先 env 配置，否则候选名匹配，否则取第一个 float/double 普通列
    const envTemp = import.meta.env.VITE_TDENGINE_TEMP_FIELD as string | undefined;
    let tempCol = envTemp
      ? allFields.find((f) => f.name.toLowerCase() === envTemp.toLowerCase())
      : undefined;
    if (!tempCol) {
      tempCol = allFields.find(
        (f) =>
          !f.note.includes('tag') &&
          TEMP_FIELD_CANDIDATES.includes(f.name.toLowerCase()),
      );
    }
    if (!tempCol) {
      tempCol = allFields.find(
        (f) =>
          !f.note.includes('tag') &&
          (f.type.includes('float') || f.type.includes('double') || f.type.includes('int')),
      );
    }
    if (!tempCol) {
      throw new Error(
        `[TSDB] 无法在超级表 ${this.database}.${this.stable} 中找到温度字段。` +
          `请在 .env 中设置 VITE_TDENGINE_TEMP_FIELD 为实际的温度列名。\n` +
          `当前探测到的列: ${allFields
            .map((f) => `${f.name}(${f.type}${f.note ? ',TAG' : ''})`)
            .join(', ')}`,
      );
    }
    this.tempField = tempCol.name;

    // 3) 设备 TAG 列：优先候选名，否则第一个 TAG 列
    const tagCol =
      allFields.find(
        (f) => f.note.includes('tag') && TAG_FIELD_CANDIDATES.includes(f.name.toLowerCase()),
      ) ?? allFields.find((f) => f.note.includes('tag'));
    this.tagField = tagCol?.name || '';

    console.log(
      `[TSDB] 探测超级表结构成功：时间戳=${this.tsField}, 温度=${this.tempField}, 设备TAG=${this.tagField || '(未找到)'}`,
    );
  }

  // ========== 解析单行数据 ==========
  private parseRow(
    head: string[],
    row: (string | number | null)[],
  ): TemperaturePoint | null {
    const lowerHead = head.map((h) => h.toLowerCase());
    const tsIdx = lowerHead.indexOf(this.tsField.toLowerCase());
    const tempIdx = lowerHead.indexOf(this.tempField.toLowerCase());
    if (tsIdx < 0 || tempIdx < 0) return null;

    const tsVal = row[tsIdx];
    const tempVal = row[tempIdx];
    if (tsVal == null || tempVal == null) return null;

    const timestamp =
      typeof tsVal === 'number'
        ? tsVal
        : new Date(String(tsVal).replace(' ', 'T')).getTime();

    const value = typeof tempVal === 'number' ? tempVal : parseFloat(String(tempVal));
    if (Number.isNaN(value)) return null;

    return { value, timestamp, unit: '°C' };
  }

  // ========== 接口实现 ==========

  async connect(config?: DataSourceConfig): Promise<void> {
    // 优先使用注入配置，缺省回退到环境变量/默认值
    this.baseUrl = config?.url || '/api/tdengine';
    this.authHeader = config?.token || 'Basic cm9vdDp0YW9zZGF0YQ==';
    this.database = config?.database || 'scada';
    this.stable = config?.stable || 'equ_refrigerator';
    this.pollInterval = config?.pollIntervalMs || 1000;

    try {
      // 1) 连通性检查
      const ping = await this.query('SELECT 1 AS test', this.database);
      if (!ping || (ping.code !== undefined && ping.code !== 0)) {
        throw new Error('连通性检查失败');
      }
      console.log('[TSDB] 连接成功，TDengine REST API 正常');

      // 2) 探测超级表结构
      await this.probeTableSchema();

      // 3) 启动轮询模拟实时订阅
      this.startPolling();
    } catch (err) {
      console.error('[TSDB] 连接失败：', err);
      throw err;
    }
  }

  disconnect(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.subscribers.clear();
    this.alertCallbacks.clear();
    this.lastTs = null;
  }

  async getCurrent(storageId?: string): Promise<TemperaturePoint> {
    const sql =
      `SELECT ${this.tsField}, ${this.tempField} FROM ${this.stable}` +
      ` WHERE 1=1${this.tagWhere(storageId)} ORDER BY ${this.tsField} DESC LIMIT 1`;
    const res = await this.query(sql);
    const head = this.extractHead(res);
    const row = (res.data || [])[0];
    if (!row) {
      throw new Error(`[TSDB] 超级表 ${this.stable} 暂无数据`);
    }
    const point = this.parseRow(head, row);
    if (!point) {
      throw new Error(
        `[TSDB] 解析最新温度数据失败，探测字段[ts=${this.tsField}, temp=${this.tempField}]，SELECT返回 head=${JSON.stringify(head)}`,
      );
    }
    return point;
  }

  async getHistory(from: number, to: number, storageId?: string): Promise<TemperaturePoint[]> {
    // TDengine 时间字符串格式：'YYYY-MM-DD HH:mm:ss.mmm'
    const fmt = (ms: number) => {
      const d = new Date(ms);
      const pad = (n: number, l = 2) => String(n).padStart(l, '0');
      return `'${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}'`;
    };

    const sql =
      `SELECT ${this.tsField}, ${this.tempField} FROM ${this.stable}` +
      ` WHERE ${this.tsField} >= ${fmt(from)} AND ${this.tsField} <= ${fmt(to)}${this.tagWhere(storageId)}` +
      ` ORDER BY ${this.tsField} ASC`;

    const res = await this.query(sql);
    const head = this.extractHead(res);
    const points: TemperaturePoint[] = [];
    for (const row of res.data || []) {
      const p = this.parseRow(head, row);
      if (p) points.push(p);
    }

    // ===== 空结果降级策略 =====
    // 指定范围无数据时，自动查询最近 100 条，保证前端至少能看到内容
    if (points.length === 0) {
      console.warn(
        `[TSDB] 指定时间范围无数据 (${new Date(from).toISOString().slice(0, 19)} ~ ${new Date(to).toISOString().slice(0, 19)}), 降级为查询最近 100 条`,
      );
      const fallbackSql =
        `SELECT ${this.tsField}, ${this.tempField} FROM ${this.stable}` +
        ` WHERE 1=1${this.tagWhere(storageId)} ORDER BY ${this.tsField} DESC LIMIT 100`;
      const fbRes = await this.query(fallbackSql);
      const fbHead = this.extractHead(fbRes);
      const fbRows = (fbRes.data || []).reverse(); // DESC 后反转成 ASC 时间序
      for (const row of fbRows) {
        const p = this.parseRow(fbHead, row);
        if (p) points.push(p);
      }
    }

    return points;
  }

  subscribe(callback: (data: TemperaturePoint) => void, storageId?: string): () => void {
    if (storageId) this.storageId = storageId;
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  onAlert(callback: (alert: AlertEvent) => void): () => void {
    this.alertCallbacks.add(callback);
    return () => {
      this.alertCallbacks.delete(callback);
    };
  }

  // ========== 轮询模拟实时订阅 ==========
  private startPolling(): void {
    if (this.pollTimer) return;

    // 先拉一次初始化 lastTs
    this.pollOnce().catch((e) => console.warn('[TSDB] 首次轮询失败：', e));

    this.pollTimer = setInterval(() => {
      this.pollOnce().catch((e) => console.warn('[TSDB] 轮询出错：', e));
    }, this.pollInterval);
  }

  private async pollOnce(): Promise<void> {
    const sql = this.lastTs
      ? `SELECT ${this.tsField}, ${this.tempField} FROM ${this.stable} WHERE ${this.tsField} > '${this.lastTs}'${this.tagWhere(this.storageId)} ORDER BY ${this.tsField} ASC`
      : `SELECT ${this.tsField}, ${this.tempField} FROM ${this.stable} WHERE 1=1${this.tagWhere(this.storageId)} ORDER BY ${this.tsField} DESC LIMIT 1`;

    const res = await this.query(sql);
    const head = this.extractHead(res);
    const rows = res.data || [];

    const ordered = this.lastTs ? rows : rows.reverse();

    for (const row of ordered) {
      const point = this.parseRow(head, row);
      if (!point) continue;

      const lowerHead = head.map((h) => h.toLowerCase());
      const tsIdx = lowerHead.indexOf(this.tsField.toLowerCase());
      const tsStr = tsIdx >= 0 ? String(row[tsIdx]) : '';
      if (tsStr && (!this.lastTs || tsStr > this.lastTs)) this.lastTs = tsStr;

      this.subscribers.forEach((cb) => cb(point));

      const level = evaluateAlert(point.value, ALERT_THRESHOLD);
      if (level !== 'none') {
        const alert = buildAlertMessage(point, level, ALERT_THRESHOLD, this.storageId);
        this.alertCallbacks.forEach((cb) => cb(alert));
      }
    }
  }
}
