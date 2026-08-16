import * as ecs from "@8thwall/ecs";

import { gameData } from "../core/game-data";

import { unlockAudio } from "./audio-system";

import { trackEvent } from "../core/analytics";

export const OBJECT_PLACED_EVENT = "object-placed";

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

      .listen(eid, ecs.input.SCREEN_TOUCH_START, (e) => {
        // ----------------------------------------------
        // UNLOCK AUDIO
        //
        // This MUST happen from the real user tap.
        // ----------------------------------------------

        unlockAudio();

        // ----------------------------------------------
        // Already placed
        // ----------------------------------------------

        if (gameData.driveZonePlaced) {
          return;
        }

        // ----------------------------------------------
        // Make sure we have a ground hit
        // ----------------------------------------------

        if (!e.data.worldPosition) {
          return;
        }

        // ----------------------------------------------
        // Get prefab from Inspector
        // ----------------------------------------------

        const prefabEid = schemaAttribute.get(eid).prefab;

        // ----------------------------------------------
        // Validate prefab
        // ----------------------------------------------

        if (!prefabEid || prefabEid === 0n) {
          console.error(
            "[Placement] Error: DriveZone Prefab is not assigned in the Inspector schema!",
          );

          return;
        }

        // ----------------------------------------------
        // Instantiate DriveZone
        // ----------------------------------------------

        const driveZoneEid = world.createEntity(prefabEid);

        // ----------------------------------------------
        // Position DriveZone
        // ----------------------------------------------

        world.setPosition(
          driveZoneEid,
          e.data.worldPosition.x,
          e.data.worldPosition.y,
          e.data.worldPosition.z,
        );

        // ----------------------------------------------
        // Store DriveZone state
        // ----------------------------------------------

        gameData.driveZonePlaced = true;

        gameData.driveZoneEid = driveZoneEid;

        // ----------------------------------------------
        // Notify other systems
        // ----------------------------------------------

        world.events.dispatch(eid, OBJECT_PLACED_EVENT, {
          driveZoneEid,
        });
      });
  },
});

trackEvent("drivezone_placed");
trackEvent("game_started");
trackEvent("game_started", {
  countdownDuration: 3,
});

// --------------------------------------------------
// Reset Placement
//
// IMPORTANT:
// This function only resets placement references.
// Entity deletion is handled by resetGame().
// --------------------------------------------------

export function resetPlacement() {
  gameData.driveZonePlaced = false;

  gameData.driveZoneEid = null;

  gameData.kitchenDropoffEid = null;

  gameData.kitchenEid = null;

  gameData.kitchenSpawned = false;
}
