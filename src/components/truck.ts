import * as ecs from "@8thwall/ecs";

export const truck = ecs.registerComponent({
  name: "truck",

  schema: {
    speed: ecs.f32,
    turnSpeed: ecs.f32,
  },

  schemaDefaults: {
    speed: 0.03,
    turnSpeed: 0.04,
  },
});
