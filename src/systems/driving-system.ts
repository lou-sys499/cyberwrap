import * as ecs from "@8thwall/ecs";

import { gameData } from "../core/game-data";
import { GameState } from "../core/game-state";

// Camera constants removed - now handled by camera-follow-system.ts
// --------------------------------------------------
// CyberWrap Driving System
//
// Responsibilities:
// - Arcade-style truck acceleration
// - Forward / reverse movement
// - Speed limiting
// - Responsive steering
// - Natural slowdown
// - Movement only while DRIVING
//
// Input:
// steering:
//   -1 = left
//    0 = centered
//   +1 = right
//
// throttle:
//   -1 = gas
//    0 = idle
//   +1 = reverse
// --------------------------------------------------

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
    // ------------------------------------------------
    // ACCELERATION
    // ------------------------------------------------

    acceleration: 2.5,

    // ------------------------------------------------
    // FORWARD SPEED
    // ------------------------------------------------

    maxSpeed: 1.2,

    // ------------------------------------------------
    // REVERSE SPEED
    // ------------------------------------------------

    reverseSpeed: 1.05,

    // ------------------------------------------------
    // NATURAL SLOWDOWN
    // ------------------------------------------------

    friction: 5.0,

    // ------------------------------------------------
    // STEERING RESPONSE
    // ------------------------------------------------

    steeringSpeed: 2.8,
  },

  tick: (world, component) => {
    const eid = component.eid;

    // ==================================================
    // GAME STATE
    // ==================================================
    //
    // The truck must not move during:
    //
    // SCANNING
    // PLACING
    // COUNTDOWN
    // GAMEOVER
    //
    // Only DRIVING allows movement.
    // ==================================================

    if (gameData.state !== GameState.DRIVING) {
      return;
    }

    // --------------------------------------------------
    // Make sure this is the active truck.
    // --------------------------------------------------

    if (gameData.truckEid !== eid) {
      return;
    }

    // ==================================================
    // DELTA TIME
    // ==================================================

    const delta = Math.min(world.time.delta, 0.05);

    // ==================================================
    // COMPONENT SETTINGS
    // ==================================================

    const { acceleration, maxSpeed, reverseSpeed, friction, steeringSpeed } =
      component.schema;

    // ==================================================
    // STEERING INPUT
    // ==================================================

    const targetSteering = -gameData.input.steering;

    // --------------------------------------------------
    // Smooth steering input.
    //
    // This keeps the steering responsive without making
    // the truck instantly snap from left to right.
    // --------------------------------------------------

    const steeringResponse = Math.min(1, 12 * delta);

    gameData.steeringValue +=
      (targetSteering - gameData.steeringValue) * steeringResponse;

    // ==================================================
    // THROTTLE INPUT
    // ==================================================

    const throttle = gameData.input.throttle;

    // ==================================================
    // ACCELERATION
    // ==================================================

    if (throttle < -0.01) {
      // ------------------------------------------------
      // GAS (negative throttle = forward)
      // ------------------------------------------------

      gameData.truckSpeed += acceleration * delta;
    } else if (throttle > 0.01) {
      // ------------------------------------------------
      // REVERSE (positive throttle = reverse)
      //
      // Reverse acceleration is deliberately weaker
      // than forward acceleration.
      // ------------------------------------------------

      gameData.truckSpeed -= acceleration * 0.75 * delta;
    } else {
      // ------------------------------------------------
      // IDLE
      //
      // Apply arcade-style natural slowdown.
      // ------------------------------------------------

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
    // STEERING
    // ==================================================

    if (Math.abs(gameData.steeringValue) > 0.01) {
      // ------------------------------------------------
      // Speed-dependent steering
      //
      // A truck should not rotate aggressively when
      // completely stopped.
      // ------------------------------------------------

      const speedRatio = Math.min(Math.abs(gameData.truckSpeed) / maxSpeed, 1);

      // Minimum steering authority.
      //
      // This prevents steering from feeling completely
      // dead at low speed while still making high-speed
      // steering feel more natural.
      const steeringStrength = 0.25 + speedRatio * 0.75;

      // ------------------------------------------------
      // Reverse steering
      //
      // Steering direction naturally reverses while
      // backing up, giving a more familiar vehicle feel.
      // ------------------------------------------------

      const direction = gameData.truckSpeed < -0.01 ? -1 : 1;

      gameData.truckHeading +=
        gameData.steeringValue *
        steeringSpeed *
        steeringStrength *
        direction *
        delta;
    }

    // ==================================================
    // APPLY ROTATION
    // ==================================================

    // --------------------------------------------------
    // Model orientation correction.
    //
    // The truck model's visual forward direction is
    // offset by 90 degrees from our movement heading.
    // --------------------------------------------------

    const visualOffset = Math.PI / 2;

    world.transform.setWorldQuaternion(
      eid,
      ecs.math.quat.yRadians(gameData.truckHeading + visualOffset),
    );

    // ==================================================
    // MOVE TRUCK
    // ==================================================

    if (Math.abs(gameData.truckSpeed) > 0.001) {
      // ------------------------------------------------
      // Calculate forward direction from heading.
      // ------------------------------------------------

      const forwardX = Math.sin(gameData.truckHeading);

      const forwardZ = Math.cos(gameData.truckHeading);

      // ------------------------------------------------
      // Move in world space.
      // ------------------------------------------------

      world.transform.translateWorld(eid, {
        x: forwardX * gameData.truckSpeed * delta,

        y: 0,

        z: forwardZ * gameData.truckSpeed * delta,
      });
    }
    
    // ==================================================
    // CAMERA FOLLOW
    // ==================================================
    // Camera logic moved to camera-follow-system.ts
    // for Vortelli-style arcade driving experience
  },
});
