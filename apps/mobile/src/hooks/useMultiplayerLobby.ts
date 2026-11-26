import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  ClientToServerEvents,
  ErrorPayload,
  MatchCountdownPayload,
  MatchFinishedPayload,
  MatchStartedPayload,
  MatchStatePayload,
  PlayerMoveAction,
  PlayerStatus,
  RoomStartBroadcastPayload,
  RoomState,
  SanitizedPlayerPosition,
  ServerToClientEvents
} from '@climb/shared';
import { HapticsService } from '../haptics/hapticsService';

export type ConnectionState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'IN_ROOM';

export interface UseMultiplayerLobbyOptions {
  serverUrl?: string;
  playerId: string;
  playerName: string;
}

export interface MoveSubmission {
  x: number;
  height: number;
  action: PlayerMoveAction;
  status?: PlayerStatus;
}

export interface UseMultiplayerLobbyResult {
  connectionState: ConnectionState;
  roomState: RoomState | null;
  countdownSeconds: number | null;
  matchStarted: MatchStartedPayload | null;
  matchStartPayload: RoomStartBroadcastPayload | null;
  livePlayers: SanitizedPlayerPosition[];
  matchResult: MatchFinishedPayload | null;
  error: string | null;
  joinOrCreateRoom: (roomCode?: string, overrideNickname?: string) => void;
  toggleReady: () => void;
  startMatch: () => void;
  sendPlayerMove: (move: MoveSubmission) => void;
  requestRematch: () => void;
  leaveRoom: () => void;
  clearError: () => void;
}

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function useMultiplayerLobby({
  serverUrl = process.env.EXPO_PUBLIC_SERVER_URL ?? 'http://localhost:3001',
  playerId,
  playerName
}: UseMultiplayerLobbyOptions): UseMultiplayerLobbyResult {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>('DISCONNECTED');
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [matchStarted, setMatchStarted] =
    useState<MatchStartedPayload | null>(null);
  const [matchStartPayload, setMatchStartPayload] =
    useState<RoomStartBroadcastPayload | null>(null);
  const [livePlayers, setLivePlayers] = useState<SanitizedPlayerPosition[]>([]);
  const [matchResult, setMatchResult] =
    useState<MatchFinishedPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<TypedSocket | null>(null);
  const sequenceRef = useRef<number>(0);
  const playerIdRef = useRef<string>(playerId);
  const playerNameRef = useRef<string>(playerName);

  useEffect(() => {
    playerIdRef.current = playerId;
  }, [playerId]);

  useEffect(() => {
    playerNameRef.current = playerName;
  }, [playerName]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const syncPlayersFromRoom = useCallback((room: RoomState) => {
    setLivePlayers(
      room.players.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        color: p.color,
        x: p.x,
        height: p.height,
        status: p.status,
        finishTimeMs: p.finishTimeMs
      }))
    );
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
      setCountdownSeconds(null);
      setMatchStarted(null);
      setMatchStartPayload(null);
      setLivePlayers([]);
      setMatchResult(null);
    });

    socket.on('ROOM_JOINED', (payload) => {
      setRoomState(payload.room);
      setCountdownSeconds(payload.room.countdownRemaining);
      setConnectionState('IN_ROOM');
      syncPlayersFromRoom(payload.room);
      void HapticsService.selection();
    });

    socket.on('ROOM_UPDATED', (payload) => {
      setRoomState(payload.room);
      setConnectionState('IN_ROOM');

      if (payload.room.phase === 'WAITING') {
        setCountdownSeconds(null);
        if (payload.changeReason === 'REMATCH_RESET') {
          setMatchStarted(null);
          setMatchStartPayload(null);
          setMatchResult(null);
          sequenceRef.current = 0;
        }
        syncPlayersFromRoom(payload.room);
      } else if (payload.room.phase === 'COUNTDOWN') {
        setCountdownSeconds(payload.room.countdownRemaining);
      }

      if (
        payload.changeReason === 'PLAYER_JOINED' ||
        payload.changeReason === 'READY_CHANGED' ||
        payload.changeReason === 'HOST_TRANSFERRED' ||
        payload.changeReason === 'REMATCH_RESET'
      ) {
        void HapticsService.selection();
      }
    });

    socket.on('match:countdown', (payload: MatchCountdownPayload) => {
      setCountdownSeconds(payload.secondsRemaining);
      setMatchResult(null);
      void HapticsService.warning();
    });

    socket.on('match:started', (payload: MatchStartedPayload) => {
      setCountdownSeconds(null);
      setMatchStarted(payload);
      setRoomState(payload.room);
      syncPlayersFromRoom(payload.room);
      sequenceRef.current = 0;
      void HapticsService.springBoost();
    });

    socket.on('ROOM_START', (payload) => {
      setMatchStartPayload(payload);
    });

    socket.on('match:state', (payload: MatchStatePayload) => {
      setLivePlayers(payload.players);
    });

    socket.on('match:finished', (payload: MatchFinishedPayload) => {
      setCountdownSeconds(null);
      setMatchResult(payload);
      setRoomState(payload.room);
      syncPlayersFromRoom(payload.room);

      if (payload.winnerId === playerIdRef.current) {
        void HapticsService.victory();
      } else {
        void HapticsService.selection();
      }
    });

    socket.on('ERROR', (payload: ErrorPayload) => {
      setError(payload.message);
      void HapticsService.defeat();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [serverUrl, syncPlayersFromRoom]);

  const joinOrCreateRoom = useCallback(
    (roomCode?: string, overrideNickname?: string) => {
      if (!socketRef.current || !socketRef.current.connected) {
        setError('Not connected to game server. Check Wi-Fi and server status.');
        return;
      }
      clearError();

      const activeName = (overrideNickname ?? playerNameRef.current).trim();
      socketRef.current.emit(
        'JOIN_ROOM',
        {
          playerId: playerIdRef.current,
          playerName: activeName,
          nickname: activeName,
          roomCode: roomCode?.trim().toUpperCase()
        },
        (response) => {
          if (!response.success && response.error) {
            setError(response.error.message);
          }
        }
      );
    },
    [clearError]
  );

  const toggleReady = useCallback(() => {
    if (!socketRef.current || !roomState) return;
    const self = roomState.players.find((p) => p.id === playerIdRef.current);
    if (!self) return;

    clearError();
    socketRef.current.emit('player:ready', {
      roomCode: roomState.code,
      playerId: playerIdRef.current,
      isReady: !self.isReady
    });
    void HapticsService.selection();
  }, [roomState, clearError]);

  const startMatch = useCallback(() => {
    if (!socketRef.current || !roomState) return;
    clearError();

    socketRef.current.emit(
      'match:start',
      {
        roomCode: roomState.code,
        playerId: playerIdRef.current,
        targetHeight: roomState.targetHeight
      },
      (response) => {
        if (!response.success && response.error) {
          setError(response.error.message);
        }
      }
    );
  }, [roomState, clearError]);

  const sendPlayerMove = useCallback(
    (move: MoveSubmission) => {
      if (!socketRef.current || !roomState || roomState.phase !== 'PLAYING') {
        return;
      }
      sequenceRef.current += 1;
      socketRef.current.emit('player:move', {
        roomCode: roomState.code,
        playerId: playerIdRef.current,
        x: move.x,
        height: move.height,
        action: move.action,
        status: move.status,
        sequenceNumber: sequenceRef.current,
        clientTimestamp: Date.now()
      });
    },
    [roomState]
  );

  const requestRematch = useCallback(() => {
    if (!socketRef.current || !roomState) return;
    clearError();

    socketRef.current.emit(
      'match:rematch',
      {
        roomCode: roomState.code,
        playerId: playerIdRef.current
      },
      (response) => {
        if (!response.success && response.error) {
          setError(response.error.message);
        }
      }
    );
  }, [roomState, clearError]);

  const leaveRoom = useCallback(() => {
    if (socketRef.current && roomState) {
      socketRef.current.emit('room:leave', {
        roomCode: roomState.code,
        playerId: playerIdRef.current
      });
    }

    setRoomState(null);
    setCountdownSeconds(null);
    setMatchStarted(null);
    setMatchStartPayload(null);
    setLivePlayers([]);
    setMatchResult(null);
    if (socketRef.current?.connected) {
      setConnectionState('CONNECTED');
    }
    void HapticsService.selection();
  }, [roomState]);

  return {
    connectionState,
    roomState,
    countdownSeconds,
    matchStarted,
    matchStartPayload,
    livePlayers,
    matchResult,
    error,
    joinOrCreateRoom,
    toggleReady,
    startMatch,
    sendPlayerMove,
    requestRematch,
    leaveRoom,
    clearError
  };
}
