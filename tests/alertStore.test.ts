import { describe, it, expect, beforeEach } from 'vitest';
import { useAlertStore } from '../src/stores/alertStore';
import type { AlertEvent } from '../src/domain/temperature';

const alert = (level: AlertEvent['level'], timestamp: number): AlertEvent => ({
  storageId: 'cold-storage-01',
  temperature: 8,
  level,
  message: '测试告警',
  timestamp,
});

beforeEach(() => {
  useAlertStore.setState({ alerts: [] });
});

describe('alertStore', () => {
  it('新告警置顶', () => {
    useAlertStore.getState().addAlert(alert('high', 1000));
    useAlertStore.getState().addAlert(alert('low', 2000));
    const { alerts } = useAlertStore.getState();
    expect(alerts[0].timestamp).toBe(2000);
    expect(alerts).toHaveLength(2);
  });

  it('同级别 3 秒内重复告警被去抖', () => {
    useAlertStore.getState().addAlert(alert('high', 1000));
    useAlertStore.getState().addAlert(alert('high', 2000)); // 1s 后，去抖
    expect(useAlertStore.getState().alerts).toHaveLength(1);

    useAlertStore.getState().addAlert(alert('high', 5000)); // 4s 后，放行
    expect(useAlertStore.getState().alerts).toHaveLength(2);
  });

  it('不同级别不受去抖限制', () => {
    useAlertStore.getState().addAlert(alert('high', 1000));
    useAlertStore.getState().addAlert(alert('low', 1001));
    expect(useAlertStore.getState().alerts).toHaveLength(2);
  });

  it('clear 清空所有告警', () => {
    useAlertStore.getState().addAlert(alert('high', 1000));
    useAlertStore.getState().clear();
    expect(useAlertStore.getState().alerts).toHaveLength(0);
  });
});
