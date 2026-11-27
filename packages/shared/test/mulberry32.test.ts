import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Mulberry32 } from '../src/prng/mulberry32';

const take = (prng: Mulberry32, n: number): number[] =>
  Array.from({ length: n }, () => prng.next());

test('matches reference Mulberry32 output (golden values)', () => {
  // If this breaks, clients on old builds will generate different maps than new ones.
  assert.deepEqual(take(new Mulberry32(12345), 3), [
    0.9797282677609473, 0.3067522644996643, 0.484205421525985
  ]);
});

test('same seed produces identical sequence', () => {
  assert.deepEqual(take(new Mulberry32(42), 1000), take(new Mulberry32(42), 1000));
});

test('different seeds produce different sequences', () => {
  assert.notDeepEqual(take(new Mulberry32(1), 10), take(new Mulberry32(2), 10));
});

test('seed is normalised to unsigned 32-bit', () => {
  assert.deepEqual(take(new Mulberry32(-1), 5), take(new Mulberry32(0xffffffff), 5));
  assert.deepEqual(take(new Mulberry32(2 ** 32 + 7), 5), take(new Mulberry32(7), 5));
});

test('next() stays in [0, 1)', () => {
  const prng = new Mulberry32(99);
  for (let i = 0; i < 100_000; i++) {
    const v = prng.next();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test('nextInt() is inclusive on both ends and never escapes the range', () => {
  const prng = new Mulberry32(7);
  const seen = new Set<number>();
  for (let i = 0; i < 10_000; i++) {
    const v = prng.nextInt(1, 6);
    assert.ok(Number.isInteger(v) && v >= 1 && v <= 6, `out of range: ${v}`);
    seen.add(v);
  }
  assert.deepEqual([...seen].sort(), [1, 2, 3, 4, 5, 6]);
});

test('nextInt(min, min) always returns min', () => {
  const prng = new Mulberry32(3);
  for (let i = 0; i < 100; i++) assert.equal(prng.nextInt(5, 5), 5);
});

test('nextBoolean() respects probability edges', () => {
  const prng = new Mulberry32(5);
  for (let i = 0; i < 1000; i++) {
    assert.equal(prng.nextBoolean(0), false);
    assert.equal(prng.nextBoolean(1), true);
  }
});

test('pick() throws on empty array and returns members otherwise', () => {
  const prng = new Mulberry32(11);
  assert.throws(() => prng.pick([]), /empty array/);
  const items = ['a', 'b', 'c'] as const;
  for (let i = 0; i < 100; i++) assert.ok(items.includes(prng.pick(items)));
});

test('shuffle() returns a deterministic permutation without mutating input', () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8];
  const a = new Mulberry32(2024).shuffle(input);
  const b = new Mulberry32(2024).shuffle(input);
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(a, b);
  assert.deepEqual([...a].sort((x, y) => x - y), input);
});
