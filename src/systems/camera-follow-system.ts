import * as ecs from "@8thwall/ecs";

import { recordFakoLifecycleEvent } from "../core/diagnostics";

// =====================================================
// CYBERWRAP 3D TOP-DOWN BOARD-GAME CAMERA SYSTEM
//
// Replaces all previous chase/orbit/isometric camera logic with
// a fixed, stable tabletop overhead arcade camera view.
//
// Key Design Characteristics:
// - Fixed overhead world-space position centered over the board: (0, 35, 8.5)
// - Fixed look target pointing directly down at the board: (0, 0, 8.5)
// - Camera does NOT follow the truck or change position based on truck movement
// - Camera does NOT rotate with truck heading or steering input
// - No azimuth / polar orbit / velocity-based camera rotation
// - No look-ahead or speed-based dynamic FOV changes
// - No obstruction raycasting or pull-in
// - Detached camera entity (no parenting)
// =====================================================

export type CameraMode = "FOLLOW" | "ORBIT" | "ISOMETRIC" | "BOARD";

export interface CameraModeInfo {
  mode: CameraMode;
  name: string;
  badge: string;
  subtext: string;
}

export const CAMERA_MODES: Record<CameraMode, CameraModeInfo> = {
  FOLLOW: {
    mode: "FOLLOW",
    name: "BOARD CAMERA",
    badge: "CAM: TOP-DOWN BOARD",
    subtext: "Tabletop Overhead View",
  },
  ORBIT: {
    mode: "ORBIT",
    name: "BOARD CAMERA",
    badge: "CAM: TOP-DOWN BOARD",
    subtext: "Tabletop Overhead View",
  },
  ISOMETRIC: {
    mode: "ISOMETRIC",
    name: "BOARD CAMERA",
    badge: "CAM: TOP-DOWN BOARD",
    subtext: "Tabletop Overhead View",
  },
  BOARD: {
    mode: "BOARD",
    name: "BOARD CAMERA",
    badge: "CAM: TOP-DOWN BOARD",
    subtext: "Tabletop Overhead View",
  },
};

// =====================================================
// BOARD-GAME CAMERA CONFIGURATION CONSTANTS
// =====================================================

export const BOARD_CAMERA_POSITION = { x: 0.0, y: 110.0, z: 0.0 };
export const BOARD_LOOK_TARGET = { x: 0.0, y: 0.0, z: 0.0 };
export const BOARD_CAMERA_VIEW_DIRECTION = { x: 0.0, y: -1.0, z: 0.0 };
export const BOARD_CAMERA_UP_DIRECTION = { x: 0.0, y: 0.0, z: -1.0 };
export const TOP_DOWN_QUATERNION = {
  x: -0.7071067811865475,
  y: 0.0,
  z: 0.0,
  w: 0.7071067811865475,
};
export const BOARD_CAMERA_FOV = 60.0;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 500.0;

let currentCameraMode: CameraMode = "BOARD";
let environmentLoaded = false;
let initialized = false;
let sceneCameraLogged = false;

// ----------------------------------------------------
// CAMERA MODE HELPERS (UI COMPATIBILITY)
// ----------------------------------------------------

export function getCurrentCameraMode(): CameraMode {
  return currentCameraMode;
}

export function setCameraMode(mode: CameraMode): void {
  currentCameraMode = mode;
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("cyberwrap-camera-mode-changed", {
        detail: CAMERA_MODES[currentCameraMode] || CAMERA_MODES.BOARD,
      })
    );
  }
}

export function cycleCameraMode(): CameraMode {
  setCameraMode("BOARD");
  return "BOARD";
}

// ----------------------------------------------------
// ENVIRONMENT LOADER (MOUNTAIN-VIEW SKYBOX)
// ----------------------------------------------------

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
      textureLoader.load("assets/mountain-view.jpg", (fallbackTexture: any) => {
        if (THREE_GLOBAL.EquirectangularReflectionMapping) {
          fallbackTexture.mapping = THREE_GLOBAL.EquirectangularReflectionMapping;
        }
        if (THREE_GLOBAL.SRGBColorSpace) {
          fallbackTexture.colorSpace = THREE_GLOBAL.SRGBColorSpace;
        }
        scene.background = fallbackTexture;
        scene.environment = fallbackTexture;
      });
    }
  );
}

// ----------------------------------------------------
// FIXED TOP-DOWN BOARD CAMERA SYNCHRONIZATION
// ----------------------------------------------------

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

    let needsProjUpdate = false;
    if (Math.abs(activeCamera.fov - BOARD_CAMERA_FOV) > 0.05) {
      activeCamera.fov = BOARD_CAMERA_FOV;
      needsProjUpdate = true;
    }
    if (activeCamera.near !== CAMERA_NEAR) {
      activeCamera.near = CAMERA_NEAR;
      needsProjUpdate = true;
    }
    if (activeCamera.far !== CAMERA_FAR) {
      activeCamera.far = CAMERA_FAR;
      needsProjUpdate = true;
    }
    if (needsProjUpdate && typeof activeCamera.updateProjectionMatrix === "function") {
      activeCamera.updateProjectionMatrix();
    }
  }

  const cameraEid = world.camera.getActiveEid();
  if (cameraEid && cameraEid !== 0n) {
    try {
      world.transform.setWorldPosition(cameraEid, BOARD_CAMERA_POSITION);
      world.transform.setWorldQuaternion(cameraEid, TOP_DOWN_QUATERNION);
    } catch (e) {
      // Safe fallback
    }
  }

  if (!initialized) {
    initialized = true;
    recordFakoLifecycleEvent("cameraSystemInitCount");
    console.log("[FakoCamera] FIXED BOARD-GAME TOP-DOWN CAMERA INITIALIZED", {
      position: BOARD_CAMERA_POSITION,
      lookTarget: BOARD_LOOK_TARGET,
      viewDirection: BOARD_CAMERA_VIEW_DIRECTION,
      upDirection: BOARD_CAMERA_UP_DIRECTION,
      quaternion: TOP_DOWN_QUATERNION,
      fov: BOARD_CAMERA_FOV,
      near: CAMERA_NEAR,
      far: CAMERA_FAR,
    });
  }
}

// ----------------------------------------------------
// COMPATIBILITY STUBS & LIFECYCLE HOOKS
// ----------------------------------------------------

export function updateChaseCamera(
  world: ecs.World,
  _truckEid?: ecs.Eid,
  _forceSnap?: boolean
): void {
  updateBoardCamera(world);
}

export function resetCameraFollowSystem(): void {
  initialized = false;
  recordFakoLifecycleEvent("cameraResetCount");
  console.log("[FakoCamera] Board camera state refreshed for new round");
}

export function attachRigidCamera(_world: ecs.World, _truckEid: ecs.Eid): void {
  recordFakoLifecycleEvent("cameraAttachCount");
  console.log("[FakoCamera] attachRigidCamera no-op (board camera is detached and static)");
}

// ----------------------------------------------------
// ECS COMPONENT REGISTRATION
// ----------------------------------------------------

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
      console.log("[FakoCamera] SCENE CAMERA ACTIVE");
    }

    updateBoardCamera(world);
  },
});
