import { io } from 'socket.io-client';

const rawSocketBase = (
  (typeof import.meta !== 'undefined' && (
    import.meta.env.VITE_API_URL ||
    import.meta.env.PUBLIC_API_URL ||
    import.meta.env.VITE_PUBLIC_API_URL ||
    import.meta.env.VITE_BACKEND_URL
  )) || '/'
);

const SOCKET_BASE = (
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.endsWith('.localhost')) &&
  rawSocketBase.includes('localhost')
)
  ? '/'
  : rawSocketBase;

let socket = null;
export function getSocket(token) {
  if (!socket) {
    socket = io(SOCKET_BASE, { auth: { token }, transports: ['websocket', 'polling'] });
  } else if (token && socket.auth?.token !== token) {
    socket.auth = { token };
    socket.disconnect().connect();
  }
  return socket;
}
