import React from 'react';

interface StatusPillProps {
  status: string;
  paymentStatus?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
}

export default function StatusPill({
  status,
  paymentStatus,
  onClick,
  style,
  className = '',
}: StatusPillProps) {
  const normStatus = (status || 'pending').toLowerCase();
  const isRefunded = (paymentStatus || '').toLowerCase() === 'refunded';

  let label = normStatus.replace('_', ' ').toUpperCase();
  let bg = '#D1FAE5';
  let color = '#065F46';
  let border = '#A7F3D0';
  let icon: string | null = null;

  if (isRefunded) {
    label = 'REFUNDED';
    bg = '#064E3B';
    color = '#34D399';
    border = '#059669';
    icon = '☑';
  } else if (normStatus === 'confirmed') {
    label = 'CONFIRMED';
    bg = '#D1FAE5';
    color = '#065F46';
    border = '#A7F3D0';
  } else if (normStatus === 'checked_in') {
    label = 'CHECKED IN';
    bg = '#1E3A8A';
    color = '#93C5FD';
    border = '#2563EB';
  } else if (normStatus === 'checked_out') {
    label = 'CHECKED OUT';
    bg = '#312E81';
    color = '#C7D2FE';
    border = '#4338CA';
  } else if (normStatus === 'cancelled') {
    label = 'CANCELLED';
    bg = '#4C1D24';
    color = '#FCA5A5';
    border = '#7F1D1D';
  } else if (normStatus === 'pending') {
    label = 'PENDING';
    bg = '#78350F';
    color = '#FDE68A';
    border = '#92400E';
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`status-pill-btn ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        background: bg,
        color: color,
        border: `1px solid ${border}`,
        borderRadius: 9999,
        padding: '5px 16px',
        fontSize: '0.74rem',
        fontWeight: 800,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.18s ease-in-out',
        outline: 'none',
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        userSelect: 'none',
        ...style,
      }}
      title="Click to view lifecycle timeline & milestones"
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.filter = 'brightness(1.12)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.filter = 'brightness(1)';
          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)';
        }
      }}
    >
      {icon && <span style={{ fontWeight: 800 }}>{icon}</span>}
      <span>{label}</span>
    </button>
  );
}
