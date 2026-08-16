import * as ecs from "@8thwall/ecs";

import { gameData } from "../core/game-data";
import { GameState } from "../core/game-state";
import { GAME_CONFIG } from "../core/constants";
import { trackEvent } from "../core/analytics";

import { collectible } from "../components/collectible";

import { addScore } from "./score-system";
import { spawnReplacementCollectible } from "./collectible-spawn-system";
import { playSound } from "./audio-system";

import { showDeliveryScore } from "../ui/hud";

// ==================================================
// CONSTANTS
// ==================================================

// Keep delivery radius outside tick() so it isn't
// recreated/recalculated during gameplay.
const DELIVERY_RADIUS = 0.5;
const DELIVERY_RADIUS_SQUARED = DELIVERY_RADIUS * DELIVERY_RADIUS;

// ==================================================
// ECS COMPONENT
// ==================================================

ecs.registerComponent({
  name: "collectible-manager",

  schema: {
    kitchenPrefab: ecs.eid,
  },

  tick: (world) => {
    // ==================================================
    // GAME STATE
    // ==================================================

    if (gameData.state !== GameState.DRIVING || gameData.truckEid === null) {
      return;
    }

    // ==================================================
    // TRUCK POSITION
    // ==================================================

    const truckEid = gameData.truckEid;

    const truckPos = world.transform.getWorldPosition(truckEid);

    const truckX = truckPos.x;
    const truckZ = truckPos.z;

    // ==================================================
    // COLLECTION RADIUS
    //
    // Squared distance avoids Math.sqrt().
    // ==================================================

    const collectionRadius = GAME_CONFIG.COLLECTION_RADIUS;

    const collectionRadiusSquared = collectionRadius * collectionRadius;

    // ==================================================
    // FOOD COLLECTION
    // ==================================================

    const collectibles = gameData.collectibleEids;

    for (let i = collectibles.length - 1; i >= 0; i--) {
      const itemEid = collectibles[i];

      // ------------------------------------------------
      // Remove invalid/deleted entities
      // ------------------------------------------------

      if (!collectible.has(world, itemEid)) {
        collectibles.splice(i, 1);
        continue;
      }

      // ------------------------------------------------
      // Get food position
      // ------------------------------------------------

      const itemPos = world.transform.getWorldPosition(itemEid);

      const dx = truckX - itemPos.x;

      const dz = truckZ - itemPos.z;

      const distanceSquared = dx * dx + dz * dz;

      // ------------------------------------------------
      // Not close enough
      // ------------------------------------------------

      if (distanceSquared > collectionRadiusSquared) {
        continue;
      }

      // ==================================================
      // PICK UP FOOD
      // ==================================================

      const item = collectible.get(world, itemEid);

      // ------------------------------------------------
      // Add to cargo
      // ------------------------------------------------

      gameData.cargo.push({
        type: item.type,
        value: item.value,
      });

      gameData.isCarrying = true;
      gameData.collectedCount++;

      // ------------------------------------------------
      // Analytics
      //
      // Only called when an item is actually collected.
      // Never runs every frame.
      // ------------------------------------------------

      trackEvent("collectible_collected", {
        type: item.type,
        value: item.value,
        collectedCount: gameData.collectedCount,
      });

      // ------------------------------------------------
      // Sound
      // ------------------------------------------------

      playSound("pickup");

      // ------------------------------------------------
      // Remove food
      // ------------------------------------------------

      world.deleteEntity(itemEid);

      collectibles.splice(i, 1);
    }

    // ==================================================
    // DELIVERY CHECK
    // ==================================================

    if (!gameData.isCarrying || gameData.kitchenDropoffEid === null) {
      return;
    }

    // --------------------------------------------------
    // Kitchen position
    // --------------------------------------------------

    const kitchenPos = world.transform.getWorldPosition(
      gameData.kitchenDropoffEid,
    );

    const deliveryDx = truckX - kitchenPos.x;

    const deliveryDz = truckZ - kitchenPos.z;

    const deliveryDistanceSquared =
      deliveryDx * deliveryDx + deliveryDz * deliveryDz;

    // --------------------------------------------------
    // Not inside delivery zone
    // --------------------------------------------------

    if (deliveryDistanceSquared > DELIVERY_RADIUS_SQUARED) {
      return;
    }

    // ==================================================
    // DELIVER CARGO
    // ==================================================

    const cargo = gameData.cargo;

    const cargoCount = cargo.length;

    // Safety check
    if (cargoCount === 0) {
      gameData.isCarrying = false;
      return;
    }

    // --------------------------------------------------
    // Calculate score
    // --------------------------------------------------

    let deliveryScore = 0;

    for (let i = 0; i < cargoCount; i++) {
      deliveryScore += cargo[i].value;
    }

    // --------------------------------------------------
    // Analytics
    //
    // Called once per delivery.
    // --------------------------------------------------

    trackEvent("delivery_completed", {
      items: cargoCount,
      score: deliveryScore,
    });

    // ==================================================
    // SCORE
    // ==================================================

    addScore(deliveryScore);

    showDeliveryScore(deliveryScore);

    playSound("delivery");

    // ==================================================
    // SPAWN REPLACEMENTS
    // ==================================================

    for (let i = 0; i < cargoCount; i++) {
      spawnReplacementCollectible(world);
    }

    // ==================================================
    // CLEAR CARGO
    // ==================================================

    cargo.length = 0;

    gameData.isCarrying = false;
  },
});
