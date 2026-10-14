import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { getSocket } from '../lib/socket.ts';
import { animateTypewriterPrompt } from '../lib/wordPrompt.ts';
import {
  evaluateClientGuardrails,
  RESORT_CONTACT_INFO,
} from '../lib/aiGuardrails.ts';

export default function Chatbot() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [chips, setChips] = useState<string[]>([]);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const [isTypingPrompt, setIsTypingPrompt] = useState(false);
  const sockRef = useRef<any>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelTypewriterRef = useRef<(() => void) | null>(null);

  // Smoothly types any clicked word or prompt into the input field
  const typePrompt = (promptText: string, autoSubmit = false) => {
    if (!promptText) return;
    if (cancelTypewriterRef.current) {
      cancelTypewriterRef.current();
      cancelTypewriterRef.current = null;
    }

    setOpen(true);
    setIsTypingPrompt(true);
    setText('');

    cancelTypewriterRef.current = animateTypewriterPrompt(
      promptText,
      (currentSlice) => {
        setText(currentSlice);
      },
      () => {
        setIsTypingPrompt(false);
        cancelTypewriterRef.current = null;
        inputRef.current?.focus();
        if (autoSubmit) {
          setTimeout(() => {
            send(promptText);
          }, 350);
        }
      }
    );
  };

  useEffect(() => {
    const on = (e: any) => {
      setOpen(true);
      const incomingPrompt = e?.detail?.prompt || e?.detail?.word || e?.detail?.text;
      if (incomingPrompt) {
        setTimeout(() => {
          typePrompt(incomingPrompt, e?.detail?.autoSend || false);
        }, 120);
      }
    };

    window.addEventListener('app:open-chat', on);
    return () => {
      window.removeEventListener('app:open-chat', on);
      if (cancelTypewriterRef.current) cancelTypewriterRef.current();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const s = getSocket(session?.access_token);
    sockRef.current = s;

    const handleMessage = (m: any) => {
      setMsgs((x) => [...x, { from: 'bot', ...m }]);
      setChips(m.chips || []);
      setTyping(false);
    };

    const handleTyping = () => setTyping(true);

    s.on('bot:message', handleMessage);
    s.on('bot:typing', handleTyping);

    return () => {
      s.off('bot:message', handleMessage);
      s.off('bot:typing', handleTyping);
      sockRef.current = null;
    };
  }, [open, session?.access_token]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, typing]);

  function send(t?: string) {
    if (cancelTypewriterRef.current) {
      cancelTypewriterRef.current();
      cancelTypewriterRef.current = null;
      setIsTypingPrompt(false);
    }
    const clean = (t ?? text).trim();
    if (!clean) return;

    // 1. Client-Side Anti-Hacking & Exfiltration Guardrail Check
    const guard = evaluateClientGuardrails(clean);
    if (guard.blocked) {
      setMsgs((x) => [
        ...x,
        { from: 'user', text: clean },
        {
          from: 'bot',
          text: guard.safeMessage,
          guardrail: true,
          category: guard.category,
        },
      ]);
      setChips([]);
      setText('');
      return;
    }

    if (!sockRef.current) return;
    setMsgs((x) => [...x, { from: 'user', text: clean }]);
    setChips([]);
    setText('');
    sockRef.current.emit('chat:message', { text: clean });
  }

  return (
    <>
      {open && (
        <div className="chat-panel">
          {/* Header */}
          <div className="chat-head">
            <span className="live-dot" />
            <div>
              <b style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                J & D Bot
                <span
                  style={{
                    fontSize: '0.62rem',
                    background: 'linear-gradient(135deg, #38BDF8, #818CF8)',
                    color: '#0F172A',
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: 999,
                  }}
                >
                  Resort AI
                </span>
              </b>
              <br />
              <small style={{ opacity: 0.9, color: '#BAE6FD', fontSize: '.72rem' }}>
                24/7 Concierge
              </small>
            </div>
            <button
              style={{
                marginLeft: 'auto',
                color: '#fff',
                fontSize: '1.2rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
              aria-label="Close chat"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>

          {/* Message List */}
          <div className="chat-msgs">
            {msgs.map((m, i) => (
              <div key={i} className={`chat-msg ${m.from}`}>
                {/* Security Guardrail Tag */}
                {m.guardrail && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      marginBottom: 6,
                      padding: '2px 8px',
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      borderRadius: 6,
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      color: '#F87171',
                    }}
                  >
                    <span>🛡️ AI SECURITY GUARDRAIL ENFORCED</span>
                  </div>
                )}

                {/* Guest Concern Tag */}
                {m.is_concern && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      marginBottom: 6,
                      padding: '2px 8px',
                      background: 'rgba(245, 158, 11, 0.15)',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      borderRadius: 6,
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      color: '#FBBF24',
                    }}
                  >
                    <span>⚠️ GUEST CONCERN PRIORITY NOTIFICATION</span>
                  </div>
                )}

                {/* Gemini AI Badge */}
                {m.from === 'bot' && m.is_ai && !m.guardrail && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      marginBottom: 4,
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      color: '#38BDF8',
                      letterSpacing: '0.04em',
                    }}
                  >
                    <span>✦ RESORT AI</span>
                  </div>
                )}

                {/* Message Body */}
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.text}</div>

                {/* Interactive Contact Us Card */}
                {(m.contact_card ||
                  m.is_concern ||
                  (m.from === 'bot' &&
                    typeof m.text === 'string' &&
                    m.text.includes('+63 900 555 0123'))) && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: '10px 12px',
                      background: 'rgba(15, 23, 42, 0.95)',
                      border: '1px solid rgba(56, 189, 248, 0.35)',
                      borderRadius: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                        paddingBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          color: '#38BDF8',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        📞 FRONT DESK 24/7 HOTLINE
                      </span>
                      <span style={{ fontSize: '0.65rem', color: '#10B981', fontWeight: 700 }}>
                        ● On-Site Active
                      </span>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: '#F8FAFC' }}>
                      <b>Phone:</b>{' '}
                      <a
                        href={`tel:${RESORT_CONTACT_INFO.primaryPhone}`}
                        style={{ color: '#38BDF8', textDecoration: 'underline' }}
                      >
                        {RESORT_CONTACT_INFO.primaryPhone}
                      </a>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: '#CBD5E1' }}>
                      <b>Viber / WhatsApp:</b>{' '}
                      <a
                        href={`tel:${RESORT_CONTACT_INFO.viberWhatsapp}`}
                        style={{ color: '#38BDF8' }}
                      >
                        {RESORT_CONTACT_INFO.viberWhatsapp}
                      </a>
                    </div>

                    <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                      <b>Email:</b>{' '}
                      <a
                        href={`mailto:${RESORT_CONTACT_INFO.supportEmail}`}
                        style={{ color: '#BAE6FD' }}
                      >
                        {RESORT_CONTACT_INFO.supportEmail}
                      </a>
                    </div>

                    <div style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                      📍 {RESORT_CONTACT_INFO.receptionDesk}
                    </div>

                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <a
                        href={`tel:${RESORT_CONTACT_INFO.primaryPhone}`}
                        className="btn btn-sky btn-sm"
                        style={{
                          padding: '4px 8px',
                          fontSize: '0.7rem',
                          textDecoration: 'none',
                          textAlign: 'center',
                          flex: 1,
                        }}
                      >
                        📞 Call Front Desk
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          if (navigator.clipboard) {
                            navigator.clipboard.writeText(RESORT_CONTACT_INFO.primaryPhone);
                            alert(
                              'Front Desk hotline copied to clipboard: ' +
                                RESORT_CONTACT_INFO.primaryPhone
                            );
                          }
                        }}
                        className="btn btn-outline btn-sm"
                        style={{ padding: '4px 8px', fontSize: '0.7rem', flex: 1 }}
                      >
                        📋 Copy Hotline
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {typing && (
              <div className="typing-dots">
                <i />
                <i />
                <i />
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Chips */}
          {chips.length > 0 && (
            <div className="chat-chips">
              <div
                style={{
                  width: '100%',
                  fontSize: '0.68rem',
                  color: '#94A3B8',
                  marginBottom: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span>✦ Suggested prompts:</span>
              </div>
              {chips.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => typePrompt(c)}
                  title={`Click word to type prompt: "${c}"`}
                  className="chat-chip-btn"
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {/* Typewriter status banner */}
          {isTypingPrompt && (
            <div
              style={{
                padding: '4px 14px',
                background: 'rgba(56, 189, 248, 0.1)',
                borderTop: '1px solid rgba(56, 189, 248, 0.2)',
                fontSize: '0.72rem',
                color: '#38BDF8',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span className="live-dot" style={{ width: 6, height: 6, background: '#38BDF8' }} />
              <span>Typing prompt into message composer…</span>
            </div>
          )}

          {/* Input Form */}
          <form
            className={`chat-input ${isTypingPrompt ? 'typing-pulse' : ''}`}
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              ref={inputRef}
              value={text}
              placeholder="Ask about system, booking, concerns, rates…"
              onChange={(e) => {
                if (isTypingPrompt && cancelTypewriterRef.current) {
                  cancelTypewriterRef.current();
                  cancelTypewriterRef.current = null;
                  setIsTypingPrompt(false);
                }
                setText(e.target.value);
              }}
            />
            <button className="btn btn-sky btn-sm" type="submit" disabled={!text.trim()}>
              Send
            </button>
          </form>
        </div>
      )}

      {/* Floating Action Button */}
      <button className="chat-fab" aria-label="Open chat" onClick={() => setOpen((o) => !o)}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
          <path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" />
        </svg>
      </button>
    </>
  );
}
