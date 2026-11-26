import {
  MatchConfig,
  PlayerColor,
  PlayerMoveAction,
  PlayerStatus,
  RoomState
} from './game';

/**
 * WebSocket Payload Contracts
 */

export interface JoinRoomPayload {
  roomCode?: string; // If omitted, the server generates a new 4-character room
  playerName: string;
  nickname?: string;
  playerId: string; // Device/Guest UUID
}

export interface RoomLeavePayload {
  roomCode: string;
  playerId: string;
}

export type LeaveRoomPayload = RoomLeavePayload;

export interface PlayerReadyPayload {
  roomCode: string;
  playerId: string;
  isReady?: boolean; // If omitted, toggles current ready state
}

export interface SetReadyPayload {
  roomCode: string;
  playerId: string;
  isReady: boolean;
}

export interface MatchStartPayload {
  roomCode: string;
  playerId: string; // Must be the room host
  targetHeight?: number;
}

export type RoomStartRequestPayload = MatchStartPayload;

export interface MatchCountdownPayload {
  roomCode: string;
  secondsRemaining: number; // 3, 2, 1
  seed: number;
  targetHeight: number;
}

export interface MatchStartedPayload {
  roomCode: string;
  seed: number;
  targetHeight: number;
  startTimestamp: number;
  config: MatchConfig;
  room: RoomState;
}

export interface PlayerMovePayload {
  roomCode: string;
  playerId: string;
  x: number;
  height: number;
  action: PlayerMoveAction;
  status?: PlayerStatus;
  sequenceNumber?: number;
  clientTimestamp: number;
}

export interface SanitizedPlayerPosition {
  id: string;
  nickname: string;
  color: PlayerColor;
  x: number;
  height: number;
  status: PlayerStatus;
  finishTimeMs: number | null;
}

export interface MatchStatePayload {
  roomCode: string;
  serverTimestamp: number;
  elapsedMs: number;
  players: SanitizedPlayerPosition[];
}

export interface MatchRankingEntry {
  rank: number;
  playerId: string;
  nickname: string;
  color: PlayerColor;
  height: number;
  score: number;
  status: PlayerStatus;
  finishTimeMs: number | null;
}

export type MatchFinishReason = 'TARGET_REACHED' | 'ALL_FINISHED' | 'TIME_LIMIT';

export interface MatchFinishedPayload {
  roomCode: string;
  winnerId: string | null;
  seed: number;
  targetHeight: number;
  durationMs: number;
  reason: MatchFinishReason;
  rankings: MatchRankingEntry[];
  room: RoomState;
}

export interface MatchRematchPayload {
  roomCode: string;
  playerId: string;
}

export interface PlayerInputPayload {
  roomCode: string;
  playerId: string;
  action: 'JUMP' | 'MOVE_LEFT' | 'MOVE_RIGHT' | 'STOP';
  x: number;
  y: number;
  timestamp: number;
  sequenceNumber: number;
}

export interface PingPayload {
  clientTimestamp: number;
}

export interface RoomJoinedPayload {
  room: RoomState;
  selfPlayerId: string;
  assignedColor: PlayerColor;
}

export type RoomUpdateReason =
  | 'PLAYER_JOINED'
  | 'PLAYER_LEFT'
  | 'READY_CHANGED'
  | 'HOST_TRANSFERRED'
  | 'COUNTDOWN_STARTED'
  | 'COUNTDOWN_TICK'
  | 'COUNTDOWN_ABORTED'
  | 'MATCH_STARTED'
  | 'MATCH_FINISHED'
  | 'REMATCH_RESET'
  | 'NICKNAME_UPDATED';

export interface RoomUpdatedPayload {
  room: RoomState;
  changeReason: RoomUpdateReason;
}

export interface RoomStartBroadcastPayload {
  roomCode: string;
  seed: number; // 32-bit unsigned integer for deterministic PRNG
  countdownDurationMs: number;
  gameStartTime: number;
  climbGoalHeight: number;
}

export interface GameTickPayload {
  tick: number;
  timestamp: number;
  players: Array<{
    id: string;
    x: number;
    y: number;
    score: number;
    status: PlayerStatus;
  }>;
}

export interface PlayerScoreSummary {
  playerId: string;
  playerName: string;
  score: number;
  height: number;
  rank: number;
}

export interface GameOverPayload {
  roomCode: string;
  winnerId?: string;
  finalScores: PlayerScoreSummary[];
  seed: number;
  durationMs: number;
}

export interface ErrorPayload {
  code:
    | 'ROOM_NOT_FOUND'
    | 'ROOM_FULL'
    | 'GAME_ALREADY_STARTED'
    | 'NOT_ENOUGH_PLAYERS'
    | 'NOT_ALL_PLAYERS_READY'
    | 'UNAUTHORIZED_NOT_HOST'
    | 'INVALID_ROOM_CODE'
    | 'INVALID_ROOM_PHASE'
    | 'INVALID_MOVE'
    | 'INTERNAL_ERROR';
  message: string;
}

export interface PongPayload {
  clientTimestamp: number;
  serverTimestamp: number;
}

export interface SocketResponse<T> {
  success: boolean;
  data?: T;
  error?: ErrorPayload;
}

/**
 * Socket.IO Typed Event Interfaces
 */
export interface ClientToServerEvents {
  JOIN_ROOM: (
    payload: JoinRoomPayload,
    callback?: (response: SocketResponse<RoomJoinedPayload>) => void
  ) => void;
  LEAVE_ROOM: (payload: LeaveRoomPayload) => void;
  SET_READY: (payload: SetReadyPayload) => void;
  ROOM_START: (
    payload: RoomStartRequestPayload,
    callback?: (response: SocketResponse<RoomStartBroadcastPayload>) => void
  ) => void;
  PLAYER_INPUT: (payload: PlayerInputPayload) => void;
  PING: (payload: PingPayload) => void;

  // Waiting Room & Authoritative Match Lifecycle Events
  'player:ready': (
    payload: PlayerReadyPayload,
    callback?: (response: SocketResponse<RoomState>) => void
  ) => void;
  'room:leave': (payload: RoomLeavePayload) => void;
  'match:start': (
    payload: MatchStartPayload,
    callback?: (response: SocketResponse<MatchCountdownPayload>) => void
  ) => void;
  'player:move': (payload: PlayerMovePayload) => void;
  'match:rematch': (
    payload: MatchRematchPayload,
    callback?: (response: SocketResponse<RoomState>) => void
  ) => void;
}

export interface ServerToClientEvents {
  ROOM_JOINED: (payload: RoomJoinedPayload) => void;
  ROOM_UPDATED: (payload: RoomUpdatedPayload) => void;
  ROOM_START: (payload: RoomStartBroadcastPayload) => void;
  GAME_TICK: (payload: GameTickPayload) => void;
  GAME_OVER: (payload: GameOverPayload) => void;
  ERROR: (payload: ErrorPayload) => void;
  PONG: (payload: PongPayload) => void;

  // Waiting Room & Authoritative Match Lifecycle Events
  'match:countdown': (payload: MatchCountdownPayload) => void;
  'match:started': (payload: MatchStartedPayload) => void;
  'match:state': (payload: MatchStatePayload) => void;
  'match:finished': (payload: MatchFinishedPayload) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  playerId?: string;
  roomCode?: string;
  playerName?: string;
}
