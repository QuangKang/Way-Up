import { Obstacle, Player, PlayerColor, PlayerStatus, RoomState } from './game';

/**
 * WebSocket Payload Contracts
 */

export interface JoinRoomPayload {
  roomCode?: string; // If omitted, the server generates a new 4-character room
  playerName: string;
  playerId: string; // Device/Guest UUID
}

export interface LeaveRoomPayload {
  roomCode: string;
  playerId: string;
}

export interface SetReadyPayload {
  roomCode: string;
  playerId: string;
  isReady: boolean;
}

export interface RoomStartRequestPayload {
  roomCode: string;
  playerId: string; // Must be the room host
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

export interface RoomUpdatedPayload {
  room: RoomState;
  changeReason: 'PLAYER_JOINED' | 'PLAYER_LEFT' | 'READY_CHANGED' | 'HOST_TRANSFERRED';
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
}

export interface ServerToClientEvents {
  ROOM_JOINED: (payload: RoomJoinedPayload) => void;
  ROOM_UPDATED: (payload: RoomUpdatedPayload) => void;
  ROOM_START: (payload: RoomStartBroadcastPayload) => void;
  GAME_TICK: (payload: GameTickPayload) => void;
  GAME_OVER: (payload: GameOverPayload) => void;
  ERROR: (payload: ErrorPayload) => void;
  PONG: (payload: PongPayload) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  playerId?: string;
  roomCode?: string;
  playerName?: string;
}
