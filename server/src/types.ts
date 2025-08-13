export type RoomPhase = 'lobby' | 'submitting' | 'playing' | 'ended';

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
}

export interface Room {
  code: string;
  players: Map<string, Player>;
  phase: RoomPhase;
  numSongsPerPlayer?: number;
  timePerVotingRoundSeconds?: number; // 0 means manual progression
  numSongsToPlay?: number;
  submissions: Map<string, Submission>;
}

export interface SnapshotRoom {
  code: string;
  phase: RoomPhase;
  players: Player[];
  numSongsPerPlayer?: number;
  timePerVotingRoundSeconds?: number;
  numSongsToPlay?: number;
  submissionCounts: Record<string, number>; // playerId -> count
}

export interface Submission {
  id: string;
  playerId: string;
  song: string; // for MVP, a URL or title
}


