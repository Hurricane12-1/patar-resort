import type { CSSProperties } from 'react';
import type { ThemePalette } from './theme.ts';

export function getModalStyles(t: ThemePalette) {
  return {
    backdrop: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(2, 6, 23, 0.75)',
      backdropFilter: 'blur(8px)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    } as CSSProperties,

    dialog: (maxWidth: number = 680): CSSProperties => ({
      width: '100%',
      maxWidth,
      background: t.themeBg,
      borderRadius: 20,
      border: `1px solid ${t.themeBorder}`,
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      maxHeight: '85vh',
    }),

    header: {
      padding: '16px 22px',
      background: t.isLightMode
        ? 'linear-gradient(135deg, #EEF2FF, #E0E7FF)'
        : 'linear-gradient(135deg, #1E1B4B, #312E81)',
      borderBottom: `1px solid ${t.themeBorder}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    } as CSSProperties,

    body: {
      padding: '20px 22px',
      overflowY: 'auto',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    } as CSSProperties,

    footer: {
      padding: '16px 22px',
      borderTop: `1px solid ${t.themeBorder}`,
      background: t.themeCardBg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 12,
    } as CSSProperties,

    closeButton: {
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      color: t.themeMuted,
      fontSize: '1.2rem',
      padding: 4,
      borderRadius: 8,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    } as CSSProperties,
  };
}
