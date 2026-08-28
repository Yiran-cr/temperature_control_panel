import { describe, it, expect } from 'vitest';
import {
  ALERT_THRESHOLD,
  evaluateAlert,
  buildAlertMessage,
  toDisplayColor,
} from '../src/domain/alertPolicy';
import type { TemperaturePoint } from '../src/domain/temperature';

const point = (value: number, timestamp = 1000): TemperaturePoint => ({
  value,
  timestamp,
  unit: '°C',
});

describe('evaluateAlert', () => {
  it('正常范围内返回 none', () => {
    expect(evaluateAlert(4)).toBe('none');
    expect(evaluateAlert(2)).toBe('none');
    expect(evaluateAlert(6)).toBe('none');
  });

  it('高于上限返回 high，低于下限返回 low', () => {
    expect(evaluateAlert(6.1)).toBe('high');
    expect(evaluateAlert(1.9)).toBe('low');
  });

  it('支持自定义阈值', () => {
    const freezer = { high: -15, low: -25 };
    expect(evaluateAlert(-20, freezer)).toBe('none');
    expect(evaluateAlert(-10, freezer)).toBe('high');
    expect(evaluateAlert(-30, freezer)).toBe('low');
  });
});

describe('buildAlertMessage', () => {
  it('拼接正确的高温/低温文案', () => {
    expect(buildAlertMessage(point(8), 'high', ALERT_THRESHOLD).message).toContain('8°C');
    expect(buildAlertMessage(point(8), 'high', ALERT_THRESHOLD).message).toContain('> 6°C');
    expect(buildAlertMessage(point(-1), 'low', ALERT_THRESHOLD).message).toContain('< 2°C');
  });
});

describe('toDisplayColor', () => {
  it('越限用告警色，范围内按阈值中点区分冷暖', () => {
    expect(toDisplayColor(8)).toBe('#ff3860');
    expect(toDisplayColor(0)).toBe('#5fd0ff');
    expect(toDisplayColor(3)).toBe('#7dd8ff');
    expect(toDisplayColor(5)).toBe('#a8e6ff');
  });
});
