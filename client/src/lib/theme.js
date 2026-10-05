import { useEffect, useState } from 'react';

/* Light / dark theme. Light by default; the visitor's choice is remembered on
   their device. The first paint is handled by the small script in index.html. */
const KEY = 'lata-theme';

function apply(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#161b22' : '#1E88E5');
}

const listeners = new Set();
let current = (typeof document !== 'undefined' && document.documentElement.dataset.theme) || 'light';

/** Returns [theme, toggle]. */
export function useTheme() {
  const [theme, setTheme] = useState(current);
  useEffect(() => { listeners.add(setTheme); return () => listeners.delete(setTheme); }, []);
  const toggle = () => {
    current = current === 'dark' ? 'light' : 'dark';
    apply(current);
    try { localStorage.setItem(KEY, current); } catch { /* private mode */ }
    listeners.forEach((fn) => fn(current));
  };
  return [theme, toggle];
}
