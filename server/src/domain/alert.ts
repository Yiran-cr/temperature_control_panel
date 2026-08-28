import type { AlertEvent, AlertLevel, TemperaturePoint } from './contracts';

/**
 * 服务端告警判定。
 * 阈值来自网关环境变量（ALERT_HIGH / ALERT_LOW），
 * 默认与前端 domain 的 2~6°C 冷链阈值一致。
 */
export interface AlertRule {
  high: number;
  low: number;
}

export function evaluateAlert(
  value: number,
  rule: AlertRule,
): AlertLevel {
  if (value > rule.high) return 'high';
  if (value < rule.low) return 'low';
  return 'none';
}

export function buildAlertMessage(
  point: TemperaturePoint,
  level: Exclude<AlertLevel, 'none'>,
  rule: AlertRule,
  storageId = 'cold-storage-01',
): AlertEvent {
  return {
    storageId,
    temperature: point.value,
    level,
    message:
      level === 'high'
        ? `高温告警：${point.value}°C（阈值 > ${rule.high}°C）`
        : `低温告警：${point.value}°C（阈值 < ${rule.low}°C）`,
    timestamp: point.timestamp,
  };
}
