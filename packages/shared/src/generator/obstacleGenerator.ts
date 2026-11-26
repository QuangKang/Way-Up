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

/**
 * Resolves the mountain biome for a given altitude (0-150m Foothills, 150-350m Cliffs, 350-500m Summit).
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
 * Deterministically evaluates the current cycle state ('SAFE' | 'WARNING' | 'ACTIVE')
 * for a periodic hazard (`FALLING_ROCK` or `GUST_OF_WIND`) at `elapsedMs`.
 */
export function evaluateHazardPhase(
  step: ClimbStep,
  elapsedMs: number
): HazardCycleEvaluation {
  if (!isPeriodicHazard(step.type) || !step.cycleMs || !step.activeDurationMs) {
    return { phase: 'SAFE', phaseProgress: 0 };
  }

  const cycleMs = step.cycleMs;
  const warningMs = step.warningDurationMs ?? 600;
  const activeMs = step.activeDurationMs;
  const safeMs = Math.max(400, cycleMs - warningMs - activeMs);
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
 * Deterministically generates a fair, climbable step-by-step alpine route
 * from `0m` to `targetHeight` (`10m` per step) from a shared 32-bit seed.
 *
 * Enforces:
 * - Biome progression: Foothills (0-150m), Steep Cliffs (150-350m), Alpine Summit (350-500m).
 * - Safe-Anchor Rule: Step 0, Step 1, and the final summit step are `STATIC_LEDGE`;
 *   whenever step `i` has `FALLING_ROCK` or `GUST_OF_WIND`, step `i - 1` is forced to `STATIC_LEDGE`.
 * - No consecutive hazards (`FALLING_ROCK` / `GUST_OF_WIND`).
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

  // Step 0: Base Camp Granite Ledge at 0m
  steps.push({
    id: 'step-0',
    index: 0,
    height: 0,
    y: 0,
    requiredTap: 'RIGHT',
    x: 0.5,
    type: 'STATIC_LEDGE',
    biome: 'FOOTHILLS'
  });

  let prevX = 0.5;
  let prevTap: TapDirection = prng.nextBoolean() ? 'LEFT' : 'RIGHT';
  let sameTapStreak = 0;
  let crumbleStreak = 0;

  for (let i = 1; i <= totalSteps; i++) {
    const height = i * stepMeters;
    const biome = getBiomeForHeight(height, resolvedTarget);
    const shift = prng.nextFloat(0.125, 0.165);

    let requiredTap: TapDirection;
    if (prevX - shift < 0.18) {
      requiredTap = 'RIGHT';
    } else if (prevX + shift > 0.82) {
      requiredTap = 'LEFT';
    } else if (sameTapStreak >= 2) {
      requiredTap = prevTap === 'LEFT' ? 'RIGHT' : 'LEFT';
    } else {
      // Favor crisp rhythmic alternation (~62%) mixed with double-taps (~38%)
      const shouldAlternate = prng.nextBoolean(0.62);
      requiredTap = shouldAlternate
        ? prevTap === 'LEFT'
          ? 'RIGHT'
          : 'LEFT'
        : prevTap;
    }

    sameTapStreak = requiredTap === prevTap ? sameTapStreak + 1 : 1;
    prevTap = requiredTap;

    const rawX = requiredTap === 'LEFT' ? prevX - shift : prevX + shift;
    const clampedX = Math.round(Math.max(0.18, Math.min(0.82, rawX)) * 1000) / 1000;
    prevX = clampedX;

    const prevStep = steps[i - 1]!;
    const prevWasHazard = isPeriodicHazard(prevStep.type);

    let type: ObstacleType = 'STATIC_LEDGE';

    if (i === 1 || i === totalSteps) {
      type = 'STATIC_LEDGE';
    } else if (biome === 'FOOTHILLS') {
      // 0m - 150m: Only STATIC_LEDGE and CRUMBLING_ROCK
      const roll = prng.next();
      if (roll < 0.34 && crumbleStreak < 2) {
        type = 'CRUMBLING_ROCK';
      } else {
        type = 'STATIC_LEDGE';
      }
    } else if (biome === 'CLIFFS') {
      // 150m - 350m: STATIC_LEDGE, CRUMBLING_ROCK, FALLING_ROCK
      const roll = prng.next();
      if (!prevWasHazard && roll < 0.28) {
        type = 'FALLING_ROCK';
      } else if (roll < 0.56 && crumbleStreak < 2) {
        type = 'CRUMBLING_ROCK';
      } else {
        type = 'STATIC_LEDGE';
      }
    } else {
      // 350m - 500m (SUMMIT): Adds GUST_OF_WIND alongside FALLING_ROCK, CRUMBLING_ROCK, STATIC_LEDGE
      const roll = prng.next();
      if (!prevWasHazard && roll < 0.22) {
        type = 'GUST_OF_WIND';
      } else if (!prevWasHazard && roll < 0.42) {
        type = 'FALLING_ROCK';
      } else if (roll < 0.68 && crumbleStreak < 2) {
        type = 'CRUMBLING_ROCK';
      } else {
        type = 'STATIC_LEDGE';
      }
    }

    // Safe-Anchor Rule: Force step i - 1 to STATIC_LEDGE before any periodic hazard
    if (isPeriodicHazard(type)) {
      prevStep.type = 'STATIC_LEDGE';
      delete prevStep.breakDelayMs;
      crumbleStreak = 0;
    } else if (type === 'CRUMBLING_ROCK') {
      crumbleStreak += 1;
    } else {
      crumbleStreak = 0;
    }

    const step: ClimbStep = {
      id: `step-${i}`,
      index: i,
      height,
      y: height,
      requiredTap,
      x: clampedX,
      type,
      biome
    };

    if (type === 'CRUMBLING_ROCK') {
      step.breakDelayMs = GAME_CONSTANTS.CRUMBLE_BREAK_MS;
    } else if (type === 'FALLING_ROCK') {
      const cycleMs = prng.nextInt(2400, 3000);
      step.cycleMs = cycleMs;
      step.warningDurationMs = 600;
      step.activeDurationMs = prng.nextInt(720, 880);
      step.phaseOffsetMs = prng.nextInt(0, cycleMs - 1);
    } else if (type === 'GUST_OF_WIND') {
      const cycleMs = prng.nextInt(2500, 3100);
      step.cycleMs = cycleMs;
      step.warningDurationMs = 620;
      step.activeDurationMs = prng.nextInt(780, 940);
      step.phaseOffsetMs = prng.nextInt(0, cycleMs - 1);
      step.windDirection = prng.nextBoolean() ? 'RIGHT' : 'LEFT';
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
