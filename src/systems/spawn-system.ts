import * as ecs from "@8thwall/ecs";

import { gameData } from "../core/game-data";
import { OBJECT_PLACED_EVENT } from "./placement-system";
import { PLAYER_SPAWN_LOCATION, SHAWARMA_HUB_LOCATION } from "../world/city-config";
import { recordFakoLifecycleEvent } from "../core/diagnostics";
import { ENTITY_TELEPORTED_EVENT } from "./smooth-orbit-camera";

// --------------------------------------------------
// Spawn System
//
// Responsibilities:
// - Listen for DriveZone placement
// - Find TruckSpawnPoint
// - Find KitchenDropoff / Delivery Zone
// - Spawn truck
// - Spawn Kitchen / Delivery visual
// - Position Kitchen at Delivery Zone
// - Lock truck initial heading
// --------------------------------------------------

ecs.registerComponent({
  name: "spawn-system",

  schema: {
    // --------------------------------------------------
    // Truck prefab assigned in Inspector
    // --------------------------------------------------

    truckPrefab: ecs.eid,

    // --------------------------------------------------
    // TruckSpawnPoint inside DriveZonePrefab
    // --------------------------------------------------

    truckSpawnPoint: ecs.eid,

    // --------------------------------------------------
    // KitchenDropoff / Delivery Zone marker
    // inside DriveZonePrefab
    // --------------------------------------------------

    kitchenDropoff: ecs.eid,

    // --------------------------------------------------
    // Kitchen / Delivery visual prefab
    // assigned in Inspector
    // --------------------------------------------------

    kitchenPrefab: ecs.eid,
  },

  stateMachine: ({ world, eid, schemaAttribute, defineState }) => {
    defineState("ready")
      .initial()

      .onEnter(() => {
        world.events.addListener(
          world.events.globalId,
          OBJECT_PLACED_EVENT,
          () => {
            const schema = schemaAttribute.get(eid);

            spawnObjects(world, schema);
          },
        );
      });
  },
});

// ==================================================
// Spawn Truck + Kitchen / Delivery Visual
// ==================================================

function spawnObjects(world: ecs.World, schema: any) {
  // ==================================================
  // MAKE SURE DRIVEZONE EXISTS
  // ==================================================

  if (gameData.driveZoneEid === null || gameData.driveZoneEid === 0n) {
    console.error("[Spawn] No DriveZone");

    return;
  }

  // ==================================================
  // VALIDATE REFERENCES
  // ==================================================

  if (!schema.truckSpawnPoint || schema.truckSpawnPoint === 0n) {
    console.error("[Spawn] TruckSpawnPoint is NOT assigned in Inspector");

    return;
  }

  if (!schema.kitchenDropoff || schema.kitchenDropoff === 0n) {
    console.error(
      "[Spawn] KitchenDropoff / Delivery Zone is NOT assigned in Inspector",
    );

    return;
  }

  if (!schema.truckPrefab || schema.truckPrefab === 0n) {
    console.error("[Spawn] TruckPrefab is NOT assigned in Inspector");

    return;
  }

  if (!schema.kitchenPrefab || schema.kitchenPrefab === 0n) {
    console.error(
      "[Spawn] Kitchen / Delivery prefab is NOT assigned in Inspector",
    );

    return;
  }

  // ==================================================
  // FIND RUNTIME TRUCK SPAWN POINT
  // ==================================================

  let runtimeSpawnPoint: ecs.Eid | null = null;
  if (schema.truckSpawnPoint) {
    try {
      runtimeSpawnPoint = world.getInstanceEntity(
        gameData.driveZoneEid,
        schema.truckSpawnPoint,
      );
    } catch {
      runtimeSpawnPoint = null;
    }
  }

  if (!runtimeSpawnPoint) {
    runtimeSpawnPoint = world.createEntity();
    world.setParent(runtimeSpawnPoint, gameData.driveZoneEid);
  }

  // ==================================================
  // FIND RUNTIME DELIVERY ZONE
  // ==================================================

  let runtimeKitchenDropoff: ecs.Eid | null = null;
  if (schema.kitchenDropoff) {
    try {
      runtimeKitchenDropoff = world.getInstanceEntity(
        gameData.driveZoneEid,
        schema.kitchenDropoff,
      );
    } catch {
      runtimeKitchenDropoff = null;
    }
  }

  if (!runtimeKitchenDropoff) {
    runtimeKitchenDropoff = world.createEntity();
    world.setParent(runtimeKitchenDropoff, gameData.driveZoneEid);
  }

  // Position Dropoff entity to match city Shawarma Hub
  world.transform.setWorldPosition(runtimeKitchenDropoff, {
    x: SHAWARMA_HUB_LOCATION.deliveryZone.x,
    y: SHAWARMA_HUB_LOCATION.deliveryZone.y,
    z: SHAWARMA_HUB_LOCATION.deliveryZone.z,
  });

  // Position Truck Spawn Point to match city Player Spawn
  world.transform.setWorldPosition(runtimeSpawnPoint, {
    x: PLAYER_SPAWN_LOCATION.x,
    y: PLAYER_SPAWN_LOCATION.y,
    z: PLAYER_SPAWN_LOCATION.z,
  });

  // ==================================================
  // STORE DELIVERY ZONE
  // ==================================================

  gameData.kitchenDropoffEid = runtimeKitchenDropoff;

  // ==================================================
  // SPAWN KITCHEN / DELIVERY VISUAL
  // ==================================================

  if (!gameData.kitchenSpawned) {
    spawnKitchen(world, schema.kitchenPrefab, runtimeKitchenDropoff);
  } else {
  }

  // ==================================================
  // SPAWN TRUCK
  // ==================================================

  if (!gameData.truckPlaced) {
    spawnTruck(world, schema.truckPrefab, runtimeSpawnPoint);
  } else {
  }
}

// ==================================================
// Spawn Kitchen / Delivery Visual
// ==================================================

function spawnKitchen(
  world: ecs.World,
  kitchenPrefab: ecs.Eid,
  runtimeKitchenDropoff: ecs.Eid,
) {
  // --------------------------------------------------
  // Create visual
  // --------------------------------------------------

  const kitchen = world.createEntity(kitchenPrefab);

  // --------------------------------------------------
  // Get Delivery Zone world position
  // --------------------------------------------------

  const position = SHAWARMA_HUB_LOCATION.deliveryZone;

  // --------------------------------------------------
  // Position visual
  // --------------------------------------------------

  world.transform.setWorldPosition(kitchen, {
    x: position.x,
    y: position.y,
    z: position.z,
  });

  // --------------------------------------------------
  // Store Kitchen / Delivery state
  // --------------------------------------------------

  gameData.kitchenEid = kitchen;

  gameData.kitchenSpawned = true;
}

// ==================================================
// Spawn Truck
// ==================================================

function spawnTruck(
  world: ecs.World,
  truckPrefab: ecs.Eid,
  runtimeSpawnPoint: ecs.Eid,
) {
  recordFakoLifecycleEvent("truckSpawnCount");
  // --------------------------------------------------
  // Destroy old truck entity if one already exists
  // --------------------------------------------------
  if (gameData.truckEid !== null && gameData.truckEid !== 0n) {
    try {
      world.deleteEntity(gameData.truckEid);
    } catch {
      // Safe fallback if already deleted
    }
    gameData.truckEid = null;
  }

  // --------------------------------------------------
  // Create truck
  // --------------------------------------------------

  const truck = world.createEntity(truckPrefab);

  // --------------------------------------------------
  // Get spawn position
  // --------------------------------------------------

  const position = PLAYER_SPAWN_LOCATION;

  // --------------------------------------------------
  // Position truck
  // --------------------------------------------------

  world.transform.setWorldPosition(truck, {
    x: position.x,
    y: position.y,
    z: position.z,
  });

  // --------------------------------------------------
  // Apply initial truck heading (Facing North)
  // --------------------------------------------------

  const heading = PLAYER_SPAWN_LOCATION.heading;
  world.transform.setWorldQuaternion(truck, ecs.math.quat.yRadians(heading + Math.PI / 2));

  // --------------------------------------------------
  // Store truck state
  // --------------------------------------------------

  gameData.truckEid = truck;

  gameData.truckPlaced = true;

  gameData.truckSpeed = 0;

  // --------------------------------------------------
  // Lock initial vehicle direction
  // (Camera initialization is owned exclusively by camera-follow-system)
  // --------------------------------------------------

  gameData.truckInitialHeading = heading;

  gameData.truckHeading = heading;

  try {
    world.events.dispatch(world.events.globalId, ENTITY_TELEPORTED_EVENT, {
      entity: truck,
      position,
    });
  } catch {
    // Safe fallback
  }
}
