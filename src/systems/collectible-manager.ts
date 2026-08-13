import * as ecs from "@8thwall/ecs";

import { gameData } from "../core/game-data";
import { GameState } from "../core/game-state";
import { GAME_CONFIG } from "../core/constants";

import { collectible } from "../components/collectible";
import { addScore } from "./score-system";
import { spawnReplacementCollectible } from "./collectible-spawn-system";

import { playSound } from "./audio-system";

ecs.registerComponent({
  name: "collectible-manager",

  schema: {
    kitchenPrefab: ecs.eid,
  },

  tick: (world) => {
    // ==================================================
    // BASIC STATE CHECKS
    // ==================================================

    if (gameData.truckEid === null) {
      return;
    }

    if (gameData.state !== GameState.DRIVING) {
      return;
    }

    const truckPos = world.transform.getWorldPosition(gameData.truckEid);

    // ==================================================
    // FOOD COLLECTION
    // ==================================================

    for (let i = gameData.collectibleEids.length - 1; i >= 0; i--) {
      const itemEid = gameData.collectibleEids[i];

      // ------------------------------------------------
      // Remove invalid/deleted collectibles
      // ------------------------------------------------

      if (!collectible.has(world, itemEid)) {
        gameData.collectibleEids.splice(i, 1);

        continue;
      }

      const itemPos = world.transform.getWorldPosition(itemEid);

      // ------------------------------------------------
      // Ground-plane distance
      //
      // Ignore Y because this is tabletop driving.
      // ------------------------------------------------

      const dx = truckPos.x - itemPos.x;

      const dz = truckPos.z - itemPos.z;

      const distance = Math.sqrt(dx * dx + dz * dz);

      // ------------------------------------------------
      // Not close enough
      // ------------------------------------------------

      if (distance > GAME_CONFIG.COLLECTION_RADIUS) {
        continue;
      }

      const item = collectible.get(world, itemEid);

      // ==================================================
      // PICK UP FOOD
      // ==================================================

      gameData.cargo.push({
        type: item.type,
        value: item.value,
      });

      gameData.isCarrying = true;

      gameData.collectedCount++;

      // ------------------------------------------------
      // Pickup sound
      // ------------------------------------------------

      playSound("pickup");

      console.log("[PICKED UP]", {
        eid: itemEid,

        type: item.type,

        value: item.value,

        distance,

        cargoSize: gameData.cargo.length,
      });

      console.log(
        "[Food]",
        `${gameData.collectedCount}/${gameData.totalSpawned}`,
      );

      console.log("[Cargo]", gameData.cargo);

      // ------------------------------------------------
      // Remove food from world
      // ------------------------------------------------

      world.deleteEntity(itemEid);

      gameData.collectibleEids.splice(i, 1);
    }

    // ==================================================
    // DELIVERY CHECK
    // ==================================================

    if (!gameData.isCarrying || gameData.kitchenDropoffEid === null) {
      return;
    }

    const kitchenPos = world.transform.getWorldPosition(
      gameData.kitchenDropoffEid,
    );

    const dx = truckPos.x - kitchenPos.x;

    const dz = truckPos.z - kitchenPos.z;

    const distance = Math.sqrt(dx * dx + dz * dz);

    const DELIVERY_RADIUS = 0.5;

    if (distance > DELIVERY_RADIUS) {
      return;
    }

    // ==================================================
    // DELIVER ENTIRE CARGO
    // ==================================================

    let deliveryScore = 0;

    for (const cargoItem of gameData.cargo) {
      deliveryScore += cargoItem.value;
    }

    console.log("[DELIVERED]", {
      cargoCount: gameData.cargo.length,

      score: deliveryScore,

      distance,
    });

    // ------------------------------------------------
    // Award score
    // ------------------------------------------------

    addScore(deliveryScore);

    // ------------------------------------------------
    // Delivery sound
    //
    // One sound represents:
    // DELIVERY + SCORE

    // ------------------------------------------------

    playSound("delivery");

    // ------------------------------------------------
    // Spawn replacements
    // ------------------------------------------------

    const deliveredCount = gameData.cargo.length;

    for (let i = 0; i < deliveredCount; i++) {
      spawnReplacementCollectible(world);
    }

    // ------------------------------------------------
    // Clear cargo
    // ------------------------------------------------

    gameData.cargo.length = 0;

    gameData.isCarrying = false;

    console.log("[Cargo] Delivered and cleared");
  },
});
