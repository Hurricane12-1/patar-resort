import type { CSSProperties } from 'react';
import type { ThemePalette } from './theme.ts';

export function getAdminStyles(t: ThemePalette) {
  return {
    rootContainer: {
      display: 'flex',
      minHeight: '100vh',
      background: t.themeBg,
      color: t.themeText,
      transition: 'background 0.3s ease, color 0.3s ease',
    } as CSSProperties,

    sidebar: (collapsed: boolean): CSSProperties => ({
      width: collapsed ? 76 : 240,
      background: t.themeSidebarBg,
      borderRight: `1px solid ${t.themeBorder}`,
      display: 'flex',
      flexDirection: 'column',
      transition: 'all 0.25s ease',
      zIndex: 100,
      position: 'sticky',
      top: 0,
      height: '100vh',
      boxShadow: t.themeShadow,
    }),

    sidebarHeader: {
      padding: '24px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: `1px solid ${t.themeBorder}`,
    } as CSSProperties,

    sidebarLogo: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      textDecoration: 'none',
      color: t.themeText,
    } as CSSProperties,

    sidebarNav: {
      flex: 1,
      padding: '20px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      overflowY: 'auto',
    } as CSSProperties,

    navItem: (isActive: boolean): CSSProperties => ({
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 14px',
      borderRadius: 12,
      cursor: 'pointer',
      fontSize: '.9rem',
      fontWeight: isActive ? 700 : 500,
      color: isActive ? '#FFFFFF' : t.themeMuted,
      background: isActive ? 'linear-gradient(135deg, #0284C7 0%, #0EA5E9 100%)' : 'transparent',
      transition: 'all 0.18s ease',
      border: 'none',
      width: '100%',
      textAlign: 'left',
    }),

    topBar: {
      height: 72,
      padding: '0 32px',
      background: t.themeHeaderBg,
      borderBottom: `1px solid ${t.themeBorder}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 90,
      backdropFilter: 'blur(16px)',
      boxShadow: t.themeShadow,
    } as CSSProperties,

    searchBox: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 16px',
      background: t.inputBg,
      border: `1px solid ${t.themeBorder}`,
      borderRadius: 24,
      width: 'clamp(200px, 28vw, 360px)',
    } as CSSProperties,

    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: t.inputBg,
      border: `1px solid ${t.themeBorder}`,
      color: t.themeText,
      cursor: 'pointer',
      position: 'relative',
      transition: 'all 0.18s ease',
    } as CSSProperties,

    contentMain: {
      flex: 1,
      padding: '32px',
      maxWidth: 1600,
      margin: '0 auto',
      width: '100%',
    } as CSSProperties,

    cardPanel: {
      background: t.themeCardBg,
      border: `1px solid ${t.themeBorder}`,
      borderRadius: 20,
      padding: '24px',
      boxShadow: t.themeShadow,
      position: 'relative',
    } as CSSProperties,

    statCard: {
      background: t.themeCardBg,
      border: `1px solid ${t.themeBorder}`,
      borderRadius: 16,
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      boxShadow: t.themeShadow,
      position: 'relative',
    } as CSSProperties,

    tableContainer: {
      overflowX: 'auto',
      borderRadius: 16,
      border: `1px solid ${t.themeBorder}`,
      background: t.themeCardBg,
    } as CSSProperties,

    tableHeaderCell: {
      padding: '14px 18px',
      fontSize: '.78rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: t.themeMuted,
      borderBottom: `1px solid ${t.themeBorder}`,
      background: t.isLightMode ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)',
      textAlign: 'left',
    } as CSSProperties,

    tableDataCell: {
      padding: '16px 18px',
      fontSize: '.9rem',
      color: t.themeText,
      borderBottom: `1px solid ${t.themeBorder}`,
      verticalAlign: 'middle',
    } as CSSProperties,

    badgePill: (bg: string, text: string): CSSProperties => ({
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 10px',
      borderRadius: 20,
      fontSize: '.75rem',
      fontWeight: 700,
      background: bg,
      color: text,
      textTransform: 'capitalize',
    }),

    formInput: {
      width: '100%',
      padding: '12px 14px',
      borderRadius: 10,
      border: `1px solid ${t.themeBorder}`,
      background: t.inputBg,
      color: t.themeText,
      fontSize: '.92rem',
      outline: 'none',
      transition: 'border-color 0.2s ease',
    } as CSSProperties,
  };
}
