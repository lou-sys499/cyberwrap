import * as ecs from "@8thwall/ecs";

import { gameData } from "./core/game-data";
import { GameState } from "./core/game-state";

import { resetPlacement } from "./systems/placement-system";

import { trackEvent } from "./core/analytics";

import { resetGameOverAnalytics } from "./ui/game-over";
import { resetChaseCamera } from "./systems/chase-camera";
import { hideTimeoutContinue } from "./ui/timeout-continue";
import { resetNitro } from "./core/nitro";

// --------------------------------------------------
// Reset Button
//
// Responsibilities:
//
// - Listen for reset / replay action
// - Delete current gameplay entities
// - Reset gameplay state
// - Reset placement state
// - Reset cargo
// - Reset collectibles
// - Reset truck state
// - Reset controls
// - Reset game-over UI state
// - Record replay analytics ONLY when a real
//   replay/reset of an active round occurs
//
// IMPORTANT:
//
// Session analytics statistics in gameData.sessionStats
// are intentionally NOT reset here.
//
// They represent the entire browser session.
// --------------------------------------------------

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

export function resetGame(world: ecs.World): void {
  // ==================================================
  // DETERMINE WHETHER THIS IS A REAL REPLAY
  // ==================================================
  //
  // We capture this BEFORE resetting gameData.
  //
  // A replay means the player had actually started
  // or completed a game.
  //
  // This prevents "replay_started" from being recorded
  // when the reset function is used during setup.
  // ==================================================

  const wasReplay =
    gameData.gameStarted ||
    gameData.state === GameState.DRIVING ||
    gameData.state === GameState.TIMEOUT_PENDING_CONTINUE ||
    gameData.state === GameState.GAMEOVER;

  // ==================================================
  // ANALYTICS
  // ==================================================
  //
  // Record replay only when a real round was active.
  //
  // This must happen BEFORE the state is reset.
  // ==================================================

  if (wasReplay) {
    trackEvent("replay_started", {
      previousScore: gameData.score,
      previousTimeLeft: gameData.timeLeft,
      previousCollected: gameData.collectedCount,
    });
  }

  // ==================================================
  // RESET TIMEOUT & GAME-OVER UI
  // ==================================================
  //
  // Important because the PLAY AGAIN or RESET button may have
  // triggered this reset while the game-over panel or timeout
  // panel is still considered visible internally.
  // ==================================================

  hideTimeoutContinue();
  resetGameOverAnalytics();

  // ==================================================
  // TRUCK
  // ==================================================

  if (gameData.truckEid !== null && gameData.truckEid !== 0n) {
    world.deleteEntity(gameData.truckEid);
  }

  // ==================================================
  // KITCHEN
  // ==================================================

  if (gameData.kitchenEid !== null && gameData.kitchenEid !== 0n) {
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
  // DRIVEZONE / CITY ENVIRONMENT (Remains persistent)
  // ==================================================
  // Static Mount Fako city environment is preserved across rounds.
  // We do not delete the city root to ensure seamless instant replay.

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

  // --------------------------------------------------
  // Legacy delivery fields
  // --------------------------------------------------

  gameData.carryingCollectibleEid = null;

  gameData.carryingCollectibleType = 0;

  gameData.carryingCollectibleValue = 0;

  // ==================================================
  // RESET KITCHEN STATE
  // ==================================================

  gameData.kitchenDropoffEid = null;

  gameData.kitchenEid = null;

  gameData.kitchenSpawned = false;

  // ==================================================
  // RESET TRUCK & CAMERA
  // ==================================================

  gameData.truckEid = null;

  gameData.truckPlaced = false;

  gameData.truckSpeed = 0;

  gameData.truckHeading = 0;

  gameData.truckInitialHeading = 0;

  resetChaseCamera();

  // ==================================================
  // RESET CONTROLS
  // ==================================================

  gameData.input.steering = 0;

  gameData.input.throttle = 0;

  gameData.steeringValue = 0;

  // ==================================================
  // RESET GAME FLAGS
  // ==================================================

  gameData.driveZonePlaced = false;

  gameData.canDrive = false;

  gameData.gameStarted = false;

  // ==================================================
  // RESET ROUND SCORE
  // ==================================================

  gameData.score = 0;

  // ==================================================
  // RESET TIMER
  // ==================================================

  gameData.timeLeft = 60;

  gameData.countdownTime = 3;

  // ==================================================
  // RESET NITRO BOOST
  // ==================================================

  resetNitro();

  // ==================================================
  // RESET GAME STATE
  // ==================================================

  gameData.state = GameState.START;

  // ==================================================
  // IMPORTANT:
  //
  // DO NOT RESET gameData.sessionStats HERE.
  //
  // sessionStats belongs to the browser session and
  // should continue accumulating across replays.
  //
  // Example:
  //
  // Game 1:
  // gamesStarted = 1
  //
  // Replay:
  // gamesStarted = 2
  //
  // Game 3:
  // gamesStarted = 3
  //
  // etc.
  // ==================================================
}
