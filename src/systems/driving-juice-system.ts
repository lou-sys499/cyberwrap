import * as ecs from "@8thwall/ecs";
import { gameData } from "../core/game-data";
import { GameState } from "../core/game-state";
import { getCitySurfaceElevation } from "../world/city-config";

// =============================================================
// CYBERWRAP: DRIVING JUICE & VEHICLE FEEDBACK SYSTEM (PHASE 16 & 17B-C)
// =============================================================
//
// Responsibilities:
// 1. Visible Road & Terrain Dust Puffs (24 pooled entities)
//    - Triggered during acceleration, continuous driving (> 1.2 m/s), and off-road movement
//    - Warm sandy/earthy dust color (r: 218, g: 198, b: 165)
//    - Visible from chase camera, positioned behind rear wheels, rising and expanding
//
// 2. Tire Smoke & Drift Particles
//    - Triggered during cornering / lateral slip (> 2.8 m/s)
//    - Crisp tire smoke unlit spheres
//
// 3. Skid Mark Pool (48 pooled segments)
//    - Bounded circular buffer placed on road surface at wheel positions
//    - Dark rubber unlit quads, fade naturally and recycle
//
// 4. Visual Suspension & Body Lean (Visual-only response)
//    - Modifies visual child of Truck entity (zero collision / physics alteration)
//    - Smooth roll (±0.035 rad) and pitch bump (-0.025 rad) during hard cornering / bumps
//
// 5. Zero dynamic lighting overhead, 100% pooled, WebGL optimized
// =============================================================

// Maximum pool sizes (strictly bounded for mobile WebGL performance)
const MAX_SKID_SEGMENTS = 48;
const MAX_SMOKE_PARTICLES = 28;

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
let lastDustEmitTime = 0;

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
    world.transform.setWorldPosition(eid, { x: 0, y: -50, z: 0 });

    ecs.BoxGeometry.set(world, eid, {
      width: 0.22,
      height: 0.008,
      depth: 0.42,
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

  // 2. Initialize Dust & Tire Smoke Pool (Warm sandy dust & white smoke)
  for (let i = 0; i < MAX_SMOKE_PARTICLES; i++) {
    const eid = world.createEntity();
    world.transform.setWorldPosition(eid, { x: 0, y: -50, z: 0 });

    ecs.SphereGeometry.set(world, eid, {
      radius: 0.24,
    });

    // Alternate warm earthy dust and soft tire smoke
    if (i % 2 === 0) {
      ecs.UnlitMaterial.set(world, eid, {
        r: 218,
        g: 198,
        b: 165, // Warm African highland dust
      });
    } else {
      ecs.UnlitMaterial.set(world, eid, {
        r: 228,
        g: 232,
        b: 238, // Soft white/grey smoke
      });
    }

    smokePool.push({
      eid,
      active: false,
      age: 0,
      maxAge: 0.52,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0.6,
      vz: 0,
      baseScale: 0.24,
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
    y: y + 0.015,
    z,
  });

  world.transform.setWorldQuaternion(
    seg.eid,
    ecs.math.quat.yRadians(heading)
  );

  world.setScale(seg.eid, 1, 1, 1);
}

// -------------------------------------------------------------
// EMIT DUST / SMOKE PUFF
// -------------------------------------------------------------
function emitDustPuff(
  world: ecs.World,
  x: number,
  y: number,
  z: number,
  vx: number,
  vz: number,
  scaleMultiplier = 1.0
): void {
  if (smokePool.length === 0) return;

  const p = smokePool[nextSmokeIndex];
  nextSmokeIndex = (nextSmokeIndex + 1) % MAX_SMOKE_PARTICLES;

  p.active = true;
  p.age = 0;
  p.maxAge = 0.45 + Math.random() * 0.18;
  p.x = x + (Math.random() - 0.5) * 0.12;
  p.y = y + 0.10;
  p.z = z + (Math.random() - 0.5) * 0.12;
  p.vx = vx * 0.25 + (Math.random() - 0.5) * 0.5;
  p.vy = 0.55 + Math.random() * 0.45; // Upward buoyant rise
  p.vz = vz * 0.25 + (Math.random() - 0.5) * 0.5;
  p.baseScale = (0.22 + Math.random() * 0.08) * scaleMultiplier;

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
      const scaleX = Math.max(0.2, remainingLife);
      world.setScale(seg.eid, scaleX, 1, 1);
    }
  }

  // Update Dust / Smoke Puffs (expand, rise, and fade)
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

      // Grow puff initially then taper off at the end of lifetime
      const growth = progress < 0.7 ? (1.0 + progress * 1.5) : (2.05 * (1.0 - (progress - 0.7) / 0.3 * 0.5));
      const currentScale = Math.max(0.05, p.baseScale * growth);
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
// CORE UPDATE LOGIC (Ticked every frame)
// -------------------------------------------------------------
export function updateDrivingJuice(world: ecs.World): void {
  initializePools(world);

  const delta = Math.min(world.time.delta || 0.016, 0.05);
  const now = performance.now() * 0.001;

  // Update active particle and skid pools
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
  const throttle = gameData.input.throttle || 0;

  // Forward & Right normal vectors
  const forwardX = -Math.sin(heading);
  const forwardZ = -Math.cos(heading);
  const rightX = Math.cos(heading);
  const rightZ = -Math.sin(heading);

  // Rear wheel offsets relative to truck center:
  // ~0.65m behind center, ±0.34m lateral
  const rearDist = 0.65;
  const trackWidth = 0.34;

  const rearCenterX = truckPos.x - forwardX * rearDist;
  const rearCenterZ = truckPos.z - forwardZ * rearDist;

  // Left and right rear wheel world positions
  const leftWheelX = rearCenterX - rightX * trackWidth;
  const leftWheelZ = rearCenterZ - rightZ * trackWidth;
  const leftElevation = getCitySurfaceElevation(leftWheelX, leftWheelZ);

  const rightWheelX = rearCenterX + rightX * trackWidth;
  const rightWheelZ = rearCenterZ + rightZ * trackWidth;
  const rightElevation = getCitySurfaceElevation(rightWheelX, rightWheelZ);

  // ---------------------------------------------------------
  // 1. CORNERING SLIP & DRIFT SMOKE / SKID MARKS
  // ---------------------------------------------------------
  const isDrifting =
    absSpeed > 2.6 && (absLateral > 0.28 || (absSteer > 0.42 && absSpeed > 3.8));

  if (isDrifting) {
    // A. Emit Skid Marks (every 0.075s)
    if (now - lastSkidEmitTime > 0.075) {
      lastSkidEmitTime = now;
      emitSkidSegment(world, leftWheelX, leftElevation, leftWheelZ, heading);
      emitSkidSegment(world, rightWheelX, rightElevation, rightWheelZ, heading);
    }

    // B. Emit Tire Drift Smoke (every 0.08s)
    if (now - lastSmokeEmitTime > 0.08) {
      lastSmokeEmitTime = now;
      const slipSign = Math.sign(lateralVel || steerVal);
      const smokeVx = -forwardX * speed * 0.2 + rightX * slipSign * 0.7;
      const smokeVz = -forwardZ * speed * 0.2 + rightZ * slipSign * 0.7;

      emitDustPuff(world, leftWheelX, leftElevation, leftWheelZ, smokeVx, smokeVz, 1.25);
      emitDustPuff(world, rightWheelX, rightElevation, rightWheelZ, smokeVx, smokeVz, 1.25);
    }
  }

  // ---------------------------------------------------------
  // 2. DRIVING & ACCELERATION ROAD DUST PUFFS
  // ---------------------------------------------------------
  // Emit visible warm dust puffs when moving forward/backward or accelerating
  const isAccelerating = Math.abs(throttle) > 0.1 && absSpeed < 3.2;
  const isCruising = absSpeed > 1.2;

  if (isAccelerating || isCruising) {
    const dustInterval = isAccelerating ? 0.09 : 0.14;
    if (now - lastDustEmitTime > dustInterval) {
      lastDustEmitTime = now;
      const dustVx = -forwardX * speed * 0.35 + (Math.random() - 0.5) * 0.3;
      const dustVz = -forwardZ * speed * 0.35 + (Math.random() - 0.5) * 0.3;
      const dustScale = isAccelerating ? 1.15 : 0.95;

      emitDustPuff(world, leftWheelX, leftElevation, leftWheelZ, dustVx, dustVz, dustScale);
      emitDustPuff(world, rightWheelX, rightElevation, rightWheelZ, dustVx, dustVz, dustScale);
    }
  }

  // ---------------------------------------------------------
  // 3. VISUAL SUSPENSION & CHASSIS BODY LEAN
  // ---------------------------------------------------------
  const targetRoll = -steerVal * Math.min(1.0, absSpeed / 8.0) * 0.035;
  const targetPitch = throttle > 0.1 ? -0.018 : throttle < -0.1 ? 0.025 : 0;

  const springRate = 12.0; // 1/s
  const alpha = 1.0 - Math.exp(-springRate * delta);
  visualBodyRoll += (targetRoll - visualBodyRoll) * alpha;
  visualBodyPitch += (targetPitch - visualBodyPitch) * alpha;
}

// -------------------------------------------------------------
// ECS COMPONENT REGISTRATION
// -------------------------------------------------------------
ecs.registerComponent({
  name: "driving-juice-system",
  schema: {},

  tick: (world) => {
    updateDrivingJuice(world);
  },
});

