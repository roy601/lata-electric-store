import { Link } from 'react-router-dom';

/** Plain empty state: a heading, one line, one clear action (no big icon). */
export default function EmptyState({ title, text, action, to, onAction, secondary, style }) {
  const btn = { display: 'inline-block', padding: '11px 24px', background: '#1E88E5', color: '#fff', textDecoration: 'none', border: 'none', borderRadius: 'var(--pill)', fontWeight: 600, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' };
  return (
    <div style={{ maxWidth: 440, padding: '56px 0', ...style }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px', lineHeight: 1.2 }}>{title}</h2>
      {text && <p style={{ fontSize: 15, color: 'var(--tx-64748b, #64748B)', margin: '0 0 22px', lineHeight: 1.55 }}>{text}</p>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        {to ? <Link to={to} style={btn}>{action}</Link> : <button onClick={onAction} style={btn}>{action}</button>}
        {secondary}
      </div>
    </div>
  );
}
