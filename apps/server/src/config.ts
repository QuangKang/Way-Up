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
  MATCH_TIME_LIMIT_MS: number;
  STATE_BROADCAST_INTERVAL_MS: number;
  MAX_STEP_HEIGHT_DELTA: number;
  MAX_HEIGHT_GAIN_PER_SEC: number;
}

export const CONFIG: ServerConfig = {
  PORT: Number(process.env.PORT) || 3001,
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  ROOM_CODE_LENGTH: 4,
  // 4-character codes omitting visually ambiguous characters (0, O, 1, I)
  ROOM_CODE_CHARS: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
  // Allow 1 player for "Solo Test" runs, or 2-4 players for multiplayer
  MIN_PLAYERS: 1,
  MAX_PLAYERS: 4,
  DEFAULT_TARGET_HEIGHT: 500,
  DEFAULT_GOAL_HEIGHT: 500,
  COUNTDOWN_SECONDS: 3,
  COUNTDOWN_DURATION_MS: 3000,
  MATCH_TIME_LIMIT_MS: 120000,
  STATE_BROADCAST_INTERVAL_MS: 50,
  MAX_STEP_HEIGHT_DELTA: 60,
  MAX_HEIGHT_GAIN_PER_SEC: 120
};
