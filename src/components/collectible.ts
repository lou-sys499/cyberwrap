import * as ecs from "@8thwall/ecs";

// --------------------------------------------------
// Collectible Types
// --------------------------------------------------

export enum CollectibleType {
  BURRITO = 1,

  STEAK = 2,

  FRIES = 3,

  CHILI = 4,
}

// --------------------------------------------------
// Collectible Component
// --------------------------------------------------

export const collectible = ecs.registerComponent({
  name: "collectible",

  schema: {
    type: ecs.ui8,

    value: ecs.i32,

    collected: ecs.boolean,
  },

  schemaDefaults: {
    // ECS requires literal values here

    type: 1,

    value: 0,

    collected: false,
  },
});
