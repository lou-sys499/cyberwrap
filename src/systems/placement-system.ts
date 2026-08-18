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
// Tap To Place
//
// Responsibilities:
// - Listen for screen tap
// - Create DriveZone prefab
// - Place DriveZone on detected ground
// - Store DriveZone EID
// - Notify other systems
// --------------------------------------------------

ecs.registerComponent({
  name: "tap-to-place",

  schema: {
    prefab: ecs.eid,
  },

  stateMachine: ({ world, eid, schemaAttribute, defineState }) => {
    defineState("initial")
      .initial()

      .onEnter(() => {
        console.log("[Placement] Ready for DriveZone placement");

        showPlacementHint();
      })

      .listen(eid, ecs.input.SCREEN_TOUCH_START, (e) => {
        console.log("[Placement] Screen tap detected");

        // ------------------------------------------------
        // Already placed
        // ------------------------------------------------

        if (gameData.driveZonePlaced) {
          console.log("[Placement] DriveZone already placed");
          return;
        }

        // ------------------------------------------------
        // Unlock audio from real user interaction
        // ------------------------------------------------

        unlockAudio();

        // ------------------------------------------------
        // Make sure we have a valid ground hit
        // ------------------------------------------------

        if (!e.data.worldPosition) {
          console.log("[Placement] No valid ground position");

          return;
        }

        // ------------------------------------------------
        // Get prefab
        // ------------------------------------------------

        const prefabEid = schemaAttribute.get(eid).prefab;

        // ------------------------------------------------
        // Validate prefab
        // ------------------------------------------------

        if (!prefabEid || prefabEid === 0n) {
          console.error(
            "[Placement] DriveZone Prefab is not assigned in Inspector",
          );

          return;
        }

        // ------------------------------------------------
        // Create DriveZone
        // ------------------------------------------------

        const driveZoneEid = world.createEntity(prefabEid);

        console.log("[Placement] DriveZone created:", driveZoneEid);

        // ------------------------------------------------
        // Place DriveZone
        // ------------------------------------------------

        world.setPosition(
          driveZoneEid,
          e.data.worldPosition.x,
          e.data.worldPosition.y,
          e.data.worldPosition.z,
        );

        console.log(
          "[Placement] DriveZone positioned at:",
          e.data.worldPosition.x,
          e.data.worldPosition.y,
          e.data.worldPosition.z,
        );

        // ------------------------------------------------
        // Store state
        // ------------------------------------------------

        gameData.driveZonePlaced = true;

        gameData.driveZoneEid = driveZoneEid;

        // ------------------------------------------------
        // Hide placement instruction
        // ------------------------------------------------

        hidePlacementHint();

        // ------------------------------------------------
        // Analytics
        // ------------------------------------------------

        trackEvent("drivezone_placed");

        // ------------------------------------------------
        // Notify other systems
        // ------------------------------------------------

        world.events.dispatch(eid, OBJECT_PLACED_EVENT, {
          driveZoneEid,
        });

        console.log("[Placement] DriveZone placement complete");
      });
  },
});

// --------------------------------------------------
// Reset Placement
//
// IMPORTANT:
// Entity deletion is handled by resetGame().
// This only resets placement references.
// --------------------------------------------------

export function resetPlacement(): void {
  gameData.driveZonePlaced = false;

  gameData.driveZoneEid = null;

  gameData.kitchenDropoffEid = null;

  gameData.kitchenEid = null;

  gameData.kitchenSpawned = false;

  // Show instruction again after reset.
  showPlacementHint();
}
