import dotenv from 'dotenv';
dotenv.config();

export interface ServerConfig {
  PORT: number;
  CORS_ORIGIN: string | string[];
  ROOM_CODE_LENGTH: number;
  ROOM_CODE_CHARS: string;
  MIN_PLAYERS: number;
  MAX_PLAYERS: number;
  DEFAULT_GOAL_HEIGHT: number;
  COUNTDOWN_DURATION_MS: number;
}

export const CONFIG: ServerConfig = {
  PORT: Number(process.env.PORT) || 3001,
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  ROOM_CODE_LENGTH: 4,
  // 4-character codes omitting visually ambiguous characters (0, O, 1, I)
  ROOM_CODE_CHARS: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 4,
  DEFAULT_GOAL_HEIGHT: 1000,
  COUNTDOWN_DURATION_MS: 3000
};
