import { describe, it, expect, beforeEach } from 'vitest';
import { RealtimeBuffer } from '../src/infrastructure/RealtimeBuffer';
import type { TemperaturePoint } from '../src/domain/temperature';

const pt = (value: number, timestamp: number): TemperaturePoint => ({
  value,
  timestamp,
  unit: '°C',
});

let buf: RealtimeBuffer;

beforeEach(() => {
  buf = new RealtimeBuffer(100, 10000); // 窗口 10s，上限 100
});

describe('RealtimeBuffer', () => {
  it('seed 后保持时间序', () => {
    buf.seed([pt(1, 3000), pt(2, 1000), pt(3, 2000)]);
    expect(buf.snapshot().map((p) => p.timestamp)).toEqual([1000, 2000, 3000]);
  });

  it('push 按 timestamp 去重（同戳替换不重复）', () => {
    buf.seed([pt(1, 1000), pt(2, 2000)]);
    const next = buf.push(pt(9, 2000));
    expect(next).toHaveLength(2);
    expect(next.find((p) => p.timestamp === 2000)?.value).toBe(9);
  });

  it('push 新点按时间序插入', () => {
    buf.seed([pt(1, 1000), pt(2, 3000)]);
    const next = buf.push(pt(9, 2000));
    expect(next.map((p) => p.timestamp)).toEqual([1000, 2000, 3000]);
  });

  it('实时流长跑不无限膨胀：窗口外旧点被裁剪', () => {
    buf.seed([pt(1, 0)]);
    // 模拟每秒推入、共 15s（窗口 10s）
    for (let i = 1; i <= 15; i++) {
      buf.push(pt(i, i * 1000));
    }
    const snaps = buf.snapshot();
    // 只保留最近 10s 窗口内的点
    expect(snaps[0].timestamp).toBeGreaterThanOrEqual(5000);
    expect(snaps).toHaveLength(11);
  });

  it('setRange 缩小窗口后裁剪过期点', () => {
    buf.seed([pt(1, 1000), pt(2, 2000), pt(3, 3000)]);
    buf.setRange(1000); // 窗口 1s，以最新点 3000 为准
    expect(buf.snapshot().map((p) => p.timestamp)).toEqual([2000, 3000]);
  });

  it('超过 maxSize 时截断旧点', () => {
    for (let i = 0; i < 150; i++) {
      buf.push(pt(i, i));
    }
    expect(buf.snapshot()).toHaveLength(100);
    expect(buf.snapshot()[0].timestamp).toBe(50);
  });
});
