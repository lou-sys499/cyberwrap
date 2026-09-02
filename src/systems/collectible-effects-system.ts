import * as ecs from "@8thwall/ecs";

import { gameData } from "../core/game-data";
import { collectible } from "../components/collectible";

// ==================================================
// FOOD IDLE ANIMATION & PULSING GLOW & PICKUP BURST SYSTEM
//
// Responsibilities:
// 1. Smooth floating / bobbing & continuous rotation of food collectibles
// 2. Subtle pulsing golden-cyan beacon halo ring under each food item
// 3. Pooled 3D sparkle bursts on item collection (gold & cyan particles)
// 4. Pooled celebratory delivery fireworks bursts at DailyBread Shawarma hub
// 5. Zero dynamic lighting overhead, fully optimized for WebGL.
// ==================================================

interface FoodAnimation {
  baseX: number;
  baseY: number;
  baseZ: number;
  phase: number;
  bounceSpeed: number;
  bounceAmount: number;
  rotationSpeed: number;
  haloEid: ecs.Eid;
  outerRingEid: ecs.Eid;
}

interface SparkleParticle {
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

const foodAnimations = new Map<ecs.Eid, FoodAnimation>();

// Sparkle Particle Pool (strictly bounded 32 particles)
const MAX_SPARKLES = 32;
const sparklePool: SparkleParticle[] = [];
let nextSparkleIndex = 0;
let sparklesInitialized = false;

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// Initialize Sparkle Pool
function initSparklePool(world: ecs.World): void {
  if (sparklesInitialized) return;

  for (let i = 0; i < MAX_SPARKLES; i++) {
    const eid = world.createEntity();
    world.transform.setWorldPosition(eid, { x: 0, y: -50, z: 0 });

    ecs.SphereGeometry.set(world, eid, { radius: 0.08 });
    // Alternate gold and cyan particles
    if (i % 2 === 0) {
      ecs.UnlitMaterial.set(world, eid, { r: 255, g: 215, b: 0 }); // Cyber Gold
    } else {
      ecs.UnlitMaterial.set(world, eid, { r: 0, g: 240, b: 255 }); // Bright Cyan
    }

    sparklePool.push({
      eid,
      active: false,
      age: 0,
      maxAge: 0.35,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      baseScale: 0.08,
    });
  }

  sparklesInitialized = true;
}

// --------------------------------------------------
// TRIGGER PICKUP SPARKLE BURST
// --------------------------------------------------
export function triggerPickupSparkleBurst(
  world: ecs.World,
  x: number,
  y: number,
  z: number
): void {
  initSparklePool(world);

  const count = 10;
  for (let i = 0; i < count; i++) {
    const p = sparklePool[nextSparkleIndex];
    nextSparkleIndex = (nextSparkleIndex + 1) % MAX_SPARKLES;

    p.active = true;
    p.age = 0;
    p.maxAge = 0.32 + Math.random() * 0.12;
    p.x = x;
    p.y = y + 0.15;
    p.z = z;

    const angle = Math.random() * Math.PI * 2;
    const speed = 2.2 + Math.random() * 1.8;
    p.vx = Math.cos(angle) * speed;
    p.vy = 2.0 + Math.random() * 2.5; // Upward explosion
    p.vz = Math.sin(angle) * speed;
    p.baseScale = 0.09 + Math.random() * 0.05;

    world.transform.setWorldPosition(p.eid, { x: p.x, y: p.y, z: p.z });
    world.setScale(p.eid, p.baseScale, p.baseScale, p.baseScale);
  }
}

// --------------------------------------------------
// TRIGGER DELIVERY CELEBRATION BURST
// --------------------------------------------------
export function triggerDeliveryCelebrationBurst(
  world: ecs.World,
  x: number,
  y: number,
  z: number
): void {
  initSparklePool(world);

  const count = 20;
  for (let i = 0; i < count; i++) {
    const p = sparklePool[nextSparkleIndex];
    nextSparkleIndex = (nextSparkleIndex + 1) % MAX_SPARKLES;

    p.active = true;
    p.age = 0;
    p.maxAge = 0.55 + Math.random() * 0.25;
    p.x = x + (Math.random() - 0.5) * 1.5;
    p.y = y + 0.2;
    p.z = z + (Math.random() - 0.5) * 1.5;

    const angle = Math.random() * Math.PI * 2;
    const speed = 2.5 + Math.random() * 2.5;
    p.vx = Math.cos(angle) * speed;
    p.vy = 3.5 + Math.random() * 3.5;
    p.vz = Math.sin(angle) * speed;
    p.baseScale = 0.12 + Math.random() * 0.06;

    world.transform.setWorldPosition(p.eid, { x: p.x, y: p.y, z: p.z });
    world.setScale(p.eid, p.baseScale, p.baseScale, p.baseScale);
  }
}

// --------------------------------------------------
// ECS COMPONENT
// --------------------------------------------------
ecs.registerComponent({
  name: "collectible-effects-system",

  schema: {},

  tick: (world) => {
    initSparklePool(world);

    const delta = Math.min(world.time.delta || 0.016, 0.05);
    const time = performance.now() * 0.001;

    // ------------------------------------------------
    // 1. UPDATE SPARKLE PARTICLES
    // ------------------------------------------------
    for (let i = 0; i < sparklePool.length; i++) {
      const p = sparklePool[i];
      if (!p.active) continue;

      p.age += delta;
      if (p.age >= p.maxAge) {
        p.active = false;
        world.transform.setWorldPosition(p.eid, { x: 0, y: -50, z: 0 });
      } else {
        const progress = p.age / p.maxAge;
        p.vy -= 9.8 * delta; // Gravity
        p.x += p.vx * delta;
        p.y += p.vy * delta;
        p.z += p.vz * delta;

        world.transform.setWorldPosition(p.eid, { x: p.x, y: p.y, z: p.z });

        // Shrink particle as it fades
        const scale = p.baseScale * (1.0 - progress);
        world.setScale(p.eid, scale, scale, scale);
      }
    }

    // ------------------------------------------------
    // 2. FOOD BOUNCE + ROTATION + PULSING GLOW
    // ------------------------------------------------
    for (const eid of gameData.collectibleEids) {
      if (!collectible.has(world, eid)) {
        const anim = foodAnimations.get(eid);
        if (anim) {
          if (anim.haloEid) {
            try { world.deleteEntity(anim.haloEid); } catch {}
          }
          if (anim.outerRingEid) {
            try { world.deleteEntity(anim.outerRingEid); } catch {}
          }
          foodAnimations.delete(eid);
        }
        continue;
      }

      let animation = foodAnimations.get(eid);

      if (!animation) {
        const position = world.transform.getWorldPosition(eid);

        // 1. Inner Golden Glowing Disc
        const halo = world.createEntity();
        world.setParent(halo, eid);
        world.setPosition(halo, 0, -0.32, 0);
        ecs.CylinderGeometry.set(world, halo, {
          radius: 0.62,
          height: 0.03,
        });
        ecs.UnlitMaterial.set(world, halo, {
          r: 255,
          g: 215,
          b: 0, // Cyber Gold
        });

        // 2. Outer Cyan Accent Ring
        const outerRing = world.createEntity();
        world.setParent(outerRing, eid);
        world.setPosition(outerRing, 0, -0.34, 0);
        ecs.CylinderGeometry.set(world, outerRing, {
          radius: 0.88,
          height: 0.015,
        });
        ecs.UnlitMaterial.set(world, outerRing, {
          r: 0,
          g: 240,
          b: 255, // Cyan accent
        });

        animation = {
          baseX: position.x,
          baseY: Math.max(0.45, position.y),
          baseZ: position.z,
          phase: Math.random() * Math.PI * 2,
          bounceSpeed: randomRange(2.0, 3.0),
          bounceAmount: randomRange(0.08, 0.14),
          rotationSpeed: randomRange(1.2, 2.0),
          haloEid: halo,
          outerRingEid: outerRing,
        };

        foodAnimations.set(eid, animation);
      }

      const bounce =
        Math.sin(time * animation.bounceSpeed + animation.phase) *
        animation.bounceAmount;

      world.transform.setWorldPosition(eid, {
        x: animation.baseX,
        y: animation.baseY + bounce,
        z: animation.baseZ,
      });

      world.transform.setWorldQuaternion(
        eid,
        ecs.math.quat.yRadians(time * animation.rotationSpeed),
      );

      const innerYOffset = -0.32 - bounce * 0.35;
      const outerYOffset = -0.34 - bounce * 0.35;

      world.setPosition(animation.haloEid, 0, innerYOffset, 0);
      world.setPosition(animation.outerRingEid, 0, outerYOffset, 0);
    }
  },
});
