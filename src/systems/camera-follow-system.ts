import * as ecs from "@8thwall/ecs";

import { gameData } from "../core/game-data";
import { GameState } from "../core/game-state";

// =====================================================
// VORTELLI-STYLE CAMERA SYSTEM
//
// Features:
// - Smooth lerp behind truck for arcade feel
// - Dynamic height/distance based on speed
// - Anticipatory turning (camera leans into turns)
// - Speed FOV changes for immersion
// - Gentle camera shake at high speeds
// - Arena boundary constraints
// =====================================================

// ----------------------------------------------------
// CAMERA CONFIGURATION
// ----------------------------------------------------

const CAMERA_CONFIG = {
  // Base distance behind truck
  baseDistance: 12,          // Increased for better visibility of larger arena
  
  // Base height above truck
  baseHeight: 6,             // Increased height for better overview
  
  // Look-ahead distance (where camera focuses)
  lookAhead: 3,              // Increased look-ahead
  
  // Smoothing factors (higher = snappier, lower = smoother)
  positionSmooth: 3.0,       // Slightly smoother for larger scale
  rotationSmooth: 5.0,
  
  // Speed-based camera adjustments
  speedHeightMultiplier: 2.0,    // Camera rises more at high speed
  speedDistanceMultiplier: 1.0,  // Camera pulls back more at high speed
  speedFovMultiplier: 1.2,      // More dramatic FOV changes
  
  // Turn anticipation (camera leans into turns)
  turnAnticipation: 0.4,         // More anticipation
  turnLeanAmount: 0.6,          // More lean
  
  // High-speed camera shake
  shakeSpeedThreshold: 0.7,      // Lower threshold for more feedback
  shakeIntensity: 0.1,           // More intense shake
  shakeFrequency: 12,            // Slightly lower frequency
  
  // Arena boundaries
  arenaLimit: 10,               // Increased for larger arena
  
  // FOV settings
  baseFov: 70,                  // Wider base FOV for better visibility
  maxFov: 90,                   // Wider max FOV
  minFov: 60,                   // Higher min FOV
} as const;

// ----------------------------------------------------
// CAMERA STATE
// ----------------------------------------------------

let cameraOffset = { x: 0, y: 0, z: 0 };
let targetFov: number = CAMERA_CONFIG.baseFov;
let shakeTime = 0;

// ----------------------------------------------------
// UTILITY FUNCTIONS
// ----------------------------------------------------

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, t);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Smooth damp for more natural camera movement
function smoothDamp(
  current: number,
  target: number,
  velocity: { value: number },
  smoothTime: number,
  deltaTime: number
): number {
  const omega = 2 / smoothTime;
  const x = omega * deltaTime;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (velocity.value + omega * change) * deltaTime;
  velocity.value = (velocity.value - omega * temp) * exp;
  return target + (change + temp) * exp;
}

// Camera shake calculation
function getCameraShake(speed: number, deltaTime: number): { x: number; y: number; z: number } {
  if (speed < CAMERA_CONFIG.shakeSpeedThreshold) {
    return { x: 0, y: 0, z: 0 };
  }
  
  shakeTime += deltaTime * CAMERA_CONFIG.shakeFrequency;
  const intensity = CAMERA_CONFIG.shakeIntensity * (speed / CAMERA_CONFIG.shakeSpeedThreshold);
  
  return {
    x: Math.sin(shakeTime) * intensity,
    y: Math.cos(shakeTime * 0.7) * intensity,
    z: Math.sin(shakeTime * 1.3) * intensity,
  };
}

// ----------------------------------------------------
// VORTELLI-STYLE CAMERA SYSTEM
// ----------------------------------------------------

ecs.registerComponent({
  name: "camera-follow-system",

  schema: {},

  tick: (world, component) => {
    // ==================================================
    // GAME STATE CHECK
    // ==================================================
    
    if (gameData.state !== GameState.DRIVING || gameData.truckEid === null) {
      return;
    }

    // ==================================================
    // GET REFERENCES
    // ==================================================
    
    const camera = world.three.activeCamera;
    const cameraEid = world.camera.getActiveEid();
    
    if (cameraEid === 0n || !camera) {
      console.warn("[CameraFollow] No active camera found");
      return;
    }

    const truckEid = gameData.truckEid;
    const truckPosition = world.transform.getWorldPosition(truckEid);
    const truckRotation = world.transform.getWorldQuaternion(truckEid);
    
    // Debug logging
    if (Math.random() < 0.02) { // Log occasionally to avoid spam
      console.log("[CameraFollow] Truck pos:", truckPosition);
      console.log("[CameraFollow] Camera pos:", camera.position);
      console.log("[CameraFollow] Truck speed:", gameData.truckSpeed);
      console.log("[CameraFollow] Following truck EID:", truckEid);
    }
    
    // Get DriveZone position for arena boundaries
    const zonePosition = gameData.driveZoneEid === null
      ? { x: 0, y: 0, z: 0 }
      : world.transform.getWorldPosition(gameData.driveZoneEid);

    // ==================================================
    // DELTA TIME
    // ==================================================
    
    const delta = Math.min(world.time.delta, 0.05);

    // ==================================================
    // CALCULATE TRUCK HEADING
    // ==================================================
    
    // Extract heading from quaternion (y-axis rotation)
    const heading = Math.atan2(
      2 * (truckRotation.w * truckRotation.y + truckRotation.x * truckRotation.z),
      1 - 2 * (truckRotation.y * truckRotation.y + truckRotation.z * truckRotation.z)
    );

    // ==================================================
    // SPEED-BASED CAMERA ADJUSTMENTS
    // ==================================================
    
    const speed = Math.abs(gameData.truckSpeed);
    const speedRatio = Math.min(speed / 1.5, 1); // Normalize to 0-1 range
    
    // Dynamic height: Camera rises at high speeds for better view
    const dynamicHeight = CAMERA_CONFIG.baseHeight + 
      (speedRatio * CAMERA_CONFIG.speedHeightMultiplier);
    
    // Dynamic distance: Camera pulls back at high speeds
    const dynamicDistance = CAMERA_CONFIG.baseDistance + 
      (speedRatio * CAMERA_CONFIG.speedDistanceMultiplier);
    
    // Dynamic FOV: Wider FOV at high speeds for sense of speed
    targetFov = lerp(
      CAMERA_CONFIG.baseFov,
      CAMERA_CONFIG.maxFov,
      speedRatio * CAMERA_CONFIG.speedFovMultiplier
    );
    
    // Smooth FOV transition
    camera.fov = lerp(camera.fov, targetFov, 2.0 * delta);
    camera.updateProjectionMatrix();

    // ==================================================
    // TURN ANTICIPATION (VORTELLI-STYLE)
    // ==================================================
    
    // Calculate steering influence
    const steeringInfluence = gameData.steeringValue * CAMERA_CONFIG.turnAnticipation;
    
    // Camera leans into turns for arcade feel
    const turnLean = steeringInfluence * CAMERA_CONFIG.turnLeanAmount;
    
    // ==================================================
    // CALCULATE IDEAL CAMERA POSITION
    // ==================================================
    
    const sinHeading = Math.sin(heading);
    const cosHeading = Math.cos(heading);
    
    // Base position behind truck
    let targetX = truckPosition.x - sinHeading * dynamicDistance;
    let targetZ = truckPosition.z - cosHeading * dynamicDistance;
    let targetY = truckPosition.y + dynamicHeight;
    
    // Add turn lean (camera shifts sideways in turns)
    targetX += cosHeading * turnLean;
    targetZ -= sinHeading * turnLean;
    
    // ==================================================
    // ARENA BOUNDARY CONSTRAINTS
    // ==================================================
    
    targetX = clamp(
      zonePosition.x - CAMERA_CONFIG.arenaLimit,
      zonePosition.x + CAMERA_CONFIG.arenaLimit,
      targetX
    );
    
    targetZ = clamp(
      zonePosition.z - CAMERA_CONFIG.arenaLimit,
      zonePosition.z + CAMERA_CONFIG.arenaLimit,
      targetZ
    );

    // ==================================================
    // CAMERA SHAKE (HIGH SPEED)
    // ==================================================
    
    const shake = getCameraShake(speed, delta);
    targetX += shake.x;
    targetY += shake.y;
    targetZ += shake.z;

    // ==================================================
    // SMOOTH CAMERA MOVEMENT (VORTELLI-STYLE LERP)
    // ==================================================
    
    // Position smoothing with velocity dampening
    const positionBlend = Math.min(1, CAMERA_CONFIG.positionSmooth * delta);
    
    camera.position.x += (targetX - camera.position.x) * positionBlend;
    camera.position.y += (targetY - camera.position.y) * positionBlend;
    camera.position.z += (targetZ - camera.position.z) * positionBlend;
    
    // ==================================================
    // LOOK-AHEAD POINT (VORTELLI-STYLE ANTICIPATION)
    // ==================================================
    
    // Camera looks ahead of truck for better anticipation
    const lookAheadX = truckPosition.x + sinHeading * CAMERA_CONFIG.lookAhead;
    const lookAheadZ = truckPosition.z + cosHeading * CAMERA_CONFIG.lookAhead;
    
    // Add slight upward look angle for more dramatic view
    const lookAheadY = truckPosition.y + 0.5;

    // ==================================================
    // ROTATION SMOOTHING
    // ==================================================
    
    // Direct look-at for immediate response (arcade feel)
    camera.lookAt(lookAheadX, lookAheadY, lookAheadZ);

    // ==================================================
    // ADDITIONAL VORTELLI EFFECTS
    // ==================================================
    
    // Subtle camera roll based on steering (banking into turns)
    const targetRoll = -gameData.steeringValue * 0.15; // Subtle roll
    const currentRoll = camera.rotation.z;
    camera.rotation.z = lerp(currentRoll, targetRoll, 3.0 * delta);
  },
});

// ----------------------------------------------------
// EXPORT CAMERA CONFIG FOR TUNING
// ----------------------------------------------------

export { CAMERA_CONFIG };
