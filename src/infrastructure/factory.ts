import { COLD_STORAGE, DATA_SOURCE, gatewayConfig } from '../config';
import type { TemperatureSource } from './ports';
import { MockTemperatureSource } from './MockTemperatureSource';
import { TDengineTemperatureSource } from './TDengineTemperatureSource';
import { GatewayTemperatureSource } from './GatewayTemperatureSource';

/**
 * 数据源工厂：按配置返回具体实现，业务层零感知。
 * 生命周期由调用方（store）管理，不缓存实例，
 * 避免 StrictMode 双挂载时复用已断开实例的隐性状态。
 */
export function createSource(storageId: string = COLD_STORAGE.id): TemperatureSource {
  switch (DATA_SOURCE) {
    case 'gateway':
      return new GatewayTemperatureSource(gatewayConfig);
    case 'tdengine':
      return new TDengineTemperatureSource(storageId);
    case 'mock':
    default:
      return new MockTemperatureSource(storageId);
  }
}
