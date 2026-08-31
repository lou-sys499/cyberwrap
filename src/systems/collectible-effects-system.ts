import * as ecs from "@8thwall/ecs";

import { gameData } from "../core/game-data";
import { collectible } from "../components/collectible";

// ==================================================
// FOOD IDLE ANIMATION
//
// Lightweight visual animation only.
//
// KEEP:
// - Floating / bobbing
// - Slow rotation
//
// REMOVED:
// - Pickup particles
// - Delivery particles
// - Diamond entities
// - Particle physics
// - Particle scaling
// - Particle cleanup
//
// This keeps the food visually alive while reducing
// the amount of work performed on mobile WebGL.
// ==================================================

// ==================================================
// TYPES
// ==================================================

interface FoodAnimation {
  baseX: number;
  baseY: number;
  baseZ: number;

  phase: number;

  bounceSpeed: number;
  bounceAmount: number;

  rotationSpeed: number;
}

// ==================================================
// ANIMATION DATA
// ==================================================

const foodAnimations = new Map<ecs.Eid, FoodAnimation>();

// ==================================================
// HELPERS
// ==================================================

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// ==================================================
// ECS COMPONENT
// ==================================================

ecs.registerComponent({
  name: "collectible-effects-system",

  schema: {},

  tick: (world) => {
    const time = performance.now() * 0.001;

    // ------------------------------------------------
    // FOOD BOUNCE + ROTATION
    // ------------------------------------------------

    for (const eid of gameData.collectibleEids) {
      // ------------------------------------------------
      // Remove animation data for deleted collectibles
      // ------------------------------------------------

      if (!collectible.has(world, eid)) {
        foodAnimations.delete(eid);

        continue;
      }

      // ------------------------------------------------
      // Get or create animation data
      // ------------------------------------------------

      let animation = foodAnimations.get(eid);

      if (!animation) {
        const position = world.transform.getWorldPosition(eid);

        animation = {
          baseX: position.x,
          baseY: Math.max(0.45, position.y),
          baseZ: position.z,

          phase: Math.random() * Math.PI * 2,

          bounceSpeed: randomRange(2.0, 3.0),

          bounceAmount: randomRange(0.08, 0.14),

          rotationSpeed: randomRange(1.2, 2.0),
        };

        foodAnimations.set(eid, animation);
      }

      // ------------------------------------------------
      // FLOAT / BOUNCE
      // ------------------------------------------------

      const bounce =
        Math.sin(time * animation.bounceSpeed + animation.phase) *
        animation.bounceAmount;

      world.transform.setWorldPosition(eid, {
        x: animation.baseX,
        y: animation.baseY + bounce,
        z: animation.baseZ,
      });

      // ------------------------------------------------
      // ROTATION
      // ------------------------------------------------

      world.transform.setWorldQuaternion(
        eid,
        ecs.math.quat.yRadians(time * animation.rotationSpeed),
      );
    }
  },
});
