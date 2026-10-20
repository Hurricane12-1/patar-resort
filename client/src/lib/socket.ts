import { io } from 'socket.io-client';

const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : null;
const rawSocketBase = (
  metaEnv?.VITE_API_URL ||
  metaEnv?.PUBLIC_API_URL ||
  metaEnv?.VITE_PUBLIC_API_URL ||
  metaEnv?.VITE_BACKEND_URL ||
  '/'
);

const SOCKET_BASE = (
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.endsWith('.localhost')) &&
  rawSocketBase.includes('localhost')
)
  ? '/'
  : rawSocketBase;

let socket: any = null;
export function getSocket(token?: string) {
  if (!socket) {
    socket = io(SOCKET_BASE, { auth: { token }, transports: ['websocket', 'polling'] });
  } else if (token && socket.auth?.token !== token) {
    socket.auth = { token };
    socket.disconnect().connect();
  }
  return socket;
}
