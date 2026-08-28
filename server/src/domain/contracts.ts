/**
 * 前后端共享的数据契约。
 * 与前端 src/domain 保持一致；改动时需同步两端。
 */

/** 温度数据点 */
export interface TemperaturePoint {
  value: number;
  timestamp: number;
  unit: '°C';
}

/** 告警级别 */
export type AlertLevel = 'none' | 'high' | 'low';

/** 告警事件 */
export interface AlertEvent {
  storageId: string;
  temperature: number;
  level: Exclude<AlertLevel, 'none'>;
  message: string;
  timestamp: number;
}

/** 实时链路初始快照 */
export interface RealtimeSnapshot {
  current: TemperaturePoint | null;
  history: TemperaturePoint[];
  alerts: AlertEvent[];
  serverTime: number;
}

/** WebSocket 上行消息（客户端 → 网关） */
export interface ClientMessage {
  type: 'ping';
}

/** WebSocket 下行消息（网关 → 客户端） */
export type ServerMessage =
  | { type: 'snapshot'; payload: RealtimeSnapshot }
  | { type: 'point'; payload: TemperaturePoint }
  | { type: 'alert'; payload: AlertEvent }
  | { type: 'pong'; payload: { serverTime: number } };
