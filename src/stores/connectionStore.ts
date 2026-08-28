import { create } from 'zustand';
import { DATA_SOURCE, type DataSourceKind } from '../config';

export type ConnectionStatus = 'connecting' | 'connected' | 'error' | 'disconnected';

interface ConnectionState {
  status: ConnectionStatus;
  /** 当前数据源标识（用于 UI 展示） */
  sourceName: DataSourceKind;
  error: string | null;
  setStatus: (status: ConnectionStatus, error?: string | null) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'disconnected',
  sourceName: DATA_SOURCE,
  error: null,
  setStatus: (status, error = null) => set({ status, error }),
}));
