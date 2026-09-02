import * as ecs from "@8thwall/ecs";

import { gameData } from "../core/game-data";
import { GameState } from "../core/game-state";
import { recordFakoLifecycleEvent } from "../core/diagnostics";
import { getCitySurfaceElevation } from "../world/city-config";

// ------------------------------------------------------------
// CYBERWRAP: AUTHORITATIVE CHASE / ORBIT CAMERA ENGINE
// ------------------------------------------------------------
//
// Vortelli's Pizza Delivery style arcade chase camera:
// - Direct world-space placement behind the truck based on
//   truck's authoritative world position and heading.
// - Camera heading immediately matches truck heading during driving (no lag).
// - Smooth position following with strict terrain collision avoidance.
// - Strictly NOT parented to the truck (avoids ECS hierarchy bugs).
// - No spherical orbit math during normal driving (prevents lateral swings).
// ------------------------------------------------------------

// ------------------------------------------------------------
// EVENTS & LISTENERS
// ------------------------------------------------------------

export const ENTITY_TELEPORTED_EVENT = "entity-teleported";
export const CAMERA_ORBIT_UPDATE_EVENT = "camera-orbit-update";
export const CAMERA_RESET_EVENT = "camera-reset";

export function notifyEntityTeleported(_entityEid?: ecs.Eid): void {
  resetSmoothOrbitCamera();
}

// ------------------------------------------------------------
// CAMERA TUNING & DEFAULTS
// ------------------------------------------------------------

const DEFAULT_DISTANCE = 6.5;
const DEFAULT_HEIGHT = 2.8;
const LOOK_TARGET_HEIGHT = 1.15;

// Minimum safety distance above Mount Fako Heights surface
const MIN_GROUND_CLEARANCE = 1.0;

// Absolute safety floor
const ABSOLUTE_MIN_CAMERA_Y = 0.5;

// Camera must remain at least this far above the truck
const MIN_CAMERA_HEIGHT_ABOVE_TRUCK = 1.5;

// Exponential smoothing rate for camera position follow
const DEFAULT_FOLLOW_SPEED = 9.0;

// Manual camera limits (when stationary in ORBIT mode)
const MAX_MANUAL_YAW = 0.8;
const MAX_MANUAL_PITCH = 0.35;

// How quickly manual camera offset returns to center
const MANUAL_RECENTER_SPEED = 7.0;

// Isometric mode offsets
const ISO_OFFSET_X = 14.0;
const ISO_OFFSET_Y = 16.0;
const ISO_OFFSET_Z = 14.0;

// ------------------------------------------------------------
// SHARED CAMERA DATA
// ------------------------------------------------------------

export interface CameraData {
  azimuth: number;
  polar: number;
  forwardX: number;
  forwardZ: number;
  rightX: number;
  rightZ: number;
}

export const cameraData: CameraData = {
  azimuth: 0,
  polar: Math.PI / 3.8,
  forwardX: 0,
  forwardZ: -1,
  rightX: 1,
  rightZ: 0,
};

// ------------------------------------------------------------
// INTERNAL RUNTIME STATE
// ------------------------------------------------------------

interface CameraRuntimeState {
  initialized: boolean;

  smoothedX: number;
  smoothedY: number;
  smoothedZ: number;

  manualYawOffset: number;
  manualPitchOffset: number;

  dragging: boolean;
  lastPointerX: number;
  lastPointerY: number;

  keys: {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
  };

  lastTruckX: number;
  lastTruckY: number;
  lastTruckZ: number;

  hasPreviousTruckPosition: boolean;
  lastUpdateFrame: number;
  lastDiagLogTime: number;
}

const runtimeState: CameraRuntimeState = {
  initialized: false,

  smoothedX: 0,
  smoothedY: 0,
  smoothedZ: 0,

  manualYawOffset: 0,
  manualPitchOffset: 0,

  dragging: false,
  lastPointerX: 0,
  lastPointerY: 0,

  keys: {
    left: false,
    right: false,
    up: false,
    down: false,
  },

  lastTruckX: 0,
  lastTruckY: 0,
  lastTruckZ: 0,

  hasPreviousTruckPosition: false,
  lastUpdateFrame: -1,
  lastDiagLogTime: 0,
};

// ------------------------------------------------------------
// MATH HELPERS
// ------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeAngle(angle: number): number {
  while (angle > Math.PI) {
    angle -= Math.PI * 2;
  }
  while (angle < -Math.PI) {
    angle += Math.PI * 2;
  }
  return angle;
}

function smoothFactor(speed: number, delta: number): number {
  return 1 - Math.exp(-Math.max(0, speed) * delta);
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

// ------------------------------------------------------------
// SAFE TERRAIN HEIGHT SAMPLING
// ------------------------------------------------------------

function getSafeSurfaceElevation(
  x: number,
  z: number,
  fallbackY: number
): number {
  try {
    const elevation = getCitySurfaceElevation(x, z);
    if (Number.isFinite(elevation)) {
      return elevation;
    }
  } catch {
    // Safe fallback below
  }
  return fallbackY;
}

// ------------------------------------------------------------
// INPUT LISTENERS SETUP
// ------------------------------------------------------------

let inputListenersInstalled = false;

function installInputListeners(): void {
  if (inputListenersInstalled) {
    return;
  }

  if (typeof window === "undefined") {
    return;
  }

  inputListenersInstalled = true;

  // ----------------------------------------------------------
  // Keyboard: Q/E for yaw, R/F for pitch
  // Arrow keys & WASD are reserved for driving.
  // ----------------------------------------------------------
  window.addEventListener("keydown", (event) => {
    switch (event.code) {
      case "KeyQ":
        runtimeState.keys.left = true;
        break;
      case "KeyE":
        runtimeState.keys.right = true;
        break;
      case "KeyR":
        runtimeState.keys.up = true;
        break;
      case "KeyF":
        runtimeState.keys.down = true;
        break;
      default:
        return;
    }
    event.preventDefault();
  });

  window.addEventListener("keyup", (event) => {
    switch (event.code) {
      case "KeyQ":
        runtimeState.keys.left = false;
        break;
      case "KeyE":
        runtimeState.keys.right = false;
        break;
      case "KeyR":
        runtimeState.keys.up = false;
        break;
      case "KeyF":
        runtimeState.keys.down = false;
        break;
      default:
        return;
    }
    event.preventDefault();
  });

  // ----------------------------------------------------------
  // Pointer / Mouse Drag for stationary inspection
  // ----------------------------------------------------------
  window.addEventListener("pointerdown", (event) => {
    runtimeState.dragging = true;
    runtimeState.lastPointerX = event.clientX;
    runtimeState.lastPointerY = event.clientY;
  });

  window.addEventListener("pointermove", (event) => {
    if (!runtimeState.dragging) {
      return;
    }

    const dx = event.clientX - runtimeState.lastPointerX;
    const dy = event.clientY - runtimeState.lastPointerY;

    runtimeState.lastPointerX = event.clientX;
    runtimeState.lastPointerY = event.clientY;

    // Gentle camera manual offset
    runtimeState.manualYawOffset -= dx * 0.004;
    runtimeState.manualPitchOffset += dy * 0.003;

    runtimeState.manualYawOffset = clamp(
      runtimeState.manualYawOffset,
      -MAX_MANUAL_YAW,
      MAX_MANUAL_YAW
    );

    runtimeState.manualPitchOffset = clamp(
      runtimeState.manualPitchOffset,
      -MAX_MANUAL_PITCH,
      MAX_MANUAL_PITCH
    );
  });

  window.addEventListener("pointerup", () => {
    runtimeState.dragging = false;
  });

  window.addEventListener("pointercancel", () => {
    runtimeState.dragging = false;
  });
}

// ------------------------------------------------------------
// MANUAL CAMERA OFFSET UPDATE
// ------------------------------------------------------------

function updateManualInput(delta: number, allowManualOrbit: boolean): void {
  if (!allowManualOrbit) {
    // While driving or in pure FOLLOW mode, aggressively recenter
    const recenter = smoothFactor(MANUAL_RECENTER_SPEED, delta);
    runtimeState.manualYawOffset += (0 - runtimeState.manualYawOffset) * recenter;
    runtimeState.manualPitchOffset += (0 - runtimeState.manualPitchOffset) * recenter;
    return;
  }

  let yawInput = 0;
  let pitchInput = 0;

  if (runtimeState.keys.left) yawInput -= 1;
  if (runtimeState.keys.right) yawInput += 1;
  if (runtimeState.keys.up) pitchInput -= 1;
  if (runtimeState.keys.down) pitchInput += 1;

  if (yawInput !== 0) {
    runtimeState.manualYawOffset += yawInput * 1.4 * delta;
  }

  if (pitchInput !== 0) {
    runtimeState.manualPitchOffset += pitchInput * 0.9 * delta;
  }

  runtimeState.manualYawOffset = clamp(
    runtimeState.manualYawOffset,
    -MAX_MANUAL_YAW,
    MAX_MANUAL_YAW
  );

  runtimeState.manualPitchOffset = clamp(
    runtimeState.manualPitchOffset,
    -MAX_MANUAL_PITCH,
    MAX_MANUAL_PITCH
  );

  // When user is not providing input, gently decay toward center
  if (!runtimeState.dragging && yawInput === 0 && pitchInput === 0) {
    const recenter = smoothFactor(MANUAL_RECENTER_SPEED, delta);
    runtimeState.manualYawOffset += (0 - runtimeState.manualYawOffset) * recenter;
    runtimeState.manualPitchOffset += (0 - runtimeState.manualPitchOffset) * recenter;
  }
}

// ------------------------------------------------------------
// RESET CAMERA STATE
// ------------------------------------------------------------

export function resetSmoothOrbitCamera(): void {
  runtimeState.initialized = false;

  runtimeState.smoothedX = 0;
  runtimeState.smoothedY = 0;
  runtimeState.smoothedZ = 0;

  runtimeState.manualYawOffset = 0;
  runtimeState.manualPitchOffset = 0;

  runtimeState.dragging = false;

  runtimeState.lastTruckX = 0;
  runtimeState.lastTruckY = 0;
  runtimeState.lastTruckZ = 0;

  runtimeState.hasPreviousTruckPosition = false;

  cameraData.azimuth = 0;
  cameraData.polar = Math.PI / 3.8;

  cameraData.forwardX = 0;
  cameraData.forwardZ = -1;

  cameraData.rightX = 1;
  cameraData.rightZ = 0;
}

// ------------------------------------------------------------
// AUTHORITATIVE CAMERA TRANSFORM UPDATE
// ------------------------------------------------------------

export function updateSmoothOrbitCamera(
  world: ecs.World,
  truckEid?: ecs.Eid,
  mode: "FOLLOW" | "ORBIT" | "ISOMETRIC" | "BOARD" = "FOLLOW",
  forceSnap = false
): void {
  installInputListeners();

  if (!truckEid || truckEid === 0n) {
    return;
  }

  // Deduplicate per-frame updates across potential multi-component ticks
  const currentFrame = (world.time as any)?.frame ?? -1;
  if (currentFrame !== -1 && currentFrame === runtimeState.lastUpdateFrame && !forceSnap) {
    return;
  }
  runtimeState.lastUpdateFrame = currentFrame;

  // ----------------------------------------------------------
  // 1. Read truck world transform
  // ----------------------------------------------------------
  const truckPos = world.transform.getWorldPosition(truckEid);
  const truckX = finiteOr(truckPos.x, 0);
  const truckY = finiteOr(truckPos.y, 0);
  const truckZ = finiteOr(truckPos.z, 0);

  // ----------------------------------------------------------
  // 2. Delta time (capped to prevent explosion on tab switch)
  // ----------------------------------------------------------
  const delta = Math.min(
    Math.max(finiteOr(world.time.delta, 0.016), 0),
    0.05
  );

  // ----------------------------------------------------------
  // 3. Movement status
  // ----------------------------------------------------------
  const truckSpeed = finiteOr(gameData.truckSpeed, 0);
  const isMoving =
    gameData.state === GameState.DRIVING &&
    Math.abs(truckSpeed) > 0.08;

  const allowManualOrbit = mode === "ORBIT" && !isMoving;
  updateManualInput(delta, allowManualOrbit);

  // ----------------------------------------------------------
  // 4. Heading & Target calculations
  // ----------------------------------------------------------
  const truckHeading = finiteOr(gameData.truckHeading, 0);

  let finalCamX = 0;
  let finalCamY = 0;
  let finalCamZ = 0;
  let lookTargetX = truckX;
  let lookTargetY = truckY + LOOK_TARGET_HEIGHT;
  let lookTargetZ = truckZ;

  let cameraHeading = truckHeading;

  if (mode === "ISOMETRIC") {
    // --------------------------------------------------------
    // ISOMETRIC ANGLED OVERVIEW MODE
    // --------------------------------------------------------
    const targetCamX = truckX + ISO_OFFSET_X;
    const targetCamZ = truckZ + ISO_OFFSET_Z;
    const targetCamY = truckY + ISO_OFFSET_Y;
    lookTargetY = truckY + 1.0;

    if (!runtimeState.initialized || forceSnap) {
      runtimeState.smoothedX = targetCamX;
      runtimeState.smoothedY = targetCamY;
      runtimeState.smoothedZ = targetCamZ;
      runtimeState.initialized = true;
    } else {
      const follow = smoothFactor(DEFAULT_FOLLOW_SPEED, delta);
      runtimeState.smoothedX += (targetCamX - runtimeState.smoothedX) * follow;
      runtimeState.smoothedY += (targetCamY - runtimeState.smoothedY) * follow;
      runtimeState.smoothedZ += (targetCamZ - runtimeState.smoothedZ) * follow;
    }

    finalCamX = runtimeState.smoothedX;
    finalCamY = runtimeState.smoothedY;
    finalCamZ = runtimeState.smoothedZ;
  } else if (mode === "ORBIT") {
    // --------------------------------------------------------
    // ORBIT CHASE MODE (Manual orbit inspection when stationary)
    // --------------------------------------------------------
    if (!isMoving) {
      cameraHeading = normalizeAngle(truckHeading + runtimeState.manualYawOffset);
      lookTargetY += runtimeState.manualPitchOffset * 1.5;
    }

    const camForwardX = -Math.sin(cameraHeading);
    const camForwardZ = -Math.cos(cameraHeading);

    let targetCamX = truckX - camForwardX * DEFAULT_DISTANCE;
    let targetCamZ = truckZ - camForwardZ * DEFAULT_DISTANCE;
    let targetCamY = truckY + DEFAULT_HEIGHT;

    const targetTerrainY = getSafeSurfaceElevation(targetCamX, targetCamZ, truckY);
    targetCamY = Math.max(
      targetCamY,
      targetTerrainY + MIN_GROUND_CLEARANCE,
      ABSOLUTE_MIN_CAMERA_Y
    );

    if (!runtimeState.initialized || forceSnap) {
      runtimeState.smoothedX = targetCamX;
      runtimeState.smoothedY = targetCamY;
      runtimeState.smoothedZ = targetCamZ;
      runtimeState.initialized = true;
    } else {
      const follow = smoothFactor(DEFAULT_FOLLOW_SPEED, delta);
      runtimeState.smoothedX += (targetCamX - runtimeState.smoothedX) * follow;
      runtimeState.smoothedY += (targetCamY - runtimeState.smoothedY) * follow;
      runtimeState.smoothedZ += (targetCamZ - runtimeState.smoothedZ) * follow;
    }

    const currentTerrainY = getSafeSurfaceElevation(
      runtimeState.smoothedX,
      runtimeState.smoothedZ,
      truckY
    );
    runtimeState.smoothedY = Math.max(
      runtimeState.smoothedY,
      currentTerrainY + MIN_GROUND_CLEARANCE,
      ABSOLUTE_MIN_CAMERA_Y
    );

    finalCamX = runtimeState.smoothedX;
    finalCamY = runtimeState.smoothedY;
    finalCamZ = runtimeState.smoothedZ;
  } else {
    // --------------------------------------------------------
    // FOLLOW MODE: RIGID VORTELLI-STYLE THIRD-PERSON CHASE CAMERA
    //
    // Fixed relative relationship to truck:
    // - Horizontal distance = 6.5m directly behind truck heading
    // - Base vertical height = truckY + 2.8m (strictly truck-relative)
    // - Direct calculation with zero positional spring / lag
    // - Zero terrain elevation sampling or height clamping
    // --------------------------------------------------------
    cameraHeading = truckHeading;

    const forwardX = -Math.sin(truckHeading);
    const forwardZ = -Math.cos(truckHeading);

    finalCamX = truckX - forwardX * DEFAULT_DISTANCE;
    finalCamZ = truckZ - forwardZ * DEFAULT_DISTANCE;

    // Normal camera height is rigidly anchored to truckY + DEFAULT_HEIGHT (2.8m)
    // NEVER modified by terrain underneath the camera or world X/Z
    finalCamY = truckY + DEFAULT_HEIGHT;

    // Keep internal smoothing state synchronized so mode switches do not jump
    runtimeState.smoothedX = finalCamX;
    runtimeState.smoothedY = finalCamY;
    runtimeState.smoothedZ = finalCamZ;
    runtimeState.initialized = true;
  }

  // ----------------------------------------------------------
  // 8. Apply transforms to ECS Camera and Three.js Camera
  // ----------------------------------------------------------
  const cameraEid = world.camera.getActiveEid();

  if (cameraEid && cameraEid !== 0n) {
    try {
      world.transform.setWorldPosition(cameraEid, {
        x: finalCamX,
        y: finalCamY,
        z: finalCamZ,
      });

      world.transform.lookAtWorld(cameraEid, {
        x: lookTargetX,
        y: lookTargetY,
        z: lookTargetZ,
      });
    } catch {
      // Safe fallback
    }
  }

  const worldAny = world as any;
  const activeCamera = worldAny.three?.activeCamera;

  if (activeCamera) {
    try {
      activeCamera.position.set(
        finalCamX,
        finalCamY,
        finalCamZ
      );

      activeCamera.lookAt(
        lookTargetX,
        lookTargetY,
        lookTargetZ
      );
    } catch {
      // Safe fallback
    }
  }

  // ----------------------------------------------------------
  // 9. Update shared camera data
  // ----------------------------------------------------------
  const activeForwardX = -Math.sin(cameraHeading);
  const activeForwardZ = -Math.cos(cameraHeading);

  cameraData.azimuth = cameraHeading;
  cameraData.polar = Math.PI / 3.8;
  cameraData.forwardX = activeForwardX;
  cameraData.forwardZ = activeForwardZ;
  cameraData.rightX = Math.cos(cameraHeading);
  cameraData.rightZ = -Math.sin(cameraHeading);

  // ----------------------------------------------------------
  // 10. Periodic edge diagnostic check (unobtrusive, max once per 4s)
  // ----------------------------------------------------------
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (
    now - runtimeState.lastDiagLogTime > 4000 &&
    (Math.abs(truckX) > 35 || Math.abs(truckZ) > 35)
  ) {
    runtimeState.lastDiagLogTime = now;
    const hDist = Math.hypot(finalCamX - truckX, finalCamZ - truckZ);
    const vOffset = finalCamY - truckY;
    const threeDDist = Math.hypot(finalCamX - truckX, vOffset, finalCamZ - truckZ);
    console.log(
      `[FakoCamera Edge Diag] mode=${mode} truck=(${truckX.toFixed(1)}, ${truckY.toFixed(1)}, ${truckZ.toFixed(1)}) cam=(${finalCamX.toFixed(1)}, ${finalCamY.toFixed(1)}, ${finalCamZ.toFixed(1)}) hDist=${hDist.toFixed(2)} vOff=${vOffset.toFixed(2)} 3dDist=${threeDDist.toFixed(2)}`
    );
  }

  // ----------------------------------------------------------
  // 11. Cache truck position
  // ----------------------------------------------------------
  runtimeState.lastTruckX = truckX;
  runtimeState.lastTruckY = truckY;
  runtimeState.lastTruckZ = truckZ;
  runtimeState.hasPreviousTruckPosition = true;
}

// ------------------------------------------------------------
// COMPONENT REGISTRATION (For compatibility with .expanse.json)
// ------------------------------------------------------------

ecs.registerComponent({
  name: "smooth-orbit-camera",

  schema: {
    target: ecs.eid,
    distance: ecs.f32,
    height: ecs.f32,
    rotationSpeed: ecs.f32,
    followSpeed: ecs.f32,
    autoOrientSpeed: ecs.f32,
    autoOrientStrength: ecs.f32,
    minVelocityThreshold: ecs.f32,
  },

  schemaDefaults: {
    target: 0n,
    distance: DEFAULT_DISTANCE,
    height: DEFAULT_HEIGHT,
    rotationSpeed: 0.5,
    followSpeed: DEFAULT_FOLLOW_SPEED,
    autoOrientSpeed: 4.0,
    autoOrientStrength: 1.0,
    minVelocityThreshold: 0.05,
  },

  tick: (_world, _component) => {
    // Ticking is driven centrally by camera-follow-system to guarantee
    // single-source authority and avoid duplicate execution.
  },
});
