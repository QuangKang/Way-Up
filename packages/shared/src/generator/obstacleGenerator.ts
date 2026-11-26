import {
  ClimbStep,
  GAME_CONSTANTS,
  HazardPhase,
  MountainBiome,
  Obstacle,
  ObstacleType,
  TapDirection
} from '../types/game';
import { Mulberry32 } from '../prng/mulberry32';

export interface LevelGenerationOptions {
  seed: number;
  targetHeight?: number;
  goalHeight?: number;
}

export interface HazardCycleEvaluation {
  phase: HazardPhase;
  phaseProgress: number; // [0, 1) within the current phase
}

export interface BlizzardEvaluation {
  phase: HazardPhase;
  intensity: number; // Smooth [0, 1] envelope for full-screen snowstorm whiteout
}

/**
 * Resolves the mountain biome for a given altitude:
 * - 0m - 150m: FOOTHILLS (Rocky Foothills)
 * - 150m - 350m: CLIFFS (Steep Cliffs)
 * - 350m - 500m: SUMMIT (Alpine Summit)
 */
export function getBiomeForHeight(
  height: number,
  targetHeight: number = GAME_CONSTANTS.DEFAULT_TARGET_HEIGHT
): MountainBiome {
  const foothillsMax =
    targetHeight === 500
      ? GAME_CONSTANTS.FOOTHILLS_MAX_HEIGHT
      : Math.round(targetHeight * 0.3);
  const cliffsMax =
    targetHeight === 500
      ? GAME_CONSTANTS.CLIFFS_MAX_HEIGHT
      : Math.round(targetHeight * 0.7);

  if (height <= foothillsMax) {
    return 'FOOTHILLS';
  }
  if (height <= cliffsMax) {
    return 'CLIFFS';
  }
  return 'SUMMIT';
}

export function isPeriodicHazard(type: ObstacleType): boolean {
  return type === 'FALLING_ROCK' || type === 'GUST_OF_WIND';
}

/**
 * Deterministically evaluates the cycle state ('SAFE' | 'WARNING' | 'ACTIVE')
 * for a periodic event (`FALLING_ROCK` or `GUST_OF_WIND`) at `elapsedMs`.
 */
export function evaluateHazardPhase(
  step: ClimbStep,
  elapsedMs: number
): HazardCycleEvaluation {
  if (!isPeriodicHazard(step.type) || !step.cycleMs || !step.activeDurationMs) {
    return { phase: 'SAFE', phaseProgress: 0 };
  }

  const cycleMs = step.cycleMs;
  const warningMs = step.warningDurationMs ?? 700;
  const activeMs = step.activeDurationMs;
  const safeMs = Math.max(500, cycleMs - warningMs - activeMs);
  const offset = step.phaseOffsetMs ?? 0;

  const positiveElapsed = Math.max(0, elapsedMs);
  const pos = (positiveElapsed + offset) % cycleMs;

  if (pos < safeMs) {
    return {
      phase: 'SAFE',
      phaseProgress: pos / safeMs
    };
  }

  if (pos < safeMs + warningMs) {
    return {
      phase: 'WARNING',
      phaseProgress: (pos - safeMs) / warningMs
    };
  }

  return {
    phase: 'ACTIVE',
    phaseProgress: Math.min(0.999, (pos - safeMs - warningMs) / activeMs)
  };
}

/**
 * Evaluates cosmetic full-screen summit blizzard intensity from the shared PRNG wind steps.
 * Synchronizes snowstorm whiteout waves identically across all clients in the Alpine Summit (350-500m).
 */
export function evaluateSummitBlizzard(
  steps: readonly ClimbStep[],
  climberHeight: number,
  elapsedMs: number,
  targetHeight: number = GAME_CONSTANTS.DEFAULT_TARGET_HEIGHT
): BlizzardEvaluation {
  const summitThreshold =
    targetHeight === 500
      ? GAME_CONSTANTS.CLIFFS_MAX_HEIGHT
      : Math.round(targetHeight * 0.7);

  if (climberHeight < summitThreshold - 10) {
    return { phase: 'SAFE', intensity: 0 };
  }

  const windSteps = steps.filter((s) => s.type === 'GUST_OF_WIND');
  if (windSteps.length === 0) {
    return { phase: 'SAFE', intensity: 0 };
  }

  // Pick a primary summit blizzard driver deterministically from the first wind step
  const primary = windSteps[0]!;
  const evalState = evaluateHazardPhase(primary, elapsedMs);

  if (evalState.phase === 'SAFE') {
    return { phase: 'SAFE', intensity: 0 };
  }

  if (evalState.phase === 'WARNING') {
    // Smoothly build wind & frost veil up to 0.35
    return {
      phase: 'WARNING',
      intensity: evalState.phaseProgress * 0.35
    };
  }

  // Pulse strongly between 0.38 and 0.55 during active whiteout, then taper at end
  const pulse = Math.sin(evalState.phaseProgress * Math.PI);
  return {
    phase: 'ACTIVE',
    intensity: 0.35 + pulse * 0.2
  };
}

/**
 * Deterministically generates a strict 50/50 2-lane mountain route
 * from `0m` to `targetHeight` (`10m` per step = 50 steps + base step 0).
 *
 * Rules:
 * - `requiredTap: 'LEFT'` -> `x = 0.25` (Left Lane center)
 * - `requiredTap: 'RIGHT'` -> `x = 0.75` (Right Lane center)
 * - Foothills (0-150m): `STATIC_LEDGE` + `SLIPPERY_LEDGE` (Mossy Rock)
 * - Steep Cliffs (150-350m): Adds `FALLING_ROCK` + `SLIPPERY_LEDGE` (Icy Ledge)
 * - Alpine Summit (350-500m): Adds cosmetic `GUST_OF_WIND` blizzard triggers
 * - Safe-Anchor Fairness: Step 0, Step 1, and Step 50 are `STATIC_LEDGE`;
 *   the step immediately before any `FALLING_ROCK` is forced to `STATIC_LEDGE`
 *   in the OPPOSITE lane so standing on it safely avoids the full-lane boulder;
 *   never places consecutive `FALLING_ROCK` steps.
 */
export function generateMountainSteps(
  options: LevelGenerationOptions
): ClimbStep[] {
  const resolvedTarget =
    options.targetHeight ??
    options.goalHeight ??
    GAME_CONSTANTS.DEFAULT_TARGET_HEIGHT;
  const stepMeters = GAME_CONSTANTS.STEP_HEIGHT_METERS;
  const totalSteps = Math.max(5, Math.round(resolvedTarget / stepMeters));

  const prng = new Mulberry32(options.seed);
  const steps: ClimbStep[] = [];

  // Step 0: Wide Base Camp Terrace at 0m
  steps.push({
    id: 'step-0',
    index: 0,
    height: 0,
    y: 0,
    requiredTap: 'LEFT',
    x: 0.5,
    type: 'STATIC_LEDGE',
    biome: 'FOOTHILLS'
  });

  let prevTap: TapDirection = prng.nextBoolean() ? 'LEFT' : 'RIGHT';
  let sameLaneStreak = 0;
  let slipperyStreak = 0;
  let stepsSinceRockfall = 99;
  let summitWindCount = 0;

  for (let i = 1; i <= totalSteps; i++) {
    const height = i * stepMeters;
    const biome = getBiomeForHeight(height, resolvedTarget);
    const prevStep = steps[i - 1]!;

    // Decide obstacle type first so FALLING_ROCK can enforce opposite-lane safe anchor
    let type: ObstacleType = 'STATIC_LEDGE';

    if (i === 1 || i === totalSteps) {
      type = 'STATIC_LEDGE';
    } else if (biome === 'FOOTHILLS') {
      // 0m - 150m: Granite + Mossy Slippery Ledge
      const roll = prng.next();
      if (roll < 0.34 && slipperyStreak < 2) {
        type = 'SLIPPERY_LEDGE';
      } else {
        type = 'STATIC_LEDGE';
      }
    } else if (biome === 'CLIFFS') {
      // 150m - 350m: Granite + Icy Slippery Ledge + Full-Lane Falling Boulders
      const roll = prng.next();
      if (stepsSinceRockfall >= 5 && i < totalSteps - 1 && roll < 0.32) {
        type = 'FALLING_ROCK';
      } else if (roll < 0.62 && slipperyStreak < 2) {
        type = 'SLIPPERY_LEDGE';
      } else {
        type = 'STATIC_LEDGE';
      }
    } else {
      // 350m - 500m (SUMMIT): Adds cosmetic Blizzard Wind Gusts
      const roll = prng.next();
      const forceAtLeastOneWind =
        summitWindCount === 0 && i === totalSteps - 3;

      if (forceAtLeastOneWind || (roll < 0.24 && prevStep.type !== 'GUST_OF_WIND')) {
        type = 'GUST_OF_WIND';
      } else if (stepsSinceRockfall >= 5 && i < totalSteps - 1 && roll < 0.48) {
        type = 'FALLING_ROCK';
      } else if (roll < 0.74 && slipperyStreak < 2) {
        type = 'SLIPPERY_LEDGE';
      } else {
        type = 'STATIC_LEDGE';
      }
    }

    // Choose strict 50/50 lane ('LEFT' -> 0.25, 'RIGHT' -> 0.75)
    let requiredTap: TapDirection;
    if (type === 'FALLING_ROCK') {
      // Place rockfall in the opposite lane from step i - 1 so step i - 1 is a 100% safe anchor out of the boulder's path
      requiredTap = prevTap === 'LEFT' ? 'RIGHT' : 'LEFT';
    } else if (prevStep.type === 'FALLING_ROCK') {
      // Step right after a rockfall switches back to the opposite lane so climber hops cleanly out of the chute
      requiredTap = prevTap === 'LEFT' ? 'RIGHT' : 'LEFT';
    } else if (sameLaneStreak >= 3) {
      requiredTap = prevTap === 'LEFT' ? 'RIGHT' : 'LEFT';
    } else {
      const switchLane = prng.nextBoolean(0.62);
      requiredTap = switchLane
        ? prevTap === 'LEFT'
          ? 'RIGHT'
          : 'LEFT'
        : prevTap;
    }

    sameLaneStreak = requiredTap === prevTap ? sameLaneStreak + 1 : 1;
    prevTap = requiredTap;

    const laneX =
      requiredTap === 'LEFT'
        ? GAME_CONSTANTS.LEFT_LANE_X
        : GAME_CONSTANTS.RIGHT_LANE_X;

    // Enforce Safe-Anchor Rule before FALLING_ROCK
    if (type === 'FALLING_ROCK') {
      prevStep.type = 'STATIC_LEDGE';
      delete prevStep.slipDurationMs;
      slipperyStreak = 0;
      stepsSinceRockfall = 0;
    } else {
      stepsSinceRockfall += 1;
      if (type === 'SLIPPERY_LEDGE') {
        slipperyStreak += 1;
      } else {
        slipperyStreak = 0;
      }
    }

    const step: ClimbStep = {
      id: `step-${i}`,
      index: i,
      height,
      y: height,
      requiredTap,
      x: laneX,
      type,
      biome
    };

    if (type === 'SLIPPERY_LEDGE') {
      step.slipDurationMs = GAME_CONSTANTS.SLIP_LIMIT_MS;
    } else if (type === 'FALLING_ROCK') {
      const cycleMs = prng.nextInt(2800, 3400);
      step.cycleMs = cycleMs;
      step.warningDurationMs = 750;
      step.activeDurationMs = prng.nextInt(950, 1150);
      step.phaseOffsetMs = prng.nextInt(0, cycleMs - 1);
    } else if (type === 'GUST_OF_WIND') {
      summitWindCount += 1;
      const cycleMs = prng.nextInt(4600, 5600);
      step.cycleMs = cycleMs;
      step.warningDurationMs = 900;
      step.activeDurationMs = prng.nextInt(1800, 2300);
      step.phaseOffsetMs = prng.nextInt(0, cycleMs - 1);
      step.windDirection = 'RIGHT';
    }

    steps.push(step);
  }

  return steps;
}

/**
 * Alias kept for backwards compatibility across workspaces.
 */
export function generateObstaclePattern(
  options: LevelGenerationOptions
): Obstacle[] {
  return generateMountainSteps(options);
}

/**
 * Generates a random 32-bit unsigned integer seed suitable for Mulberry32.
 */
export function generateRandomSeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) >>> 0);
}
