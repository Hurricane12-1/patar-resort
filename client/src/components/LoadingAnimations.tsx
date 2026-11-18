import React from 'react';

export interface ResortSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  message?: string;
  submessage?: string;
  variant?: 'primary' | 'sky' | 'emerald' | 'amber' | 'indigo';
  icon?: string;
  className?: string;
  style?: React.CSSProperties;
}

const SIZE_MAP = {
  xs: { ring: 20, border: 2, icon: 9, font: '.72rem' },
  sm: { ring: 32, border: 2.5, icon: 13, font: '.8rem' },
  md: { ring: 48, border: 3.5, icon: 18, font: '.9rem' },
  lg: { ring: 64, border: 4, icon: 24, font: '1rem' },
  xl: { ring: 84, border: 5, icon: 32, font: '1.15rem' },
};

const COLOR_MAP = {
  primary: { start: '#0EA5E9', mid: '#38BDF8', end: '#6366F1', glow: 'rgba(14, 165, 233, 0.35)' },
  sky: { start: '#0284C7', mid: '#38BDF8', end: '#7DD3FC', glow: 'rgba(56, 189, 248, 0.4)' },
  emerald: { start: '#059669', mid: '#10B981', end: '#34D399', glow: 'rgba(16, 185, 129, 0.4)' },
  amber: { start: '#D97706', mid: '#F59E0B', end: '#FBBF24', glow: 'rgba(245, 158, 11, 0.4)' },
  indigo: { start: '#4338CA', mid: '#6366F1', end: '#818CF8', glow: 'rgba(99, 102, 241, 0.4)' },
};

/**
 * Modern luxury resort loading animation with concentric glowing rings and pulsating icon.
 */
export const ResortSpinner: React.FC<ResortSpinnerProps> = ({
  size = 'md',
  message,
  submessage,
  variant = 'primary',
  icon = 'umbrella-beach',
  className = '',
  style = {},
}) => {
  const s = SIZE_MAP[size] || SIZE_MAP.md;
  const c = COLOR_MAP[variant] || COLOR_MAP.primary;

  return (
    <div
      className={`resort-spinner-wrapper resort-fade-enter ${className}`}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 8,
        contain: 'layout paint',
        transform: 'translateZ(0)',
        willChange: 'opacity, transform',
        ...style,
      }}
    >
      <div
        className="resort-spinner-core"
        style={{
          position: 'relative',
          width: s.ring,
          height: s.ring,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Outer ambient wave ripple (GPU-composited glow) */}
        <div
          className="resort-ripple-ring"
          style={{
            position: 'absolute',
            inset: -6,
            borderRadius: '50%',
            background: c.glow,
            boxShadow: `0 0 14px ${c.glow}`,
            opacity: 0.6,
            animation: 'resort-pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            transform: 'translateZ(0)',
            willChange: 'transform, opacity',
          }}
        />

        {/* Track circle */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `${s.border}px solid rgba(255, 255, 255, 0.08)`,
          }}
        />

        {/* Rotating gradient progress ring (GPU-composited zero-paint) */}
        <div
          className="resort-spinning-ring"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `${s.border}px solid transparent`,
            borderTopColor: c.mid,
            borderRightColor: c.start,
            animation: 'resort-spin 0.9s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite',
            boxShadow: `0 0 8px ${c.glow}`,
            transform: 'translateZ(0)',
            willChange: 'transform',
          }}
        />

        {/* Inner concentric counter-rotating ring for lg/xl */}
        {(size === 'lg' || size === 'xl') && (
          <div
            style={{
              position: 'absolute',
              inset: 8,
              borderRadius: '50%',
              border: `${Math.max(1.5, s.border - 1.5)}px solid transparent`,
              borderBottomColor: c.end,
              borderLeftColor: c.mid,
              animation: 'resort-spin-reverse 1.4s linear infinite',
              opacity: 0.7,
              transform: 'translateZ(0)',
              willChange: 'transform',
            }}
          />
        )}

        {/* Center breathing icon */}
        {icon && size !== 'xs' && (
          <i
            className={`fas fa-${icon}`}
            style={{
              fontSize: `${s.icon}px`,
              color: c.mid,
              animation: 'resort-icon-breath 2s ease-in-out infinite',
              zIndex: 2,
              transform: 'translateZ(0)',
              willChange: 'transform, opacity',
            }}
          />
        )}
      </div>

      {message && (
        <div style={{ textAlign: 'center' }}>
          <div
            className="resort-shimmer-text"
            style={{
              fontSize: s.font,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: '#F8FAFC',
            }}
          >
            {message}
          </div>
          {submessage && (
            <div
              style={{
                fontSize: '.75rem',
                color: '#94A3B8',
                marginTop: 3,
                fontWeight: 500,
              }}
            >
              {submessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Full page / main section loader with resort crest and high-fidelity skeleton grid.
 */
export const AppPageLoader: React.FC<{
  title?: string;
  subtitle?: string;
  variant?: 'primary' | 'sky' | 'emerald';
  layout?: 'dashboard' | 'table' | 'cards' | 'simple';
}> = ({
  title = 'Synchronizing Resort State…',
  subtitle = 'Connecting to real-time database and loading verified guest inventory.',
  variant = 'primary',
  layout = 'dashboard',
}) => {
  return (
    <div
      className="resort-page-loader-container resort-fade-enter"
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 20px',
        width: '100%',
        maxWidth: 1200,
        margin: '0 auto',
        boxSizing: 'border-box',
        contain: 'layout style',
      }}
    >
      {/* Top Resort Spinner Hero */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <ResortSpinner size="xl" variant={variant} icon="water" message={title} submessage={subtitle} />
      </div>

      {/* Simulated High-Fidelity Skeleton Layout */}
      {layout === 'dashboard' && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* 4 KPI Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="skel"
                style={{
                  height: 104,
                  borderRadius: 16,
                  padding: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxSizing: 'border-box',
                }}
              />
            ))}
          </div>

          {/* Large Main View Chart / Table Skeleton */}
          <div
            className="skel"
            style={{
              height: 280,
              borderRadius: 20,
              width: '100%',
            }}
          />
        </div>
      )}

      {layout === 'table' && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="skel" style={{ height: 48, borderRadius: 12 }} />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skel" style={{ height: 60, borderRadius: 12 }} />
          ))}
        </div>
      )}

      {layout === 'cards' && (
        <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="skel" style={{ height: 180, borderRadius: 16 }} />
              <div className="skel" style={{ height: 24, width: '70%', borderRadius: 8 }} />
              <div className="skel" style={{ height: 18, width: '45%', borderRadius: 8 }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Reusable Card Grid Skeleton (ideal for Rooms, Stays, and Catalog Items)
 */
export const SkeletonCardGrid: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div
      className="resort-fade-enter"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
        gap: 24,
        width: '100%',
        contain: 'layout paint',
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 20,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div className="skel" style={{ height: 190, borderRadius: 14, width: '100%' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="skel" style={{ height: 22, width: '60%', borderRadius: 6 }} />
            <div className="skel" style={{ height: 20, width: '25%', borderRadius: 9999 }} />
          </div>
          <div className="skel" style={{ height: 16, width: '85%', borderRadius: 6 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <div className="skel" style={{ height: 28, width: '35%', borderRadius: 8 }} />
            <div className="skel" style={{ height: 36, width: '40%', borderRadius: 10 }} />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Reusable Data Table Skeleton
 */
export const SkeletonTable: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div
      className="resort-fade-enter"
      style={{
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(255, 255, 255, 0.02)',
        contain: 'layout paint',
      }}
    >
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <div className="skel" style={{ height: 24, width: '30%', borderRadius: 6 }} />
      </div>
      <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '10px 0',
              borderBottom: i < rows - 1 ? '1px solid rgba(255, 255, 255, 0.04)' : 'none',
            }}
          >
            <div className="skel" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
            <div className="skel" style={{ height: 20, flex: 2, borderRadius: 6 }} />
            <div className="skel" style={{ height: 20, flex: 1.5, borderRadius: 6 }} />
            <div className="skel" style={{ height: 24, width: 80, borderRadius: 9999, flexShrink: 0 }} />
            <div className="skel" style={{ height: 32, width: 90, borderRadius: 8, flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ResortSpinner;
