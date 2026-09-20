import type { CSSProperties } from 'react';

export interface ThemePalette {
  isLightMode: boolean;
  themeBg: string;
  themeSidebarBg: string;
  themeHeaderBg: string;
  themeCardBg: string;
  themeText: string;
  themeMuted: string;
  themeBorder: string;
  themeShadow: string;
  inputBg: string;
  accentSky: string;
  accentAmber: string;
  accentGreen: string;
  accentRose: string;
  accentPurple: string;
}

export function getThemePalette(isLightMode: boolean): ThemePalette {
  return {
    isLightMode,
    themeBg: isLightMode ? '#F8FAFC' : '#020617',
    themeSidebarBg: isLightMode ? '#FFFFFF' : 'rgba(15, 23, 42, 0.95)',
    themeHeaderBg: isLightMode ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 23, 42, 0.9)',
    themeCardBg: isLightMode ? '#FFFFFF' : 'rgba(15, 23, 42, 0.85)',
    themeText: isLightMode ? '#0F172A' : '#F8FAFC',
    themeMuted: isLightMode ? '#64748B' : '#94A3B8',
    themeBorder: isLightMode ? '#E2E8F0' : 'rgba(255, 255, 255, 0.1)',
    themeShadow: isLightMode ? '0 4px 20px rgba(0, 0, 0, 0.05)' : 'none',
    inputBg: isLightMode ? '#FFFFFF' : 'rgba(2, 6, 23, 0.6)',
    accentSky: '#0284C7',
    accentAmber: '#F59E0B',
    accentGreen: '#10B981',
    accentRose: '#F43F5E',
    accentPurple: '#8B5CF6',
  };
}

export const commonStyles: Record<string, CSSProperties> = {
  flexCenter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flexBetween: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flexCol: {
    display: 'flex',
    flexDirection: 'column',
  },
  truncate: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  fullWidth: {
    width: '100%',
  },
  transitionAll: {
    transition: 'all 0.25s ease',
  },
};
