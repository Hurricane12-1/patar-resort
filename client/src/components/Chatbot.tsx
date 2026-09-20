import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { getSocket } from '../lib/socket.ts';

export default function Chatbot() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [chips, setChips] = useState([]);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const sockRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener('app:open-chat', on);
    return () => window.removeEventListener('app:open-chat', on);
  }, []);

  useEffect(() => {
    if (!open || sockRef.current) return;
    const s = getSocket(session?.access_token);
    sockRef.current = s;
    s.on('bot:message', (m) => {
      setMsgs((x) => [...x, { from: 'bot', ...m }]);
      setChips(m.chips || []);
      setTyping(false);
    });
    s.on('bot:typing', () => setTyping(true));
  }, [open]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, typing]);

  function send(t) {
    const clean = (t ?? text).trim();
    if (!clean || !sockRef.current) return;
    setMsgs((x) => [...x, { from: 'user', text: clean }]);
    setChips([]); setText('');
    sockRef.current.emit('chat:message', { text: clean });
  }

  return (
    <>
      {open && (
        <div className="chat-panel">
          <div className="chat-head">
            <span className="live-dot" />
            <div><b>J & D Bot</b><br /><small style={{ opacity: .8 }}>Instant answers · WebSocket live</small></div>
            <button style={{ marginLeft: 'auto', color: '#fff', fontSize: '1.2rem' }}
              aria-label="Close chat" onClick={() => setOpen(false)}>×</button>
          </div>
          <div className="chat-msgs">
            {msgs.map((m, i) => <div key={i} className={`chat-msg ${m.from}`}>{m.text}</div>)}
            {typing && <div className="typing-dots"><i /><i /><i /></div>}
            <div ref={endRef} />
          </div>
          {chips.length > 0 && (
            <div className="chat-chips">
              {chips.map((c) => <button key={c} onClick={() => send(c)}>{c}</button>)}
            </div>
          )}
          <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <input value={text} placeholder="Ask about rates, availability…"
              onChange={(e) => setText(e.target.value)} />
            <button className="btn btn-sky btn-sm" type="submit">Send</button>
          </form>
        </div>
      )}
      <button className="chat-fab" aria-label="Open chat" onClick={() => setOpen((o) => !o)}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
          <path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" />
        </svg>
      </button>
    </>
  );
}
