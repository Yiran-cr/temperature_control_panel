import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

interface FitToViewportProps {
  children: ReactNode;
  /**
   * 最大放大倍数。大屏模式允许放大以铺满屏幕；
   * 若想限制在内容原始尺寸内，可传 1。
   */
  maxScale?: number;
  style?: CSSProperties;
}

/**
 * 大屏自适应容器：把内容等比缩放到容器内，保证"一屏显示、无需滚动"。
 *
 * 原理：以内容自然尺寸（offsetWidth/offsetHeight，transform 不影响布局尺寸）
 * 为基准，取「容器宽/内容宽」与「容器高/内容高」的较小值作为缩放系数，
 * 通过 transform: scale 等比缩放并居中。
 *
 * 用 ResizeObserver 监听内容尺寸变化（如图表加载完成后变高），随时重新计算。
 */
export default function FitToViewport({
  children,
  maxScale = Number.POSITIVE_INFINITY,
  style,
}: FitToViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const update = () => {
      const availW = container.clientWidth;
      const availH = container.clientHeight;
      const naturalW = content.offsetWidth;
      const naturalH = content.offsetHeight;
      if (!naturalW || !naturalH) return;

      const next = Math.min(availW / naturalW, availH / naturalH, maxScale);
      setScale(Math.max(0.1, next));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(content);
    window.addEventListener('resize', update);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [maxScale]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        ref={contentRef}
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'center',
          flexShrink: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}
