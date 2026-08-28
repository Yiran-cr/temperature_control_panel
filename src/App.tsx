import { useEffect } from 'react';
import { memo } from 'react';
import ParticleBackground from './components/ParticleBackground';
import Header from './components/Header';
import MainTemperature from './components/MainTemperature';
import HistoryChart from './components/HistoryChart';
import StatusCards from './components/StatusCards';
import AlertBanner from './components/AlertBanner';
import { COLD_STORAGE } from './config';
import { useConnectionStore } from './stores/connectionStore';
import { useTemperatureStore } from './stores/temperatureStore';
import { useAlertStore } from './stores/alertStore';
import { useTimeRangeStore } from './stores/timeRangeStore';

/**
 * 冷库温度监控面板 - 入口组件（单冷库，预留扩展）
 *
 * 只做状态编排（读 store → 传 props），不承载业务逻辑；
 * 具体规则收敛在 domain，数据获取收敛在 stores/infrastructure。
 */
const MemoParticle = memo(ParticleBackground);

export default function App() {
  const status = useConnectionStore((s) => s.status);
  const sourceName = useConnectionStore((s) => s.sourceName);
  const current = useTemperatureStore((s) => s.current);
  const alertLevel = useTemperatureStore((s) => s.alertLevel);
  const history = useTemperatureStore((s) => s.history);
  const loading = useTemperatureStore((s) => s.loading);
  const error = useTemperatureStore((s) => s.error);
  const alerts = useAlertStore((s) => s.alerts);
  const clearAlerts = useAlertStore((s) => s.clear);
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
        }}
      >
        {error}
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      <MemoParticle />

      {/* 告警横幅 */}
      <AlertBanner alerts={alerts} onClear={clearAlerts} />

      {/* 顶部标题栏 */}
      <Header connected={status === 'connected'} sourceName={sourceName} />

      {/* 主内容区 */}
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 1000,
          margin: '0 auto',
          padding: '24px 20px 40px',
        }}
      >
        {loading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 400,
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
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* 主温度区 */}
            <div className="glass-card" style={{ padding: '0 0 16px' }}>
              <MainTemperature
                point={current}
                name={COLD_STORAGE.name}
                alertLevel={alertLevel}
              />
            </div>

            {/* 状态卡片：最高温 / 最低温 / 平均温 / 告警 */}
            <StatusCards data={history} alertCount={alerts.length} />

            {/* 历史趋势图 */}
            <HistoryChart
              data={history}
              timeRange={rangeMs}
              onTimeRangeChange={setRange}
            />
          </div>
        )}
      </main>
    </div>
  );
}
