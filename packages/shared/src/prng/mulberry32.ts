/**
 * Mulberry32 is a deterministic 32-bit pseudo-random number generator (PRNG).
 *
 * Characteristics:
 * - 32-bit internal state initialized from a shared seed.
 * - Uniform distribution with an extremely fast cycle (~4.29 billion numbers).
 * - Guarantees identical obstacle, hazard, and collectible layout across
 *   all multiplayer client sessions when seeded with the same 32-bit integer.
 */
export class Mulberry32 {
  private state: number;

  /**
   * Initializes the PRNG with a 32-bit seed.
   * Forces unsigned 32-bit representation.
   */
  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /**
   * Generates the next pseudorandom float in the half-open interval [0, 1).
   */
  public next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generates a pseudorandom integer between min and max (inclusive).
   */
  public nextInt(min: number, max: number): number {
    const lower = Math.ceil(min);
    const upper = Math.floor(max);
    return Math.floor(this.next() * (upper - lower + 1)) + lower;
  }

  /**
   * Generates a pseudorandom float between min (inclusive) and max (exclusive).
   */
  public nextFloat(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Generates a boolean with a given probability of being true (default 0.5).
   */
  public nextBoolean(probability = 0.5): boolean {
    return this.next() < probability;
  }

  /**
   * Picks a random element from a non-empty array.
   */
  public pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot pick from an empty array');
    }
    const index = this.nextInt(0, items.length - 1);
    const item = items[index];
    if (item === undefined) {
      throw new Error('Selected index out of range');
    }
    return item;
  }

  /**
   * Deterministically shuffles a copy of an array using Fisher-Yates algorithm.
   */
  public shuffle<T>(array: readonly T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      const temp = result[i];
      const target = result[j];
      if (temp !== undefined && target !== undefined) {
        result[i] = target;
        result[j] = temp;
      }
    }
    return result;
  }

  /**
   * Returns current internal state integer.
   */
  public getState(): number {
    return this.state >>> 0;
  }
}

/**
 * Creates a deterministic Mulberry32 PRNG instance.
 */
export function createMulberry32(seed: number): Mulberry32 {
  return new Mulberry32(seed);
}
