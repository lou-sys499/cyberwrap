import * as ecs from "@8thwall/ecs";

import { gameData } from "../core/game-data";

// --------------------------------------------------
// Truck Controller
//
// Purpose:
// - Initialize spawned truck
// - Store initial heading
// - Prepare truck state
//
// Movement is handled ONLY by:
// driving-system.ts
// --------------------------------------------------

ecs.registerComponent({
  name: "truck-controller",

  schema: {},

  stateMachine: ({ world, eid, defineState }) => {
    defineState("ready")
      .initial()

      .onEnter(() => {
        console.log("[TruckController] Initialized", eid);

        //------------------------------------
        // Only configure the actual truck
        //------------------------------------

        if (gameData.truckEid !== eid) {
          return;
        }

        //------------------------------------
        // Reset movement state
        //------------------------------------

        gameData.truckSpeed = 0;

        gameData.truckHeading = 0;

        //------------------------------------
        // Capture initial rotation
        //
        // This keeps AR placement orientation
        //------------------------------------

        const rotation = world.transform.getWorldQuaternion(eid);

        console.log("[TruckController] Initial rotation", rotation);
      });
  },
});
