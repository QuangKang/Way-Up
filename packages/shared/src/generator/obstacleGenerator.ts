import {
  ClimbStep,
  DEFAULT_MATCH_SETTINGS,
  GAME_CONSTANTS,
  HazardPhase,
  MatchSettings,
  MountainBiome,
  Obstacle,
  ObstacleType,
  sanitizeMatchSettings,
  TapDirection
} from '../types/game';
import { Mulberry32 } from '../prng/mulberry32';

export interface LevelGenerationOptions {
  seed: number;
  targetHeight?: number;
  goalHeight?: number;
  settings?: Partial<MatchSettings>;
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
  const warningMs = step.warningDurationMs ?? 900;
  const activeMs = step.activeDurationMs;
  const safeMs = Math.max(800, cycleMs - warningMs - activeMs);
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

  const primary = windSteps[0]!;
  const evalState = evaluateHazardPhase(primary, elapsedMs);

  if (evalState.phase === 'SAFE') {
    return { phase: 'SAFE', intensity: 0 };
  }

  if (evalState.phase === 'WARNING') {
    return {
      phase: 'WARNING',
      intensity: evalState.phaseProgress * 0.35
    };
  }

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
 * Supports both `generateMountainSteps({ seed, targetHeight, settings })` and
 * `generateMountainSteps(seed, targetHeight, settings)`.
 */
export function generateMountainSteps(
  optionsOrSeed: LevelGenerationOptions | number,
  maybeTargetHeight?: number,
  maybeSettings?: Partial<MatchSettings>
): ClimbStep[] {
  const options: LevelGenerationOptions =
    typeof optionsOrSeed === 'number'
      ? {
          seed: optionsOrSeed,
          targetHeight: maybeTargetHeight,
          settings: maybeSettings
        }
      : optionsOrSeed;

  const resolvedTarget =
    options.targetHeight ??
    options.goalHeight ??
    GAME_CONSTANTS.DEFAULT_TARGET_HEIGHT;
  const resolvedSettings = sanitizeMatchSettings(
    options.settings,
    DEFAULT_MATCH_SETTINGS
  );

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
  let rockfallCount = 0;
  let summitWindCount = 0;

  // Minimum 9-step spacing between FALLING_ROCK hazards (~2-4 rockfall zones across 500m)
  const MIN_ROCKFALL_SPACING = 9;
  const MAX_ROCKFALL_ZONES = 4;

  for (let i = 1; i <= totalSteps; i++) {
    const height = i * stepMeters;
    const biome = getBiomeForHeight(height, resolvedTarget);
    const prevStep = steps[i - 1]!;

    let type: ObstacleType = 'STATIC_LEDGE';

    if (i === 1 || i === totalSteps) {
      type = 'STATIC_LEDGE';
    } else if (biome === 'FOOTHILLS') {
      // 0m - 150m: Snowy Granite + Icy Slippery Hold
      const roll = prng.next();
      if (roll < 0.32 && slipperyStreak < 2) {
        type = 'SLIPPERY_LEDGE';
      } else {
        type = 'STATIC_LEDGE';
      }
    } else if (biome === 'CLIFFS') {
      // 150m - 350m: Snowy Granite + Icy Slippery Hold + Thinner Falling Boulders
      const roll = prng.next();
      const canSpawnBoulder =
        stepsSinceRockfall >= MIN_ROCKFALL_SPACING &&
        rockfallCount < MAX_ROCKFALL_ZONES &&
        i < totalSteps - 2;

      if (canSpawnBoulder && roll < 0.2) {
        type = 'FALLING_ROCK';
      } else if (roll < 0.56 && slipperyStreak < 2) {
        type = 'SLIPPERY_LEDGE';
      } else {
        type = 'STATIC_LEDGE';
      }
    } else {
      // 350m - 500m (SUMMIT): Cosmetic Blizzard Wind Gusts + Thinner Falling Boulders + Ice
      const roll = prng.next();
      const forceAtLeastOneWind =
        summitWindCount === 0 && i === totalSteps - 3;
      // A boulder would turn the previous step into a safe anchor; never overwrite a wind gust,
      // otherwise the summit can end up with zero gusts (no blizzard) and stale hazard fields.
      const canSpawnBoulder =
        stepsSinceRockfall >= MIN_ROCKFALL_SPACING &&
        rockfallCount < MAX_ROCKFALL_ZONES &&
        i < totalSteps - 2 &&
        prevStep.type !== 'GUST_OF_WIND';

      if (forceAtLeastOneWind || (roll < 0.22 && prevStep.type !== 'GUST_OF_WIND')) {
        type = 'GUST_OF_WIND';
      } else if (canSpawnBoulder && roll < 0.36) {
        type = 'FALLING_ROCK';
      } else if (roll < 0.68 && slipperyStreak < 2) {
        type = 'SLIPPERY_LEDGE';
      } else {
        type = 'STATIC_LEDGE';
      }
    }

    // Choose strict 50/50 lane ('LEFT' -> 0.25, 'RIGHT' -> 0.75)
    let requiredTap: TapDirection;
    if (type === 'FALLING_ROCK') {
      // Opposite lane from step i - 1 so standing on step i - 1 safely avoids the boulder
      requiredTap = prevTap === 'LEFT' ? 'RIGHT' : 'LEFT';
    } else if (prevStep.type === 'FALLING_ROCK') {
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
      rockfallCount += 1;
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
      // Generous 5.5s - 7.5s cycle breathing room between boulder drops
      const cycleMs = prng.nextInt(5500, 7500);
      step.cycleMs = cycleMs;
      step.warningDurationMs = 1000;
      step.activeDurationMs = prng.nextInt(1000, 1200);
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

  // Apply pre-game MatchSettings toggles while preserving deterministic step coordinates
  if (!resolvedSettings.enableIce || !resolvedSettings.enableBoulders) {
    for (const s of steps) {
      if (!resolvedSettings.enableIce && s.type === 'SLIPPERY_LEDGE') {
        s.type = 'STATIC_LEDGE';
        delete s.slipDurationMs;
      }
      if (!resolvedSettings.enableBoulders && s.type === 'FALLING_ROCK') {
        s.type = 'STATIC_LEDGE';
        delete s.cycleMs;
        delete s.warningDurationMs;
        delete s.activeDurationMs;
        delete s.phaseOffsetMs;
      }
    }
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
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
