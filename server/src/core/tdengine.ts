import type { TemperaturePoint } from '../domain/contracts';

/** TDengine REST API 客户端（/rest/sql） */
export interface TdengineClientOptions {
  baseUrl: string;
  auth: string;
  database: string;
  stable: string;
  tempField: string;
  tsField: string;
}

interface RestResponse {
  code: number;
  desc?: string;
  column_meta?: unknown[];
  data?: unknown[][];
  rows?: number;
}

/**
 * 将 TDengine 返回的时间戳统一转为 epoch 毫秒。
 * REST 接口可能返回 ISO 字符串或 µs 数值（bigint），两者都要兼容。
 */
function toEpochMs(value: unknown): number {
  if (typeof value === 'number') return Math.round(value / 1000); // µs → ms
  if (typeof value === 'bigint') return Number(value / 1000n); // µs → ms
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return Number.NaN;
    const iso = Date.parse(trimmed); // ISO 8601
    if (!Number.isNaN(iso)) return iso;
    const numeric = Number(trimmed); // 纯数字字符串按 µs 处理
    return Number.isFinite(numeric) ? Math.round(numeric / 1000) : Number.NaN;
  }
  return Number.NaN;
}

export class TdengineClient {
  private readonly opts: TdengineClientOptions;

  constructor(opts: TdengineClientOptions) {
    this.opts = opts;
  }

  private async query(sql: string): Promise<RestResponse> {
    const url = `${this.opts.baseUrl}/rest/sql/${this.opts.database}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: this.opts.auth,
        'Content-Type': 'text/plain',
      },
      body: sql,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new Error(`TDengine HTTP ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as RestResponse;
    if (json.code !== 0) {
      throw new Error(`TDengine 查询失败 [${json.code}]: ${json.desc ?? '未知错误'}`);
    }
    return json;
  }

  /** 查询最近一段时间的历史温度点（时间升序） */
  async queryRecent(windowMs: number, limit = 2000): Promise<TemperaturePoint[]> {
    const minutes = Math.max(1, Math.ceil(windowMs / 60_000));
    const sql = [
      `SELECT ${this.opts.tsField}, ${this.opts.tempField}`,
      `FROM ${this.opts.stable}`,
      `WHERE ${this.opts.tsField} >= NOW - ${minutes}m`,
      `ORDER BY ${this.opts.tsField} ASC`,
      `LIMIT ${limit}`,
    ].join(' ');
    const res = await this.query(sql);
    return (res.data ?? []).map((row) => ({
      timestamp: toEpochMs(row[0]),
      value: Number(row[1]),
      unit: '°C' as const,
    }));
  }

  /** 查询最新一个温度点 */
  async queryLatest(): Promise<TemperaturePoint | null> {
    const sql = [
      `SELECT ${this.opts.tsField}, ${this.opts.tempField}`,
      `FROM ${this.opts.stable}`,
      `ORDER BY ${this.opts.tsField} DESC`,
      `LIMIT 1`,
    ].join(' ');
    const res = await this.query(sql);
    const row = (res.data ?? [])[0];
    if (!row) return null;
    return {
      timestamp: toEpochMs(row[0]),
      value: Number(row[1]),
      unit: '°C',
    };
  }
}
