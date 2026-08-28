import type { TemperaturePoint } from '../domain/temperature';

/** 拉模式：当前值 / 历史查询端口 */
export interface QueryPort {
  connect(): Promise<void>;
  disconnect(): void;
  getCurrent(storageId?: string): Promise<TemperaturePoint>;
  getHistory(from: number, to: number, storageId?: string): Promise<TemperaturePoint[]>;
}

/** 推模式：实时订阅端口（WebSocket 或轮询适配器，可插拔） */
export interface RealtimePort {
  subscribe(callback: (point: TemperaturePoint) => void, storageId?: string): () => void;
}

/** 组合数据源契约：业务层只依赖此类型，不感知具体实现 */
export type TemperatureSource = QueryPort & RealtimePort;
