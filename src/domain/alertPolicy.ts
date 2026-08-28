import type { AlertEvent, AlertLevel, TemperaturePoint } from './temperature';

/** 温度越限阈值 */
export interface AlertThreshold {
  /** 上限，超过即高温告警 */
  high: number;
  /** 下限，低于即低温告警 */
  low: number;
}

/**
 * 业务阈值单点定义：2°C ~ 6°C（冷链场景）
 * 禁止在组件 / 数据源 / store 里再写死。
 * 若实际是冷冻库场景（-18°C），只需改这里。
 */
export const ALERT_THRESHOLD: AlertThreshold = { high: 6, low: 2 };

/** 判定温度点是否越限及级别（纯函数，可单测） */
export function evaluateAlert(
  value: number,
  t: AlertThreshold = ALERT_THRESHOLD,
): AlertLevel {
  if (value > t.high) return 'high';
  if (value < t.low) return 'low';
  return 'none';
}

/** 生成告警事件（统一出口，避免 Mock / TSDB 各自拼接文案） */
export function buildAlertMessage(
  point: TemperaturePoint,
  level: Exclude<AlertLevel, 'none'>,
  t: AlertThreshold = ALERT_THRESHOLD,
  storageId = 'cold-storage-01',
): AlertEvent {
  return {
    storageId,
    temperature: point.value,
    level,
    message:
      level === 'high'
        ? `⚠️ 高温告警：${point.value}°C（阈值 > ${t.high}°C）`
        : `⚠️ 低温告警：${point.value}°C（阈值 < ${t.low}°C）`,
    timestamp: point.timestamp,
  };
}

/** 温度值 → 展示配色（与业务告警判定分离，仅供 UI 消费） */
export function toDisplayColor(
  value: number,
  t: AlertThreshold = ALERT_THRESHOLD,
): string {
  if (value > t.high) return '#ff3860'; // 高温红
  if (value < t.low) return '#5fd0ff'; // 低温冰蓝
  const mid = (t.low + t.high) / 2;
  return value < mid ? '#7dd8ff' : '#a8e6ff'; // 偏冷 / 正常
}
