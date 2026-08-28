import type { TemperaturePoint } from './temperature';

/** 历史区间派生统计 */
export interface TempStats {
  max: number | null;
  min: number | null;
  avg: number | null;
  count: number;
}

/** 计算历史统计（纯函数，可单测） */
export function computeStats(history: TemperaturePoint[]): TempStats {
  if (history.length === 0) {
    return { max: null, min: null, avg: null, count: 0 };
  }
  const values = history.map((d) => d.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return { max, min, avg, count: history.length };
}
