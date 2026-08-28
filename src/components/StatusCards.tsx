import { useMemo } from 'react';
import type { TemperaturePoint } from '../domain';
import { computeStats, toDisplayColor } from '../domain';
import { useIsMobile } from '../hooks/useIsMobile';
import { useIsLargeScreen } from '../hooks/useIsLargeScreen';

interface StatusCardsProps {
  data: TemperaturePoint[];
}

interface StatItem {
  label: string;
  value: string;
  color: string;
  glow: string;
}

/**
 * 状态卡片 - 最高温 / 最低温 / 平均温
 * 统计与配色来自 domain 纯函数，组件只负责展示。
 */
export default function StatusCards({ data }: StatusCardsProps) {
  const isMobile = useIsMobile();
  const isLarge = useIsLargeScreen();
  const stats = useMemo(() => calcStats(data), [data]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
        gap: isLarge ? 16 : isMobile ? 10 : 12,
      }}
    >
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="glass-card"
          style={{
            padding: isLarge ? '18px 24px' : isMobile ? '12px 14px' : '16px',
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: isLarge ? 30 : isMobile ? 10 : 11,
              color: 'rgba(255,255,255,0.45)',
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            {stat.label}
          </div>
          <div
            style={{
              fontSize: isLarge ? 34 : isMobile ? 22 : 28,
              fontWeight: 700,
              color: stat.color,
              textShadow: `0 0 20px ${stat.glow}`,
              fontFamily: '"Inter", "Segoe UI", sans-serif',
              whiteSpace: 'nowrap',
              lineHeight: 1,
            }}
          >
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function calcStats(data: TemperaturePoint[]): StatItem[] {
  const s = computeStats(data);

  if (s.count === 0) {
    return [
      { label: '最高温', value: '--', color: 'rgba(255,255,255,0.3)', glow: 'transparent' },
      { label: '最低温', value: '--', color: 'rgba(255,255,255,0.3)', glow: 'transparent' },
      { label: '平均温', value: '--', color: 'rgba(255,255,255,0.3)', glow: 'transparent' },
    ];
  }

  const { max, min, avg } = s;
  const highColor = toDisplayColor(max!);
  const highGlow = `${highColor}40`;
  const lowColor = toDisplayColor(min!);
  const lowGlow = `${lowColor}40`;

  return [
    {
      label: '最高温',
      value: `${max!.toFixed(1)}°C`,
      color: highColor,
      glow: highGlow,
    },
    {
      label: '最低温',
      value: `${min!.toFixed(1)}°C`,
      color: lowColor,
      glow: lowGlow,
    },
    {
      label: '平均温',
      value: `${avg!.toFixed(1)}°C`,
      color: '#a8e6ff',
      glow: 'rgba(168, 230, 255, 0.2)',
    },
  ];
}
