import { useState, useEffect } from 'react';

interface LiveClockProps {
  isLightMode?: boolean;
  style?: React.CSSProperties;
  showSeconds?: boolean;
}

export function LiveClock({ isLightMode = false, style, showSeconds = true }: LiveClockProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = time.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: showSeconds ? '2-digit' : undefined,
    hour12: true,
  });

  const dateStr = time.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      className="top-live-clock"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 12px',
        borderRadius: 20,
        background: isLightMode ? '#F1F5F9' : 'rgba(15, 23, 42, 0.85)',
        border: `1px solid ${isLightMode ? '#CBD5E1' : 'rgba(56, 189, 248, 0.28)'}`,
        color: isLightMode ? '#0F172A' : '#F8FAFC',
        fontSize: '0.78rem',
        fontWeight: 700,
        fontFamily: "'Plus Jakarta Sans', monospace",
        boxShadow: isLightMode ? '0 1px 3px rgba(0,0,0,0.05)' : '0 2px 8px rgba(0,0,0,0.3)',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        ...style,
      }}
      title={`Current Philippine Standard Time (PST / GMT+8): ${dateStr} ${timeStr}`}
    >
      <i className="fas fa-clock" style={{ fontSize: '0.85rem', color: '#0EA5E9' }} />
      <span>{timeStr}</span>
      <span style={{ color: '#64748B', fontSize: '0.7rem' }}>• {dateStr}</span>
      <span
        style={{
          color: '#0EA5E9',
          fontSize: '0.64rem',
          padding: '1px 5px',
          borderRadius: 4,
          background: isLightMode ? 'rgba(14, 165, 233, 0.12)' : 'rgba(14, 165, 233, 0.2)',
          fontWeight: 800,
          letterSpacing: '0.04em',
        }}
      >
        PST
      </span>
    </div>
  );
}

interface FloatingWelcomeProps {
  username?: string;
  isLightMode?: boolean;
  style?: React.CSSProperties;
}

export function FloatingWelcome({ username = 'Guest', isLightMode = false, style }: FloatingWelcomeProps) {
  const cleanName = (username || 'Guest').trim();

  return (
    <div
      className="floating-welcome-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 14px',
        borderRadius: 20,
        background: isLightMode
          ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(14, 165, 233, 0.15))'
          : 'linear-gradient(135deg, rgba(14, 165, 233, 0.15), rgba(99, 102, 241, 0.22))',
        border: `1px solid ${isLightMode ? 'rgba(99, 102, 241, 0.3)' : 'rgba(56, 189, 248, 0.35)'}`,
        color: isLightMode ? '#4338CA' : '#38BDF8',
        fontSize: '0.78rem',
        fontWeight: 700,
        animation: 'floatingFadeWelcome 3.5s ease-in-out infinite',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        ...style,
      }}
      title={`Logged in user: ${cleanName}`}
    >
      <i className="fas fa-hand" style={{ fontSize: '0.85rem', color: '#F59E0B' }} />
      <span>
        Welcome, <strong style={{ color: isLightMode ? '#0F172A' : '#FFFFFF', fontWeight: 800 }}>{cleanName}</strong>
      </span>
    </div>
  );
}
