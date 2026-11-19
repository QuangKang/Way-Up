/**
 * Core game constants and model definitions.
 */

export const GAME_CONSTANTS = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 4,
  ROOM_CODE_LENGTH: 4,
  TICK_RATE_HZ: 30,
  COUNTDOWN_DURATION_MS: 3000,
  DEFAULT_GOAL_HEIGHT: 1000,
  WORLD_WIDTH: 400,
  PLAYER_COLORS: [
    '#EF4444', // Crimson Red
    '#3B82F6', // Royal Blue
    '#10B981', // Emerald Green
    '#F59E0B'  // Amber Yellow
  ] as const
} as const;

export type PlayerColor = typeof GAME_CONSTANTS.PLAYER_COLORS[number];

export type RoomStatus = 'LOBBY' | 'STARTING' | 'PLAYING' | 'GAME_OVER';

export type PlayerStatus = 'WAITING' | 'READY' | 'CLIMBING' | 'FALLEN' | 'FINISHED';

export type ObstacleType =
  | 'STATIC_LEDGE'
  | 'CRUMBLING_ROCK'
  | 'MOVING_SPIKE'
  | 'GUST_OF_WIND'
  | 'SPRING_PAD';

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isReady: boolean;
  color: PlayerColor;
  x: number;
  y: number;
  score: number;
  status: PlayerStatus;
  ping: number;
}

export interface Obstacle {
  id: string;
  type: ObstacleType;
  x: number;
  y: number;
  width: number;
  height: number;
  speed?: number;
  minX?: number;
  maxX?: number;
  breakDelayMs?: number;
  boostMultiplier?: number;
}

export interface RoomState {
  code: string;
  hostId: string;
  players: Player[];
  maxPlayers: number;
  minPlayers: number;
  status: RoomStatus;
  seed: number;
  createdAt: number;
  startedAt?: number;
  goalHeight: number;
  winnerId?: string;
}

export interface DeviceIdentity {
  id: string;
  guestUuid: string;
  nickname: string;
  createdAt: number;
  lastActiveAt: number;
}

export interface LocalRecord {
  id: string;
  playerId: string;
  score: number;
  height: number;
  seed: number;
  durationMs: number;
  recordedAt: number;
  syncStatus: 'PENDING' | 'SYNCED';
}
