import * as ecs from "@8thwall/ecs";

import { gameData } from "../core/game-data";
import { GameState } from "../core/game-state";
import { GAME_CONFIG } from "../core/constants";

import { collectible } from "../components/collectible";
import { addScore } from "./score-system";
import { spawnReplacementCollectible } from "./collectible-spawn-system";

import { playSound } from "./audio-system";
import { showDeliveryScore } from "../ui/hud";

import { trackEvent } from "../core/analytics";

ecs.registerComponent({
  name: "collectible-manager",

  schema: {
    kitchenPrefab: ecs.eid,
    diamondPrefab: ecs.eid,
  },

  tick: (world, component) => {
    // --------------------------------------------------
    // Only run during active gameplay
    // --------------------------------------------------

    if (gameData.state !== GameState.DRIVING || gameData.truckEid === null) {
      return;
    }

    const truckEid = gameData.truckEid;

    const truckPos = world.transform.getWorldPosition(truckEid);

    // --------------------------------------------------
    // Collection radius
    // Avoid Math.sqrt() every frame.
    // --------------------------------------------------

    const collectionRadius = GAME_CONFIG.COLLECTION_RADIUS;

    const collectionRadiusSquared = collectionRadius * collectionRadius;

    // --------------------------------------------------
    // FOOD COLLECTION
    // --------------------------------------------------

    for (let i = gameData.collectibleEids.length - 1; i >= 0; i--) {
      const itemEid = gameData.collectibleEids[i];

      // Remove invalid entities
      if (!collectible.has(world, itemEid)) {
        gameData.collectibleEids.splice(i, 1);
        continue;
      }

      const itemPos = world.transform.getWorldPosition(itemEid);

      const dx = truckPos.x - itemPos.x;

      const dz = truckPos.z - itemPos.z;

      const distanceSquared = dx * dx + dz * dz;

      // Not close enough
      if (distanceSquared > collectionRadiusSquared) {
        continue;
      }

      // ------------------------------------------------
      // PICK UP FOOD
      // ------------------------------------------------

      const item = collectible.get(world, itemEid);

      gameData.cargo.push({
        type: item.type,
        value: item.value,
      });

      gameData.isCarrying = true;
      gameData.collectedCount++;

      trackEvent("collectible_collected", {
        type: item.type,
        value: item.value,
        collectedCount: gameData.collectedCount,
      });

      playSound("pickup");

      // ------------------------------------------------
      // Remove collectible
      // ------------------------------------------------

      world.deleteEntity(itemEid);

      gameData.collectibleEids.splice(i, 1);
    }

    // --------------------------------------------------
    // DELIVERY CHECK
    // --------------------------------------------------

    if (!gameData.isCarrying || gameData.kitchenDropoffEid === null) {
      return;
    }

    const kitchenPos = world.transform.getWorldPosition(
      gameData.kitchenDropoffEid,
    );

    const deliveryDx = truckPos.x - kitchenPos.x;

    const deliveryDz = truckPos.z - kitchenPos.z;

    const DELIVERY_RADIUS = 0.5;

    const deliveryRadiusSquared = DELIVERY_RADIUS * DELIVERY_RADIUS;

    const deliveryDistanceSquared =
      deliveryDx * deliveryDx + deliveryDz * deliveryDz;

    if (deliveryDistanceSquared > deliveryRadiusSquared) {
      return;
    }

    // --------------------------------------------------
    // DELIVER CARGO
    // --------------------------------------------------

    let deliveryScore = 0;

    for (const cargoItem of gameData.cargo) {
      deliveryScore += cargoItem.value;
    }

    trackEvent("delivery_completed", {
      items: gameData.cargo.length,
      score: deliveryScore,
    });

    // --------------------------------------------------
    // SCORE
    // --------------------------------------------------

    addScore(deliveryScore);

    showDeliveryScore(deliveryScore);

    playSound("delivery");

    // --------------------------------------------------
    // SPAWN REPLACEMENTS
    // --------------------------------------------------

    const deliveredCount = gameData.cargo.length;

    for (let i = 0; i < deliveredCount; i++) {
      spawnReplacementCollectible(world);
    }

    // --------------------------------------------------
    // CLEAR CARGO
    // --------------------------------------------------

    gameData.cargo.length = 0;
    gameData.isCarrying = false;
  },
});
