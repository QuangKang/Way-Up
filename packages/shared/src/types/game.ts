/**
 * Core game constants and model definitions for Way Up!
 */

export const CLIMBER_COLORS = [
  '#EF4444', // Summit Red
  '#38BDF8', // Glacier Blue
  '#10B981', // Alpine Emerald
  '#F59E0B', // Sunburst Gold
  '#A855F7', // Violet Peak
  '#F97316', // Ember Orange
  '#EC4899'  // Rose Quartz
] as const;

export type ClimberColor = (typeof CLIMBER_COLORS)[number];

export type PlayerColor = string;

export function isValidClimberColor(color: string): color is ClimberColor {
  return (CLIMBER_COLORS as readonly string[]).includes(color);
}

export const TIME_LIMIT_PRESETS = [60, 120, 180, 300] as const;

export type TimeLimitPreset = (typeof TIME_LIMIT_PRESETS)[number];

export type BotDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface MatchSettings {
  enableBoulders: boolean;
  enableIce: boolean;
  timeLimitSec: number; // Clamped 60..300 (1m .. 5m max)
}

export const DEFAULT_MATCH_SETTINGS: MatchSettings = {
  enableBoulders: true,
  enableIce: true,
  timeLimitSec: 180
};

export function sanitizeMatchSettings(
  partial?: Partial<MatchSettings>,
  base: MatchSettings = DEFAULT_MATCH_SETTINGS
): MatchSettings {
  const enableBoulders =
    typeof partial?.enableBoulders === 'boolean'
      ? partial.enableBoulders
      : base.enableBoulders;
  const enableIce =
    typeof partial?.enableIce === 'boolean' ? partial.enableIce : base.enableIce;
  const rawTime =
    typeof partial?.timeLimitSec === 'number' &&
    Number.isFinite(partial.timeLimitSec)
      ? Math.round(partial.timeLimitSec)
      : base.timeLimitSec;
  const timeLimitSec = Math.max(60, Math.min(300, rawTime));

  return {
    enableBoulders,
    enableIce,
    timeLimitSec
  };
}

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
  DEFAULT_TIME_LIMIT_SEC: 180,
  MIN_TIME_LIMIT_SEC: 60,
  MAX_TIME_LIMIT_SEC: 300,
  MATCH_TIME_LIMIT_MS: 180000,
  MAX_STEP_HEIGHT_DELTA: 60,
  MAX_BURST_HEIGHT_DELTA: 80,
  MAX_HEIGHT_GAIN_PER_SEC: 110,
  WORLD_WIDTH: 400,
  PLAYER_COLORS: CLIMBER_COLORS
} as const;

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
  settings: MatchSettings;
}

export interface Player {
  id: string;
  nickname: string;
  name: string; // Kept synchronized with nickname for compatibility
  isHost: boolean;
  isReady: boolean;
  color: string;
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
  settings: MatchSettings;
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
