import { useEffect, useState } from 'react';
import type { AlertEvent } from '../domain';

interface AlertBannerProps {
  alerts: AlertEvent[];
  onClear: () => void;
}

/**
 * 告警横幅 - 显示最近的温度越限告警
 * 自动隐藏逻辑下沉到 AlertItem（子组件挂载即定时），避免 effect 内同步 setState。
 */
export default function AlertBanner({ alerts, onClear }: AlertBannerProps) {
  if (alerts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 80,
        right: 24,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 360,
      }}
    >
      {alerts.slice(0, 5).map((alert, i) => (
        <AlertItem
          key={`${alert.timestamp}-${i}`}
          alert={alert}
          index={i}
          onClear={onClear}
        />
      ))}
    </div>
  );
}

function AlertItem({
  alert,
  index,
  onClear,
}: {
  alert: AlertEvent;
  index: number;
  onClear: () => void;
}) {
  const [visible, setVisible] = useState(true);

  // 定时器属于外部系统订阅，setState 发生在回调内，合法
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 8000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="glass-card"
      style={{
        padding: '12px 16px',
        borderLeft: `3px solid ${alert.level === 'high' ? '#ff3860' : '#5fd0ff'}`,
        animation: index === 0 ? 'slideIn 0.3s ease-out' : 'none',
        opacity: index === 0 && visible ? 1 : 0.7,
        transition: 'opacity 0.5s',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: alert.level === 'high' ? '#ff3860' : '#5fd0ff',
              marginBottom: 2,
            }}
          >
            {alert.level === 'high' ? '⚠️ 高温告警' : '❄️ 低温告警'}
            <span style={{ color: 'rgba(255,255,255,0.3)', marginLeft: 8, fontSize: 10 }}>
              {alert.storageId.replace('cold-storage-', '冷库 ').toUpperCase()}
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
            {alert.message}
          </div>
          <div
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.3)',
              marginTop: 4,
              fontFamily: 'monospace',
            }}
          >
            {new Date(alert.timestamp).toLocaleTimeString('zh-CN')}
          </div>
        </div>
        {index === 0 && (
          <button
            onClick={onClear}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.3)',
              cursor: 'pointer',
              fontSize: 16,
              padding: '0 0 0 8px',
            }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
