import * as ecs from "@8thwall/ecs";

import { gameData } from "../core/game-data";

import { unlockAudio } from "./audio-system";

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
          console.log("[Placement] No ground hit.");

          return;
        }

        // ----------------------------------------------
        // Get prefab from Inspector
        // ----------------------------------------------

        const prefabEid = schemaAttribute.get(eid).prefab;

        console.log("[Placement] Prefab:", prefabEid);

        console.log("[Placement] Hit:", e.data.worldPosition);

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

        console.log("[Placement] Spawned entity:", driveZoneEid);

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

        console.log("[Placement] DriveZone placed successfully.");

        // ----------------------------------------------
        // Notify other systems
        // ----------------------------------------------

        world.events.dispatch(eid, OBJECT_PLACED_EVENT, {
          driveZoneEid,
        });

        console.log("[Placement] OBJECT_PLACED_EVENT dispatched.");
      });
  },
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

  console.log("[Placement] Placement state reset.");
}
