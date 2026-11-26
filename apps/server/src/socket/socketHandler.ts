import { Server, Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ErrorPayload,
  InterServerEvents,
  JoinRoomPayload,
  LeaveRoomPayload,
  MatchFinishReason,
  MatchRematchPayload,
  MatchStartPayload,
  PingPayload,
  PlayerInputPayload,
  PlayerMovePayload,
  PlayerReadyPayload,
  RoomLeavePayload,
  RoomStartRequestPayload,
  SelectPlayerColorPayload,
  ServerToClientEvents,
  SetReadyPayload,
  SocketData,
  UpdateRoomSettingsPayload
} from '@climb/shared';
import { Room } from '../rooms/Room';
import { RoomManager } from '../rooms/RoomManager';
import { CONFIG } from '../config';

export type GameSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type GameServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export function registerSocketHandlers(io: GameServer): void {
  const roomManager = RoomManager.getInstance();

  io.on('connection', (socket: GameSocket) => {
    // -------------------------------------------------------------
    // JOIN_ROOM (Creates 4-char room when roomCode omitted, or joins)
    // -------------------------------------------------------------
    socket.on('JOIN_ROOM', (payload: JoinRoomPayload, callback) => {
      const { playerId, roomCode, preferredColor } = payload;
      const rawName = payload.nickname ?? payload.playerName;

      if (!playerId || !rawName || rawName.trim() === '') {
        const error: ErrorPayload = {
          code: 'INTERNAL_ERROR',
          message: 'Player ID and a non-empty nickname are required'
        };
        socket.emit('ERROR', error);
        callback?.({ success: false, error });
        return;
      }

      const previousRoomCode = socket.data.roomCode;
      if (
        previousRoomCode &&
        (!roomCode || previousRoomCode !== roomCode.trim().toUpperCase())
      ) {
        handlePlayerLeave(socket, playerId);
      }

      const trimmedName = rawName.trim().slice(0, 24);
      const result = roomManager.joinOrCreateRoom(
        playerId,
        trimmedName,
        roomCode,
        preferredColor
      );

      if (!result.success || !result.room) {
        const errorCode =
          (result.error as ErrorPayload['code']) || 'INTERNAL_ERROR';
        const error: ErrorPayload = {
          code: errorCode,
          message: formatErrorMessage(errorCode)
        };
        socket.emit('ERROR', error);
        callback?.({ success: false, error });
        return;
      }

      const room = result.room;
      const player = room.getPlayer(playerId);
      if (!player) {
        const error: ErrorPayload = {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve joined player state'
        };
        socket.emit('ERROR', error);
        callback?.({ success: false, error });
        return;
      }

      socket.data.playerId = playerId;
      socket.data.playerName = trimmedName;
      socket.data.roomCode = room.code;

      void socket.join(room.code);

      const snapshot = room.toState();
      const joinedResponse = {
        room: snapshot,
        selfPlayerId: playerId,
        assignedColor: player.color
      };

      socket.emit('ROOM_JOINED', joinedResponse);
      callback?.({ success: true, data: joinedResponse });

      io.to(room.code).emit('ROOM_UPDATED', {
        room: snapshot,
        changeReason: 'PLAYER_JOINED'
      });
    });

    // -------------------------------------------------------------
    // player:select_color (Server-Enforced Unique Climber Color)
    // -------------------------------------------------------------
    socket.on(
      'player:select_color',
      (payload: SelectPlayerColorPayload, callback) => {
        const room = roomManager.getRoom(payload.roomCode);
        if (!room) {
          const error: ErrorPayload = {
            code: 'ROOM_NOT_FOUND',
            message: formatErrorMessage('ROOM_NOT_FOUND')
          };
          socket.emit('ERROR', error);
          callback?.({ success: false, error });
          return;
        }

        const result = room.selectPlayerColor(payload.playerId, payload.color);
        if (!result.success) {
          const errorCode = result.error ?? 'INTERNAL_ERROR';
          const error: ErrorPayload = {
            code: errorCode,
            message: formatErrorMessage(errorCode)
          };
          socket.emit('ERROR', error);
          callback?.({ success: false, error });
          return;
        }

        const snapshot = room.toState();
        io.to(room.code).emit('ROOM_UPDATED', {
          room: snapshot,
          changeReason: 'COLOR_CHANGED'
        });
        callback?.({ success: true, data: snapshot });
      }
    );

    // -------------------------------------------------------------
    // room:update_settings (Host Pre-Game Match Customization)
    // -------------------------------------------------------------
    socket.on(
      'room:update_settings',
      (payload: UpdateRoomSettingsPayload, callback) => {
        const room = roomManager.getRoom(payload.roomCode);
        if (!room) {
          const error: ErrorPayload = {
            code: 'ROOM_NOT_FOUND',
            message: formatErrorMessage('ROOM_NOT_FOUND')
          };
          socket.emit('ERROR', error);
          callback?.({ success: false, error });
          return;
        }

        const result = room.updateSettings(payload.playerId, payload.settings);
        if (!result.success) {
          const errorCode = result.error ?? 'INTERNAL_ERROR';
          const error: ErrorPayload = {
            code: errorCode,
            message: formatErrorMessage(errorCode)
          };
          socket.emit('ERROR', error);
          callback?.({ success: false, error });
          return;
        }

        const snapshot = room.toState();
        io.to(room.code).emit('ROOM_UPDATED', {
          room: snapshot,
          changeReason: 'SETTINGS_UPDATED'
        });
        callback?.({ success: true, data: snapshot });
      }
    );

    // -------------------------------------------------------------
    // player:ready & SET_READY
    // -------------------------------------------------------------
    socket.on('player:ready', (payload: PlayerReadyPayload, callback) => {
      const room = roomManager.getRoom(payload.roomCode);
      if (!room) {
        const error: ErrorPayload = {
          code: 'ROOM_NOT_FOUND',
          message: `Room ${payload.roomCode} not found`
        };
        socket.emit('ERROR', error);
        callback?.({ success: false, error });
        return;
      }

      const updated = room.setPlayerReady(payload.playerId, payload.isReady);
      if (!updated) {
        const error: ErrorPayload = {
          code: 'INVALID_ROOM_PHASE',
          message: 'Ready state can only be changed while waiting in the lobby'
        };
        socket.emit('ERROR', error);
        callback?.({ success: false, error });
        return;
      }

      const snapshot = room.toState();
      io.to(room.code).emit('ROOM_UPDATED', {
        room: snapshot,
        changeReason: 'READY_CHANGED'
      });
      callback?.({ success: true, data: snapshot });
    });

    socket.on('SET_READY', (payload: SetReadyPayload) => {
      const room = roomManager.getRoom(payload.roomCode);
      if (!room) {
        socket.emit('ERROR', {
          code: 'ROOM_NOT_FOUND',
          message: `Room ${payload.roomCode} not found`
        });
        return;
      }

      if (room.setPlayerReady(payload.playerId, payload.isReady)) {
        io.to(room.code).emit('ROOM_UPDATED', {
          room: room.toState(),
          changeReason: 'READY_CHANGED'
        });
      }
    });

    // -------------------------------------------------------------
    // match:start & ROOM_START
    // -------------------------------------------------------------
    socket.on('match:start', (payload: MatchStartPayload, callback) => {
      const result = initiateRoomCountdown(
        payload.roomCode,
        payload.playerId,
        payload.targetHeight
      );
      if (!result.success) {
        socket.emit('ERROR', result.error!);
        callback?.({ success: false, error: result.error });
        return;
      }

      callback?.({ success: true, data: result.countdownPayload });
    });

    socket.on('ROOM_START', (payload: RoomStartRequestPayload, callback) => {
      const result = initiateRoomCountdown(
        payload.roomCode,
        payload.playerId,
        payload.targetHeight
      );
      if (!result.success || !result.countdownPayload) {
        const error = result.error ?? {
          code: 'INTERNAL_ERROR',
          message: 'Failed to start room'
        };
        socket.emit('ERROR', error);
        callback?.({ success: false, error });
        return;
      }

      callback?.({
        success: true,
        data: {
          roomCode: result.countdownPayload.roomCode,
          seed: result.countdownPayload.seed,
          countdownDurationMs: CONFIG.COUNTDOWN_DURATION_MS,
          gameStartTime: Date.now() + CONFIG.COUNTDOWN_DURATION_MS,
          climbGoalHeight: result.countdownPayload.targetHeight
        }
      });
    });

    // -------------------------------------------------------------
    // player:move & PLAYER_INPUT (Server-Authoritative Validation)
    // -------------------------------------------------------------
    socket.on('player:move', (payload: PlayerMovePayload) => {
      handleAuthoritativeMove(payload);
    });

    socket.on('PLAYER_INPUT', (payload: PlayerInputPayload) => {
      handleAuthoritativeMove({
        roomCode: payload.roomCode,
        playerId: payload.playerId,
        x: payload.x,
        height: payload.y,
        action: payload.action === 'JUMP' ? 'JUMP' : 'IDLE',
        sequenceNumber: payload.sequenceNumber,
        clientTimestamp: payload.timestamp
      });
    });

    // -------------------------------------------------------------
    // match:rematch
    // -------------------------------------------------------------
    socket.on('match:rematch', (payload: MatchRematchPayload, callback) => {
      const room = roomManager.getRoom(payload.roomCode);
      if (!room) {
        const error: ErrorPayload = {
          code: 'ROOM_NOT_FOUND',
          message: `Room ${payload.roomCode} not found`
        };
        socket.emit('ERROR', error);
        callback?.({ success: false, error });
        return;
      }

      if (!room.hasPlayer(payload.playerId)) {
        const error: ErrorPayload = {
          code: 'UNAUTHORIZED_NOT_HOST',
          message: 'Player is not a member of this room'
        };
        socket.emit('ERROR', error);
        callback?.({ success: false, error });
        return;
      }

      if (room.phase !== 'FINISHED') {
        const error: ErrorPayload = {
          code: 'INVALID_ROOM_PHASE',
          message: 'Rematch is only available after the match has finished'
        };
        socket.emit('ERROR', error);
        callback?.({ success: false, error });
        return;
      }

      const snapshot = room.resetForRematch();
      io.to(room.code).emit('ROOM_UPDATED', {
        room: snapshot,
        changeReason: 'REMATCH_RESET'
      });
      callback?.({ success: true, data: snapshot });
    });

    // -------------------------------------------------------------
    // room:leave & LEAVE_ROOM
    // -------------------------------------------------------------
    socket.on('room:leave', (payload: RoomLeavePayload) => {
      handlePlayerLeave(socket, payload.playerId);
    });

    socket.on('LEAVE_ROOM', (payload: LeaveRoomPayload) => {
      handlePlayerLeave(socket, payload.playerId);
    });

    // -------------------------------------------------------------
    // PING
    // -------------------------------------------------------------
    socket.on('PING', (payload: PingPayload) => {
      socket.emit('PONG', {
        clientTimestamp: payload.clientTimestamp,
        serverTimestamp: Date.now()
      });
    });

    // -------------------------------------------------------------
    // Disconnect Handler
    // -------------------------------------------------------------
    socket.on('disconnect', () => {
      const playerId = socket.data.playerId;
      if (playerId) {
        handlePlayerLeave(socket, playerId);
      }
    });
  });

  function initiateRoomCountdown(
    roomCode: string,
    playerId: string,
    targetHeight?: number
  ) {
    const room = roomManager.getRoom(roomCode);
    if (!room) {
      const error: ErrorPayload = {
        code: 'ROOM_NOT_FOUND',
        message: `Room ${roomCode} not found`
      };
      return { success: false as const, error };
    }

    const check = room.canStart(playerId);
    if (!check.canStart) {
      const errorCode =
        (check.error as ErrorPayload['code']) || 'INTERNAL_ERROR';
      const error: ErrorPayload = {
        code: errorCode,
        message: formatErrorMessage(errorCode)
      };
      return { success: false as const, error };
    }

    const countdownPayload = room.beginCountdown(
      {
        onTick: (tickPayload) => {
          io.to(room.code).emit('match:countdown', tickPayload);
          io.to(room.code).emit('ROOM_UPDATED', {
            room: room.toState(),
            changeReason:
              tickPayload.secondsRemaining === CONFIG.COUNTDOWN_SECONDS
                ? 'COUNTDOWN_STARTED'
                : 'COUNTDOWN_TICK'
          });
        },
        onStarted: (startedPayload) => {
          io.to(room.code).emit('match:started', startedPayload);
          io.to(room.code).emit('ROOM_START', {
            roomCode: startedPayload.roomCode,
            seed: startedPayload.seed,
            countdownDurationMs: 0,
            gameStartTime: startedPayload.startTimestamp,
            climbGoalHeight: startedPayload.targetHeight
          });
          io.to(room.code).emit('ROOM_UPDATED', {
            room: startedPayload.room,
            changeReason: 'MATCH_STARTED'
          });
          io.to(room.code).emit('match:state', room.toMatchState());
        },
        onTimeLimit: () => {
          concludeRoomMatch(room, 'TIME_LIMIT');
        }
      },
      targetHeight
    );

    return { success: true as const, countdownPayload };
  }

  function handleAuthoritativeMove(payload: PlayerMovePayload): void {
    const room = roomManager.getRoom(payload.roomCode);
    if (!room || room.phase !== 'PLAYING') {
      return;
    }

    const moveResult = room.applyPlayerMove(payload);
    if (!moveResult.accepted) {
      return;
    }

    // Only end the match once ALL active climbers reach 500m (or when timeLimitSec hits 0)
    if (moveResult.allFinished) {
      concludeRoomMatch(room, 'ALL_FINISHED');
      return;
    }

    // When an individual climber reaches 500m first, broadcast immediately so rivals see them at the summit
    if (moveResult.reachedTarget) {
      io.to(room.code).emit('match:state', room.toMatchState());
      io.to(room.code).emit('ROOM_UPDATED', {
        room: room.toState(),
        changeReason: 'PLAYER_FINISHED'
      });
      return;
    }

    room.scheduleStateBroadcast((statePayload) => {
      io.to(room.code).emit('match:state', statePayload);
    });
  }

  function concludeRoomMatch(room: Room, reason: MatchFinishReason): void {
    if (room.phase !== 'PLAYING') return;

    const finalState = room.toMatchState();
    const finishedPayload = room.finishMatch(reason);

    io.to(room.code).emit('match:state', finalState);
    io.to(room.code).emit('match:finished', finishedPayload);
    io.to(room.code).emit('ROOM_UPDATED', {
      room: finishedPayload.room,
      changeReason: 'MATCH_FINISHED'
    });
  }

  function handlePlayerLeave(socket: GameSocket, playerId: string): void {
    const leaveResult = roomManager.leaveCurrentRoom(playerId);
    if (!leaveResult.roomCode) return;

    void socket.leave(leaveResult.roomCode);
    if (socket.data.roomCode === leaveResult.roomCode) {
      socket.data.roomCode = undefined;
    }

    if (leaveResult.roomDeleted) {
      return;
    }

    const room = roomManager.getRoom(leaveResult.roomCode);
    if (!room) return;

    if (leaveResult.shouldFinishMatch) {
      concludeRoomMatch(room, 'ALL_FINISHED');
      return;
    }

    const reason = leaveResult.countdownAborted
      ? 'COUNTDOWN_ABORTED'
      : leaveResult.wasHost
      ? 'HOST_TRANSFERRED'
      : 'PLAYER_LEFT';

    io.to(leaveResult.roomCode).emit('ROOM_UPDATED', {
      room: room.toState(),
      changeReason: reason
    });
  }
}

function formatErrorMessage(code: ErrorPayload['code']): string {
  switch (code) {
    case 'ROOM_NOT_FOUND':
      return 'Room code not found. Double-check the 4-character code.';
    case 'ROOM_FULL':
      return 'This room is already full (4/4 climbers).';
    case 'GAME_ALREADY_STARTED':
      return 'Match is already in progress for this room.';
    case 'NOT_ENOUGH_PLAYERS':
      return 'At least 2 climbers are required to start an online match.';
    case 'NOT_ALL_PLAYERS_READY':
      return 'All joined players must be Ready before starting.';
    case 'UNAUTHORIZED_NOT_HOST':
      return 'Only the room Host can perform this action.';
    case 'COLOR_ALREADY_TAKEN':
      return 'That climber color is already taken by another player.';
    case 'INVALID_COLOR':
      return 'Invalid climber color selection.';
    case 'INVALID_ROOM_CODE':
      return 'Room code must be 4 characters.';
    default:
      return `Action failed (${code})`;
  }
}
