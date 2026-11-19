import { Server, Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ErrorPayload,
  InterServerEvents,
  JoinRoomPayload,
  LeaveRoomPayload,
  PingPayload,
  RoomStartRequestPayload,
  ServerToClientEvents,
  SetReadyPayload,
  SocketData
} from '@climb/shared';
import { RoomManager } from '../rooms/RoomManager';

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
    // JOIN_ROOM
    // -------------------------------------------------------------
    socket.on('JOIN_ROOM', (payload: JoinRoomPayload, callback) => {
      const { playerId, playerName, roomCode } = payload;

      if (!playerId || !playerName || playerName.trim() === '') {
        const error: ErrorPayload = {
          code: 'INTERNAL_ERROR',
          message: 'Player ID and a non-empty name are required'
        };
        socket.emit('ERROR', error);
        callback?.({ success: false, error });
        return;
      }

      const trimmedName = playerName.trim();
      const result = roomManager.joinOrCreateRoom(playerId, trimmedName, roomCode);

      if (!result.success || !result.room) {
        const errorCode = (result.error as ErrorPayload['code']) || 'INTERNAL_ERROR';
        const error: ErrorPayload = {
          code: errorCode,
          message: `Failed to join room: ${result.error ?? 'Unknown error'}`
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

      // Associate socket session data
      socket.data.playerId = playerId;
      socket.data.playerName = trimmedName;
      socket.data.roomCode = room.code;

      // Join Socket.io room channel
      void socket.join(room.code);

      const joinedResponse = {
        room: room.toState(),
        selfPlayerId: playerId,
        assignedColor: player.color
      };

      // Notify caller
      socket.emit('ROOM_JOINED', joinedResponse);
      callback?.({ success: true, data: joinedResponse });

      // Notify all other members of the room
      socket.to(room.code).emit('ROOM_UPDATED', {
        room: room.toState(),
        changeReason: 'PLAYER_JOINED'
      });
    });

    // -------------------------------------------------------------
    // SET_READY
    // -------------------------------------------------------------
    socket.on('SET_READY', (payload: SetReadyPayload) => {
      const { playerId, roomCode, isReady } = payload;
      const room = roomManager.getRoom(roomCode);

      if (!room) {
        socket.emit('ERROR', {
          code: 'ROOM_NOT_FOUND',
          message: `Room ${roomCode} not found`
        });
        return;
      }

      const updated = room.setPlayerReady(playerId, isReady);
      if (!updated) {
        return;
      }

      io.to(room.code).emit('ROOM_UPDATED', {
        room: room.toState(),
        changeReason: 'READY_CHANGED'
      });
    });

    // -------------------------------------------------------------
    // ROOM_START
    // -------------------------------------------------------------
    socket.on('ROOM_START', (payload: RoomStartRequestPayload, callback) => {
      const { playerId, roomCode } = payload;
      const room = roomManager.getRoom(roomCode);

      if (!room) {
        const error: ErrorPayload = {
          code: 'ROOM_NOT_FOUND',
          message: `Room ${roomCode} not found`
        };
        socket.emit('ERROR', error);
        callback?.({ success: false, error });
        return;
      }

      const check = room.canStart(playerId);
      if (!check.canStart) {
        const errorCode = (check.error as ErrorPayload['code']) || 'INTERNAL_ERROR';
        const error: ErrorPayload = {
          code: errorCode,
          message: `Cannot start match: ${check.error}`
        };
        socket.emit('ERROR', error);
        callback?.({ success: false, error });
        return;
      }

      // Start match and obtain deterministic 32-bit seed
      const startData = room.startRoom();

      const broadcastPayload = {
        roomCode: room.code,
        seed: startData.seed,
        countdownDurationMs: startData.countdownDurationMs,
        gameStartTime: startData.gameStartTime,
        climbGoalHeight: startData.climbGoalHeight
      };

      // Broadcast start to all clients in the room
      io.to(room.code).emit('ROOM_START', broadcastPayload);
      callback?.({ success: true, data: broadcastPayload });
    });

    // -------------------------------------------------------------
    // LEAVE_ROOM
    // -------------------------------------------------------------
    socket.on('LEAVE_ROOM', (payload: LeaveRoomPayload) => {
      const { playerId } = payload;
      handlePlayerLeave(socket, playerId);
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

  function handlePlayerLeave(socket: GameSocket, playerId: string): void {
    const leaveResult = roomManager.leaveCurrentRoom(playerId);
    if (!leaveResult.roomCode) return;

    void socket.leave(leaveResult.roomCode);

    if (leaveResult.roomDeleted) {
      return;
    }

    const room = roomManager.getRoom(leaveResult.roomCode);
    if (room) {
      io.to(leaveResult.roomCode).emit('ROOM_UPDATED', {
        room: room.toState(),
        changeReason: leaveResult.wasHost ? 'HOST_TRANSFERRED' : 'PLAYER_LEFT'
      });
    }
  }
}
