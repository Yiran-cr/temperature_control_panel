import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import type { GatewayConfig } from '../config';
import type { TdengineClient } from '../core/tdengine';
import type { AuthService } from '../http/auth';
import type {
  RealtimeSnapshot,
  ServerMessage,
  TemperaturePoint,
} from '../domain/contracts';

export interface RealtimeDeps {
  server: Server;
  tdengine: TdengineClient;
  config: GatewayConfig;
  auth: AuthService;
}

const HISTORY_WINDOW_MS = 30 * 60_000;

/**
 * 实时推送链路：
 * 1. 客户端先用 API token 换取短时 WS 票据，再通过 ?ticket= 升级连接
 * 2. 连接建立后立即下发快照（当前点 + 历史）
 * 3. 周期轮询 TDengine，新点时增量广播
 */
export function startRealtime(deps: RealtimeDeps): { close: () => void } {
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set<WebSocket>();
  let lastPoint: TemperaturePoint | null = null;

  deps.server.on('upgrade', (req, socket, head) => {
    const token = new URL(req.url ?? '', 'http://localhost').searchParams.get('ticket');
    if (!deps.auth.verifyWsTicket(token ?? undefined)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws) => {
    clients.add(ws);
    ws.on('message', (data) => {
      // 心跳：客户端发 {"type":"ping"} → 回 pong
      try {
        const msg = JSON.parse(data.toString()) as { type?: string };
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', payload: { serverTime: Date.now() } }));
        }
      } catch {
        // 忽略非法消息
      }
    });
    ws.on('close', () => clients.delete(ws));
    ws.on('error', () => clients.delete(ws));
  });

  const broadcast = (msg: ServerMessage): void => {
    const raw = JSON.stringify(msg);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(raw);
      }
    }
  };

  const pollOnce = async (): Promise<void> => {
    try {
      const point = await deps.tdengine.queryLatest();
      if (!point) return;
      // 去重：时间戳未变化则跳过
      if (lastPoint && point.timestamp === lastPoint.timestamp) return;

      broadcast({ type: 'point', payload: point });
      lastPoint = point;
    } catch (err) {
      console.error('[realtime] 轮询 TDengine 失败:', err instanceof Error ? err.message : err);
    }
  };

  const sendSnapshot = async (ws: WebSocket): Promise<void> => {
    try {
      const [current, history] = await Promise.all([
        deps.tdengine.queryLatest(),
        deps.tdengine.queryRecent(HISTORY_WINDOW_MS),
      ]);
      const snapshot: RealtimeSnapshot = {
        current,
        history,
        serverTime: Date.now(),
      };
      if (current) {
        lastPoint = current;
      }
      ws.send(JSON.stringify({ type: 'snapshot', payload: snapshot }));
    } catch (err) {
      console.error('[realtime] 快照生成失败:', err instanceof Error ? err.message : err);
    }
  };

  wss.on('connection', (ws) => {
    void sendSnapshot(ws);
  });

  const timer = setInterval(() => void pollOnce(), deps.config.POLL_INTERVAL_MS);

  return {
    close(): void {
      clearInterval(timer);
      wss.close();
    },
  };
}
