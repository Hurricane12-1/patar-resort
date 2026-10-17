import { useState, useRef, useEffect } from 'react';
import { toast } from './Toasts.tsx';
import { DefaultUserAvatar } from './AdminIcons.tsx';
import { api } from '../lib/api.ts';
import { animateTypewriterPrompt } from '../lib/wordPrompt.ts';
import { getSocket } from '../lib/socket.ts';

function getMessages(g) {
  if (!g) return [];
  if (Array.isArray(g.messages)) return g.messages;
  if (Array.isArray(g.initialMessages)) return g.initialMessages;
  return [];
}

export function ExecutiveGuestConversationsPanel({ initialGuest, isLightMode, conversations = [] }) {
  const [guestList, setGuestList] = useState(() => {
    const list = Array.isArray(conversations) ? [...conversations] : [];
    if (initialGuest) {
      const msgs = getMessages(initialGuest);
      const normalized = { ...initialGuest, messages: msgs, status: initialGuest.status || 'Active' };
      const idx = list.findIndex((g) => g.id === normalized.id || g.name === normalized.name);
      if (idx !== -1) {
        list[idx] = normalized;
      } else {
        list.unshift(normalized);
      }
    }
    return list;
  });

  const [selectedGuest, setSelectedGuest] = useState(() => {
    if (initialGuest) {
      return { ...initialGuest, messages: getMessages(initialGuest), status: initialGuest.status || 'Active' };
    }
    return guestList[0] || null;
  });

  const [inputText, setInputText] = useState('');
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const messageStreamRef = useRef<HTMLDivElement>(null);

  // Sync with prop conversations or fetch if empty
  useEffect(() => {
    if (conversations && conversations.length > 0) {
      setGuestList(conversations);
      if (!selectedGuest && conversations.length > 0) {
        setSelectedGuest(conversations[0]);
      }
    } else {
      api.conversations().then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setGuestList(data);
          if (!selectedGuest) setSelectedGuest(data[0]);
        }
      }).catch(() => {});
    }
  }, [conversations]);

  useEffect(() => {
    if (initialGuest) {
      const msgs = getMessages(initialGuest);
      const normalized = { ...initialGuest, messages: msgs, status: initialGuest.status || 'Active' };
      setSelectedGuest(normalized);
      setGuestList((prev) => {
        const idx = prev.findIndex((g) => g.id === normalized.id || g.name === normalized.name);
        if (idx !== -1) {
          return prev.map((g, i) => (i === idx ? normalized : g));
        }
        return [normalized, ...prev];
      });
    }
  }, [initialGuest]);

  // Adhere chat to bottom on message updates or guest change
  const currentMessages = getMessages(selectedGuest);
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [selectedGuest?.id, currentMessages.length]);

  // Immediate anchor on guest switch
  useEffect(() => {
    if (messageStreamRef.current) {
      messageStreamRef.current.scrollTop = messageStreamRef.current.scrollHeight;
    }
  }, [selectedGuest?.id]);

  // Live Socket Listener for directed customer inquiries & real-time guest messages
  useEffect(() => {
    const s = getSocket();
    if (!s) return;

    const handleHandoff = (data: any) => {
      const pid = data?.profileId;
      toast(`🛎️ Customer Directed to Service Agent: ${data?.assignedAgent?.name || 'Receptionist'}!`);
      api.conversations().then((convs) => {
        if (Array.isArray(convs) && convs.length > 0) {
          setGuestList(convs);
          if (pid) {
            const found = convs.find((c: any) => c.profile_id === pid || c.id === pid);
            if (found) setSelectedGuest(found);
          }
        }
      }).catch(() => {});
    };

    const handleGuestMessage = (data: any) => {
      if (!data?.text) return;
      const pid = data.profileId;
      const newMsg = {
        id: data.id || Date.now(),
        sender: 'guest',
        senderName: data.guestName || 'Guest',
        text: data.text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setGuestList((prev) => {
        return prev.map((g) => {
          if (g.profile_id === pid || g.id === pid) {
            const msgs = getMessages(g);
            return {
              ...g,
              lastMessage: data.text,
              timeAgo: 'Just now',
              messageCount: msgs.length + 1,
              status: 'Directed to Agent',
              is_directed_to_agent: true,
              messages: [...msgs, newMsg],
            };
          }
          return g;
        });
      });

      setSelectedGuest((curr: any) => {
        if (curr && (curr.profile_id === pid || curr.id === pid)) {
          const msgs = getMessages(curr);
          return {
            ...curr,
            lastMessage: data.text,
            timeAgo: 'Just now',
            messageCount: msgs.length + 1,
            status: 'Directed to Agent',
            is_directed_to_agent: true,
            messages: [...msgs, newMsg],
          };
        }
        return curr;
      });
    };

    s.on('staff:customer_handoff', handleHandoff);
    s.on('agent:guest_message', handleGuestMessage);

    return () => {
      s.off('staff:customer_handoff', handleHandoff);
      s.off('agent:guest_message', handleGuestMessage);
    };
  }, []);

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputText;
    if (!text.trim() || !selectedGuest) return;

    const newMsg = {
      id: Date.now(),
      sender: 'admin',
      senderName: 'Front Desk / Concierge',
      text: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const currentMsgs = getMessages(selectedGuest);
    const updatedGuest = {
      ...selectedGuest,
      messages: [...currentMsgs, newMsg],
    };

    setSelectedGuest(updatedGuest);
    setGuestList((prev) => prev.map((g) => (g.id === updatedGuest.id ? updatedGuest : g)));
    if (!textToSend) setInputText('');

    try {
      if (selectedGuest.profile_id) {
        await api.sendStaffChatMessage(selectedGuest.profile_id, text);
      }
    } catch {}

    toast(`💬 Message transmitted to ${selectedGuest.name}`);
  };

  const handleResolveTicket = () => {
    const updated = { ...selectedGuest, status: 'Resolved' };
    setSelectedGuest(updated);
    setGuestList((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    toast(`✔️ Ticket #${selectedGuest.id} resolved & CSAT 100% recorded!`);
  };

  const themeBg = isLightMode ? '#FFFFFF' : '#0F172A';
  const themeCardBg = isLightMode ? '#F8FAFC' : '#1E293B';
  const themeText = isLightMode ? '#0F172A' : '#F8FAFC';
  const themeMuted = isLightMode ? '#64748B' : '#94A3B8';
  const themeBorder = isLightMode ? '#E2E8F0' : 'rgba(255, 255, 255, 0.12)';
  const themeShadow = isLightMode ? '0 10px 25px rgba(0, 0, 0, 0.05)' : 'none';

  const filteredGuests = guestList.filter((g) => {
    const matchesFilter = filter === 'All' || g.status === filter;
    const matchesSearch = g.name.toLowerCase().includes(search.toLowerCase()) || (g.channel || '').toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const openCount = guestList.filter((g) => g.status !== 'Resolved').length;

  return (
    <div className="panel" style={{ background: themeBg, border: `1px solid ${themeBorder}`, borderRadius: 20, padding: 24, boxShadow: themeShadow, width: '100%', boxSizing: 'border-box' }}>
      {/* PANEL PAGE HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${themeBorder}` }}>
        <div>
          <span style={{ fontSize: '.74rem', color: '#6366F1', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>
            OMNICHANNEL INBOX & CSAT MANAGEMENT
          </span>
          <h2 style={{ fontSize: '1.6rem', margin: '4px 0 0', color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800 }}>
            Customer Services & Resolution Panel
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <span style={{ fontSize: '.82rem', padding: '6px 14px', background: 'rgba(99, 102, 241, 0.15)', color: '#6366F1', fontWeight: 700, borderRadius: 20, border: '1px solid rgba(99, 102, 241, 0.3)' }}>
            💬 {openCount} Open Ticket{openCount === 1 ? '' : 's'} · CSAT 100%
          </span>
        </div>
      </div>

      {/* 2-COLUMN RESPONSIVE PANEL LAYOUT */}
      <div
        className="conversations-grid-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: '340px 1fr',
          gap: 20,
          height: 680,
          maxHeight: 'calc(100vh - 200px)',
          minHeight: 560,
          width: '100%',
          boxSizing: 'border-box',
          alignItems: 'stretch',
        }}
      >
        {/* LEFT INBOX TICKET LIST (SCROLLABLE) */}
        <div
          className="conversations-inbox-column"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            borderRight: `1px solid ${themeBorder}`,
            paddingRight: 16,
            height: '100%',
            minHeight: 0,
            boxSizing: 'border-box',
          }}
        >
          {/* SEARCH & FILTER (PINNED HEADER) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
            <input
              type="text"
              placeholder="🔍 Search guest or channel..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: '9px 14px',
                borderRadius: 12,
                border: `1px solid ${themeBorder}`,
                background: isLightMode ? '#F1F5F9' : '#1E293B',
                color: themeText,
                fontSize: '.84rem',
                outline: 'none',
              }}
            />

            <div style={{ display: 'flex', gap: 6 }}>
              {['All', 'Active', 'Resolved'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    borderRadius: 8,
                    border: filter === f ? '1px solid #6366F1' : `1px solid ${themeBorder}`,
                    background: filter === f ? 'linear-gradient(135deg, #4338CA, #6366F1)' : 'transparent',
                    color: filter === f ? '#FFF' : themeMuted,
                    fontWeight: 700,
                    fontSize: '.74rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* GUEST TICKET ITEMS - FULLY SCROLLABLE */}
          <div
            className="conversations-scroll-list"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              flex: '1 1 0%',
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              overscrollBehavior: 'contain',
              paddingRight: 4,
            }}
          >
            {filteredGuests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: themeMuted, fontSize: '.84rem' }}>
                No conversations found matching filters.
              </div>
            ) : (
              filteredGuests.map((g) => {
                const isSel = selectedGuest?.id === g.id;
                const gMsgs = getMessages(g);
                const lastMsg = gMsgs.length > 0 ? gMsgs[gMsgs.length - 1] : null;

                return (
                  <div
                    key={g.id}
                    onClick={() => setSelectedGuest(g)}
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      border: isSel ? '1px solid #6366F1' : `1px solid ${themeBorder}`,
                      background: isSel ? (isLightMode ? '#EEF2FF' : 'rgba(99, 102, 241, 0.15)') : themeCardBg,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: isSel ? '0 4px 14px rgba(99, 102, 241, 0.15)' : 'none',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <DefaultUserAvatar size={32} bg={isLightMode ? '#CBD5E1' : 'rgba(255, 255, 255, 0.15)'} iconColor={isLightMode ? '#475569' : '#FFFFFF'} />
                        <b style={{ fontSize: '.88rem', color: themeText }}>{g.name}</b>
                      </div>
                      <span
                        style={{
                          fontSize: '.68rem',
                          color: g.status === 'Resolved' ? '#10B981' : (g.is_directed_to_agent || g.status === 'Directed to Agent' ? '#10B981' : '#6366F1'),
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {(g.is_directed_to_agent || g.status === 'Directed to Agent') && (
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
                        )}
                        {g.is_directed_to_agent || g.status === 'Directed to Agent' ? '🟢 Live with Agent' : g.status}
                      </span>
                    </div>

                    <span style={{ fontSize: '.72rem', color: themeMuted, display: 'block', marginBottom: 6 }}>
                      {g.channel} · {g.timeAgo}
                    </span>

                    <p style={{ margin: 0, fontSize: '.76rem', color: themeText, opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {lastMsg ? lastMsg.text : 'No messages'}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT CHAT DETAILS & ADHERED COMPOSER PANEL */}
        {selectedGuest ? (
          <div
            className="conversations-chat-column"
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              minHeight: 0,
              background: themeCardBg,
              borderRadius: 16,
              border: `1px solid ${themeBorder}`,
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
          >
            {/* CHAT PANEL HEADER (PINNED AT TOP) */}
            <div
              style={{
                padding: '16px 20px',
                background: isLightMode ? '#FFFFFF' : '#1E293B',
                borderBottom: `1px solid ${themeBorder}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <DefaultUserAvatar size={42} bg={isLightMode ? '#CBD5E1' : 'rgba(255, 255, 255, 0.15)'} iconColor={isLightMode ? '#475569' : '#FFFFFF'} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      {selectedGuest.name}
                    </h3>
                    <span
                      style={{
                        fontSize: '.68rem',
                        padding: '2px 8px',
                        borderRadius: 10,
                        background: selectedGuest.status === 'Resolved'
                          ? 'rgba(16, 185, 129, 0.2)'
                          : (selectedGuest.is_directed_to_agent || selectedGuest.status === 'Directed to Agent' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.2)'),
                        color: selectedGuest.status === 'Resolved'
                          ? '#10B981'
                          : (selectedGuest.is_directed_to_agent || selectedGuest.status === 'Directed to Agent' ? '#10B981' : '#6366F1'),
                        fontWeight: 700,
                      }}
                    >
                      {selectedGuest.is_directed_to_agent || selectedGuest.status === 'Directed to Agent'
                        ? '🟢 Live with Service Agent'
                        : selectedGuest.status}
                    </span>
                  </div>
                  <span style={{ fontSize: '.76rem', color: themeMuted }}>
                    Channel: <b>{selectedGuest.channel}</b> · Villa: <b>{selectedGuest.villa || 'Standard'}</b>
                  </span>
                </div>
              </div>

              {selectedGuest.status !== 'Resolved' && (
                <button
                  onClick={handleResolveTicket}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #059669, #10B981)',
                    color: '#FFF',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '.82rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  ✔️ Mark Resolved
                </button>
              )}
            </div>

            {/* MESSAGE STREAM (SCROLLABLE, ADHERES TO BOTTOM) */}
            <div
              ref={messageStreamRef}
              className="conversations-message-stream"
              style={{
                flex: '1 1 0%',
                minHeight: 0,
                padding: '20px 24px',
                overflowY: 'auto',
                overflowX: 'hidden',
                overscrollBehavior: 'contain',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                background: isLightMode ? '#FAFAFD' : '#0F172A',
                scrollBehavior: 'smooth',
              }}
            >
              {currentMessages.map((m) => {
                const isAdmin = m.sender === 'admin';
                const isBot = m.sender === 'bot';

                return (
                  <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isAdmin ? 'flex-end' : 'flex-start' }}>
                    <span style={{ fontSize: '.68rem', color: themeMuted, marginBottom: 3, fontWeight: 600 }}>
                      {m.senderName} · {m.time}
                    </span>
                    <div
                      style={{
                        maxWidth: '75%',
                        padding: '12px 18px',
                        borderRadius: isAdmin ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                        background: isAdmin
                          ? 'linear-gradient(135deg, #4338CA, #6366F1)'
                          : isBot
                          ? (isLightMode ? '#E2E8F0' : 'rgba(255, 255, 255, 0.1)')
                          : (isLightMode ? '#FFFFFF' : '#334155'),
                        color: isAdmin ? '#FFFFFF' : themeText,
                        fontSize: '.9rem',
                        lineHeight: 1.45,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                        border: `1px solid ${isAdmin ? 'transparent' : themeBorder}`,
                        wordBreak: 'break-word',
                      }}
                    >
                      {m.text}
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} style={{ height: 1 }} />
            </div>

            {/* CHAT BOX CONTAINER (ADHERED / PINNED TO BOTTOM) */}
            <div
              className="conversations-chat-adhered-box"
              style={{
                flexShrink: 0,
                marginTop: 'auto',
                background: isLightMode ? '#FFFFFF' : '#1E293B',
                borderTop: `1px solid ${themeBorder}`,
              }}
            >
              {/* QUICK CANNED EXECUTIVE BUTTONS */}
              <div
                style={{
                  padding: '10px 16px',
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  borderBottom: `1px solid ${isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                <button
                  type="button"
                  onClick={() => animateTypewriterPrompt('✅ Early check-in at 11:00 AM is approved! Room is ready.', (s) => setInputText(s))}
                  className="btn btn-sm"
                  style={{ fontSize: '.74rem', padding: '5px 10px', background: 'rgba(16, 185, 129, 0.12)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 12, cursor: 'pointer' }}
                  title="Click to type prompt into reply composer"
                >
                  ✅ Approve Early Check-In
                </button>
                <button
                  type="button"
                  onClick={() => animateTypewriterPrompt('🍽️ Candlelight beachfront dinner confirmed for 2 guests at 7:00 PM.', (s) => setInputText(s))}
                  className="btn btn-sm"
                  style={{ fontSize: '.74rem', padding: '5px 10px', background: 'rgba(99, 102, 241, 0.12)', color: '#6366F1', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: 12, cursor: 'pointer' }}
                  title="Click to type prompt into reply composer"
                >
                  🍽️ Confirm Dining
                </button>
                <button
                  type="button"
                  onClick={() => animateTypewriterPrompt('🚐 Executive van pickup details sent to your SMS.', (s) => setInputText(s))}
                  className="btn btn-sm"
                  style={{ fontSize: '.74rem', padding: '5px 10px', background: 'rgba(56, 189, 248, 0.12)', color: '#0EA5E9', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: 12, cursor: 'pointer' }}
                  title="Click to type prompt into reply composer"
                >
                  🚐 Send Van Details
                </button>
              </div>

              {/* REPLY INPUT COMPOSER */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                style={{ padding: 14, display: 'flex', gap: 10, alignItems: 'center' }}
              >
                <input
                  type="text"
                  placeholder="Type executive response to guest..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: 24,
                    border: `1px solid ${themeBorder}`,
                    background: isLightMode ? '#F1F5F9' : '#0F172A',
                    color: themeText,
                    fontSize: '.88rem',
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '10px 22px',
                    borderRadius: 24,
                    background: 'linear-gradient(135deg, #4338CA, #6366F1)',
                    color: '#FFF',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '.88rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  Send Reply ✦
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', background: themeCardBg, borderRadius: 16, border: `1px dashed ${themeBorder}`, textAlign: 'center', minHeight: 440 }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: isLightMode ? '#EFF6FF' : 'rgba(37, 99, 235, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: '1.8rem' }}>💬</span>
            </div>
            <h4 style={{ margin: '0 0 8px', fontSize: '1.15rem', color: themeText, fontWeight: 700 }}>No Active Guest Conversations</h4>
            <p style={{ margin: 0, fontSize: '0.86rem', color: themeMuted, maxWidth: 420, lineHeight: 1.5 }}>
              Incoming guest inquiries from the resort webchat, chatbot, and messaging services will appear here in real time.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
