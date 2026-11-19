import { GAME_CONSTANTS, Obstacle, ObstacleType } from '../types/game';
import { Mulberry32 } from '../prng/mulberry32';

export interface LevelGenerationOptions {
  seed: number;
  goalHeight?: number;
  worldWidth?: number;
  minVerticalGap?: number;
  maxVerticalGap?: number;
}

const OBSTACLE_TYPES: readonly ObstacleType[] = [
  'STATIC_LEDGE',
  'STATIC_LEDGE',
  'CRUMBLING_ROCK',
  'MOVING_SPIKE',
  'SPRING_PAD',
  'GUST_OF_WIND'
];

/**
 * Deterministically generates an array of obstacles for a vertical climbing match.
 * Every client seeded with the same 32-bit seed produces an identical sequence.
 */
export function generateObstaclePattern(options: LevelGenerationOptions): Obstacle[] {
  const {
    seed,
    goalHeight = GAME_CONSTANTS.DEFAULT_GOAL_HEIGHT,
    worldWidth = GAME_CONSTANTS.WORLD_WIDTH,
    minVerticalGap = 60,
    maxVerticalGap = 90
  } = options;

  const prng = new Mulberry32(seed);
  const obstacles: Obstacle[] = [];

  // Start with a safe ground platform
  obstacles.push({
    id: 'base-platform',
    type: 'STATIC_LEDGE',
    x: 0,
    y: 0,
    width: worldWidth,
    height: 20
  });

  let currentY = 70;
  let index = 1;

  while (currentY < goalHeight) {
    const obstacleType = prng.pick(OBSTACLE_TYPES);
    const platformWidth = prng.nextInt(60, 110);
    const platformHeight = 16;
    const maxX = worldWidth - platformWidth;
    const platformX = prng.nextInt(10, Math.max(10, maxX - 10));

    const obstacle: Obstacle = {
      id: `obs-${index}-${currentY}`,
      type: obstacleType,
      x: platformX,
      y: currentY,
      width: platformWidth,
      height: platformHeight
    };

    switch (obstacleType) {
      case 'CRUMBLING_ROCK':
        obstacle.breakDelayMs = prng.nextInt(600, 1200);
        break;
      case 'MOVING_SPIKE':
        obstacle.speed = prng.nextInt(40, 90) * (prng.nextBoolean() ? 1 : -1);
        obstacle.minX = 10;
        obstacle.maxX = worldWidth - platformWidth - 10;
        break;
      case 'SPRING_PAD':
        obstacle.boostMultiplier = prng.nextFloat(1.5, 2.2);
        break;
      case 'GUST_OF_WIND':
        obstacle.width = worldWidth;
        obstacle.height = 30;
        obstacle.x = 0;
        obstacle.speed = prng.nextInt(30, 60) * (prng.nextBoolean() ? 1 : -1);
        break;
      case 'STATIC_LEDGE':
      default:
        break;
    }

    obstacles.push(obstacle);

    // Increase vertical height deterministically
    const gap = prng.nextInt(minVerticalGap, maxVerticalGap);
    currentY += gap;
    index++;
  }

  // Add final victory platform at the goal height
  obstacles.push({
    id: `goal-platform-${goalHeight}`,
    type: 'STATIC_LEDGE',
    x: 20,
    y: goalHeight,
    width: worldWidth - 40,
    height: 24
  });

  return obstacles;
}

/**
 * Generates a random 32-bit unsigned integer seed suitable for Mulberry32.
 */
export function generateRandomSeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) >>> 0);
}
