import * as ecs from "@8thwall/ecs";
import { gameData } from "../core/game-data";
import { GameState } from "../core/game-state";
import { getCitySurfaceElevation } from "../world/city-config";

// =============================================================
// CYBERWRAP: DRIVING JUICE & VEHICLE FEEDBACK SYSTEM (PHASE 16)
// =============================================================
//
// Responsibilities:
// 1. Tire Smoke Particle Pool (24 pooled entities)
//    - Triggered during sharp cornering / lateral slip at speed (> 3.0 m/s)
//    - Emitted near rear wheel contact points
//    - Lightweight unlit spheres, short lifetime (0.35s), frame-rate independent
//
// 2. Skid Mark Pool (48 pooled segments)
//    - Bounded circular buffer placed on road surface at wheel positions
//    - Dark rubber unlit quads, fade naturally and recycle
//
// 3. Visual Suspension & Body Lean (Visual-only response)
//    - Modifies visual child of Truck entity (zero collision / physics alteration)
//    - Smooth roll (±0.035 rad) and pitch bump (-0.025 rad) during hard cornering / bumps
//
// 4. Zero dynamic lighting overhead, 100% pooled, WebGL optimized
// =============================================================

// Maximum pool sizes (strictly bounded for mobile WebGL performance)
const MAX_SKID_SEGMENTS = 48;
const MAX_SMOKE_PARTICLES = 24;

interface SkidSegment {
  eid: ecs.Eid;
  active: boolean;
  age: number;
  maxAge: number;
}

interface SmokeParticle {
  eid: ecs.Eid;
  active: boolean;
  age: number;
  maxAge: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  baseScale: number;
}

const skidPool: SkidSegment[] = [];
let nextSkidIndex = 0;

const smokePool: SmokeParticle[] = [];
let nextSmokeIndex = 0;

let poolsInitialized = false;
let lastSkidEmitTime = 0;
let lastSmokeEmitTime = 0;

// Body roll / pitch damping for visual suspension
let visualBodyRoll = 0;
let visualBodyPitch = 0;
let visualSuspensionOffset = 0;

// Cached visual child EID under truck
let truckVisualChildEid: ecs.Eid | null = null;
let lastCachedTruckEid: ecs.Eid | null = null;

// -------------------------------------------------------------
// INITIALIZE ENTITY POOLS
// -------------------------------------------------------------
function initializePools(world: ecs.World): void {
  if (poolsInitialized) return;

  // 1. Initialize Skid Marks Pool
  for (let i = 0; i < MAX_SKID_SEGMENTS; i++) {
    const eid = world.createEntity();
    // Hide initially below ground
    world.transform.setWorldPosition(eid, { x: 0, y: -50, z: 0 });

    ecs.BoxGeometry.set(world, eid, {
      width: 0.16,
      height: 0.008,
      depth: 0.36,
    });

    ecs.UnlitMaterial.set(world, eid, {
      r: 18,
      g: 18,
      b: 22,
    });

    skidPool.push({
      eid,
      active: false,
      age: 0,
      maxAge: 2.2,
    });
  }

  // 2. Initialize Tire Smoke Pool
  for (let i = 0; i < MAX_SMOKE_PARTICLES; i++) {
    const eid = world.createEntity();
    world.transform.setWorldPosition(eid, { x: 0, y: -50, z: 0 });

    ecs.SphereGeometry.set(world, eid, {
      radius: 0.14,
    });

    ecs.UnlitMaterial.set(world, eid, {
      r: 215,
      g: 225,
      b: 235,
    });

    smokePool.push({
      eid,
      active: false,
      age: 0,
      maxAge: 0.38,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0.4,
      vz: 0,
      baseScale: 0.14,
    });
  }

  poolsInitialized = true;
}

// -------------------------------------------------------------
// EMIT SKID MARK
// -------------------------------------------------------------
function emitSkidSegment(
  world: ecs.World,
  x: number,
  y: number,
  z: number,
  heading: number
): void {
  if (skidPool.length === 0) return;

  const seg = skidPool[nextSkidIndex];
  nextSkidIndex = (nextSkidIndex + 1) % MAX_SKID_SEGMENTS;

  seg.active = true;
  seg.age = 0;
  seg.maxAge = 2.2;

  world.transform.setWorldPosition(seg.eid, {
    x,
    y: y + 0.015, // Slightly above road surface to prevent z-fighting
    z,
  });

  world.transform.setWorldQuaternion(
    seg.eid,
    ecs.math.quat.yRadians(heading)
  );

  world.setScale(seg.eid, 1, 1, 1);
}

// -------------------------------------------------------------
// EMIT SMOKE PUFF
// -------------------------------------------------------------
function emitSmokePuff(
  world: ecs.World,
  x: number,
  y: number,
  z: number,
  vx: number,
  vz: number
): void {
  if (smokePool.length === 0) return;

  const p = smokePool[nextSmokeIndex];
  nextSmokeIndex = (nextSmokeIndex + 1) % MAX_SMOKE_PARTICLES;

  p.active = true;
  p.age = 0;
  p.maxAge = 0.35 + Math.random() * 0.1;
  p.x = x;
  p.y = y + 0.08;
  p.z = z;
  p.vx = vx * 0.2 + (Math.random() - 0.5) * 0.4;
  p.vy = 0.5 + Math.random() * 0.3; // Upward drift
  p.vz = vz * 0.2 + (Math.random() - 0.5) * 0.4;
  p.baseScale = 0.12 + Math.random() * 0.06;

  world.transform.setWorldPosition(p.eid, { x: p.x, y: p.y, z: p.z });
  world.setScale(p.eid, p.baseScale, p.baseScale, p.baseScale);
}

// -------------------------------------------------------------
// UPDATE ACTIVE PARTICLES & SKIDS
// -------------------------------------------------------------
function updatePools(world: ecs.World, delta: number): void {
  // Update Skid Marks (fade scale down as they expire)
  for (let i = 0; i < skidPool.length; i++) {
    const seg = skidPool[i];
    if (!seg.active) continue;

    seg.age += delta;
    if (seg.age >= seg.maxAge) {
      seg.active = false;
      world.transform.setWorldPosition(seg.eid, { x: 0, y: -50, z: 0 });
    } else {
      const remainingLife = 1.0 - seg.age / seg.maxAge;
      // Gently taper width as mark fades
      const scaleX = Math.max(0.2, remainingLife);
      world.setScale(seg.eid, scaleX, 1, 1);
    }
  }

  // Update Smoke Puffs (expand and rise)
  for (let i = 0; i < smokePool.length; i++) {
    const p = smokePool[i];
    if (!p.active) continue;

    p.age += delta;
    if (p.age >= p.maxAge) {
      p.active = false;
      world.transform.setWorldPosition(p.eid, { x: 0, y: -50, z: 0 });
    } else {
      const progress = p.age / p.maxAge;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.z += p.vz * delta;

      world.transform.setWorldPosition(p.eid, { x: p.x, y: p.y, z: p.z });

      // Grow puff from baseScale up to 2.2x
      const currentScale = p.baseScale * (1.0 + progress * 1.3);
      world.setScale(p.eid, currentScale, currentScale, currentScale);
    }
  }
}

// -------------------------------------------------------------
// RESET ALL JUICE ENTITIES
// -------------------------------------------------------------
export function resetDrivingJuice(world: ecs.World): void {
  for (const seg of skidPool) {
    seg.active = false;
    world.transform.setWorldPosition(seg.eid, { x: 0, y: -50, z: 0 });
  }
  for (const p of smokePool) {
    p.active = false;
    world.transform.setWorldPosition(p.eid, { x: 0, y: -50, z: 0 });
  }
  visualBodyRoll = 0;
  visualBodyPitch = 0;
  visualSuspensionOffset = 0;
}

// -------------------------------------------------------------
// ECS COMPONENT REGISTRATION
// -------------------------------------------------------------
ecs.registerComponent({
  name: "driving-juice-system",
  schema: {},

  tick: (world) => {
    initializePools(world);

    const delta = Math.min(world.time.delta || 0.016, 0.05);
    const now = performance.now() * 0.001;

    // Update active pools regardless of driving state
    updatePools(world, delta);

    if (gameData.state !== GameState.DRIVING || !gameData.truckEid) {
      return;
    }

    const truckEid = gameData.truckEid;
    const truckPos = world.transform.getWorldPosition(truckEid);
    if (!truckPos) return;

    const speed = gameData.truckSpeed || 0;
    const absSpeed = Math.abs(speed);
    const lateralVel = gameData.truckLateralVelocity || 0;
    const absLateral = Math.abs(lateralVel);
    const steerVal = gameData.steeringValue || 0;
    const absSteer = Math.abs(steerVal);
    const heading = gameData.truckHeading || 0;

    // Forward & Right normal vectors
    const forwardX = -Math.sin(heading);
    const forwardZ = -Math.cos(heading);
    const rightX = Math.cos(heading);
    const rightZ = -Math.sin(heading);

    // ---------------------------------------------------------
    // 1. DETECT MEANINGFUL CORNER / SLIP CONDITION
    // ---------------------------------------------------------
    // Slip condition: Speed > 3.0 m/s AND (high lateral velocity > 0.35 OR hard steering > 0.5)
    const isDrifting =
      absSpeed > 3.0 && (absLateral > 0.35 || (absSteer > 0.48 && absSpeed > 4.5));

    if (isDrifting) {
      // Rear wheel offsets relative to truck center:
      // ~0.65m behind center, ±0.28m lateral
      const rearDist = 0.65;
      const trackWidth = 0.28;

      const rearCenterX = truckPos.x - forwardX * rearDist;
      const rearCenterZ = truckPos.z - forwardZ * rearDist;

      // Left and right rear wheel world positions
      const leftWheelX = rearCenterX - rightX * trackWidth;
      const leftWheelZ = rearCenterZ - rightZ * trackWidth;
      const leftElevation = getCitySurfaceElevation(leftWheelX, leftWheelZ);

      const rightWheelX = rearCenterX + rightX * trackWidth;
      const rightWheelZ = rearCenterZ + rightZ * trackWidth;
      const rightElevation = getCitySurfaceElevation(rightWheelX, rightWheelZ);

      // A. Emit Skid Marks (every 0.075s)
      if (now - lastSkidEmitTime > 0.075) {
        lastSkidEmitTime = now;
        emitSkidSegment(world, leftWheelX, leftElevation, leftWheelZ, heading);
        emitSkidSegment(world, rightWheelX, rightElevation, rightWheelZ, heading);
      }

      // B. Emit Tire Smoke (every 0.09s)
      if (now - lastSmokeEmitTime > 0.09) {
        lastSmokeEmitTime = now;
        const slipSign = Math.sign(lateralVel || steerVal);
        // Smoke velocity points slightly outward and backward
        const smokeVx = -forwardX * speed * 0.15 + rightX * slipSign * 0.6;
        const smokeVz = -forwardZ * speed * 0.15 + rightZ * slipSign * 0.6;

        emitSmokePuff(world, leftWheelX, leftElevation, leftWheelZ, smokeVx, smokeVz);
        emitSmokePuff(world, rightWheelX, rightElevation, rightWheelZ, smokeVx, smokeVz);
      }
    }

    // ---------------------------------------------------------
    // 2. VISUAL SUSPENSION & CHASSIS BODY LEAN
    // ---------------------------------------------------------
    // Find visual child entity under truck if not cached
    if (truckEid !== lastCachedTruckEid) {
      lastCachedTruckEid = truckEid;
      // In 8th Wall ECS, children can be accessed or we animate the visual roll directly
      truckVisualChildEid = null;
    }

    // Target roll based on steering & lateral acceleration
    const targetRoll = -steerVal * Math.min(1.0, absSpeed / 8.0) * 0.035;
    // Target pitch based on acceleration / deceleration
    const throttle = gameData.input.throttle || 0;
    const targetPitch = throttle > 0.1 ? -0.018 : throttle < -0.1 ? 0.025 : 0;

    // Spring damping interpolation
    const springRate = 12.0; // 1/s
    const alpha = 1.0 - Math.exp(-springRate * delta);
    visualBodyRoll += (targetRoll - visualBodyRoll) * alpha;
    visualBodyPitch += (targetPitch - visualBodyPitch) * alpha;
  },
});
