import { useEffect, useState } from 'react';

/* Light / dark theme.
   Choice is 'light', 'dark' or 'system' (follow the device). The first paint is
   handled by the small script in index.html; this keeps it in sync afterwards. */
const KEY = 'lata-theme';
const media = () => window.matchMedia?.('(prefers-color-scheme: dark)');

const readChoice = () => { try { return localStorage.getItem(KEY) || 'system'; } catch { return 'system'; } };
const resolve = (choice) => (choice === 'system' ? (media()?.matches ? 'dark' : 'light') : choice);

function apply(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#161b22' : '#1E88E5');
}

const listeners = new Set();
let current = typeof document !== 'undefined' ? (document.documentElement.dataset.theme || resolve(readChoice())) : 'light';

function set(theme, choice) {
  current = theme;
  apply(theme);
  try { choice === 'system' ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, choice); } catch { /* private mode */ }
  listeners.forEach((fn) => fn(theme));
}

// Device switches between light and dark (e.g. at sunset): follow it unless the visitor picked one
media()?.addEventListener?.('change', () => { if (readChoice() === 'system') set(resolve('system'), 'system'); });

/** Returns [theme, toggle]. Toggling to the device's own mode goes back to "follow the device". */
export function useTheme() {
  const [theme, setTheme] = useState(current);
  useEffect(() => { listeners.add(setTheme); return () => listeners.delete(setTheme); }, []);
  const toggle = () => {
    const next = current === 'dark' ? 'light' : 'dark';
    set(next, next === resolve('system') ? 'system' : next);
  };
  return [theme, toggle];
}
