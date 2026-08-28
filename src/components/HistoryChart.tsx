import { useEffect, useRef, useMemo } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { graphic, type ECharts } from 'echarts/core';
import type { TemperaturePoint } from '../domain';
import { ALERT_THRESHOLD } from '../domain';
import { TIME_RANGES } from '../stores/timeRangeStore';

// 按需引入，避免全量 echarts（1MB+）
echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

interface HistoryChartProps {
  data: TemperaturePoint[];
  timeRange: number;
  onTimeRangeChange: (range: number) => void;
}

/**
 * 历史趋势图 - ECharts 面积折线图（按需加载）
 * 告警阈值线取自 domain 单点定义，不在组件内写死。
 */
export default function HistoryChart({
  data,
  timeRange,
  onTimeRangeChange,
}: HistoryChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<ECharts | null>(null);

  const option = useMemo(() => {
    const times = data.map((d) =>
      new Date(d.timestamp).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    );
    const values = data.map((d) => d.value);

    const alertHigh = ALERT_THRESHOLD.high;
    const alertLow = ALERT_THRESHOLD.low;

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(10, 14, 26, 0.9)',
        borderColor: 'rgba(95, 208, 255, 0.3)',
        borderWidth: 1,
        textStyle: { color: '#fff', fontSize: 12 },
        formatter: (params: unknown) => {
          const p = (params as Array<{ axisValueLabel: string; value: number }>)[0];
          if (!p) return '';
          const color = p.value > alertHigh ? '#ff3860' : p.value < alertLow ? '#5fd0ff' : '#a8e6ff';
          return `<span style="color:${color};font-weight:bold;font-size:16px">${p.value}°C</span><br/>
                  <span style="color:rgba(255,255,255,0.5)">${p.axisValueLabel}</span>`;
        },
      },
      grid: {
        left: 50,
        right: 16,
        top: 20,
        bottom: 30,
      },
      xAxis: {
        type: 'category',
        data: times,
        boundaryGap: false,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: {
          color: 'rgba(255,255,255,0.4)',
          fontSize: 10,
          fontFamily: 'monospace',
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        min: -10,
        max: 10,
        splitLine: {
          lineStyle: {
            color: 'rgba(255,255,255,0.05)',
            type: 'dashed',
          },
        },
        axisLabel: {
          color: 'rgba(255,255,255,0.4)',
          fontSize: 10,
          fontFamily: 'monospace',
          formatter: '{value}°C',
        },
      },
      series: [
        {
          type: 'line',
          data: values,
          smooth: true,
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
        // 高温告警线
        {
          type: 'line',
          data: values.map(() => alertHigh),
          symbol: 'none',
          lineStyle: {
            color: 'rgba(255, 56, 96, 0.4)',
            width: 1,
            type: 'dashed',
          },
          z: 1,
        },
        // 低温告警线
        {
          type: 'line',
          data: values.map(() => alertLow),
          symbol: 'none',
          lineStyle: {
            color: 'rgba(95, 208, 255, 0.4)',
            width: 1,
            type: 'dashed',
          },
          z: 1,
        },
      ],
    };
  }, [data]);

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
    <div className="glass-card" style={{ padding: '20px 16px 12px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.8)',
            letterSpacing: 1,
          }}
        >
          历史趋势
        </h3>

        <div style={{ display: 'flex', gap: 4 }}>
          {TIME_RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => onTimeRangeChange(r.value)}
              style={{
                padding: '4px 12px',
                fontSize: 11,
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
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={chartRef}
        style={{ width: '100%', height: 220 }}
      />
    </div>
  );
}
