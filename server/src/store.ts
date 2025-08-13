import { Player, Room, SnapshotRoom, Submission } from './types';

const rooms = new Map<string, Room>();

function generateCode(length = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function clampNumSongsToPlay(room: Room) {
  const perPlayer = room.numSongsPerPlayer ?? 3;
  const maxPlayable = Math.max(1, room.players.size * perPlayer);
  if (!room.numSongsToPlay || room.numSongsToPlay > maxPlayable) {
    room.numSongsToPlay = maxPlayable;
  }
}

export const store = {
  createRoom(hostName: string): { code: string; player: Player; snapshot: SnapshotRoom } {
    const code = generateCode();
    const player: Player = { id: crypto.randomUUID(), name: hostName, isHost: true } as Player;
    const room: Room = {
      code,
      players: new Map([[player.id, player]]),
      phase: 'lobby',
      submissions: new Map(),
      numSongsPerPlayer: 3,
      timePerVotingRoundSeconds: 30,
      numSongsToPlay: 10,
    };
    clampNumSongsToPlay(room);
    rooms.set(code, room);
    return { code, player, snapshot: store.snapshot(code)! };
  },
  joinRoom(code: string, name: string): { player: Player; snapshot: SnapshotRoom } {
    const room = rooms.get(code);
    if (!room) throw new Error('ROOM_NOT_FOUND');
    if (room.phase !== 'lobby') throw new Error('GAME_IN_PROGRESS');
    // Enforce unique names within a room (case-insensitive)
    const nameTaken = Array.from(room.players.values()).some(
      (p) => p.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (nameTaken) throw new Error('NAME_TAKEN');
    const player: Player = { id: crypto.randomUUID(), name, isHost: false } as Player;
    room.players.set(player.id, player);
    clampNumSongsToPlay(room);
    return { player, snapshot: store.snapshot(code)! };
  },
  kickPlayer(code: string, playerId: string) {
    const room = rooms.get(code);
    if (!room) throw new Error('ROOM_NOT_FOUND');
    const wasHost = room.players.get(playerId)?.isHost === true; // capture whether removed player was host
    room.players.delete(playerId); // remove the player from the room
    if (room.players.size > 0 && wasHost) {
      // reassign host to another remaining player so the room continues
      const [nextId, nextPlayer] = room.players.entries().next().value as [string, Player];
      nextPlayer.isHost = true;
      room.players.set(nextId, nextPlayer);
    }
    clampNumSongsToPlay(room); // recompute max playable songs after roster change
    if (room.players.size === 0) {
      rooms.delete(code); // delete empty room
    }
  },
  leaveOrDelete(code: string, playerId: string): { deleted: boolean } {
    const room = rooms.get(code);
    if (!room) throw new Error('ROOM_NOT_FOUND');
    const player = room.players.get(playerId);
    if (!player) return { deleted: false }; // player already gone; nothing to do
    if (player.isHost) {
      // Host is leaving
      if (room.players.size > 1) {
        // reassign host to another player instead of deleting the room
        room.players.delete(playerId);
        const [nextId, nextPlayer] = room.players.entries().next().value as [string, Player];
        nextPlayer.isHost = true;
        room.players.set(nextId, nextPlayer);
        clampNumSongsToPlay(room);
        return { deleted: false };
      }
      // host was alone → delete the room
      rooms.delete(code);
      return { deleted: true };
    }
    // Non-host leaving
    room.players.delete(playerId);
    clampNumSongsToPlay(room);
    if (room.players.size === 0) {
      rooms.delete(code);
      return { deleted: true };
    }
    return { deleted: false };
  },
  getRoom(code: string): Room | undefined {
    return rooms.get(code);
  },
  snapshot(code: string): SnapshotRoom | null {
    const room = rooms.get(code);
    if (!room) return null;
    const submissionCounts: Record<string, number> = {};
    for (const p of room.players.values()) submissionCounts[p.id] = 0;
    for (const s of room.submissions.values()) submissionCounts[s.playerId] = (submissionCounts[s.playerId] || 0) + 1;
    const base: SnapshotRoom = {
      code: room.code,
      phase: room.phase,
      players: Array.from(room.players.values()),
      submissionCounts,
      numSongsPerPlayer: room.numSongsPerPlayer!,
      timePerVotingRoundSeconds: room.timePerVotingRoundSeconds!,
      numSongsToPlay: room.numSongsToPlay!,
    } as SnapshotRoom;
    return base;
  },
  // removed duplicate definitions (see below consolidated versions)
  startGame(code: string, hostPlayerId: string) {
    const room = rooms.get(code);
    if (!room) throw new Error('ROOM_NOT_FOUND');
    if (room.phase !== 'lobby') throw new Error('INVALID_PHASE');
    if (room.players.size < 3) throw new Error('NOT_ENOUGH_PLAYERS');
    const host = room.players.get(hostPlayerId);
    if (!host || !host.isHost) throw new Error('NOT_HOST');
    room.phase = 'submitting';
  },
  setNumSongs(code: string, hostPlayerId: string, count: number) {
    const room = rooms.get(code);
    if (!room) throw new Error('ROOM_NOT_FOUND');
    const host = room.players.get(hostPlayerId);
    if (!host || !host.isHost) throw new Error('NOT_HOST');
    room.numSongsPerPlayer = Math.max(1, Math.min(10, Math.floor(count)));
    clampNumSongsToPlay(room);
  },
  submitSong(code: string, playerId: string, song: string) {
    const room = rooms.get(code);
    if (!room) throw new Error('ROOM_NOT_FOUND');
    if (room.phase !== 'submitting') throw new Error('INVALID_PHASE');
    if (!room.players.has(playerId)) throw new Error('NOT_IN_ROOM');
    const count = Array.from(room.submissions.values()).filter((s) => s.playerId === playerId).length;
    const limit = room.numSongsPerPlayer || 3;
    if (count >= limit) throw new Error('LIMIT_REACHED');
    const submission: Submission = { id: crypto.randomUUID(), playerId, song };
    room.submissions.set(submission.id, submission);
  },
  setVotingTime(code: string, hostPlayerId: string, seconds: number) {
    const room = rooms.get(code);
    if (!room) throw new Error('ROOM_NOT_FOUND');
    const host = room.players.get(hostPlayerId);
    if (!host || !host.isHost) throw new Error('NOT_HOST');
    room.timePerVotingRoundSeconds = Math.max(0, Math.min(300, Math.floor(seconds)));
  },
  setNumSongsToPlay(code: string, hostPlayerId: string, count: number) {
    const room = rooms.get(code);
    if (!room) throw new Error('ROOM_NOT_FOUND');
    const host = room.players.get(hostPlayerId);
    if (!host || !host.isHost) throw new Error('NOT_HOST');
    room.numSongsToPlay = Math.max(1, Math.min(100, Math.floor(count)));
    clampNumSongsToPlay(room);
  },
};


