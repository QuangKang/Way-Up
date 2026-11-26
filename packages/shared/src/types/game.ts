/**
 * Core game constants and model definitions.
 */

export const GAME_CONSTANTS = {
  MIN_PLAYERS: 1, // Allows 1-player Solo Test or 2-4 player multiplayer
  MULTIPLAYER_MIN_PLAYERS: 2,
  MAX_PLAYERS: 4,
  ROOM_CODE_LENGTH: 4,
  TICK_RATE_HZ: 20,
  STATE_BROADCAST_INTERVAL_MS: 50,
  COUNTDOWN_SECONDS: 3,
  COUNTDOWN_DURATION_MS: 3000,
  DEFAULT_TARGET_HEIGHT: 500,
  DEFAULT_GOAL_HEIGHT: 500,
  MATCH_TIME_LIMIT_MS: 120000,
  MAX_STEP_HEIGHT_DELTA: 60,
  MAX_HEIGHT_GAIN_PER_SEC: 120,
  WORLD_WIDTH: 400,
  PLAYER_COLORS: [
    '#EF4444', // Crimson Red
    '#3B82F6', // Royal Blue
    '#10B981', // Emerald Green
    '#F59E0B'  // Amber Yellow
  ] as const
} as const;

export type PlayerColor = typeof GAME_CONSTANTS.PLAYER_COLORS[number];

export type RoomPhase = 'WAITING' | 'COUNTDOWN' | 'PLAYING' | 'FINISHED';

export type RoomStatus = RoomPhase;

export type PlayerStatus = 'IDLE' | 'CLIMBING' | 'STUNNED' | 'FINISHED';

export type PlayerMoveAction =
  | 'IDLE'
  | 'TAP_LEFT'
  | 'TAP_RIGHT'
  | 'JUMP'
  | 'SPRING'
  | 'STUN';

export type ObstacleType =
  | 'STATIC_LEDGE'
  | 'CRUMBLING_ROCK'
  | 'MOVING_SPIKE'
  | 'GUST_OF_WIND'
  | 'SPRING_PAD';

export interface MatchConfig {
  seed: number;
  targetHeight: number;
  countdownSec: number;
}

export interface Player {
  id: string;
  nickname: string;
  name: string; // Kept synchronized with nickname for compatibility
  isHost: boolean;
  isReady: boolean;
  color: PlayerColor;
  height: number;
  x: number;
  y: number; // Kept synchronized with height
  score: number;
  status: PlayerStatus;
  finishTimeMs: number | null;
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
  phase: RoomPhase;
  status: RoomStatus;
  hostId: string;
  players: Player[];
  maxPlayers: number;
  minPlayers: number;
  config: MatchConfig;
  seed: number;
  targetHeight: number;
  goalHeight: number;
  countdownRemaining: number | null;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  winnerId: string | null;
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
