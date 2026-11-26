import dotenv from 'dotenv';
dotenv.config();

export interface ServerConfig {
  PORT: number;
  CORS_ORIGIN: string | string[];
  ROOM_CODE_LENGTH: number;
  ROOM_CODE_CHARS: string;
  MIN_PLAYERS: number;
  MAX_PLAYERS: number;
  DEFAULT_TARGET_HEIGHT: number;
  DEFAULT_GOAL_HEIGHT: number;
  COUNTDOWN_SECONDS: number;
  COUNTDOWN_DURATION_MS: number;
  DEFAULT_TIME_LIMIT_SEC: number;
  MIN_TIME_LIMIT_SEC: number;
  MAX_TIME_LIMIT_SEC: number;
  MATCH_TIME_LIMIT_MS: number;
  STATE_BROADCAST_INTERVAL_MS: number;
  MAX_STEP_HEIGHT_DELTA: number;
  MAX_BURST_HEIGHT_DELTA: number;
  MAX_HEIGHT_GAIN_PER_SEC: number;
}

export const CONFIG: ServerConfig = {
  PORT: Number(process.env.PORT) || 3001,
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  ROOM_CODE_LENGTH: 4,
  // 4-character codes omitting visually ambiguous characters (0, O, 1, I)
  ROOM_CODE_CHARS: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
  // Online multiplayer requires 2-4 players (solo play runs locally in Offline mode)
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 4,
  DEFAULT_TARGET_HEIGHT: 500,
  DEFAULT_GOAL_HEIGHT: 500,
  COUNTDOWN_SECONDS: 3,
  COUNTDOWN_DURATION_MS: 3000,
  DEFAULT_TIME_LIMIT_SEC: 180,
  MIN_TIME_LIMIT_SEC: 60,
  MAX_TIME_LIMIT_SEC: 300,
  MATCH_TIME_LIMIT_MS: 180000,
  STATE_BROADCAST_INTERVAL_MS: 50,
  // Calibrated for fast Left/Right rhythm tapping (~60-80m/s) + Wi-Fi packet jitter
  MAX_STEP_HEIGHT_DELTA: 60,
  MAX_BURST_HEIGHT_DELTA: 80,
  MAX_HEIGHT_GAIN_PER_SEC: 110
};
