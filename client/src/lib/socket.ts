import { io } from 'socket.io-client';

const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : null;
const rawSocketBase = (
  metaEnv?.VITE_API_URL ||
  metaEnv?.PUBLIC_API_URL ||
  metaEnv?.VITE_PUBLIC_API_URL ||
  metaEnv?.VITE_BACKEND_URL ||
  '/'
);

const isLocalHost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.endsWith('.localhost'));

export const SOCKET_BASE =
  isLocalHost && rawSocketBase.includes('localhost')
    ? '/'
    : rawSocketBase || (typeof window !== 'undefined' && window.location.hostname.includes('pages.dev') ? 'https://patar-resort.onrender.com' : '/');

let socket: any = null;
export function getSocket(token?: string) {
  if (!socket) {
    socket = io(SOCKET_BASE, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      timeout: 8000,
    });
  } else if (token && socket.auth?.token !== token) {
    socket.auth = { token };
    socket.disconnect().connect();
  }
  return socket;
}
