import * as ecs from "@8thwall/ecs";

import { gameData } from "../core/game-data";
import { GameState } from "../core/game-state";
import {
  CITY_BOUNDS,
  getCitySurfaceElevation,
  resolveCityCollision,
  TRUCK_COLLISION_RADIUS,
} from "../world/city-config";

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
    // ACCELERATION (Vortelli-style Fast Arcade Response)
    // ------------------------------------------------

    acceleration: 14.0,

    // ------------------------------------------------
    // FORWARD SPEED (Brisk City Navigation)
    // ------------------------------------------------

    maxSpeed: 8.0,

    // ------------------------------------------------
    // REVERSE SPEED (Responsive 3-Point Maneuvers)
    // ------------------------------------------------

    reverseSpeed: 3.5,

    // ------------------------------------------------
    // NATURAL SLOWDOWN (Prevents Excessive Coasting)
    // ------------------------------------------------

    friction: 5.5,

    // ------------------------------------------------
    // STEERING RESPONSE (Sharp, Immediate Cornering)
    // ------------------------------------------------

    steeringSpeed: 5.2,
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
    // COMPONENT SETTINGS (Arcade Tuning)
    // ==================================================

    const acceleration = component.schema.acceleration || 14.0;
    const maxSpeed = component.schema.maxSpeed || 8.0;
    const reverseSpeed = component.schema.reverseSpeed || 3.5;
    const friction = component.schema.friction || 5.5;
    const steeringSpeed = component.schema.steeringSpeed || 5.2;

    // ==================================================
    // STEERING INPUT (Instant, Crisp Arcade Feedback)
    // ==================================================

    const targetSteering = -gameData.input.steering;

    const steeringResponse = Math.min(1, 24 * delta);

    gameData.steeringValue +=
      (targetSteering - gameData.steeringValue) * steeringResponse;

    // ==================================================
    // THROTTLE INPUT & ACTIVE BRAKING RESPONSE
    // ==================================================

    const throttle = gameData.input.throttle;

    if (throttle > 0.01) {
      if (gameData.truckSpeed < -0.1) {
        // Active forward braking while moving backwards
        gameData.truckSpeed += acceleration * 1.5 * delta;
      } else {
        // Forward acceleration
        gameData.truckSpeed += acceleration * delta;
      }
    } else if (throttle < -0.01) {
      if (gameData.truckSpeed > 0.1) {
        // Active reverse braking while moving forward (Instant stopping power)
        gameData.truckSpeed -= acceleration * 1.8 * delta;
      } else {
        // Reverse acceleration
        gameData.truckSpeed -= acceleration * 0.8 * delta;
      }
    } else {
      // Natural rolling slowdown
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
    // STEERING (Sharp, Immediate Cornering & Low-Speed Authority)
    // ==================================================

    const absSpeed = Math.abs(gameData.truckSpeed);

    if (Math.abs(gameData.steeringValue) > 0.01) {
      // Allow turning authority even at low speeds for agile 3-point turns
      const speedFactor = Math.max(0.35, Math.min(absSpeed / 2.5, 1.0));

      // Reverse direction handling: preserves vehicle physical orientation
      const direction = gameData.truckSpeed < 0 ? -1 : 1;

      gameData.truckHeading +=
        gameData.steeringValue *
        steeringSpeed *
        direction *
        speedFactor *
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
    // MOVE TRUCK (Movement Pipeline)
    // ==================================================

    if (Math.abs(gameData.truckSpeed) > 0.001) {
      // ------------------------------------------------
      // 1. Calculate forward direction from heading.
      // Front (+X) rotated by (heading + PI/2) points
      // along (-sin(heading), -cos(heading)).
      // ------------------------------------------------
      const forwardX = -Math.sin(gameData.truckHeading);
      const forwardZ = -Math.cos(gameData.truckHeading);

      // ------------------------------------------------
      // 2. Proposed Position in World Space
      // ------------------------------------------------
      const currentPos = world.transform.getWorldPosition(eid);
      const moveX = forwardX * gameData.truckSpeed * delta;
      const moveZ = forwardZ * gameData.truckSpeed * delta;

      const proposedX = currentPos.x + moveX;
      const proposedZ = currentPos.z + moveZ;

      // ------------------------------------------------
      // 3. 2D Footprint Collision Test & Wall Slide Resolution
      // ------------------------------------------------
      const collisionResult = resolveCityCollision(
        proposedX,
        proposedZ,
        TRUCK_COLLISION_RADIUS
      );

      if (collisionResult.collided) {
        // Dampen velocity smoothly upon hitting obstacles or boundaries
        gameData.truckSpeed *= 0.8;
      }

      // ------------------------------------------------
      // 4. Continuous Surface Elevation (after collision resolution)
      // ------------------------------------------------
      const finalY = getCitySurfaceElevation(
        collisionResult.x,
        collisionResult.z
      );

      // ------------------------------------------------
      // 5. Apply Authoritative World Position
      // ------------------------------------------------
      world.transform.setWorldPosition(eid, {
        x: collisionResult.x,
        y: finalY,
        z: collisionResult.z,
      });
    }
    
    // ==================================================
    // CAMERA FOLLOW
    // ==================================================
    // Camera logic moved to camera-follow-system.ts
    // for Vortelli-style arcade driving experience
  },
});
