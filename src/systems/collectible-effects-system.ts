import * as ecs from "@8thwall/ecs";

import { gameData } from "../core/game-data";
import { collectible } from "../components/collectible";

// ==================================================
// TYPES
// ==================================================

interface BurstParticle {
  eid: ecs.Eid;

  startX: number;
  startY: number;
  startZ: number;

  velocityX: number;
  velocityY: number;
  velocityZ: number;

  startTime: number;
  duration: number;

  rotationSpeed: number;
}

// ==================================================
// FOOD ANIMATION
// ==================================================

interface FoodAnimation {
  baseY: number;
  phase: number;
  bounceSpeed: number;
  bounceAmount: number;
  rotationSpeed: number;
}

const foodAnimations = new Map<ecs.Eid, FoodAnimation>();

// ==================================================
// PICKUP PARTICLES
// ==================================================

const pickupParticles: BurstParticle[] = [];

// ==================================================
// DELIVERY PARTICLES
// ==================================================

const deliveryParticles: BurstParticle[] = [];

// ==================================================
// HELPERS
// ==================================================

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

// ==================================================
// PICKUP EFFECT
// ==================================================

export function playCollectEffect(
  world: ecs.World,
  diamondPrefab: ecs.Eid,
  position: {
    x: number;
    y: number;
    z: number;
  },
) {
  const now = performance.now() * 0.001;

  const PARTICLE_COUNT = 8;

  const PARTICLE_SIZE = 0.1;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + randomRange(-0.25, 0.25);

    const speed = randomRange(0.35, 0.65);

    const diamond = world.createEntity(diamondPrefab);

    // ----------------------------------------------
    // Position
    // ----------------------------------------------

    ecs.Position.set(world, diamond, {
      x: position.x,
      y: position.y + 0.03,
      z: position.z,
    });

    // ----------------------------------------------
    // Scale
    // ----------------------------------------------

    ecs.Scale.set(world, diamond, {
      x: PARTICLE_SIZE,
      y: PARTICLE_SIZE,
      z: PARTICLE_SIZE,
    });

    pickupParticles.push({
      eid: diamond,

      startX: position.x,
      startY: position.y + 0.03,
      startZ: position.z,

      velocityX: Math.cos(angle) * speed,

      velocityY: randomRange(0.2, 0.45),

      velocityZ: Math.sin(angle) * speed,

      startTime: now,

      duration: 0.6,

      rotationSpeed: randomRange(5, 10),
    });
  }
}

// ==================================================
// DELIVERY EFFECT
// ==================================================

export function playDeliveryEffect(
  world: ecs.World,
  diamondPrefab: ecs.Eid,
  position: {
    x: number;
    y: number;
    z: number;
  },
) {
  const now = performance.now() * 0.001;

  const PARTICLE_COUNT = 14;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;

    const speed = randomRange(0.5, 1.0);

    const diamond = world.createEntity(diamondPrefab);

    // ----------------------------------------------
    // Position
    // ----------------------------------------------

    ecs.Position.set(world, diamond, {
      x: position.x,
      y: position.y + 0.05,
      z: position.z,
    });

    // ----------------------------------------------
    // Larger delivery diamonds
    // ----------------------------------------------

    const size = randomRange(0.18, 0.28);

    ecs.Scale.set(world, diamond, {
      x: size,
      y: size,
      z: size,
    });

    deliveryParticles.push({
      eid: diamond,

      startX: position.x,
      startY: position.y + 0.05,
      startZ: position.z,

      velocityX: Math.cos(angle) * speed,

      velocityY: randomRange(0.7, 1.15),

      velocityZ: Math.sin(angle) * speed,

      startTime: now,

      duration: randomRange(0.8, 1.05),

      rotationSpeed: randomRange(5, 13),
    });
  }
}

// ==================================================
// ECS COMPONENT
// ==================================================

ecs.registerComponent({
  name: "collectible-effects-system",

  schema: {},

  tick: (world) => {
    const time = performance.now() * 0.001;

    // ==================================================
    // FOOD BOUNCE + ROTATION
    // ==================================================

    for (const eid of gameData.collectibleEids) {
      if (!collectible.has(world, eid)) {
        foodAnimations.delete(eid);

        continue;
      }

      let animation = foodAnimations.get(eid);

      // ----------------------------------------------
      // Initialize animation
      // ----------------------------------------------

      if (!animation) {
        const position = world.transform.getWorldPosition(eid);

        animation = {
          baseY: position.y,

          phase: Math.random() * Math.PI * 2,

          bounceSpeed: randomRange(1.5, 2.0),

          bounceAmount: randomRange(0.025, 0.045),

          rotationSpeed: randomRange(0.35, 0.8),
        };

        foodAnimations.set(eid, animation);
      }

      // ----------------------------------------------
      // Bounce
      // ----------------------------------------------

      const bounce =
        Math.sin(time * animation.bounceSpeed + animation.phase) *
        animation.bounceAmount;

      const position = world.transform.getWorldPosition(eid);

      ecs.Position.set(world, eid, {
        x: position.x,
        y: animation.baseY + bounce,
        z: position.z,
      });

      // ----------------------------------------------
      // Rotation
      // ----------------------------------------------

      ecs.Quaternion.set(
        world,
        eid,
        ecs.math.quat.yRadians(time * animation.rotationSpeed),
      );
    }

    // ==================================================
    // PICKUP PARTICLES
    // ==================================================

    for (let i = pickupParticles.length - 1; i >= 0; i--) {
      const particle = pickupParticles[i];

      const elapsed = time - particle.startTime;

      const progress = elapsed / particle.duration;

      // ----------------------------------------------
      // Finished
      // ----------------------------------------------

      if (progress >= 1) {
        world.deleteEntity(particle.eid);

        pickupParticles.splice(i, 1);

        continue;
      }

      // ----------------------------------------------
      // Movement
      // ----------------------------------------------

      const x = particle.startX + particle.velocityX * elapsed;

      const z = particle.startZ + particle.velocityZ * elapsed;

      const y =
        particle.startY +
        particle.velocityY * elapsed -
        0.55 * elapsed * elapsed;

      ecs.Position.set(world, particle.eid, {
        x,
        y,
        z,
      });

      // ----------------------------------------------
      // Pop + shrink
      // ----------------------------------------------

      let scale = 0.18;

      if (progress < 0.15) {
        const popProgress = progress / 0.15;

        scale = 0.18 + 0.18 * popProgress;
      } else {
        const shrinkProgress = (progress - 0.15) / 0.85;

        scale = 0.36 * (1 - shrinkProgress);
      }

      ecs.Scale.set(world, particle.eid, {
        x: scale,
        y: scale,
        z: scale,
      });

      // ----------------------------------------------
      // Spin
      // ----------------------------------------------

      ecs.Quaternion.set(
        world,
        particle.eid,
        ecs.math.quat.yRadians(elapsed * particle.rotationSpeed),
      );
    }

    // ==================================================
    // DELIVERY PARTICLES
    // ==================================================

    for (let i = deliveryParticles.length - 1; i >= 0; i--) {
      const particle = deliveryParticles[i];

      const elapsed = time - particle.startTime;

      const progress = elapsed / particle.duration;

      // ----------------------------------------------
      // Finished
      // ----------------------------------------------

      if (progress >= 1) {
        world.deleteEntity(particle.eid);

        deliveryParticles.splice(i, 1);

        continue;
      }

      // ----------------------------------------------
      // Outward movement
      // ----------------------------------------------

      const x = particle.startX + particle.velocityX * elapsed;

      const z = particle.startZ + particle.velocityZ * elapsed;

      // ----------------------------------------------
      // Upward arc
      // ----------------------------------------------

      const y =
        particle.startY +
        particle.velocityY * elapsed -
        0.55 * elapsed * elapsed;

      ecs.Position.set(world, particle.eid, {
        x,
        y,
        z,
      });

      // ----------------------------------------------
      // Shrink
      // ----------------------------------------------

      const scale = 0.22 * (1 - progress);

      ecs.Scale.set(world, particle.eid, {
        x: scale,
        y: scale,
        z: scale,
      });

      // ----------------------------------------------
      // Spin
      // ----------------------------------------------

      ecs.Quaternion.set(
        world,
        particle.eid,
        ecs.math.quat.yRadians(elapsed * particle.rotationSpeed),
      );
    }
  },
});
