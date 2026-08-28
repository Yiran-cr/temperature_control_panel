import { useMemo } from 'react';
import type { TemperaturePoint } from '../domain';
import { ALERT_THRESHOLD, computeStats } from '../domain';

interface StatusCardsProps {
  data: TemperaturePoint[];
  alertCount: number;
}

interface StatItem {
  label: string;
  value: string;
  color: string;
  glow: string;
}

/**
 * 状态卡片 - 最高温 / 最低温 / 平均温 / 告警计数
 * 统计与配色来自 domain 纯函数，组件只负责展示。
 */
export default function StatusCards({ data, alertCount }: StatusCardsProps) {
  const stats = useMemo(() => calcStats(data, alertCount), [data, alertCount]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
      }}
    >
      {stats.map((stat) => (
        <div key={stat.label} className="glass-card" style={{ padding: '16px' }}>
          <div
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: 1,
              marginBottom: 8,
              textTransform: 'uppercase',
            }}
          >
            {stat.label}
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: stat.color,
              textShadow: `0 0 20px ${stat.glow}`,
              fontFamily: '"Inter", "Segoe UI", sans-serif',
            }}
          >
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function calcStats(data: TemperaturePoint[], alertCount: number): StatItem[] {
  const s = computeStats(data);

  if (s.count === 0) {
    return [
      { label: '最高温', value: '--', color: 'rgba(255,255,255,0.3)', glow: 'transparent' },
      { label: '最低温', value: '--', color: 'rgba(255,255,255,0.3)', glow: 'transparent' },
      { label: '平均温', value: '--', color: 'rgba(255,255,255,0.3)', glow: 'transparent' },
      { label: '告警', value: '0', color: 'rgba(255,255,255,0.3)', glow: 'transparent' },
    ];
  }

  const { max, min, avg } = s;
  const highColor = max! > ALERT_THRESHOLD.high ? '#ff3860' : '#5fd0ff';
  const highGlow = max! > ALERT_THRESHOLD.high ? 'rgba(255, 56, 96, 0.3)' : 'rgba(95, 208, 255, 0.3)';
  const lowColor = min! < ALERT_THRESHOLD.low ? '#5fd0ff' : '#a8e6ff';
  const lowGlow = min! < ALERT_THRESHOLD.low ? 'rgba(95, 208, 255, 0.3)' : 'rgba(168, 230, 255, 0.3)';
  const alertColor = alertCount > 0 ? '#ff3860' : 'rgba(255,255,255,0.6)';
  const alertGlow = alertCount > 0 ? 'rgba(255, 56, 96, 0.3)' : 'transparent';

  return [
    {
      label: '最高温',
      value: `${max! > ALERT_THRESHOLD.high ? '🔥 ' : ''}${max!.toFixed(1)}°C`,
      color: highColor,
      glow: highGlow,
    },
    {
      label: '最低温',
      value: `${min! < ALERT_THRESHOLD.low ? '❄ ' : ''}${min!.toFixed(1)}°C`,
      color: lowColor,
      glow: lowGlow,
    },
    {
      label: '平均温',
      value: `${avg!.toFixed(1)}°C`,
      color: '#a8e6ff',
      glow: 'rgba(168, 230, 255, 0.2)',
    },
    {
      label: '告警',
      value: `${alertCount}`,
      color: alertColor,
      glow: alertGlow,
    },
  ];
}
