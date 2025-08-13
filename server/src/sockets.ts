import { Server, Socket } from 'socket.io';
import { store } from './store';

let ioRef: Server | null = null;

export function registerSockets(io: Server) {
  ioRef = io;
  const nsp = io.of('/room');
  nsp.on('connection', (socket: Socket) => {
    socket.on('room:join', ({ code }) => {
      socket.join(code);
      const snap = store.snapshot(code);
      if (snap) socket.emit('room:state', snap);
    });

    socket.on('room:subscribe', ({ code }) => {
      socket.join(code);
    });

    socket.on('room:broadcast', ({ code }) => {
      const snap = store.snapshot(code);
      if (snap) nsp.to(code).emit('room:state', snap);
    });
  });
}

export function broadcastRoom(code: string) {
  if (!ioRef) return;
  const nsp = ioRef.of('/room');
  const snap = store.snapshot(code);
  if (snap) nsp.to(code).emit('room:state', snap);
}

export function broadcastRoomDeleted(code: string) {
  if (!ioRef) return;
  const nsp = ioRef.of('/room');
  nsp.to(code).emit('room:deleted', { code });
}


