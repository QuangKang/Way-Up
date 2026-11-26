import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import {
  ClimbStep,
  createMulberry32,
  evaluateHazardPhase,
  evaluateSummitBlizzard,
  GAME_CONSTANTS,
  generateMountainSteps,
  getBiomeForHeight,
  MatchFinishedPayload,
  MatchRankingEntry,
  MountainBiome,
  PlayerColor,
  PlayerMoveAction,
  PlayerStatus,
  RoomState,
  SanitizedPlayerPosition,
  TapDirection
} from '@climb/shared';
import {
  BoulderSprite,
  SNOWY_ICE_HOLD_WIDTH,
  SNOWY_ROCK_HOLD_WIDTH,
  SnowyIceHold,
  SnowyRockHold
} from '../components/MountainArtwork';
import { MoveSubmission } from '../hooks/useMultiplayerLobby';
import { HapticsService } from '../haptics/hapticsService';

export interface GameScreenProps {
  mode?: 'ONLINE' | 'OFFLINE';
  roomState: RoomState;
  playerId: string;
  livePlayers: SanitizedPlayerPosition[];
  onSendMove: (move: MoveSubmission) => void;
  onOfflineFinish?: (result: MatchFinishedPayload) => void;
  onLeaveRoom: () => void;
}

interface HopAnimation {
  fromX: number;
  fromHeight: number;
  toX: number;
  toHeight: number;
  elapsed: number;
  duration: number;
  arcMeters: number;
  isFall: boolean;
}

interface FloatingToast {
  text: string;
  accent: string;
  ttl: number;
}

interface SnowStreak {
  id: number;
  xPct: number;
  yPct: number;
  speedX: number;
  speedY: number;
  width: number;
}

interface RivalGhost {
  id: string;
  nickname: string;
  color: string;
  xNorm: number;
  height: number;
  targetXNorm: number;
  targetHeight: number;
  status: PlayerStatus;
}

/**
 * Decoupled boulder instance committed to `activeBouldersRef`.
 * Once triggered in a lane, it NEVER cancels or despawns early regardless of how
 * fast the climber moves up or down the cliff.
 */
interface ActiveBoulder {
  id: string;
  lane: TapDirection;
  laneX: number;
  phase: 'WARNING' | 'FALLING';
  elapsedSec: number;
  warningDurationSec: number;
  fallDurationSec: number;
  screenY: number;
  spinDeg: number;
  hitPlayer: boolean;
  hitBotIds: Set<string>;
}

interface OfflineBotRuntime {
  id: string;
  nickname: string;
  color: PlayerColor;
  stepIndex: number;
  visualX: number;
  visualHeight: number;
  hop: HopAnimation | null;
  decisionTimer: number;
  slipElapsed: number;
  stunTimer: number;
  status: PlayerStatus;
  finishTimeMs: number | null;
  score: number;
  minTapDelay: number;
  maxTapDelay: number;
  cautionProb: number;
  mistakeProb: number;
}

interface ClimbRuntimeState {
  stepIndex: number;
  visualX: number;
  visualHeight: number;
  cameraHeight: number;
  hop: HopAnimation | null;
  slipElapsed: number;
  lockTimer: number;
  boulderInvulnTimer: number;
  status: PlayerStatus;
  finishTimeMs: number | null;
  offlineFinishDelaySec: number;
  offlineFinishDispatched: boolean;
  toast: FloatingToast | null;
  animClock: number;
  finishedEmitted: boolean;
}

interface CliffFacetSpec {
  id: number;
  leftPct: number;
  baseOffsetPx: number;
  widthPct: number;
  heightPx: number;
  rotateDeg: string;
  hasSnowPatch: boolean;
  isCrack: boolean;
}

const WORLD_WIDTH = GAME_CONSTANTS.WORLD_WIDTH; // 400
const SLIP_LIMIT_SEC = 0.75; // 0.75s timed grip before sliding back 2 steps (-20m)
const SLIP_LOCK_SEC = 0.3;
const BOULDER_WARNING_SEC = 1.0; // ~1.0s pulsing top-edge warning before drop
const BOULDER_STUN_SEC = 0.45;
const BOULDER_INVULN_SEC = 1.05;

// Closer Camera FOV: 120px per 10m step -> 4 to 5 holds visible on screen
const PIXELS_PER_METER = 12.0;
const BOTTOM_ANCHOR_RATIO = 0.23;
const BOULDER_SIZE_PX = 48;
const MOVE_EMIT_INTERVAL_MS = 55;
const CLIFF_TILE_PERIOD_PX = 760;

// Deterministic tiling rock facets, fissures & clung snow patches (keeps 50% seam clear)
const CLIFF_FACETS: readonly CliffFacetSpec[] = [
  { id: 0, leftPct: 8, baseOffsetPx: 30, widthPct: 28, heightPx: 38, rotateDeg: '-7deg', hasSnowPatch: true, isCrack: false },
  { id: 1, leftPct: 62, baseOffsetPx: 85, widthPct: 29, heightPx: 42, rotateDeg: '6deg', hasSnowPatch: true, isCrack: false },
  { id: 2, leftPct: 16, baseOffsetPx: 145, widthPct: 22, heightPx: 30, rotateDeg: '9deg', hasSnowPatch: false, isCrack: false },
  { id: 3, leftPct: 66, baseOffsetPx: 205, widthPct: 24, heightPx: 34, rotateDeg: '-8deg', hasSnowPatch: true, isCrack: false },
  { id: 4, leftPct: 9, baseOffsetPx: 268, widthPct: 27, heightPx: 40, rotateDeg: '-5deg', hasSnowPatch: true, isCrack: false },
  { id: 5, leftPct: 60, baseOffsetPx: 325, widthPct: 30, heightPx: 36, rotateDeg: '7deg', hasSnowPatch: false, isCrack: false },
  { id: 6, leftPct: 13, baseOffsetPx: 392, widthPct: 25, heightPx: 36, rotateDeg: '8deg', hasSnowPatch: true, isCrack: false },
  { id: 7, leftPct: 64, baseOffsetPx: 455, widthPct: 27, heightPx: 42, rotateDeg: '-6deg', hasSnowPatch: true, isCrack: false },
  { id: 8, leftPct: 10, baseOffsetPx: 525, widthPct: 28, heightPx: 34, rotateDeg: '-9deg', hasSnowPatch: false, isCrack: false },
  { id: 9, leftPct: 61, baseOffsetPx: 590, widthPct: 28, heightPx: 38, rotateDeg: '5deg', hasSnowPatch: true, isCrack: false },
  { id: 10, leftPct: 15, baseOffsetPx: 658, widthPct: 24, heightPx: 34, rotateDeg: '6deg', hasSnowPatch: true, isCrack: false },
  { id: 11, leftPct: 65, baseOffsetPx: 715, widthPct: 25, heightPx: 32, rotateDeg: '-7deg', hasSnowPatch: true, isCrack: false },
  // Angular rock fissure cracks
  { id: 12, leftPct: 28, baseOffsetPx: 105, widthPct: 2, heightPx: 44, rotateDeg: '24deg', hasSnowPatch: false, isCrack: true },
  { id: 13, leftPct: 72, baseOffsetPx: 240, widthPct: 2, heightPx: 48, rotateDeg: '-22deg', hasSnowPatch: false, isCrack: true },
  { id: 14, leftPct: 24, baseOffsetPx: 430, widthPct: 2, heightPx: 40, rotateDeg: '-26deg', hasSnowPatch: false, isCrack: true },
  { id: 15, leftPct: 75, baseOffsetPx: 560, widthPct: 2, heightPx: 46, rotateDeg: '20deg', hasSnowPatch: false, isCrack: true },
  { id: 16, leftPct: 31, baseOffsetPx: 690, widthPct: 2, heightPx: 38, rotateDeg: '19deg', hasSnowPatch: false, isCrack: true }
];

const EDGE_CRAGS = [0, 1, 2, 3, 4, 5, 6] as const;

interface BiomePalette {
  name: string;
  skyBg: string;
  farPeakColor: string;
  midPeakColor: string;
  cliffFace: string;
  cliffEdge: string;
  cliffSeam: string;
  rockPatch: string;
  rockCragEdge: string;
  fissureColor: string;
  graniteBody: string;
  graniteLight: string;
  graniteShadow: string;
  pillBg: string;
  pillText: string;
}

const BIOME_PALETTES: Record<MountainBiome, BiomePalette> = {
  FOOTHILLS: {
    name: 'Rocky Foothills',
    skyBg: '#192236',
    farPeakColor: '#25324D',
    midPeakColor: '#1E2940',
    cliffFace: '#313B4D',
    cliffEdge: '#526077',
    cliffSeam: '#1D2432',
    rockPatch: '#3E4A60',
    rockCragEdge: '#273040',
    fissureColor: '#1B2230',
    graniteBody: '#3E4C63',
    graniteLight: '#596B87',
    graniteShadow: '#1E293B',
    pillBg: 'rgba(30, 58, 95, 0.82)',
    pillText: '#FDE68A'
  },
  CLIFFS: {
    name: 'Steep Cliffs',
    skyBg: '#0E1C36',
    farPeakColor: '#182F54',
    midPeakColor: '#132544',
    cliffFace: '#27364F',
    cliffEdge: '#5B708F',
    cliffSeam: '#152033',
    rockPatch: '#344766',
    rockCragEdge: '#1D2B42',
    fissureColor: '#111B2B',
    graniteBody: '#384A66',
    graniteLight: '#556D91',
    graniteShadow: '#162133',
    pillBg: 'rgba(12, 74, 110, 0.82)',
    pillText: '#BAE6FD'
  },
  SUMMIT: {
    name: 'Alpine Summit',
    skyBg: '#071024',
    farPeakColor: '#14294D',
    midPeakColor: '#0E1F3D',
    cliffFace: '#22334F',
    cliffEdge: '#7890B2',
    cliffSeam: '#111C2E',
    rockPatch: '#31476B',
    rockCragEdge: '#1A2840',
    fissureColor: '#0E1726',
    graniteBody: '#364968',
    graniteLight: '#5D769E',
    graniteShadow: '#111B2E',
    pillBg: 'rgba(22, 78, 99, 0.88)',
    pillText: '#E0F2FE'
  }
};

function createSnowStreaks(): SnowStreak[] {
  return Array.from({ length: 22 }, (_, i) => ({
    id: i,
    xPct: (i * 19 + 5) % 100,
    yPct: (i * 29 + 13) % 100,
    speedX: 28 + (i % 5) * 14,
    speedY: 16 + (i % 4) * 6,
    width: i % 3 === 0 ? 28 : 15
  }));
}

function createInitialOfflineBots(seed: number): OfflineBotRuntime[] {
  const rng = createMulberry32(seed ^ 0x85ebca6b);
  return [
    {
      id: 'ai-bot-frost',
      nickname: 'FrostBot',
      color: '#EF4444',
      stepIndex: 0,
      visualX: 0.5,
      visualHeight: 0,
      hop: null,
      decisionTimer: rng.nextFloat(0.28, 0.45),
      slipElapsed: 0,
      stunTimer: 0,
      status: 'CLIMBING',
      finishTimeMs: null,
      score: 0,
      minTapDelay: 0.33,
      maxTapDelay: 0.44,
      cautionProb: 0.92,
      mistakeProb: 0.025
    },
    {
      id: 'ai-bot-crag',
      nickname: 'CragHopper',
      color: '#10B981',
      stepIndex: 0,
      visualX: 0.5,
      visualHeight: 0,
      hop: null,
      decisionTimer: rng.nextFloat(0.18, 0.32),
      slipElapsed: 0,
      stunTimer: 0,
      status: 'CLIMBING',
      finishTimeMs: null,
      score: 0,
      minTapDelay: 0.22,
      maxTapDelay: 0.32,
      cautionProb: 0.68,
      mistakeProb: 0.055
    },
    {
      id: 'ai-bot-peak',
      nickname: 'PeakRunner',
      color: '#F59E0B',
      stepIndex: 0,
      visualX: 0.5,
      visualHeight: 0,
      hop: null,
      decisionTimer: rng.nextFloat(0.22, 0.38),
      slipElapsed: 0,
      stunTimer: 0,
      status: 'CLIMBING',
      finishTimeMs: null,
      score: 0,
      minTapDelay: 0.27,
      maxTapDelay: 0.37,
      cautionProb: 0.84,
      mistakeProb: 0.038
    }
  ];
}

function formatTimer(elapsedMs: number): string {
  const totalSec = Math.max(0, elapsedMs / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  const tenths = Math.floor((totalSec * 10) % 10);
  const mm = mins < 10 ? `0${mins}` : `${mins}`;
  const ss = secs < 10 ? `0${secs}` : `${secs}`;
  return `${mm}:${ss}.${tenths}`;
}

interface ClimberAvatarProps {
  jacketColor: string;
  reachLeft: boolean;
  isHopping: boolean;
  isStunned: boolean;
  isGhost?: boolean;
}

const ClimberAvatar: React.FC<ClimberAvatarProps> = ({
  jacketColor,
  reachLeft,
  isHopping,
  isStunned,
  isGhost = false
}) => {
  const activeJacket = isStunned ? '#EF4444' : jacketColor;
  const leftArmUp = reachLeft || isHopping;
  const rightArmUp = !reachLeft || isHopping;

  return (
    <View style={[styles.climberRoot, isGhost && styles.climberGhostRoot]}>
      <View
        style={[
          styles.climberPack,
          reachLeft ? styles.packRight : styles.packLeft
        ]}
      />
      <View
        style={[
          styles.climberArm,
          styles.armLeft,
          { backgroundColor: activeJacket },
          leftArmUp && styles.armRaisedLeft
        ]}
      />
      <View
        style={[
          styles.climberArm,
          styles.armRight,
          { backgroundColor: activeJacket },
          rightArmUp && styles.armRaisedRight
        ]}
      />
      <View style={styles.climberHead}>
        <View
          style={[styles.climberHelmet, { backgroundColor: activeJacket }]}
        />
        <View style={styles.climberGoggles}>
          <View style={styles.goggleGlint} />
        </View>
      </View>
      <View
        style={[styles.climberTorso, { backgroundColor: activeJacket }]}
      >
        <View style={styles.climberHarness} />
      </View>
      <View style={styles.climberLegsRow}>
        <View
          style={[
            styles.climberLeg,
            isHopping && reachLeft && styles.legTucked
          ]}
        />
        <View
          style={[
            styles.climberLeg,
            isHopping && !reachLeft && styles.legTucked
          ]}
        />
      </View>
    </View>
  );
};

export const GameScreen: React.FC<GameScreenProps> = ({
  mode = 'ONLINE',
  roomState,
  playerId,
  livePlayers,
  onSendMove,
  onOfflineFinish,
  onLeaveRoom
}) => {
  const isOffline = mode === 'OFFLINE';
  const windowDims = Dimensions.get('window');
  const [viewport, setViewport] = useState<{ width: number; height: number }>({
    width: Math.max(300, windowDims.width - 24),
    height: Math.max(380, windowDims.height - 190)
  });

  const [, setFrameTick] = useState<number>(0);

  const steps = useMemo<ClimbStep[]>(
    () =>
      generateMountainSteps({
        seed: roomState.seed,
        targetHeight: roomState.targetHeight
      }),
    [roomState.seed, roomState.targetHeight]
  );

  const selfPlayer = roomState.players.find((p) => p.id === playerId);
  const selfColor = selfPlayer?.color ?? '#3B82F6';
  const selfNickname = selfPlayer?.nickname ?? 'Climber';

  const gameRef = useRef<ClimbRuntimeState>({
    stepIndex: 0,
    visualX: 0.5,
    visualHeight: 0,
    cameraHeight: 0,
    hop: null,
    slipElapsed: 0,
    lockTimer: 0,
    boulderInvulnTimer: 0,
    status: 'CLIMBING',
    finishTimeMs: null,
    offlineFinishDelaySec: 0,
    offlineFinishDispatched: false,
    toast: null,
    animClock: 0,
    finishedEmitted: false
  });

  // Decoupled boulder queue (never canceled when player climbs past trigger step)
  const activeBouldersRef = useRef<ActiveBoulder[]>([]);
  const spawnedBoulderKeysRef = useRef<Set<string>>(new Set());
  const proximityTriggeredStepsRef = useRef<Set<number>>(new Set());
  const boulderSeqRef = useRef<number>(0);

  // Offline AI bots & deterministic bot PRNG
  const offlineBotsRef = useRef<OfflineBotRuntime[]>([]);
  const botPrngRef = useRef(createMulberry32(roomState.seed ^ 0x9e3779b9));

  const snowRef = useRef<SnowStreak[]>(createSnowStreaks());
  const rivalGhostsRef = useRef<Map<string, RivalGhost>>(new Map());
  const viewportRef = useRef(viewport);

  const onSendMoveRef = useRef(onSendMove);
  const onOfflineFinishRef = useRef(onOfflineFinish);
  const roomStateRef = useRef(roomState);
  const matchStartLocalMsRef = useRef<number>(Date.now());
  const elapsedMsRef = useRef<number>(0);
  const lastEmitMsRef = useRef<number>(0);
  const pendingMoveRef = useRef<{
    x: number;
    height: number;
    action: PlayerMoveAction;
    status: PlayerStatus;
  } | null>(null);

  useEffect(() => {
    onSendMoveRef.current = onSendMove;
  }, [onSendMove]);

  useEffect(() => {
    onOfflineFinishRef.current = onOfflineFinish;
  }, [onOfflineFinish]);

  useEffect(() => {
    roomStateRef.current = roomState;
  }, [roomState]);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  // Reset match state cleanly on new match / rematch seed
  useEffect(() => {
    const startStep = steps[0];
    gameRef.current = {
      stepIndex: 0,
      visualX: startStep?.x ?? 0.5,
      visualHeight: 0,
      cameraHeight: 0,
      hop: null,
      slipElapsed: 0,
      lockTimer: 0,
      boulderInvulnTimer: 0,
      status: 'CLIMBING',
      finishTimeMs: null,
      offlineFinishDelaySec: 0,
      offlineFinishDispatched: false,
      toast: null,
      animClock: 0,
      finishedEmitted: false
    };
    activeBouldersRef.current = [];
    spawnedBoulderKeysRef.current.clear();
    proximityTriggeredStepsRef.current.clear();
    boulderSeqRef.current = 0;

    matchStartLocalMsRef.current = Date.now();
    elapsedMsRef.current = 0;
    lastEmitMsRef.current = 0;
    pendingMoveRef.current = null;

    if (isOffline) {
      botPrngRef.current = createMulberry32(roomState.seed ^ 0x9e3779b9);
      const bots = createInitialOfflineBots(roomState.seed);
      offlineBotsRef.current = bots;

      const ghostMap = new Map<string, RivalGhost>();
      for (const bot of bots) {
        ghostMap.set(bot.id, {
          id: bot.id,
          nickname: bot.nickname,
          color: bot.color,
          xNorm: 0.5,
          height: 0,
          targetXNorm: 0.5,
          targetHeight: 0,
          status: 'CLIMBING'
        });
      }
      rivalGhostsRef.current = ghostMap;
    } else {
      offlineBotsRef.current = [];
      rivalGhostsRef.current.clear();
    }
  }, [isOffline, roomState.seed, steps]);

  // Sync incoming 20Hz `match:state` rival positions in Online mode
  useEffect(() => {
    if (isOffline) return;

    const map = rivalGhostsRef.current;
    const activeIds = new Set<string>();

    for (const p of livePlayers) {
      if (p.id === playerId) continue;
      activeIds.add(p.id);
      const normX = Math.max(0.2, Math.min(0.8, p.x / WORLD_WIDTH));
      const existing = map.get(p.id);
      if (existing) {
        existing.targetXNorm = normX;
        existing.targetHeight = p.height;
        existing.status = p.status;
        existing.nickname = p.nickname;
        existing.color = p.color;
      } else {
        map.set(p.id, {
          id: p.id,
          nickname: p.nickname,
          color: p.color,
          xNorm: normX,
          height: p.height,
          targetXNorm: normX,
          targetHeight: p.height,
          status: p.status
        });
      }
    }

    for (const id of Array.from(map.keys())) {
      if (!activeIds.has(id)) {
        map.delete(id);
      }
    }
  }, [isOffline, livePlayers, playerId]);

  const queueOrEmitMove = useCallback(
    (
      normX: number,
      heightMeters: number,
      action: PlayerMoveAction,
      status: PlayerStatus,
      immediate: boolean
    ) => {
      if (isOffline) return;

      const g = gameRef.current;
      if (g.finishedEmitted) return;

      const worldX = Math.round(normX * WORLD_WIDTH * 10) / 10;
      const clampedH = Math.max(
        0,
        Math.min(roomState.targetHeight, Math.round(heightMeters * 10) / 10)
      );

      const payload = {
        x: worldX,
        height: clampedH,
        action,
        status
      };

      const nowMs = Date.now();
      if (
        immediate ||
        nowMs - lastEmitMsRef.current >= MOVE_EMIT_INTERVAL_MS
      ) {
        lastEmitMsRef.current = nowMs;
        pendingMoveRef.current = null;
        if (status === 'FINISHED') {
          g.finishedEmitted = true;
        }
        onSendMoveRef.current(payload);
      } else {
        pendingMoveRef.current = payload;
      }
    },
    [isOffline, roomState.targetHeight]
  );

  const triggerBoulderHit = useCallback(
    (hitFromX: number, hitFromHeight: number) => {
      const g = gameRef.current;
      const destIndex = Math.max(0, g.stepIndex - 3);
      const destStep = steps[destIndex]!;

      g.stepIndex = destIndex;
      g.slipElapsed = 0;
      g.lockTimer = BOULDER_STUN_SEC;
      g.boulderInvulnTimer = BOULDER_INVULN_SEC;
      g.status = 'STUNNED';
      g.hop = {
        fromX: hitFromX,
        fromHeight: hitFromHeight,
        toX: destStep.x,
        toHeight: destStep.height,
        elapsed: 0,
        duration: 0.34,
        arcMeters: 2.2,
        isFall: true
      };
      g.toast = {
        text: '🪨 BOULDER HIT! -30m',
        accent: '#FCA5A5',
        ttl: 1.0
      };

      void HapticsService.collision();
      queueOrEmitMove(destStep.x, destStep.height, 'STUN', 'STUNNED', true);
    },
    [queueOrEmitMove, steps]
  );

  // Strict 2-Lane Left / Right Tap Handler
  const handleTap = useCallback(
    (side: TapDirection) => {
      const g = gameRef.current;
      if (g.status === 'FINISHED' || g.lockTimer > 0) {
        return;
      }

      const nextStep = steps[g.stepIndex + 1];
      if (!nextStep) {
        return;
      }

      const currentStep = steps[g.stepIndex]!;

      // 1. Wrong-side tap -> whiff toward wrong lane & fall back 2 steps (-20m)
      if (side !== nextStep.requiredTap) {
        const destIndex = Math.max(0, g.stepIndex - 2);
        const destStep = steps[destIndex]!;
        const wrongX =
          side === 'LEFT'
            ? GAME_CONSTANTS.LEFT_LANE_X
            : GAME_CONSTANTS.RIGHT_LANE_X;

        g.stepIndex = destIndex;
        g.slipElapsed = 0;
        g.lockTimer = SLIP_LOCK_SEC;
        g.status = 'CLIMBING';
        g.hop = {
          fromX: (g.visualX + wrongX) * 0.5,
          fromHeight: g.visualHeight + 1.5,
          toX: destStep.x,
          toHeight: destStep.height,
          elapsed: 0,
          duration: 0.26,
          arcMeters: 1.8,
          isFall: true
        };
        g.toast = {
          text:
            destIndex < currentStep.index
              ? 'MISSED HOLD! -20m'
              : 'MISSED HOLD!',
          accent: '#FCD34D',
          ttl: 0.8
        };

        void HapticsService.warning();
        queueOrEmitMove(destStep.x, destStep.height, 'FALL', 'CLIMBING', false);
        return;
      }

      // 2. Correct-side tap -> advance +10m onto `nextStep`
      const prevBiome = currentStep.biome;
      g.stepIndex = nextStep.index;
      g.slipElapsed = 0;
      g.hop = {
        fromX: g.visualX,
        fromHeight: g.visualHeight,
        toX: nextStep.x,
        toHeight: nextStep.height,
        elapsed: 0,
        duration: 0.125,
        arcMeters: 2.8,
        isFall: false
      };

      if (nextStep.biome !== prevBiome) {
        g.toast = {
          text: `${BIOME_PALETTES[nextStep.biome].name.toUpperCase()} • ${
            nextStep.height
          }m`,
          accent: BIOME_PALETTES[nextStep.biome].pillText,
          ttl: 1.4
        };
      }

      const moveAction: PlayerMoveAction =
        side === 'LEFT' ? 'TAP_LEFT' : 'TAP_RIGHT';

      if (nextStep.height >= roomState.targetHeight) {
        const finishMs = Math.max(1, Date.now() - matchStartLocalMsRef.current);
        g.status = 'FINISHED';
        g.finishTimeMs = finishMs;
        g.offlineFinishDelaySec = 0.42;
        g.toast = {
          text: '🚩 SUMMIT CONQUERED!',
          accent: '#FEF08A',
          ttl: 2.2
        };
        void HapticsService.victory();
        queueOrEmitMove(
          nextStep.x,
          roomState.targetHeight,
          moveAction,
          'FINISHED',
          true
        );
      } else {
        g.status = 'CLIMBING';
        void HapticsService.jump();
        queueOrEmitMove(
          nextStep.x,
          nextStep.height,
          moveAction,
          'CLIMBING',
          false
        );
      }
    },
    [queueOrEmitMove, roomState.targetHeight, steps]
  );

  const handleArenaLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 60 && height > 120) {
      setViewport({ width, height });
    }
  }, []);

  // 60fps Game Loop: Climber, Non-Canceling Boulders, Offline AI Bots & Blizzard
  useEffect(() => {
    let rafId: number | null = null;
    let lastFrameTime: number | null = null;

    const commitBoulderInLane = (step: ClimbStep) => {
      const laneAlreadyBusy = activeBouldersRef.current.some(
        (b) => b.lane === step.requiredTap
      );
      if (laneAlreadyBusy) return;

      boulderSeqRef.current += 1;
      activeBouldersRef.current.push({
        id: `boulder-${step.index}-${boulderSeqRef.current}`,
        lane: step.requiredTap,
        laneX: step.x,
        phase: 'WARNING',
        elapsedSec: 0,
        warningDurationSec: BOULDER_WARNING_SEC,
        fallDurationSec: (step.activeDurationMs ?? 1080) / 1000,
        screenY: -60,
        spinDeg: 0,
        hitPlayer: false,
        hitBotIds: new Set<string>()
      });
    };

    const tick = (frameNow: number) => {
      const rawDt =
        lastFrameTime === null ? 0.016 : (frameNow - lastFrameTime) / 1000;
      lastFrameTime = frameNow;
      const dt = Math.min(0.05, Math.max(0.001, rawDt));

      const nowWallMs = Date.now();
      const elapsedMs = nowWallMs - matchStartLocalMsRef.current;
      elapsedMsRef.current = elapsedMs;

      const g = gameRef.current;
      g.animClock = (g.animClock + dt) % 3600;

      // Flush trailing throttled network move (Online mode)
      if (
        !isOffline &&
        pendingMoveRef.current &&
        nowWallMs - lastEmitMsRef.current >= MOVE_EMIT_INTERVAL_MS
      ) {
        const pending = pendingMoveRef.current;
        pendingMoveRef.current = null;
        lastEmitMsRef.current = nowWallMs;
        onSendMoveRef.current(pending);
      }

      if (g.lockTimer > 0) {
        g.lockTimer = Math.max(0, g.lockTimer - dt);
        if (g.lockTimer === 0 && g.status === 'STUNNED') {
          g.status = 'CLIMBING';
        }
      }

      if (g.boulderInvulnTimer > 0) {
        g.boulderInvulnTimer = Math.max(0, g.boulderInvulnTimer - dt);
      }

      if (g.toast) {
        g.toast.ttl -= dt;
        if (g.toast.ttl <= 0) {
          g.toast = null;
        }
      }

      // Interpolate local climber hop / fall arc
      const currentStep = steps[g.stepIndex]!;
      if (g.hop) {
        g.hop.elapsed += dt;
        const t = Math.min(1, g.hop.elapsed / g.hop.duration);
        const eased = 1 - Math.pow(1 - t, 2);
        const arc = Math.sin(t * Math.PI) * g.hop.arcMeters;

        g.visualX = g.hop.fromX + (g.hop.toX - g.hop.fromX) * eased;
        g.visualHeight =
          g.hop.fromHeight +
          (g.hop.toHeight - g.hop.fromHeight) * eased +
          arc;

        if (t >= 1) {
          g.visualX = currentStep.x;
          g.visualHeight = currentStep.height;
          g.hop = null;
        }
      } else {
        g.visualX = currentStep.x;
        g.visualHeight = currentStep.height;
      }

      // Slippery Ice Hold timed grip-slip (~0.75s; hold never breaks or disappears)
      if (
        currentStep.type === 'SLIPPERY_LEDGE' &&
        g.status !== 'FINISHED' &&
        g.lockTimer <= 0 &&
        g.hop === null
      ) {
        g.slipElapsed += dt;
        if (g.slipElapsed >= SLIP_LIMIT_SEC) {
          const destIndex = Math.max(0, g.stepIndex - 2);
          const destStep = steps[destIndex]!;

          g.stepIndex = destIndex;
          g.slipElapsed = 0;
          g.lockTimer = SLIP_LOCK_SEC;
          g.hop = {
            fromX: g.visualX,
            fromHeight: g.visualHeight,
            toX: destStep.x,
            toHeight: destStep.height,
            elapsed: 0,
            duration: 0.28,
            arcMeters: 1.0,
            isFall: true
          };
          g.toast = {
            text: '🧊 ICY SLIP! -20m',
            accent: '#7DD3FC',
            ttl: 0.85
          };

          void HapticsService.warning();
          queueOrEmitMove(
            destStep.x,
            destStep.height,
            'FALL',
            'CLIMBING',
            true
          );
        }
      }

      // Smoothly follow climber with closer camera FOV
      const targetCam = Math.max(0, g.visualHeight - 3);
      g.cameraHeight += (targetCam - g.cameraHeight) * Math.min(1, dt * 10);

      const playH = viewportRef.current.height;
      const anchorY = playH * (1 - BOTTOM_ANCHOR_RATIO);
      const climberCenterY =
        anchorY - (g.visualHeight - g.cameraHeight) * PIXELS_PER_METER - 22;

      // 1. Spawn new boulders into `activeBouldersRef` when approaching/cycling FALLING_ROCK steps
      const minScan = Math.max(1, g.stepIndex - 1);
      const maxScan = Math.min(steps.length - 1, g.stepIndex + 4);
      for (let idx = minScan; idx <= maxScan; idx++) {
        const st = steps[idx]!;
        if (st.type !== 'FALLING_ROCK') continue;

        const cycleMs = st.cycleMs ?? 3000;
        const offsetMs = st.phaseOffsetMs ?? 0;
        const cycleIdx = Math.floor(Math.max(0, elapsedMs + offsetMs) / cycleMs);
        const cycleKey = `${st.index}:${cycleIdx}`;

        // Immediate proximity trigger on first approach so speed-climbers never skip rockfalls
        if (
          !proximityTriggeredStepsRef.current.has(st.index) &&
          g.stepIndex >= st.index - 2 &&
          g.stepIndex <= st.index
        ) {
          proximityTriggeredStepsRef.current.add(st.index);
          spawnedBoulderKeysRef.current.add(cycleKey);
          commitBoulderInLane(st);
          continue;
        }

        const hz = evaluateHazardPhase(st, elapsedMs);
        if (
          hz.phase === 'WARNING' &&
          !spawnedBoulderKeysRef.current.has(cycleKey)
        ) {
          spawnedBoulderKeysRef.current.add(cycleKey);
          commitBoulderInLane(st);
        }
      }

      // 2. Advance every committed boulder independently to completion (never canceled early!)
      const remainingBoulders: ActiveBoulder[] = [];
      for (const b of activeBouldersRef.current) {
        if (b.phase === 'WARNING') {
          b.elapsedSec += dt;
          if (b.elapsedSec >= b.warningDurationSec) {
            const overflow = b.elapsedSec - b.warningDurationSec;
            b.phase = 'FALLING';
            b.elapsedSec = overflow;
          }
          remainingBoulders.push(b);
          continue;
        }

        // FALLING phase: continuous roll from y = -60px past playfieldHeight + 60px
        b.elapsedSec += dt;
        const progress = b.elapsedSec / b.fallDurationSec;
        b.screenY = -60 + progress * (playH + 130);
        b.spinDeg = progress * 560;

        // Live screen-space collision check against local climber
        if (
          !b.hitPlayer &&
          g.status !== 'FINISHED' &&
          g.boulderInvulnTimer <= 0 &&
          g.stepIndex > 0 &&
          !g.hop?.isFall
        ) {
          const sameLane = Math.abs(g.visualX - b.laneX) < 0.19;
          const verticalHit = Math.abs(climberCenterY - b.screenY) < 36;
          if (sameLane && verticalHit) {
            b.hitPlayer = true;
            triggerBoulderHit(g.visualX, g.visualHeight);
          }
        }

        if (b.screenY <= playH + 68) {
          remainingBoulders.push(b);
        }
      }
      activeBouldersRef.current = remainingBoulders;

      // 3. Simulate 3 local AI Rival Bots in Offline mode
      if (isOffline) {
        const botRng = botPrngRef.current;

        for (const bot of offlineBotsRef.current) {
          const botStep = steps[bot.stepIndex]!;

          // Interpolate bot hop arc
          if (bot.hop) {
            bot.hop.elapsed += dt;
            const bt = Math.min(1, bot.hop.elapsed / bot.hop.duration);
            const eased = 1 - Math.pow(1 - bt, 2);
            const arc = Math.sin(bt * Math.PI) * bot.hop.arcMeters;
            bot.visualX = bot.hop.fromX + (bot.hop.toX - bot.hop.fromX) * eased;
            bot.visualHeight =
              bot.hop.fromHeight +
              (bot.hop.toHeight - bot.hop.fromHeight) * eased +
              arc;
            if (bt >= 1) {
              bot.visualX = botStep.x;
              bot.visualHeight = botStep.height;
              bot.hop = null;
            }
          } else {
            bot.visualX = botStep.x;
            bot.visualHeight = botStep.height;
          }

          if (bot.status !== 'FINISHED') {
            if (bot.stunTimer > 0) {
              bot.stunTimer = Math.max(0, bot.stunTimer - dt);
              if (bot.stunTimer === 0) {
                bot.status = 'CLIMBING';
              }
            }

            // Check live boulder hit on visible AI bot
            if (bot.stunTimer <= 0 && bot.stepIndex > 0 && !bot.hop?.isFall) {
              const botScreenY =
                anchorY -
                (bot.visualHeight - g.cameraHeight) * PIXELS_PER_METER -
                22;
              if (botScreenY >= -40 && botScreenY <= playH + 40) {
                for (const b of activeBouldersRef.current) {
                  if (
                    b.phase === 'FALLING' &&
                    !b.hitBotIds.has(bot.id) &&
                    Math.abs(bot.visualX - b.laneX) < 0.19 &&
                    Math.abs(botScreenY - b.screenY) < 34
                  ) {
                    b.hitBotIds.add(bot.id);
                    const fallIdx = Math.max(0, bot.stepIndex - 3);
                    const fallDest = steps[fallIdx]!;
                    bot.stepIndex = fallIdx;
                    bot.slipElapsed = 0;
                    bot.stunTimer = BOULDER_STUN_SEC;
                    bot.decisionTimer = 0.52;
                    bot.status = 'STUNNED';
                    bot.hop = {
                      fromX: bot.visualX,
                      fromHeight: bot.visualHeight,
                      toX: fallDest.x,
                      toHeight: fallDest.height,
                      elapsed: 0,
                      duration: 0.32,
                      arcMeters: 2.0,
                      isFall: true
                    };
                    break;
                  }
                }
              }
            }

            // Bot slippery hold check
            if (
              botStep.type === 'SLIPPERY_LEDGE' &&
              bot.stunTimer <= 0 &&
              bot.hop === null
            ) {
              bot.slipElapsed += dt;
              if (bot.slipElapsed >= SLIP_LIMIT_SEC) {
                const fallIdx = Math.max(0, bot.stepIndex - 2);
                const fallDest = steps[fallIdx]!;
                bot.stepIndex = fallIdx;
                bot.slipElapsed = 0;
                bot.decisionTimer = botRng.nextFloat(0.26, 0.38);
                bot.hop = {
                  fromX: bot.visualX,
                  fromHeight: bot.visualHeight,
                  toX: fallDest.x,
                  toHeight: fallDest.height,
                  elapsed: 0,
                  duration: 0.26,
                  arcMeters: 1.0,
                  isFall: true
                };
              }
            }

            // Bot step decision cadence
            if (bot.stunTimer <= 0) {
              bot.decisionTimer -= dt;
              if (bot.decisionTimer <= 0) {
                const nextBotStep = steps[bot.stepIndex + 1];
                if (nextBotStep) {
                  // Check if next lane currently has a warning/falling boulder
                  const activeLaneDanger =
                    activeBouldersRef.current.some(
                      (b) => b.lane === nextBotStep.requiredTap
                    ) ||
                    (nextBotStep.type === 'FALLING_ROCK' &&
                      evaluateHazardPhase(nextBotStep, elapsedMs).phase !==
                        'SAFE');

                  if (
                    activeLaneDanger &&
                    botStep.type !== 'SLIPPERY_LEDGE' &&
                    botRng.next() < bot.cautionProb
                  ) {
                    // Cautiously pause on safe opposite-lane hold
                    bot.decisionTimer = botRng.nextFloat(0.2, 0.34);
                  } else if (
                    bot.stepIndex > 2 &&
                    botRng.next() < bot.mistakeProb
                  ) {
                    // Occasional wrong-lane slip (-20m) so bots feel human
                    const slipIdx = Math.max(0, bot.stepIndex - 2);
                    const slipDest = steps[slipIdx]!;
                    bot.stepIndex = slipIdx;
                    bot.slipElapsed = 0;
                    bot.decisionTimer = botRng.nextFloat(0.32, 0.46);
                    bot.hop = {
                      fromX: bot.visualX,
                      fromHeight: bot.visualHeight + 1.2,
                      toX: slipDest.x,
                      toHeight: slipDest.height,
                      elapsed: 0,
                      duration: 0.25,
                      arcMeters: 1.5,
                      isFall: true
                    };
                  } else {
                    // Advance +10m onto next hold
                    bot.stepIndex = nextBotStep.index;
                    bot.slipElapsed = 0;
                    bot.score = Math.max(
                      bot.score,
                      Math.round(nextBotStep.height * 10)
                    );
                    bot.hop = {
                      fromX: bot.visualX,
                      fromHeight: bot.visualHeight,
                      toX: nextBotStep.x,
                      toHeight: nextBotStep.height,
                      elapsed: 0,
                      duration: 0.13,
                      arcMeters: 2.6,
                      isFall: false
                    };

                    if (nextBotStep.height >= roomState.targetHeight) {
                      bot.status = 'FINISHED';
                      bot.finishTimeMs = Math.max(1, Math.round(elapsedMs));
                    } else if (nextBotStep.type === 'SLIPPERY_LEDGE') {
                      // Usually hop off ice quickly, occasionally hesitate & risk slipping
                      bot.decisionTimer =
                        botRng.next() < 0.1
                          ? 0.82
                          : botRng.nextFloat(0.18, 0.34);
                    } else {
                      bot.decisionTimer = botRng.nextFloat(
                        bot.minTapDelay,
                        bot.maxTapDelay
                      );
                    }
                  }
                }
              }
            }
          }

          // Sync bot into ghost map for unified rendering
          const ghost = rivalGhostsRef.current.get(bot.id);
          if (ghost) {
            ghost.xNorm = bot.visualX;
            ghost.height = bot.visualHeight;
            ghost.targetXNorm = bot.visualX;
            ghost.targetHeight = bot.visualHeight;
            ghost.status = bot.status;
          }
        }

        // Conclude Offline race smoothly once the local player reaches 500m
        if (g.status === 'FINISHED' && !g.offlineFinishDispatched) {
          g.offlineFinishDelaySec -= dt;
          if (g.offlineFinishDelaySec <= 0) {
            g.offlineFinishDispatched = true;

            const selfFinishMs =
              g.finishTimeMs ?? Math.max(1, Math.round(elapsedMs));
            const rawEntries: Array<Omit<MatchRankingEntry, 'rank'>> = [
              {
                playerId,
                nickname: selfNickname,
                color: selfColor,
                height: roomState.targetHeight,
                score: roomState.targetHeight * 10,
                status: 'FINISHED',
                finishTimeMs: selfFinishMs
              },
              ...offlineBotsRef.current.map((b) => {
                const botH =
                  b.status === 'FINISHED'
                    ? roomState.targetHeight
                    : steps[b.stepIndex]!.height;
                return {
                  playerId: b.id,
                  nickname: b.nickname,
                  color: b.color,
                  height: botH,
                  score: Math.max(b.score, Math.round(botH * 10)),
                  status: b.status,
                  finishTimeMs: b.finishTimeMs
                };
              })
            ];

            rawEntries.sort((a, b) => {
              if (a.finishTimeMs !== null && b.finishTimeMs !== null) {
                return a.finishTimeMs - b.finishTimeMs;
              }
              if (a.finishTimeMs !== null) return -1;
              if (b.finishTimeMs !== null) return 1;
              return b.height - a.height;
            });

            const rankings: MatchRankingEntry[] = rawEntries.map(
              (entry, idx) => ({
                ...entry,
                rank: idx + 1
              })
            );

            const nowFinished = Date.now();
            const baseRoom = roomStateRef.current;
            const finishedRoom: RoomState = {
              ...baseRoom,
              phase: 'FINISHED',
              status: 'FINISHED',
              finishedAt: nowFinished,
              winnerId: rankings[0]?.playerId ?? playerId,
              players: rankings.map((r) => ({
                id: r.playerId,
                nickname: r.nickname,
                name: r.nickname,
                isHost: r.playerId === playerId,
                isReady: true,
                color: r.color,
                height: r.height,
                x: WORLD_WIDTH * 0.5,
                y: r.height,
                score: r.score,
                status: r.status,
                finishTimeMs: r.finishTimeMs,
                ping: 0
              }))
            };

            onOfflineFinishRef.current?.({
              roomCode: baseRoom.code,
              winnerId: finishedRoom.winnerId,
              seed: baseRoom.seed,
              targetHeight: baseRoom.targetHeight,
              durationMs: selfFinishMs,
              reason: 'TARGET_REACHED',
              rankings,
              room: finishedRoom
            });
          }
        }
      } else {
        // Online mode: interpolate incoming 20Hz rival ghosts smoothly at 60fps
        const ghostLerp = Math.min(1, dt * 13);
        for (const ghost of rivalGhostsRef.current.values()) {
          ghost.xNorm += (ghost.targetXNorm - ghost.xNorm) * ghostLerp;
          ghost.height += (ghost.targetHeight - ghost.height) * ghostLerp;
        }
      }

      // Animate Summit ambient snow & left-to-right cosmetic Blizzard gusts
      const blizzard = evaluateSummitBlizzard(
        steps,
        g.visualHeight,
        elapsedMs,
        roomState.targetHeight
      );
      if (g.visualHeight >= 300 || blizzard.intensity > 0) {
        const gustMultiplier = 1 + blizzard.intensity * 3.8;
        for (const streak of snowRef.current) {
          streak.xPct =
            (streak.xPct + streak.speedX * gustMultiplier * dt) % 108;
          streak.yPct =
            (streak.yPct + streak.speedY * (1 + blizzard.intensity) * dt) % 104;
        }
      }

      setFrameTick((prev) => (prev + 1) & 0xffff);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [
    isOffline,
    playerId,
    queueOrEmitMove,
    roomState.targetHeight,
    selfColor,
    selfNickname,
    steps,
    triggerBoulderHit
  ]);

  // Derived values for current render frame
  const g = gameRef.current;
  const logicalStep = steps[g.stepIndex]!;
  const nextStep = steps[g.stepIndex + 1] ?? null;
  const elapsedNowMs = elapsedMsRef.current;

  const activeBiome = getBiomeForHeight(g.visualHeight, roomState.targetHeight);
  const palette = BIOME_PALETTES[activeBiome];

  // Clung snow intensity scales upward from Foothills (0.42) -> Cliffs (0.70) -> Summit (0.95)
  const snowPatchOpacity =
    activeBiome === 'SUMMIT' ? 0.94 : activeBiome === 'CLIFFS' ? 0.7 : 0.44;

  const blizzard = evaluateSummitBlizzard(
    steps,
    g.visualHeight,
    elapsedNowMs,
    roomState.targetHeight
  );

  const playfieldWidth = Math.max(240, viewport.width - 32);
  const playfieldHeight = viewport.height;
  const cliffMargin = Math.max(12, Math.round(playfieldWidth * 0.055));
  const cliffWidth = playfieldWidth - cliffMargin * 2;
  const anchorY = playfieldHeight * (1 - BOTTOM_ANCHOR_RATIO);

  const worldToScreenY = (meters: number): number =>
    anchorY - (meters - g.cameraHeight) * PIXELS_PER_METER;

  const normToCliffX = (normX: number): number =>
    cliffMargin + normX * cliffWidth;

  const minVisibleM = g.cameraHeight - 24;
  const maxVisibleM = g.cameraHeight + anchorY / PIXELS_PER_METER + 16;

  const visibleSteps = steps.filter(
    (s) => s.height >= minVisibleM && s.height <= maxVisibleM
  );

  const allRivals = Array.from(rivalGhostsRef.current.values());
  const visibleGhosts = allRivals.filter(
    (rg) => rg.height >= minVisibleM && rg.height <= maxVisibleM
  );

  const summitScreenY = worldToScreenY(roomState.targetHeight);
  const cliffTopY = Math.max(-40, summitScreenY - 12);

  const farParallaxY = Math.min(90, g.cameraHeight * 0.14);
  const midParallaxY = Math.min(140, g.cameraHeight * 0.28);

  const isSlippingNow =
    logicalStep.type === 'SLIPPERY_LEDGE' &&
    g.lockTimer <= 0 &&
    g.hop === null &&
    g.status !== 'FINISHED';
  const slipWobblePx = isSlippingNow ? Math.sin(g.animClock * 38) * 3.5 : 0;

  const climberScreenX = normToCliffX(g.visualX) - 19 + slipWobblePx;
  const climberScreenY = worldToScreenY(g.visualHeight) - 43;
  const arrowBobPx = Math.sin(g.animClock * 7.5) * 4;

  const selfProgressPct = Math.min(
    100,
    Math.max(0, (logicalStep.height / roomState.targetHeight) * 100)
  );

  const scrollPx = g.cameraHeight * PIXELS_PER_METER;

  return (
    <View style={styles.root}>
      {/* Compact Game HUD */}
      <View style={styles.hudBar}>
        <View style={styles.hudAltitudeBox}>
          <Text style={styles.hudSmallCap}>ELEVATION</Text>
          <Text style={styles.hudMeters}>
            {logicalStep.height}m
            <Text style={styles.hudGoalMeters}>/{roomState.targetHeight}m</Text>
          </Text>
        </View>

        <View style={styles.hudCenterBox}>
          <Text style={styles.hudClock}>{formatTimer(elapsedNowMs)}</Text>
          <View style={styles.hudPillsRow}>
            <View
              style={[styles.biomeBadge, { backgroundColor: palette.pillBg }]}
            >
              <Text
                style={[styles.biomeBadgeText, { color: palette.pillText }]}
              >
                {palette.name}
              </Text>
            </View>
            <Text style={styles.roomBadgeText}>
              {isOffline ? 'VS AI' : roomState.code}
            </Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.exitButton,
            pressed && styles.exitButtonPressed
          ]}
          onPress={onLeaveRoom}
        >
          <Text style={styles.exitButtonText}>Exit</Text>
        </Pressable>
      </View>

      {/* Mountain Arena + Right Altitude Rail */}
      <View style={styles.arenaRow} onLayout={handleArenaLayout}>
        <View
          style={[
            styles.playfield,
            { width: playfieldWidth, backgroundColor: palette.skyBg }
          ]}
        >
          {/* Starry Night Sky Twinkles */}
          <View pointerEvents="none" style={styles.starsLayer}>
            <View style={[styles.starDot, { left: '12%', top: '8%' }]} />
            <View style={[styles.starDot, { left: '84%', top: '11%' }]} />
            <View style={[styles.starDot, { left: '26%', top: '19%' }]} />
            <View style={[styles.starDot, { left: '74%', top: '24%' }]} />
            <View style={[styles.starDot, { left: '91%', top: '33%' }]} />
          </View>

          {/* Layer 1: Far Parallax Snowy Mountain Silhouettes */}
          <View
            pointerEvents="none"
            style={[
              styles.parallaxLayer,
              { transform: [{ translateY: farParallaxY }] }
            ]}
          >
            <View
              style={[
                styles.mountainPeakFarLeft,
                { backgroundColor: palette.farPeakColor }
              ]}
            >
              <View style={styles.distantPeakSnowCap} />
            </View>
            <View
              style={[
                styles.mountainPeakFarRight,
                { backgroundColor: palette.farPeakColor }
              ]}
            >
              <View style={styles.distantPeakSnowCap} />
            </View>
          </View>

          {/* Layer 2: Mid Parallax Craggy Ridges */}
          <View
            pointerEvents="none"
            style={[
              styles.parallaxLayer,
              { transform: [{ translateY: midParallaxY }] }
            ]}
          >
            <View
              style={[
                styles.mountainPeakMidLeft,
                { backgroundColor: palette.midPeakColor }
              ]}
            />
            <View
              style={[
                styles.mountainPeakMidRight,
                { backgroundColor: palette.midPeakColor }
              ]}
            />
          </View>

          {/* Layer 3: Rugged Snowy Rock Cliff Wall (0m -> 500m Snowy Peak) */}
          <View
            pointerEvents="none"
            style={[
              styles.cliffWall,
              {
                left: cliffMargin,
                width: cliffWidth,
                top: cliffTopY,
                backgroundColor: palette.cliffFace,
                borderColor: palette.cliffEdge
              }
            ]}
          >
            {/* Jagged Left & Right Rock Crag Buttresses */}
            {EDGE_CRAGS.map((cragIdx) => {
              const edgeY =
                ((scrollPx + cragIdx * 112) % CLIFF_TILE_PERIOD_PX) - 40;
              return (
                <React.Fragment key={`edge-crag-${cragIdx}`}>
                  <View
                    style={[
                      styles.leftEdgeCrag,
                      {
                        top: edgeY,
                        backgroundColor: palette.rockCragEdge
                      }
                    ]}
                  />
                  <View
                    style={[
                      styles.rightEdgeCrag,
                      {
                        top: edgeY + 52,
                        backgroundColor: palette.rockCragEdge
                      }
                    ]}
                  />
                </React.Fragment>
              );
            })}

            {/* Scrolling Angular Stone Facets, Fissure Cracks & Clung White Snow Patches */}
            {CLIFF_FACETS.map((f) => {
              const topPx =
                ((scrollPx + f.baseOffsetPx) % CLIFF_TILE_PERIOD_PX) - 50;

              if (f.isCrack) {
                return (
                  <View
                    key={`fissure-${f.id}`}
                    style={[
                      styles.rockFissureCrack,
                      {
                        left: `${f.leftPct}%`,
                        top: topPx,
                        height: f.heightPx,
                        backgroundColor: palette.fissureColor,
                        transform: [{ rotate: f.rotateDeg }]
                      }
                    ]}
                  />
                );
              }

              return (
                <View
                  key={`facet-${f.id}`}
                  style={[
                    styles.rockFacetPolygon,
                    {
                      left: `${f.leftPct}%`,
                      top: topPx,
                      width: `${f.widthPct}%`,
                      height: f.heightPx,
                      backgroundColor: palette.rockPatch,
                      borderBottomColor: palette.rockCragEdge,
                      transform: [{ rotate: f.rotateDeg }]
                    }
                  ]}
                >
                  {f.hasSnowPatch && (
                    <View
                      style={[
                        styles.clungSnowShelf,
                        {
                          opacity: snowPatchOpacity,
                          height: activeBiome === 'SUMMIT' ? 8 : 5
                        }
                      ]}
                    />
                  )}
                </View>
              );
            })}

            {/* Strict 50/50 Center Vertical Dihedral Lane Seam (kept clear) */}
            <View
              style={[
                styles.centerRockSeam,
                { backgroundColor: palette.cliffSeam }
              ]}
            />

            {/* Thick Snowy Summit Crest at 500m */}
            {summitScreenY > -80 && <View style={styles.summitSnowCrest} />}
          </View>

          {/* Summit Golden Flagpole at 500m Crest */}
          {summitScreenY > -40 && summitScreenY < playfieldHeight + 40 && (
            <View
              pointerEvents="none"
              style={[
                styles.summitPoleContainer,
                {
                  transform: [
                    { translateX: playfieldWidth * 0.5 - 26 },
                    { translateY: summitScreenY - 56 }
                  ]
                }
              ]}
            >
              <View style={styles.flagPole} />
              <View style={styles.goldenFlagBanner}>
                <Text style={styles.goldenFlagText}>SUMMIT 500m</Text>
              </View>
            </View>
          )}

          {/* Inverted-Triangle Snow-Capped Rock & Ice Holds */}
          {visibleSteps.map((step) => {
            const screenY = worldToScreenY(step.height);
            const isBase = step.index === 0;
            const isSummit = step.height >= roomState.targetHeight;
            const isNextHold = nextStep?.index === step.index;
            const isCurrentHold = logicalStep.index === step.index;

            const slipPct =
              isCurrentHold && isSlippingNow
                ? Math.min(1, g.slipElapsed / SLIP_LIMIT_SEC)
                : 0;

            if (isBase || isSummit) {
              const shelfW = isBase ? cliffWidth - 18 : cliffWidth * 0.74;
              const shelfLeft = playfieldWidth * 0.5 - shelfW / 2;
              return (
                <React.Fragment key={step.id}>
                  <View
                    pointerEvents="none"
                    style={[
                      styles.landmarkShelf,
                      {
                        width: shelfW,
                        backgroundColor: isSummit ? '#CA8A04' : '#334155',
                        borderColor: isSummit ? '#FEF08A' : '#64748B',
                        transform: [
                          { translateX: shelfLeft },
                          { translateY: screenY }
                        ]
                      }
                    ]}
                  >
                    <View
                      style={[
                        styles.landmarkSnowTop,
                        {
                          backgroundColor: isSummit ? '#FEF9C3' : '#F8FAFC'
                        }
                      ]}
                    />
                  </View>

                  {isNextHold && g.status !== 'FINISHED' && (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.nextArrowCallout,
                        {
                          transform: [
                            { translateX: normToCliffX(step.x) - 25 },
                            { translateY: screenY - 38 + arrowBobPx }
                          ]
                        }
                      ]}
                    >
                      <Text style={styles.nextArrowText}>
                        {step.requiredTap === 'LEFT' ? '◀' : '▶'}
                      </Text>
                    </View>
                  )}
                </React.Fragment>
              );
            }

            const isIcyHold = step.type === 'SLIPPERY_LEDGE';
            const holdWidth = isIcyHold
              ? SNOWY_ICE_HOLD_WIDTH
              : SNOWY_ROCK_HOLD_WIDTH;
            const centerX = normToCliffX(step.x);
            const leftPx = centerX - holdWidth / 2;

            return (
              <React.Fragment key={step.id}>
                <View
                  pointerEvents="none"
                  style={[
                    styles.holdPosWrap,
                    {
                      transform: [
                        { translateX: leftPx },
                        { translateY: screenY }
                      ]
                    }
                  ]}
                >
                  {isIcyHold ? (
                    <SnowyIceHold
                      width={SNOWY_ICE_HOLD_WIDTH}
                      isTarget={isNextHold}
                      slipProgress={slipPct}
                    />
                  ) : (
                    <SnowyRockHold
                      width={SNOWY_ROCK_HOLD_WIDTH}
                      isTarget={isNextHold}
                      rockMainColor={palette.graniteBody}
                      rockLightColor={palette.graniteLight}
                      rockDarkColor={palette.graniteShadow}
                    />
                  )}
                </View>

                {/* Next-Hold Direction Callout */}
                {isNextHold && g.status !== 'FINISHED' && (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.nextArrowCallout,
                      {
                        transform: [
                          { translateX: centerX - 25 },
                          { translateY: screenY - 38 + arrowBobPx }
                        ]
                      }
                    ]}
                  >
                    <Text style={styles.nextArrowText}>
                      {step.requiredTap === 'LEFT' ? '◀' : '▶'}
                    </Text>
                  </View>
                )}
              </React.Fragment>
            );
          })}

          {/* Translucent Rival Climber Ghosts (Online Rivals or Offline AI Bots) */}
          {visibleGhosts.map((ghost) => {
            const gx = normToCliffX(ghost.xNorm) - 19;
            const gy = worldToScreenY(ghost.height) - 43;
            return (
              <View
                key={ghost.id}
                pointerEvents="none"
                style={[
                  styles.ghostWrap,
                  {
                    transform: [{ translateX: gx - 16 }, { translateY: gy - 16 }]
                  }
                ]}
              >
                <Text
                  style={[styles.ghostTag, { color: ghost.color }]}
                  numberOfLines={1}
                >
                  {ghost.nickname}
                </Text>
                <ClimberAvatar
                  jacketColor={ghost.color}
                  reachLeft={ghost.xNorm < 0.5}
                  isHopping={false}
                  isStunned={ghost.status === 'STUNNED'}
                  isGhost
                />
              </View>
            );
          })}

          {/* Local Player Climber */}
          <View
            pointerEvents="none"
            style={[
              styles.localClimberPos,
              {
                opacity:
                  g.boulderInvulnTimer > 0 &&
                  Math.floor(g.animClock * 16) % 2 === 1
                    ? 0.45
                    : 1,
                transform: [
                  { translateX: climberScreenX },
                  { translateY: climberScreenY }
                ]
              }
            ]}
          >
            <ClimberAvatar
              jacketColor={selfColor}
              reachLeft={
                g.hop ? g.hop.toX < 0.5 : logicalStep.index % 2 === 1
              }
              isHopping={g.hop !== null}
              isStunned={g.status === 'STUNNED'}
            />
          </View>

          {/* Decoupled, Non-Canceling Full-Screen Lane Boulders */}
          {activeBouldersRef.current.map((boulder) => {
            const laneCenterX = normToCliffX(boulder.laneX);
            const warnPulse = 0.68 + Math.sin(g.animClock * 18) * 0.32;

            return (
              <React.Fragment key={boulder.id}>
                <View
                  pointerEvents="none"
                  style={[
                    styles.boulderLaneTrack,
                    { left: laneCenterX - 30 }
                  ]}
                />

                {/* Pinned Top-Edge Warning Badge */}
                <View
                  pointerEvents="none"
                  style={[
                    styles.topEdgeRockWarning,
                    {
                      opacity: boulder.phase === 'WARNING' ? warnPulse : 0.92,
                      transform: [{ translateX: laneCenterX - 52 }]
                    }
                  ]}
                >
                  <Text style={styles.topEdgeRockWarningText}>
                    ⚠ ROCKFALL
                  </Text>
                </View>

                {/* Rolling Full-Screen Boulder (-60px -> viewportHeight + 60px) */}
                {boulder.phase === 'FALLING' && (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.tumblingBoulderWrap,
                      {
                        transform: [
                          { translateX: laneCenterX - BOULDER_SIZE_PX / 2 },
                          { translateY: boulder.screenY - BOULDER_SIZE_PX / 2 }
                        ]
                      }
                    ]}
                  >
                    <BoulderSprite
                      size={BOULDER_SIZE_PX}
                      spinDeg={`${Math.round(boulder.spinDeg)}deg`}
                    />
                  </View>
                )}
              </React.Fragment>
            );
          })}

          {/* Summit Ambient Snow & Cosmetic Full-Screen Left-to-Right Blizzard Whiteout (350-500m) */}
          {(activeBiome === 'SUMMIT' || blizzard.intensity > 0.02) && (
            <View pointerEvents="none" style={styles.blizzardOverlayLayer}>
              {blizzard.intensity > 0.02 && (
                <View
                  style={[
                    styles.whiteoutVeil,
                    { opacity: blizzard.intensity }
                  ]}
                />
              )}

              {snowRef.current.map((s) => {
                const isGusting = blizzard.intensity > 0.12;
                return (
                  <View
                    key={`streak-${s.id}`}
                    style={[
                      styles.snowParticle,
                      {
                        left: `${s.xPct - 4}%`,
                        top: `${s.yPct}%`,
                        width: isGusting ? s.width * 2.2 : 5,
                        height: isGusting ? 2.5 : 5,
                        borderRadius: 3,
                        opacity: isGusting
                          ? 0.45 + blizzard.intensity * 0.45
                          : 0.55,
                        transform: [{ rotate: isGusting ? '10deg' : '0deg' }]
                      }
                    ]}
                  />
                );
              })}

              {blizzard.phase === 'ACTIVE' && (
                <View style={styles.blizzardTopPill}>
                  <Text style={styles.blizzardTopPillText}>
                    ❄ SUMMIT WHITEOUT ▶▶
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Non-Blocking Top Floating Toast */}
          {g.toast && (
            <View pointerEvents="none" style={styles.toastWrap}>
              <View style={styles.toastPill}>
                <Text style={[styles.toastText, { color: g.toast.accent }]}>
                  {g.toast.text}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Right-Side Vertical Altitude Progress Rail (Shows Online Rivals or Offline AI Bots) */}
        <View style={styles.altitudeRail}>
          <Text style={styles.railFlag}>🚩</Text>
          <View style={styles.railBar}>
            <View style={[styles.railTick, { bottom: '30%' }]} />
            <View style={[styles.railTick, { bottom: '70%' }]} />

            {allRivals.map((rival) => {
              const pct = Math.min(
                100,
                Math.max(0, (rival.height / roomState.targetHeight) * 100)
              );
              return (
                <View
                  key={`rail-${rival.id}`}
                  style={[
                    styles.railRivalMarker,
                    { bottom: `${pct}%`, backgroundColor: rival.color }
                  ]}
                />
              );
            })}

            <View
              style={[
                styles.railSelfMarker,
                { bottom: `${selfProgressPct}%`, backgroundColor: selfColor }
              ]}
            />
          </View>
          <Text style={styles.railBaseText}>0m</Text>
        </View>
      </View>

      {/* Pure 2-Button 50/50 Left & Right Tap Controls */}
      <View style={styles.controlsDeck}>
        <Pressable
          style={({ pressed }) => [
            styles.laneTapBtn,
            nextStep?.requiredTap === 'LEFT' && styles.laneTapBtnHighlighted,
            pressed && styles.laneTapBtnPressed,
            g.lockTimer > 0 && styles.laneTapBtnLocked
          ]}
          onPressIn={() => handleTap('LEFT')}
        >
          <Text style={styles.laneTapTitle}>◀ LEFT</Text>
          <Text style={styles.laneTapHint}>LEFT LANE</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.laneTapBtn,
            nextStep?.requiredTap === 'RIGHT' && styles.laneTapBtnHighlighted,
            pressed && styles.laneTapBtnPressed,
            g.lockTimer > 0 && styles.laneTapBtnLocked
          ]}
          onPressIn={() => handleTap('RIGHT')}
        >
          <Text style={styles.laneTapTitle}>RIGHT ▶</Text>
          <Text style={styles.laneTapHint}>RIGHT LANE</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: Platform.OS === 'ios' ? 16 : 12,
    backgroundColor: '#090F1D'
  },
  hudBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#131E33',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#283959'
  },
  hudAltitudeBox: {
    minWidth: 92
  },
  hudSmallCap: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.9
  },
  hudMeters: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
    fontFamily: 'monospace'
  },
  hudGoalMeters: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700'
  },
  hudCenterBox: {
    alignItems: 'center',
    flex: 1
  },
  hudClock: {
    color: '#38BDF8',
    fontSize: 15,
    fontWeight: '900',
    fontFamily: 'monospace'
  },
  hudPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3
  },
  biomeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8
  },
  biomeBadgeText: {
    fontSize: 10,
    fontWeight: '800'
  },
  roomBadgeText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6
  },
  exitButton: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#475569'
  },
  exitButtonPressed: {
    backgroundColor: '#7F1D1D',
    borderColor: '#EF4444'
  },
  exitButtonText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '800'
  },
  arenaRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10
  },
  playfield: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#283959',
    position: 'relative'
  },
  starsLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  },
  starDot: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#E0F2FE',
    opacity: 0.68
  },
  parallaxLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '100%'
  },
  mountainPeakFarLeft: {
    position: 'absolute',
    left: -70,
    bottom: '22%',
    width: 240,
    height: 240,
    borderRadius: 14,
    transform: [{ rotate: '45deg' }],
    overflow: 'hidden'
  },
  mountainPeakFarRight: {
    position: 'absolute',
    right: -60,
    bottom: '28%',
    width: 260,
    height: 260,
    borderRadius: 16,
    transform: [{ rotate: '45deg' }],
    overflow: 'hidden'
  },
  distantPeakSnowCap: {
    width: 68,
    height: 68,
    backgroundColor: 'rgba(241, 245, 249, 0.22)'
  },
  mountainPeakMidLeft: {
    position: 'absolute',
    left: -50,
    bottom: '6%',
    width: 210,
    height: 210,
    borderRadius: 12,
    transform: [{ rotate: '45deg' }]
  },
  mountainPeakMidRight: {
    position: 'absolute',
    right: -55,
    bottom: '10%',
    width: 225,
    height: 225,
    borderRadius: 12,
    transform: [{ rotate: '45deg' }]
  },
  cliffWall: {
    position: 'absolute',
    bottom: -40,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderTopWidth: 3,
    overflow: 'hidden'
  },
  leftEdgeCrag: {
    position: 'absolute',
    left: -14,
    width: 28,
    height: 44,
    borderRadius: 5,
    transform: [{ rotate: '28deg' }]
  },
  rightEdgeCrag: {
    position: 'absolute',
    right: -14,
    width: 28,
    height: 44,
    borderRadius: 5,
    transform: [{ rotate: '-28deg' }]
  },
  rockFacetPolygon: {
    position: 'absolute',
    borderRadius: 7,
    borderBottomWidth: 3,
    overflow: 'hidden',
    opacity: 0.72
  },
  clungSnowShelf: {
    position: 'absolute',
    top: 0,
    left: 2,
    right: 4,
    backgroundColor: '#F1F5F9',
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5
  },
  rockFissureCrack: {
    position: 'absolute',
    width: 2.5,
    borderRadius: 2,
    opacity: 0.65
  },
  summitSnowCrest: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 28,
    backgroundColor: '#F8FAFC',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16
  },
  centerRockSeam: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 3,
    marginLeft: -1.5,
    opacity: 0.78
  },
  summitPoleContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  flagPole: {
    width: 4,
    height: 54,
    backgroundColor: '#FDE047',
    borderRadius: 2
  },
  goldenFlagBanner: {
    backgroundColor: '#EAB308',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    borderWidth: 1.5,
    borderColor: '#FEF9C3',
    marginTop: 2
  },
  goldenFlagText: {
    color: '#0F172A',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  holdPosWrap: {
    position: 'absolute',
    left: 0,
    top: 0
  },
  landmarkShelf: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 26,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    borderWidth: 1.5,
    borderBottomWidth: 6,
    borderBottomColor: '#1E293B',
    overflow: 'hidden'
  },
  landmarkSnowTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 8
  },
  nextArrowCallout: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#0284C7',
    borderWidth: 2,
    borderColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  nextArrowText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900'
  },
  climberRoot: {
    width: 38,
    height: 44,
    alignItems: 'center',
    position: 'relative'
  },
  climberGhostRoot: {
    opacity: 0.54
  },
  climberPack: {
    position: 'absolute',
    top: 15,
    width: 11,
    height: 17,
    borderRadius: 4,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#64748B'
  },
  packLeft: {
    left: 2
  },
  packRight: {
    right: 2
  },
  climberHead: {
    width: 18,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#0F172A',
    zIndex: 3
  },
  climberHelmet: {
    width: '100%',
    height: 6
  },
  climberGoggles: {
    marginTop: 1,
    width: 13,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    paddingLeft: 2
  },
  goggleGlint: {
    width: 4,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#7DD3FC'
  },
  climberTorso: {
    width: 20,
    height: 17,
    borderRadius: 6,
    marginTop: -1,
    borderWidth: 1.5,
    borderColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2
  },
  climberHarness: {
    width: 4,
    height: '100%',
    backgroundColor: 'rgba(248, 250, 252, 0.65)'
  },
  climberArm: {
    position: 'absolute',
    top: 16,
    width: 7,
    height: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#0F172A',
    zIndex: 4
  },
  armLeft: {
    left: 4,
    transform: [{ rotate: '18deg' }]
  },
  armRight: {
    right: 4,
    transform: [{ rotate: '-18deg' }]
  },
  armRaisedLeft: {
    top: 6,
    transform: [{ rotate: '-28deg' }]
  },
  armRaisedRight: {
    top: 6,
    transform: [{ rotate: '28deg' }]
  },
  climberLegsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: -2,
    zIndex: 1
  },
  climberLeg: {
    width: 7,
    height: 12,
    borderRadius: 3.5,
    backgroundColor: '#1E293B',
    borderBottomWidth: 4,
    borderBottomColor: '#78350F'
  },
  legTucked: {
    height: 8
  },
  localClimberPos: {
    position: 'absolute',
    left: 0,
    top: 0
  },
  ghostWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 70,
    alignItems: 'center'
  },
  ghostTag: {
    fontSize: 9,
    fontWeight: '800',
    backgroundColor: 'rgba(9, 15, 29, 0.82)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginBottom: 2
  },
  boulderLaneTrack: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 60,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(248, 113, 113, 0.28)'
  },
  topEdgeRockWarning: {
    position: 'absolute',
    left: 0,
    top: 8,
    width: 104,
    backgroundColor: '#991B1B',
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    alignItems: 'center'
  },
  topEdgeRockWarningText: {
    color: '#FEF08A',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6
  },
  tumblingBoulderWrap: {
    position: 'absolute',
    left: 0,
    top: 0
  },
  blizzardOverlayLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  },
  whiteoutVeil: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#E0F2FE'
  },
  snowParticle: {
    position: 'absolute',
    backgroundColor: '#F8FAFC'
  },
  blizzardTopPill: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    backgroundColor: 'rgba(12, 74, 110, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD'
  },
  blizzardTopPillText: {
    color: '#F0F9FF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1
  },
  toastWrap: {
    position: 'absolute',
    top: 44,
    left: 14,
    right: 14,
    alignItems: 'center'
  },
  toastPill: {
    backgroundColor: 'rgba(9, 15, 29, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155'
  },
  toastText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6
  },
  altitudeRail: {
    width: 26,
    backgroundColor: '#131E33',
    borderRadius: 14,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#283959'
  },
  railFlag: {
    fontSize: 11,
    marginBottom: 6
  },
  railBar: {
    flex: 1,
    width: 6,
    backgroundColor: '#090F1D',
    borderRadius: 3,
    position: 'relative',
    marginVertical: 2
  },
  railTick: {
    position: 'absolute',
    left: -3,
    right: -3,
    height: 1,
    backgroundColor: '#334155'
  },
  railRivalMarker: {
    position: 'absolute',
    left: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: -5,
    opacity: 0.88,
    borderWidth: 1,
    borderColor: '#090F1D'
  },
  railSelfMarker: {
    position: 'absolute',
    left: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    marginBottom: -7,
    borderWidth: 2,
    borderColor: '#FFFFFF'
  },
  railBaseText: {
    color: '#64748B',
    fontSize: 8,
    fontWeight: '800',
    marginTop: 4
  },
  controlsDeck: {
    flexDirection: 'row',
    gap: 12,
    height: 82
  },
  laneTapBtn: {
    flex: 1,
    backgroundColor: '#162238',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: '#334155',
    borderBottomColor: '#0B1324'
  },
  laneTapBtnHighlighted: {
    backgroundColor: '#172E54',
    borderColor: '#38BDF8',
    borderBottomColor: '#0369A1'
  },
  laneTapBtnPressed: {
    backgroundColor: '#2563EB',
    borderColor: '#E0F2FE',
    transform: [{ translateY: 2 }]
  },
  laneTapBtnLocked: {
    opacity: 0.48
  },
  laneTapTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 1
  },
  laneTapHint: {
    color: '#93C5FD',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.8
  }
});
