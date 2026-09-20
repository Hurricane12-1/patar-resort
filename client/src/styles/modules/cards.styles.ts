import type { CSSProperties } from 'react';
import type { ThemePalette } from './theme.ts';

export function getCardStyles(t: ThemePalette) {
  return {
    cardWrapper: {
      background: t.themeCardBg,
      border: `1px solid ${t.themeBorder}`,
      borderRadius: 16,
      padding: 22,
      marginBottom: 24,
      boxShadow: t.themeShadow,
    } as CSSProperties,

    cardHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    } as CSSProperties,

    cardTitle: {
      fontSize: '1.05rem',
      color: t.themeText,
      display: 'block',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      fontWeight: 700,
    } as CSSProperties,

    cardSubtitle: {
      fontSize: '.78rem',
      color: t.themeMuted,
    } as CSSProperties,

    inputGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: 14,
      marginBottom: 16,
    } as CSSProperties,

    inputGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    } as CSSProperties,

    label: {
      fontSize: '.75rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      color: t.themeMuted,
    } as CSSProperties,

    input: {
      background: t.inputBg,
      border: `1px solid ${t.themeBorder}`,
      borderRadius: 8,
      padding: '10px 14px',
      color: t.themeText,
      fontSize: '.85rem',
      outline: 'none',
      width: '100%',
    } as CSSProperties,

    buttonRow: {
      display: 'flex',
      gap: 10,
      alignItems: 'center',
      flexWrap: 'wrap',
    } as CSSProperties,
  };
}
