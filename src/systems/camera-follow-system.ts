import * as ecs from "@8thwall/ecs";

import { gameData } from "../core/game-data";
import { recordFakoLifecycleEvent } from "../core/diagnostics";
import {
  resetSmoothOrbitCamera,
  updateSmoothOrbitCamera,
} from "./smooth-orbit-camera";

// ------------------------------------------------------------
// CYBERWRAP: CAMERA SYSTEM & MODE COORDINATOR
// ------------------------------------------------------------
//
// Authoritative mode coordinator for CyberWrap:
// - FOLLOW: Vortelli-style third-person chase camera (Default driving mode)
// - ORBIT: Stationary / inspection camera with limited manual yaw/pitch
// - ISOMETRIC: Angled third-person city overview tracking the truck
// - BOARD: Fixed tabletop top-down perspective
// ------------------------------------------------------------

export type CameraMode =
  | "FOLLOW"
  | "ORBIT"
  | "ISOMETRIC"
  | "BOARD";

export interface CameraModeInfo {
  mode: CameraMode;
  name: string;
  badge: string;
  subtext: string;
}

export const CAMERA_MODES: Record<CameraMode, CameraModeInfo> = {
  FOLLOW: {
    mode: "FOLLOW",
    name: "CHASE CAMERA",
    badge: "CAM: CHASE FOLLOW",
    subtext: "Dynamic Third-Person View",
  },

  ORBIT: {
    mode: "ORBIT",
    name: "SMOOTH ORBIT",
    badge: "CAM: SMOOTH ORBIT",
    subtext: "Interactive 3D Follow & Orbit",
  },

  ISOMETRIC: {
    mode: "ISOMETRIC",
    name: "ISOMETRIC",
    badge: "CAM: ISOMETRIC",
    subtext: "Angled City Overview",
  },

  BOARD: {
    mode: "BOARD",
    name: "BOARD CAMERA",
    badge: "CAM: TOP-DOWN BOARD",
    subtext: "Tabletop Overhead View",
  },
};

// ------------------------------------------------------------
// BOARD CAMERA CONSTANTS
// ------------------------------------------------------------

export const BOARD_CAMERA_POSITION = {
  x: 0.0,
  y: 110.0,
  z: 0.0,
};

export const BOARD_LOOK_TARGET = {
  x: 0.0,
  y: 0.0,
  z: 0.0,
};

export const BOARD_CAMERA_VIEW_DIRECTION = {
  x: 0.0,
  y: -1.0,
  z: 0.0,
};

export const BOARD_CAMERA_UP_DIRECTION = {
  x: 0.0,
  y: 0.0,
  z: -1.0,
};

export const TOP_DOWN_QUATERNION = {
  x: -0.7071067811865475,
  y: 0.0,
  z: 0.0,
  w: 0.7071067811865475,
};

export const BOARD_CAMERA_FOV = 60.0;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 500.0;

// ------------------------------------------------------------
// CAMERA MODE STATE
// ------------------------------------------------------------

// Default to FOLLOW for immediate Vortelli-style chase gameplay
let currentCameraMode: CameraMode = "FOLLOW";

let environmentLoaded = false;
let sceneCameraLogged = false;

// ------------------------------------------------------------
// PUBLIC MODE API
// ------------------------------------------------------------

export function getCurrentCameraMode(): CameraMode {
  return currentCameraMode;
}

export function setCameraMode(mode: CameraMode): void {
  if (!CAMERA_MODES[mode]) {
    return;
  }

  currentCameraMode = mode;

  // Reset manual camera state when switching modes
  resetSmoothOrbitCamera();

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("cyberwrap-camera-mode-changed", {
        detail: CAMERA_MODES[currentCameraMode] || CAMERA_MODES.FOLLOW,
      })
    );
  }
}

export function cycleCameraMode(): CameraMode {
  const modeOrder: CameraMode[] = [
    "FOLLOW",
    "ORBIT",
    "ISOMETRIC",
    "BOARD",
  ];

  const currentIndex = modeOrder.indexOf(currentCameraMode);
  const nextMode = modeOrder[(currentIndex + 1) % modeOrder.length];

  setCameraMode(nextMode);

  return nextMode;
}

// ------------------------------------------------------------
// ENVIRONMENT BACKGROUND SETUP
// ------------------------------------------------------------

function setupEnvironment(scene: any): void {
  if (environmentLoaded || !scene) {
    return;
  }

  environmentLoaded = true;

  const THREE_GLOBAL = (window as any).THREE;

  if (!THREE_GLOBAL || !THREE_GLOBAL.TextureLoader) {
    return;
  }

  const textureLoader = new THREE_GLOBAL.TextureLoader();
  const bgPath = "/assets/mountain-view.jpg";

  textureLoader.load(
    bgPath,
    (texture: any) => {
      if (THREE_GLOBAL.EquirectangularReflectionMapping) {
        texture.mapping = THREE_GLOBAL.EquirectangularReflectionMapping;
      }

      if (THREE_GLOBAL.SRGBColorSpace) {
        texture.colorSpace = THREE_GLOBAL.SRGBColorSpace;
      }

      scene.background = texture;
      scene.environment = texture;
    },
    undefined,
    () => {
      textureLoader.load(
        "assets/mountain-view.jpg",
        (fallbackTexture: any) => {
          if (THREE_GLOBAL.EquirectangularReflectionMapping) {
            fallbackTexture.mapping =
              THREE_GLOBAL.EquirectangularReflectionMapping;
          }

          if (THREE_GLOBAL.SRGBColorSpace) {
            fallbackTexture.colorSpace = THREE_GLOBAL.SRGBColorSpace;
          }

          scene.background = fallbackTexture;
          scene.environment = fallbackTexture;
        }
      );
    }
  );
}

// ------------------------------------------------------------
// BOARD CAMERA UPDATE
// ------------------------------------------------------------

export function updateBoardCamera(world: ecs.World): void {
  const worldAny = world as any;
  const activeCamera = worldAny.three?.activeCamera;

  if (activeCamera) {
    activeCamera.position.set(
      BOARD_CAMERA_POSITION.x,
      BOARD_CAMERA_POSITION.y,
      BOARD_CAMERA_POSITION.z
    );

    activeCamera.up.set(
      BOARD_CAMERA_UP_DIRECTION.x,
      BOARD_CAMERA_UP_DIRECTION.y,
      BOARD_CAMERA_UP_DIRECTION.z
    );

    activeCamera.quaternion.set(
      TOP_DOWN_QUATERNION.x,
      TOP_DOWN_QUATERNION.y,
      TOP_DOWN_QUATERNION.z,
      TOP_DOWN_QUATERNION.w
    );

    let needsProjectionUpdate = false;

    if (Math.abs(activeCamera.fov - BOARD_CAMERA_FOV) > 0.05) {
      activeCamera.fov = BOARD_CAMERA_FOV;
      needsProjectionUpdate = true;
    }

    if (activeCamera.near !== CAMERA_NEAR) {
      activeCamera.near = CAMERA_NEAR;
      needsProjectionUpdate = true;
    }

    if (activeCamera.far !== CAMERA_FAR) {
      activeCamera.far = CAMERA_FAR;
      needsProjectionUpdate = true;
    }

    if (
      needsProjectionUpdate &&
      typeof activeCamera.updateProjectionMatrix === "function"
    ) {
      activeCamera.updateProjectionMatrix();
    }
  }

  const cameraEid = world.camera.getActiveEid();

  if (cameraEid && cameraEid !== 0n) {
    try {
      world.transform.setWorldPosition(cameraEid, BOARD_CAMERA_POSITION);
      world.transform.setWorldQuaternion(cameraEid, TOP_DOWN_QUATERNION);
    } catch {
      // Safe fallback
    }
  }
}

// ------------------------------------------------------------
// CHASE / GAMEPLAY CAMERA ENTRY POINT
// ------------------------------------------------------------

export function updateChaseCamera(
  world: ecs.World,
  truckEid?: ecs.Eid,
  forceSnap = false
): void {
  if (currentCameraMode === "BOARD") {
    updateBoardCamera(world);
    return;
  }

  const targetTruck = truckEid || gameData.truckEid || undefined;

  if (!targetTruck || targetTruck === 0n) {
    return;
  }

  updateSmoothOrbitCamera(world, targetTruck, currentCameraMode, forceSnap);
}

// ------------------------------------------------------------
// SYSTEM RESET
// ------------------------------------------------------------

export function resetCameraFollowSystem(): void {
  resetSmoothOrbitCamera();
  recordFakoLifecycleEvent("cameraResetCount");
  console.log("[FakoCamera] Camera follow system reset for new round");
}

// ------------------------------------------------------------
// LEGACY API (PRESERVED)
// ------------------------------------------------------------

export function attachRigidCamera(
  _world: ecs.World,
  _truckEid: ecs.Eid
): void {
  // Camera is strictly NOT parented to avoid ECS hierarchy issues.
  recordFakoLifecycleEvent("cameraAttachCount");
}

// ------------------------------------------------------------
// CAMERA FOLLOW SYSTEM ECS COMPONENT REGISTRATION
// ------------------------------------------------------------

ecs.registerComponent({
  name: "camera-follow-system",

  schema: {},

  tick: (world) => {
    const worldAny = world as any;
    const scene = worldAny.three?.scene;

    if (scene) {
      setupEnvironment(scene);
    }

    if (!sceneCameraLogged) {
      sceneCameraLogged = true;
      console.log("[FakoCamera] Vortelli-Style Authoritative Camera System Active (Default: FOLLOW)");
    }

    if (currentCameraMode === "BOARD") {
      updateBoardCamera(world);
      return;
    }

    const truckEid = gameData.truckEid || undefined;

    if (truckEid && truckEid !== 0n) {
      updateChaseCamera(world, truckEid);
    }
  },
});
