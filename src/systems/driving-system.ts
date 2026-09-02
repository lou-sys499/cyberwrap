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
// - Arcade-style truck acceleration & progressive braking
// - Forward & reverse movement with dedicated dynamics
// - Frame-rate independent exponential damping
// - Decomposed longitudinal & lateral velocity handling
// - Speed-sensitive progressive steering authority
// - High-speed stability & anti-spinout damping
// - Natural rolling slowdown & lateral grip decay
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
    // VEHICLE ARCADE DEFAULTS (PHASE 15B RETUNED)
    // ------------------------------------------------
    acceleration: 4.0,
    maxSpeed: 8.5,
    reverseSpeed: 4.5,
    friction: 2.0,
    steeringSpeed: 1.7,
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

    const delta = Math.min(world.time.delta || 0.016, 0.05);

    // ==================================================
    // COMPONENT SETTINGS (Authoritative from .expanse.json / schema)
    // ==================================================

    const acceleration = component.schema.acceleration || 4.0;
    const maxSpeed = component.schema.maxSpeed || 8.5;
    const reverseSpeed = component.schema.reverseSpeed || 4.5;
    const friction = component.schema.friction || 2.0;
    const steeringSpeed = component.schema.steeringSpeed || 1.7;

    // ==================================================
    // STEERING INPUT NORMALIZATION
    // ==================================================

    let targetSteering = -gameData.input.steering;

    // Deadzone prevents joystick jitter
    const STEERING_DEADZONE = 0.05;

    if (Math.abs(targetSteering) < STEERING_DEADZONE) {
      targetSteering = 0;
    } else {
      const sign = Math.sign(targetSteering);
      const magnitude =
        (Math.abs(targetSteering) - STEERING_DEADZONE) /
        (1.0 - STEERING_DEADZONE);
      targetSteering = sign * Math.min(1.0, magnitude);
    }

    // ==================================================
    // FRAME-RATE INDEPENDENT STEERING RESPONSE
    // ==================================================
    //
    // Uses exact exponential damping: 1 - exp(-k * dt)
    // Ensures identical steering rate at 30, 60, and 120 FPS.
    //
    // ==================================================

    const STEERING_RESPONSE_RATE = 10.0; // 1/s
    const steerAlpha = 1.0 - Math.exp(-STEERING_RESPONSE_RATE * delta);

    gameData.steeringValue += (targetSteering - gameData.steeringValue) * steerAlpha;

    if (Math.abs(gameData.steeringValue) < 0.001) {
      gameData.steeringValue = 0;
    }

    // ==================================================
    // THROTTLE & LONGITUDINAL FORCES
    // ==================================================

    const throttle = gameData.input.throttle;
    const ACTIVE_BRAKE_DECEL = 14.0; // m/s^2 for active braking

    if (throttle > 0.01) {
      // ------------------------------------------------
      // FORWARD THROTTLE
      // ------------------------------------------------
      if (gameData.truckSpeed < -0.1) {
        // Active brake when moving backward
        gameData.truckSpeed += ACTIVE_BRAKE_DECEL * delta;
      } else {
        // Progressive forward acceleration with top-end power taper
        const speedRatio = Math.max(0, gameData.truckSpeed / maxSpeed);
        const accelFactor = Math.max(0.45, 1.0 - 0.55 * speedRatio * speedRatio);
        gameData.truckSpeed += acceleration * accelFactor * throttle * delta;
      }
    } else if (throttle < -0.01) {
      // ------------------------------------------------
      // REVERSE THROTTLE
      // ------------------------------------------------
      if (gameData.truckSpeed > 0.1) {
        // Active brake when moving forward
        gameData.truckSpeed -= ACTIVE_BRAKE_DECEL * delta;
      } else {
        // Controlled reverse acceleration
        const revThrottle = Math.abs(throttle);
        gameData.truckSpeed -= acceleration * 0.65 * revThrottle * delta;
      }
    } else {
      // ------------------------------------------------
      // FRAME-RATE INDEPENDENT ROLLING COASTING DECAY
      // ------------------------------------------------
      gameData.truckSpeed *= Math.exp(-friction * delta);
      if (Math.abs(gameData.truckSpeed) < 0.02) {
        gameData.truckSpeed = 0;
      }
    }

    // ==================================================
    // SPEED CLAMP
    // ==================================================

    gameData.truckSpeed = Math.max(
      -reverseSpeed,
      Math.min(maxSpeed, gameData.truckSpeed)
    );

    // ==================================================
    // SPEED-SENSITIVE STEERING & TURNING MODEL
    // ==================================================
    //
    // 1. Zero in-place rotation at rest (< 0.25 m/s)
    // 2. High agile maneuverability at low/medium speeds (1 - 5 m/s)
    // 3. High-speed stability damping (> 5 m/s) prevents spinouts
    //
    // ==================================================

    const absSpeed = Math.abs(gameData.truckSpeed);
    const MIN_STEER_SPEED = 0.25;

    if (absSpeed > MIN_STEER_SPEED) {
      // Low-speed authority ramp (reaches 100% by 2.0 m/s)
      const lowSpeedFactor = Math.min(1.0, (absSpeed - MIN_STEER_SPEED) / 1.75);

      // High-speed stability taper (widens turning radius at speed)
      const highSpeedTaper = 1.0 / (1.0 + 0.025 * Math.max(0, absSpeed - 4.5) ** 2);

      const steeringMagnitude = Math.abs(gameData.steeringValue);
      const curvedSteering =
        Math.sign(gameData.steeringValue) * Math.pow(steeringMagnitude, 1.25);

      const direction = gameData.truckSpeed < 0 ? -1 : 1;

      const yawRate =
        curvedSteering *
        steeringSpeed *
        lowSpeedFactor *
        highSpeedTaper *
        direction;

      gameData.truckHeading += yawRate * delta;

      // Normalize heading to [-PI, PI]
      while (gameData.truckHeading > Math.PI) gameData.truckHeading -= Math.PI * 2;
      while (gameData.truckHeading < -Math.PI) gameData.truckHeading += Math.PI * 2;

      // Induce dynamic lateral slip proportional to cornering force
      const SLIP_FACTOR = 0.20;
      const lateralImpulse = -yawRate * gameData.truckSpeed * SLIP_FACTOR * delta;
      gameData.truckLateralVelocity = (gameData.truckLateralVelocity || 0) + lateralImpulse;
    }

    // ==================================================
    // LATERAL GRIP DECAY
    // ==================================================
    //
    // Exponential damping of sideways velocity
    //
    // ==================================================

    const LATERAL_GRIP = 8.5; // 1/s
    gameData.truckLateralVelocity =
      (gameData.truckLateralVelocity || 0) * Math.exp(-LATERAL_GRIP * delta);

    if (Math.abs(gameData.truckLateralVelocity) < 0.005) {
      gameData.truckLateralVelocity = 0;
    }

    // ==================================================
    // APPLY TRUCK ROTATION
    // ==================================================
    //
    // The truck model has a +90° visual orientation
    // relative to the logical heading.
    //
    // ==================================================

    const visualOffset = Math.PI / 2;

    world.transform.setWorldQuaternion(
      eid,
      ecs.math.quat.yRadians(gameData.truckHeading + visualOffset)
    );

    // ==================================================
    // MOVE TRUCK (DECOMPOSED VELOCITY INTEGRATION)
    // ==================================================

    const forwardX = -Math.sin(gameData.truckHeading);
    const forwardZ = -Math.cos(gameData.truckHeading);

    const rightX = Math.cos(gameData.truckHeading);
    const rightZ = -Math.sin(gameData.truckHeading);

    // Decomposed world velocity
    const vx =
      forwardX * gameData.truckSpeed + rightX * gameData.truckLateralVelocity;
    const vz =
      forwardZ * gameData.truckSpeed + rightZ * gameData.truckLateralVelocity;

    const totalHorizSpeed = Math.hypot(vx, vz);

    if (totalHorizSpeed > 0.001) {
      const currentPos = world.transform.getWorldPosition(eid);

      const moveX = vx * delta;
      const moveZ = vz * delta;

      const proposedX = currentPos.x + moveX;
      const proposedZ = currentPos.z + moveZ;

      // City collision detection & resolution
      const collisionResult = resolveCityCollision(
        proposedX,
        proposedZ,
        TRUCK_COLLISION_RADIUS
      );

      if (collisionResult.collided) {
        gameData.truckSpeed *= 0.5;
        gameData.truckLateralVelocity = 0;
      }

      const finalY = getCitySurfaceElevation(
        collisionResult.x,
        collisionResult.z
      );

      world.transform.setWorldPosition(eid, {
        x: collisionResult.x,
        y: finalY,
        z: collisionResult.z,
      });
    }
  },
});