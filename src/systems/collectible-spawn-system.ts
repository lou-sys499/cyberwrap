import * as ecs from "@8thwall/ecs";

import { gameData } from "../core/game-data";

import {
  OBJECT_PLACED_EVENT,
} from "./placement-system";

import {
  collectible,
  CollectibleType,
} from "../components/collectible";


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

  return items[
    Math.floor(Math.random() * items.length)
  ];

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

  stateMachine: ({
    world,
    eid,
    schemaAttribute,
    defineState,
  }) => {

    defineState("ready")

      .initial()

      .onEnter(() => {

        console.log("[Collectibles] Component initialized");

        spawnSchema = schemaAttribute.get(eid);

        world.events.addListener(

          world.events.globalId,

          OBJECT_PLACED_EVENT,

          () => {

            spawnInitialCollectibles(
              world,
              spawnSchema
            );

          }

        );

      });

  },

});


// --------------------------------------------------
// Initial spawn
// --------------------------------------------------

function spawnInitialCollectibles(
  world: ecs.World,
  schema: any
) {

  gameData.collectibleEids.length = 0;

  gameData.collectibleSpawnPoints.length = 0;

  gameData.collectedCount = 0;

  gameData.totalSpawned = 0;

  gameData.totalCollectibles = 0;

  gameData.collectiblesSpawned = false;

  const container = world.getInstanceEntity(

    gameData.driveZoneEid!,

    schema.collectibleSpawnContainer

  );

  if (!container)
    return;

  const points = shuffle([
    ...world.getChildren(container)
  ]);

  gameData.collectibleSpawnPoints = points;

  for (

    let i = 0;

    i < gameData.maxActiveCollectibles;

    i++

  ) {

    createCollectible(

      world,

      randomItem(schema),

      points[i]

    );

  }

  gameData.collectiblesSpawned = true;

}


// --------------------------------------------------
// Respawn
// --------------------------------------------------

export function spawnReplacementCollectible(
  world: ecs.World
) {

  if (!spawnSchema)
    return;

  const freePoints = gameData.collectibleSpawnPoints.filter(

    point => {

      const pointPos =
        world.transform.getWorldPosition(point);

      return !gameData.collectibleEids.some(item => {

        const itemPos =
          world.transform.getWorldPosition(item);

        const dx = itemPos.x - pointPos.x;
        const dz = itemPos.z - pointPos.z;

        return Math.sqrt(
          dx * dx +
          dz * dz
        ) < 0.15;

      });

    }

  );

  if (freePoints.length === 0)
    return;

  const point =

    freePoints[
      Math.floor(
        Math.random() *
        freePoints.length
      )
    ];

  createCollectible(

    world,

    randomItem(spawnSchema),

    point

  );

}


// --------------------------------------------------
// Create collectible
// --------------------------------------------------

function createCollectible(

  world: ecs.World,

  item: any,

  point: ecs.Eid

) {

  const eid =

    world.createEntity(
      item.prefab
    );

  world.getEntity(eid).set(

    collectible,

    {

      type: item.type,

      value: item.value,

      collected: false,

    }

  );

  const pos =

    world.transform.getWorldPosition(
      point
    );

  world.transform.setWorldPosition(

    eid,

    {

      x: pos.x,

      y: pos.y + 0.05,

      z: pos.z,

    }

  );

  gameData.collectibleEids.push(eid);

  gameData.totalSpawned++;

  gameData.totalCollectibles =
    gameData.totalSpawned;

  console.log(

    "[Collectibles] Spawned",

    eid,

    item.type,

    item.value

  );

}