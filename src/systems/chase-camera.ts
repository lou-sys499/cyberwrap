import * as ecs from "@8thwall/ecs";
import { gameData } from "../core/game-data";

// =============================================================
// CYBERWRAP: AUTHORITATIVE 3D CHASE CAMERA SYSTEM
// =============================================================
//
// Rigid third-person 3D PerspectiveCamera following the delivery truck.
// - Fixed chase parameters: Distance 6.5m, Height 2.8m, Look Height 1.15m, FOV 80°.
// - Camera world position & upright orientation derived purely from truck transform & heading.
// - Solves ECS-to-Three.js orientation synchronization (Three.js camera expects -Z forward, +Y up).
// - Zero smoothing, zero terrain sampling, zero velocity offsets, zero roll.
// =============================================================

export const CAMERA_DISTANCE = 6.5;
export const CAMERA_HEIGHT = 2.8;
export const CAMERA_LOOK_HEIGHT = 1.15;
export const CAMERA_TARGET_FOV = 80;

export interface CameraDiagnosticData {
  truckX: number;
  truckY: number;
  truckZ: number;
  truckHeading: number;
  cameraX: number;
  cameraY: number;
  cameraZ: number;
  horizontalDistance: number;
  verticalOffset: number;
  fov: number;
  activeCameraEid: string;
  isMatched: boolean;
  ecsQuat: { x: number; y: number; z: number; w: number };
  threeUp: { x: number; y: number; z: number };
  threeQuat: { x: number; y: number; z: number; w: number };
}

export let latestCameraDiagnostics: CameraDiagnosticData = {
  truckX: 0,
  truckY: 0,
  truckZ: 0,
  truckHeading: 0,
  cameraX: 0,
  cameraY: 0,
  cameraZ: 0,
  horizontalDistance: 0,
  verticalOffset: 0,
  fov: 80,
  activeCameraEid: "none",
  isMatched: false,
  ecsQuat: { x: 0, y: 0, z: 0, w: 1 },
  threeUp: { x: 0, y: 1, z: 0 },
  threeQuat: { x: 0, y: 0, z: 0, w: 1 },
};

// Camera lean angle for subtle dynamic cornering feedback
let currentCamLean = 0;

// Diagnostic DOM overlay (disabled in production gameplay)
let diagOverlay: HTMLDivElement | null = null;

function updateDiagnosticOverlay(diag: CameraDiagnosticData): void {
  // Production mode: ensure any stale diagnostic overlay is cleaned up
  if (diagOverlay) {
    diagOverlay.remove();
    diagOverlay = null;
  }
}

// -------------------------------------------------------------
// EXACT THREE.JS CAMERA LOOK-AT QUATERNION CALCULATOR
// -------------------------------------------------------------
// In Three.js, a camera looks along its local -Z axis with +Y up and +X right.
// This calculates the exact world quaternion for the camera entity so that
// the rendered view points directly at the lookTarget with camera.up = (0, 1, 0)
// and zero roll / inversion.
export function computeCameraLookAtQuaternion(
  eye: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
  up: { x: number; y: number; z: number } = { x: 0, y: 1, z: 0 }
): { x: number; y: number; z: number; w: number } {
  // z = eye - target (normalized vector from target to eye = camera +Z axis)
  let zx = eye.x - target.x;
  let zy = eye.y - target.y;
  let zz = eye.z - target.z;
  const zLen = Math.hypot(zx, zy, zz);
  if (zLen > 1e-6) {
    zx /= zLen;
    zy /= zLen;
    zz /= zLen;
  } else {
    zz = 1;
  }

  // x = up cross z (normalized camera +X right axis)
  let xx = up.y * zz - up.z * zy;
  let xy = up.z * zx - up.x * zz;
  let xz = up.x * zy - up.y * zx;
  const xLen = Math.hypot(xx, xy, xz);
  if (xLen > 1e-6) {
    xx /= xLen;
    xy /= xLen;
    xz /= xLen;
  } else {
    xx = 1;
    xy = 0;
    xz = 0;
  }

  // y = z cross x (camera +Y up axis)
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;

  // Rotation matrix m:
  // [ m00(xx), m01(yx), m02(zx) ]
  // [ m10(xy), m11(yy), m12(zy) ]
  // [ m20(xz), m21(yz), m22(zz) ]
  const m00 = xx;
  const m01 = yx;
  const m02 = zx;
  const m10 = xy;
  const m11 = yy;
  const m12 = zy;
  const m20 = xz;
  const m21 = yz;
  const m22 = zz;

  // Convert rotation matrix to quaternion (x, y, z, w)
  const trace = m00 + m11 + m22;
  let qx: number;
  let qy: number;
  let qz: number;
  let qw: number;

  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1.0);
    qw = 0.25 / s;
    qx = (m21 - m12) * s;
    qy = (m02 - m20) * s;
    qz = (m10 - m01) * s;
  } else if (m00 > m11 && m00 > m22) {
    const s = 2.0 * Math.sqrt(1.0 + m00 - m11 - m22);
    qw = (m21 - m12) / s;
    qx = 0.25 * s;
    qy = (m01 + m10) / s;
    qz = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = 2.0 * Math.sqrt(1.0 + m11 - m00 - m22);
    qw = (m02 - m20) / s;
    qx = (m01 + m10) / s;
    qy = 0.25 * s;
    qz = (m12 + m21) / s;
  } else {
    const s = 2.0 * Math.sqrt(1.0 + m22 - m00 - m11);
    qw = (m10 - m01) / s;
    qx = (m02 + m20) / s;
    qy = (m12 + m21) / s;
    qz = 0.25 * s;
  }

  return { x: qx, y: qy, z: qz, w: qw };
}

// -------------------------------------------------------------
// CORE CHASE CAMERA UPDATE FUNCTION
// -------------------------------------------------------------
export function updateChaseCamera(world: ecs.World): void {
  const truckEid = gameData.truckEid;
  if (!truckEid || truckEid === 0n) {
    return;
  }

  const truckPos = world.transform.getWorldPosition(truckEid);
  if (!truckPos) {
    return;
  }

  const truckX = truckPos.x;
  const truckY = truckPos.y;
  const truckZ = truckPos.z;
  const truckHeading = gameData.truckHeading;

  // 1. Calculate Truck Forward Vector
  const forwardX = -Math.sin(truckHeading);
  const forwardZ = -Math.cos(truckHeading);

  // 2. Rigid Chase Camera World Position
  const cameraX = truckX - forwardX * CAMERA_DISTANCE;
  const cameraY = truckY + CAMERA_HEIGHT;
  const cameraZ = truckZ - forwardZ * CAMERA_DISTANCE;

  // 3. Look Target Position
  const lookTargetX = truckX;
  const lookTargetY = truckY + CAMERA_LOOK_HEIGHT;
  const lookTargetZ = truckZ;

  // Dynamic subtle camera corner lean (additive visual layer, max ~1.6°)
  const delta = Math.min(world.time.delta || 0.016, 0.05);
  const steerVal = gameData.steeringValue || 0;
  const speed = gameData.truckSpeed || 0;
  const targetLean = -steerVal * Math.min(1.0, Math.abs(speed) / 7.0) * 0.028;
  const leanAlpha = 1.0 - Math.exp(-8.0 * delta);
  currentCamLean += (targetLean - currentCamLean) * leanAlpha;
  if (Math.abs(currentCamLean) < 0.0005) currentCamLean = 0;

  // 4. Compute Upright Camera Quaternion (Three.js camera convention: -Z look, +Y up, +X right)
  const upVector = {
    x: Math.sin(currentCamLean),
    y: Math.cos(currentCamLean),
    z: 0,
  };

  const camQuat = computeCameraLookAtQuaternion(
    { x: cameraX, y: cameraY, z: cameraZ },
    { x: lookTargetX, y: lookTargetY, z: lookTargetZ },
    upVector
  );

  // 5. Update Authoritative ECS Camera Transform
  const cameraEid = world.camera.getActiveEid();
  if (cameraEid && cameraEid !== 0n) {
    world.transform.setWorldPosition(cameraEid, {
      x: cameraX,
      y: cameraY,
      z: cameraZ,
    });
    world.transform.setWorldQuaternion(cameraEid, camQuat);
  }

  // 6. Synchronize Three.js Active Perspective Camera
  const worldAny = world as any;
  const activeCamera = worldAny.three?.activeCamera;
  let isMatched = false;
  let threeQuat = { x: 0, y: 0, z: 0, w: 1 };
  let threeUp = { x: 0, y: 1, z: 0 };

  if (activeCamera) {
    // Ensure FOV is fixed at 80°
    if (activeCamera.fov !== CAMERA_TARGET_FOV) {
      activeCamera.fov = CAMERA_TARGET_FOV;
      activeCamera.updateProjectionMatrix?.();
    }

    // Ensure camera up vector is strictly (0, 1, 0)
    activeCamera.up.set(0, 1, 0);
    threeUp = { x: activeCamera.up.x, y: activeCamera.up.y, z: activeCamera.up.z };

    // Check relationship with ECS entity's Three.js representation
    const entityObj = cameraEid ? worldAny.three?.entityToObject?.get(cameraEid) : null;
    isMatched = Boolean(entityObj && (entityObj === activeCamera || entityObj.userData?.camera === activeCamera));

    if (activeCamera.parent) {
      // When activeCamera is child of the camera entity object, keep its local transform at identity
      // so it inherits the exact world transform set on the ECS camera entity without double-transformation
      activeCamera.position.set(0, 0, 0);
      activeCamera.quaternion.set(0, 0, 0, 1);
    } else {
      // If activeCamera is not attached to an entity hierarchy, set world transform directly
      activeCamera.position.set(cameraX, cameraY, cameraZ);
      activeCamera.quaternion.set(camQuat.x, camQuat.y, camQuat.z, camQuat.w);
    }

    threeQuat = {
      x: activeCamera.quaternion.x,
      y: activeCamera.quaternion.y,
      z: activeCamera.quaternion.z,
      w: activeCamera.quaternion.w,
    };
  }

  // 7. Real-time Diagnostics Metrics
  const hDist = Math.hypot(cameraX - truckX, cameraZ - truckZ);
  const vOffset = cameraY - truckY;

  latestCameraDiagnostics = {
    truckX,
    truckY,
    truckZ,
    truckHeading,
    cameraX,
    cameraY,
    cameraZ,
    horizontalDistance: hDist,
    verticalOffset: vOffset,
    fov: activeCamera?.fov ?? CAMERA_TARGET_FOV,
    activeCameraEid: cameraEid ? cameraEid.toString() : "none",
    isMatched,
    ecsQuat: camQuat,
    threeUp,
    threeQuat,
  };

  updateDiagnosticOverlay(latestCameraDiagnostics);
}

// -------------------------------------------------------------
// RESET CHASE CAMERA
// -------------------------------------------------------------
export function resetChaseCamera(): void {
  // Stateless rigid camera follows truck immediately on next tick
}

// -------------------------------------------------------------
// 8th WALL ECS COMPONENT REGISTRATION
// -------------------------------------------------------------
ecs.registerComponent({
  name: "chase-camera",
  schema: {},
  tick: (world) => {
    updateChaseCamera(world);
  },
});

