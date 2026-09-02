import * as ecs from "@8thwall/ecs";

import { gameData } from "../core/game-data";
import { GameState } from "../core/game-state";
import {
  getCitySurfaceElevation,
  resolveCityCollision,
  TRUCK_COLLISION_RADIUS,
} from "../world/city-config";

// --------------------------------------------------
// CyberWrap Arcade Driving System
//
// Responsibilities:
// - Arcade-style truck acceleration & braking
// - Forward & reverse movement
// - Progressive speed-dependent steering
// - No stationary spinning
// - Smooth steering response
// - Natural rolling slowdown
// - City collision detection & resolution
// - Continuous terrain elevation
// - Movement restricted to DRIVING state
//
// Input:
//
// steering:
//   -1 = left
//    0 = centered
//   +1 = right
//
// throttle:
//   +1 = forward
//    0 = idle
//   -1 = reverse
//
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
    // VEHICLE RESPONSE
    // ------------------------------------------------

    acceleration: 10.0,

    maxSpeed: 7.0,

    reverseSpeed: 3.0,

    friction: 6.5,

    // Deliberately reduced from 3.8.
    steeringSpeed: 2.8,
  },

  tick: (world, component) => {
    const eid = component.eid;

    // ==================================================
    // GAME STATE
    // ==================================================

    if (gameData.state !== GameState.DRIVING) {
      return;
    }

    // Only the active truck may drive.
    if (gameData.truckEid !== eid) {
      return;
    }

    // ==================================================
    // DELTA TIME
    // ==================================================

    const delta =
      Math.min(
        world.time.delta || 0.016,
        0.05,
      );

    // ==================================================
    // COMPONENT SETTINGS
    // ==================================================

    const acceleration =
      component.schema.acceleration || 10.0;

    const maxSpeed =
      component.schema.maxSpeed || 7.0;

    const reverseSpeed =
      component.schema.reverseSpeed || 3.0;

    const friction =
      component.schema.friction || 6.5;

    const steeringSpeed =
      component.schema.steeringSpeed || 2.8;

    // ==================================================
    // STEERING INPUT
    // ==================================================

    let targetSteering =
      -gameData.input.steering;

    // Small deadzone prevents tiny joystick noise.
    const STEERING_DEADZONE = 0.05;

    if (
      Math.abs(targetSteering) <
      STEERING_DEADZONE
    ) {
      targetSteering = 0;
    } else {
      const sign =
        Math.sign(targetSteering);

      const magnitude =
        (
          Math.abs(targetSteering) -
          STEERING_DEADZONE
        ) /
        (1.0 - STEERING_DEADZONE);

      targetSteering =
        sign *
        Math.min(
          1.0,
          magnitude,
        );
    }

    // ==================================================
    // STEERING RESPONSE
    // ==================================================
    //
    // Slower than the previous 8/s response.
    //
    // This prevents the truck from snapping immediately
    // toward full steering when the joystick is moved.
    //
    // ==================================================

    const STEERING_RESPONSE = 6.5;

    const steeringResponse =
      Math.min(
        1.0,
        STEERING_RESPONSE *
          delta,
      );

    gameData.steeringValue +=
      (
        targetSteering -
        gameData.steeringValue
      ) *
      steeringResponse;

    if (
      Math.abs(
        gameData.steeringValue,
      ) < 0.001
    ) {
      gameData.steeringValue = 0;
    }

    // ==================================================
    // THROTTLE
    // ==================================================

    const throttle =
      gameData.input.throttle;

    // ==================================================
    // FORWARD / REVERSE ACCELERATION
    // ==================================================

    if (throttle > 0.01) {
      // ------------------------------------------------
      // FORWARD
      // ------------------------------------------------

      if (
        gameData.truckSpeed <
        -0.1
      ) {
        // Stronger braking when changing from reverse
        // into forward.
        gameData.truckSpeed +=
          acceleration *
          1.5 *
          delta;
      } else {
        gameData.truckSpeed +=
          acceleration *
          delta;
      }
    } else if (throttle < -0.01) {
      // ------------------------------------------------
      // REVERSE
      // ------------------------------------------------

      if (
        gameData.truckSpeed >
        0.1
      ) {
        // Stronger braking when changing from forward
        // into reverse.
        gameData.truckSpeed -=
          acceleration *
          1.6 *
          delta;
      } else {
        gameData.truckSpeed -=
          acceleration *
          0.8 *
          delta;
      }
    } else {
      // ------------------------------------------------
      // NATURAL ROLLING SLOWDOWN
      // ------------------------------------------------

      const slowdown =
        Math.max(
          0,
          1.0 -
            friction *
              delta,
        );

      gameData.truckSpeed *=
        slowdown;
    }

    // ==================================================
    // SPEED CLAMP
    // ==================================================

    gameData.truckSpeed =
      Math.max(
        -reverseSpeed,
        Math.min(
          maxSpeed,
          gameData.truckSpeed,
        ),
      );

    // ==================================================
    // SPEED-DEPENDENT STEERING
    // ==================================================
    //
    // Important:
    //
    // The truck cannot rotate while stationary.
    //
    // Steering authority gradually increases as the truck
    // gains speed.
    //
    // ==================================================

    const absSpeed =
      Math.abs(
        gameData.truckSpeed,
      );

    const MIN_STEER_SPEED =
      0.35;

    const STEERING_REFERENCE_SPEED =
      5.0;

    if (
      absSpeed >
      MIN_STEER_SPEED
    ) {
      // -----------------------------------------------
      // SPEED AUTHORITY
      // -----------------------------------------------

      const speedRatio =
        (
          absSpeed -
          MIN_STEER_SPEED
        ) /
        (
          STEERING_REFERENCE_SPEED -
          MIN_STEER_SPEED
        );

      const clampedSpeedRatio =
        Math.max(
          0,
          Math.min(
            1,
            speedRatio,
          ),
        );

      // Slightly progressive authority curve.
      const speedFactor =
        Math.pow(
          clampedSpeedRatio,
          0.9,
        );

      // -----------------------------------------------
      // PROGRESSIVE STEERING CURVE
      // -----------------------------------------------
      //
      // Values near center remain gentle.
      // Full steering still reaches full authority.
      //
      // -----------------------------------------------

      const steeringMagnitude =
        Math.abs(
          gameData.steeringValue,
        );

      const curvedSteering =
        Math.sign(
          gameData.steeringValue,
        ) *
        Math.pow(
          steeringMagnitude,
          1.35,
        );

      // -----------------------------------------------
      // REVERSE STEERING
      // -----------------------------------------------

      const direction =
        gameData.truckSpeed < 0
          ? -1
          : 1;

      // -----------------------------------------------
      // FINAL HEADING CHANGE
      // -----------------------------------------------

      const turnAmount =
        curvedSteering *
        steeringSpeed *
        speedFactor *
        direction *
        delta;

      gameData.truckHeading +=
        turnAmount;

      // -----------------------------------------------
      // NORMALIZE HEADING
      // -----------------------------------------------

      while (
        gameData.truckHeading >
        Math.PI
      ) {
        gameData.truckHeading -=
          Math.PI * 2;
      }

      while (
        gameData.truckHeading <
        -Math.PI
      ) {
        gameData.truckHeading +=
          Math.PI * 2;
      }
    }

    // ==================================================
    // APPLY TRUCK ROTATION
    // ==================================================
    //
    // The truck model has a +90° visual orientation
    // relative to the logical heading.
    //
    // ==================================================

    const visualOffset =
      Math.PI / 2;

    world.transform.setWorldQuaternion(
      eid,
      ecs.math.quat.yRadians(
        gameData.truckHeading +
          visualOffset,
      ),
    );

    // ==================================================
    // MOVE TRUCK
    // ==================================================

    if (
      Math.abs(
        gameData.truckSpeed,
      ) > 0.001
    ) {
      // ------------------------------------------------
      // LOGICAL FORWARD VECTOR
      // ------------------------------------------------
      //
      // This is the same heading convention that the
      // chase camera uses.
      //
      // ------------------------------------------------

      const forwardX =
        -Math.sin(
          gameData.truckHeading,
        );

      const forwardZ =
        -Math.cos(
          gameData.truckHeading,
        );

      // ------------------------------------------------
      // CURRENT POSITION
      // ------------------------------------------------

      const currentPos =
        world.transform.getWorldPosition(
          eid,
        );

      // ------------------------------------------------
      // MOVEMENT
      // ------------------------------------------------

      const moveX =
        forwardX *
        gameData.truckSpeed *
        delta;

      const moveZ =
        forwardZ *
        gameData.truckSpeed *
        delta;

      const proposedX =
        currentPos.x +
        moveX;

      const proposedZ =
        currentPos.z +
        moveZ;

      // ------------------------------------------------
      // CITY COLLISION
      // ------------------------------------------------

      const collisionResult =
        resolveCityCollision(
          proposedX,
          proposedZ,
          TRUCK_COLLISION_RADIUS,
        );

      // ------------------------------------------------
      // COLLISION SPEED DAMPING
      // ------------------------------------------------

      if (
        collisionResult.collided
      ) {
        gameData.truckSpeed *=
          0.8;
      }

      // ------------------------------------------------
      // TERRAIN ELEVATION
      // ------------------------------------------------

      const finalY =
        getCitySurfaceElevation(
          collisionResult.x,
          collisionResult.z,
        );

      // ------------------------------------------------
      // AUTHORITATIVE POSITION
      // ------------------------------------------------

      world.transform.setWorldPosition(
        eid,
        {
          x:
            collisionResult.x,

          y:
            finalY,

          z:
            collisionResult.z,
        },
      );
    }
  },
});