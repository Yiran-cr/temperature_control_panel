/** 温度数据点 */
export interface TemperaturePoint {
  value: number;
  timestamp: number;
  unit: '°C';
}

/** 告警级别 */
export type AlertLevel = 'none' | 'high' | 'low';

/** 告警事件（level 恒为 high|low，不会出现 none） */
export interface AlertEvent {
  storageId: string;
  temperature: number;
  level: Exclude<AlertLevel, 'none'>;
  message: string;
  timestamp: number;
}

/** 冷库信息（单冷库建模，接口方法预留 storageId 参数以支持日后扩展） */
export interface ColdStorage {
  id: string;
  name: string;
}
