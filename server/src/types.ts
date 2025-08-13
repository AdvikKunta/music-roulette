export type RoomPhase = 'lobby' | 'playing' | 'ended';

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
}

export interface Room {
  code: string;
  players: Map<string, Player>;
  phase: RoomPhase;
}

export interface SnapshotRoom {
  code: string;
  phase: RoomPhase;
  players: Player[];
}


