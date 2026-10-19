import { useState, useEffect, useRef } from 'react';
import { toast } from './Toasts.tsx';
import { DefaultUserAvatar } from './AdminIcons.tsx';
import { getThemePalette, getModalStyles } from '../styles/modules/index.ts';
import { animateTypewriterPrompt } from '../lib/wordPrompt.ts';
import { useAuth } from '../context/AuthContext.tsx';

export function ExecutiveGuestChatModal({ guest, onClose, isLightMode }) {
  if (!guest) return null;

  const { profile, adminProfile } = useAuth();
  const currentProfile = adminProfile || profile;
  const adminDisplayName = currentProfile?.full_name ? `${currentProfile.full_name} (Executive Staff)` : 'Resort Staff';

  const [messages, setMessages] = useState(guest.messages || guest.initialMessages || []);
  const [inputText, setInputText] = useState('');
  const [isResolved, setIsResolved] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (guest) {
      setMessages(guest.messages || guest.initialMessages || []);
      setIsResolved(false);
    }
  }, [guest]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (textToSend) => {
    const content = textToSend || inputText;
    if (!content.trim()) return;

    const newMsg = {
      id: Date.now(),
      sender: 'admin',
      senderName: adminDisplayName,
      text: content,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newMsg]);
    if (!textToSend) setInputText('');
    toast('💬 Reply transmitted to guest chat channel');
  };

  const handleCannedReply = (quickText) => {
    // Type prompt smoothly into the input field so admin can review, customize, or send
    animateTypewriterPrompt(quickText, (slice) => setInputText(slice), () => {
      toast(`✍️ Prompt typed into composer: "${quickText.slice(0, 30)}…"`);
    });
  };

  const handleResolve = () => {
    setIsResolved(true);
    const ticketRef = guest.id ? `#${guest.id.slice(0, 6)}` : 'Inquiry';
    toast(`✔️ ${ticketRef} marked as resolved!`);
  };

  const t = getThemePalette(isLightMode);
  const ms = getModalStyles(t);
  const { themeBg, themeCardBg, themeText, themeMuted, themeBorder } = t;

  return (
    <div style={ms.backdrop} onClick={onClose}>
      <div style={ms.dialog(680)} onClick={(e) => e.stopPropagation()}>
        {/* CHAT MODAL HEADER */}
        <div style={ms.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <DefaultUserAvatar size={42} bg={isLightMode ? '#CBD5E1' : 'rgba(255, 255, 255, 0.18)'} iconColor={isLightMode ? '#475569' : '#FFFFFF'} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {guest.name}
                </h3>
                <span
                  style={{
                    fontSize: '.68rem',
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: isResolved ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                    color: isResolved ? '#10B981' : '#6366F1',
                    fontWeight: 700,
                  }}
                >
                  {isResolved ? 'RESOLVED ✓' : 'ACTIVE TICKET'}
                </span>
              </div>
              <span style={{ fontSize: '.76rem', color: themeMuted }}>
                Channel: <b>{guest.channel || 'Messenger'}</b> · {guest.resort || 'Rock View Beach Resort'}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.4rem',
              color: themeMuted,
              cursor: 'pointer',
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* CHAT MESSAGES BODY */}
        <div
          style={{
            padding: 20,
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            background: themeCardBg,
          }}
        >
          {messages.map((m) => {
            const isAdmin = m.sender === 'admin';
            const isBot = m.sender === 'bot';

            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isAdmin ? 'flex-end' : 'flex-start',
                }}
              >
                <span style={{ fontSize: '.68rem', color: themeMuted, marginBottom: 3, fontWeight: 600 }}>
                  {m.senderName} · {m.time}
                </span>
                <div
                  style={{
                    maxWidth: '80%',
                    padding: '12px 16px',
                    borderRadius: isAdmin ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                    background: isAdmin
                      ? 'linear-gradient(135deg, #4338CA, #6366F1)'
                      : isBot
                      ? (isLightMode ? '#E2E8F0' : 'rgba(255, 255, 255, 0.1)')
                      : (isLightMode ? '#FFFFFF' : '#334155'),
                    color: isAdmin ? '#FFFFFF' : themeText,
                    fontSize: '.9rem',
                    lineHeight: 1.4,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    border: `1px solid ${isAdmin ? 'transparent' : themeBorder}`,
                  }}
                >
                  {m.text}
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* QUICK CANNED ACTIONS */}
        <div style={{ padding: '10px 16px', background: themeBg, borderTop: `1px solid ${themeBorder}`, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => handleCannedReply('✅ Early check-in is approved! Your Deluxe Villa is ready.')}
            className="btn btn-sm"
            style={{ fontSize: '.74rem', padding: '5px 10px', background: 'rgba(16, 185, 129, 0.12)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 12 }}
          >
            ✅ Approve Early Check-In
          </button>
          <button
            onClick={() => handleCannedReply('🍽️ Beachfront candlelight dinner for 2 confirmed at 7:00 PM.')}
            className="btn btn-sm"
            style={{ fontSize: '.74rem', padding: '5px 10px', background: 'rgba(99, 102, 241, 0.12)', color: '#6366F1', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: 12 }}
          >
            🍽️ Confirm Dining
          </button>
          <button
            onClick={() => handleCannedReply('🚐 Private executive van pickup details have been dispatched to your SMS.')}
            className="btn btn-sm"
            style={{ fontSize: '.74rem', padding: '5px 10px', background: 'rgba(56, 189, 248, 0.12)', color: '#0EA5E9', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: 12 }}
          >
            🚐 Send Van Details
          </button>
          {!isResolved && (
            <button
              onClick={handleResolve}
              className="btn btn-sm"
              style={{ fontSize: '.74rem', padding: '5px 10px', background: 'rgba(245, 158, 11, 0.12)', color: '#D97706', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 12 }}
            >
              ✔️ Resolve Ticket
            </button>
          )}
        </div>

        {/* CHAT INPUT AREA */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          style={{
            padding: 14,
            background: themeBg,
            display: 'flex',
            gap: 10,
            borderTop: `1px solid ${themeBorder}`,
          }}
        >
          <input
            type="text"
            placeholder="Type your response to guest..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: 24,
              border: `1px solid ${themeBorder}`,
              background: isLightMode ? '#F1F5F9' : '#1E293B',
              color: themeText,
              fontSize: '.88rem',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '10px 20px',
              borderRadius: 24,
              background: 'linear-gradient(135deg, #4338CA, #6366F1)',
              color: '#FFF',
              border: 'none',
              fontWeight: 700,
              fontSize: '.88rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
            }}
          >
            Send ✦
          </button>
        </form>
      </div>
    </div>
  );
}
