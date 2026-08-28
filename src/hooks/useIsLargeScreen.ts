import { useMediaQuery } from './useMediaQuery';

/**
 * 大屏断点：视口宽度 ≥ 1280px 且高度 ≥ 700px 视为大屏（指挥中心/壁挂大屏）。
 * 命中后进入"大屏模式"：一屏展示、无滚动。
 *
 * 额外支持 URL 查询参数 ?large=1 强制进入大屏模式，
 * 便于在任意屏幕（如笔记本）上预览大屏布局。
 */
const LARGE_QUERY = '(min-width: 1280px) and (min-height: 700px)';

export function useIsLargeScreen(): boolean {
  const matches = useMediaQuery(LARGE_QUERY);
  const forced =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('large');
  return forced || matches;
}
