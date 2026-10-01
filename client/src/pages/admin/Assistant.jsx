import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Plus, Trash2, MessageSquare, AlertTriangle } from 'lucide-react';
import AdminLayout from '../../components/layout/AdminLayout';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { aiStatus, aiConversations, aiConversation, aiDeleteConversation, aiChat, errMsg } from '../../api/adminApi';
import toast from 'react-hot-toast';

const SUGGESTIONS = [
  'Give me an overview of the store today',
  'Which products are low on stock and selling fastest?',
  'Compare sales this month with last month',
  'Who are my top customers this year?',
  'Which categories bring in the most revenue?',
  'Forecast demand for the next 30 days',
];

/* ── Minimal, safe formatting: **bold**, bullet lists, paragraphs. No raw HTML. ── */
const inline = (text) =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part);

function FormattedText({ text }) {
  const blocks = [];
  let list = null;
  text.split('\n').forEach((line, i) => {
    const bullet = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)/);
    if (bullet) {
      if (!list) { list = []; blocks.push({ type: 'ul', items: list }); }
      list.push(bullet[1]);
    } else {
      list = null;
      if (line.trim()) blocks.push({ type: 'p', text: line.replace(/^#+\s*/, ''), heading: /^#+\s/.test(line), key: i });
    }
  });
  return blocks.map((b, i) => b.type === 'ul'
    ? <ul key={i} style={{ margin: '6px 0', paddingLeft: 20 }}>{b.items.map((t, j) => <li key={j} style={{ margin: '3px 0' }}>{inline(t)}</li>)}</ul>
    : <p key={i} style={{ margin: '6px 0', fontWeight: b.heading ? 700 : 400 }}>{inline(b.text)}</p>);
}

const fmtCell = (v) => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return v.toLocaleString('en-BD', { maximumFractionDigits: 2 });
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};
const label = (c) => c.replace(/_/g, ' ');

/** Backend-computed table shown under an answer — numbers straight from the server. */
function DataTable({ table }) {
  return (
    <div style={{ marginTop: 10, border: '1px solid #e8edf3', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '7px 10px', background: '#F5F8FC', fontSize: 12, fontWeight: 700, color: '#475569' }}>{table.title}</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>{table.columns.map(c => <th key={c} style={{ textAlign: 'left', padding: '6px 10px', color: '#64748b', fontWeight: 600, textTransform: 'capitalize', whiteSpace: 'nowrap', borderBottom: '1px solid #e8edf3' }}>{label(c)}</th>)}</tr>
          </thead>
          <tbody>
            {table.rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: i < table.rows.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                {r.map((v, j) => <td key={j} style={{ padding: '6px 10px', whiteSpace: 'nowrap', color: '#1f2937', fontVariantNumeric: 'tabular-nums' }}>{fmtCell(v)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Message({ m }) {
  const mine = m.role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 14 }}>
      <div style={{
        maxWidth: mine ? '80%' : '100%', minWidth: 0,
        background: mine ? '#1E88E5' : '#fff', color: mine ? '#fff' : '#1f2937',
        border: mine ? 'none' : '1px solid #e8edf3', borderRadius: 12,
        padding: '10px 14px', fontSize: 14, lineHeight: 1.55,
        whiteSpace: mine ? 'pre-wrap' : 'normal', overflowWrap: 'anywhere',
      }}>
        {mine ? m.content : <FormattedText text={m.content} />}
        {!mine && Array.isArray(m.data) && m.data.map((t, i) => <DataTable key={i} table={t} />)}
      </div>
    </div>
  );
}

export default function AdminAssistant() {
  const { isMobile } = useBreakpoint();
  const [status, setStatus]       = useState(null);
  const [convos, setConvos]       = useState([]);
  const [activeId, setActiveId]   = useState(null);
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [sending, setSending]     = useState(false);
  const [loadError, setLoadError] = useState('');
  const endRef = useRef(null);

  const refreshStatus = () => aiStatus().then(({ data }) => setStatus(data.status)).catch(err => setLoadError(errMsg(err)));
  const refreshConvos = () => aiConversations().then(({ data }) => setConvos(data.conversations || [])).catch(() => {});

  useEffect(() => { refreshStatus(); refreshConvos(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);

  const openConversation = async (id) => {
    setActiveId(id);
    try { const { data } = await aiConversation(id); setMessages(data.conversation.messages || []); }
    catch (err) { toast.error(errMsg(err)); }
  };

  const newConversation = () => { setActiveId(null); setMessages([]); setInput(''); };

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
    } finally {
      setSending(false);
      refreshStatus();
    }
  };

  const notReady = status && !status.configured;

  return (
    <AdminLayout title="AI Assistant">
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '240px 1fr', gap: 16, height: isMobile ? 'auto' : 'calc(100vh - 140px)', minHeight: 480 }}>

        {/* Conversation list */}
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,.06)', padding: 12, display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: isMobile ? 220 : 'none' }}>
          <button onClick={newConversation} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', marginBottom: 10 }}>
            <Plus size={15} /> New conversation
          </button>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {convos.length === 0 && <div style={{ fontSize: 12, color: '#9aa5b1', padding: 8 }}>No conversations yet.</div>}
            {convos.map(c => (
              <div key={c.id} onClick={() => openConversation(c.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px', borderRadius: 8, cursor: 'pointer', marginBottom: 2, background: c.id === activeId ? '#E3F2FD' : 'transparent' }}>
                <MessageSquare size={14} color="#64748b" style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                <button onClick={(e) => { e.stopPropagation(); removeConversation(c.id); }} aria-label="Delete conversation"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 2, display: 'flex' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
          {status?.configured && (
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 8, marginTop: 8, fontSize: 11, color: '#64748b', lineHeight: 1.6 }}>
              <div>This month: ${status.month_cost_usd?.toFixed(2)} of ${status.monthly_budget_usd} budget</div>
              <div>Today: {status.messages_today} of {status.daily_message_limit} questions</div>
            </div>
          )}
        </div>

        {/* Chat */}
        <div style={{ background: '#F8FAFC', borderRadius: 12, border: '1px solid #e8edf3', display: 'flex', flexDirection: 'column', minHeight: isMobile ? 460 : 0 }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {(loadError || notReady) && (
              <div style={{ display: 'flex', gap: 10, background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 10, padding: 14, fontSize: 13, color: '#6d4c00', marginBottom: 16 }}>
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <div>
                  {loadError || <>The assistant is switched off. To turn it on, add <code>ANTHROPIC_API_KEY</code> to the server's environment on Render (and optionally <code>AI_MONTHLY_BUDGET_USD</code>), then redeploy.</>}
                </div>
              </div>
            )}

            {messages.length === 0 && !notReady && (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: '#64748b' }}>
                <Sparkles size={30} color="#1E88E5" />
                <div style={{ fontSize: 17, fontWeight: 700, color: '#1f2937', margin: '10px 0 4px' }}>Ask about your store</div>
                <div style={{ fontSize: 13, marginBottom: 20 }}>Answers use your live store data. Figures are calculated by the server, not guessed. The assistant can only read data; it can't change anything.</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => send(s)} disabled={sending}
                      style={{ padding: '7px 12px', background: '#fff', border: '1px solid #dbe4ee', borderRadius: 20, fontSize: 12, color: '#334155', cursor: 'pointer' }}>{s}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(m => <Message key={m.id} m={m} />)}
            {sending && <div style={{ fontSize: 13, color: '#64748b', padding: '4px 2px' }}>Checking your store data…</div>}
            <div ref={endRef} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(); }}
            style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid #e8edf3', background: '#fff', borderRadius: '0 0 12px 12px' }}>
            <textarea value={input} onChange={e => setInput(e.target.value)} rows={1} maxLength={4000}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={notReady ? 'Assistant is switched off' : 'Ask in English or বাংলা…'} disabled={sending || notReady}
              style={{ flex: 1, resize: 'none', padding: '10px 12px', border: '1px solid #dbe4ee', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', minHeight: 42, maxHeight: 140 }} />
            <button type="submit" disabled={sending || notReady || !input.trim()} aria-label="Send"
              style={{ padding: '0 16px', background: sending || notReady || !input.trim() ? '#b0c4d8' : '#1E88E5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </AdminLayout>
  );
}
