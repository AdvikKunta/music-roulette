import { io, Socket } from 'socket.io-client';

const SOCKET_BASE = import.meta.env.VITE_SOCKET_BASE || 'http://localhost:4000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(`${SOCKET_BASE}/room`, { autoConnect: true });
  }
  return socket;
}


