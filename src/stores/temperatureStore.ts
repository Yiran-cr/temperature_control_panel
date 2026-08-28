import { create } from 'zustand';
import { ALERT_THRESHOLD, evaluateAlert } from '../domain/alertPolicy';
import type { AlertLevel, TemperaturePoint } from '../domain/temperature';
import { BUFFER_MAX_SIZE, DEFAULT_RANGE_MS, dataSourceConfig } from '../config';
import { RealtimeBuffer } from '../infrastructure/RealtimeBuffer';
import { createSource } from '../infrastructure/factory';
import type { TemperatureSource } from '../infrastructure/ports';
import { useConnectionStore } from './connectionStore';
import { useAlertStore } from './alertStore';
import { useTimeRangeStore } from './timeRangeStore';

interface TemperatureState {
  source: TemperatureSource | null;
  buffer: RealtimeBuffer | null;
  current: TemperaturePoint | null;
  alertLevel: AlertLevel;
  history: TemperaturePoint[];
  loading: boolean;
  error: string | null;

  init: () => Promise<void>;
  dispose: () => void;
  refreshHistory: (rangeMs: number) => Promise<void>;
}

/** 历史刷新序号：快速切换时间范围时丢弃过期响应，防止旧数据覆盖新数据 */
let refreshSeq = 0;

export const useTemperatureStore = create<TemperatureState>((set, get) => ({
  source: null,
  buffer: null,
  current: null,
  alertLevel: 'none',
  history: [],
  loading: true,
  error: null,

  init: async () => {
    // StrictMode 双挂载防护：已初始化则跳过
    if (get().source) return;

    const source = createSource();
    const buffer = new RealtimeBuffer(BUFFER_MAX_SIZE, DEFAULT_RANGE_MS);
    set({ source, buffer, loading: true, error: null });
    useConnectionStore.getState().setStatus('connecting');

    try {
      await source.connect(dataSourceConfig);
      useConnectionStore.getState().setStatus('connected');

      const current = await source.getCurrent();
      set({ current, alertLevel: evaluateAlert(current.value, ALERT_THRESHOLD) });

      // 实时流：并入缓冲（去重 / 窗口裁剪在缓冲内完成）
      source.subscribe((point) => {
        buffer.push(point);
        set({
          history: buffer.snapshot(),
          current: point,
          alertLevel: evaluateAlert(point.value, ALERT_THRESHOLD),
        });
      });

      // 告警直接投递到告警 store
      source.onAlert((alert) => useAlertStore.getState().addAlert(alert));

      // 加载初始历史（时间范围以 timeRangeStore 为准）
      await get().refreshHistory(useTimeRangeStore.getState().rangeMs);
      set({ loading: false });
    } catch (err) {
      const message = `数据源连接失败: ${(err as Error).message}`;
      set({ error: message, loading: false });
      useConnectionStore.getState().setStatus('error', message);
      console.error(err);
    }
  },

  dispose: () => {
    const { source } = get();
    source?.disconnect();
    set({ source: null, buffer: null, loading: true });
    useConnectionStore.getState().setStatus('disconnected');
  },

  refreshHistory: async (rangeMs) => {
    const { source } = get();
    if (!source) return;
    const seq = ++refreshSeq;

    try {
      // 以当前最新温度时间戳为锚点；否则退化为查最新
      let anchor = get().current?.timestamp;
      if (!anchor) {
        const cur = await source.getCurrent();
        anchor = cur.timestamp;
      }

      const history = await source.getHistory(anchor - rangeMs, anchor);
      if (seq !== refreshSeq) return; // 过期响应丢弃

      get().buffer?.setRange(rangeMs);
      get().buffer?.seed(history);
      set({ history: get().buffer!.snapshot() });
    } catch {
      // 静默失败：保留现有数据，不打断 UI
    }
  },
}));
