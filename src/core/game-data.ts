import * as ecs from "@8thwall/ecs";

import { GameState } from "./game-state";

// --------------------------------------------------
// Input
// --------------------------------------------------

export interface InputState {
  // Steering wheel value
  //
  // -1 = left
  //  0 = center
  // +1 = right

  steering: number;

  // throttle
  //
  // -1 = GAS
  //  0 = idle
  // +1 = REV

  throttle: number;
}

// --------------------------------------------------
// Cargo
// --------------------------------------------------

export interface CargoItem {
  type: number;
  value: number;
}

// --------------------------------------------------
// Analytics / Session Statistics
// --------------------------------------------------
//
// These values describe the current CyberWrap
// gameplay session.
//
// They are NOT personal information.
//
// They are simply counters that allow analytics
// events to contain useful gameplay information.
//
// IMPORTANT:
// These values should only be sent through analytics
// when the player has granted analytics consent.
// --------------------------------------------------

export interface GameSessionStats {
  gamesStarted: number;

  collectiblesCollected: number;

  deliveriesCompleted: number;

  highestScore: number;

  gamesCompleted: number;
}

// --------------------------------------------------
// Global Game Data
// --------------------------------------------------

export const gameData = {
  // --------------------------------------------------
  // Placement
  // --------------------------------------------------

  driveZonePlaced: false,

  driveZoneEid: null as ecs.Eid | null,

  // --------------------------------------------------
  // Truck
  // --------------------------------------------------

  truckEid: null as ecs.Eid | null,

  truckPlaced: false,

  truckSpeed: 0,

  truckLateralVelocity: 0,

  truckHeading: 0,

  truckInitialHeading: 0,

  // --------------------------------------------------
  // Controls
  // --------------------------------------------------

  input: {
    steering: 0,

    throttle: 0,
  } as InputState,

  // Steering smoothing

  steeringValue: 0,

  // --------------------------------------------------
  // Collectibles
  // --------------------------------------------------

  collectiblesSpawned: false,

  collectibleEids: [] as ecs.Eid[],

  collectibleSpawnPoints: [] as ecs.Eid[],

  collectibleSpawnMap: new Map<ecs.Eid, ecs.Eid>(),

  maxActiveCollectibles: 4,

  totalSpawned: 0,

  totalCollectibles: 0,

  collectedCount: 0,

  deliveriesCompleted: 0,

  // --------------------------------------------------
  // Kitchen Delivery
  // --------------------------------------------------

  // Runtime KitchenDropoff marker inside DriveZone

  kitchenDropoffEid: null as ecs.Eid | null,

  // Runtime spawned Kitchen entity

  kitchenEid: null as ecs.Eid | null,

  // True after KitchenPrefab has appeared

  kitchenSpawned: false,

  // --------------------------------------------------
  // Cargo
  // --------------------------------------------------

  // Food currently being carried by the truck.
  //
  // The truck can collect MULTIPLE items before
  // returning to the kitchen.

  cargo: [] as CargoItem[],

  // Convenience flag.
  //
  // true when cargo.length > 0.

  isCarrying: false,

  // --------------------------------------------------
  // Legacy Delivery Fields
  // --------------------------------------------------

  // Keep these for compatibility with any existing
  // systems that may still reference them.
  //
  // They are no longer used by collectible-manager
  // for the new multi-item cargo system.

  carryingCollectibleEid: null as ecs.Eid | null,

  carryingCollectibleType: 0,

  carryingCollectibleValue: 0,

  // --------------------------------------------------
  // Game State
  // --------------------------------------------------

  canDrive: false,

  gameStarted: false,

  state: GameState.START,

  score: 0,

  timeLeft: 60,

  countdownTime: 3,

  // --------------------------------------------------
  // Analytics / Session Statistics
  // --------------------------------------------------

  sessionStats: {
    // Number of rounds started during this
    // CyberWrap browser session.

    gamesStarted: 0,

    // Total ingredients collected.

    collectiblesCollected: 0,

    // Number of successful deliveries.

    deliveriesCompleted: 0,

    // Highest score achieved during this
    // browser session.

    highestScore: 0,

    // Number of rounds that reached the
    // normal game completion state.

    gamesCompleted: 0,
  } as GameSessionStats,
};
