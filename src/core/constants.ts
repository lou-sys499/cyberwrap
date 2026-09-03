/**
 * CyberWrap Game Constants
 *
 * Central configuration file.
 * All systems should import GAME_CONFIG from here.
 */

export const GAME_CONFIG = {
  COLLECTIBLE_RESPAWN_DELAY: 1.5,

  MAX_ACTIVE_COLLECTIBLES: 4,

  /**
   * Game timing
   */
  ROUND_TIME: 60,

  COUNTDOWN_TIME: 3,

  /**
   * Score
   */
  MAX_SCORE: 9999,

  STARTING_SCORE: 0,

  /**
   * Collectibles
   */
  MAX_COLLECTIBLES: 4,

  COLLECTIBLES_COUNT: 4,

  COLLECTION_RADIUS: 2.3,

  /**
   * Vehicle physics
   */
  MAX_SPEED: 6.5,

  REVERSE_MAX_SPEED: -3.2,

  ACCELERATION: 8.5,

  FRICTION: 3.5,

  TURN_SPEED: 3.2,

  STEER_SPEED: 3.2,

  /**
   * Nitro Boost configuration
   */
  NITRO_DURATION: 5.0,

  NITRO_ACCELERATION_MULTIPLIER: 1.5,

  /**
   * Track spawn points
   */
  TOTAL_SPAWN_POINTS: 24,

  /**
   * Local offsets from DriveZone center.
   * These are fallback positions if prefab spawn points
   * are not used.
   */
  SPAWN_POINT_OFFSETS: [
    { x: 0.5, y: 0.05, z: 0.5 },
    { x: -0.5, y: 0.05, z: 0.5 },

    { x: 1, y: 0.05, z: 0 },
    { x: -1, y: 0.05, z: 0 },

    { x: 0.5, y: 0.05, z: -0.5 },
    { x: -0.5, y: 0.05, z: -0.5 },

    { x: 1, y: 0.05, z: -1 },
    { x: -1, y: 0.05, z: -1 },

    { x: 0, y: 0.05, z: 1 },
    { x: 0, y: 0.05, z: -1 },

    { x: 1.2, y: 0.05, z: 1.2 },
    { x: -1.2, y: 0.05, z: 1.2 },

    { x: 1.2, y: 0.05, z: -1.2 },
    { x: -1.2, y: 0.05, z: -1.2 },

    { x: 0.8, y: 0.05, z: 0.8 },
    { x: -0.8, y: 0.05, z: 0.8 },

    { x: 0.8, y: 0.05, z: -0.8 },
    { x: -0.8, y: 0.05, z: -0.8 },

    { x: 1.5, y: 0.05, z: 0 },
    { x: -1.5, y: 0.05, z: 0 },

    { x: 0, y: 0.05, z: 1.5 },
    { x: 0, y: 0.05, z: -1.5 },

    { x: 1.5, y: 0.05, z: 1.5 },
    { x: -1.5, y: 0.05, z: -1.5 },
  ],
} as const;

/**
 * Collectible Types
 */
export enum CollectibleKind {
  BURRITO = "burrito",
  FRIES = "fries",
  STEAK = "steak",
  CHILI = "chili",
}

/**
 * Collectible scoring
 */
export const COLLECTIBLE_CONFIGS = {
  burrito: {
    points: 100,
  },

  fries: {
    points: 150,
  },

  steak: {
    points: 200,
  },

  chili: {
    points: 250,
  },
} as const;
