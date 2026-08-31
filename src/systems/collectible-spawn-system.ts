import * as ecs from "@8thwall/ecs";

import { gameData } from "../core/game-data";
import { OBJECT_PLACED_EVENT } from "./placement-system";
import { collectible, CollectibleType } from "../components/collectible";
import { CITY_COLLECTIBLE_SPAWN_NODES } from "../world/city-config";

// --------------------------------------------------
// Shuffle helper
// --------------------------------------------------

function shuffle<T>(array: T[]): T[] {
  const copy = [...array];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

// --------------------------------------------------
// Food definitions
// --------------------------------------------------

function randomItem(schema: any) {
  const items = [
    {
      prefab: schema.burritoPrefab,
      type: CollectibleType.BURRITO,
      value: 20,
    },

    {
      prefab: schema.steakPrefab,
      type: CollectibleType.STEAK,
      value: 15,
    },

    {
      prefab: schema.friesPrefab,
      type: CollectibleType.FRIES,
      value: 10,
    },

    {
      prefab: schema.chiliPrefab,
      type: CollectibleType.CHILI,
      value: 5,
    },
  ];

  return items[Math.floor(Math.random() * items.length)];
}

// --------------------------------------------------

let spawnSchema: any = null;

// --------------------------------------------------

ecs.registerComponent({
  name: "collectible-spawn-system",

  schema: {
    collectibleSpawnContainer: ecs.eid,

    burritoPrefab: ecs.eid,

    steakPrefab: ecs.eid,

    friesPrefab: ecs.eid,

    chiliPrefab: ecs.eid,
  },

  stateMachine: ({ world, eid, schemaAttribute, defineState }) => {
    defineState("ready")
      .initial()

      .onEnter(() => {
        spawnSchema = schemaAttribute.get(eid);

        world.events.addListener(
          world.events.globalId,

          OBJECT_PLACED_EVENT,

          () => {
            spawnInitialCollectibles(world, spawnSchema);
          },
        );
      });
  },
});

// --------------------------------------------------
// Initial spawn
// --------------------------------------------------

function spawnInitialCollectibles(world: ecs.World, schema: any) {
  gameData.collectibleEids.length = 0;

  gameData.collectibleSpawnPoints.length = 0;

  gameData.collectedCount = 0;

  gameData.totalSpawned = 0;

  gameData.totalCollectibles = 0;

  gameData.collectiblesSpawned = false;

  let container: ecs.Eid | null = null;
  if (schema.collectibleSpawnContainer && gameData.driveZoneEid) {
    try {
      container = world.getInstanceEntity(
        gameData.driveZoneEid,
        schema.collectibleSpawnContainer,
      );
    } catch {
      container = null;
    }
  }

  let allPoints: ecs.Eid[] = [];

  if (container) {
    allPoints = [...world.getChildren(container)];
    for (let i = 0; i < allPoints.length; i++) {
      const node = CITY_COLLECTIBLE_SPAWN_NODES[i % CITY_COLLECTIBLE_SPAWN_NODES.length];
      world.transform.setWorldPosition(allPoints[i], {
        x: node.x,
        y: node.y,
        z: node.z,
      });
    }
  } else {
    container = world.createEntity();
    if (gameData.driveZoneEid) {
      world.setParent(container, gameData.driveZoneEid);
    }
    for (let i = 0; i < CITY_COLLECTIBLE_SPAWN_NODES.length; i++) {
      const pt = world.createEntity();
      world.setParent(pt, container);
      world.transform.setWorldPosition(pt, CITY_COLLECTIBLE_SPAWN_NODES[i]);
      allPoints.push(pt);
    }
  }

  const validPoints = allPoints;

  console.log(`[CollectibleSpawn] Distributed ${allPoints.length} spawn points across procedural city.`);

  const points = shuffle(validPoints);

  gameData.collectibleSpawnPoints = points;

  for (let i = 0; i < gameData.maxActiveCollectibles; i++) {
    if (points[i]) {
      createCollectible(
        world,

        randomItem(schema),

        points[i],
      );
    }
  }

  gameData.collectiblesSpawned = true;
}

// --------------------------------------------------
// Respawn
// --------------------------------------------------

export function spawnReplacementCollectible(world: ecs.World) {
  if (!spawnSchema) return;

  const zonePosition = world.transform.getWorldPosition(gameData.driveZoneEid!);
  
  const freePoints = gameData.collectibleSpawnPoints.filter((point) => {
    const pointPos = world.transform.getWorldPosition(point);

    // Check distance from existing collectibles
    const tooCloseToExisting = gameData.collectibleEids.some((item) => {
      const itemPos = world.transform.getWorldPosition(item);

      const dx = itemPos.x - pointPos.x;
      const dz = itemPos.z - pointPos.z;

      return Math.sqrt(dx * dx + dz * dz) < 1.0;
    });
    
    // Check distance from drivezone center
    const dx = pointPos.x - zonePosition.x;
    const dz = pointPos.z - zonePosition.z;
    const distanceFromCenter = Math.sqrt(dx * dx + dz * dz);
    const tooCloseToCenter = distanceFromCenter < 1.5;

    return !tooCloseToExisting && !tooCloseToCenter;
  });

  if (freePoints.length === 0) {
    console.log("[CollectibleSpawn] No valid spawn points available");
    return;
  }

  const point = freePoints[Math.floor(Math.random() * freePoints.length)];

  createCollectible(
    world,

    randomItem(spawnSchema),

    point,
  );
}

// --------------------------------------------------
// Create collectible
// --------------------------------------------------

function createCollectible(
  world: ecs.World,

  item: any,

  point: ecs.Eid,
) {
  const eid = world.createEntity(item.prefab);

  world.getEntity(eid).set(
    collectible,

    {
      type: item.type,

      value: item.value,

      collected: false,
    },
  );

  const pos = world.transform.getWorldPosition(point);

  // Adjust spawn height to ensure clear visibility
  const spawnHeight = Math.max(0.45, pos.y + 0.45);
  
  world.transform.setWorldPosition(
    eid,

    {
      x: pos.x,

      y: spawnHeight,

      z: pos.z,
    },
  );

  // Ensure the collectible is visible by checking its world position
  const finalPos = world.transform.getWorldPosition(eid);
  console.log(`[CollectibleSpawn] Spawned ${item.type} at (${finalPos.x.toFixed(2)}, ${finalPos.y.toFixed(2)}, ${finalPos.z.toFixed(2)})`);

  gameData.collectibleEids.push(eid);

  gameData.totalSpawned++;

  gameData.totalCollectibles = gameData.totalSpawned;
}
