import * as ecs from "@8thwall/ecs";

import { gameData } from "../core/game-data";
import { unlockAudio } from "./audio-system";
import { trackEvent } from "../core/analytics";

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
// - Create DriveZone prefab
// - Place DriveZone at the fixed game origin
// - Store DriveZone EID
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
        const schema = schemaAttribute.get(eid);

        window.addEventListener("cyberwrap-start", () => {
        // --------------------------------------------
        // Already placed
        // --------------------------------------------

        if (gameData.driveZonePlaced) {
          return;
        }

        const prefabEid = schema.prefab;

        // --------------------------------------------
        // Validate prefab
        // --------------------------------------------

        if (!prefabEid || prefabEid === 0n) {
          console.error(
            "[Placement] DriveZone Prefab is not assigned in Inspector",
          );

          return;
        }

        // --------------------------------------------
        // IMPORTANT:
        //
        // This happens directly inside the user's
        // screen-touch event.
        //
        // This unlocks mobile audio before the
        // countdown begins.
        // --------------------------------------------

        unlockAudio();

        // --------------------------------------------
        // Create DriveZone
        // --------------------------------------------

        const driveZoneEid = world.createEntity(prefabEid);

        world.setPosition(driveZoneEid, 0, 0, 0);

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
        // Analytics
        // --------------------------------------------

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
