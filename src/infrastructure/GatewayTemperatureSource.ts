import type { TemperaturePoint } from '../domain/temperature';
import type { TemperatureSource } from './ports';

/**
 * GatewayTemperatureSource - 网关数据源实现
 *
 * 数据链路（替代浏览器直连 TDengine）：
 * 1. POST /api/login 换取 JWT
 * 2. GET  /api/ws-ticket 换取短时 WS 升级票据
 * 3. WS   /ws?ticket=... 建立实时通道，首帧即快照（当前值 + 历史）
 * 4. 快照后续的增量 point 实时广播
 *
 * 安全收益：TDengine 凭据只存在于服务端，浏览器只持有短期 JWT。
 */
export interface GatewaySourceConfig {
  baseUrl: string;
  username: string;
  password: string;
}

interface RealtimeSnapshot {
  current: TemperaturePoint | null;
  history: TemperaturePoint[];
  serverTime: number;
}

type ServerMessage =
  | { type: 'snapshot'; payload: RealtimeSnapshot }
  | { type: 'point'; payload: TemperaturePoint }
  | { type: 'pong'; payload: { serverTime: number } };

/** 等待首帧快照的超时 */
const SNAPSHOT_TIMEOUT_MS = 5000;
/** 心跳间隔（服务端据此判断连接存活） */
const PING_INTERVAL_MS = 30_000;
/** 断线重连最大次数 */
const MAX_RECONNECT = 5;

export class GatewayTemperatureSource implements TemperatureSource {
  private readonly cfg: GatewaySourceConfig;

  private token: string | null = null;
  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private subscribers = new Set<(p: TemperaturePoint) => void>();

  private current: TemperaturePoint | null = null;
  private stopped = true;
  private reconnectAttempts = 0;

  constructor(cfg: GatewaySourceConfig) {
    this.cfg = cfg;
  }

  private httpUrl(path: string): string {
    return `${this.cfg.baseUrl.replace(/\/$/, '')}${path}`;
  }

  private wsUrl(ticket: string): string {
    const base = this.cfg.baseUrl.replace(/^http/, 'ws');
    return `${base.replace(/\/$/, '')}/ws?ticket=${encodeURIComponent(ticket)}`;
  }

  // ========== 接口实现 ==========

  async connect(): Promise<void> {
    this.stopped = false;
    const token = await this.login();
    this.token = token;
    const ticket = await this.fetchTicket(token);
    await this.openSocket(ticket);
    this.startPing();
    this.reconnectAttempts = 0;
  }

  disconnect(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopPing();
    this.ws?.close();
    this.ws = null;
    this.token = null;
    this.current = null;
    this.subscribers.clear();
  }

  async getCurrent(): Promise<TemperaturePoint> {
    // 优先返回快照/实时缓存的最新值
    if (this.current) return this.current;
    const points = await this.getHistory(Date.now() - 60_000, Date.now());
    const last = points[points.length - 1];
    if (!last) throw new Error('网关暂无温度数据');
    return last;
  }

  async getHistory(from: number, to: number): Promise<TemperaturePoint[]> {
    // 网关按"最近 N 分钟"提供数据，窗口取整并加 1 分钟余量后客户端再精确裁剪
    const minutes = Math.max(1, Math.ceil((to - from) / 60_000) + 1);
    const res = await fetch(this.httpUrl(`/api/history?minutes=${minutes}`), {
      headers: { Authorization: `Bearer ${this.token ?? ''}` },
    });
    if (!res.ok) throw new Error(`历史查询失败 (HTTP ${res.status})`);
    const data = (await res.json()) as { points: TemperaturePoint[] };
    return (data.points ?? []).filter((p) => p.timestamp >= from && p.timestamp <= to);
  }

  subscribe(callback: (point: TemperaturePoint) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // ========== 鉴权 ==========

  private async login(): Promise<string> {
    const res = await fetch(this.httpUrl('/api/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: this.cfg.username, password: this.cfg.password }),
    });
    if (!res.ok) {
      throw new Error(
        `网关登录失败 (HTTP ${res.status})，请检查 VITE_GATEWAY_USERNAME / VITE_GATEWAY_PASSWORD`,
      );
    }
    const data = (await res.json()) as { token: string };
    return data.token;
  }

  private async fetchTicket(token: string): Promise<string> {
    const res = await fetch(this.httpUrl('/api/ws-ticket'), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`获取 WS 票据失败 (HTTP ${res.status})`);
    const data = (await res.json()) as { ticket: string };
    return data.ticket;
  }

  // ========== WebSocket ==========

  private openSocket(ticket: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl(ticket));
      this.ws = ws;
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('网关 WebSocket 首帧超时'));
      }, SNAPSHOT_TIMEOUT_MS);

      ws.onopen = () => {};

      ws.onmessage = (ev) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(String(ev.data)) as ServerMessage;
        } catch {
          return;
        }
        switch (msg.type) {
          case 'snapshot':
            this.current = msg.payload.current;
            clearTimeout(timeout);
            resolve();
            break;
          case 'point':
            this.current = msg.payload;
            this.subscribers.forEach((cb) => cb(msg.payload));
            break;
          case 'pong':
            break;
        }
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('网关 WebSocket 连接失败'));
      };

      ws.onclose = () => {
        clearTimeout(timeout);
        this.onSocketClosed();
      };
    });
  }

  private onSocketClosed(): void {
    this.stopPing();
    if (this.stopped) return;
    if (this.reconnectAttempts >= MAX_RECONNECT) {
      console.error('[gateway] WebSocket 重连已达上限，停止重连');
      return;
    }
    this.reconnectAttempts++;
    const delay = 1000 * 2 ** (this.reconnectAttempts - 1); // 1s, 2s, 4s, 8s...
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((err) => {
        console.warn('[gateway] 自动重连失败:', err instanceof Error ? err.message : err);
      });
    }, delay);
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}
