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
  evaluateHazardPhase,
  evaluateSummitBlizzard,
  GAME_CONSTANTS,
  generateMountainSteps,
  getBiomeForHeight,
  MountainBiome,
  PlayerMoveAction,
  PlayerStatus,
  RoomState,
  SanitizedPlayerPosition,
  TapDirection
} from '@climb/shared';
import { MoveSubmission } from '../hooks/useMultiplayerLobby';
import { HapticsService } from '../haptics/hapticsService';

export interface GameScreenProps {
  roomState: RoomState;
  playerId: string;
  livePlayers: SanitizedPlayerPosition[];
  onSendMove: (move: MoveSubmission) => void;
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
  height: number;
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
  toast: FloatingToast | null;
  animClock: number;
  finishedEmitted: boolean;
}

const WORLD_WIDTH = GAME_CONSTANTS.WORLD_WIDTH; // 400
const SLIP_LIMIT_SEC = 0.75; // 0.75s timed grip before sliding back 2 steps
const SLIP_LOCK_SEC = 0.3;
const BOULDER_STUN_SEC = 0.45;
const BOULDER_INVULN_SEC = 1.15;

// Closer Camera FOV: 120px per 10m step -> 4 to 5 ledges visible on screen
const PIXELS_PER_METER = 12.0;
const BOTTOM_ANCHOR_RATIO = 0.23;
const HOLD_WIDTH_PX = 104;
const HOLD_HEIGHT_PX = 24;
const BOULDER_SIZE_PX = 48;
const MOVE_EMIT_INTERVAL_MS = 55;

interface BiomePalette {
  name: string;
  skyBg: string;
  farPeakColor: string;
  midPeakColor: string;
  cliffFace: string;
  cliffEdge: string;
  cliffSeam: string;
  rockPatch: string;
  graniteBody: string;
  graniteTop: string;
  graniteShadow: string;
  pillBg: string;
  pillText: string;
}

const BIOME_PALETTES: Record<MountainBiome, BiomePalette> = {
  FOOTHILLS: {
    name: 'Rocky Foothills',
    skyBg: '#221A2E',
    farPeakColor: '#312542',
    midPeakColor: '#261F33',
    cliffFace: '#3A3335',
    cliffEdge: '#574C4F',
    cliffSeam: '#262123',
    rockPatch: '#463E40',
    graniteBody: '#6B6360',
    graniteTop: '#D6D3D1',
    graniteShadow: '#292524',
    pillBg: 'rgba(120, 53, 15, 0.75)',
    pillText: '#FDE68A'
  },
  CLIFFS: {
    name: 'Steep Cliffs',
    skyBg: '#0E1E38',
    farPeakColor: '#172E52',
    midPeakColor: '#122442',
    cliffFace: '#273449',
    cliffEdge: '#475569',
    cliffSeam: '#182232',
    rockPatch: '#334155',
    graniteBody: '#475569',
    graniteTop: '#E2E8F0',
    graniteShadow: '#0F172A',
    pillBg: 'rgba(12, 74, 110, 0.78)',
    pillText: '#BAE6FD'
  },
  SUMMIT: {
    name: 'Alpine Summit',
    skyBg: '#060E21',
    farPeakColor: '#132747',
    midPeakColor: '#0D1D38',
    cliffFace: '#1E2D45',
    cliffEdge: '#64748B',
    cliffSeam: '#111B2E',
    rockPatch: '#293B59',
    graniteBody: '#3B4D6B',
    graniteTop: '#F8FAFC', // Snow-draped granite shelf
    graniteShadow: '#091120',
    pillBg: 'rgba(22, 78, 99, 0.85)',
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
    width: i % 3 === 0 ? 28 : 14,
    height: i % 3 === 0 ? 3 : 4
  }));
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

/**
 * Stylized layered mountaineer character built from pure React Native Views:
 * helmet/beanie, ski goggles, backpack, puffer jacket, and animated limbs.
 */
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
      {/* Backpack */}
      <View
        style={[
          styles.climberPack,
          reachLeft ? styles.packRight : styles.packLeft
        ]}
      />

      {/* Arms */}
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

      {/* Helmet / Beanie + Head + Ski Goggles */}
      <View style={styles.climberHead}>
        <View
          style={[styles.climberHelmet, { backgroundColor: activeJacket }]}
        />
        <View style={styles.climberGoggles}>
          <View style={styles.goggleGlint} />
        </View>
      </View>

      {/* Jacket Torso + Harness */}
      <View
        style={[styles.climberTorso, { backgroundColor: activeJacket }]}
      >
        <View style={styles.climberHarness} />
      </View>

      {/* Climbing Boots / Legs */}
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
  roomState,
  playerId,
  livePlayers,
  onSendMove,
  onLeaveRoom
}) => {
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
  const selfColor = selfPlayer?.color ?? '#38BDF8';

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
    toast: null,
    animClock: 0,
    finishedEmitted: false
  });

  const snowRef = useRef<SnowStreak[]>(createSnowStreaks());
  const rivalGhostsRef = useRef<Map<string, RivalGhost>>(new Map());
  const viewportRef = useRef(viewport);

  const onSendMoveRef = useRef(onSendMove);
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
      toast: null,
      animClock: 0,
      finishedEmitted: false
    };
    matchStartLocalMsRef.current = Date.now();
    elapsedMsRef.current = 0;
    lastEmitMsRef.current = 0;
    pendingMoveRef.current = null;
  }, [steps]);

  // Sync incoming 20Hz `match:state` rival positions for 60fps ghost interpolation
  useEffect(() => {
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
  }, [livePlayers, playerId]);

  const queueOrEmitMove = useCallback(
    (
      normX: number,
      heightMeters: number,
      action: PlayerMoveAction,
      status: PlayerStatus,
      immediate: boolean
    ) => {
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
    [roomState.targetHeight]
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
        text: '🪨 ROCKFALL HIT! -30m',
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

      // 1. Wrong-side tap -> whiff toward wrong lane & fall back 2 steps (-20m, clamped to 0)
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
      // (Note: GUST_OF_WIND has zero knockback/stun — it is purely a cosmetic summit blizzard!
      //  Full-screen FALLING_ROCK collision is checked dynamically against live boulder Y in the 60fps loop.)
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
        g.status = 'FINISHED';
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

  // 60fps Game Loop: Hop Interpolation, Slippery Grip Timer, Full-Lane Boulders & Blizzard
  useEffect(() => {
    let rafId: number | null = null;
    let lastFrameTime: number | null = null;

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

      // Flush trailing throttled network move
      if (
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

      // Interpolate climber hop / fall arc
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

      // Slippery Ledge timed grip-slip (~0.75s; ledge stays intact on cliff!)
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
          const isMoss = currentStep.biome === 'FOOTHILLS';

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
            text: isMoss ? '🌿 MOSS SLIP! -20m' : '🧊 ICY SLIP! -20m',
            accent: isMoss ? '#BEF264' : '#7DD3FC',
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

      // Full-Screen Lane Falling Boulder live overlap collision check
      const playH = viewportRef.current.height;
      const anchorY = playH * (1 - BOTTOM_ANCHOR_RATIO);
      const climberCenterY =
        anchorY - (g.visualHeight - g.cameraHeight) * PIXELS_PER_METER - 22;

      if (
        g.status !== 'FINISHED' &&
        g.boulderInvulnTimer <= 0 &&
        g.stepIndex > 0 &&
        !g.hop?.isFall
      ) {
        const minScan = Math.max(1, g.stepIndex - 1);
        const maxScan = Math.min(steps.length - 1, g.stepIndex + 4);

        for (let idx = minScan; idx <= maxScan; idx++) {
          const st = steps[idx]!;
          if (st.type !== 'FALLING_ROCK') continue;

          const hz = evaluateHazardPhase(st, elapsedMs);
          if (hz.phase !== 'ACTIVE') continue;

          const boulderCenterY =
            -60 + hz.phaseProgress * (playH + 120);
          const boulderLaneX = st.x; // 0.25 or 0.75
          const sameLane = Math.abs(g.visualX - boulderLaneX) < 0.19;
          const verticalHit = Math.abs(climberCenterY - boulderCenterY) < 36;

          if (sameLane && verticalHit) {
            triggerBoulderHit(g.visualX, g.visualHeight);
            break;
          }
        }
      }

      // Interpolate rival ghosts smoothly at 60fps
      const ghostLerp = Math.min(1, dt * 13);
      for (const ghost of rivalGhostsRef.current.values()) {
        ghost.xNorm += (ghost.targetXNorm - ghost.xNorm) * ghostLerp;
        ghost.height += (ghost.targetHeight - ghost.height) * ghostLerp;
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
  }, [queueOrEmitMove, roomState.targetHeight, steps, triggerBoulderHit]);

  // Derived values for current render frame
  const g = gameRef.current;
  const logicalStep = steps[g.stepIndex]!;
  const nextStep = steps[g.stepIndex + 1] ?? null;
  const elapsedNowMs = elapsedMsRef.current;

  const activeBiome = getBiomeForHeight(g.visualHeight, roomState.targetHeight);
  const palette = BIOME_PALETTES[activeBiome];

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

  // Visible window (~5 steps visible with 120px per 10m step!)
  const minVisibleM = g.cameraHeight - 22;
  const maxVisibleM =
    g.cameraHeight + anchorY / PIXELS_PER_METER + 16;

  const visibleSteps = steps.filter(
    (s) => s.height >= minVisibleM && s.height <= maxVisibleM
  );

  // Active nearby rockfall spawners (at most 1 due to >=5 step spacing)
  const activeRockfallSteps = steps.filter(
    (s) =>
      s.type === 'FALLING_ROCK' &&
      s.index >= Math.max(1, g.stepIndex - 1) &&
      s.index <= g.stepIndex + 4
  );

  const visibleGhosts = Array.from(rivalGhostsRef.current.values()).filter(
    (rg) => rg.height >= minVisibleM && rg.height <= maxVisibleM
  );

  const summitScreenY = worldToScreenY(roomState.targetHeight);
  const cliffTopY = Math.max(-40, summitScreenY - 12);

  // Subtle parallax shifts for distant mountain ranges
  const farParallaxY = Math.min(90, g.cameraHeight * 0.14);
  const midParallaxY = Math.min(140, g.cameraHeight * 0.28);

  const isSlippingNow =
    logicalStep.type === 'SLIPPERY_LEDGE' &&
    g.lockTimer <= 0 &&
    g.hop === null &&
    g.status !== 'FINISHED';
  const slipWobblePx = isSlippingNow
    ? Math.sin(g.animClock * 38) * 3.5
    : 0;

  const climberScreenX = normToCliffX(g.visualX) - 19 + slipWobblePx;
  const climberScreenY = worldToScreenY(g.visualHeight) - 44;
  const arrowBobPx = Math.sin(g.animClock * 7.5) * 4;

  const selfProgressPct = Math.min(
    100,
    Math.max(0, (logicalStep.height / roomState.targetHeight) * 100)
  );

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
            <Text style={styles.roomBadgeText}>{roomState.code}</Text>
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
          {/* Summit Starry Sky Twinkles */}
          {activeBiome === 'SUMMIT' && (
            <View pointerEvents="none" style={styles.starsLayer}>
              <View style={[styles.starDot, { left: '12%', top: '8%' }]} />
              <View style={[styles.starDot, { left: '84%', top: '11%' }]} />
              <View style={[styles.starDot, { left: '26%', top: '19%' }]} />
              <View style={[styles.starDot, { left: '74%', top: '24%' }]} />
              <View style={[styles.starDot, { left: '91%', top: '33%' }]} />
            </View>
          )}

          {/* Layer 1: Far Parallax Mountain Range Silhouette */}
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
            />
            <View
              style={[
                styles.mountainPeakFarRight,
                { backgroundColor: palette.farPeakColor }
              ]}
            />
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

          {/* Layer 3: Continuous Central Rock Cliff Face (0m -> 500m Snowy Peak) */}
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
            {/* Snowy Summit Peak Crest when approaching 500m */}
            {summitScreenY > -80 && (
              <View style={styles.summitSnowCrest} />
            )}

            {/* Strict 50/50 Center Vertical Dihedral Rock Seam */}
            <View
              style={[
                styles.centerRockSeam,
                { backgroundColor: palette.cliffSeam }
              ]}
            />

            {/* Subtle Scrolling Rock Facet Textures */}
            {[0, 1, 2, 3, 4, 5].map((facetIdx) => {
              const offsetPx =
                ((g.cameraHeight * PIXELS_PER_METER + facetIdx * 115) % 690) -
                60;
              const onLeft = facetIdx % 2 === 0;
              return (
                <View
                  key={`facet-${facetIdx}`}
                  style={[
                    styles.rockFacetPatch,
                    {
                      backgroundColor: palette.rockPatch,
                      left: onLeft ? '12%' : '62%',
                      top: offsetPx
                    }
                  ]}
                />
              );
            })}
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

          {/* Sculpted 2-Lane Mountain Holds */}
          {visibleSteps.map((step) => {
            const screenY = worldToScreenY(step.height);
            const isBase = step.index === 0;
            const isSummit = step.height >= roomState.targetHeight;
            const isNextHold = nextStep?.index === step.index;
            const isCurrentHold = logicalStep.index === step.index;

            const holdW = isBase
              ? cliffWidth - 16
              : isSummit
              ? cliffWidth * 0.72
              : HOLD_WIDTH_PX;

            const centerX = isBase || isSummit
              ? playfieldWidth * 0.5
              : normToCliffX(step.x);
            const leftPx = centerX - holdW / 2;

            const isMossySlip =
              step.type === 'SLIPPERY_LEDGE' && step.biome === 'FOOTHILLS';
            const isIcySlip =
              step.type === 'SLIPPERY_LEDGE' && step.biome !== 'FOOTHILLS';

            const slipPct =
              isCurrentHold && isSlippingNow
                ? Math.min(1, g.slipElapsed / SLIP_LIMIT_SEC)
                : 0;

            return (
              <React.Fragment key={step.id}>
                {/* Sculpted Rock / Moss / Ice Hold */}
                <View
                  pointerEvents="none"
                  style={[
                    styles.holdOuter,
                    {
                      width: holdW,
                      height: isBase || isSummit ? 28 : HOLD_HEIGHT_PX,
                      backgroundColor: isSummit
                        ? '#CA8A04'
                        : isMossySlip
                        ? '#3F3F46'
                        : isIcySlip
                        ? '#0284C7'
                        : palette.graniteBody,
                      borderBottomColor: isSummit
                        ? '#713F12'
                        : isIcySlip
                        ? '#075985'
                        : palette.graniteShadow,
                      borderColor: isNextHold
                        ? '#38BDF8'
                        : isSummit
                        ? '#FEF08A'
                        : isMossySlip
                        ? '#65A30D'
                        : isIcySlip
                        ? '#BAE6FD'
                        : palette.cliffEdge,
                      transform: [
                        { translateX: leftPx },
                        { translateY: screenY }
                      ]
                    }
                  ]}
                >
                  {/* Chiseled Top Shelf Cap (Granite / Lush Moss / Specular Ice) */}
                  <View
                    style={[
                      styles.holdTopShelf,
                      {
                        backgroundColor: isSummit
                          ? '#FEF08A'
                          : isMossySlip
                          ? '#84CC16'
                          : isIcySlip
                          ? '#E0F2FE'
                          : palette.graniteTop
                      }
                    ]}
                  />

                  {/* Mossy Overhang Tufts (Foothills Slippery Hold) */}
                  {isMossySlip && (
                    <View style={styles.mossTuftRow}>
                      <View style={styles.mossTuft} />
                      <View style={[styles.mossTuft, styles.mossTuftLong]} />
                      <View style={styles.mossTuft} />
                    </View>
                  )}

                  {/* Timed Slip Progress Bar when standing on SLIPPERY_LEDGE */}
                  {step.type === 'SLIPPERY_LEDGE' && slipPct > 0 && (
                    <View style={styles.slipMeterTrack}>
                      <View
                        style={[
                          styles.slipMeterFill,
                          {
                            width: `${Math.round(slipPct * 100)}%`,
                            backgroundColor:
                              slipPct > 0.68 ? '#EF4444' : '#FDE047'
                          }
                        ]}
                      />
                    </View>
                  )}
                </View>

                {/* Hanging Icicle Teeth beneath Icy Ledges */}
                {isIcySlip && (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.icicleRow,
                      {
                        width: holdW,
                        transform: [
                          { translateX: leftPx },
                          { translateY: screenY + HOLD_HEIGHT_PX - 2 }
                        ]
                      }
                    ]}
                  >
                    <View style={styles.icicleSpike} />
                    <View style={[styles.icicleSpike, styles.icicleSpikeTall]} />
                    <View style={styles.icicleSpike} />
                  </View>
                )}

                {/* Bold Next-Ledge Arrow Indicator (`currentStep + 1`) */}
                {isNextHold && g.status !== 'FINISHED' && (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.nextArrowCallout,
                      {
                        transform: [
                          {
                            translateX: isSummit
                              ? normToCliffX(step.x) - 25
                              : centerX - 25
                          },
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

          {/* Translucent Rival Climber Ghosts */}
          {visibleGhosts.map((ghost) => {
            const gx = normToCliffX(ghost.xNorm) - 19;
            const gy = worldToScreenY(ghost.height) - 44;
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

          {/* Full-Screen Lane Falling Boulders & Pinned Top-Edge Warning Badges */}
          {activeRockfallSteps.map((rockStep) => {
            const hz = evaluateHazardPhase(rockStep, elapsedNowMs);
            if (hz.phase === 'SAFE') return null;

            const laneCenterX = normToCliffX(rockStep.x);
            const boulderY =
              -60 + hz.phaseProgress * (playfieldHeight + 120);
            const spinDeg = `${Math.round(hz.phaseProgress * 540)}deg`;
            const warnPulse = 0.72 + Math.sin(g.animClock * 16) * 0.28;

            return (
              <React.Fragment key={`boulder-${rockStep.id}`}>
                {/* Subtle vertical lane shadow guide during warning/active */}
                <View
                  pointerEvents="none"
                  style={[
                    styles.boulderLaneTrack,
                    {
                      left: laneCenterX - 30
                    }
                  ]}
                />

                {/* Pinned Top-Edge Warning Badge */}
                <View
                  pointerEvents="none"
                  style={[
                    styles.topEdgeRockWarning,
                    {
                      opacity: hz.phase === 'WARNING' ? warnPulse : 1,
                      transform: [{ translateX: laneCenterX - 52 }]
                    }
                  ]}
                >
                  <Text style={styles.topEdgeRockWarningText}>
                    ⚠ ROCKFALL
                  </Text>
                </View>

                {/* Tumbling Full-Screen Rocky Boulder (-60px -> viewportHeight + 60px) */}
                {hz.phase === 'ACTIVE' && (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.tumblingBoulder,
                      {
                        transform: [
                          { translateX: laneCenterX - BOULDER_SIZE_PX / 2 },
                          { translateY: boulderY - BOULDER_SIZE_PX / 2 },
                          { rotate: spinDeg }
                        ]
                      }
                    ]}
                  >
                    <View style={styles.boulderFacetLight} />
                    <View style={styles.boulderFacetCrag} />
                  </View>
                )}
              </React.Fragment>
            );
          })}

          {/* Summit Ambient Snow & Cosmetic Full-Screen Left-to-Right Blizzard Whiteout (350-500m) */}
          {(activeBiome === 'SUMMIT' || blizzard.intensity > 0.02) && (
            <View pointerEvents="none" style={styles.blizzardOverlayLayer}>
              {/* Frosty Whiteout Veil (pulses ~35-55% during active summit blizzard) */}
              {blizzard.intensity > 0.02 && (
                <View
                  style={[
                    styles.whiteoutVeil,
                    { opacity: blizzard.intensity }
                  ]}
                />
              )}

              {/* Slanted Left-to-Right Wind Streaks & Swirling Snow */}
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

          {/* Non-Blocking Top Floating Toast (Biome Transitions & Slip/Hit Notices) */}
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

        {/* Right-Side Vertical Altitude Progress Rail */}
        <View style={styles.altitudeRail}>
          <Text style={styles.railFlag}>🚩</Text>
          <View style={styles.railBar}>
            <View style={[styles.railTick, { bottom: '30%' }]} />
            <View style={[styles.railTick, { bottom: '70%' }]} />

            {livePlayers
              .filter((lp) => lp.id !== playerId)
              .map((rival) => {
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

      {/* Ergonomic 50/50 Left & Right Tap Controls */}
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
    opacity: 0.75
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
    transform: [{ rotate: '45deg' }]
  },
  mountainPeakFarRight: {
    position: 'absolute',
    right: -60,
    bottom: '28%',
    width: 260,
    height: 260,
    borderRadius: 16,
    transform: [{ rotate: '45deg' }]
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
  summitSnowCrest: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 26,
    backgroundColor: '#F1F5F9',
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
    opacity: 0.75
  },
  rockFacetPatch: {
    position: 'absolute',
    width: '26%',
    height: 36,
    borderRadius: 8,
    opacity: 0.42
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
  holdOuter: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1.5,
    borderBottomWidth: 6,
    overflow: 'hidden',
    justifyContent: 'flex-end'
  },
  holdTopShelf: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6
  },
  mossTuftRow: {
    position: 'absolute',
    top: 4,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-around'
  },
  mossTuft: {
    width: 14,
    height: 6,
    backgroundColor: '#65A30D',
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6
  },
  mossTuftLong: {
    height: 9,
    backgroundColor: '#84CC16'
  },
  icicleRow: {
    position: 'absolute',
    left: 0,
    top: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 14
  },
  icicleSpike: {
    width: 7,
    height: 9,
    backgroundColor: '#BAE6FD',
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
    opacity: 0.9
  },
  icicleSpikeTall: {
    height: 14,
    backgroundColor: '#E0F2FE'
  },
  slipMeterTrack: {
    height: 4,
    marginHorizontal: 8,
    marginBottom: 3,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 2,
    overflow: 'hidden'
  },
  slipMeterFill: {
    height: '100%'
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
    opacity: 0.52
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
    backgroundColor: 'rgba(9, 15, 29, 0.8)',
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
  tumblingBoulder: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: BOULDER_SIZE_PX,
    height: BOULDER_SIZE_PX,
    borderRadius: 16,
    backgroundColor: '#57534E',
    borderWidth: 2.5,
    borderColor: '#1C1917',
    borderBottomWidth: 5,
    borderBottomColor: '#292524',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  boulderFacetLight: {
    position: 'absolute',
    top: 5,
    left: 6,
    width: 18,
    height: 12,
    borderRadius: 5,
    backgroundColor: '#A8A29E'
  },
  boulderFacetCrag: {
    position: 'absolute',
    bottom: 6,
    right: 7,
    width: 14,
    height: 14,
    borderRadius: 4,
    backgroundColor: '#44403C'
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
    opacity: 0.85,
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
