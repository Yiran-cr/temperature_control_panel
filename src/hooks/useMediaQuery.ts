import { useEffect, useState } from 'react';

/**
 * 通用响应式断点 Hook：订阅指定媒体查询，返回当前是否匹配。
 * 通过 matchMedia 监听变化（含横竖屏切换），供各组件做响应式布局。
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);

    // 兼容老版本 Safari 的 addListener 接口
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, [query]);

  return matches;
}
