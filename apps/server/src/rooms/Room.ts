import {
  GAME_CONSTANTS,
  Player,
  PlayerColor,
  RoomState,
  RoomStatus
} from '@climb/shared';
import { CONFIG } from '../config';

export class Room {
  public readonly code: string;
  public hostId: string;
  private readonly players: Map<string, Player> = new Map();
  public status: RoomStatus = 'LOBBY';
  public seed: number = 0;
  public readonly createdAt: number = Date.now();
  public startedAt?: number;
  public goalHeight: number = CONFIG.DEFAULT_GOAL_HEIGHT;
  public winnerId?: string;

  constructor(code: string, hostPlayerId: string, hostPlayerName: string) {
    this.code = code.toUpperCase();
    this.hostId = hostPlayerId;

    // Add the creator as the first player and host
    const hostPlayer: Player = {
      id: hostPlayerId,
      name: hostPlayerName,
      isHost: true,
      isReady: true, // Host is ready by default
      color: GAME_CONSTANTS.PLAYER_COLORS[0],
      x: 50,
      y: 0,
      score: 0,
      status: 'READY',
      ping: 0
    };

    this.players.set(hostPlayerId, hostPlayer);
  }

  public getPlayerCount(): number {
    return this.players.size;
  }

  public getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  public hasPlayer(playerId: string): boolean {
    return this.players.has(playerId);
  }

  public getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  public addPlayer(
    playerId: string,
    playerName: string
  ): { success: boolean; player?: Player; error?: string } {
    if (this.players.has(playerId)) {
      const existing = this.players.get(playerId)!;
      existing.name = playerName;
      return { success: true, player: existing };
    }

    if (this.players.size >= CONFIG.MAX_PLAYERS) {
      return { success: false, error: 'ROOM_FULL' };
    }

    if (this.status !== 'LOBBY') {
      return { success: false, error: 'GAME_ALREADY_STARTED' };
    }

    const assignedColor = this.getNextAvailableColor();
    const isFirstPlayer = this.players.size === 0;

    if (isFirstPlayer) {
      this.hostId = playerId;
    }

    const newPlayer: Player = {
      id: playerId,
      name: playerName,
      isHost: isFirstPlayer,
      isReady: isFirstPlayer,
      color: assignedColor,
      x: 50 + this.players.size * 70,
      y: 0,
      score: 0,
      status: isFirstPlayer ? 'READY' : 'WAITING',
      ping: 0
    };

    this.players.set(playerId, newPlayer);
    return { success: true, player: newPlayer };
  }

  public removePlayer(playerId: string): {
    wasHost: boolean;
    newHostId?: string;
    isEmpty: boolean;
  } {
    const wasHost = this.hostId === playerId;
    this.players.delete(playerId);

    if (this.players.size === 0) {
      return { wasHost, isEmpty: true };
    }

    let newHostId: string | undefined;
    if (wasHost) {
      const nextPlayer = this.players.values().next().value as Player | undefined;
      if (nextPlayer) {
        nextPlayer.isHost = true;
        nextPlayer.isReady = true;
        this.hostId = nextPlayer.id;
        newHostId = nextPlayer.id;
      }
    }

    return { wasHost, newHostId, isEmpty: false };
  }

  public setPlayerReady(playerId: string, isReady: boolean): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;

    // Host is always ready
    if (player.isHost) {
      player.isReady = true;
      player.status = 'READY';
      return true;
    }

    player.isReady = isReady;
    player.status = isReady ? 'READY' : 'WAITING';
    return true;
  }

  public canStart(requesterId: string): { canStart: boolean; error?: string } {
    if (this.hostId !== requesterId) {
      return { canStart: false, error: 'UNAUTHORIZED_NOT_HOST' };
    }

    if (this.players.size < CONFIG.MIN_PLAYERS) {
      return { canStart: false, error: 'NOT_ENOUGH_PLAYERS' };
    }

    if (this.status !== 'LOBBY') {
      return { canStart: false, error: 'GAME_ALREADY_STARTED' };
    }

    const allReady = Array.from(this.players.values()).every(
      (p) => p.isReady || p.isHost
    );

    if (!allReady) {
      return { canStart: false, error: 'NOT_ALL_PLAYERS_READY' };
    }

    return { canStart: true };
  }

  public startRoom(): {
    seed: number;
    countdownDurationMs: number;
    gameStartTime: number;
    climbGoalHeight: number;
  } {
    this.status = 'STARTING';
    // Generate 32-bit unsigned integer seed for Mulberry32 PRNG
    this.seed = (Math.floor(Math.random() * 0xffffffff) >>> 0);
    this.startedAt = Date.now() + CONFIG.COUNTDOWN_DURATION_MS;

    for (const player of this.players.values()) {
      player.status = 'CLIMBING';
    }

    return {
      seed: this.seed,
      countdownDurationMs: CONFIG.COUNTDOWN_DURATION_MS,
      gameStartTime: this.startedAt,
      climbGoalHeight: this.goalHeight
    };
  }

  public toState(): RoomState {
    return {
      code: this.code,
      hostId: this.hostId,
      players: this.getAllPlayers(),
      maxPlayers: CONFIG.MAX_PLAYERS,
      minPlayers: CONFIG.MIN_PLAYERS,
      status: this.status,
      seed: this.seed,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      goalHeight: this.goalHeight,
      winnerId: this.winnerId
    };
  }

  private getNextAvailableColor(): PlayerColor {
    const usedColors = new Set(Array.from(this.players.values()).map((p) => p.color));
    for (const color of GAME_CONSTANTS.PLAYER_COLORS) {
      if (!usedColors.has(color)) {
        return color;
      }
    }
    return GAME_CONSTANTS.PLAYER_COLORS[0];
  }
}
