// =====================================================
// CYBERWRAP: MOUNT FAKO HEIGHTS PROCEDURAL 3D CITY GENERATOR
// Native 8th Wall ECS Architecture (No raw Three.js dependency)
//
// Procedural Generation Order:
// 1. TERRAIN (Highland base plane, hillside elevation slope)
// 2. FOOTHILLS (Mount Fako foothill silhouette cones & Active Volcanic Vent)
// 3. ROAD NETWORK (Hierarchical asphalt roads, lane markings, curbs, roundabout)
// 4. DISTRICTS & BUILDINGS (Plaza, Market, Heights, Clerks Quarters, Valley)
// 5. LANDMARKS (CyberWrap / Daily Bread Shawarma flagship hub & delivery pad)
// 6. PROPS & VEGETATION (Palms, umbrella trees, street lamps, safety barriers)
// 7. VOLCANIC ASH PLUME (Subtle rising ash puffs from Mount Fako summit)
// =====================================================

import * as ecs from "@8thwall/ecs";
import {
  CITY_BOUNDS,
  CITY_ROADS,
  SHAWARMA_HUB_LOCATION,
  isInsideRoadCorridor,
  type RoadSegment,
} from "./city-config";
import { recordFakoLifecycleEvent } from "../core/diagnostics";

// Tracking state for animated objects & singleton lifecycle
let environmentRootEid: ecs.Eid | null = null;
let deliveryRing1Eid: ecs.Eid | null = null;
let deliveryRing2Eid: ecs.Eid | null = null;
let deliveryBeaconEid: ecs.Eid | null = null;

// Volcanic ash plume tracking
interface AshParticleData {
  eid: ecs.Eid;
  phaseOffset: number;
  baseX: number;
  baseZ: number;
  speed: number;
}
const ashParticles: AshParticleData[] = [];

let animTime = 0;
let isInitialized = false;

// Object counters for verification and logging
let terrainCount = 0;
let foothillCount = 0;
let roadCount = 0;
let districtCount = 0;
let landmarkCount = 0;
let propCount = 0;

// ----------------------------------------------------
// HELPER: Convert Hex Color to RGB (0-255)
// ----------------------------------------------------
function hexToRgb(hex: number): { r: number; g: number; b: number } {
  return {
    r: (hex >> 16) & 255,
    g: (hex >> 8) & 255,
    b: hex & 255,
  };
}

// ----------------------------------------------------
// 1. TERRAIN BUILDER
// ----------------------------------------------------
function buildTerrain(world: ecs.World, parent: ecs.Eid): void {
  // Main Highland Grass Ground Plane (130m x 130m) - completely flat at Y = 0
  const ground = world.createEntity();
  world.setParent(ground, parent);
  world.setPosition(ground, 0, -0.02, 0);
  world.setQuaternion(ground, -0.7071068, 0, 0, 0.7071068); // -90 deg on X
  ecs.PlaneGeometry.set(world, ground, {
    width: CITY_BOUNDS.terrainSize,
    height: CITY_BOUNDS.terrainSize,
  });
  ecs.Material.set(world, ground, {
    r: 45,
    g: 90,
    b: 38,
    roughness: 0.95,
    metalness: 0.05,
  });
  ecs.Shadow.set(world, ground, { receiveShadow: true });
  terrainCount++;
}

// ----------------------------------------------------
// 2. FOOTHILLS & MOUNT FAKO ACTIVE VOLCANO
// ----------------------------------------------------
function buildFoothills(world: ecs.World, parent: ecs.Eid): void {
  const mountainSpecs = [
    { x: -48, y: 12, z: -68, radius: 24, height: 26, color: 0x1a3324 },
    { x: -16, y: 16, z: -74, radius: 30, height: 34, color: 0x152b1e }, // Mount Fako Main Volcanic Summit
    { x: 18, y: 15, z: -70, radius: 28, height: 30, color: 0x182f22 },
    { x: 50, y: 11, z: -65, radius: 22, height: 24, color: 0x1d3628 },
  ];

  for (const m of mountainSpecs) {
    const mountain = world.createEntity();
    world.setParent(mountain, parent);
    world.setPosition(mountain, m.x, m.y, m.z);
    ecs.ConeGeometry.set(world, mountain, {
      radius: m.radius,
      height: m.height,
    });
    const c = hexToRgb(m.color);
    ecs.Material.set(world, mountain, {
      r: c.r,
      g: c.g,
      b: c.b,
      roughness: 0.95,
      metalness: 0.05,
    });
    foothillCount++;
  }

  // --------------------------------------------------
  // Mount Fako Active Volcanic Crater & Summit Caldera
  // Summit peak coordinates: (-16, 33, -74)
  // --------------------------------------------------
  const craterRim = world.createEntity();
  world.setParent(craterRim, parent);
  world.setPosition(craterRim, -16, 32.8, -74);
  ecs.CylinderGeometry.set(world, craterRim, {
    radius: 3.5,
    height: 0.8,
  });
  ecs.Material.set(world, craterRim, {
    r: 32,
    g: 28,
    b: 26,
    roughness: 0.98,
    metalness: 0.02,
  });
  foothillCount++;

  // Subtle volcanic ember glow inside caldera
  const calderaVent = world.createEntity();
  world.setParent(calderaVent, parent);
  world.setPosition(calderaVent, -16, 33.1, -74);
  ecs.SphereGeometry.set(world, calderaVent, {
    radius: 1.8,
  });
  ecs.UnlitMaterial.set(world, calderaVent, {
    r: 220,
    g: 75,
    b: 20,
  });
  foothillCount++;

  // --------------------------------------------------
  // Persistent Volcanic Ash Plume Particles
  // --------------------------------------------------
  ashParticles.length = 0;
  const numAshPuffs = 7;
  for (let i = 0; i < numAshPuffs; i++) {
    const puff = world.createEntity();
    world.setParent(puff, parent);
    world.setPosition(puff, -16, 34 + i * 3.2, -74);
    ecs.SphereGeometry.set(world, puff, {
      radius: 1.8 + i * 0.4,
    });
    // Dark smoky charcoal tones
    const shade = 65 + (i % 3) * 8;
    ecs.Material.set(world, puff, {
      r: shade,
      g: shade + 4,
      b: shade + 6,
      roughness: 0.99,
      metalness: 0.0,
    });
    ashParticles.push({
      eid: puff,
      phaseOffset: i / numAshPuffs,
      baseX: -16,
      baseZ: -74,
      speed: 0.12,
    });
    foothillCount++;
  }
}

// ----------------------------------------------------
// 3. ROAD NETWORK BUILDER
// ----------------------------------------------------
function buildRoadNetwork(
  world: ecs.World,
  roadsRoot: ecs.Eid,
  mainRoot: ecs.Eid,
  secRoot: ecs.Eid,
  locRoot: ecs.Eid,
  propsRoot: ecs.Eid
): void {
  for (const road of CITY_ROADS) {
    const dx = road.endX - road.startX;
    const dz = road.endZ - road.startZ;
    const length = Math.sqrt(dx * dx + dz * dz);
    const midX = (road.startX + road.endX) / 2;
    const midZ = (road.startZ + road.endZ) / 2;
    const angle = Math.atan2(dx, dz);

    const startY = road.elevationStart || 0;
    const endY = road.elevationEnd || 0;
    const midY = (startY + endY) / 2;

    // Pick subcategory parent
    let categoryParent = locRoot;
    if (road.type === "MAIN_AVENUE") categoryParent = mainRoot;
    else if (road.type === "SECONDARY") categoryParent = secRoot;

    // 1. Asphalt Road Surface
    const roadEnt = world.createEntity();
    world.setParent(roadEnt, categoryParent);
    world.setPosition(roadEnt, midX, midY + 0.02, midZ);
    world.setQuaternion(
      roadEnt,
      0,
      Math.sin(angle / 2),
      0,
      Math.cos(angle / 2)
    );
    ecs.BoxGeometry.set(world, roadEnt, {
      width: road.width,
      height: 0.04,
      depth: length,
    });
    ecs.Material.set(world, roadEnt, {
      r: 34,
      g: 38,
      b: 44,
      roughness: 0.85,
      metalness: 0.1,
    });
    ecs.Shadow.set(world, roadEnt, { receiveShadow: true });
    roadCount++;

    // 2. Yellow Centerline Marking
    if (road.hasLanes) {
      const lineEnt = world.createEntity();
      world.setParent(lineEnt, roadEnt);
      world.setPosition(lineEnt, 0, 0.025, 0);
      ecs.BoxGeometry.set(world, lineEnt, {
        width: 0.22,
        height: 0.015,
        depth: length * 0.96,
      });
      ecs.UnlitMaterial.set(world, lineEnt, {
        r: 245,
        g: 183,
        b: 0,
      });
      roadCount++;
    }

    // 3. Left Curb / Sidewalk
    const curbW = 0.8;
    const curbH = 0.12;
    const leftCurb = world.createEntity();
    world.setParent(leftCurb, roadEnt);
    world.setPosition(leftCurb, -(road.width / 2 + curbW / 2), curbH / 2, 0);
    ecs.BoxGeometry.set(world, leftCurb, {
      width: curbW,
      height: curbH,
      depth: length,
    });
    ecs.Material.set(world, leftCurb, {
      r: 140,
      g: 145,
      b: 152,
      roughness: 0.9,
    });
    roadCount++;

    // 4. Right Curb / Sidewalk
    const rightCurb = world.createEntity();
    world.setParent(rightCurb, roadEnt);
    world.setPosition(rightCurb, road.width / 2 + curbW / 2, curbH / 2, 0);
    ecs.BoxGeometry.set(world, rightCurb, {
      width: curbW,
      height: curbH,
      depth: length,
    });
    ecs.Material.set(world, rightCurb, {
      r: 140,
      g: 145,
      b: 152,
      roughness: 0.9,
    });
    roadCount++;

    // 5. Street Lamps (Strictly validated against intersecting road surfaces)
    if (road.hasLamps) {
      const spacing = 16.0;
      const count = Math.max(1, Math.floor(length / spacing));
      for (let i = 1; i <= count; i++) {
        const t = i / (count + 1);
        const lx =
          road.startX + dx * t + Math.cos(angle) * (road.width / 2 + 1.2);
        const lz =
          road.startZ + dz * t - Math.sin(angle) * (road.width / 2 + 1.2);
        const ly = startY + (endY - startY) * t;

        // Skip if position intersects any crossing road corridor
        if (!isInsideRoadCorridor(lx, lz, 0.3)) {
          buildStreetLamp(world, propsRoot, lx, ly, lz);
        }
      }
    }

    // 6. Curbside Trees (Strictly validated against intersecting road surfaces)
    if (road.hasTrees) {
      const treeSpacing = 14.0;
      const treeCount = Math.max(1, Math.floor(length / treeSpacing));
      for (let i = 1; i <= treeCount; i++) {
        const t = i / (treeCount + 1);
        const isPalm = i % 2 === 0;
        const tx =
          road.startX + dx * t - Math.cos(angle) * (road.width / 2 + 1.7);
        const tz =
          road.startZ + dz * t + Math.sin(angle) * (road.width / 2 + 1.7);
        const ty = startY + (endY - startY) * t;

        // Skip if position intersects any crossing road corridor
        if (!isInsideRoadCorridor(tx, tz, 0.4)) {
          if (isPalm) {
            buildPalmTree(world, propsRoot, tx, ty, tz, 1.05);
          } else {
            buildUmbrellaTree(world, propsRoot, tx, ty, tz, 1.0);
          }
        }
      }
    }
  }

  // --------------------------------------------------
  // Central Roundabout at (0, 0)
  // --------------------------------------------------
  const roundabout = world.createEntity();
  world.setParent(roundabout, roadsRoot);
  world.setPosition(roundabout, 0, 0.025, 0);
  ecs.CylinderGeometry.set(world, roundabout, {
    radius: 7.2,
    height: 0.04,
  });
  ecs.Material.set(world, roundabout, {
    r: 34,
    g: 38,
    b: 44,
    roughness: 0.85,
    metalness: 0.1,
  });
  ecs.Shadow.set(world, roundabout, { receiveShadow: true });
  roadCount++;

  // Central Roundabout Island (Lush Tropical Garden Mound)
  const island = world.createEntity();
  world.setParent(island, roadsRoot);
  world.setPosition(island, 0, 0.16, 0);
  ecs.CylinderGeometry.set(world, island, {
    radius: 3.2,
    height: 0.28,
  });
  ecs.Material.set(world, island, {
    r: 45,
    g: 110,
    b: 40,
    roughness: 0.9,
  });
  roadCount++;

  // Roundabout Landmark Palms
  buildPalmTree(world, island, 0, 0.15, 0, 1.35);
  buildPalmTree(world, island, -0.9, 0.15, 0.7, 1.1);
  buildPalmTree(world, island, 0.8, 0.15, -0.6, 1.15);
}

// ----------------------------------------------------
// 4. DISTRICTS & BUILDINGS BUILDER
// ----------------------------------------------------
function buildBuilding(
  world: ecs.World,
  parent: ecs.Eid,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  wallColor: number,
  roofColor: number,
  category: "RESIDENTIAL" | "COMMERCIAL" | "URBAN" | "MARKET_STALL",
  rotY = 0
): ecs.Eid {
  const bldgRoot = world.createEntity();
  world.setParent(bldgRoot, parent);
  world.setPosition(bldgRoot, x, y, z);
  world.setQuaternion(
    bldgRoot,
    0,
    Math.sin(rotY / 2),
    0,
    Math.cos(rotY / 2)
  );

  const wc = hexToRgb(wallColor);
  const rc = hexToRgb(roofColor);

  // 1. Main Structure Body
  const body = world.createEntity();
  world.setParent(body, bldgRoot);
  world.setPosition(body, 0, h / 2, 0);
  ecs.BoxGeometry.set(world, body, {
    width: w,
    height: h,
    depth: d,
  });
  ecs.Material.set(world, body, {
    r: wc.r,
    g: wc.g,
    b: wc.b,
    roughness: 0.8,
    metalness: 0.05,
  });
  ecs.Shadow.set(world, body, { castShadow: true, receiveShadow: true });
  districtCount++;

  // 2. Distinct Architectural Roof & Eaves
  if (category === "RESIDENTIAL") {
    // Pitched Corrugated Metal Roof
    const roofH = 1.3;
    const roof = world.createEntity();
    world.setParent(roof, bldgRoot);
    world.setPosition(roof, 0, h + roofH / 2, 0);
    world.setQuaternion(roof, 0, 0.3826834, 0, 0.9238795); // 45 deg Y
    ecs.ConeGeometry.set(world, roof, {
      radius: Math.max(w, d) * 0.72,
      height: roofH,
    });
    ecs.Material.set(world, roof, {
      r: rc.r,
      g: rc.g,
      b: rc.b,
      roughness: 0.55,
      metalness: 0.3,
    });
    ecs.Shadow.set(world, roof, { castShadow: true });
    districtCount++;

    // Front Veranda Porch
    const porch = world.createEntity();
    world.setParent(porch, bldgRoot);
    world.setPosition(porch, 0, 0.06, d / 2 + 0.6);
    ecs.BoxGeometry.set(world, porch, {
      width: w * 0.8,
      height: 0.12,
      depth: 1.2,
    });
    ecs.Material.set(world, porch, {
      r: 78,
      g: 52,
      b: 46,
      roughness: 0.85,
    });
    districtCount++;

    // Compound Wall with Gate Opening
    const compoundWall = world.createEntity();
    world.setParent(compoundWall, bldgRoot);
    world.setPosition(compoundWall, 0, 0.5, d / 2 + 1.8);
    ecs.BoxGeometry.set(world, compoundWall, {
      width: w + 1.6,
      height: 1.0,
      depth: 0.15,
    });
    ecs.Material.set(world, compoundWall, {
      r: wc.r,
      g: wc.g,
      b: wc.b,
      roughness: 0.9,
    });
    districtCount++;
  } else if (category === "COMMERCIAL") {
    // Parapet roof terrace
    const rim = world.createEntity();
    world.setParent(rim, bldgRoot);
    world.setPosition(rim, 0, h + 0.15, 0);
    ecs.BoxGeometry.set(world, rim, {
      width: w + 0.3,
      height: 0.3,
      depth: d + 0.3,
    });
    ecs.Material.set(world, rim, {
      r: rc.r,
      g: rc.g,
      b: rc.b,
      roughness: 0.7,
    });
    districtCount++;

    // Water tank on roof (typical African highland feature)
    const tank = world.createEntity();
    world.setParent(tank, bldgRoot);
    world.setPosition(tank, w * 0.25, h + 0.6, -d * 0.2);
    ecs.CylinderGeometry.set(world, tank, {
      radius: 0.45,
      height: 0.9,
    });
    ecs.Material.set(world, tank, {
      r: 30,
      g: 136,
      b: 229,
      roughness: 0.4,
    });
    districtCount++;

    // Storefront Striped Awning Canopy
    const awning = world.createEntity();
    world.setParent(awning, bldgRoot);
    world.setPosition(awning, 0, 1.8, d / 2 + 0.6);
    ecs.BoxGeometry.set(world, awning, {
      width: w * 0.9,
      height: 0.12,
      depth: 1.2,
    });
    ecs.Material.set(world, awning, {
      r: rc.r,
      g: rc.g,
      b: rc.b,
      roughness: 0.6,
    });
    districtCount++;
  } else if (category === "MARKET_STALL") {
    // Open-Air Market Stall Canvas Canopy
    const canopy = world.createEntity();
    world.setParent(canopy, bldgRoot);
    world.setPosition(canopy, 0, h + 0.4, 0);
    world.setQuaternion(canopy, 0, 0.3826834, 0, 0.9238795);
    ecs.ConeGeometry.set(world, canopy, {
      radius: w * 0.72,
      height: 0.85,
    });
    ecs.Material.set(world, canopy, {
      r: rc.r,
      g: rc.g,
      b: rc.b,
      roughness: 0.7,
    });
    districtCount++;

    // Fruit & Produce Crates
    const crate1 = world.createEntity();
    world.setParent(crate1, bldgRoot);
    world.setPosition(crate1, -w * 0.25, 0.5, d / 2 + 0.3);
    ecs.BoxGeometry.set(world, crate1, {
      width: 0.6,
      height: 0.45,
      depth: 0.6,
    });
    ecs.Material.set(world, crate1, {
      r: 255,
      g: 179,
      b: 0,
      roughness: 0.9,
    });
    districtCount++;

    const crate2 = world.createEntity();
    world.setParent(crate2, bldgRoot);
    world.setPosition(crate2, w * 0.25, 0.5, d / 2 + 0.3);
    ecs.BoxGeometry.set(world, crate2, {
      width: 0.6,
      height: 0.45,
      depth: 0.6,
    });
    ecs.Material.set(world, crate2, {
      r: 67,
      g: 160,
      b: 71,
      roughness: 0.9,
    });
    districtCount++;
  } else if (category === "URBAN") {
    // Multi-story modern office parapet
    const parapet = world.createEntity();
    world.setParent(parapet, bldgRoot);
    world.setPosition(parapet, 0, h + 0.2, 0);
    ecs.BoxGeometry.set(world, parapet, {
      width: w + 0.2,
      height: 0.4,
      depth: d + 0.2,
    });
    ecs.Material.set(world, parapet, {
      r: 26,
      g: 37,
      b: 47,
      roughness: 0.7,
    });
    districtCount++;
  }

  return bldgRoot;
}

function buildDistricts(
  world: ecs.World,
  distRoot: ecs.Eid,
  plazaRoot: ecs.Eid,
  marketRoot: ecs.Eid,
  heightsRoot: ecs.Eid,
  clerksRoot: ecs.Eid,
  valleyRoot: ecs.Eid
): void {
  // 1. FAKO CENTRAL PLAZA (Administrative, Bank, Pharmacy)
  const centerBuildings: [number, number, number, number, number, number, number, number, any, number][] = [
    [-8.0, 0, -8.0, 6.8, 5.2, 4.5, 0x2c3e50, 0x1abc9c, "URBAN", Math.PI / 2],
    [-8.0, 0, 8.0, 6.5, 4.8, 4.2, 0x34495e, 0xf39c12, "COMMERCIAL", Math.PI / 2],
    [8.0, 0, 8.0, 6.2, 4.2, 4.0, 0x16a085, 0x00d2d3, "COMMERCIAL", -Math.PI / 2],
    [-9.5, 0, -23.0, 5.5, 4.0, 4.0, 0x7f8c8d, 0x27ae60, "COMMERCIAL", 0],
    [9.5, 0, -23.0, 5.5, 3.8, 4.0, 0xd35400, 0xc0392b, "COMMERCIAL", 0],
  ];
  for (const [x, y, z, w, h, d, wc, rc, cat, rot] of centerBuildings) {
    buildBuilding(world, plazaRoot, x, y, z, w, h, d, wc, rc, cat, rot);
  }

  // 2. MOLYKO MARKET SQUARE (East Side)
  const marketBuildings: [number, number, number, number, number, number, number, number, any, number][] = [
    [25.0, 0, -8.0, 3.8, 2.6, 3.2, 0x795548, 0xe74c3c, "MARKET_STALL", 0],
    [29.0, 0, -8.0, 3.8, 2.6, 3.2, 0x6d4c41, 0xf39c12, "MARKET_STALL", 0],
    [33.0, 0, -8.0, 3.8, 2.6, 3.2, 0x5d4037, 0x27ae60, "MARKET_STALL", 0],
    [25.0, 0, 8.0, 3.8, 2.6, 3.2, 0x795548, 0x3498db, "MARKET_STALL", Math.PI],
    [29.0, 0, 8.0, 3.8, 2.6, 3.2, 0x6d4c41, 0xe67e22, "MARKET_STALL", Math.PI],
    [33.0, 0, 8.0, 3.8, 2.6, 3.2, 0x5d4037, 0x9b59b6, "MARKET_STALL", Math.PI],
    [28.0, 0, -22.0, 6.2, 4.2, 4.0, 0xe67e22, 0xd35400, "COMMERCIAL", 0],
    [33.0, 0, -22.0, 5.0, 4.0, 4.0, 0x2980b9, 0x16a085, "COMMERCIAL", 0],
    [28.0, 0, 22.0, 6.0, 3.8, 4.0, 0xf1c40f, 0xc0392b, "COMMERCIAL", Math.PI],
    [33.0, 0, 22.0, 5.0, 4.0, 4.0, 0x1abc9c, 0x2c3e50, "COMMERCIAL", Math.PI],
  ];
  for (const [x, y, z, w, h, d, wc, rc, cat, rot] of marketBuildings) {
    buildBuilding(world, marketRoot, x, y, z, w, h, d, wc, rc, cat, rot);
  }

  // 3. MOUNT FAKO HEIGHTS (North Hillside Villas)
  const hillsideBuildings: [number, number, number, number, number, number, number, number, any, number][] = [
    [-14.0, 0, -38.0, 6.5, 4.5, 5.0, 0xdfe6e9, 0xd35400, "RESIDENTIAL", 0],
    [0.0, 0, -44.0, 7.2, 5.0, 5.2, 0xf5f6fa, 0x2980b9, "RESIDENTIAL", 0],
    [14.0, 0, -38.0, 6.5, 4.5, 5.0, 0xf8efba, 0x16a085, "RESIDENTIAL", 0],
    [-30.0, 0, -38.0, 8.0, 5.2, 5.5, 0xced6e0, 0x8e44ad, "RESIDENTIAL", 0],
    [30.0, 0, -38.0, 8.0, 5.2, 5.5, 0xf1f2f6, 0x27ae60, "RESIDENTIAL", 0],
  ];
  for (const [x, y, z, w, h, d, wc, rc, cat, rot] of hillsideBuildings) {
    buildBuilding(world, heightsRoot, x, y, z, w, h, d, wc, rc, cat, rot);
  }

  // 4. CLERKS QUARTERS (West Residential)
  const westBuildings: [number, number, number, number, number, number, number, number, any, number][] = [
    [-28.0, 0, -8.0, 6.0, 4.2, 4.8, 0xf5cd79, 0xc0392b, "RESIDENTIAL", Math.PI / 2],
    [-28.0, 0, 8.0, 6.0, 4.2, 4.8, 0x74b9ff, 0x0984e3, "RESIDENTIAL", Math.PI / 2],
    [-33.5, 0, -8.0, 5.0, 4.0, 4.0, 0x55efc4, 0x00b894, "RESIDENTIAL", -Math.PI / 2],
    [-33.5, 0, 8.0, 5.0, 4.0, 4.0, 0xff7675, 0xd63031, "RESIDENTIAL", -Math.PI / 2],
    [-28.0, 0, -22.0, 5.8, 4.0, 4.5, 0xa29bfe, 0x6c5ce7, "RESIDENTIAL", 0],
    [-33.5, 0, -22.0, 4.8, 4.0, 4.5, 0xfdcb6e, 0xe17055, "RESIDENTIAL", 0],
    [-28.0, 0, 22.0, 5.8, 4.0, 4.5, 0x81ecec, 0x00cec9, "RESIDENTIAL", Math.PI],
    [-33.5, 0, 22.0, 4.8, 4.0, 4.5, 0xdfe6e9, 0xb2bec3, "RESIDENTIAL", Math.PI],
  ];
  for (const [x, y, z, w, h, d, wc, rc, cat, rot] of westBuildings) {
    buildBuilding(world, clerksRoot, x, y, z, w, h, d, wc, rc, cat, rot);
  }

  // 5. GREENFIELD VALLEY & OUTSKIRTS (South)
  const southBuildings: [number, number, number, number, number, number, number, number, any, number][] = [
    [-14.0, 0, 38.0, 6.2, 3.8, 4.5, 0xf6e58d, 0xeb4d4b, "RESIDENTIAL", Math.PI],
    [0.0, 0, 44.0, 7.0, 4.2, 4.8, 0x7ed6df, 0x22a6b3, "RESIDENTIAL", Math.PI],
    [14.0, 0, 38.0, 6.2, 3.8, 4.5, 0xbadc58, 0x6ab04c, "RESIDENTIAL", Math.PI],
    [-30.0, 0, 38.0, 6.0, 3.6, 4.2, 0xe056fd, 0xbe2edd, "RESIDENTIAL", Math.PI],
    [30.0, 0, 38.0, 6.0, 3.6, 4.2, 0xffbe76, 0xf0932b, "RESIDENTIAL", Math.PI],
  ];
  for (const [x, y, z, w, h, d, wc, rc, cat, rot] of southBuildings) {
    buildBuilding(world, valleyRoot, x, y, z, w, h, d, wc, rc, cat, rot);
  }
}

// ----------------------------------------------------
// 5. LANDMARKS: CYBERWRAP SHAWARMA FLAGSHIP HUB
// ----------------------------------------------------
function buildCyberWrapLandmark(world: ecs.World, landmarksRoot: ecs.Eid): void {
  const hub = SHAWARMA_HUB_LOCATION;

  // 1. Restaurant Main Building
  const restaurant = world.createEntity();
  world.setParent(restaurant, landmarksRoot);
  world.setPosition(
    restaurant,
    hub.building.x,
    hub.building.h / 2,
    hub.building.z
  );
  world.setQuaternion(
    restaurant,
    0,
    Math.sin(hub.building.rotY / 2),
    0,
    Math.cos(hub.building.rotY / 2)
  );
  ecs.BoxGeometry.set(world, restaurant, {
    width: hub.building.w,
    height: hub.building.h,
    depth: hub.building.d,
  });
  ecs.Material.set(world, restaurant, {
    r: 10,
    g: 28,
    b: 46,
    roughness: 0.5,
    metalness: 0.3,
  });
  ecs.Shadow.set(world, restaurant, { castShadow: true, receiveShadow: true });
  landmarkCount++;

  // 2. Cyan Illuminated Restaurant Canopy
  const canopy = world.createEntity();
  world.setParent(canopy, restaurant);
  world.setPosition(canopy, 0, 2.2 - hub.building.h / 2, hub.building.d / 2 + 0.8);
  ecs.BoxGeometry.set(world, canopy, {
    width: hub.building.w * 0.95,
    height: 0.22,
    depth: 1.6,
  });
  ecs.Material.set(world, canopy, {
    r: 0,
    g: 240,
    b: 255,
    emissiveR: 0,
    emissiveG: 200,
    emissiveB: 240,
    emissiveIntensity: 0.6,
    roughness: 0.3,
  });
  landmarkCount++;

  // 3. Illuminated Neon Signboard ("CYBERWRAP SHAWARMA & GRILL")
  const sign = world.createEntity();
  world.setParent(sign, restaurant);
  world.setPosition(
    sign,
    0,
    hub.building.h / 2 + 0.65,
    hub.building.d / 2 + 0.1
  );
  ecs.BoxGeometry.set(world, sign, {
    width: hub.building.w * 0.9,
    height: 1.1,
    depth: 0.2,
  });
  ecs.Material.set(world, sign, {
    r: 7,
    g: 21,
    b: 36,
    roughness: 0.4,
  });
  landmarkCount++;

  // Neon glowing badge on sign
  const badge = world.createEntity();
  world.setParent(badge, sign);
  world.setPosition(badge, 0, 0, 0.12);
  ecs.BoxGeometry.set(world, badge, {
    width: hub.building.w * 0.8,
    height: 0.8,
    depth: 0.05,
  });
  ecs.UnlitMaterial.set(world, badge, {
    r: 0,
    g: 240,
    b: 255,
  });
  landmarkCount++;

  // 4. Delivery Drop Zone Apron Pad
  const dropPad = world.createEntity();
  world.setParent(dropPad, landmarksRoot);
  world.setPosition(
    dropPad,
    hub.deliveryZone.x,
    0.04,
    hub.deliveryZone.z
  );
  ecs.CylinderGeometry.set(world, dropPad, {
    radius: 3.4,
    height: 0.04,
  });
  ecs.Material.set(world, dropPad, {
    r: 10,
    g: 20,
    b: 30,
    roughness: 0.6,
    metalness: 0.2,
  });
  landmarkCount++;

  // 5. Outer Animated Cyan Holographic Ring
  deliveryRing1Eid = world.createEntity();
  world.setParent(deliveryRing1Eid, dropPad);
  world.setPosition(deliveryRing1Eid, 0, 0.15, 0);
  world.setQuaternion(deliveryRing1Eid, -0.7071068, 0, 0, 0.7071068);
  ecs.RingGeometry.set(world, deliveryRing1Eid, {
    innerRadius: 2.2,
    outerRadius: 2.6,
  });
  ecs.UnlitMaterial.set(world, deliveryRing1Eid, {
    r: 0,
    g: 240,
    b: 255,
  });
  landmarkCount++;

  // 6. Inner Animated Gold Holographic Ring
  deliveryRing2Eid = world.createEntity();
  world.setParent(deliveryRing2Eid, dropPad);
  world.setPosition(deliveryRing2Eid, 0, 0.22, 0);
  world.setQuaternion(deliveryRing2Eid, -0.7071068, 0, 0, 0.7071068);
  ecs.RingGeometry.set(world, deliveryRing2Eid, {
    innerRadius: 1.4,
    outerRadius: 1.7,
  });
  ecs.UnlitMaterial.set(world, deliveryRing2Eid, {
    r: 255,
    g: 209,
    b: 102,
  });
  landmarkCount++;

  // 7. Floating Delivery Chevron Beacon
  deliveryBeaconEid = world.createEntity();
  world.setParent(deliveryBeaconEid, dropPad);
  world.setPosition(deliveryBeaconEid, 0, 3.2, 0);
  world.setQuaternion(deliveryBeaconEid, 1, 0, 0, 0); // pointing downwards (180 deg on X)
  ecs.ConeGeometry.set(world, deliveryBeaconEid, {
    radius: 0.75,
    height: 1.5,
  });
  ecs.UnlitMaterial.set(world, deliveryBeaconEid, {
    r: 0,
    g: 240,
    b: 255,
  });
  landmarkCount++;
}

// ----------------------------------------------------
// 6. PROPS (Street Lamps, Palms, Umbrella Trees, Barriers)
// ----------------------------------------------------
function buildStreetLamp(
  world: ecs.World,
  parent: ecs.Eid,
  x: number,
  y: number,
  z: number
): void {
  const lampRoot = world.createEntity();
  world.setParent(lampRoot, parent);
  world.setPosition(lampRoot, x, y, z);

  // Post
  const post = world.createEntity();
  world.setParent(post, lampRoot);
  world.setPosition(post, 0, 1.7, 0);
  ecs.CylinderGeometry.set(world, post, {
    radius: 0.08,
    height: 3.4,
  });
  ecs.Material.set(world, post, {
    r: 38,
    g: 50,
    b: 56,
    roughness: 0.5,
    metalness: 0.6,
  });
  propCount++;

  // Glowing Lantern Head
  const head = world.createEntity();
  world.setParent(head, lampRoot);
  world.setPosition(head, 0.4, 3.4, 0);
  ecs.SphereGeometry.set(world, head, {
    radius: 0.22,
  });
  ecs.UnlitMaterial.set(world, head, {
    r: 255,
    g: 235,
    b: 130,
  });
  propCount++;
}

function buildPalmTree(
  world: ecs.World,
  parent: ecs.Eid,
  x: number,
  y: number,
  z: number,
  scale = 1.0
): void {
  const palmRoot = world.createEntity();
  world.setParent(palmRoot, parent);
  world.setPosition(palmRoot, x, y, z);

  // Trunk
  const trunkH = 2.8 * scale;
  const trunk = world.createEntity();
  world.setParent(trunk, palmRoot);
  world.setPosition(trunk, 0, trunkH / 2, 0);
  ecs.CylinderGeometry.set(world, trunk, {
    radius: 0.16 * scale,
    height: trunkH,
  });
  ecs.Material.set(world, trunk, {
    r: 109,
    g: 76,
    b: 65,
    roughness: 0.9,
  });
  propCount++;

  // Palm Fronds Crown (Cone Canopy)
  const crown = world.createEntity();
  world.setParent(crown, palmRoot);
  world.setPosition(crown, 0, trunkH + 0.4 * scale, 0);
  ecs.ConeGeometry.set(world, crown, {
    radius: 1.8 * scale,
    height: 1.2 * scale,
  });
  ecs.Material.set(world, crown, {
    r: 46,
    g: 125,
    b: 50,
    roughness: 0.8,
  });
  ecs.Shadow.set(world, crown, { castShadow: true });
  propCount++;
}

function buildUmbrellaTree(
  world: ecs.World,
  parent: ecs.Eid,
  x: number,
  y: number,
  z: number,
  scale = 1.0
): void {
  const treeRoot = world.createEntity();
  world.setParent(treeRoot, parent);
  world.setPosition(treeRoot, x, y, z);

  // Trunk
  const trunkH = 1.8 * scale;
  const trunk = world.createEntity();
  world.setParent(trunk, treeRoot);
  world.setPosition(trunk, 0, trunkH / 2, 0);
  ecs.CylinderGeometry.set(world, trunk, {
    radius: 0.22 * scale,
    height: trunkH,
  });
  ecs.Material.set(world, trunk, {
    r: 78,
    g: 52,
    b: 46,
    roughness: 0.9,
  });
  propCount++;

  // Tiered Umbrella Foliage
  const foliage1 = world.createEntity();
  world.setParent(foliage1, treeRoot);
  world.setPosition(foliage1, 0, trunkH + 0.3 * scale, 0);
  ecs.CylinderGeometry.set(world, foliage1, {
    radius: 1.6 * scale,
    height: 0.6 * scale,
  });
  ecs.Material.set(world, foliage1, {
    r: 51,
    g: 105,
    b: 30,
    roughness: 0.85,
  });
  ecs.Shadow.set(world, foliage1, { castShadow: true });
  propCount++;

  const foliage2 = world.createEntity();
  world.setParent(foliage2, treeRoot);
  world.setPosition(foliage2, 0, trunkH + 0.8 * scale, 0);
  ecs.CylinderGeometry.set(world, foliage2, {
    radius: 1.1 * scale,
    height: 0.5 * scale,
  });
  ecs.Material.set(world, foliage2, {
    r: 58,
    g: 118,
    b: 34,
    roughness: 0.85,
  });
  ecs.Shadow.set(world, foliage2, { castShadow: true });
  propCount++;
}

function buildRoadsideBarrier(
  world: ecs.World,
  parent: ecs.Eid,
  x: number,
  y: number,
  z: number,
  rotY = 0
): void {
  const barrierRoot = world.createEntity();
  world.setParent(barrierRoot, parent);
  world.setPosition(barrierRoot, x, y, z);
  world.setQuaternion(
    barrierRoot,
    0,
    Math.sin(rotY / 2),
    0,
    Math.cos(rotY / 2)
  );

  // Guard board
  const board = world.createEntity();
  world.setParent(board, barrierRoot);
  world.setPosition(board, 0, 0.5, 0);
  ecs.BoxGeometry.set(world, board, {
    width: 2.2,
    height: 0.45,
    depth: 0.12,
  });
  ecs.Material.set(world, board, {
    r: 231,
    g: 76,
    b: 60,
    roughness: 0.6,
  });
  propCount++;
}

// ----------------------------------------------------
// MAIN PROCEDURAL GENERATION ENTRY POINT
// ----------------------------------------------------
export function buildFakoCity(world: ecs.World): ecs.Eid {
  recordFakoLifecycleEvent("cityBuildCount");
  console.log(`[FakoCity] buildFakoCity called`);
  console.log(
    `[FakoCity] initialization state: isInitialized=${isInitialized}, rootEid=${environmentRootEid}`
  );

  if (isInitialized && environmentRootEid) {
    console.log(`[FakoCity] root entity ID (cached): ${environmentRootEid}`);
    return environmentRootEid;
  }

  // Authoritative guard to prevent concurrent re-entrant creation
  isInitialized = true;

  try {
    // Reset counters
    terrainCount = 0;
    foothillCount = 0;
    roadCount = 0;
    districtCount = 0;
    landmarkCount = 0;
    propCount = 0;

    // Root Environment Entity
    const envRoot = world.createEntity();
    world.setPosition(envRoot, 0, 0, 0);
    environmentRootEid = envRoot;

    console.log(`[FakoCity] root entity ID (newly created): ${envRoot}`);

    // Hierarchy Groups
    const terrainRoot = world.createEntity();
    world.setParent(terrainRoot, envRoot);

    const foothillsRoot = world.createEntity();
    world.setParent(foothillsRoot, envRoot);

    const roadsRoot = world.createEntity();
    world.setParent(roadsRoot, envRoot);

    const mainRoadsRoot = world.createEntity();
    world.setParent(mainRoadsRoot, roadsRoot);

    const secRoadsRoot = world.createEntity();
    world.setParent(secRoadsRoot, roadsRoot);

    const locRoadsRoot = world.createEntity();
    world.setParent(locRoadsRoot, roadsRoot);

    const districtsRoot = world.createEntity();
    world.setParent(districtsRoot, envRoot);

    const plazaRoot = world.createEntity();
    world.setParent(plazaRoot, districtsRoot);

    const marketRoot = world.createEntity();
    world.setParent(marketRoot, districtsRoot);

    const heightsRoot = world.createEntity();
    world.setParent(heightsRoot, districtsRoot);

    const clerksRoot = world.createEntity();
    world.setParent(clerksRoot, districtsRoot);

    const valleyRoot = world.createEntity();
    world.setParent(valleyRoot, districtsRoot);

    const landmarksRoot = world.createEntity();
    world.setParent(landmarksRoot, envRoot);

    const propsRoot = world.createEntity();
    world.setParent(propsRoot, envRoot);

    // 1. Build Terrain
    buildTerrain(world, terrainRoot);

    // 2. Build Foothills & Active Mount Fako Volcano
    buildFoothills(world, foothillsRoot);

    // 3. Build Road Network & Roundabout
    buildRoadNetwork(
      world,
      roadsRoot,
      mainRoadsRoot,
      secRoadsRoot,
      locRoadsRoot,
      propsRoot
    );

    // 4. Build Districts & Buildings
    buildDistricts(
      world,
      districtsRoot,
      plazaRoot,
      marketRoot,
      heightsRoot,
      clerksRoot,
      valleyRoot
    );

    // 5. Build Landmarks (CyberWrap Shawarma Hub)
    buildCyberWrapLandmark(world, landmarksRoot);

    // 6. Build Road Safety Barriers at Key Corners & Overlooks
    const barriers: [number, number, number, number][] = [
      [-44.0, 1.6, -34.0, 0.75],
      [44.0, 1.6, -34.0, -0.75],
      [-44.0, 0, 34.0, 2.35],
      [44.0, 0, 34.0, -2.35],
      [-6.0, 2.1, -42.0, 0],
      [6.0, 2.1, -42.0, 0],
      [-6.0, 0, 42.0, Math.PI],
      [6.0, 0, 42.0, Math.PI],
    ];
    for (const [bx, by, bz, rot] of barriers) {
      buildRoadsideBarrier(world, propsRoot, bx, by, bz, rot);
    }

    isInitialized = true;

    // STEP 7: Required Debug Logging
    console.log(`[MOUNT FAKO] Environment initialized`);
    console.log(`[MOUNT FAKO] Root Entity ID: ${envRoot}`);
    console.log(`[MOUNT FAKO] Terrain Objects: ${terrainCount}`);
    console.log(`[MOUNT FAKO] Foothill Objects: ${foothillCount}`);
    console.log(`[MOUNT FAKO] Road Objects: ${roadCount}`);
    console.log(`[MOUNT FAKO] District Objects: ${districtCount}`);
    console.log(`[MOUNT FAKO] Landmark Objects: ${landmarkCount}`);
    console.log(`[MOUNT FAKO] Prop Objects: ${propCount}`);

    return envRoot;
  } catch (error: any) {
    console.error(`[MOUNT FAKO] Environment initialization failed: ${error?.message || error}`);
    throw error;
  }
}

// ----------------------------------------------------
// ANIMATION & TICK
// ----------------------------------------------------
export function animateCityEnvironment(world: ecs.World): void {
  const delta = Math.min(world.time.delta || 0.016, 0.05);
  animTime += delta;

  // 1. Animate rotating holographic delivery rings
  if (deliveryRing1Eid) {
    world.transform.rotateLocal(
      deliveryRing1Eid,
      ecs.math.quat.zRadians(1.4 * delta)
    );
  }
  if (deliveryRing2Eid) {
    world.transform.rotateLocal(
      deliveryRing2Eid,
      ecs.math.quat.zRadians(-1.9 * delta)
    );
  }

  // 2. Animate floating delivery beacon bobbing & rotating
  if (deliveryBeaconEid) {
    world.transform.setLocalPosition(deliveryBeaconEid, {
      x: 0,
      y: 3.0 + Math.sin(animTime * 3.5) * 0.3,
      z: 0,
    });
    world.transform.rotateLocal(
      deliveryBeaconEid,
      ecs.math.quat.yRadians(2.0 * delta)
    );
  }

  // 3. Animate subtle Mount Fako volcanic ash plume (rising & drifting with gentle wind)
  const plumeBaseY = 33.5;
  const plumeMaxHeight = 24.0;
  for (let i = 0; i < ashParticles.length; i++) {
    const p = ashParticles[i];
    const progress = ((animTime * p.speed + p.phaseOffset) % 1.0 + 1.0) % 1.0;
    const currentY = plumeBaseY + progress * plumeMaxHeight;

    // Gentle wind drift to the South-East (+X, +Z) with slight wobble
    const windDriftX = progress * 4.2 + Math.sin(animTime * 0.8 + i) * 0.6;
    const windDriftZ = progress * 5.5 + Math.cos(animTime * 0.7 + i) * 0.5;

    world.transform.setLocalPosition(p.eid, {
      x: p.baseX + windDriftX,
      y: currentY,
      z: p.baseZ + windDriftZ,
    });
  }
}
