import type { AlertEvent, TemperaturePoint } from '../domain/temperature';

/** 数据源连接配置（语义化命名，替代原 organization/bucket 错位映射） */
export interface DataSourceConfig {
  url?: string;
  token?: string;
  database?: string;
  stable?: string;
  tempField?: string;
  tsField?: string;
  pollIntervalMs?: number;
}

/** 拉模式：当前值 / 历史查询端口 */
export interface QueryPort {
  connect(config?: DataSourceConfig): Promise<void>;
  disconnect(): void;
  getCurrent(storageId?: string): Promise<TemperaturePoint>;
  getHistory(from: number, to: number, storageId?: string): Promise<TemperaturePoint[]>;
}

/** 推模式：实时订阅端口（WebSocket 或轮询适配器，可插拔） */
export interface RealtimePort {
  subscribe(callback: (point: TemperaturePoint) => void, storageId?: string): () => void;
  onAlert(callback: (alert: AlertEvent) => void): () => void;
}

/** 组合数据源契约：业务层只依赖此类型，不感知具体实现 */
export type TemperatureSource = QueryPort & RealtimePort;
