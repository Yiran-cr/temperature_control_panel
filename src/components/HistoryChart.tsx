import { useEffect, useRef, useMemo } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { graphic, type ECharts } from 'echarts/core';
import type { TemperaturePoint } from '../domain';
import { toDisplayColor } from '../domain';
import { TIME_RANGES } from '../stores/timeRangeStore';
import { useIsMobile } from '../hooks/useIsMobile';
import { useIsLargeScreen } from '../hooks/useIsLargeScreen';

// 按需引入，避免全量 echarts（1MB+）
echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

interface HistoryChartProps {
  data: TemperaturePoint[];
  timeRange: number;
  onTimeRangeChange: (range: number) => void;
  /** 大屏模式：卡片与图表占满容器高度（配合外层 flex 布局） */
  fillHeight?: boolean;
}

/**
 * 历史趋势图 - ECharts 面积折线图（按需加载）
 */
export default function HistoryChart({
  data,
  timeRange,
  onTimeRangeChange,
  fillHeight = false,
}: HistoryChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<ECharts | null>(null);
  const isMobile = useIsMobile();
  const isLarge = useIsLargeScreen();

  const option = useMemo(() => {
    const formatTime = (ts: number) =>
      new Date(ts).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    const values = data.map((d) => d.value);

    // 动态 Y 轴范围：以当前数据最高/最低温为基准，
    // 向外留 15%（至少 2°C）余量，避免曲线顶到图顶/底。
    let yMin = -10;
    let yMax = 10;
    if (values.length > 0) {
      const dataMax = Math.max(...values);
      const dataMin = Math.min(...values);
      const span = dataMax - dataMin;
      const padding = Math.max(span * 0.15, 2);
      yMax = dataMax + padding;
      yMin = dataMin - padding;
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(10, 14, 26, 0.9)',
        borderColor: 'rgba(95, 208, 255, 0.3)',
        borderWidth: 1,
        textStyle: { color: '#fff', fontSize: isLarge ? 14 : 12 },
        formatter: (params: unknown) => {
          const p = (params as Array<{ value: number | [number, number] }>)[0];
          if (!p) return '';
          const [ts, val] = Array.isArray(p.value) ? p.value : [0, p.value];
          const color = toDisplayColor(val);
          return `<span style="color:${color};font-weight:bold;font-size:${isLarge ? 18 : 16}px">${val}°C</span><br/>
                  <span style="color:rgba(255,255,255,0.5)">${formatTime(ts)}</span>`;
        },
      },
      grid: {
        left: isLarge ? 62 : isMobile ? 38 : 50,
        right: isLarge ? 16 : 12,
        top: isLarge ? 26 : 20,
        bottom: isLarge ? 34 : isMobile ? 26 : 30,
      },
      xAxis: {
        type: 'time',
        boundaryGap: false,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: {
          color: 'rgba(255,255,255,0.4)',
          fontSize: isLarge ? 13 : 10,
          fontFamily: 'monospace',
          formatter: (ts: number) => formatTime(ts),
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        min: yMin,
        max: yMax,
        splitLine: {
          lineStyle: {
            color: 'rgba(255,255,255,0.05)',
            type: 'dashed',
          },
        },
        axisLabel: {
          color: 'rgba(255,255,255,0.4)',
          fontSize: isLarge ? 13 : 10,
          fontFamily: 'monospace',
          // 刻度值只保留 1 位小数，避免 3.75°C 这类过细刻度
          formatter: (v: number) => `${Number(v.toFixed(1))}°C`,
        },
      },
      series: [
        {
          type: 'line',
          data: data.map((d) => [d.timestamp, d.value]),
          smooth: true,
          // 24H 单窗最多约 8 万点，交由 ECharts LTTB 降采样渲染，保证流畅且不丢形状
          sampling: 'lttb',
          symbol: 'none',
          lineStyle: {
            color: '#5fd0ff',
            width: 2,
            shadowColor: 'rgba(95, 208, 255, 0.4)',
            shadowBlur: 8,
          },
          areaStyle: {
            color: new graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(95, 208, 255, 0.35)' },
              { offset: 0.5, color: 'rgba(42, 109, 245, 0.15)' },
              { offset: 1, color: 'rgba(10, 14, 26, 0.02)' },
            ]),
          },
        },
      ],
    };
  }, [data, isMobile, isLarge]);

  // 实例只创建一次，resize 监听只挂一次（避免随 option 每秒重复注册）
  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;

    instanceRef.current = echarts.init(el, undefined, { renderer: 'canvas' });

    const handleResize = () => instanceRef.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  // 数据变化时仅更新配置
  useEffect(() => {
    instanceRef.current?.setOption(option, true);
  }, [option]);

  return (
    <div
      className="glass-card"
      style={{
        padding: isMobile ? '16px 12px 8px' : '20px 16px 12px',
        height: fillHeight ? '100%' : undefined,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 3,
              height: 14,
              borderRadius: 2,
              background: 'linear-gradient(180deg, #5fd0ff, #2a6df5)',
              flexShrink: 0,
            }}
          />
          <h3
            style={{
              margin: 0,
              fontSize: isMobile ? 13 : 15,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.8)',
              letterSpacing: 1,
            }}
          >
            历史趋势
          </h3>
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          {TIME_RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => onTimeRangeChange(r.value)}
              style={{
                padding: isMobile ? '4px 9px' : '4px 12px',
                fontSize: isMobile ? 10 : 11,
                fontWeight: timeRange === r.value ? 600 : 400,
                color:
                  timeRange === r.value
                    ? '#5fd0ff'
                    : 'rgba(255,255,255,0.4)',
                background:
                  timeRange === r.value
                    ? 'rgba(95, 208, 255, 0.1)'
                    : 'transparent',
                border: `1px solid ${
                  timeRange === r.value
                    ? 'rgba(95, 208, 255, 0.3)'
                    : 'rgba(255,255,255,0.1)'
                }`,
                borderRadius: 4,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'monospace',
                touchAction: 'manipulation',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={chartRef}
        style={{
          width: '100%',
          flex: fillHeight ? 1 : undefined,
          minHeight: fillHeight ? 0 : undefined,
          height: fillHeight ? undefined : isMobile ? 170 : 220,
        }}
      />
    </div>
  );
}
