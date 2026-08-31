import * as ecs from "@8thwall/ecs";

import { OBJECT_PLACED_EVENT } from "./placement-system";
import { buildFakoCity, animateCityEnvironment } from "../world/city-generator";

// =====================================================
// CYBERWRAP 3D PROCEDURAL CITY ENVIRONMENT SYSTEM
//
// Mount Fako Heights (Buea Highlands District)
// Full-scale procedural 3D African city environment featuring:
// - Rolling highland terrain with gentle slopes and mountain silhouettes
// - Connected hierarchical asphalt road network (Avenues, Boulevards, Local Streets, Roundabout)
// - Contemporary African urban architecture across 5 distinct districts
// - Flagship CyberWrap / Daily Bread Shawarma restaurant & delivery zone
// - Instanced tropical flora (palms, acacia/umbrella trees, flowering shrubs)
// - Real-time lighting, animated holographic beacon, and road props
// =====================================================

export function buildDriveZoneCity(world: ecs.World): void {
  buildFakoCity(world);
}

// ----------------------------------------------------
// ECS COMPONENT REGISTRATION
// ----------------------------------------------------

ecs.registerComponent({
  name: "drivezone-environment-system",

  schema: {},

  stateMachine: ({ world, defineState }) => {
    defineState("active")
      .initial()
      .onEnter(() => {
        buildFakoCity(world);
      })
      .onTick(() => {
        animateCityEnvironment(world);
      });
  },

  tick: (world) => {
    animateCityEnvironment(world);
  },
});
