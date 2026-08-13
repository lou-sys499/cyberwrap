import * as ecs from "@8thwall/ecs";

import { gameData } from "./core/game-data";

import { GameState } from "./core/game-state";

import { resetPlacement } from "./systems/placement-system";

ecs.registerComponent({
  name: "reset-button",

  stateMachine: ({ world, defineState }) => {
    defineState("idle")
      .initial()

      .onEvent("tap", "resetting");

    defineState("resetting")
      .onEnter(() => {
        resetGame(world);
      })

      .wait(0, "idle");
  },
});

// --------------------------------------------------
// Reset Game
// --------------------------------------------------

export function resetGame(world: ecs.World) {
  console.log("[Reset] Resetting game...");

  // ==================================================
  // TRUCK
  // ==================================================

  if (gameData.truckEid !== null && gameData.truckEid !== 0n) {
    console.log("[Reset] Deleting Truck:", gameData.truckEid);

    world.deleteEntity(gameData.truckEid);
  }

  // ==================================================
  // KITCHEN
  // ==================================================

  if (gameData.kitchenEid !== null && gameData.kitchenEid !== 0n) {
    console.log("[Reset] Deleting Kitchen:", gameData.kitchenEid);

    world.deleteEntity(gameData.kitchenEid);
  }

  // ==================================================
  // COLLECTIBLES
  // ==================================================

  for (const eid of gameData.collectibleEids) {
    if (eid !== null && eid !== 0n) {
      world.deleteEntity(eid);
    }
  }

  gameData.collectibleEids.length = 0;

  // ==================================================
  // DRIVEZONE
  // ==================================================

  if (gameData.driveZoneEid !== null && gameData.driveZoneEid !== 0n) {
    console.log("[Reset] Deleting DriveZone:", gameData.driveZoneEid);

    world.deleteEntity(gameData.driveZoneEid);
  }

  // ==================================================
  // RESET PLACEMENT REFERENCES
  // ==================================================

  resetPlacement();

  // ==================================================
  // RESET COLLECTIBLES
  // ==================================================

  gameData.collectiblesSpawned = false;

  gameData.collectibleSpawnPoints.length = 0;

  gameData.collectibleSpawnMap.clear();

  gameData.totalSpawned = 0;

  gameData.totalCollectibles = 0;

  gameData.collectedCount = 0;

  // ==================================================
  // RESET CARGO
  // ==================================================

  gameData.cargo.length = 0;

  gameData.isCarrying = false;

  // Legacy delivery fields
  gameData.carryingCollectibleEid = null;

  gameData.carryingCollectibleType = 0;

  gameData.carryingCollectibleValue = 0;

  // ==================================================
  // RESET TRUCK
  // ==================================================

  gameData.truckEid = null;

  gameData.truckPlaced = false;

  gameData.truckSpeed = 0;

  gameData.truckHeading = 0;

  gameData.truckInitialHeading = 0;

  // ==================================================
  // RESET CONTROLS
  // ==================================================

  gameData.input.steering = 0;

  gameData.input.throttle = 0;

  gameData.steeringValue = 0;

  // ==================================================
  // RESET GAME
  // ==================================================

  gameData.driveZonePlaced = false;

  gameData.canDrive = false;

  gameData.gameStarted = false;

  gameData.score = 0;

  gameData.timeLeft = 60;

  gameData.countdownTime = 3;

  gameData.state = GameState.SCANNING;

  // ==================================================
  // COMPLETE
  // ==================================================

  console.log("[Reset] Complete");
}
