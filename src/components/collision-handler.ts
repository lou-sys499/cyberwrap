import * as ecs from "@8thwall/ecs";

const collisionHandler = ecs.registerComponent({
  name: "collision-handler",

  schema: {},

  data: {
    collisionCount: ecs.i32,
  },

  stateMachine: ({ world, eid, dataAttribute }) => {
    const handleCollisionStart = (event: any) => {
      const data = dataAttribute.cursor(eid);

      data.collisionCount++;

      console.log(
        "[TruckCollision] START",
        "truckCollider:",
        eid,
        "other:",
        event.data.other,
        "active collisions:",
        data.collisionCount,
      );
    };

    const handleCollisionEnd = (event: any) => {
      const data = dataAttribute.cursor(eid);

      data.collisionCount = Math.max(0, data.collisionCount - 1);

      console.log(
        "[TruckCollision] END",
        "truckCollider:",
        eid,
        "other:",
        event.data.other,
        "active collisions:",
        data.collisionCount,
      );
    };

    ecs
      .defineState("active")
      .initial()

      .onEnter(() => {
        dataAttribute.set(eid, {
          collisionCount: 0,
        });

        world.events.addListener(
          eid,
          ecs.physics.COLLISION_START_EVENT,
          handleCollisionStart,
        );

        world.events.addListener(
          eid,
          ecs.physics.COLLISION_END_EVENT,
          handleCollisionEnd,
        );

        console.log("[TruckCollision] Listener ready:", eid);
      })

      .onExit(() => {
        world.events.removeListener(
          eid,
          ecs.physics.COLLISION_START_EVENT,
          handleCollisionStart,
        );

        world.events.removeListener(
          eid,
          ecs.physics.COLLISION_END_EVENT,
          handleCollisionEnd,
        );
      });
  },
});

export { collisionHandler };
