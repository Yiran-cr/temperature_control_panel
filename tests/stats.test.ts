import { describe, it, expect } from 'vitest';
import { computeStats } from '../src/domain/stats';
import type { TemperaturePoint } from '../src/domain/temperature';

const points = (values: number[]): TemperaturePoint[] =>
  values.map((value, i) => ({ value, timestamp: i, unit: '°C' }));

describe('computeStats', () => {
  it('空历史返回 null 统计与 count=0', () => {
    expect(computeStats([])).toEqual({ max: null, min: null, avg: null, count: 0 });
  });

  it('计算 max/min/avg/count', () => {
    const s = computeStats(points([1, 3, 5]));
    expect(s.max).toBe(5);
    expect(s.min).toBe(1);
    expect(s.avg).toBe(3);
    expect(s.count).toBe(3);
  });

  it('单点历史 avg 等于该点', () => {
    expect(computeStats(points([7]))).toMatchObject({ max: 7, min: 7, avg: 7, count: 1 });
  });
});
