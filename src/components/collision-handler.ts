import * as ecs from "@8thwall/ecs";

const collisionHandler = ecs.registerComponent({
  name: "collision-handler",

  schema: {},

  data: {
    collisionCount: ecs.i32,
  },

  stateMachine: ({ world, eid, dataAttribute, defineState }) => {
    const handleCollisionStart = () => {
      try {
        if (dataAttribute.has(eid)) {
          const current = dataAttribute.get(eid);
          dataAttribute.set(eid, {
            collisionCount: (current.collisionCount || 0) + 1,
          });
        }
      } catch (e) {
        // Safe fallback
      }
    };

    const handleCollisionEnd = () => {
      try {
        if (dataAttribute.has(eid)) {
          const current = dataAttribute.get(eid);
          dataAttribute.set(eid, {
            collisionCount: Math.max(0, (current.collisionCount || 0) - 1),
          });
        }
      } catch (e) {
        // Safe fallback
      }
    };

    defineState("active")
      .initial()

      .onEnter(() => {
        try {
          dataAttribute.set(eid, {
            collisionCount: 0,
          });
        } catch (e) {
          // Safe fallback
        }

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

