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
      // Hide the ECS entity that owns this component.
      ecs.Disabled.set(world, eid);

      /*
       * Give the cinematic opener enough time to play.
       *
       * The opener animation is approximately 4.5 seconds.
       * We wait until that animation has completed before
       * revealing the game.
       */

      window.setTimeout(() => {
        const opener = document.getElementById("cyberwrap-opener");

        if (opener) {
          opener.classList.add("hidden");
        }

        /*
         * Release the boot state so the game UI
         * becomes interactive again.
         */

        document.body.classList.remove("cyberwrap-booting");
      }, 4500);
    });
  },
});
