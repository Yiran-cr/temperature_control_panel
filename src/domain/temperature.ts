/** 温度数据点 */
export interface TemperaturePoint {
  value: number;
  timestamp: number;
  unit: '°C';
}

/** 冷库信息（单冷库建模，接口方法预留 storageId 参数以支持日后扩展） */
export interface ColdStorage {
  id: string;
  name: string;
}
