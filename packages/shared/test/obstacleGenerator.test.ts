import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateHazardPhase,
  generateMountainSteps,
  getBiomeForHeight
} from '../src/generator/obstacleGenerator';
import { ClimbStep, GAME_CONSTANTS, sanitizeMatchSettings } from '../src/types/game';

const SEEDS = Array.from({ length: 300 }, (_, i) => (i * 2654435761) >>> 0);

const maxRun = <T>(items: T[], pred: (a: T, b: T) => boolean): number => {
  let best = items.length ? 1 : 0;
  let run = 1;
  for (let i = 1; i < items.length; i++) {
    run = pred(items[i - 1]!, items[i]!) ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
};

// ---------- getBiomeForHeight: boundary values ----------

test('biome boundaries for default 500m mountain', () => {
  assert.equal(getBiomeForHeight(0), 'FOOTHILLS');
  assert.equal(getBiomeForHeight(150), 'FOOTHILLS');
  assert.equal(getBiomeForHeight(151), 'CLIFFS');
  assert.equal(getBiomeForHeight(350), 'CLIFFS');
  assert.equal(getBiomeForHeight(351), 'SUMMIT');
  assert.equal(getBiomeForHeight(500), 'SUMMIT');
});

test('biome boundaries scale for custom target height (30% / 70%)', () => {
  assert.equal(getBiomeForHeight(300, 1000), 'FOOTHILLS');
  assert.equal(getBiomeForHeight(301, 1000), 'CLIFFS');
  assert.equal(getBiomeForHeight(700, 1000), 'CLIFFS');
  assert.equal(getBiomeForHeight(701, 1000), 'SUMMIT');
});

// ---------- evaluateHazardPhase: every branch ----------

const rock: ClimbStep = {
  id: 'r',
  index: 1,
  height: 10,
  y: 10,
  requiredTap: 'LEFT',
  x: 0.25,
  type: 'FALLING_ROCK',
  biome: 'CLIFFS',
  cycleMs: 6000,
  warningDurationMs: 1000,
  activeDurationMs: 1000,
  phaseOffsetMs: 0
};

test('hazard phase: SAFE -> WARNING -> ACTIVE -> wraps to SAFE', () => {
  // safe = 6000 - 1000 - 1000 = 4000ms
  assert.equal(evaluateHazardPhase(rock, 0).phase, 'SAFE');
  assert.equal(evaluateHazardPhase(rock, 3999).phase, 'SAFE');
  assert.equal(evaluateHazardPhase(rock, 4000).phase, 'WARNING');
  assert.equal(evaluateHazardPhase(rock, 4999).phase, 'WARNING');
  assert.equal(evaluateHazardPhase(rock, 5000).phase, 'ACTIVE');
  assert.equal(evaluateHazardPhase(rock, 5999).phase, 'ACTIVE');
  assert.equal(evaluateHazardPhase(rock, 6000).phase, 'SAFE');
});

test('hazard phase: progress stays in [0, 1)', () => {
  for (let t = 0; t < 12_000; t += 37) {
    const { phaseProgress } = evaluateHazardPhase(rock, t);
    assert.ok(phaseProgress >= 0 && phaseProgress < 1, `t=${t} p=${phaseProgress}`);
  }
});

test('hazard phase: phaseOffsetMs shifts the cycle', () => {
  const shifted = { ...rock, phaseOffsetMs: 4000 };
  assert.equal(evaluateHazardPhase(shifted, 0).phase, 'WARNING');
});

test('hazard phase: negative elapsed is treated as 0', () => {
  assert.deepEqual(evaluateHazardPhase(rock, -5000), evaluateHazardPhase(rock, 0));
});

test('hazard phase: non-periodic or incomplete steps are always SAFE', () => {
  assert.equal(evaluateHazardPhase({ ...rock, type: 'STATIC_LEDGE' }, 5500).phase, 'SAFE');
  assert.equal(evaluateHazardPhase({ ...rock, cycleMs: undefined }, 5500).phase, 'SAFE');
  assert.equal(evaluateHazardPhase({ ...rock, activeDurationMs: undefined }, 5500).phase, 'SAFE');
});

// ---------- generateMountainSteps ----------

test('same seed generates identical mountain (multiplayer sync)', () => {
  for (const seed of SEEDS.slice(0, 20)) {
    assert.deepEqual(generateMountainSteps(seed), generateMountainSteps(seed));
    assert.deepEqual(generateMountainSteps(seed, 500), generateMountainSteps({ seed, targetHeight: 500 }));
  }
});

test('different seeds generate different mountains', () => {
  assert.notDeepEqual(generateMountainSteps(1), generateMountainSteps(2));
});

test('500m mountain has 51 steps, 10m apart, correct lanes and biomes', () => {
  const steps = generateMountainSteps(123);
  assert.equal(steps.length, 51);
  steps.forEach((s, i) => {
    assert.equal(s.index, i);
    assert.equal(s.height, i * GAME_CONSTANTS.STEP_HEIGHT_METERS);
    assert.equal(s.biome, getBiomeForHeight(s.height));
    if (i > 0) {
      const expectedX = s.requiredTap === 'LEFT' ? GAME_CONSTANTS.LEFT_LANE_X : GAME_CONSTANTS.RIGHT_LANE_X;
      assert.equal(s.x, expectedX);
    }
  });
});

test('very small target height still produces at least 5 climbing steps', () => {
  assert.equal(generateMountainSteps(1, 10).length, 6);
});

test('route invariants hold for many seeds', () => {
  for (const seed of SEEDS) {
    const steps = generateMountainSteps(seed);
    const last = steps.length - 1;
    const ctx = `seed=${seed}`;

    // Base camp, first and final step are always safe.
    assert.equal(steps[0]!.type, 'STATIC_LEDGE', ctx);
    assert.equal(steps[1]!.type, 'STATIC_LEDGE', ctx);
    assert.equal(steps[last]!.type, 'STATIC_LEDGE', ctx);

    const climb = steps.slice(1);

    // Never more than 3 taps in the same lane in a row.
    assert.ok(maxRun(climb, (a, b) => a.requiredTap === b.requiredTap) <= 3, `${ctx} same-lane run`);

    // Never more than 2 icy ledges in a row.
    assert.ok(
      maxRun(climb, (a, b) => a.type === 'SLIPPERY_LEDGE' && b.type === 'SLIPPERY_LEDGE') <= 2,
      `${ctx} slippery run`
    );

    const rockIdx = steps.flatMap((s, i) => (s.type === 'FALLING_ROCK' ? [i] : []));
    assert.ok(rockIdx.length <= 4, `${ctx} too many rockfalls`);
    for (let k = 1; k < rockIdx.length; k++) {
      assert.ok(rockIdx[k]! - rockIdx[k - 1]! >= 9, `${ctx} rockfalls too close`);
    }

    for (const i of rockIdx) {
      const s = steps[i]!;
      const prev = steps[i - 1]!;
      assert.notEqual(s.biome, 'FOOTHILLS', `${ctx} rock in foothills`);
      assert.equal(prev.type, 'STATIC_LEDGE', `${ctx} no safe anchor before rock at ${i}`);
      assert.notEqual(s.requiredTap, prev.requiredTap, `${ctx} rock in same lane as anchor`);
      assert.ok(s.cycleMs! >= 5500 && s.cycleMs! <= 7500, ctx);
      assert.ok(s.activeDurationMs! >= 1000 && s.activeDurationMs! <= 1200, ctx);
      assert.ok(s.phaseOffsetMs! >= 0 && s.phaseOffsetMs! < s.cycleMs!, ctx);
    }

    for (const s of steps.filter((x) => x.type === 'GUST_OF_WIND')) {
      assert.equal(s.biome, 'SUMMIT', `${ctx} wind outside summit`);
      assert.ok(s.cycleMs! >= 4600 && s.cycleMs! <= 5600, ctx);
    }

    for (const s of steps.filter((x) => x.type === 'SLIPPERY_LEDGE')) {
      assert.equal(s.slipDurationMs, GAME_CONSTANTS.SLIP_LIMIT_MS, ctx);
    }
  }
});

test('summit always contains at least one wind gust', () => {
  const missing = SEEDS.filter(
    (seed) => !generateMountainSteps(seed).some((s) => s.type === 'GUST_OF_WIND')
  );
  assert.deepEqual(missing, [], `seeds without wind: ${missing.slice(0, 10).join(', ')}`);
});

test('disabling ice/boulders removes them but keeps the same lane layout', () => {
  for (const seed of SEEDS.slice(0, 50)) {
    const normal = generateMountainSteps(seed);
    const plain = generateMountainSteps(seed, 500, { enableIce: false, enableBoulders: false });
    assert.ok(!plain.some((s) => s.type === 'SLIPPERY_LEDGE' || s.type === 'FALLING_ROCK'));
    assert.deepEqual(plain.map((s) => s.x), normal.map((s) => s.x));
    for (const s of plain.filter((x) => x.type === 'STATIC_LEDGE')) {
      assert.equal(s.slipDurationMs, undefined);
      assert.equal(s.cycleMs, undefined);
    }
  }
});

// ---------- sanitizeMatchSettings: boundary values ----------

test('sanitizeMatchSettings clamps time limit to [60, 300]', () => {
  assert.equal(sanitizeMatchSettings({ timeLimitSec: 59 }).timeLimitSec, 60);
  assert.equal(sanitizeMatchSettings({ timeLimitSec: 60 }).timeLimitSec, 60);
  assert.equal(sanitizeMatchSettings({ timeLimitSec: 300 }).timeLimitSec, 300);
  assert.equal(sanitizeMatchSettings({ timeLimitSec: 301 }).timeLimitSec, 300);
  assert.equal(sanitizeMatchSettings({ timeLimitSec: 90.6 }).timeLimitSec, 91);
});

test('sanitizeMatchSettings falls back to base on invalid input', () => {
  const base = { enableBoulders: false, enableIce: false, timeLimitSec: 120 };
  const bad = { timeLimitSec: NaN, enableIce: 'yes', enableBoulders: 1 } as never;
  assert.deepEqual(sanitizeMatchSettings(bad, base), base);
  assert.deepEqual(sanitizeMatchSettings(undefined, base), base);
});
