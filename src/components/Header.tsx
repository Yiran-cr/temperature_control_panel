import { useEffect, useState } from 'react';

import type { DataSourceKind } from '../config';
import { APP_TITLE } from '../config';
import { useIsMobile } from '../hooks/useIsMobile';
import { useIsLargeScreen } from '../hooks/useIsLargeScreen';

/** 数据源展示名 */
const SOURCE_LABEL: Record<DataSourceKind, string> = {
  mock: '模拟数据',
  gateway: '网关',
};

interface HeaderProps {
  connected: boolean;
  sourceName: DataSourceKind;
}

export default function Header({ connected, sourceName }: HeaderProps) {
  const [time, setTime] = useState(new Date());
  const isMobile = useIsMobile();
  const isLarge = useIsLargeScreen();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const pad = (n: number) => String(n).padStart(2, '0');

  const dateStr = `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(
    time.getDate(),
  )} ${'周' + '日一二三四五六'[time.getDay()]}`;
  const timeStr = `${pad(time.getHours())}${pad(time.getMinutes())}${pad(
    time.getSeconds(),
  )}`;

  return (
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: isLarge ? '16px 32px' : isMobile ? '10px 12px' : '12px 24px',
        background: 'rgba(10, 14, 26, 0.8)',
        borderBottom: '1px solid rgba(95, 208, 255, 0.15)',
        backdropFilter: 'blur(12px)',
        position: 'relative',
        zIndex: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: isLarge ? 16 : isMobile ? 8 : 12 }}>
        <div
          style={{
            width: isMobile ? 28 : 32,
            height: isMobile ? 28 : 32,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #5fd0ff, #2a6df5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: isMobile ? 14 : 16,
            fontWeight: 'bold',
            color: '#fff',
            boxShadow: '0 0 16px rgba(95, 208, 255, 0.4)',
            flexShrink: 0,
          }}
        >
          ❄
        </div>
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              margin: 0,
              fontSize: isLarge ? 24 : isMobile ? 15 : 18,
              fontWeight: 700,
              background: 'linear-gradient(90deg, #5fd0ff, #a8e6ff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: isLarge ? 3 : isMobile ? 1 : 2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {APP_TITLE}
          </h1>
          {!isMobile && (
            <span
              style={{
                fontSize: isLarge ? 13 : 11,
                color: 'rgba(255,255,255,0.4)',
                letterSpacing: isLarge ? 2 : 1,
              }}
            >
              COLD STORAGE TEMPERATURE MONITOR
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: isLarge ? 32 : isMobile ? 10 : 24 }}>
        {/* 日期 + 数字时钟 */}
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: isLarge ? 30 : isMobile ? 16 : 20,
              fontWeight: 600,
              color: '#5fd0ff',
              letterSpacing: isLarge ? 5 : isMobile ? 2 : 3,
              textShadow: '0 0 12px rgba(95, 208, 255, 0.4)',
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
          >
            {timeStr.slice(0, 2)}
            <span style={{ opacity: 0.5, fontWeight: 300 }}>:</span>
            {timeStr.slice(2, 4)}
            <span style={{ opacity: 0.5, fontWeight: 300 }}>:</span>
            {timeStr.slice(4)}
          </div>
          {!isMobile && (
            <div
              style={{
                fontSize: isLarge ? 14 : 11,
                color: 'rgba(255,255,255,0.4)',
                fontFamily: 'monospace',
                letterSpacing: isLarge ? 2 : 1,
                marginTop: 3,
              }}
            >
              {dateStr}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: connected ? '#5fd0ff' : '#ff3860',
              boxShadow: connected
                ? '0 0 8px rgba(95, 208, 255, 0.8)'
                : '0 0 8px rgba(255, 56, 96, 0.8)',
              animation: connected ? 'pulse 2s infinite' : 'none',
              flexShrink: 0,
            }}
          />
          {!isMobile && (
            <span
              style={{
                fontSize: isLarge ? 15 : 12,
                color: connected ? 'rgba(95, 208, 255, 0.8)' : 'rgba(255, 56, 96, 0.8)',
                whiteSpace: 'nowrap',
              }}
            >
              {connected
                ? `已连接 · ${SOURCE_LABEL[sourceName]}`
                : '断开'}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}