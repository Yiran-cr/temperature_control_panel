import { useEffect, useMemo, useRef, useState } from 'react';
import type { TemperaturePoint } from '../domain';
import { toDisplayColor } from '../domain';
import { useIsMobile } from '../hooks/useIsMobile';
import { useIsLargeScreen } from '../hooks/useIsLargeScreen';

interface MainTemperatureProps {
  point: TemperaturePoint | null;
  name: string;
  /** 历史数据：驱动仪表盘量程自动缩放（与线型图 Y 轴同规则） */
  history?: TemperaturePoint[];
}

/**
 * 主温度显示组件
 *
 * 包含：
 * - 超大温度数字（翻牌滚动动画）
 * - SVG 弧形仪表盘（冷色渐变 + 刻度 + 光晕）
 */
export default function MainTemperature({ point, name, history }: MainTemperatureProps) {
  const isMobile = useIsMobile();
  const isLarge = useIsLargeScreen();

  // 仪表盘量程：按历史最高/最低温动态缩放（与线型图 Y 轴同一套余量规则），
  // 替代固定 -35~15，保证弧线始终清晰可读
  const gauge = useMemo(
    () =>
      computeGaugeRange(
        history && history.length > 0 ? history.map((d) => d.value) : point ? [point.value] : [],
      ),
    [history, point],
  );

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

  const tempColor = toDisplayColor(point.value);

  // 数字部分使用固定宽度字体，避免数字变化时左右抖动
  const numberFontFamily =
    '"Roboto Mono", "JetBrains Mono", "Consolas", "Courier New", monospace';

  return (
    <div
      style={isLarge ? largeContainerStyle : isMobile ? mobileContainerStyle : containerStyle}
    >
      {/* SVG 弧形仪表盘（viewBox 固定比例，宽度随容器自适应缩放） */}
      <svg
        viewBox="0 0 400 220"
        style={isLarge ? largeSvgStyle : isMobile ? mobileSvgStyle : svgStyle}
      >
        {/* 背景弧 */}
        <path
          d="M 40 180 A 160 160 0 0 1 360 180"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* 温度弧线 - 根据温度映射角度（量程随数据动态缩放） */}
        <ArcPath value={point.value} min={gauge.min} max={gauge.max} color={tempColor} />
        {/* 刻度 - 随量程动态生成 */}
        {gauge.ticks.map((t) => {
          const angle = mapTempToAngle(t, gauge.min, gauge.max);
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
      </svg>

      {/* 超大温度数字 */}
      <div
        style={
          isLarge
            ? largeNumberContainerStyle
            : isMobile
              ? mobileNumberContainerStyle
              : numberContainerStyle
        }
      >
        <div
          style={{
            fontSize: isLarge ? 88 : isMobile ? 46 : 72,
            fontWeight: 800,
            color: tempColor,
            textShadow: `0 0 40px ${tempColor}40, 0 0 80px ${tempColor}20`,
            transition: 'color 0.5s, text-shadow 0.5s',
            fontFamily: numberFontFamily,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: -1,
            lineHeight: 1,
            // 固定宽度容纳最大显示值（如 -35.0°C），数字变化也不引起整体位移
            width: isLarge ? 420 : isMobile ? 200 : 320,
            textAlign: 'center',
            position: 'relative',
          }}
        >
          <DigitRoller value={point.value} />
          <span
            style={{
              fontSize: isLarge ? 32 : isMobile ? 20 : 28,
              fontWeight: 300,
              marginLeft: 4,
            }}
          >
            °C
          </span>
        </div>

        <div
          style={{
            fontSize: isLarge ? 15 : isMobile ? 12 : 13,
            color: 'rgba(255,255,255,0.5)',
            marginTop: 8,
            letterSpacing: isLarge ? 4 : isMobile ? 2 : 3,
            textTransform: 'uppercase',
          }}
        >
          {name} · 实际温度
        </div>

        {/* 更新时间 */}
        <div
          style={{
            fontSize: isLarge ? 12 : isMobile ? 10 : 11,
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

/** 将温度值映射到弧线角度（min → 0° → max → 180°） */
function mapTempToAngle(value: number, min: number, max: number): number {
  const ratio = (value - min) / (max - min);
  return Math.PI * (1 - ratio); // 0 → π, 1 → 0
}

/**
 * 动态仪表盘量程：以历史最高/最低温为基准，向外留 15%（至少 2°C）余量，
 * 与线型图 Y 轴同一套规则，再按刻度步长取整，保证刻度清晰。
 */
function computeGaugeRange(values: number[]): {
  min: number;
  max: number;
  ticks: number[];
} {
  let min = -10;
  let max = 10;
  if (values.length > 0) {
    const dataMax = Math.max(...values);
    const dataMin = Math.min(...values);
    const span = dataMax - dataMin;
    const padding = Math.max(span * 0.15, 2);
    max = dataMax + padding;
    min = dataMin - padding;
  }

  // 刻度步长按跨度自适应：跨度小用细刻度，跨度大用粗刻度
  const span = max - min;
  const step = span <= 12 ? 2 : span <= 30 ? 5 : 10;
  const tickMin = Math.floor(min / step) * step;
  const tickMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let t = tickMin; t <= tickMax + 1e-9; t += step) {
    ticks.push(Math.round(t * 10) / 10);
  }
  return { min: tickMin, max: tickMax, ticks };
}

/** 温度值对应的弧线端点角度（量程动态传入） */
function tempToEndAngle(value: number, min: number, max: number): number {
  const clamped = Math.max(min, Math.min(max, value));
  return mapTempToAngle(clamped, min, max);
}

function ArcPath({
  value,
  min,
  max,
  color,
}: {
  value: number;
  min: number;
  max: number;
  color: string;
}) {
  const endAngle = tempToEndAngle(value, min, max);

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
        style={{
          filter: `drop-shadow(0 0 8px ${color}60)`,
          transition: 'stroke 0.5s',
        }}
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

const mobileContainerStyle: React.CSSProperties = {
  ...containerStyle,
  padding: '12px 0 8px',
};

const largeContainerStyle: React.CSSProperties = {
  ...containerStyle,
  padding: '28px 0 20px',
};

const svgStyle: React.CSSProperties = {
  width: 400,
  height: 220,
  overflow: 'visible',
};

const mobileSvgStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 400,
  height: 'auto',
  overflow: 'visible',
};

const largeSvgStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 700,
  height: 330,
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

const mobileNumberContainerStyle: React.CSSProperties = {
  ...numberContainerStyle,
  marginTop: 16,
};

const largeNumberContainerStyle: React.CSSProperties = {
  ...numberContainerStyle,
  marginTop: 28,
};