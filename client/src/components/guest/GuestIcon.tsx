import type { ReactNode, SVGProps } from 'react';

const ICONS = {
  home: (
    <>
      <path d="M3.5 10.6 12 4l8.5 6.6" />
      <path d="M5.5 9.2V20h13V9.2" />
      <path d="M10 20v-5.2h4V20" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M8 3v4M16 3v4M3.5 10.5h17" />
    </>
  ),
  'calendar-plus': (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M8 3v4M16 3v4M3.5 10.5h17M12 13.2v4.6M9.7 15.5h4.6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.2 19.5c.8-3.3 3.1-5.1 5.8-5.1s5 1.8 5.8 5.1" />
      <path d="M15.6 5.6a3 3 0 0 1 0 5.8" />
      <path d="M17.6 14.6c1.6.7 2.6 2.3 3 4.9" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.2" r="3.7" />
      <path d="M4.6 20.2c1.1-3.9 4-5.9 7.4-5.9s6.3 2 7.4 5.9" />
    </>
  ),
  bed: (
    <>
      <path d="M3 18.5V12a2.5 2.5 0 0 1 2.5-2.5h13A2.5 2.5 0 0 1 21 12v6.5" />
      <path d="M3 15.5h18M3 18.5V21M21 18.5V21" />
      <path d="M6.5 9.5V7.2a1.7 1.7 0 0 1 1.7-1.7h7.6a1.7 1.7 0 0 1 1.7 1.7v2.3" />
    </>
  ),
  'map-pin': (
    <>
      <path d="M12 21s-6.5-5.7-6.5-11.1a6.5 6.5 0 0 1 13 0C18.5 15.3 12 21 12 21z" />
      <circle cx="12" cy="9.9" r="2.4" />
    </>
  ),
  phone: <path d="M6.6 3.8h2.6l1.5 3.9-1.9 1.3a11.4 11.4 0 0 0 6.2 6.2l1.3-1.9 3.9 1.5v2.6a2 2 0 0 1-2.2 2A16.6 16.6 0 0 1 4.6 6a2 2 0 0 1 2-2.2z" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7.2 8 5.8 8-5.8" />
    </>
  ),
  message: <path d="M5 5h14a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-9l-4.5 3.3v-3.3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />,
  card: (
    <>
      <rect x="2.8" y="5.2" width="18.4" height="13.6" rx="2.5" />
      <path d="M2.8 9.8h18.4M6.5 15h4" />
    </>
  ),
  wallet: (
    <>
      <path d="M5 7.4V6.5a2 2 0 0 1 2-2h10.5v2.9" />
      <rect x="3.5" y="7.4" width="17" height="12" rx="2.5" />
      <path d="M16 13.4h1.8" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.7 9.3a2.4 2.4 0 0 1 4.6 1c0 1.7-2.3 2.2-2.3 3.7" />
      <path d="M12 17.2h.01" />
    </>
  ),
  'chevron-right': <path d="m9.5 6 6 6-6 6" />,
  'chevron-down': <path d="m6 9.5 6 6 6-6" />,
  'arrow-right': (
    <>
      <path d="M5 12h14" />
      <path d="m13.5 6.5 5.5 5.5-5.5 5.5" />
    </>
  ),
  'arrow-left': (
    <>
      <path d="M19 12H5" />
      <path d="m10.5 6.5-5.5 5.5 5.5 5.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  check: <path d="m5 12.6 4.4 4.4L19 7.4" />,
  edit: (
    <>
      <path d="M4.5 19.5h4l10-10a2.1 2.1 0 0 0-3-3l-10 10v3z" />
      <path d="m13.8 7.7 3 3" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.2 5.2 6v5.4c0 4.3 2.9 7.9 6.8 9.4 3.9-1.5 6.8-5.1 6.8-9.4V6L12 3.2z" />
      <path d="m9.2 12 2 2 3.8-4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.2V12l3.2 2" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.5" />
      <path d="M15.5 8.5V6.6A2.6 2.6 0 0 0 12.9 4H6.6A2.6 2.6 0 0 0 4 6.6v6.3a2.6 2.6 0 0 0 2.6 2.6h1.9" />
    </>
  ),
  logout: (
    <>
      <path d="M14.5 4H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3.5" />
      <path d="M10 16.5 5.5 12 10 7.5M5.5 12H16" />
    </>
  ),
  login: (
    <>
      <path d="M9.5 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3.5" />
      <path d="M14 16.5 18.5 12 14 7.5M18.5 12H8" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.3-4.3" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16.5v-5a6 6 0 0 1 12 0v5l1.5 2h-15l1.5-2z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="3.8" />
      <path d="m10.8 12.3 8.2-8.2M15.8 7.3l2.4 2.4M13.6 9.5l2 2" />
    </>
  ),
  sparkles: (
    <>
      <path d="M11 3.5 12.7 8l4.5 1.7-4.5 1.7L11 16l-1.7-4.6-4.5-1.7L9.3 8 11 3.5z" />
      <path d="m18.5 14.5.8 2.1 2.2.9-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.9.8-2.1z" />
    </>
  ),
  navigation: <path d="M3.5 11 20.5 3.5 13 20.5l-2-7.5-7.5-2z" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.2M12 7.8h.01" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 7h15M10 11v6M14 11v6" />
      <path d="m6.5 7 .9 12.2A1.8 1.8 0 0 0 9.2 21h5.6a1.8 1.8 0 0 0 1.8-1.8L17.5 7M9.5 7V4.5h5V7" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3.5h12v17l-3-1.8-3 1.8-3-1.8-3 1.8v-17z" />
      <path d="M9 8h6M9 11.5h6M9 15h3.5" />
    </>
  ),
  wifi: (
    <>
      <path d="M3 9.2a13.5 13.5 0 0 1 18 0" />
      <path d="M6.2 12.6a9 9 0 0 1 11.6 0" />
      <path d="M9.4 16a4.5 4.5 0 0 1 5.2 0" />
      <path d="M12 19.4h.01" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
    </>
  ),
  refresh: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4.5v4h-4" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type GuestIconName = keyof typeof ICONS;

interface GuestIconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: GuestIconName;
  className?: string;
  strokeWidth?: number;
}

/** Line icons for the guest portal, drawn to match the landing page's inline SVGs. */
export default function GuestIcon({ name, className = 'h-5 w-5', strokeWidth = 1.8, ...rest }: GuestIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
      {...rest}
    >
      {ICONS[name]}
    </svg>
  );
}
