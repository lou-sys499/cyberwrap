import * as ecs from "@8thwall/ecs";
import { gameData } from "../core/game-data";
import { GameState } from "../core/game-state";
import { latestCameraDiagnostics, CAMERA_DISTANCE, CAMERA_HEIGHT, CAMERA_LOOK_HEIGHT, CAMERA_TARGET_FOV } from "./chase-camera";

// =============================================================
// CYBERWRAP: DRIVING FORENSICS & TELEMETRY SYSTEM
// =============================================================
//
// Developer telemetry & live kinematics measurement system.
// Observes vehicle physics, speed decomposition, yaw rate, turning
// radius, heading/velocity divergence, and baseline performance.
// STRICTLY READ-ONLY: Alters NO driving parameters or camera properties.
// =============================================================

export interface DrivingTelemetryData {
  frame: number;
  fps: number;
  dt: number;
  posX: number;
  posY: number;
  posZ: number;
  headingDeg: number;
  yawRateDegPerSec: number;
  rawSteering: number;
  rawThrottle: number;
  isBraking: boolean;
  forwardVelocity: number;
  lateralVelocity: number;
  totalSpeed: number;
  velocityHeadingDeg: number;
  headingVelDivergenceDeg: number;
  longitudinalAccel: number;
  lateralAccel: number;
  gForce: number;
  turningRadius: number;
  cameraDist: number;
  cameraHeight: number;
  cameraFov: number;
  truckScale: number;
  worldScale: string;
}

export let latestDrivingTelemetry: DrivingTelemetryData = {
  frame: 0,
  fps: 60,
  dt: 0.016,
  posX: 0,
  posY: 0,
  posZ: 0,
  headingDeg: 0,
  yawRateDegPerSec: 0,
  rawSteering: 0,
  rawThrottle: 0,
  isBraking: false,
  forwardVelocity: 0,
  lateralVelocity: 0,
  totalSpeed: 0,
  velocityHeadingDeg: 0,
  headingVelDivergenceDeg: 0,
  longitudinalAccel: 0,
  lateralAccel: 0,
  gForce: 0,
  turningRadius: Infinity,
  cameraDist: CAMERA_DISTANCE,
  cameraHeight: CAMERA_HEIGHT,
  cameraFov: CAMERA_TARGET_FOV,
  truckScale: 1.0,
  worldScale: "1 unit ≈ 1m",
};

// Internal tracking state
let frameCounter = 0;
let lastTimestamp = 0;
let fpsSmoothed = 60;
let prevPosX = 0;
let prevPosY = 0;
let prevPosZ = 0;
let prevHeading = 0;
let prevForwardVel = 0;
let prevLateralVel = 0;
let initialized = false;

// DOM Telemetry HUD
let telemetryOverlay: HTMLDivElement | null = null;
let isTelemetryVisible = false;

export function setTelemetryVisible(visible: boolean): void {
  isTelemetryVisible = visible;
  if (telemetryOverlay) {
    telemetryOverlay.style.display = visible ? "block" : "none";
  }
}

export function getTelemetryVisible(): boolean {
  return isTelemetryVisible;
}

function normalizeAngle(rad: number): number {
  while (rad > Math.PI) rad -= Math.PI * 2;
  while (rad < -Math.PI) rad += Math.PI * 2;
  return rad;
}

function updateTelemetryOverlay(d: DrivingTelemetryData): void {
  if (!isTelemetryVisible) {
    if (telemetryOverlay) {
      telemetryOverlay.style.display = "none";
    } else if (typeof document !== "undefined") {
      const existing = document.getElementById("cw-driving-telemetry");
      if (existing) existing.style.display = "none";
      const oldCamOverlay = document.getElementById("cw-cam-diagnostics");
      if (oldCamOverlay) oldCamOverlay.style.display = "none";
    }
    return;
  }

  if (!telemetryOverlay && document.body) {
    telemetryOverlay = document.getElementById("cw-driving-telemetry") as HTMLDivElement | null;
    if (!telemetryOverlay) {
      telemetryOverlay = document.createElement("div");
      telemetryOverlay.id = "cw-driving-telemetry";
      telemetryOverlay.style.position = "fixed";
      telemetryOverlay.style.top = "8px";
      telemetryOverlay.style.left = "8px";
      telemetryOverlay.style.padding = "6px 10px";
      telemetryOverlay.style.background = "rgba(10, 15, 25, 0.90)";
      telemetryOverlay.style.border = "1px solid rgba(0, 255, 204, 0.7)";
      telemetryOverlay.style.borderRadius = "6px";
      telemetryOverlay.style.color = "#00ffcc";
      telemetryOverlay.style.fontFamily = "monospace";
      telemetryOverlay.style.fontSize = "11px";
      telemetryOverlay.style.lineHeight = "1.32";
      telemetryOverlay.style.pointerEvents = "none";
      telemetryOverlay.style.zIndex = "999999";
      telemetryOverlay.style.boxShadow = "0 2px 10px rgba(0,0,0,0.6)";
      telemetryOverlay.style.minWidth = "240px";
      document.body.appendChild(telemetryOverlay);

      // Hide redundant camera-only overlay if present
      const oldCamOverlay = document.getElementById("cw-cam-diagnostics");
      if (oldCamOverlay) oldCamOverlay.style.display = "none";
    }
  }

  if (telemetryOverlay) {
    telemetryOverlay.style.display = "block";

    const turnRadiusStr = Number.isFinite(d.turningRadius)
      ? `${d.turningRadius.toFixed(1)}m`
      : "∞ (N/A)";

    const slipColor = Math.abs(d.headingVelDivergenceDeg) > 15 ? "#ffaa00" : "#00ffcc";
    const gColor = d.gForce > 0.5 ? "#ff5555" : "#00ffcc";

    telemetryOverlay.innerHTML = `
      <div style="color:#ffaa00;font-weight:bold;margin-bottom:2px;display:flex;justify-content:space-between;">
        <span>[DRIVING FORENSICS]</span>
        <span style="color:#aaa;">#${d.frame}</span>
      </div>
      <div>FPS: <span style="color:#fff;font-weight:bold;">${d.fps.toFixed(0)}</span> | DT: ${(d.dt * 1000).toFixed(1)}ms</div>
      <div style="color:#88aaff;margin-top:2px;">POS: (${d.posX.toFixed(2)}, ${d.posY.toFixed(2)}, ${d.posZ.toFixed(2)})</div>
      <div>HEADING: <span style="color:#fff;">${d.headingDeg.toFixed(1)}°</span> | YAW: <span style="color:#fff;">${d.yawRateDegPerSec.toFixed(1)}°/s</span></div>
      <div>INPUT: STEER <span style="color:#fff;">${d.rawSteering.toFixed(2)}</span> | THROTTLE <span style="color:#fff;">${d.rawThrottle.toFixed(2)}</span> ${d.isBraking ? '<span style="color:#ff4444;font-weight:bold;">[BRAKE]</span>' : ''}</div>
      <div style="margin-top:2px;border-top:1px solid rgba(255,255,255,0.15);padding-top:2px;">
        VELOCITY: FWD <span style="color:#fff;font-weight:bold;">${d.forwardVelocity.toFixed(2)}</span> | LAT <span style="color:#fff;">${d.lateralVelocity.toFixed(2)}</span> | TOTAL <span style="color:#00ff88;font-weight:bold;">${d.totalSpeed.toFixed(2)} m/s</span>
      </div>
      <div>ACCEL: <span style="color:#fff;">${d.longitudinalAccel >= 0 ? '+' : ''}${d.longitudinalAccel.toFixed(2)} m/s²</span> | G-FORCE: <span style="color:${gColor};">${d.gForce.toFixed(2)}G</span></div>
      <div>TURN RADIUS: <span style="color:#fff;font-weight:bold;">${turnRadiusStr}</span></div>
      <div>HEADING/VEL DIV: <span style="color:${slipColor};font-weight:bold;">${d.headingVelDivergenceDeg.toFixed(1)}°</span></div>
      <div style="margin-top:2px;border-top:1px solid rgba(255,255,255,0.15);padding-top:2px;color:#aaa;">
        CAM: DIST ${d.cameraDist.toFixed(2)}m | H ${d.cameraHeight.toFixed(2)}m | FOV ${d.cameraFov.toFixed(0)}°
      </div>
      <div style="color:#888;font-size:10px;">SCALE: TRUCK ${d.truckScale.toFixed(1)}x | ${d.worldScale}</div>
    `;
  }
}

// -------------------------------------------------------------
// ECS TELEMETRY SYSTEM TICK
// -------------------------------------------------------------

export function updateDrivingTelemetry(world: ecs.World): void {
  frameCounter++;

  // Calculate FPS & delta
  const now = performance.now();
  const dt = Math.max(0.001, Math.min(world.time.delta || 0.016, 0.1));
  if (lastTimestamp > 0) {
    const instantFps = 1000 / Math.max(1, now - lastTimestamp);
    fpsSmoothed = fpsSmoothed * 0.9 + instantFps * 0.1;
  }
  lastTimestamp = now;

  const truckEid = gameData.truckEid;
  if (!truckEid || truckEid === 0n || gameData.state !== GameState.DRIVING) {
    return;
  }

  // Current Position & Heading
  const currentPos = world.transform.getWorldPosition(truckEid);
  const currentHeading = gameData.truckHeading;

  if (!initialized) {
    prevPosX = currentPos.x;
    prevPosY = currentPos.y;
    prevPosZ = currentPos.z;
    prevHeading = currentHeading;
    prevForwardVel = 0;
    prevLateralVel = 0;
    initialized = true;
    return;
  }

  // 1. World Velocity Vector from Position Delta
  const vx = (currentPos.x - prevPosX) / dt;
  const vy = (currentPos.y - prevPosY) / dt;
  const vz = (currentPos.z - prevPosZ) / dt;
  const totalSpeed = Math.hypot(vx, vz);

  // 2. Truck Coordinate Frame Basis Vectors
  // In CyberWrap: heading 0 = North (-Z forward), +heading = turn right (+X)
  const forwardX = -Math.sin(currentHeading);
  const forwardZ = -Math.cos(currentHeading);
  const rightX = Math.cos(currentHeading);
  const rightZ = -Math.sin(currentHeading);

  // 3. Velocity Decomposition
  const forwardVel = vx * forwardX + vz * forwardZ;
  const lateralVel = vx * rightX + vz * rightZ;

  // 4. Heading vs. Velocity Direction Divergence
  let velHeading = currentHeading;
  let headingVelDivergence = 0;
  if (totalSpeed > 0.2) {
    velHeading = Math.atan2(-vx, -vz);
    headingVelDivergence = normalizeAngle(currentHeading - velHeading) * (180 / Math.PI);
  }

  // 5. Yaw Rate (deg/sec)
  const deltaHeadingRad = normalizeAngle(currentHeading - prevHeading);
  const yawRateRadPerSec = deltaHeadingRad / dt;
  const yawRateDegPerSec = yawRateRadPerSec * (180 / Math.PI);

  // 6. Instantaneous Turning Radius R = |v / omega|
  let turningRadius = Infinity;
  if (Math.abs(yawRateRadPerSec) > 0.015 && Math.abs(forwardVel) > 0.3) {
    turningRadius = Math.abs(forwardVel / yawRateRadPerSec);
  }

  // 7. Acceleration & G-force
  const longAccel = (forwardVel - prevForwardVel) / dt;
  const latAccel = (lateralVel - prevLateralVel) / dt;
  const gForce = Math.hypot(longAccel, latAccel) / 9.80665;

  // 8. Raw Inputs
  const rawSteering = gameData.input.steering;
  const rawThrottle = gameData.input.throttle;
  const isBraking = (rawThrottle < -0.01 && gameData.truckSpeed > 0.1) ||
                    (rawThrottle > 0.01 && gameData.truckSpeed < -0.1);

  // 9. Camera Info
  const camDiag = latestCameraDiagnostics;

  // Store telemetry
  latestDrivingTelemetry = {
    frame: frameCounter,
    fps: fpsSmoothed,
    dt,
    posX: currentPos.x,
    posY: currentPos.y,
    posZ: currentPos.z,
    headingDeg: currentHeading * (180 / Math.PI),
    yawRateDegPerSec,
    rawSteering,
    rawThrottle,
    isBraking,
    forwardVelocity: forwardVel,
    lateralVelocity: lateralVel,
    totalSpeed,
    velocityHeadingDeg: velHeading * (180 / Math.PI),
    headingVelDivergenceDeg: headingVelDivergence,
    longitudinalAccel: longAccel,
    lateralAccel: latAccel,
    gForce,
    turningRadius,
    cameraDist: camDiag.horizontalDistance || CAMERA_DISTANCE,
    cameraHeight: camDiag.verticalOffset || CAMERA_HEIGHT,
    cameraFov: camDiag.fov || CAMERA_TARGET_FOV,
    truckScale: 1.0,
    worldScale: "1 unit ≈ 1m",
  };

  updateTelemetryOverlay(latestDrivingTelemetry);

  // Store previous values for next frame
  prevPosX = currentPos.x;
  prevPosY = currentPos.y;
  prevPosZ = currentPos.z;
  prevHeading = currentHeading;
  prevForwardVel = forwardVel;
  prevLateralVel = lateralVel;
}

// Register ECS System
ecs.registerComponent({
  name: "driving-telemetry",
  schema: {},
  tick: (world) => {
    updateDrivingTelemetry(world);
  },
});
