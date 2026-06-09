'use client';

import { useEffect, useState } from 'react';

const KEY = 'tradinglist_darkmode';

export function useDarkMode() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(KEY);
    if (stored !== null) return stored === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem(KEY, String(isDark));
  }, [isDark]);

  const toggle = () => setIsDark((v) => !v);

  return { isDark, toggle };
}
