import type { TemperaturePoint } from '../domain/temperature';
import type { TemperatureSource } from './ports';

/** 温度上下界（模拟设备量程） */
const MIN_TEMP = -5;
const MAX_TEMP = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** 随机游走：在正常范围附近生成平滑曲线，偶发越限 */
function randomWalk(
  count: number,
  startTemp: number,
  from: number,
  to: number,
): TemperaturePoint[] {
  const points: TemperaturePoint[] = [];
  let current = startTemp;
  for (let i = 0; i < count; i++) {
    current = clamp(current + (Math.random() - 0.5) * 0.8, MIN_TEMP, MAX_TEMP);
    // 偶发大幅波动，模拟真实温控曲线
    if (Math.random() < 0.02) {
      current = clamp(current + (Math.random() < 0.5 ? -3 : 3), MIN_TEMP, MAX_TEMP);
    }
    const ts = Math.round(from + ((to - from) * i) / Math.max(count - 1, 1));
    points.push({ value: round1(current), timestamp: ts, unit: '°C' });
  }
  return points;
}

/**
 * MockTemperatureSource - 模拟温度数据源
 * 以正常范围（2~6°C）为中心随机游走，偶发大幅波动，保证曲线平滑且多变。
 */
export class MockTemperatureSource implements TemperatureSource {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private subscribers = new Set<(data: TemperaturePoint) => void>();
  private currentTemp = 4;

  async connect(): Promise<void> {
    // 以正常范围中心为起点
    this.currentTemp = 2 + Math.random() * 4;

    this.intervalId = setInterval(() => {
      this.currentTemp = clamp(
        this.currentTemp + (Math.random() - 0.5) * 0.8,
        MIN_TEMP,
        MAX_TEMP,
      );
      if (Math.random() < 0.02) {
        this.currentTemp = clamp(
          this.currentTemp + (Math.random() < 0.5 ? -3 : 3),
          MIN_TEMP,
          MAX_TEMP,
        );
      }

      const point: TemperaturePoint = {
        value: round1(this.currentTemp),
        timestamp: Date.now(),
        unit: '°C',
      };

      this.subscribers.forEach((cb) => cb(point));
    }, 1000);
  }

  disconnect(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.subscribers.clear();
  }

  async getCurrent(_storageId?: string): Promise<TemperaturePoint> {
    return {
      value: round1(this.currentTemp),
      timestamp: Date.now(),
      unit: '°C',
    };
  }

  async getHistory(from: number, to: number): Promise<TemperaturePoint[]> {
    // 降采样：1 秒粒度但最多 1500 点，避免 24H 生成 8 万点打爆图表
    const durationMs = to - from;
    const count = Math.max(20, Math.min(Math.floor(durationMs / 1000), 1500));
    return randomWalk(count, this.currentTemp, from, to);
  }

  subscribe(callback: (data: TemperaturePoint) => void, _storageId?: string): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }
}
