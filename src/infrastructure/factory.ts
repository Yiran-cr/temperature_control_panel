import { DATA_SOURCE, gatewayConfig } from '../config';
import type { TemperatureSource } from './ports';
import { MockTemperatureSource } from './MockTemperatureSource';
import { GatewayTemperatureSource } from './GatewayTemperatureSource';

/**
 * 数据源工厂：按配置返回具体实现，业务层零感知。
 * 生命周期由调用方（store）管理，不缓存实例，
 * 避免 StrictMode 双挂载时复用已断开实例的隐性状态。
 *
 * 浏览器不再直连数据库，仅支持：
 * - mock    模拟数据（演示 / 无后端联调）
 * - gateway 后端网关（JWT + WebSocket，生产推荐，数据库连接收敛在服务端）
 */
export function createSource(): TemperatureSource {
  switch (DATA_SOURCE) {
    case 'gateway':
      return new GatewayTemperatureSource(gatewayConfig);
    case 'mock':
    default:
      return new MockTemperatureSource();
  }
}
