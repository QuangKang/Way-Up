import {
  CLIMBER_COLORS,
  DEFAULT_MATCH_SETTINGS,
  ErrorPayload,
  GAME_CONSTANTS,
  generateRandomSeed,
  isValidClimberColor,
  MatchConfig,
  MatchCountdownPayload,
  MatchFinishedPayload,
  MatchFinishReason,
  MatchRankingEntry,
  MatchSettings,
  MatchStartedPayload,
  MatchStatePayload,
  Player,
  PlayerMovePayload,
  RoomPhase,
  RoomState,
  SanitizedPlayerPosition,
  sanitizeMatchSettings
} from '@climb/shared';
import { CONFIG } from '../config';

interface PlayerMoveTracker {
  lastMoveAt: number;
  lastHeight: number;
  burstAllowance: number;
}

export interface CountdownCallbacks {
  onTick: (payload: MatchCountdownPayload) => void;
  onStarted: (payload: MatchStartedPayload) => void;
  onTimeLimit: () => void;
}

export class Room {
  public readonly code: string;
  public hostId: string;
  private readonly players: Map<string, Player> = new Map();
  public phase: RoomPhase = 'WAITING';
  public seed: number = 0;
  public targetHeight: number = CONFIG.DEFAULT_TARGET_HEIGHT;
  public settings: MatchSettings = { ...DEFAULT_MATCH_SETTINGS };
  public countdownRemaining: number | null = null;
  public readonly createdAt: number = Date.now();
  public startedAt: number | null = null;
  public finishedAt: number | null = null;
  public winnerId: string | null = null;

  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private matchTimeout: ReturnType<typeof setTimeout> | null = null;
  private broadcastTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastStateBroadcastAt: number = 0;
  private readonly moveTrackers: Map<string, PlayerMoveTracker> = new Map();

  constructor(
    code: string,
    hostPlayerId: string,
    hostNickname: string,
    preferredColor?: string
  ) {
    this.code = code.toUpperCase();
    this.hostId = hostPlayerId;

    const cleanName = hostNickname.trim();
    const initialColor = this.pickAvailableColor(preferredColor);

    const hostPlayer: Player = {
      id: hostPlayerId,
      nickname: cleanName,
      name: cleanName,
      isHost: true,
      isReady: true,
      color: initialColor,
      height: 0,
      x: GAME_CONSTANTS.WORLD_WIDTH * 0.5,
      y: 0,
      score: 0,
      status: 'IDLE',
      finishTimeMs: null,
      ping: 0
    };

    this.players.set(hostPlayerId, hostPlayer);
  }

  public get status(): RoomPhase {
    return this.phase;
  }

  public get goalHeight(): number {
    return this.targetHeight;
  }

  public get config(): MatchConfig {
    return {
      seed: this.seed,
      targetHeight: this.targetHeight,
      countdownSec: CONFIG.COUNTDOWN_SECONDS,
      settings: { ...this.settings }
    };
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
    playerName: string,
    preferredColor?: string
  ): { success: boolean; player?: Player; error?: string } {
    const cleanName = playerName.trim();

    if (this.players.has(playerId)) {
      const existing = this.players.get(playerId)!;
      existing.nickname = cleanName;
      existing.name = cleanName;
      if (
        this.phase === 'WAITING' &&
        preferredColor &&
        isValidClimberColor(preferredColor) &&
        !this.isColorClaimedByAnother(preferredColor, playerId)
      ) {
        existing.color = preferredColor;
      }
      return { success: true, player: existing };
    }

    if (this.players.size >= CONFIG.MAX_PLAYERS) {
      return { success: false, error: 'ROOM_FULL' };
    }

    if (this.phase !== 'WAITING') {
      return { success: false, error: 'GAME_ALREADY_STARTED' };
    }

    const assignedColor = this.pickAvailableColor(preferredColor);
    const isFirstPlayer = this.players.size === 0;

    if (isFirstPlayer) {
      this.hostId = playerId;
    }

    const newPlayer: Player = {
      id: playerId,
      nickname: cleanName,
      name: cleanName,
      isHost: isFirstPlayer,
      isReady: isFirstPlayer,
      color: assignedColor,
      height: 0,
      x: GAME_CONSTANTS.WORLD_WIDTH * 0.5,
      y: 0,
      score: 0,
      status: 'IDLE',
      finishTimeMs: null,
      ping: 0
    };

    this.players.set(playerId, newPlayer);
    return { success: true, player: newPlayer };
  }

  public selectPlayerColor(
    playerId: string,
    requestedColor: string
  ): { success: boolean; error?: ErrorPayload['code'] } {
    if (this.phase !== 'WAITING') {
      return { success: false, error: 'INVALID_ROOM_PHASE' };
    }

    const player = this.players.get(playerId);
    if (!player) {
      return { success: false, error: 'ROOM_NOT_FOUND' };
    }

    if (!isValidClimberColor(requestedColor)) {
      return { success: false, error: 'INVALID_COLOR' };
    }

    if (this.isColorClaimedByAnother(requestedColor, playerId)) {
      return { success: false, error: 'COLOR_ALREADY_TAKEN' };
    }

    player.color = requestedColor;
    return { success: true };
  }

  public updateSettings(
    requesterId: string,
    partialSettings: Partial<MatchSettings>
  ): { success: boolean; error?: ErrorPayload['code'] } {
    if (this.hostId !== requesterId) {
      return { success: false, error: 'UNAUTHORIZED_NOT_HOST' };
    }

    if (this.phase !== 'WAITING') {
      return { success: false, error: 'INVALID_ROOM_PHASE' };
    }

    this.settings = sanitizeMatchSettings(partialSettings, this.settings);
    return { success: true };
  }

  public removePlayer(playerId: string): {
    wasHost: boolean;
    newHostId?: string;
    isEmpty: boolean;
    countdownAborted: boolean;
    shouldFinishMatch: boolean;
  } {
    const wasHost = this.hostId === playerId;
    this.players.delete(playerId);
    this.moveTrackers.delete(playerId);

    if (this.players.size === 0) {
      this.dispose();
      return {
        wasHost,
        isEmpty: true,
        countdownAborted: false,
        shouldFinishMatch: false
      };
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

    let countdownAborted = false;
    if (this.phase === 'COUNTDOWN') {
      this.clearTimers();
      this.phase = 'WAITING';
      this.countdownRemaining = null;
      for (const player of this.players.values()) {
        player.status = 'IDLE';
      }
      countdownAborted = true;
    }

    // If a climber disconnects mid-match, check whether all remaining climbers have already reached 500m
    const shouldFinishMatch =
      this.phase === 'PLAYING' && this.areAllPlayersFinished();

    return {
      wasHost,
      newHostId,
      isEmpty: false,
      countdownAborted,
      shouldFinishMatch
    };
  }

  public setPlayerReady(playerId: string, explicitReady?: boolean): boolean {
    if (this.phase !== 'WAITING') {
      return false;
    }

    const player = this.players.get(playerId);
    if (!player) return false;

    player.isReady =
      explicitReady !== undefined ? explicitReady : !player.isReady;
    player.status = 'IDLE';
    return true;
  }

  public canStart(requesterId: string): { canStart: boolean; error?: string } {
    if (this.hostId !== requesterId) {
      return { canStart: false, error: 'UNAUTHORIZED_NOT_HOST' };
    }

    if (this.phase !== 'WAITING') {
      return { canStart: false, error: 'GAME_ALREADY_STARTED' };
    }

    if (this.players.size < Math.max(2, CONFIG.MIN_PLAYERS)) {
      return { canStart: false, error: 'NOT_ENOUGH_PLAYERS' };
    }

    const allReady = Array.from(this.players.values()).every((p) => p.isReady);
    if (!allReady) {
      return { canStart: false, error: 'NOT_ALL_PLAYERS_READY' };
    }

    return { canStart: true };
  }

  public beginCountdown(
    callbacks: CountdownCallbacks,
    requestedTargetHeight?: number
  ): MatchCountdownPayload {
    this.clearTimers();

    if (
      requestedTargetHeight !== undefined &&
      Number.isFinite(requestedTargetHeight) &&
      requestedTargetHeight >= 100 &&
      requestedTargetHeight <= 5000
    ) {
      this.targetHeight = Math.round(requestedTargetHeight);
    } else {
      this.targetHeight = CONFIG.DEFAULT_TARGET_HEIGHT;
    }

    this.seed = generateRandomSeed();
    this.phase = 'COUNTDOWN';
    this.countdownRemaining = CONFIG.COUNTDOWN_SECONDS;
    this.startedAt = null;
    this.finishedAt = null;
    this.winnerId = null;
    this.moveTrackers.clear();

    this.resetPlayerPositions(false);

    const initialPayload: MatchCountdownPayload = {
      roomCode: this.code,
      secondsRemaining: this.countdownRemaining,
      seed: this.seed,
      targetHeight: this.targetHeight
    };

    callbacks.onTick(initialPayload);

    let remaining = CONFIG.COUNTDOWN_SECONDS;
    this.countdownInterval = setInterval(() => {
      remaining -= 1;

      if (remaining > 0) {
        this.countdownRemaining = remaining;
        callbacks.onTick({
          roomCode: this.code,
          secondsRemaining: remaining,
          seed: this.seed,
          targetHeight: this.targetHeight
        });
        return;
      }

      if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
        this.countdownInterval = null;
      }

      const startedPayload = this.transitionToPlaying(callbacks.onTimeLimit);
      callbacks.onStarted(startedPayload);
    }, 1000);

    return initialPayload;
  }

  private transitionToPlaying(onTimeLimit: () => void): MatchStartedPayload {
    const now = Date.now();
    this.phase = 'PLAYING';
    this.countdownRemaining = null;
    this.startedAt = now;
    this.lastStateBroadcastAt = 0;

    for (const player of this.players.values()) {
      player.status = 'CLIMBING';
      player.height = 0;
      player.y = 0;
      player.x = GAME_CONSTANTS.WORLD_WIDTH * 0.5;
      player.score = 0;
      player.finishTimeMs = null;
      this.moveTrackers.set(player.id, {
        lastMoveAt: now,
        lastHeight: 0,
        burstAllowance: CONFIG.MAX_BURST_HEIGHT_DELTA
      });
    }

    const authoritativeTimeLimitMs =
      Math.max(
        CONFIG.MIN_TIME_LIMIT_SEC,
        Math.min(CONFIG.MAX_TIME_LIMIT_SEC, this.settings.timeLimitSec)
      ) * 1000;

    this.matchTimeout = setTimeout(() => {
      if (this.phase === 'PLAYING') {
        onTimeLimit();
      }
    }, authoritativeTimeLimitMs);

    return {
      roomCode: this.code,
      seed: this.seed,
      targetHeight: this.targetHeight,
      startTimestamp: now,
      config: this.config,
      room: this.toState()
    };
  }

  /**
   * Server-authoritative validation for incoming `player:move` packets.
   * When a climber reaches `targetHeight`, locks their `status = 'FINISHED'` and
   * exact elapsed `finishTimeMs = now - startedAt` while letting remaining climbers continue.
   */
  public applyPlayerMove(payload: PlayerMovePayload): {
    accepted: boolean;
    reachedTarget: boolean;
    allFinished: boolean;
    reason?: string;
  } {
    if (this.phase !== 'PLAYING') {
      return {
        accepted: false,
        reachedTarget: false,
        allFinished: false,
        reason: 'ROOM_NOT_PLAYING'
      };
    }

    const player = this.players.get(payload.playerId);
    if (!player || player.status === 'FINISHED') {
      return {
        accepted: false,
        reachedTarget: false,
        allFinished: false,
        reason: 'PLAYER_NOT_ACTIVE'
      };
    }

    if (!Number.isFinite(payload.x) || !Number.isFinite(payload.height)) {
      return {
        accepted: false,
        reachedTarget: false,
        allFinished: false,
        reason: 'NON_FINITE_COORDINATES'
      };
    }

    const clampedX = Math.max(
      0,
      Math.min(GAME_CONSTANTS.WORLD_WIDTH, payload.x)
    );
    const clampedHeight = Math.max(
      0,
      Math.min(this.targetHeight, payload.height)
    );

    const now = Date.now();
    const startEpoch = this.startedAt ?? now;
    const tracker = this.moveTrackers.get(player.id) ?? {
      lastMoveAt: startEpoch,
      lastHeight: player.height,
      burstAllowance: CONFIG.MAX_BURST_HEIGHT_DELTA
    };

    const elapsedSec = Math.max(0, (now - tracker.lastMoveAt) / 1000);
    const refilledAllowance = Math.min(
      CONFIG.MAX_BURST_HEIGHT_DELTA,
      tracker.burstAllowance + elapsedSec * CONFIG.MAX_HEIGHT_GAIN_PER_SEC
    );

    const heightDelta = clampedHeight - player.height;

    if (heightDelta > 0) {
      if (
        heightDelta > CONFIG.MAX_STEP_HEIGHT_DELTA ||
        heightDelta > refilledAllowance
      ) {
        return {
          accepted: false,
          reachedTarget: false,
          allFinished: false,
          reason: 'UPWARD_TELEPORT_REJECTED'
        };
      }
      tracker.burstAllowance = refilledAllowance - heightDelta;
    } else {
      tracker.burstAllowance = refilledAllowance;
    }

    const roundedX = Math.round(clampedX * 10) / 10;
    const roundedHeight = Math.round(clampedHeight * 10) / 10;

    tracker.lastMoveAt = now;
    tracker.lastHeight = roundedHeight;
    this.moveTrackers.set(player.id, tracker);

    player.x = roundedX;
    player.height = roundedHeight;
    player.y = roundedHeight;
    player.score = Math.max(player.score, Math.round(roundedHeight * 10));

    if (roundedHeight >= this.targetHeight) {
      player.height = this.targetHeight;
      player.y = this.targetHeight;
      player.status = 'FINISHED';
      player.finishTimeMs = Math.max(1, now - startEpoch);
    } else if (payload.action === 'STUN' || payload.status === 'STUNNED') {
      player.status = 'STUNNED';
    } else if (payload.action === 'IDLE' && payload.status === 'IDLE') {
      player.status = 'IDLE';
    } else {
      player.status = 'CLIMBING';
    }

    const reachedTarget = player.status === 'FINISHED';
    const allFinished = this.areAllPlayersFinished();

    return {
      accepted: true,
      reachedTarget,
      allFinished
    };
  }

  public scheduleStateBroadcast(
    emitState: (payload: MatchStatePayload) => void
  ): void {
    if (this.phase !== 'PLAYING') return;

    const now = Date.now();
    const elapsed = now - this.lastStateBroadcastAt;

    if (elapsed >= CONFIG.STATE_BROADCAST_INTERVAL_MS) {
      if (this.broadcastTimeout) {
        clearTimeout(this.broadcastTimeout);
        this.broadcastTimeout = null;
      }
      this.lastStateBroadcastAt = now;
      emitState(this.toMatchState());
      return;
    }

    if (!this.broadcastTimeout) {
      const remainingMs = CONFIG.STATE_BROADCAST_INTERVAL_MS - elapsed;
      this.broadcastTimeout = setTimeout(() => {
        this.broadcastTimeout = null;
        if (this.phase === 'PLAYING') {
          this.lastStateBroadcastAt = Date.now();
          emitState(this.toMatchState());
        }
      }, remainingMs);
    }
  }

  public finishMatch(reason: MatchFinishReason): MatchFinishedPayload {
    this.clearTimers();

    const now = Date.now();
    this.phase = 'FINISHED';
    this.finishedAt = now;

    // Sort finishers by actual elapsed climb time ascending, then unfinished climbers by height descending
    const sortedPlayers = this.getAllPlayers().sort((a, b) => {
      if (a.finishTimeMs !== null && b.finishTimeMs !== null) {
        return a.finishTimeMs - b.finishTimeMs;
      }
      if (a.finishTimeMs !== null) return -1;
      if (b.finishTimeMs !== null) return 1;
      if (b.height !== a.height) return b.height - a.height;
      return b.score - a.score;
    });

    const rankings: MatchRankingEntry[] = sortedPlayers.map((player, index) => ({
      rank: index + 1,
      playerId: player.id,
      nickname: player.nickname,
      color: player.color,
      height: player.height,
      score: player.score,
      status: player.status,
      finishTimeMs: player.finishTimeMs
    }));

    this.winnerId = rankings[0]?.playerId ?? null;
    const durationMs =
      this.startedAt !== null ? Math.max(0, now - this.startedAt) : 0;

    return {
      roomCode: this.code,
      winnerId: this.winnerId,
      seed: this.seed,
      targetHeight: this.targetHeight,
      durationMs,
      reason,
      rankings,
      room: this.toState()
    };
  }

  public resetForRematch(): RoomState {
    this.clearTimers();

    this.phase = 'WAITING';
    this.seed = 0;
    this.countdownRemaining = null;
    this.startedAt = null;
    this.finishedAt = null;
    this.winnerId = null;
    this.moveTrackers.clear();

    this.resetPlayerPositions(true);

    return this.toState();
  }

  public toMatchState(): MatchStatePayload {
    const now = Date.now();
    const elapsedMs =
      this.startedAt !== null ? Math.max(0, now - this.startedAt) : 0;
    const totalLimitMs = this.settings.timeLimitSec * 1000;
    const remainingMs = Math.max(0, totalLimitMs - elapsedMs);

    const sanitizedPlayers: SanitizedPlayerPosition[] = this.getAllPlayers().map(
      (player) => ({
        id: player.id,
        nickname: player.nickname,
        color: player.color,
        x: player.x,
        height: player.height,
        status: player.status,
        finishTimeMs: player.finishTimeMs
      })
    );

    return {
      roomCode: this.code,
      serverTimestamp: now,
      elapsedMs,
      remainingMs,
      players: sanitizedPlayers
    };
  }

  public toState(): RoomState {
    return {
      code: this.code,
      phase: this.phase,
      status: this.phase,
      hostId: this.hostId,
      players: this.getAllPlayers(),
      maxPlayers: CONFIG.MAX_PLAYERS,
      minPlayers: CONFIG.MIN_PLAYERS,
      settings: { ...this.settings },
      config: this.config,
      seed: this.seed,
      targetHeight: this.targetHeight,
      goalHeight: this.targetHeight,
      countdownRemaining: this.countdownRemaining,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      winnerId: this.winnerId
    };
  }

  public dispose(): void {
    this.clearTimers();
    this.moveTrackers.clear();
  }

  private clearTimers(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    if (this.matchTimeout) {
      clearTimeout(this.matchTimeout);
      this.matchTimeout = null;
    }
    if (this.broadcastTimeout) {
      clearTimeout(this.broadcastTimeout);
      this.broadcastTimeout = null;
    }
  }

  private resetPlayerPositions(resetReadyForGuests: boolean): void {
    for (const player of this.players.values()) {
      player.height = 0;
      player.y = 0;
      player.x = GAME_CONSTANTS.WORLD_WIDTH * 0.5;
      player.score = 0;
      player.status = 'IDLE';
      player.finishTimeMs = null;
      if (resetReadyForGuests) {
        player.isReady = player.isHost;
      }
    }
  }

  private areAllPlayersFinished(): boolean {
    if (this.players.size === 0) return false;
    return Array.from(this.players.values()).every(
      (player) => player.status === 'FINISHED'
    );
  }

  private isColorClaimedByAnother(
    color: string,
    excludePlayerId?: string
  ): boolean {
    for (const player of this.players.values()) {
      if (player.id !== excludePlayerId && player.color === color) {
        return true;
      }
    }
    return false;
  }

  private pickAvailableColor(preferredColor?: string): string {
    if (
      preferredColor &&
      isValidClimberColor(preferredColor) &&
      !this.isColorClaimedByAnother(preferredColor)
    ) {
      return preferredColor;
    }

    const usedColors = new Set(
      Array.from(this.players.values()).map((p) => p.color)
    );
    for (const color of CLIMBER_COLORS) {
      if (!usedColors.has(color)) {
        return color;
      }
    }
    return CLIMBER_COLORS[0];
  }
}
