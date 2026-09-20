import type { CSSProperties } from 'react';

export const chartStyles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    flexWrap: 'wrap',
  } as CSSProperties,

  relativeWrapper: (size: number): CSSProperties => ({
    position: 'relative',
    width: size,
    height: size,
  }),

  centerLabel: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center',
    pointerEvents: 'none',
  } as CSSProperties,

  legendList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: 10,
    flex: 1,
  } as CSSProperties,

  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: '.82rem',
    cursor: 'pointer',
    userSelect: 'none',
  } as CSSProperties,

  colorDot: (color: string): CSSProperties => ({
    width: 10,
    height: 10,
    borderRadius: '50%',
    backgroundColor: color,
    flexShrink: 0,
  }),

  tooltip: {
    position: 'absolute',
    background: 'rgba(15, 23, 42, 0.95)',
    color: '#FFFFFF',
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: '.78rem',
    pointerEvents: 'none',
    boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
    zIndex: 50,
    whiteSpace: 'nowrap',
    transition: 'opacity 0.15s ease, transform 0.15s ease',
  } as CSSProperties,

  chartCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  } as CSSProperties,
};
