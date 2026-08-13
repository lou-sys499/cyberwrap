import * as ecs from "@8thwall/ecs";

ecs.registerComponent({
  name: "hide-on-ready",
  stateMachine: ({ world, eid, defineState }) => {
    defineState("initial")
      .initial()
      .onEvent(ecs.events.REALITY_READY, "ready", {
        target: world.events.globalId,
      });

    defineState("ready").onEnter(() => {
      // ecs.Disabled.set adds the Disabled tag, hiding the entity
      ecs.Disabled.set(world, eid);
    });
  },
});
