import * as ecs from "@8thwall/ecs";

import { gameData } from "../core/game-data";
import { unlockAudio } from "./audio-system";
import { trackEvent } from "../core/analytics";
import { buildFakoCity } from "../world/city-generator";
import { recordFakoLifecycleEvent } from "../core/diagnostics";

export const OBJECT_PLACED_EVENT = "object-placed";

// --------------------------------------------------
// Hide placement instruction
// --------------------------------------------------

function hidePlacementHint(): void {
  const hint = document.getElementById("cyberwrap-placement-hint");

  if (!hint) {
    return;
  }

  hint.classList.add("hidden");
}

// --------------------------------------------------
// Show placement instruction
// --------------------------------------------------

function showPlacementHint(): void {
  const hint = document.getElementById("cyberwrap-placement-hint");

  if (!hint) {
    return;
  }

  hint.classList.remove("hidden");
}

// --------------------------------------------------
// Fixed DriveZone startup
//
// Responsibilities:
// - Listen for the browser PLAY gesture
// - Unlock mobile audio
// - Instantiate Mount Fako Heights procedural city environment
// - Store DriveZone / Environment EID
// - Hide placement instruction
// - Notify other systems
// --------------------------------------------------

ecs.registerComponent({
  name: "fixed-startup",

  schema: {
    prefab: ecs.eid,
  },

  stateMachine: ({ world, eid, schemaAttribute, defineState }) => {
    defineState("initial")
      .initial()

      .onEnter(() => {
        window.addEventListener("cyberwrap-start", () => {
          recordFakoLifecycleEvent("gameStartCount");
          // --------------------------------------------
          // Already placed
          // --------------------------------------------

          if (gameData.driveZonePlaced) {
            return;
          }

          // --------------------------------------------
          // Unlock mobile audio before countdown begins
          // --------------------------------------------

          unlockAudio();

          // --------------------------------------------
          // Create Mount Fako Heights procedural city environment
          // (Disables old DriveZonePrefab / track instantiation)
          // --------------------------------------------

          const driveZoneEid = buildFakoCity(world);

          // --------------------------------------------
          // Store placement state
          // --------------------------------------------

          gameData.driveZonePlaced = true;

          gameData.driveZoneEid = driveZoneEid;

          // --------------------------------------------
          // Hide placement instruction
          // --------------------------------------------

          hidePlacementHint();

          // --------------------------------------------
          // Notify other systems
          // --------------------------------------------

          world.events.dispatch(eid, OBJECT_PLACED_EVENT, {
            driveZoneEid,
          });
        });
      });
  },
});

// --------------------------------------------------
// Reset Placement
//
// IMPORTANT:
// Entity deletion is handled by resetGame().
// This function only resets placement references.
// --------------------------------------------------

export function resetPlacement(): void {
  gameData.driveZonePlaced = false;

  gameData.driveZoneEid = null;

  gameData.kitchenDropoffEid = null;

  gameData.kitchenEid = null;

  gameData.kitchenSpawned = false;

  // Show placement instruction again.
  showPlacementHint();
}
