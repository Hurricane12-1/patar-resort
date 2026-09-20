import type { CSSProperties } from 'react';

export const customerStyles = {
  sectionContainer: {
    padding: '40px 0',
  } as CSSProperties,

  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 16,
    marginBottom: 32,
  } as CSSProperties,

  tabChipRow: {
    display: 'flex',
    gap: 10,
    overflowX: 'auto',
    paddingBottom: 8,
    marginBottom: 28,
  } as CSSProperties,

  passCard: {
    background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
    borderRadius: 24,
    padding: 32,
    color: '#FFFFFF',
    boxShadow: '0 20px 40px -15px rgba(2, 132, 199, 0.4)',
    position: 'relative',
    overflow: 'hidden',
  } as CSSProperties,

  passHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  } as CSSProperties,

  passCodeBadge: {
    background: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(10px)',
    borderRadius: 12,
    padding: '8px 16px',
    fontSize: '1.2rem',
    fontWeight: 800,
    letterSpacing: '0.1em',
    fontFamily: 'monospace',
  } as CSSProperties,

  orderItemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderRadius: 14,
    background: 'var(--card-bg, #FFFFFF)',
    border: '1px solid var(--border-color, #E2E8F0)',
    marginBottom: 10,
  } as CSSProperties,
};
