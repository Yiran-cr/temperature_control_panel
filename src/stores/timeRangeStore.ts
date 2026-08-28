import { create } from 'zustand';

/** 历史时间范围选项（单点定义，HistoryChart 引用） */
export const TIME_RANGES = [
  { label: '1H', value: 3600000 },
  { label: '6H', value: 21600000 },
  { label: '24H', value: 86400000 },
] as const;

interface TimeRangeState {
  rangeMs: number;
  setRange: (rangeMs: number) => void;
}

export const useTimeRangeStore = create<TimeRangeState>((set) => ({
  rangeMs: 86400000,
  setRange: (rangeMs) => set({ rangeMs }),
}));
