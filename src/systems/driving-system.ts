import * as ecs from "@8thwall/ecs";

import { gameData } from "../core/game-data";
import { GameState } from "../core/game-state";
import { trackEvent } from "../core/analytics";

trackEvent("game_started");

ecs.registerComponent({
  name: "driving",

  schema: {
    acceleration: ecs.f32,
    maxSpeed: ecs.f32,
    reverseSpeed: ecs.f32,
    friction: ecs.f32,
    steeringSpeed: ecs.f32,
  },

  schemaDefaults: {
    // Acceleration response
    acceleration: 2.5,

    // Maximum forward speed
    maxSpeed: 1.2,

    // Maximum reverse speed
    reverseSpeed: 0.65,

    // Natural slowdown
    friction: 5.0,

    // Steering response
    steeringSpeed: 2.8,
  },

  tick: (world, component) => {
    const eid = component.eid;

    // ==================================================
    // GAME STATE
    // ==================================================

    if (gameData.state !== GameState.DRIVING) return;

    if (gameData.truckEid !== eid) return;

    const delta = Math.min(world.time.delta, 0.05);

    const { acceleration, maxSpeed, reverseSpeed, friction, steeringSpeed } =
      component.schema;

    // ==================================================
    // STEERING INPUT
    // ==================================================

    const targetSteering = gameData.input.steering;

    // Faster response than the previous 0.2 smoothing.
    gameData.steeringValue +=
      (targetSteering - gameData.steeringValue) * Math.min(1, 12 * delta);

    // ==================================================
    // STEERING
    // ==================================================

    if (Math.abs(gameData.steeringValue) > 0.01) {
      gameData.truckHeading += gameData.steeringValue * steeringSpeed * delta;
    }

    // ==================================================
    // THROTTLE
    // ==================================================

    const throttle = gameData.input.throttle;

    if (throttle < -0.01) {
      // ----------------------------------------------
      // GAS
      // ----------------------------------------------

      gameData.truckSpeed += acceleration * delta;
    } else if (throttle > 0.01) {
      // ----------------------------------------------
      // REVERSE
      // ----------------------------------------------

      gameData.truckSpeed -= acceleration * 0.75 * delta;
    } else {
      // ----------------------------------------------
      // NATURAL SLOWDOWN
      // ----------------------------------------------

      const slowdown = Math.max(0, 1 - friction * delta);

      gameData.truckSpeed *= slowdown;
    }

    // ==================================================
    // SPEED LIMIT
    // ==================================================

    gameData.truckSpeed = Math.max(
      -reverseSpeed,
      Math.min(maxSpeed, gameData.truckSpeed),
    );

    // ==================================================
    // APPLY ROTATION
    // ==================================================

    const visualOffset = Math.PI / 2;

    world.transform.setWorldQuaternion(
      eid,
      ecs.math.quat.yRadians(gameData.truckHeading + visualOffset),
    );

    // ==================================================
    // MOVE TRUCK
    // ==================================================

    if (Math.abs(gameData.truckSpeed) > 0.001) {
      const forwardX = Math.sin(gameData.truckHeading);

      const forwardZ = Math.cos(gameData.truckHeading);

      world.transform.translateWorld(eid, {
        x: forwardX * gameData.truckSpeed * delta,

        y: 0,

        z: forwardZ * gameData.truckSpeed * delta,
      });
    }
  },
});
