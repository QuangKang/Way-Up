import { Room } from './Room';
import { CONFIG } from '../config';

export class RoomManager {
  private static instance: RoomManager | null = null;
  private readonly rooms: Map<string, Room> = new Map();
  private readonly playerRoomIndex: Map<string, string> = new Map();

  private constructor() {}

  public static getInstance(): RoomManager {
    if (!RoomManager.instance) {
      RoomManager.instance = new RoomManager();
    }
    return RoomManager.instance;
  }

  /**
   * Generates a unique 4-character uppercase alphanumeric room code.
   */
  public generateRoomCode(): string {
    const chars = CONFIG.ROOM_CODE_CHARS;
    const len = CONFIG.ROOM_CODE_LENGTH;
    let code: string;
    let attempts = 0;

    do {
      code = '';
      for (let i = 0; i < len; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        code += chars[randomIndex];
      }
      attempts++;
      if (attempts > 1000) {
        throw new Error('Room code space saturated');
      }
    } while (this.rooms.has(code));

    return code;
  }

  public createRoom(hostPlayerId: string, hostPlayerName: string): Room {
    // If the host is in an existing room, leave it first
    this.leaveCurrentRoom(hostPlayerId);

    const code = this.generateRoomCode();
    const room = new Room(code, hostPlayerId, hostPlayerName);
    this.rooms.set(code, room);
    this.playerRoomIndex.set(hostPlayerId, code);
    return room;
  }

  public getRoom(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  public getRoomByPlayerId(playerId: string): Room | undefined {
    const code = this.playerRoomIndex.get(playerId);
    if (!code) return undefined;
    return this.rooms.get(code);
  }

  public joinOrCreateRoom(
    playerId: string,
    playerName: string,
    requestedCode?: string
  ): { success: boolean; room?: Room; error?: string } {
    const existingCode = this.playerRoomIndex.get(playerId);

    if (!requestedCode || requestedCode.trim() === '') {
      this.leaveCurrentRoom(playerId);
      const room = this.createRoom(playerId, playerName);
      return { success: true, room };
    }

    const normalizedCode = requestedCode.trim().toUpperCase();
    if (normalizedCode.length !== CONFIG.ROOM_CODE_LENGTH) {
      return { success: false, error: 'INVALID_ROOM_CODE' };
    }

    if (existingCode && existingCode !== normalizedCode) {
      this.leaveCurrentRoom(playerId);
    }

    const existingRoom = this.rooms.get(normalizedCode);
    if (!existingRoom) {
      return { success: false, error: 'ROOM_NOT_FOUND' };
    }

    const joinResult = existingRoom.addPlayer(playerId, playerName);
    if (!joinResult.success) {
      return { success: false, error: joinResult.error };
    }

    this.playerRoomIndex.set(playerId, normalizedCode);
    return { success: true, room: existingRoom };
  }

  public leaveCurrentRoom(playerId: string): {
    roomCode?: string;
    wasHost?: boolean;
    newHostId?: string;
    roomDeleted?: boolean;
    countdownAborted?: boolean;
    shouldFinishMatch?: boolean;
  } {
    const code = this.playerRoomIndex.get(playerId);
    if (!code) return {};

    this.playerRoomIndex.delete(playerId);
    const room = this.rooms.get(code);
    if (!room) return {};

    const {
      wasHost,
      newHostId,
      isEmpty,
      countdownAborted,
      shouldFinishMatch
    } = room.removePlayer(playerId);

    if (isEmpty) {
      room.dispose();
      this.rooms.delete(code);
      return { roomCode: code, wasHost, roomDeleted: true };
    }

    return {
      roomCode: code,
      wasHost,
      newHostId,
      roomDeleted: false,
      countdownAborted,
      shouldFinishMatch
    };
  }

  public getActiveRoomsSummary(): Array<{
    code: string;
    playerCount: number;
    maxPlayers: number;
    phase: string;
    status: string;
    hostId: string;
    createdAt: number;
  }> {
    return Array.from(this.rooms.values()).map((room) => ({
      code: room.code,
      playerCount: room.getPlayerCount(),
      maxPlayers: CONFIG.MAX_PLAYERS,
      phase: room.phase,
      status: room.status,
      hostId: room.hostId,
      createdAt: room.createdAt
    }));
  }

  public getTotalRoomsCount(): number {
    return this.rooms.size;
  }

  public getTotalPlayersCount(): number {
    return this.playerRoomIndex.size;
  }
}
