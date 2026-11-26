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

interface FeedbackBanner {
  text: string;
  color: string;
  ttl: number;
}

interface SnowParticle {
  id: number;
  xPct: number;
  yPct: number;
  speedY: number;
  driftX: number;
  size: number;
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

interface ClimbGameState {
  stepIndex: number;
  visualX: number;
  visualHeight: number;
  cameraHeight: number;
  hop: HopAnimation | null;
  crumbleElapsed: number;
  lockTimer: number;
  status: PlayerStatus;
  banner: FeedbackBanner | null;
  pulsePhase: number;
  finishedEmitted: boolean;
}

const WORLD_WIDTH = GAME_CONSTANTS.WORLD_WIDTH; // 400
const CRUMBLE_LIMIT_SEC = 0.7;
const SLIP_LOCK_SEC = 0.3;
const HAZARD_STUN_SEC = 0.45;
const PIXELS_PER_METER = 6.2; // 10m step = 62px vertical spacing on cliff face
const BOTTOM_ANCHOR_RATIO = 0.28; // Climber sits ~28% up from bottom of cliff viewport
const LEDGE_WIDTH_PX = 82;
const LEDGE_HEIGHT_PX = 16;
const PLAYER_SIZE_PX = 28;
const MOVE_EMIT_INTERVAL_MS = 55; // ~18Hz matching server 20Hz broadcast

interface BiomeTheme {
  label: string;
  wallBg: string;
  ridgeAccent: string;
  pillBg: string;
  pillText: string;
  ledgeBody: string;
  ledgeCap: string;
  ledgeBorder: string;
}

const BIOME_THEMES: Record<MountainBiome, BiomeTheme> = {
  FOOTHILLS: {
    label: '⛰ ROCKY FOOTHILLS',
    wallBg: '#191624',
    ridgeAccent: '#292338',
    pillBg: '#451A03',
    pillText: '#FCD34D',
    ledgeBody: '#57534E',
    ledgeCap: '#D6D3D1',
    ledgeBorder: '#78716C'
  },
  CLIFFS: {
    label: '🏔 STEEP CLIFFS',
    wallBg: '#0E1B31',
    ridgeAccent: '#172B4D',
    pillBg: '#0C4A6E',
    pillText: '#7DD3FC',
    ledgeBody: '#334155',
    ledgeCap: '#CBD5E1',
    ledgeBorder: '#64748B'
  },
  SUMMIT: {
    label: '❄ ALPINE SUMMIT',
    wallBg: '#071124',
    ridgeAccent: '#102447',
    pillBg: '#164E63',
    pillText: '#E0F2FE',
    ledgeBody: '#1E293B',
    ledgeCap: '#F0F9FF', // Crisp snow cap on granite ledges
    ledgeBorder: '#7DD3FC'
  }
};

function createInitialSnow(): SnowParticle[] {
  return Array.from({ length: 14 }, (_, idx) => ({
    id: idx,
    xPct: (idx * 17 + 7) % 100,
    yPct: (idx * 23 + 11) % 100,
    speedY: 18 + (idx % 4) * 6,
    driftX: -12 - (idx % 3) * 5,
    size: idx % 2 === 0 ? 4 : 3
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

export const GameScreen: React.FC<GameScreenProps> = ({
  roomState,
  playerId,
  livePlayers,
  onSendMove,
  onLeaveRoom
}) => {
  const windowDims = Dimensions.get('window');
  const [viewport, setViewport] = useState<{ width: number; height: number }>({
    width: Math.max(300, windowDims.width - 36),
    height: Math.max(360, windowDims.height - 210)
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

  const gameRef = useRef<ClimbGameState>({
    stepIndex: 0,
    visualX: 0.5,
    visualHeight: 0,
    cameraHeight: 0,
    hop: null,
    crumbleElapsed: 0,
    lockTimer: 0,
    status: 'CLIMBING',
    banner: null,
    pulsePhase: 0,
    finishedEmitted: false
  });

  const brokenStepsRef = useRef<Map<number, number>>(new Map());
  const snowRef = useRef<SnowParticle[]>(createInitialSnow());
  const rivalGhostsRef = useRef<Map<string, RivalGhost>>(new Map());

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

  // Reset match state cleanly whenever seed/targetHeight changes (e.g. Rematch)
  useEffect(() => {
    const startStep = steps[0];
    gameRef.current = {
      stepIndex: 0,
      visualX: startStep?.x ?? 0.5,
      visualHeight: 0,
      cameraHeight: 0,
      hop: null,
      crumbleElapsed: 0,
      lockTimer: 0,
      status: 'CLIMBING',
      banner: null,
      pulsePhase: 0,
      finishedEmitted: false
    };
    brokenStepsRef.current.clear();
    matchStartLocalMsRef.current = Date.now();
    elapsedMsRef.current = 0;
    lastEmitMsRef.current = 0;
    pendingMoveRef.current = null;
  }, [steps]);

  // Sync incoming 20Hz `match:state` rival coordinates for 60fps ghost interpolation
  useEffect(() => {
    const map = rivalGhostsRef.current;
    const activeIds = new Set<string>();

    for (const p of livePlayers) {
      if (p.id === playerId) continue;
      activeIds.add(p.id);
      const normX = Math.max(0.12, Math.min(0.88, p.x / WORLD_WIDTH));
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

  // Pure Left/Right Tap Handler
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
      const elapsedNowMs = Date.now() - matchStartLocalMsRef.current;

      // 1. Wrong-side tap -> slip & fall back 2 steps (-20m, clamped to 0) + 0.3s lock
      if (side !== nextStep.requiredTap) {
        const destIndex = Math.max(0, g.stepIndex - 2);
        const destStep = steps[destIndex]!;
        const whiffOffset = side === 'LEFT' ? -0.05 : 0.05;

        g.stepIndex = destIndex;
        g.crumbleElapsed = 0;
        g.lockTimer = SLIP_LOCK_SEC;
        g.status = 'CLIMBING';
        g.hop = {
          fromX: Math.max(0.12, Math.min(0.88, g.visualX + whiffOffset)),
          fromHeight: g.visualHeight + 2,
          toX: destStep.x,
          toHeight: destStep.height,
          elapsed: 0,
          duration: 0.25,
          arcMeters: 2.5,
          isFall: true
        };
        g.banner = {
          text:
            destIndex < currentStep.index
              ? '❌ WRONG SIDE! -20m'
              : '❌ WRONG SIDE!',
          color: '#FBBF24',
          ttl: 0.75
        };

        void HapticsService.warning();
        queueOrEmitMove(destStep.x, destStep.height, 'FALL', 'CLIMBING', false);
        return;
      }

      // 2. Correct-side tap -> check periodic hazard timing on target step
      const hazardState = evaluateHazardPhase(nextStep, elapsedNowMs);

      if (nextStep.type === 'FALLING_ROCK' && hazardState.phase === 'ACTIVE') {
        const destIndex = Math.max(0, g.stepIndex - 3);
        const destStep = steps[destIndex]!;

        g.stepIndex = destIndex;
        g.crumbleElapsed = 0;
        g.lockTimer = HAZARD_STUN_SEC;
        g.status = 'STUNNED';
        g.hop = {
          fromX: (g.visualX + nextStep.x) * 0.5,
          fromHeight: nextStep.height - 2,
          toX: destStep.x,
          toHeight: destStep.height,
          elapsed: 0,
          duration: 0.32,
          arcMeters: 4,
          isFall: true
        };
        g.banner = {
          text: '🪨 FALLING ROCK! -30m',
          color: '#F87171',
          ttl: 0.95
        };

        void HapticsService.collision();
        queueOrEmitMove(destStep.x, destStep.height, 'STUN', 'STUNNED', true);
        return;
      }

      if (nextStep.type === 'GUST_OF_WIND' && hazardState.phase === 'ACTIVE') {
        const destIndex = Math.max(0, g.stepIndex - 3);
        const destStep = steps[destIndex]!;

        g.stepIndex = destIndex;
        g.crumbleElapsed = 0;
        g.lockTimer = HAZARD_STUN_SEC;
        g.status = 'STUNNED';
        g.hop = {
          fromX: nextStep.x,
          fromHeight: nextStep.height - 2,
          toX: destStep.x,
          toHeight: destStep.height,
          elapsed: 0,
          duration: 0.32,
          arcMeters: 4,
          isFall: true
        };
        g.banner = {
          text: '💨 BLOWN BACK! -30m',
          color: '#38BDF8',
          ttl: 0.95
        };

        void HapticsService.collision();
        queueOrEmitMove(destStep.x, destStep.height, 'STUN', 'STUNNED', true);
        return;
      }

      // 3. Clean +10m Alpine Climb Hop!
      const prevBiome = currentStep.biome;
      g.stepIndex = nextStep.index;
      g.crumbleElapsed = 0;
      g.hop = {
        fromX: g.visualX,
        fromHeight: g.visualHeight,
        toX: nextStep.x,
        toHeight: nextStep.height,
        elapsed: 0,
        duration: 0.115,
        arcMeters: 3.6,
        isFall: false
      };

      if (nextStep.biome !== prevBiome) {
        g.banner = {
          text: BIOME_THEMES[nextStep.biome].label,
          color: BIOME_THEMES[nextStep.biome].pillText,
          ttl: 1.15
        };
      }

      const moveAction: PlayerMoveAction =
        side === 'LEFT' ? 'TAP_LEFT' : 'TAP_RIGHT';

      if (nextStep.height >= roomState.targetHeight) {
        g.status = 'FINISHED';
        g.banner = {
          text: '🚩 SUMMIT REACHED!',
          color: '#FACC15',
          ttl: 2.0
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

  // 60fps Animation, Crumble Timer, Hazard Cycle & Camera Loop
  useEffect(() => {
    let rafId: number | null = null;
    let lastFrameTime: number | null = null;

    const tick = (frameNow: number) => {
      const rawDt =
        lastFrameTime === null ? 0.016 : (frameNow - lastFrameTime) / 1000;
      lastFrameTime = frameNow;
      const dt = Math.min(0.05, Math.max(0.001, rawDt));

      const nowWallMs = Date.now();
      elapsedMsRef.current = nowWallMs - matchStartLocalMsRef.current;

      const g = gameRef.current;
      g.pulsePhase = (g.pulsePhase + dt * 7) % (Math.PI * 2);

      // Flush any trailing throttled network move
      if (
        pendingMoveRef.current &&
        nowWallMs - lastEmitMsRef.current >= MOVE_EMIT_INTERVAL_MS
      ) {
        const pending = pendingMoveRef.current;
        pendingMoveRef.current = null;
        lastEmitMsRef.current = nowWallMs;
        onSendMoveRef.current(pending);
      }

      // Update broken crumbling rock visual respawn timers
      for (const [idx, rem] of Array.from(brokenStepsRef.current.entries())) {
        if (rem - dt <= 0) {
          brokenStepsRef.current.delete(idx);
        } else {
          brokenStepsRef.current.set(idx, rem - dt);
        }
      }

      // Recovery / Stun timer
      if (g.lockTimer > 0) {
        g.lockTimer = Math.max(0, g.lockTimer - dt);
        if (g.lockTimer === 0 && g.status === 'STUNNED') {
          g.status = 'CLIMBING';
        }
      }

      // Feedback banner TTL
      if (g.banner) {
        g.banner.ttl -= dt;
        if (g.banner.ttl <= 0) {
          g.banner = null;
        }
      }

      // Hop / Fall smooth interpolation
      const currentStep = steps[g.stepIndex]!;
      if (g.hop) {
        g.hop.elapsed += dt;
        const t = Math.min(1, g.hop.elapsed / g.hop.duration);
        const eased = 1 - Math.pow(1 - t, 2);
        const parabola = Math.sin(t * Math.PI) * g.hop.arcMeters;

        g.visualX = g.hop.fromX + (g.hop.toX - g.hop.fromX) * eased;
        g.visualHeight =
          g.hop.fromHeight +
          (g.hop.toHeight - g.hop.fromHeight) * eased +
          parabola;

        if (t >= 1) {
          g.visualX = currentStep.x;
          g.visualHeight = currentStep.height;
          g.hop = null;
        }
      } else {
        g.visualX = currentStep.x;
        g.visualHeight = currentStep.height;
      }

      // Crumbling Rock timer (~0.7s standing limit once recovery ends)
      if (
        currentStep.type === 'CRUMBLING_ROCK' &&
        g.status !== 'FINISHED' &&
        g.lockTimer <= 0 &&
        g.hop === null
      ) {
        g.crumbleElapsed += dt;
        if (g.crumbleElapsed >= CRUMBLE_LIMIT_SEC) {
          brokenStepsRef.current.set(currentStep.index, 1.5);
          const destIndex = Math.max(0, g.stepIndex - 2);
          const destStep = steps[destIndex]!;

          g.stepIndex = destIndex;
          g.crumbleElapsed = 0;
          g.lockTimer = SLIP_LOCK_SEC;
          g.hop = {
            fromX: g.visualX,
            fromHeight: g.visualHeight,
            toX: destStep.x,
            toHeight: destStep.height,
            elapsed: 0,
            duration: 0.28,
            arcMeters: 1.5,
            isFall: true
          };
          g.banner = {
            text: '💥 ROCK CRUMBLED! -20m',
            color: '#FB923C',
            ttl: 0.85
          };

          void HapticsService.collision();
          queueOrEmitMove(
            destStep.x,
            destStep.height,
            'FALL',
            'CLIMBING',
            true
          );
        }
      }

      // Smoothly interpolate rival ghosts at 60fps
      const ghostLerp = Math.min(1, dt * 13);
      for (const ghost of rivalGhostsRef.current.values()) {
        ghost.xNorm += (ghost.targetXNorm - ghost.xNorm) * ghostLerp;
        ghost.height += (ghost.targetHeight - ghost.height) * ghostLerp;
      }

      // Animate snow particles when in or approaching Alpine Summit
      if (g.visualHeight >= 290) {
        for (const flake of snowRef.current) {
          flake.yPct = (flake.yPct + flake.speedY * dt) % 100;
          flake.xPct = (flake.xPct + flake.driftX * dt + 100) % 100;
        }
      }

      // Smooth vertical camera following climber
      const targetCam = Math.max(0, g.visualHeight - 8);
      g.cameraHeight += (targetCam - g.cameraHeight) * Math.min(1, dt * 9.5);

      setFrameTick((prev) => (prev + 1) & 0xffff);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [queueOrEmitMove, steps]);

  // Derived render values
  const g = gameRef.current;
  const logicalStep = steps[g.stepIndex]!;
  const nextStep = steps[g.stepIndex + 1] ?? null;
  const activeBiome: MountainBiome = getBiomeForHeight(
    g.visualHeight,
    roomState.targetHeight
  );
  const theme = BIOME_THEMES[activeBiome];

  const playfieldWidth = Math.max(240, viewport.width - 34);
  const playfieldHeight = viewport.height;
  const anchorY = playfieldHeight * (1 - BOTTOM_ANCHOR_RATIO);

  const worldToScreenY = (meters: number): number =>
    anchorY - (meters - g.cameraHeight) * PIXELS_PER_METER;

  const minVisibleM = g.cameraHeight - 45;
  const maxVisibleM =
    g.cameraHeight + anchorY / PIXELS_PER_METER + 25;

  const visibleSteps = steps.filter(
    (s) => s.height >= minVisibleM && s.height <= maxVisibleM
  );

  const visibleGhosts = Array.from(rivalGhostsRef.current.values()).filter(
    (rg) => rg.height >= minVisibleM && rg.height <= maxVisibleM
  );

  const elapsedNowMs = elapsedMsRef.current;
  const selfProgressPct = Math.min(
    100,
    Math.max(0, (logicalStep.height / roomState.targetHeight) * 100)
  );

  const playerScreenX = g.visualX * playfieldWidth - PLAYER_SIZE_PX / 2;
  const playerScreenY = worldToScreenY(g.visualHeight) - PLAYER_SIZE_PX;
  const arrowBobOffset = Math.sin(g.pulsePhase) * 3;

  return (
    <View style={styles.root}>
      {/* Live Top HUD */}
      <View style={styles.hudBar}>
        <View style={styles.hudLeft}>
          <Text style={styles.hudLabel}>ALTITUDE</Text>
          <Text style={styles.hudAltitude}>
            {logicalStep.height}m
            <Text style={styles.hudTarget}> / {roomState.targetHeight}m</Text>
          </Text>
        </View>

        <View style={styles.hudCenter}>
          <Text style={styles.hudTimer}>{formatTimer(elapsedNowMs)}</Text>
          <View style={styles.hudMetaRow}>
            <View
              style={[styles.biomePill, { backgroundColor: theme.pillBg }]}
            >
              <Text style={[styles.biomePillText, { color: theme.pillText }]}>
                {theme.label}
              </Text>
            </View>
            <Text style={styles.roomTag}>{roomState.code}</Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.leaveButton,
            pressed && styles.leaveButtonPressed
          ]}
          onPress={onLeaveRoom}
        >
          <Text style={styles.leaveButtonText}>Leave</Text>
        </Pressable>
      </View>

      {/* Cliff Face Playfield + Right Vertical Altitude Rail */}
      <View style={styles.arenaRow} onLayout={handleArenaLayout}>
        <View
          style={[
            styles.playfield,
            { width: playfieldWidth, backgroundColor: theme.wallBg }
          ]}
        >
          {/* Ambient Mountain Ridge & Strata Backdrop */}
          <View
            pointerEvents="none"
            style={[
              styles.ridgeStrataTop,
              { backgroundColor: theme.ridgeAccent }
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.ridgeStrataMid,
              { backgroundColor: theme.ridgeAccent }
            ]}
          />

          {/* Falling Snow Particles in Alpine Summit (350m - 500m) */}
          {activeBiome === 'SUMMIT' &&
            snowRef.current.map((flake) => (
              <View
                key={`snow-${flake.id}`}
                pointerEvents="none"
                style={[
                  styles.snowFlake,
                  {
                    left: `${flake.xPct}%`,
                    top: `${flake.yPct}%`,
                    width: flake.size,
                    height: flake.size,
                    borderRadius: flake.size / 2
                  }
                ]}
              />
            ))}

          {/* Biome Transition & Summit Altitude Lines */}
          {[150, 350, roomState.targetHeight].map((markM) => {
            if (markM < minVisibleM || markM > maxVisibleM) return null;
            const lineY = worldToScreenY(markM);
            const isSummit = markM === roomState.targetHeight;
            const label = isSummit
              ? `🚩 ALPINE SUMMIT ${markM}m`
              : markM === 150
              ? '── 150m STEEP CLIFFS ──'
              : '── 350m ALPINE SUMMIT ──';
            return (
              <View
                key={`line-${markM}`}
                pointerEvents="none"
                style={[
                  styles.biomeDividerLine,
                  isSummit && styles.summitDividerLine,
                  { transform: [{ translateY: lineY }] }
                ]}
              >
                <Text
                  style={[
                    styles.biomeDividerText,
                    isSummit && styles.summitDividerText
                  ]}
                >
                  {label}
                </Text>
              </View>
            );
          })}

          {/* Step-by-Step Mountain Ledges & Deterministic Hazards */}
          {visibleSteps.map((step) => {
            const screenY = worldToScreenY(step.height);
            const isBase = step.index === 0;
            const isSummit = step.height >= roomState.targetHeight;
            const isNextTarget = nextStep?.index === step.index;
            const isCurrent = logicalStep.index === step.index;

            const ledgeW = isBase
              ? playfieldWidth - 28
              : isSummit
              ? Math.min(playfieldWidth - 40, 170)
              : LEDGE_WIDTH_PX;
            const centerPx = step.x * playfieldWidth;

            const isCrumbleStanding =
              isCurrent &&
              step.type === 'CRUMBLING_ROCK' &&
              g.lockTimer <= 0 &&
              g.hop === null;
            const crumbleProgress = isCrumbleStanding
              ? Math.min(1, g.crumbleElapsed / CRUMBLE_LIMIT_SEC)
              : 0;
            const shakeX = isCrumbleStanding
              ? Math.sin(g.pulsePhase * 5.5) * 3.5
              : 0;
            const isBroken = brokenStepsRef.current.has(step.index);

            const hazardEval = evaluateHazardPhase(step, elapsedNowMs);
            const stepTheme = BIOME_THEMES[step.biome];
            const leftPx = Math.max(
              8,
              Math.min(playfieldWidth - ledgeW - 8, centerPx - ledgeW / 2)
            );

            return (
              <React.Fragment key={step.id}>
                {/* Wind Gust Band & Telegraph (Alpine Summit) */}
                {step.type === 'GUST_OF_WIND' &&
                  hazardEval.phase !== 'SAFE' && (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.windBand,
                        hazardEval.phase === 'ACTIVE'
                          ? styles.windBandActive
                          : styles.windBandWarning,
                        { transform: [{ translateY: screenY - 26 }] }
                      ]}
                    >
                      <Text
                        style={[
                          styles.windBandText,
                          hazardEval.phase === 'ACTIVE' &&
                            styles.windBandTextActive
                        ]}
                      >
                        {hazardEval.phase === 'ACTIVE'
                          ? step.windDirection === 'LEFT'
                            ? '◀◀ 💨 GUST! WAIT! ◀◀'
                            : '▶▶ 💨 GUST! WAIT! ▶▶'
                          : step.windDirection === 'LEFT'
                          ? '〰 ⚠ WIND BUILDING ◀ 〰'
                          : '〰 ▶ WIND BUILDING ⚠ 〰'}
                      </Text>
                    </View>
                  )}

                {/* Falling Rock Lane Telegraph & Dropping Boulder */}
                {step.type === 'FALLING_ROCK' &&
                  hazardEval.phase !== 'SAFE' && (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.rockLaneContainer,
                        {
                          width: ledgeW,
                          transform: [
                            { translateX: leftPx },
                            { translateY: screenY - 92 }
                          ]
                        }
                      ]}
                    >
                      <View style={styles.rockWarningBadge}>
                        <Text style={styles.rockWarningText}>
                          {hazardEval.phase === 'ACTIVE' ? '⚠ ROCK!' : '⚠'}
                        </Text>
                      </View>
                      {/* Boulder drops smoothly through the lane during WARNING -> ACTIVE */}
                      <View
                        style={[
                          styles.fallingBoulder,
                          hazardEval.phase === 'ACTIVE' &&
                            styles.fallingBoulderActive,
                          {
                            transform: [
                              {
                                translateY:
                                  hazardEval.phase === 'WARNING'
                                    ? hazardEval.phaseProgress * 28
                                    : 28 + hazardEval.phaseProgress * 66
                              }
                            ]
                          }
                        ]}
                      >
                        <Text style={styles.boulderGlyph}>🪨</Text>
                      </View>
                    </View>
                  )}

                {/* Ledge Platform */}
                <View
                  pointerEvents="none"
                  style={[
                    styles.ledgeBase,
                    {
                      width: ledgeW,
                      height: isSummit ? 20 : LEDGE_HEIGHT_PX,
                      backgroundColor: isSummit
                        ? '#CA8A04'
                        : step.type === 'CRUMBLING_ROCK'
                        ? '#9A3412'
                        : stepTheme.ledgeBody,
                      borderColor:
                        (step.type === 'FALLING_ROCK' ||
                          step.type === 'GUST_OF_WIND') &&
                        hazardEval.phase === 'ACTIVE'
                          ? '#EF4444'
                          : isNextTarget
                          ? '#38BDF8'
                          : isSummit
                          ? '#FEF08A'
                          : step.type === 'CRUMBLING_ROCK'
                          ? '#FB923C'
                          : stepTheme.ledgeBorder,
                      opacity: isBroken ? 0.25 : 1,
                      transform: [
                        { translateX: leftPx + shakeX },
                        { translateY: screenY }
                      ]
                    }
                  ]}
                >
                  {/* Top Granite / Snow / Crack Cap */}
                  <View
                    style={[
                      styles.ledgeTopCap,
                      {
                        backgroundColor: isSummit
                          ? '#FEF08A'
                          : step.type === 'CRUMBLING_ROCK'
                          ? '#FDBA74'
                          : stepTheme.ledgeCap
                      }
                    ]}
                  />

                  {/* Crumbling Rock Progress Crack Bar */}
                  {step.type === 'CRUMBLING_ROCK' && !isBroken && (
                    <View style={styles.crumbleBarTrack}>
                      <View
                        style={[
                          styles.crumbleBarFill,
                          { width: `${Math.round(crumbleProgress * 100)}%` }
                        ]}
                      />
                    </View>
                  )}

                  {/* Subtle Hazard Marker on Safe Window */}
                  {step.type === 'FALLING_ROCK' &&
                    hazardEval.phase === 'SAFE' && (
                      <Text style={styles.ledgeMiniTag}>🪨 CHUTE</Text>
                    )}
                  {step.type === 'GUST_OF_WIND' &&
                    hazardEval.phase === 'SAFE' && (
                      <Text style={styles.ledgeMiniTag}>💨 RIDGE</Text>
                    )}
                </View>

                {/* Summit Flag */}
                {isSummit && (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.summitFlagBox,
                      {
                        transform: [
                          { translateX: centerPx - 28 },
                          { translateY: screenY - 30 }
                        ]
                      }
                    ]}
                  >
                    <Text style={styles.summitFlagText}>🚩 500m</Text>
                  </View>
                )}

                {/* Crisp Next-Ledge Arrow Indicator (`currentStep + 1`) */}
                {isNextTarget && g.status !== 'FINISHED' && (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.nextArrowBadge,
                      hazardEval.phase === 'ACTIVE'
                        ? styles.nextArrowDanger
                        : hazardEval.phase === 'WARNING'
                        ? styles.nextArrowCaution
                        : styles.nextArrowSafe,
                      {
                        transform: [
                          { translateX: centerPx - 24 },
                          { translateY: screenY - 36 + arrowBobOffset }
                        ]
                      }
                    ]}
                  >
                    <Text style={styles.nextArrowGlyph}>
                      {step.requiredTap === 'LEFT' ? '◀' : '▶'}
                    </Text>
                  </View>
                )}
              </React.Fragment>
            );
          })}

          {/* Translucent Rival Ghost Climbers on Cliff Face */}
          {visibleGhosts.map((ghost) => {
            const gx = ghost.xNorm * playfieldWidth - PLAYER_SIZE_PX / 2;
            const gy = worldToScreenY(ghost.height) - PLAYER_SIZE_PX;
            return (
              <View
                key={ghost.id}
                pointerEvents="none"
                style={[
                  styles.ghostWrapper,
                  {
                    transform: [
                      { translateX: gx - 22 },
                      { translateY: gy - 16 }
                    ]
                  }
                ]}
              >
                <Text
                  style={[styles.ghostLabel, { color: ghost.color }]}
                  numberOfLines={1}
                >
                  {ghost.nickname}
                  {ghost.status === 'STUNNED' ? ' ⚡' : ''}
                </Text>
                <View
                  style={[
                    styles.ghostClimber,
                    {
                      borderColor: ghost.color,
                      backgroundColor: `${ghost.color}40`
                    }
                  ]}
                />
              </View>
            );
          })}

          {/* Local Player Climber */}
          <View
            pointerEvents="none"
            style={[
              styles.playerClimber,
              {
                backgroundColor:
                  g.status === 'STUNNED'
                    ? '#EF4444'
                    : g.lockTimer > 0
                    ? '#F59E0B'
                    : selfColor,
                transform: [
                  { translateX: playerScreenX },
                  { translateY: playerScreenY }
                ]
              }
            ]}
          >
            <View style={styles.playerGoggles} />
          </View>

          {/* Floating Status / Knockback Toast inside Arena */}
          {g.banner && (
            <View pointerEvents="none" style={styles.bannerToast}>
              <Text style={[styles.bannerToastText, { color: g.banner.color }]}>
                {g.banner.text}
              </Text>
            </View>
          )}
        </View>

        {/* Right-Side Vertical Altitude Progress Rail */}
        <View style={styles.altitudeRail}>
          <Text style={styles.railTopIcon}>🚩</Text>
          <View style={styles.railTrack}>
            {/* Biome ticks at 30% (150m) & 70% (350m) */}
            <View style={[styles.railBiomeTick, { bottom: '30%' }]} />
            <View style={[styles.railBiomeTick, { bottom: '70%' }]} />

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
                      styles.railRivalDot,
                      {
                        bottom: `${pct}%`,
                        backgroundColor: rival.color
                      }
                    ]}
                  />
                );
              })}

            <View
              style={[
                styles.railSelfDot,
                {
                  bottom: `${selfProgressPct}%`,
                  backgroundColor: selfColor
                }
              ]}
            />
          </View>
          <Text style={styles.railBottomLabel}>0m</Text>
        </View>
      </View>

      {/* Pure 2-Button Ergonomic Left / Right Tap Deck */}
      <View style={styles.tapControlsRow}>
        <Pressable
          style={({ pressed }) => [
            styles.tapHalfButton,
            styles.tapLeftButton,
            nextStep?.requiredTap === 'LEFT' && styles.tapSuggestedBorder,
            pressed && styles.tapButtonPressed,
            g.lockTimer > 0 && styles.tapButtonLocked
          ]}
          onPressIn={() => handleTap('LEFT')}
        >
          <Text style={styles.tapArrowText}>◀ LEFT</Text>
          <Text style={styles.tapSubCaption}>STEP +10m</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.tapHalfButton,
            styles.tapRightButton,
            nextStep?.requiredTap === 'RIGHT' && styles.tapSuggestedBorder,
            pressed && styles.tapButtonPressed,
            g.lockTimer > 0 && styles.tapButtonLocked
          ]}
          onPressIn={() => handleTap('RIGHT')}
        >
          <Text style={styles.tapArrowText}>RIGHT ▶</Text>
          <Text style={styles.tapSubCaption}>STEP +10m</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: Platform.OS === 'ios' ? 16 : 12,
    backgroundColor: '#0F172A'
  },
  hudBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155'
  },
  hudLeft: {
    minWidth: 92
  },
  hudLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8
  },
  hudAltitude: {
    color: '#38BDF8',
    fontSize: 17,
    fontWeight: '900',
    fontFamily: 'monospace'
  },
  hudTarget: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700'
  },
  hudCenter: {
    alignItems: 'center',
    flex: 1
  },
  hudTimer: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '900',
    fontFamily: 'monospace'
  },
  hudMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3
  },
  biomePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6
  },
  biomePillText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4
  },
  roomTag: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'monospace'
  },
  leaveButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444'
  },
  leaveButtonPressed: {
    backgroundColor: '#7F1D1D'
  },
  leaveButtonText: {
    color: '#FCA5A5',
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
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
    position: 'relative'
  },
  ridgeStrataTop: {
    position: 'absolute',
    left: -30,
    right: -30,
    top: '18%',
    height: 120,
    borderRadius: 60,
    opacity: 0.35
  },
  ridgeStrataMid: {
    position: 'absolute',
    left: -20,
    right: -20,
    top: '56%',
    height: 150,
    borderRadius: 70,
    opacity: 0.28
  },
  snowFlake: {
    position: 'absolute',
    backgroundColor: '#E0F2FE',
    opacity: 0.65
  },
  biomeDividerLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(148, 163, 184, 0.3)',
    alignItems: 'center',
    paddingTop: 3
  },
  summitDividerLine: {
    borderColor: '#FACC15',
    borderTopWidth: 2
  },
  biomeDividerText: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8
  },
  summitDividerText: {
    color: '#FACC15',
    fontSize: 11,
    fontWeight: '900'
  },
  ledgeBase: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: 6,
    borderWidth: 1.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center'
  },
  ledgeTopCap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4
  },
  crumbleBarTrack: {
    position: 'absolute',
    bottom: 2,
    left: 5,
    right: 5,
    height: 3,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderRadius: 2,
    overflow: 'hidden'
  },
  crumbleBarFill: {
    height: '100%',
    backgroundColor: '#FDE047'
  },
  ledgeMiniTag: {
    color: '#E2E8F0',
    fontSize: 7,
    fontWeight: '800',
    marginTop: 2,
    opacity: 0.85
  },
  nextArrowBadge: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 48,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2
  },
  nextArrowSafe: {
    backgroundColor: '#0284C7',
    borderColor: '#E0F2FE'
  },
  nextArrowCaution: {
    backgroundColor: '#D97706',
    borderColor: '#FEF08A'
  },
  nextArrowDanger: {
    backgroundColor: '#DC2626',
    borderColor: '#FECACA'
  },
  nextArrowGlyph: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900'
  },
  rockLaneContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 96,
    alignItems: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(248, 113, 113, 0.35)'
  },
  rockWarningBadge: {
    backgroundColor: '#991B1B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FCA5A5'
  },
  rockWarningText: {
    color: '#FEF08A',
    fontSize: 9,
    fontWeight: '900'
  },
  fallingBoulder: {
    position: 'absolute',
    top: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#451A03',
    borderWidth: 1.5,
    borderColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center'
  },
  fallingBoulderActive: {
    backgroundColor: '#7F1D1D',
    borderColor: '#FCA5A5'
  },
  boulderGlyph: {
    fontSize: 14
  },
  windBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1
  },
  windBandWarning: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: 'rgba(125, 211, 252, 0.35)'
  },
  windBandActive: {
    backgroundColor: 'rgba(220, 38, 38, 0.22)',
    borderColor: '#F87171'
  },
  windBandText: {
    color: '#BAE6FD',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2
  },
  windBandTextActive: {
    color: '#FECACA',
    fontSize: 11
  },
  summitFlagBox: {
    position: 'absolute',
    left: 0,
    top: 0,
    backgroundColor: '#854D0E',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FEF08A'
  },
  summitFlagText: {
    color: '#FEF9C3',
    fontSize: 10,
    fontWeight: '900'
  },
  ghostWrapper: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: PLAYER_SIZE_PX + 44,
    alignItems: 'center',
    opacity: 0.62
  },
  ghostLabel: {
    fontSize: 9,
    fontWeight: '800',
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    paddingHorizontal: 4,
    borderRadius: 3,
    marginBottom: 2
  },
  ghostClimber: {
    width: PLAYER_SIZE_PX,
    height: PLAYER_SIZE_PX,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed'
  },
  playerClimber: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: PLAYER_SIZE_PX,
    height: PLAYER_SIZE_PX,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    paddingTop: 5
  },
  playerGoggles: {
    width: '64%',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0F172A'
  },
  bannerToast: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    alignItems: 'center'
  },
  bannerToastText: {
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155'
  },
  altitudeRail: {
    width: 28,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155'
  },
  railTopIcon: {
    fontSize: 11,
    marginBottom: 6
  },
  railTrack: {
    flex: 1,
    width: 6,
    backgroundColor: '#0F172A',
    borderRadius: 3,
    position: 'relative',
    marginVertical: 2
  },
  railBiomeTick: {
    position: 'absolute',
    left: -3,
    right: -3,
    height: 1,
    backgroundColor: '#475569'
  },
  railRivalDot: {
    position: 'absolute',
    left: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: -5,
    opacity: 0.85,
    borderWidth: 1,
    borderColor: '#0F172A'
  },
  railSelfDot: {
    position: 'absolute',
    left: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    marginBottom: -7,
    borderWidth: 2,
    borderColor: '#FFFFFF'
  },
  railBottomLabel: {
    color: '#64748B',
    fontSize: 8,
    fontWeight: '800',
    marginTop: 4
  },
  tapControlsRow: {
    flexDirection: 'row',
    gap: 12,
    height: 80
  },
  tapHalfButton: {
    flex: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2
  },
  tapLeftButton: {
    backgroundColor: '#1E293B',
    borderColor: '#475569'
  },
  tapRightButton: {
    backgroundColor: '#1E293B',
    borderColor: '#475569'
  },
  tapSuggestedBorder: {
    borderColor: '#38BDF8',
    backgroundColor: '#172554'
  },
  tapButtonPressed: {
    backgroundColor: '#2563EB',
    borderColor: '#BAE6FD'
  },
  tapButtonLocked: {
    opacity: 0.5
  },
  tapArrowText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1
  },
  tapSubCaption: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 3
  }
});
