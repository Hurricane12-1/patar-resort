import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { getSocket } from '../lib/socket.ts';
import { animateTypewriterPrompt } from '../lib/wordPrompt.ts';
import { api } from '../lib/api.ts';
import {
  evaluateClientGuardrails,
  RESORT_CONTACT_INFO,
} from '../lib/aiGuardrails.ts';

const DEFAULT_WELCOME = {
  id: 'welcome-0',
  from: 'bot',
  text: "Mabuhay! I'm Rock View Bot 🌊 How can I help you plan your stay, recommend rooms for your family or group, or answer questions about Rock View Beach Resort?",
  is_ai: true,
};

const DEFAULT_CHIPS = [
  '🏡 Room Rates & Cottages',
  '⏰ Check-in & Check-out Times',
  '🏊 Resort Amenities & Pool',
  '💳 30% Downpayment Info',
  '📍 Cape Bolinao Lighthouse',
  '👨‍👩‍👧‍👦 Recommend a room for a family',
];

export default function Chatbot() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const accountId = session?.user?.id || 'guest';
  const storageKey = `jd_chat_msgs_${accountId}`;

  const [msgs, setMsgs] = useState<any[]>(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('jd_chat_msgs_guest');
      }
      if (session?.user?.id && typeof sessionStorage !== 'undefined') {
        const cached = sessionStorage.getItem(`jd_chat_msgs_${session.user.id}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch {}
    return [DEFAULT_WELCOME];
  });
  const [chips, setChips] = useState<string[]>(DEFAULT_CHIPS);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const [isTypingPrompt, setIsTypingPrompt] = useState(false);
  const [reloadingChat, setReloadingChat] = useState(false);
  const [assignedAgent, setAssignedAgent] = useState<{ id: string; name: string; role: string; phone?: string } | null>(null);
  const [isDirectedToAgent, setIsDirectedToAgent] = useState(false);
  const sockRef = useRef<any>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelTypewriterRef = useRef<(() => void) | null>(null);

  // Mandated Account Chat Reload: Hydrate from sessionStorage and sync with Supabase
  const reloadAccountChat = async () => {
    setReloadingChat(true);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(storageKey);
        localStorage.removeItem('jd_chat_msgs_guest');
      }
      // 1. Immediately hydrate from sessionStorage for authenticated accounts
      if (session?.user?.id && typeof sessionStorage !== 'undefined') {
        const cached = sessionStorage.getItem(storageKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMsgs(parsed);
            const agentMsg = parsed.slice().reverse().find((m: any) => m.is_agent || m.directed_to_agent);
            if (agentMsg && agentMsg.agent_name) {
              setAssignedAgent({
                id: agentMsg.agent_id || 'staff',
                name: agentMsg.agent_name,
                role: agentMsg.agent_role || 'Front Desk Receptionist',
              });
              setIsDirectedToAgent(true);
            }
          }
        }
      }

      // 2. Fetch server-persisted messages for authenticated account
      if (session?.user?.id) {
        const serverMsgs = await api.myChatMessages();
        if (Array.isArray(serverMsgs) && serverMsgs.length > 0) {
          setMsgs(serverMsgs);
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(storageKey, JSON.stringify(serverMsgs));
          }
          const agentMsg = serverMsgs.slice().reverse().find((m: any) => m.is_agent || m.directed_to_agent);
          if (agentMsg && agentMsg.agent_name) {
            setAssignedAgent({
              id: agentMsg.agent_id || 'staff',
              name: agentMsg.agent_name,
              role: agentMsg.agent_role || 'Front Desk Receptionist',
            });
            setIsDirectedToAgent(true);
          }
        }
      }
    } catch (err) {
      console.warn('[Chat Reload Warning]', err);
    } finally {
      setReloadingChat(false);
    }
  };

  useEffect(() => {
    reloadAccountChat();
  }, [accountId, session?.user?.id, storageKey]);

  // Mandated Account Chat Saving: Persist active authenticated conversation turns to sessionStorage
  useEffect(() => {
    if (session?.user?.id && msgs && msgs.length > 1) {
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(storageKey, JSON.stringify(msgs));
        }
      } catch {}
    }
  }, [msgs, storageKey, session?.user?.id]);

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

  // Submit thumbs up or thumbs down feedback
  const handleFeedback = async (idx: number, feedback: 'thumbs_up' | 'thumbs_down') => {
    const targetMsg = msgs[idx];
    const msgId = targetMsg?.id;

    try {
      await api.submitChatFeedback({
        messageId: msgId,
        feedback,
      });
    } catch (e) {
      console.warn('[Feedback Error]', e);
    }

    if (sockRef.current) {
      sockRef.current.emit('chat:feedback', {
        messageId: msgId,
        feedback,
      });
    }

    setMsgs((prev) =>
      prev.map((m, i) => {
        if (i !== idx) return m;
        return {
          ...m,
          feedback,
          feedbackStage: feedback === 'thumbs_up' ? 'recorded_up' : 'ask_clarification',
        };
      })
    );
  };

  // Handle distinction: Did it help you? vs Did it resolve the problem?
  const handleClarification = async (idx: number, type: 'help' | 'problem') => {
    const targetMsg = msgs[idx];
    const msgId = targetMsg?.id;

    try {
      await api.submitChatFeedback({
        messageId: msgId,
        feedback: 'thumbs_down',
        reason: type === 'help' ? 'inquiry_help' : 'problem_resolution',
      });
    } catch (e) {
      console.warn('[Clarification Error]', e);
    }

    if (sockRef.current) {
      sockRef.current.emit('chat:feedback', {
        messageId: msgId,
        feedback: 'thumbs_down',
        reason: type === 'help' ? 'inquiry_help' : 'problem_resolution',
      });
    }

    setMsgs((prev) =>
      prev.map((m, i) => {
        if (i !== idx) return m;
        return {
          ...m,
          clarificationType: type,
          feedbackStage: type === 'help' ? 'check_help' : 'check_problem',
        };
      })
    );
  };

  // Follow-up answer for "Did it help you?"
  const handleHelpAnswer = async (idx: number, didHelp: boolean) => {
    const targetMsg = msgs[idx];
    const msgId = targetMsg?.id;

    try {
      await api.submitChatFeedback({
        messageId: msgId,
        feedback: didHelp ? 'thumbs_up' : 'thumbs_down',
        reason: 'inquiry_help',
        details: didHelp ? 'Guest confirmed it helped' : 'Did not help guest inquiry',
      });
    } catch {}

    setMsgs((prev) =>
      prev.map((m, i) => {
        if (i !== idx) return m;
        return {
          ...m,
          feedbackStage: didHelp ? 'help_success' : 'show_resolutions',
        };
      })
    );
  };

  // Follow-up answer for "Did it resolve the problem?"
  const handleProblemAnswer = async (idx: number, didResolve: boolean) => {
    const targetMsg = msgs[idx];
    const msgId = targetMsg?.id;

    try {
      await api.submitChatFeedback({
        messageId: msgId,
        feedback: didResolve ? 'thumbs_up' : 'thumbs_down',
        reason: 'problem_resolution',
        details: didResolve ? 'Problem resolved' : 'Problem unresolved',
      });
    } catch {}

    setMsgs((prev) =>
      prev.map((m, i) => {
        if (i !== idx) return m;
        return {
          ...m,
          feedbackStage: didResolve ? 'problem_success' : 'show_resolutions',
        };
      })
    );
  };

  // Contact Service Agent quick action
  const handleContactAgent = async () => {
    try {
      const res: any = await api.requestStaffAssistance({
        message: 'Guest requested live service agent after chatbot answer',
      });
      if (res?.agent) {
        setAssignedAgent(res.agent);
        setIsDirectedToAgent(true);
      }
    } catch (e) {
      console.warn('[Staff Request Error]', e);
    }

    if (sockRef.current) {
      sockRef.current.emit('chat:request_staff', {
        message: 'Guest requested live service agent after chatbot answer',
      });
    }
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
      setMsgs((x) => {
        if (x.length === 1 && x[0].text === m.text) {
          return x;
        }
        return [
          ...x,
          {
            from: 'bot',
            id: m.id || `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ...m,
          },
        ];
      });
      if (m.chips && m.chips.length > 0) {
        setChips(m.chips);
      }
      if (m.directed_to_agent || m.is_agent) {
        setIsDirectedToAgent(true);
        if (m.agent_name) {
          setAssignedAgent({
            id: m.agent_id || 'staff',
            name: m.agent_name,
            role: m.agent_role || 'Front Desk Receptionist',
          });
        }
      }
      setTyping(false);
    };

    const handleTyping = () => setTyping(true);

    const handleAgentAssigned = (data: any) => {
      if (data?.agent) {
        setAssignedAgent(data.agent);
        setIsDirectedToAgent(true);
      }
    };

    const handleGuestAck = () => {
      setTyping(false);
    };

    s.on('bot:message', handleMessage);
    s.on('bot:typing', handleTyping);
    s.on('agent:assigned', handleAgentAssigned);
    s.on('agent:guest_ack', handleGuestAck);

    return () => {
      s.off('bot:message', handleMessage);
      s.off('bot:typing', handleTyping);
      s.off('agent:assigned', handleAgentAssigned);
      s.off('agent:guest_ack', handleGuestAck);
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

    setMsgs((x) => [...x, { from: 'user', text: clean }]);
    setChips([]);
    setText('');
    setTyping(true);

    const s = sockRef.current || getSocket(session?.access_token);
    if (s) {
      s.emit('chat:message', { text: clean });
    }
  }

  return (
    <>
      {open && (
        <div className="chat-panel">
          {/* Header */}
          <div className="chat-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(56,189,248,0.25), rgba(14,165,233,0.4))',
                  border: '1.5px solid rgba(56,189,248,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                }}
              >
                <i className="fas fa-umbrella-beach" style={{ color: '#38BDF8', fontSize: '1.05rem' }} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <b style={{ fontSize: '0.94rem', color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                    Rock View Bot
                  </b>
                  <span
                    style={{
                      fontSize: '0.6rem',
                      background: 'linear-gradient(135deg, #38BDF8, #818CF8)',
                      color: '#0F172A',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: 999,
                      letterSpacing: '0.04em',
                    }}
                  >
                    Resort AI
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
                  <span className="live-dot" style={{ width: 6, height: 6, margin: 0 }} />
                  <small style={{ color: '#BAE6FD', fontSize: '0.72rem', fontWeight: 600 }}>
                    Online · 24/7 Hotel Concierge
                  </small>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255,255,255,0.7)',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  fontSize: '0.76rem',
                }}
                title="Start a fresh conversation"
                aria-label="Restart chat"
                onClick={() => {
                  setMsgs([DEFAULT_WELCOME]);
                  setChips(DEFAULT_CHIPS);
                }}
              >
                <i className="fas fa-rotate" />
              </button>
              <button
                type="button"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255,255,255,0.85)',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  fontSize: '0.85rem',
                }}
                aria-label="Close chat"
                onClick={() => setOpen(false)}
              >
                <i className="fas fa-xmark" />
              </button>
            </div>
          </div>

          {/* Active Directed Service Agent Status Banner */}
          {isDirectedToAgent && assignedAgent && (
            <div
              style={{
                padding: '8px 14px',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(6, 95, 70, 0.32))',
                borderBottom: '1px solid rgba(16, 185, 129, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                <span className="live-dot" style={{ width: 8, height: 8, background: '#10B981', boxShadow: '0 0 10px #10B981', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#34D399', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <><i className="fas fa-circle" style={{ color: '#10B981', fontSize: '.6rem', marginRight: 4 }} />Directed to: {assignedAgent.name}</>
                  </div>
                  <div style={{ fontSize: '0.64rem', color: '#A7F3D0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {assignedAgent.role || 'Front Desk & Guest Concierge'} · Logged in database
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsDirectedToAgent(false);
                  setAssignedAgent(null);
                  send('back to ai');
                }}
                style={{
                  fontSize: '0.66rem',
                  color: '#BAE6FD',
                  background: 'rgba(255, 255, 255, 0.12)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  borderRadius: 6,
                  padding: '3px 8px',
                  cursor: 'pointer',
                  flexShrink: 0,
                  fontWeight: 600,
                }}
                title="Switch back to Rock View Bot AI Concierge"
              >
                Back to AI
              </button>
            </div>
          )}

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
                      padding: '3px 9px',
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      borderRadius: 8,
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      color: '#F87171',
                    }}
                  >
                    <span>
                      <i className="fas fa-shield-halved" style={{ marginRight: 6 }} />
                      AI SECURITY GUARDRAIL ENFORCED
                    </span>
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
                    <span><i className="fas fa-triangle-exclamation" style={{ marginRight: 6 }} />GUEST CONCERN PRIORITY NOTIFICATION</span>
                  </div>
                )}

                {/* Service Agent Badge */}
                {m.from === 'bot' && (m.is_agent || m.sender === 'service_agent') && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      marginBottom: 6,
                      padding: '2px 8px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      borderRadius: 6,
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      color: '#34D399',
                    }}
                  >
                    <span><i className="fas fa-user-tie" style={{ marginRight: 6 }} />{m.agent_name || m.senderName || 'Front Desk Concierge'} · SERVICE AGENT</span>
                  </div>
                )}

                {/* Gemini AI Badge */}
                {m.from === 'bot' && m.is_ai && !m.guardrail && !m.is_agent && m.sender !== 'service_agent' && (
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
                        <><i className="fas fa-phone" style={{ marginRight: 6 }} />FRONT DESK 24/7 HOTLINE</>
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
                      <><i className="fas fa-location-dot" style={{ marginRight: 6 }} />{RESORT_CONTACT_INFO.receptionDesk}</>
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
                        <><i className="fas fa-phone" style={{ marginRight: 6 }} />Call Front Desk</>
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
                        <><i className="fas fa-clipboard" style={{ marginRight: 6 }} />Copy Hotline</>
                      </button>
                    </div>
                  </div>
                )}

                {/* Interactive Feedback & Resolution Flow */}
                {m.from === 'bot' && !m.guardrail && (
                  <div className="chat-feedback-wrap">
                    {/* Stage 0: Initial Thumbs Up / Down Prompt */}
                    {!m.feedback && (
                      <div className="chat-feedback-bar">
                        <span className="chat-feedback-label">Was this helpful?</span>
                        <button
                          type="button"
                          onClick={() => handleFeedback(i, 'thumbs_up')}
                          className="feedback-btn up"
                          title="Thumbs up - Helpful"
                        >
                          <i className="fas fa-thumbs-up" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFeedback(i, 'thumbs_down')}
                          className="feedback-btn down"
                          title="Thumbs down - Needs improvement"
                        >
                          <i className="fas fa-thumbs-down" />
                        </button>
                      </div>
                    )}

                    {/* Stage 1: Thumbs Up Quiet Recorded State */}
                    {m.feedbackStage === 'recorded_up' && (
                      <div className="chat-feedback-recorded">
                        <span><i className="fas fa-check" style={{ marginRight: 4 }} />Thank you for your feedback! <i className="fas fa-thumbs-up" style={{ marginLeft: 4 }} /></span>
                      </div>
                    )}

                    {/* Stage 2: Thumbs Down Clarification: Did it help you? vs Did it resolve the problem? */}
                    {m.feedbackStage === 'ask_clarification' && (
                      <div className="chat-feedback-clarification">
                        <span className="clarify-title">We want to help. Which describes your need?</span>
                        <div className="clarify-btn-group">
                          <button
                            type="button"
                            onClick={() => handleClarification(i, 'help')}
                            className="clarify-btn help"
                          >
                            <span><i className="fas fa-circle-question" style={{ marginRight: 4 }} />Did it help you?</span>
                            <small>General inquiries, resort rates, or directions</small>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleClarification(i, 'problem')}
                            className="clarify-btn problem"
                          >
                            <span><i className="fas fa-triangle-exclamation" style={{ marginRight: 4 }} />Did it resolve the problem?</span>
                            <small>Booking issues, cancellations, refunds, or stay concerns</small>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Stage 3A: Checking "Did it help you?" */}
                    {m.feedbackStage === 'check_help' && (
                      <div className="chat-feedback-followup">
                        <span className="clarify-sub">Did this answer provide the help you were looking for?</span>
                        <div className="clarify-btn-row">
                          <button
                            type="button"
                            onClick={() => handleHelpAnswer(i, true)}
                            className="chip-ans yes"
                          >
                            <><i className="fas fa-check" style={{ marginRight: 4 }} />Yes, it helped</>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleHelpAnswer(i, false)}
                            className="chip-ans no"
                          >
                            <><i className="fas fa-xmark" style={{ marginRight: 4 }} />No, didn't help</>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Stage 3B: Checking "Did it resolve the problem?" */}
                    {m.feedbackStage === 'check_problem' && (
                      <div className="chat-feedback-followup">
                        <span className="clarify-sub">Did this resolve the specific problem or booking concern?</span>
                        <div className="clarify-btn-row">
                          <button
                            type="button"
                            onClick={() => handleProblemAnswer(i, true)}
                            className="chip-ans yes"
                          >
                            <><i className="fas fa-check" style={{ marginRight: 4 }} />Yes, resolved</>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleProblemAnswer(i, false)}
                            className="chip-ans no"
                          >
                            <><i className="fas fa-xmark" style={{ marginRight: 4 }} />No, not resolved</>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Stage 4: Positive resolution completion notes */}
                    {m.feedbackStage === 'help_success' && (
                      <div className="chat-feedback-recorded">
                        <span><i className="fas fa-check" style={{ marginRight: 4 }} />Glad we could help you! <i className="fas fa-water" style={{ marginLeft: 4 }} /></span>
                      </div>
                    )}
                    {m.feedbackStage === 'problem_success' && (
                      <div className="chat-feedback-recorded">
                        <span><i className="fas fa-check" style={{ marginRight: 4 }} />Great! Glad your problem was resolved. <i className="fas fa-tree" style={{ marginLeft: 4 }} /></span>
                      </div>
                    )}

                    {/* Stage 5: If it did NOT help or did NOT resolve -> Structured Resolution Suggestions */}
                    {m.feedbackStage === 'show_resolutions' && (
                      <div className="chat-resolutions-panel">
                        <div className="chat-resolutions-header">
                          <span><i className="fas fa-lightbulb" style={{ marginRight: 4 }} />Here are direct options to resolve your request:</span>
                        </div>
                        <div className="chat-resolutions-grid">
                          <button
                            type="button"
                            onClick={handleContactAgent}
                            className="resolution-chip-btn agent"
                          >
                            <i className="fas fa-user-tie" style={{ marginRight: 6 }} />
                            <div>
                              <b>Contact Service Agent</b>
                              <small style={{ display: 'block', fontSize: '0.62rem', opacity: 0.85 }}>Priority front desk live assistance</small>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => typePrompt('How to get here directions', true)}
                            className="resolution-chip-btn"
                          >
                            <i className="fas fa-location-dot" style={{ marginRight: 6 }} />
                            <span>How to Get Here (Directions)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => typePrompt('How to refund', true)}
                            className="resolution-chip-btn"
                          >
                            <i className="fas fa-money-bill-transfer" style={{ marginRight: 6 }} />
                            <span>How to Refund</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => typePrompt('Refund and cancellation policy', true)}
                            className="resolution-chip-btn"
                          >
                            <i className="fas fa-clipboard-list" style={{ marginRight: 6 }} />
                            <span>Refund Policy</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => typePrompt('Recommend a room for a family', true)}
                            className="resolution-chip-btn"
                          >
                            <i className="fas fa-bed" style={{ marginRight: 6 }} />
                            <span>Room Rates & Capacity</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => typePrompt('Check-in and check-out hours', true)}
                            className="resolution-chip-btn"
                          >
                            <i className="fas fa-clock" style={{ marginRight: 6 }} />
                            <span>Check-in / Check-out Times</span>
                          </button>
                        </div>
                      </div>
                    )}
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
              placeholder="Ask about rooms, rates, amenities, check-in…"
              onChange={(e) => {
                if (isTypingPrompt && cancelTypewriterRef.current) {
                  cancelTypewriterRef.current();
                  cancelTypewriterRef.current = null;
                  setIsTypingPrompt(false);
                }
                setText(e.target.value);
              }}
            />
            <button
              className="btn btn-sky btn-sm"
              type="submit"
              disabled={!text.trim()}
              style={{
                borderRadius: 9999,
                padding: '8px 16px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 700,
                cursor: text.trim() ? 'pointer' : 'not-allowed',
                opacity: text.trim() ? 1 : 0.6,
                transition: 'all 0.15s ease',
              }}
            >
              <span>Send</span>
              <i className="fas fa-paper-plane" style={{ fontSize: '0.74rem' }} />
            </button>
          </form>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        className="chat-fab"
        aria-label="Open 24/7 Resort Concierge Chat"
        onClick={() => setOpen((o) => !o)}
        title="24/7 Rock View Bot Concierge"
      >
        <i className={open ? "fas fa-xmark" : "fas fa-comments"} style={{ fontSize: '1.35rem', color: '#fff', transition: 'transform 0.2s ease' }} />
      </button>
    </>
  );
}
