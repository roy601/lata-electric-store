import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Send, Plus, Trash2, AlertTriangle, Copy, Check, Search, Package, X, RotateCcw, History, PenLine, MessageSquare } from 'lucide-react';
import AdminLayout from '../../components/layout/AdminLayout';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { aiStatus, aiConversations, aiConversation, aiDeleteConversation, aiChat, aiWriterQueue, aiWriterDraft, getProducts, updateProduct, errMsg } from '../../api/adminApi';
import toast from 'react-hot-toast';

const ink = 'var(--ink)';
const muted = 'var(--tx-64748b, #64748B)';
const edge = '1px solid var(--panel-edge)';
const panel = { background: 'var(--bg-fff, #fff)', border: edge, borderRadius: 'var(--r-md)' };
const BLUE = '#1E88E5';

const QUICK = [
  { group: 'Today', items: ['How are today\'s orders and sales?', 'আজকে কয়টা অর্ডার এসেছে?'] },
  { group: 'Stock', items: ['Which products are running low, and how long will they last?', 'What should I restock this week?'] },
  { group: 'Sales', items: ['Best sellers this month', 'Compare this month with last month'] },
  { group: 'Customers', items: ['Who are my repeat customers?', 'Which orders were cancelled or returned recently, and why?'] },
];

/* ── Safe text formatting: headings, **bold**, bullets, numbered lists, | tables |. No raw HTML. ── */
const inline = (text) => text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
  part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part);

function FormattedText({ text }) {
  const blocks = [];
  let list = null, table = null;
  String(text || '').split('\n').forEach((raw) => {
    const line = raw.trimEnd();
    if (/^\s*\|.*\|\s*$/.test(line)) {
      if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) return;                    // separator row
      const cells = line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      if (!table) { table = { type: 'table', head: cells, rows: [] }; blocks.push(table); } else table.rows.push(cells);
      list = null; return;
    }
    table = null;
    const bullet = line.match(/^\s*(?:[-*•]|(\d+)\.)\s+(.*)/);
    if (bullet) {
      const ordered = !!bullet[1];
      if (!list || list.ordered !== ordered) { list = { type: 'list', ordered, items: [] }; blocks.push(list); }
      list.items.push(bullet[2]); return;
    }
    list = null;
    if (line.trim()) blocks.push({ type: 'p', text: line.replace(/^#+\s*/, ''), heading: /^#+\s/.test(line) });
  });
  return blocks.map((b, i) => {
    if (b.type === 'list') { const L = b.ordered ? 'ol' : 'ul'; return <L key={i} style={{ margin: '6px 0', paddingLeft: 20 }}>{b.items.map((t, j) => <li key={j} style={{ margin: '3px 0' }}>{inline(t)}</li>)}</L>; }
    if (b.type === 'table') return (
      <div key={i} style={{ overflowX: 'auto', margin: '8px 0', border: edge, borderRadius: 'var(--r-sm)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr>{b.head.map((h, j) => <th key={j} style={{ textAlign: 'left', padding: '7px 10px', background: 'var(--bg-f8fafc, #F8FAFC)', color: muted, fontWeight: 600, whiteSpace: 'nowrap' }}>{inline(h)}</th>)}</tr></thead>
          <tbody>{b.rows.map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j} className="num" style={{ padding: '7px 10px', borderTop: edge, color: ink }}>{inline(c)}</td>)}</tr>)}</tbody>
        </table>
      </div>);
    return <p key={i} style={{ margin: b.heading ? '12px 0 4px' : '6px 0', fontWeight: b.heading ? 700 : 400 }}>{inline(b.text)}</p>;
  });
}

const fmtCell = (v) => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return v.toLocaleString('en-BD', { maximumFractionDigits: 2 });
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

/** Table computed by the server, shown under an answer (numbers straight from the data). */
function DataTable({ table }) {
  return (
    <div style={{ marginTop: 12, border: edge, borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', background: 'var(--bg-f8fafc, #F8FAFC)', fontSize: 12.5, fontWeight: 600, color: ink }}>{table.title}</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr>{table.columns.map(c => <th key={c} style={{ textAlign: 'left', padding: '7px 12px', color: muted, fontWeight: 600, whiteSpace: 'nowrap', borderTop: edge }}>{c.replace(/_/g, ' ').replace(/^./, x => x.toUpperCase())}</th>)}</tr></thead>
          <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className="num" style={{ padding: '7px 12px', whiteSpace: 'nowrap', color: ink, borderTop: edge }}>{fmtCell(v)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function Message({ m }) {
  const mine = m.role === 'user';
  const [copied, setCopied] = useState(false);
  const failed = String(m.content).startsWith('⚠');
  return (
    <div className="slide-in" style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 16 }}>
      {mine ? (
        <div style={{ maxWidth: '78%', background: 'var(--ink)', color: 'var(--bg-fff, #fff)', borderRadius: '14px 14px 4px 14px', padding: '10px 14px', fontSize: 14.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.content}</div>
      ) : (
        <div style={{ display: 'flex', gap: 10, maxWidth: '100%', minWidth: 0, width: '100%' }}>
          <span style={{ width: 30, height: 30, borderRadius: '50%', background: failed ? '#FEE2E2' : '#E3F2FD', color: failed ? '#B42318' : BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {failed ? <AlertTriangle size={15} /> : <Sparkles size={15} />}
          </span>
          <div style={{ flex: 1, minWidth: 0, fontSize: 14.5, lineHeight: 1.6, color: ink, overflowWrap: 'anywhere' }}>
            <FormattedText text={failed ? m.content.slice(1).trim() : m.content} />
            {Array.isArray(m.data) && m.data.map((t, i) => <DataTable key={i} table={t} />)}
            {!failed && (
              <button onClick={() => { navigator.clipboard?.writeText(m.content); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, padding: '3px 0', border: 'none', background: 'none', color: muted, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Thinking() {
  return (
    <div className="slide-in" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <span style={{ width: 30, height: 30, borderRadius: '50%', background: '#E3F2FD', color: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Sparkles size={15} /></span>
      <span style={{ display: 'inline-flex', gap: 4 }}>
        {[0, 1, 2].map(i => <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#94A3B8', animation: `dotPulse 1.1s ${i * .16}s infinite ease-in-out` }} />)}
      </span>
      <span style={{ fontSize: 13.5, color: muted }}>Checking your shop data…</span>
    </div>
  );
}

/* ═════════ Ask tab ═════════ */
function AskTab({ status, refreshStatus, isMobile }) {
  const [convos, setConvos] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const endRef = useRef(null);
  const boxRef = useRef(null);

  const refreshConvos = () => aiConversations().then(({ data }) => setConvos(data.conversations || [])).catch(() => {});
  useEffect(() => { refreshConvos(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, sending]);
  useEffect(() => { const t = boxRef.current; if (t) { t.style.height = 'auto'; t.style.height = Math.min(160, t.scrollHeight) + 'px'; } }, [input]);

  const openConversation = async (id) => {
    setActiveId(id); setShowHistory(false);
    try { const { data } = await aiConversation(id); setMessages(data.conversation.messages || []); }
    catch (err) { toast.error(errMsg(err)); }
  };
  const newConversation = () => { setActiveId(null); setMessages([]); setInput(''); setShowHistory(false); };
  const removeConversation = async (id) => {
    if (!window.confirm('Delete this conversation?')) return;
    try { await aiDeleteConversation(id); } catch (err) { toast.error(errMsg(err)); return; }
    setConvos(c => c.filter(x => x.id !== id));
    if (activeId === id) newConversation();
  };
  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || sending) return;
    setInput('');
    setMessages(m => [...m, { id: `tmp-${Date.now()}`, role: 'user', content: q }]);
    setSending(true);
    try {
      const { data } = await aiChat(activeId, q);
      setMessages(m => [...m, data.message]);
      if (!activeId) { setActiveId(data.conversation_id); refreshConvos(); }
    } catch (err) {
      setMessages(m => [...m, { id: `err-${Date.now()}`, role: 'assistant', content: `⚠ ${errMsg(err, 'The assistant could not answer.')}` }]);
    } finally { setSending(false); refreshStatus(); }
  };
  const notReady = status && !status.configured;

  const historyList = (
    <div style={{ overflowY: 'auto', flex: 1 }}>
      {convos.length === 0 && <div style={{ fontSize: 13, color: muted, padding: '8px 4px' }}>No conversations yet.</div>}
      {convos.map(c => (
        <div key={c.id} onClick={() => openConversation(c.id)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px', borderRadius: 'var(--r-sm)', cursor: 'pointer', marginBottom: 2, background: c.id === activeId ? 'var(--bg-f1f5f9, #F1F5F9)' : 'transparent' }}>
          <MessageSquare size={14} color="#94A3B8" style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13.5, color: ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
          <button onClick={(e) => { e.stopPropagation(); removeConversation(c.id); }} aria-label="Delete conversation"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 2, display: 'flex' }}><Trash2 size={13} /></button>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '250px minmax(0, 1fr)', gap: 14, height: isMobile ? 'calc(100dvh - 190px)' : 'calc(100vh - 190px)', minHeight: 460 }}>
      {!isMobile && (
        <aside style={{ ...panel, padding: 12, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <button onClick={newConversation} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', background: BLUE, color: '#fff', border: 'none', borderRadius: 'var(--pill)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', marginBottom: 12, fontFamily: 'inherit' }}>
            <Plus size={15} /> New conversation
          </button>
          {historyList}
          {status?.configured && (
            <div style={{ borderTop: edge, paddingTop: 10, marginTop: 10, fontSize: 12, color: muted, lineHeight: 1.6 }}>
              <div className="num">Today: {status.messages_today} of {status.daily_message_limit} questions</div>
              <div>{status.paid ? `This month: $${status.month_cost_usd?.toFixed(2)} of $${status.monthly_budget_usd}` : 'Free AI'} · via {(status.providers || []).join(' → ')}</div>
            </div>
          )}
        </aside>
      )}

      <section style={{ ...panel, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {isMobile && (
          <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderBottom: edge }}>
            <button onClick={() => setShowHistory(v => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', border: edge, borderRadius: 'var(--pill)', background: 'var(--bg-fff, #fff)', color: ink, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}><History size={14} /> History</button>
            <button onClick={newConversation} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', border: 'none', borderRadius: 'var(--pill)', background: BLUE, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><Plus size={14} /> New</button>
          </div>
        )}
        {isMobile && showHistory && <div className="slide-in" style={{ maxHeight: 220, display: 'flex', flexDirection: 'column', padding: 10, borderBottom: edge }}>{historyList}</div>}

        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px 12px' : '22px 26px' }}>
          {notReady && (
            <div style={{ display: 'flex', gap: 10, background: '#FEF3C7', borderRadius: 'var(--r-sm)', padding: 14, fontSize: 14, color: '#92400E', marginBottom: 16 }}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <div>The assistant is switched off. Add a free <code>GROQ_API_KEY</code> and/or <code>CEREBRAS_API_KEY</code> to the server's environment on Render, then redeploy.</div>
            </div>
          )}
          {messages.length === 0 && !notReady && (
            <div className="slide-in" style={{ maxWidth: 680, margin: isMobile ? '6px auto' : '24px auto' }}>
              <h2 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: ink, margin: '0 0 6px' }}>Ask about your shop</h2>
              <p style={{ fontSize: 14.5, color: muted, margin: '0 0 22px', lineHeight: 1.6 }}>Answers come from your live orders, products and stock. Figures are calculated by the server, never guessed. Ask in English or বাংলা. The assistant can only read data.</p>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
                {QUICK.map(g => (
                  <div key={g.group}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: muted, marginBottom: 6 }}>{g.group}</div>
                    {g.items.map(q => (
                      <button key={q} onClick={() => send(q)} disabled={sending}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: 6, border: edge, borderRadius: 'var(--r-sm)', background: 'var(--bg-fff, #fff)', color: ink, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color .15s, background .15s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = BLUE; e.currentTarget.style.background = 'var(--bg-f8fafc, #F8FAFC)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--panel-edge)'; e.currentTarget.style.background = 'var(--bg-fff, #fff)'; }}>
                        {q}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ maxWidth: 820, margin: '0 auto' }}>
            {messages.map(m => <Message key={m.id} m={m} />)}
            {sending && <Thinking />}
            <div ref={endRef} />
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); send(); }} style={{ padding: isMobile ? 10 : '12px 20px 16px', borderTop: edge }}>
          <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', alignItems: 'flex-end', gap: 8, border: '1px solid rgba(15,23,42,.16)', borderRadius: 14, padding: '6px 6px 6px 14px', background: 'var(--bg-fff, #fff)' }}>
            <textarea ref={boxRef} value={input} onChange={e => setInput(e.target.value)} rows={1} maxLength={4000}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={notReady ? 'Assistant is switched off' : 'Ask in English or বাংলা…'} disabled={sending || notReady}
              style={{ flex: 1, resize: 'none', border: 'none', outline: 'none', fontSize: 15, fontFamily: 'inherit', padding: '8px 0', background: 'transparent', color: ink, maxHeight: 160 }} />
            <button type="submit" disabled={sending || notReady || !input.trim()} aria-label="Send"
              style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: sending || notReady || !input.trim() ? '#CBD5E1' : BLUE, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .2s' }}>
              <Send size={16} />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

/* ═════════ Product writer tab ═════════ */
function WriterTab({ status, refreshStatus, isMobile }) {
  const [queue, setQueue] = useState(null);
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [working, setWorking] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    aiWriterQueue().then(r => setQueue(r.data.products || [])).catch(() => setQueue([]));
    getProducts().then(r => setProducts(r.data.products || [])).catch(() => {});
  }, []);

  const byId = useMemo(() => Object.fromEntries(products.map(p => [p.id, p])), [products]);
  const list = q.trim()
    ? products.filter(p => p.name?.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 30).map(p => ({ id: p.id, name: p.name, image: p.image, issues: [] }))
    : (queue || []);
  const current = selected ? byId[selected] : null;

  const write = async (id) => {
    setSelected(id); setDraft(null); setWorking(true);
    try { const { data } = await aiWriterDraft(id); setDraft(data.draft); }
    catch (err) { toast.error(errMsg(err, 'The AI writer failed')); }
    setWorking(false); refreshStatus();
  };
  const save = async () => {
    if (!draft || !current) return;
    setSaving(true);
    try {
      const specs = draft.specifications.filter(s => s.key.trim() && s.value.trim());
      await updateProduct(current.id, { description: draft.description.trim(), specifications: specs });
      setProducts(ps => ps.map(p => p.id === current.id ? { ...p, description: draft.description.trim(), specifications: specs } : p));
      setQueue(qs => (qs || []).filter(x => x.id !== current.id));
      toast.success('Saved to the product');
      setDraft(null);
    } catch (err) { toast.error(errMsg(err, 'Could not save')); }
    setSaving(false);
  };
  const setSpec = (i, k, v) => setDraft(d => ({ ...d, specifications: d.specifications.map((s, j) => j === i ? { ...s, [k]: v } : s) }));
  const field = { width: '100%', boxSizing: 'border-box', border: '1px solid rgba(15,23,42,.16)', borderRadius: 'var(--r-sm)', padding: '8px 10px', fontSize: 14, fontFamily: 'inherit', color: ink, background: 'var(--bg-fff, #fff)' };
  const notReady = status && !status.configured;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '300px minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
      <aside style={{ ...panel, padding: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid rgba(15,23,42,.14)', borderRadius: 'var(--pill)', padding: '7px 12px', marginBottom: 10 }}>
          <Search size={15} color="#94A3B8" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find any product" style={{ border: 'none', outline: 'none', flex: 1, fontSize: 14, fontFamily: 'inherit', background: 'transparent', color: ink, minWidth: 0 }} />
          {q && <button onClick={() => setQ('')} aria-label="Clear" style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: muted, display: 'flex' }}><X size={14} /></button>}
        </label>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: muted, margin: '4px 2px 6px' }}>{q ? 'Search results' : `Needs better copy${queue ? ` · ${queue.length}` : ''}`}</div>
        <div style={{ maxHeight: isMobile ? 260 : 'calc(100vh - 290px)', overflowY: 'auto' }}>
          {queue === null && !q ? [0, 1, 2, 3].map(i => <div key={i} className="skel" style={{ height: 44, marginBottom: 8 }} />)
            : list.length === 0 ? <div style={{ fontSize: 13.5, color: muted, padding: 6 }}>{q ? 'No products match.' : 'Every product has a clear description. 🎉'}</div>
            : list.map(p => (
              <button key={p.id} onClick={() => { setSelected(p.id); setDraft(null); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: 8, marginBottom: 4, border: 'none', borderRadius: 'var(--r-sm)', background: selected === p.id ? 'var(--bg-f1f5f9, #F1F5F9)' : 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
                <span style={{ width: 36, height: 36, flexShrink: 0, border: edge, borderRadius: 'var(--r-sm)', background: '#fff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {p.image ? <img src={p.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Package size={14} color="#94A3B8" />}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, color: ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                  {p.issues?.length > 0 && <span style={{ display: 'block', fontSize: 12, color: '#B45309' }}>{p.issues.join(' · ')}</span>}
                </span>
              </button>
            ))}
        </div>
      </aside>

      <section style={{ ...panel, padding: isMobile ? 14 : 22, minHeight: 360 }}>
        {!current ? (
          <div style={{ maxWidth: 520, padding: '30px 0' }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: ink, margin: '0 0 6px' }}>Product writer</h2>
            <p style={{ fontSize: 14.5, color: muted, lineHeight: 1.6, margin: 0 }}>
              Pick a product. The AI rewrites its description into a short summary and clear feature lines, and pulls specifications into a table — using only facts already in the product. You check and edit the draft; nothing is saved until you press <b>Save to product</b>.
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: ink }}>{current.name}</div>
                <div style={{ fontSize: 13, color: muted }}>{[current.brand, current.sku].filter(Boolean).join(' · ') || ' '}</div>
              </div>
              <button onClick={() => write(current.id)} disabled={working || notReady}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', border: 'none', borderRadius: 'var(--pill)', background: BLUE, color: '#fff', fontWeight: 600, fontSize: 14, cursor: working ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: notReady ? .5 : 1 }}>
                {draft ? <><RotateCcw size={15} /> Write again</> : <><Sparkles size={15} /> {working ? 'Writing…' : 'Write with AI'}</>}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: muted, marginBottom: 6 }}>Now on the website</div>
                <div style={{ border: edge, borderRadius: 'var(--r-sm)', padding: 12, fontSize: 13.5, color: ink, lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 420, overflowY: 'auto', background: 'var(--bg-f8fafc, #F8FAFC)' }}>
                  {current.description || <span style={{ color: muted }}>No description.</span>}
                  {(current.specifications || []).length > 0 && <div style={{ marginTop: 10, color: muted }}>{current.specifications.map(s => `${s.key}: ${s.value}`).join('\n')}</div>}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: muted, marginBottom: 6 }}>AI draft — edit before saving</div>
                {working ? (
                  <div style={{ border: edge, borderRadius: 'var(--r-sm)', padding: 12 }}>{[90, 70, 80, 60, 75].map((w, i) => <div key={i} className="skel" style={{ height: 13, width: `${w}%`, marginBottom: 10 }} />)}</div>
                ) : !draft ? (
                  <div style={{ border: '1px dashed rgba(15,23,42,.2)', borderRadius: 'var(--r-sm)', padding: 20, fontSize: 14, color: muted, textAlign: 'center' }}>Press <b>Write with AI</b> to create a draft.</div>
                ) : (
                  <div className="slide-in">
                    <label style={{ fontSize: 12.5, color: muted }}>Description (first line = summary, then one feature per line)</label>
                    <textarea value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} rows={8} style={{ ...field, resize: 'vertical', lineHeight: 1.55, marginTop: 4 }} />
                    <div style={{ fontSize: 12.5, color: muted, margin: '12px 0 4px' }}>Specifications</div>
                    {draft.specifications.map((s, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '40% 1fr auto', gap: 6, marginBottom: 6 }}>
                        <input value={s.key} onChange={e => setSpec(i, 'key', e.target.value)} placeholder="Label" style={field} />
                        <input value={s.value} onChange={e => setSpec(i, 'value', e.target.value)} placeholder="Value" style={field} />
                        <button onClick={() => setDraft(d => ({ ...d, specifications: d.specifications.filter((_, j) => j !== i) }))} aria-label="Remove row" style={{ border: 'none', background: 'none', color: muted, cursor: 'pointer', padding: 4 }}><X size={15} /></button>
                      </div>
                    ))}
                    <button onClick={() => setDraft(d => ({ ...d, specifications: [...d.specifications, { key: '', value: '' }] }))} style={{ border: 'none', background: 'none', color: BLUE, fontWeight: 600, fontSize: 13.5, cursor: 'pointer', padding: '2px 0', fontFamily: 'inherit' }}>+ Add a row</button>
                    {draft.missing?.length > 0 && (
                      <div style={{ marginTop: 12, background: '#FEF3C7', color: '#92400E', borderRadius: 'var(--r-sm)', padding: '10px 12px', fontSize: 13.5 }}>
                        <b>Worth adding (not in your data):</b> {draft.missing.join(', ')}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                      <button onClick={save} disabled={saving} style={{ flex: 1, padding: '11px', border: 'none', borderRadius: 'var(--pill)', background: '#15803D', color: '#fff', fontWeight: 600, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }}>{saving ? 'Saving…' : 'Save to product'}</button>
                      <button onClick={() => setDraft(null)} style={{ padding: '11px 18px', border: '1px solid rgba(15,23,42,.18)', borderRadius: 'var(--pill)', background: 'transparent', color: ink, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }}>Discard</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default function AdminAssistant() {
  const { isMobile } = useBreakpoint();
  const [tab, setTab] = useState('ask');
  const [status, setStatus] = useState(null);
  const refreshStatus = () => aiStatus().then(({ data }) => setStatus(data.status)).catch(() => {});
  useEffect(() => { refreshStatus(); }, []);

  return (
    <AdminLayout title="AI Assistant">
      <style>{`@keyframes dotPulse { 0%, 80%, 100% { opacity: .3; transform: scale(.8) } 40% { opacity: 1; transform: scale(1) } }`}</style>
      <div style={{ display: 'flex', borderBottom: edge, marginBottom: 14 }}>
        <button className="u-tab" aria-selected={tab === 'ask'} onClick={() => setTab('ask')}><Sparkles size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Ask</button>
        <button className="u-tab" aria-selected={tab === 'writer'} onClick={() => setTab('writer')}><PenLine size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Product writer</button>
      </div>
      {tab === 'ask'
        ? <AskTab status={status} refreshStatus={refreshStatus} isMobile={isMobile} />
        : <WriterTab status={status} refreshStatus={refreshStatus} isMobile={isMobile} />}
    </AdminLayout>
  );
}
