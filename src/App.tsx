import { useEffect, memo, type ReactNode } from 'react';
import ParticleBackground from './components/ParticleBackground';
import Header from './components/Header';
import MainTemperature from './components/MainTemperature';
import HistoryChart from './components/HistoryChart';
import StatusCards from './components/StatusCards';
import FitToViewport from './components/FitToViewport';
import { COLD_STORAGE } from './config';
import { useIsMobile } from './hooks/useIsMobile';
import { useIsLargeScreen } from './hooks/useIsLargeScreen';
import { useConnectionStore } from './stores/connectionStore';
import { useTemperatureStore } from './stores/temperatureStore';
import { useTimeRangeStore } from './stores/timeRangeStore';

/**
 * 冷库温度监控面板 - 入口组件（单冷库，预留扩展）
 *
 * 布局模式：
 * - 大屏模式（≥1280×700）：以 1920×1080 设计画布双栏布局，经 FitToViewport
 *   等比缩放铺满视口，保证"一屏显示、无滚动"；
 * - 桌面/移动端：单栏流式布局，页面可滚动。
 *
 * 只做状态编排（读 store → 传 props），不承载业务逻辑；
 * 具体规则收敛在 domain，数据获取收敛在 stores/infrastructure。
 */
const MemoParticle = memo(ParticleBackground);

/** 大屏设计画布尺寸（按 16:9 指挥大屏设计，再等比缩放到任意屏幕） */
const CANVAS_W = 1920;
const CANVAS_H = 1080;

export default function App() {
  const isMobile = useIsMobile();
  const isLarge = useIsLargeScreen();
  const status = useConnectionStore((s) => s.status);
  const sourceName = useConnectionStore((s) => s.sourceName);
  const current = useTemperatureStore((s) => s.current);
  const history = useTemperatureStore((s) => s.history);
  const loading = useTemperatureStore((s) => s.loading);
  const error = useTemperatureStore((s) => s.error);
  const rangeMs = useTimeRangeStore((s) => s.rangeMs);
  const setRange = useTimeRangeStore((s) => s.setRange);

  // 初始化：连接数据源 + 订阅实时流 + 加载初始历史
  useEffect(() => {
    void useTemperatureStore.getState().init();
    return () => useTemperatureStore.getState().dispose();
  }, []);

  // 时间范围变化时刷新历史（初始加载由 init 内部完成）
  useEffect(() => {
    if (!useTemperatureStore.getState().source) return;
    void useTemperatureStore.getState().refreshHistory(rangeMs);
  }, [rangeMs]);

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          color: '#ff3860',
          fontSize: 18,
          padding: 24,
          textAlign: 'center',
        }}
      >
        {error}
      </div>
    );
  }

  // 大屏模式：整体放进 1920×1080 画布 → FitToViewport 等比缩放铺满，无滚动。
  // 排版：顶部 KPI 概览条（最高/最低/平均）→ 下方左「实时温度」+ 右「历史趋势」双视图。
  const largeLayout = (
    <FitToViewport>
      <div
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Header connected={status === 'connected'} sourceName={sourceName} />

        <main
          style={{
            position: 'relative',
            zIndex: 1,
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            padding: '18px 28px 20px',
            boxSizing: 'border-box',
          }}
        >
          {loading ? (
            <div style={{ flex: 1, minHeight: 0 }}>
              <LoadingView />
            </div>
          ) : (
            <>
              {/* 顶部 KPI 概览条：最高温 / 最低温 / 平均温 */}
              <StatusCards data={history} />

              {/* 下方双视图：左实时温度仪表盘 / 右历史趋势图 */}
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 0.95fr) minmax(0, 1.05fr)',
                  gap: 18,
                }}
              >
                <div
                  className="glass-card"
                  style={{
                    minHeight: 0,
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }}
                >
                  <SectionTitle>实时温度</SectionTitle>
                  <div
                    style={{
                      flex: 1,
                      minHeight: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <MainTemperature
                      point={current}
                      name={COLD_STORAGE.name}
                      history={history}
                    />
                  </div>
                </div>

                <HistoryChart
                  data={history}
                  timeRange={rangeMs}
                  onTimeRangeChange={setRange}
                  fillHeight
                />
              </div>
            </>
          )}
        </main>
      </div>
    </FitToViewport>
  );

  // 桌面 / 移动端：单栏流式布局（页面可滚动）
  const normalLayout = (
    <Header connected={status === 'connected'} sourceName={sourceName} />
  );

  return (
    <div
      className={isLarge ? 'app-viewport' : undefined}
      style={{
        position: 'relative',
        ...(isLarge ? { overflow: 'hidden' } : { minHeight: '100vh' }),
      }}
    >
      <MemoParticle />

      {isLarge ? (
        largeLayout
      ) : (
        <>
          {normalLayout}
          {/* 主内容区 */}
          <main
            style={{
              position: 'relative',
              zIndex: 1,
              maxWidth: 1000,
              margin: '0 auto',
              padding: isMobile ? '12px 12px 32px' : '24px 20px 40px',
            }}
          >
            {loading ? (
              <LoadingView />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* 主温度区 */}
                <div className="glass-card" style={{ padding: '0 0 16px' }}>
                  <MainTemperature
                    point={current}
                    name={COLD_STORAGE.name}
                    history={history}
                  />
                </div>

                {/* 状态卡片：最高温 / 最低温 / 平均温 */}
                <StatusCards data={history} />

                {/* 历史趋势图 */}
                <HistoryChart
                  data={history}
                  timeRange={rangeMs}
                  onTimeRangeChange={setRange}
                />
              </div>
            )}
          </main>
        </>
      )}
    </div>
  );
}

/** 大屏卡片标题栏（蓝色强调条 + 标题，与 HistoryChart 标题风格统一） */
function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '14px 18px 0',
      }}
    >
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
          fontSize: 15,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.8)',
          letterSpacing: 1,
        }}
      >
        {children}
      </h3>
    </div>
  );
}

/** 加载中的旋转指示器（两种布局共用） */
function LoadingView() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: 300,
        color: 'rgba(255,255,255,0.3)',
        fontSize: 16,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 40,
            height: 40,
            border: '3px solid rgba(95, 208, 255, 0.1)',
            borderTopColor: '#5fd0ff',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px',
          }}
        />
        正在连接数据源...
      </div>
    </div>
  );
}
