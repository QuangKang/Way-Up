import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  ClientToServerEvents,
  ErrorPayload,
  RoomStartBroadcastPayload,
  RoomState,
  ServerToClientEvents
} from '@climb/shared';
import { HapticsService } from '../haptics/hapticsService';

export type ConnectionState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'IN_ROOM'
  | 'MATCH_STARTING';

export interface UseMultiplayerLobbyOptions {
  serverUrl?: string;
  playerId: string;
  playerName: string;
}

export interface UseMultiplayerLobbyResult {
  connectionState: ConnectionState;
  roomState: RoomState | null;
  matchStartPayload: RoomStartBroadcastPayload | null;
  error: string | null;
  joinOrCreateRoom: (roomCode?: string) => void;
  toggleReady: () => void;
  startMatch: () => void;
  leaveRoom: () => void;
  clearError: () => void;
}

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function useMultiplayerLobby({
  serverUrl = 'http://localhost:3001',
  playerId,
  playerName
}: UseMultiplayerLobbyOptions): UseMultiplayerLobbyResult {
  const [connectionState, setConnectionState] = useState<ConnectionState>('DISCONNECTED');
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [matchStartPayload, setMatchStartPayload] = useState<RoomStartBroadcastPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<TypedSocket | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    const socket: TypedSocket = io(serverUrl, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socketRef.current = socket;
    setConnectionState('CONNECTING');

    socket.on('connect', () => {
      setConnectionState('CONNECTED');
    });

    socket.on('disconnect', () => {
      setConnectionState('DISCONNECTED');
      setRoomState(null);
    });

    socket.on('ROOM_JOINED', (payload) => {
      setRoomState(payload.room);
      setConnectionState('IN_ROOM');
      void HapticsService.selection();
    });

    socket.on('ROOM_UPDATED', (payload) => {
      setRoomState(payload.room);
      void HapticsService.selection();
    });

    socket.on('ROOM_START', (payload) => {
      setMatchStartPayload(payload);
      setConnectionState('MATCH_STARTING');
      void HapticsService.warning();
    });

    socket.on('ERROR', (payload: ErrorPayload) => {
      setError(`[${payload.code}] ${payload.message}`);
      void HapticsService.defeat();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [serverUrl]);

  const joinOrCreateRoom = useCallback(
    (roomCode?: string) => {
      if (!socketRef.current || !socketRef.current.connected) {
        setError('Not connected to game server');
        return;
      }
      clearError();
      socketRef.current.emit(
        'JOIN_ROOM',
        {
          playerId,
          playerName,
          roomCode: roomCode?.trim().toUpperCase()
        },
        (response) => {
          if (!response.success && response.error) {
            setError(response.error.message);
          }
        }
      );
    },
    [playerId, playerName, clearError]
  );

  const toggleReady = useCallback(() => {
    if (!socketRef.current || !roomState) return;
    const self = roomState.players.find((p) => p.id === playerId);
    if (!self) return;

    socketRef.current.emit('SET_READY', {
      roomCode: roomState.code,
      playerId,
      isReady: !self.isReady
    });
    void HapticsService.selection();
  }, [roomState, playerId]);

  const startMatch = useCallback(() => {
    if (!socketRef.current || !roomState) return;
    clearError();

    socketRef.current.emit(
      'ROOM_START',
      {
        roomCode: roomState.code,
        playerId
      },
      (response) => {
        if (!response.success && response.error) {
          setError(response.error.message);
        }
      }
    );
  }, [roomState, playerId, clearError]);

  const leaveRoom = useCallback(() => {
    if (!socketRef.current || !roomState) return;

    socketRef.current.emit('LEAVE_ROOM', {
      roomCode: roomState.code,
      playerId
    });

    setRoomState(null);
    setMatchStartPayload(null);
    setConnectionState('CONNECTED');
    void HapticsService.selection();
  }, [roomState, playerId]);

  return {
    connectionState,
    roomState,
    matchStartPayload,
    error,
    joinOrCreateRoom,
    toggleReady,
    startMatch,
    leaveRoom,
    clearError
  };
}
