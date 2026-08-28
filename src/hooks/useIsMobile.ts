import { useMediaQuery } from './useMediaQuery';

/**
 * 移动端断点：视口宽度 ≤ 640px 视为手机。
 */
const MOBILE_QUERY = '(max-width: 640px)';

export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}
