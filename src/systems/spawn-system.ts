import * as ecs from "@8thwall/ecs";

import { gameData } from "../core/game-data";

import { OBJECT_PLACED_EVENT } from "./placement-system";

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

  const runtimeSpawnPoint = world.getInstanceEntity(
    gameData.driveZoneEid,
    schema.truckSpawnPoint,
  );

  if (!runtimeSpawnPoint || runtimeSpawnPoint === 0n) {
    console.error("[Spawn] Missing runtime TruckSpawnPoint");

    return;
  }

  // ==================================================
  // FIND RUNTIME DELIVERY ZONE
  // ==================================================

  const runtimeKitchenDropoff = world.getInstanceEntity(
    gameData.driveZoneEid,
    schema.kitchenDropoff,
  );

  if (!runtimeKitchenDropoff || runtimeKitchenDropoff === 0n) {
    console.error("[Spawn] Missing runtime KitchenDropoff / Delivery Zone");

    return;
  }

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

  const position = world.transform.getWorldPosition(runtimeKitchenDropoff);

  // --------------------------------------------------
  // Position visual
  // --------------------------------------------------

  world.transform.setWorldPosition(kitchen, {
    x: position.x,
    y: position.y,
    z: position.z,
  });

  // --------------------------------------------------
  // Match Delivery Zone rotation
  // --------------------------------------------------

  const rotation = world.transform.getWorldQuaternion(runtimeKitchenDropoff);

  world.transform.setWorldQuaternion(kitchen, rotation);

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
  // --------------------------------------------------
  // Create truck
  // --------------------------------------------------

  const truck = world.createEntity(truckPrefab);

  // --------------------------------------------------
  // Get spawn position
  // --------------------------------------------------

  const position = world.transform.getWorldPosition(runtimeSpawnPoint);

  // --------------------------------------------------
  // Position truck
  // --------------------------------------------------

  world.transform.setWorldPosition(truck, {
    x: position.x,
    y: position.y,
    z: position.z,
  });

  // --------------------------------------------------
  // Get spawn rotation
  // --------------------------------------------------

  const spawnRotation = world.transform.getWorldQuaternion(runtimeSpawnPoint);

  // --------------------------------------------------
  // Apply truck rotation
  // --------------------------------------------------

  world.transform.setWorldQuaternion(truck, spawnRotation);

  // --------------------------------------------------
  // Convert quaternion to heading
  // --------------------------------------------------

  const heading = Math.atan2(
    2 * (spawnRotation.w * spawnRotation.y),

    1 - 2 * (spawnRotation.y * spawnRotation.y),
  );

  // --------------------------------------------------
  // Store truck state
  // --------------------------------------------------

  gameData.truckEid = truck;

  gameData.truckPlaced = true;

  gameData.truckSpeed = 0;

  // --------------------------------------------------
  // Lock initial vehicle direction
  // --------------------------------------------------

  gameData.truckInitialHeading = heading;

  gameData.truckHeading = heading;

  // --------------------------------------------------
  // Debug
  // --------------------------------------------------
}
