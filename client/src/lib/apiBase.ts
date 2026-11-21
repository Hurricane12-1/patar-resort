// Kept free of imports on purpose: lib/socket.ts reads this while lib/api.ts is still loading
// (api -> adapters -> websocketAdapter -> socket would otherwise be a circular import).
const rawApiBase = (
  (typeof import.meta !== 'undefined' && (
    import.meta.env.VITE_API_URL ||
    import.meta.env.PUBLIC_API_URL ||
    import.meta.env.VITE_PUBLIC_API_URL ||
    import.meta.env.VITE_BACKEND_URL
  )) || ''
).replace(/\/+$/, '');

const isLocalHost = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.endsWith('.localhost'));

export const API_BASE = (
  isLocalHost
    ? (rawApiBase && !rawApiBase.includes('localhost') ? rawApiBase : '')
    : (rawApiBase || (typeof window !== 'undefined' && window.location.hostname.includes('pages.dev') ? 'https://patar-resort.onrender.com' : ''))
);
