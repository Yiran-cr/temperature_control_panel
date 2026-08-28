import { useEffect, useRef, useState } from 'react';
import type { TemperaturePoint, AlertLevel } from '../domain';
import { toDisplayColor } from '../domain';

interface MainTemperatureProps {
  point: TemperaturePoint | null;
  name: string;
  alertLevel: AlertLevel;
}

/**
 * 主温度显示组件
 *
 * 包含：
 * - 超大温度数字（翻牌滚动动画）
 * - SVG 弧形仪表盘（冷色渐变 + 刻度 + 光晕）
 * - 告警颜色变化/脉冲
 */
export default function MainTemperature({
  point,
  name,
  alertLevel,
}: MainTemperatureProps) {
  // 翻牌动画的"上一值"由 DigitRoller 内部自管，无需在此派生状态
  if (!point) {
    return (
      <div style={containerStyle}>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 20 }}>
          加载中...
        </div>
      </div>
    );
  }

  const isAlert = alertLevel !== 'none';
  const tempColor = isAlert ? '#ff3860' : toDisplayColor(point.value);

  // 数字部分使用固定宽度字体，避免数字变化时左右抖动
  const numberFontFamily =
    '"Roboto Mono", "JetBrains Mono", "Consolas", "Courier New", monospace';

  return (
    <div style={containerStyle}>
      {/* SVG 弧形仪表盘 */}
      <svg viewBox="0 0 400 220" style={svgStyle}>
        {/* 背景弧 */}
        <path
          d="M 40 180 A 160 160 0 0 1 360 180"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* 温度弧线 - 根据温度映射角度 */}
        <ArcPath
          value={point.value}
          min={-35}
          max={15}
          color={tempColor}
          isAlert={isAlert}
        />
        {/* 刻度 */}
        {[-35, -25, -15, -5, 5, 15].map((t) => {
          const angle = mapTempToAngle(t, -35, 15);
          return (
            <g key={t}>
              <line
                x1={200 + 145 * Math.cos(angle)}
                y1={180 - 145 * Math.sin(angle)}
                x2={200 + 155 * Math.cos(angle)}
                y2={180 - 155 * Math.sin(angle)}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="1"
              />
              <text
                x={200 + 170 * Math.cos(angle)}
                y={180 - 170 * Math.sin(angle)}
                fill="rgba(255,255,255,0.35)"
                fontSize="10"
                textAnchor="middle"
                dominantBaseline="middle"
                fontFamily="monospace"
              >
                {t}°
              </text>
            </g>
          );
        })}
        {/* 告警脉冲环 */}
        {isAlert && (
          <circle
            cx="200"
            cy="180"
            r="155"
            fill="none"
            stroke="#ff3860"
            strokeWidth="2"
            opacity="0.4"
            className="alert-pulse-ring"
          />
        )}
      </svg>

      {/* 超大温度数字 */}
      <div style={numberContainerStyle}>
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: tempColor,
            textShadow: `0 0 40px ${tempColor}40, 0 0 80px ${tempColor}20`,
            transition: 'color 0.5s, text-shadow 0.5s',
            fontFamily: numberFontFamily,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: -1,
            lineHeight: 1,
            // 固定宽度容纳最大显示值（如 -35.0°C），数字变化也不引起整体位移
            width: 320,
            textAlign: 'center',
            position: 'relative',
          }}
        >
          <DigitRoller value={point.value} />
          <span style={{ fontSize: 28, fontWeight: 300, marginLeft: 4 }}>
            °C
          </span>
        </div>

        <div
          style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.5)',
            marginTop: 8,
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}
        >
          {name} · 实际温度
        </div>

        {/* 更新时间 */}
        <div
          style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.35)',
            marginTop: 6,
            fontFamily: 'monospace',
            letterSpacing: 0.5,
          }}
        >
          更新于 {formatFullTime(point.timestamp)}
        </div>
      </div>
    </div>
  );
}

/** 完整时间格式：YYYY-MM-DD HH:mm:ss */
function formatFullTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 将温度值映射到弧线角度（-35°C → 0° → 15°C → 180°） */
function mapTempToAngle(value: number, min: number, max: number): number {
  const ratio = (value - min) / (max - min);
  return Math.PI * (1 - ratio); // 0 → π, 1 → 0
}

/** 温度值对应的弧线端点角度 */
function tempToEndAngle(value: number): number {
  const clamped = Math.max(-35, Math.min(15, value));
  return mapTempToAngle(clamped, -35, 15);
}

function ArcPath({
  value,
  color,
  isAlert,
}: {
  value: number;
  min: number;
  max: number;
  color: string;
  isAlert: boolean;
}) {
  const endAngle = tempToEndAngle(value);

  const cx = 200,
    cy = 180,
    r = 160;

  const startX = cx + r * Math.cos(Math.PI);
  const startY = cy - r * Math.sin(Math.PI);
  // SVG 的 y 轴向下为正，这里使用负号 sin 使端点落在上半圈（屏幕上方）
  const endX = cx + r * Math.cos(endAngle);
  const endY = cy - r * Math.sin(endAngle);
  // 从左侧（180°）沿上半圈到端点，跨度恒为 ≤180° 的劣弧，故 largeArc=0、sweep=1（正向角）
  const largeArc = 0;
  const sweep = 1;

  return (
    <>
      <path
        d={`M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} ${sweep} ${endX} ${endY}`}
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
        className={isAlert ? 'alert-pulse-stroke' : ''}
        style={{
          filter: `drop-shadow(0 0 8px ${color}60)`,
          transition: 'stroke 0.5s',
        }}
      />
      {/* 端点发光圆点 */}
      <circle
        cx={endX}
        cy={endY}
        r="6"
        fill={color}
        style={{
          filter: `drop-shadow(0 0 12px ${color})`,
          transition: 'fill 0.5s',
        }}
      />
      <circle
        cx={endX}
        cy={endY}
        r="3"
        fill="#fff"
        opacity="0.8"
        style={{ transition: 'all 0.5s' }}
      />
    </>
  );
}

/** 数字翻牌滚动动画：内部自管"上一值"，从当前显示值平滑滚动到最新值 */
function DigitRoller({ value }: { value: number }) {
  const lastValueRef = useRef(value);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const start = lastValueRef.current;
    lastValueRef.current = value;
    const end = value;
    // 缩短动画时长，减少"闪动"感
    const duration = 300;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * eased;
      setDisplay(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  return <span>{display.toFixed(1)}</span>;
}

// === Styles ===

const containerStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px 0',
};

const svgStyle: React.CSSProperties = {
  width: 400,
  height: 220,
  overflow: 'visible',
};

const numberContainerStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  textAlign: 'center',
  marginTop: 20,
};