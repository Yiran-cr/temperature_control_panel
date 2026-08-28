import type { TemperaturePoint } from '../domain/temperature';

/**
 * 实时环形缓冲：合并历史查询与实时流，按 timestamp 去重，按时间窗裁剪。
 *
 * 解决旧实现的两个问题：
 * 1. 订阅回调每秒 `slice(-300)` 把刚加载的大范围历史截断；
 * 2. 历史与实时时间戳重叠导致图表重复点。
 *
 * 纯逻辑，不依赖 React / 网络，可单测。
 */
export class RealtimeBuffer {
  private points: TemperaturePoint[] = [];
  private readonly maxSize: number;
  private rangeMs: number;

  constructor(maxSize = 2000, rangeMs = 86400000) {
    this.maxSize = maxSize;
    this.rangeMs = rangeMs;
  }

  /** 用历史查询结果重建缓冲（清空旧实时数据） */
  seed(history: TemperaturePoint[]): void {
    this.points = [...history].sort((a, b) => a.timestamp - b.timestamp);
    this.prune();
  }

  /** 推入实时点：按 timestamp 去重合并，返回最新快照 */
  push(point: TemperaturePoint): TemperaturePoint[] {
    const idx = this.points.findIndex((p) => p.timestamp === point.timestamp);
    if (idx >= 0) {
      this.points[idx] = point;
    } else {
      // 实时流基本有序，线性插入即可维持时间序
      let i = this.points.length;
      while (i > 0 && this.points[i - 1].timestamp > point.timestamp) i--;
      this.points.splice(i, 0, point);
    }
    this.prune();
    return this.snapshot();
  }

  /** 调整时间窗并裁剪窗口外过期点 */
  setRange(rangeMs: number): void {
    this.rangeMs = rangeMs;
    this.prune();
  }

  snapshot(): TemperaturePoint[] {
    return this.points;
  }

  clear(): void {
    this.points = [];
  }

  private prune(): void {
    if (this.points.length === 0) return;
    const latest = this.points[this.points.length - 1].timestamp;
    const cutoff = latest - this.rangeMs;
    const first = this.points.findIndex((p) => p.timestamp >= cutoff);
    if (first > 0) this.points = this.points.slice(first);
    if (this.points.length > this.maxSize) {
      this.points = this.points.slice(-this.maxSize);
    }
  }
}
