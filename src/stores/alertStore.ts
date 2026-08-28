import { create } from 'zustand';
import type { AlertEvent } from '../domain/temperature';

const MAX_ALERTS = 50;
/** 同级别告警去抖窗口（毫秒）：连续越限不重复刷屏 */
const ALERT_DEBOUNCE_MS = 3000;

interface AlertState {
  alerts: AlertEvent[];
  addAlert: (alert: AlertEvent) => void;
  clear: () => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  alerts: [],
  addAlert: (alert) =>
    set((s) => {
      const last = s.alerts[0];
      // 去抖：与上一条同级别且间隔过短则忽略
      if (last && last.level === alert.level && alert.timestamp - last.timestamp < ALERT_DEBOUNCE_MS) {
        return s;
      }
      return { alerts: [alert, ...s.alerts].slice(0, MAX_ALERTS) };
    }),
  clear: () => set({ alerts: [] }),
}));
