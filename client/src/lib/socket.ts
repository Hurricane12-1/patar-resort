import { io } from 'socket.io-client';
let socket = null;
export function getSocket(token) {
  if (!socket) {
    socket = io('/', { auth: { token }, transports: ['websocket', 'polling'] });
  } else if (token && socket.auth?.token !== token) {
    socket.auth = { token };
    socket.disconnect().connect();
  }
  return socket;
}
