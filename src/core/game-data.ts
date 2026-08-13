import * as ecs from "@8thwall/ecs";

import { GameState } from "./game-state";

// --------------------------------------------------
// Input
// --------------------------------------------------

export interface InputState {
  // Steering wheel value
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

  state: GameState.SCANNING,

  score: 0,

  timeLeft: 60,

  countdownTime: 3,
};
