import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import type { GatewayConfig } from '../config';
import type { TdengineClient } from '../core/tdengine';
import type { AuthService } from '../http/auth';
import { buildAlertMessage, evaluateAlert } from '../domain/alert';
import type {
  AlertEvent,
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
const ALERT_WINDOW_MS = 60 * 60_000;

/**
 * 实时推送链路：
 * 1. 客户端先用 API token 换取短时 WS 票据，再通过 ?ticket= 升级连接
 * 2. 连接建立后立即下发快照（当前点 + 历史 + 近期告警）
 * 3. 周期轮询 TDengine，新点/告警变化时增量广播
 */
export function startRealtime(deps: RealtimeDeps): { close: () => void } {
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set<WebSocket>();
  let lastPoint: TemperaturePoint | null = null;
  let lastAlertLevel = 'none';

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

      const level = evaluateAlert(point.value, {
        high: deps.config.ALERT_HIGH,
        low: deps.config.ALERT_LOW,
      });

      broadcast({ type: 'point', payload: point });
      // 仅状态跃迁（进入告警）时广播告警事件，避免刷屏
      if (level !== 'none' && level !== lastAlertLevel) {
        const event = buildAlertMessage(
          point,
          level,
          { high: deps.config.ALERT_HIGH, low: deps.config.ALERT_LOW },
        );
        broadcast({ type: 'alert', payload: event });
      }
      lastPoint = point;
      lastAlertLevel = level;
    } catch (err) {
      console.error('[realtime] 轮询 TDengine 失败:', err instanceof Error ? err.message : err);
    }
  };

  const sendSnapshot = async (ws: WebSocket): Promise<void> => {
    try {
      const [current, history, alertRows] = await Promise.all([
        deps.tdengine.queryLatest(),
        deps.tdengine.queryRecent(HISTORY_WINDOW_MS),
        deps.tdengine.queryRecent(ALERT_WINDOW_MS),
      ]);
      const alerts: AlertEvent[] = [];
      const rule = { high: deps.config.ALERT_HIGH, low: deps.config.ALERT_LOW };
      for (const p of alertRows) {
        const level = evaluateAlert(p.value, rule);
        if (level !== 'none') alerts.push(buildAlertMessage(p, level, rule));
      }
      const snapshot: RealtimeSnapshot = {
        current,
        history,
        alerts,
        serverTime: Date.now(),
      };
      if (current) {
        lastPoint = current;
        lastAlertLevel = evaluateAlert(current.value, rule);
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
