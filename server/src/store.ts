import { Player, Room, SnapshotRoom } from './types';

const rooms = new Map<string, Room>();

function generateCode(length = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export const store = {
  createRoom(hostName: string): { code: string; player: Player; snapshot: SnapshotRoom } {
    const code = generateCode();
    const player: Player = { id: crypto.randomUUID(), name: hostName, isHost: true } as Player;
    const room: Room = { code, players: new Map([[player.id, player]]), phase: 'lobby' };
    rooms.set(code, room);
    return { code, player, snapshot: store.snapshot(code)! };
  },
  joinRoom(code: string, name: string): { player: Player; snapshot: SnapshotRoom } {
    const room = rooms.get(code);
    if (!room) throw new Error('ROOM_NOT_FOUND');
    // Enforce unique names within a room (case-insensitive)
    const nameTaken = Array.from(room.players.values()).some(
      (p) => p.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (nameTaken) throw new Error('NAME_TAKEN');
    const player: Player = { id: crypto.randomUUID(), name, isHost: false } as Player;
    room.players.set(player.id, player);
    return { player, snapshot: store.snapshot(code)! };
  },
  kickPlayer(code: string, playerId: string) {
    const room = rooms.get(code);
    if (!room) throw new Error('ROOM_NOT_FOUND');
    room.players.delete(playerId);
  },
  leaveOrDelete(code: string, playerId: string): { deleted: boolean } {
    const room = rooms.get(code);
    if (!room) throw new Error('ROOM_NOT_FOUND');
    const player = room.players.get(playerId);
    if (!player) return { deleted: false };
    if (player.isHost) {
      rooms.delete(code);
      return { deleted: true };
    }
    room.players.delete(playerId);
    return { deleted: false };
  },
  getRoom(code: string): Room | undefined {
    return rooms.get(code);
  },
  snapshot(code: string): SnapshotRoom | null {
    const room = rooms.get(code);
    if (!room) return null;
    return { code: room.code, phase: room.phase, players: Array.from(room.players.values()) };
  },
};


