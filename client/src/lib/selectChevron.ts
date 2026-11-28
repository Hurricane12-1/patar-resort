import type { CSSProperties } from 'react';

const chevronSvg = (color: string) =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5l5 5 5-5' fill='none' stroke='${encodeURIComponent(color)}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;

export function chevronSelectStyle(color: string): CSSProperties {
  return {
    appearance: 'none',
    WebkitAppearance: 'none',
    backgroundImage: chevronSvg(color),
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
  };
}
