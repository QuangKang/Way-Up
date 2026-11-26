/**
 * Core game constants and model definitions for Way Up!
 */

export const GAME_CONSTANTS = {
  MIN_PLAYERS: 2, // Online matches require at least 2 climbers (Offline mode handles solo + bots)
  MULTIPLAYER_MIN_PLAYERS: 2,
  MAX_PLAYERS: 4,
  ROOM_CODE_LENGTH: 4,
  TICK_RATE_HZ: 20,
  STATE_BROADCAST_INTERVAL_MS: 50,
  COUNTDOWN_SECONDS: 3,
  COUNTDOWN_DURATION_MS: 3000,
  DEFAULT_TARGET_HEIGHT: 500,
  DEFAULT_GOAL_HEIGHT: 500,
  STEP_HEIGHT_METERS: 10,
  LEFT_LANE_X: 0.25,
  RIGHT_LANE_X: 0.75,
  FOOTHILLS_MAX_HEIGHT: 150,
  CLIFFS_MAX_HEIGHT: 350,
  SLIP_LIMIT_MS: 750,
  MATCH_TIME_LIMIT_MS: 120000,
  MAX_STEP_HEIGHT_DELTA: 60,
  MAX_BURST_HEIGHT_DELTA: 80,
  MAX_HEIGHT_GAIN_PER_SEC: 110,
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

export type TapDirection = 'LEFT' | 'RIGHT';

export type MountainBiome = 'FOOTHILLS' | 'CLIFFS' | 'SUMMIT';

export type HazardPhase = 'SAFE' | 'WARNING' | 'ACTIVE';

export type PlayerMoveAction =
  | 'IDLE'
  | 'TAP_LEFT'
  | 'TAP_RIGHT'
  | 'FALL'
  | 'JUMP'
  | 'STUN';

export type ObstacleType =
  | 'STATIC_LEDGE'
  | 'SLIPPERY_LEDGE'
  | 'FALLING_ROCK'
  | 'GUST_OF_WIND';

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

export interface ClimbStep {
  id: string;
  index: number;
  height: number; // index * 10 (0m .. targetHeight)
  y: number; // Synchronized with height
  requiredTap: TapDirection;
  x: number; // Strict 2-lane normalized position: 0.25 (LEFT) or 0.75 (RIGHT), 0.50 at base step 0
  type: ObstacleType;
  biome: MountainBiome;
  slipDurationMs?: number; // ~750ms grip timer for SLIPPERY_LEDGE
  cycleMs?: number;
  phaseOffsetMs?: number;
  warningDurationMs?: number;
  activeDurationMs?: number;
  windDirection?: TapDirection;
}

export type Obstacle = ClimbStep;

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
