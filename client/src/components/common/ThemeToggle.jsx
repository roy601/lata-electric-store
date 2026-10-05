import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../lib/theme';

/** Sun / moon button that switches between light and dark mode. */
export default function ThemeToggle({ size = 20, color = 'var(--tx-666, #666)', label = false, style }) {
  const [theme, toggle] = useTheme();
  const dark = theme === 'dark';
  const text = dark ? 'Light mode' : 'Dark mode';
  return (
    <button type="button" onClick={toggle} title={text} aria-label={text}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', color, fontSize: 12, fontFamily: 'inherit', padding: '4px 8px', ...style }}>
      {dark ? <Sun size={size} /> : <Moon size={size} />}
      {label && (dark ? 'Light' : 'Dark')}
    </button>
  );
}
