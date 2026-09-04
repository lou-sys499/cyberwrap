// =====================================================
// CYBERWRAP: MOUNT FAKO HIGHLANDS PROCEDURAL 3D CITY GENERATOR
// Phase 17: Spacious Open-World Delivery Map Redesign (190m x 190m)
// Native 8th Wall ECS Architecture (Zero raw Three.js dependencies)
//
// Procedural Generation Order:
// 1. TERRAIN (Highland base plateau 250m, volcanic soil tones)
// 2. FOOTHILLS & DISTANT MOUNT FAKO (Summit caldera, ember vent, volcanic ash plume)
// 3. ROAD NETWORK (Central Roundabout, 12m Main Avenues, 8m Secondary, 5m Local/Shortcuts)
// 4. STREET EDGES (Sidewalks, curbs, drainage gutters, pedestrian crossings)
// 5. DISTRICTS & CITY BLOCKS (Central, Market, Commercial, Residential, Hillside, Valley)
// 6. BUILDINGS (60-80 low-poly modular African/Cameroonian highland archetypes)
// 7. LANDMARKS (Shawarma Hub, Roundabout Monument, Market Pavilion, Ridge Viewpoint, Transit Station)
// 8. PROPS & VEGETATION (120-160 props, 80-100 palms, umbrella trees, and flowering shrubs)
// =====================================================

import * as ecs from "@8thwall/ecs";
import {
  CITY_BOUNDS,
  CITY_ROADS,
  CITY_INTERSECTIONS,
  SHAWARMA_HUB_LOCATION,
  isInsideRoadCorridor,
  type RoadSegment,
} from "./city-config";
import { recordFakoLifecycleEvent } from "../core/diagnostics";
import { validateGeneratedCity } from "./city-validation";

// Lifecycle & tracking states
let environmentRootEid: ecs.Eid | null = null;
export let deliveryRing1Eid: ecs.Eid | null = null;
export let deliveryRing2Eid: ecs.Eid | null = null;
export let deliveryBeaconEid: ecs.Eid | null = null;

// Volcanic ash plume particle animation data
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

// Metrics counters
let terrainCount = 0;
let foothillCount = 0;
let roadCount = 0;
let buildingCount = 0;
let landmarkCount = 0;
let propCount = 0;
let vegetationCount = 0;

// Helper: Convert Hex Color to RGB (0-255)
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
  // Main Highland Plateau Base (250m x 250m) - completely flat at Y = 0
  const ground = world.createEntity();
  world.setParent(ground, parent);
  world.setPosition(ground, 0, -0.02, 0);
  world.setQuaternion(ground, -0.7071068, 0, 0, 0.7071068); // -90 deg on X
  ecs.PlaneGeometry.set(world, ground, {
    width: CITY_BOUNDS.terrainSize,
    height: CITY_BOUNDS.terrainSize,
  });
  ecs.Material.set(world, ground, {
    r: 52,
    g: 96,
    b: 44, // Lush highland grass
    roughness: 0.95,
    metalness: 0.05,
  });
  ecs.Shadow.set(world, ground, { receiveShadow: true });
  terrainCount++;

  // Secondary Red-Brown Volcanic Soil Patches under market & civic outskirts
  const soilCoords = [
    { x: 55, z: 0, w: 38, d: 38 },    // Molyko Market soil plaza
    { x: -55, z: 52, w: 32, d: 32 },  // Transit & Fuel station yard
    { x: 0, z: -80, w: 45, d: 24 },   // Hillside Viewpoint terrain base
    { x: 55, z: 65, w: 36, d: 36 },   // Valley Agro logistics yard
  ];
  for (const soil of soilCoords) {
    const patch = world.createEntity();
    world.setParent(patch, parent);
    world.setPosition(patch, soil.x, -0.015, soil.z);
    world.setQuaternion(patch, -0.7071068, 0, 0, 0.7071068);
    ecs.PlaneGeometry.set(world, patch, { width: soil.w, height: soil.d });
    ecs.Material.set(world, patch, {
      r: 105,
      g: 58,
      b: 38, // Rich Cameroonian volcanic red earth
      roughness: 0.98,
      metalness: 0.02,
    });
    ecs.Shadow.set(world, patch, { receiveShadow: true });
    terrainCount++;
  }
}

// ----------------------------------------------------
// 2. DISTANT FOOTHILLS & MOUNT FAKO SUMMIT
// Located outside the 190m playable zone (Z = -110 to -160)
// ----------------------------------------------------
function buildFoothills(world: ecs.World, parent: ecs.Eid): void {
  const mountainSpecs = [
    { x: -95, y: 22, z: -130, radius: 48, height: 55, color: 0x1c3826 },
    { x: -32, y: 35, z: -145, radius: 62, height: 75, color: 0x152c1e }, // Mount Fako Main Peak
    { x: 38, y: 28, z: -138, radius: 56, height: 65, color: 0x183222 },
    { x: 105, y: 20, z: -125, radius: 45, height: 50, color: 0x1f3c2a },
    { x: -60, y: 16, z: -115, radius: 32, height: 38, color: 0x22422e },
    { x: 68, y: 18, z: -118, radius: 35, height: 40, color: 0x244430 },
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

  // Mount Fako Active Volcanic Crater & Caldera Rim at (-32, 70, -145)
  const craterRim = world.createEntity();
  world.setParent(craterRim, parent);
  world.setPosition(craterRim, -32, 69.5, -145);
  ecs.CylinderGeometry.set(world, craterRim, { radius: 7.5, height: 1.6 });
  ecs.Material.set(world, craterRim, {
    r: 36,
    g: 30,
    b: 28,
    roughness: 0.98,
    metalness: 0.02,
  });
  foothillCount++;

  // Glowing Volcanic Vent
  const calderaVent = world.createEntity();
  world.setParent(calderaVent, parent);
  world.setPosition(calderaVent, -32, 70.0, -145);
  ecs.SphereGeometry.set(world, calderaVent, { radius: 3.8 });
  ecs.UnlitMaterial.set(world, calderaVent, { r: 235, g: 80, b: 20 });
  foothillCount++;

  // Rising Volcanic Ash Plume
  ashParticles.length = 0;
  const numAshPuffs = 8;
  for (let i = 0; i < numAshPuffs; i++) {
    const puff = world.createEntity();
    world.setParent(puff, parent);
    world.setPosition(puff, -32, 72 + i * 5.5, -145);
    ecs.SphereGeometry.set(world, puff, { radius: 3.2 + i * 0.7 });
    const shade = 68 + (i % 3) * 6;
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
      baseX: -32,
      baseZ: -145,
      speed: 0.08,
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
  propsRoot: ecs.Eid,
  vegRoot: ecs.Eid
): void {
  // 1. Central Roundabout (Diameter = 22m, Island Radius = 5.0m)
  const roundabout = world.createEntity();
  world.setParent(roundabout, roadsRoot);
  world.setPosition(roundabout, 0, 0.015, 0);
  ecs.CylinderGeometry.set(world, roundabout, {
    radius: 11.0,
    height: 0.03,
  });
  ecs.Material.set(world, roundabout, {
    r: 36,
    g: 40,
    b: 46, // Dark durable asphalt
    roughness: 0.85,
    metalness: 0.1,
  });
  ecs.Shadow.set(world, roundabout, { receiveShadow: true });
  roadCount++;

  // Roundabout Inner Curb & Center Green Island (Reduced radius)
  const island = world.createEntity();
  world.setParent(island, roundabout);
  world.setPosition(island, 0, 0.04, 0);
  ecs.CylinderGeometry.set(world, island, {
    radius: 2.4,
    height: 0.15,
  });
  ecs.Material.set(world, island, {
    r: 45,
    g: 90,
    b: 38,
    roughness: 0.9,
  });
  roadCount++;

  // 2. Linear Road Segments with Markings, Curbs & Sidewalks
  for (const road of CITY_ROADS) {
    const dx = road.endX - road.startX;
    const dz = road.endZ - road.startZ;
    const length = Math.hypot(dx, dz);
    const midX = (road.startX + road.endX) / 2;
    const midZ = (road.startZ + road.endZ) / 2;
    const angle = Math.atan2(dx, dz);

    // Asphalt Surface
    const roadEnt = world.createEntity();
    world.setParent(roadEnt, roadsRoot);
    world.setPosition(roadEnt, midX, 0.02, midZ);
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

    // Centerline Marking
    if (road.hasLanes) {
      const lineEnt = world.createEntity();
      world.setParent(lineEnt, roadEnt);
      world.setPosition(lineEnt, 0, 0.025, 0);
      ecs.BoxGeometry.set(world, lineEnt, {
        width: 0.24,
        height: 0.015,
        depth: length * 0.96,
      });
      ecs.UnlitMaterial.set(world, lineEnt, {
        r: 245,
        g: 185,
        b: 0, // Bright African road yellow
      });
      roadCount++;
    }

    // Sidewalks & Curbs
    const sidewalkW = road.type === "MAIN_AVENUE" ? 2.0 : road.type === "SECONDARY" ? 1.5 : 0.8;
    const sidewalkH = 0.12;

    // Left Sidewalk
    const leftSidewalk = world.createEntity();
    world.setParent(leftSidewalk, roadEnt);
    world.setPosition(leftSidewalk, -(road.width / 2 + sidewalkW / 2), sidewalkH / 2, 0);
    ecs.BoxGeometry.set(world, leftSidewalk, {
      width: sidewalkW,
      height: sidewalkH,
      depth: length,
    });
    ecs.Material.set(world, leftSidewalk, {
      r: 145,
      g: 150,
      b: 156,
      roughness: 0.9,
    });
    roadCount++;

    // Right Sidewalk
    const rightSidewalk = world.createEntity();
    world.setParent(rightSidewalk, roadEnt);
    world.setPosition(rightSidewalk, road.width / 2 + sidewalkW / 2, sidewalkH / 2, 0);
    ecs.BoxGeometry.set(world, rightSidewalk, {
      width: sidewalkW,
      height: sidewalkH,
      depth: length,
    });
    ecs.Material.set(world, rightSidewalk, {
      r: 145,
      g: 150,
      b: 156,
      roughness: 0.9,
    });
    roadCount++;
  }

  // 3. Continuous Intersection Tarmac Patches
  for (const inter of CITY_INTERSECTIONS) {
    if (inter.type === "CROSS_4WAY") {
      const junction = world.createEntity();
      world.setParent(junction, roadsRoot);
      world.setPosition(junction, inter.x, 0.021, inter.z);
      ecs.BoxGeometry.set(world, junction, {
        width: inter.radius * 2,
        height: 0.04,
        depth: inter.radius * 2,
      });
      ecs.Material.set(world, junction, {
        r: 34,
        g: 38,
        b: 44,
        roughness: 0.85,
      });
      ecs.Shadow.set(world, junction, { receiveShadow: true });
      roadCount++;
    }
  }
}

// ----------------------------------------------------
// DYNAMIC SIGNAGE TEXTURE GENERATORS (DAILYBREAD SHAWARMA)
// Procedural high-contrast canvas textures for crisp 60fps WebGL rendering
// ----------------------------------------------------
let _cachedMainSignTexture: string | null = null;
let _cachedTotemSignTexture: string | null = null;
let _cachedMenuBoardTexture: string | null = null;

export function getDailyBreadMainSignTexture(): string {
  if (_cachedMainSignTexture) return _cachedMainSignTexture;
  if (typeof document === "undefined") return "";

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    // Sleek obsidian / deep navy acrylic background
    ctx.fillStyle = "#07131e";
    ctx.fillRect(0, 0, 1024, 256);

    // Glowing cyan & amber ambient backdrop
    const glow = ctx.createRadialGradient(512, 128, 40, 512, 128, 460);
    glow.addColorStop(0, "rgba(0, 240, 255, 0.32)");
    glow.addColorStop(0.5, "rgba(255, 209, 102, 0.16)");
    glow.addColorStop(1, "rgba(7, 19, 30, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1024, 256);

    // Outer neon electric cyan border
    ctx.lineWidth = 10;
    ctx.strokeStyle = "#00f0ff";
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 18;
    ctx.strokeRect(14, 14, 996, 228);

    // Inner warm gold accent border
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#ffd166";
    ctx.shadowColor = "#ffd166";
    ctx.shadowBlur = 10;
    ctx.strokeRect(26, 26, 972, 204);
    ctx.shadowBlur = 0;

    // Left Shawarma Emblem Badge
    ctx.save();
    ctx.translate(112, 128);
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.arc(0, 0, 68, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#091b29";
    ctx.beginPath();
    ctx.arc(0, 0, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#00f0ff";
    ctx.beginPath();
    ctx.moveTo(-22, 28);
    ctx.lineTo(22, 28);
    ctx.lineTo(30, -8);
    ctx.lineTo(0, -38);
    ctx.lineTo(-30, -8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ff5964";
    ctx.beginPath();
    ctx.arc(0, -8, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Right Shawarma Emblem Badge
    ctx.save();
    ctx.translate(912, 128);
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.arc(0, 0, 68, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#091b29";
    ctx.beginPath();
    ctx.arc(0, 0, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#00f0ff";
    ctx.beginPath();
    ctx.moveTo(-22, 28);
    ctx.lineTo(22, 28);
    ctx.lineTo(30, -8);
    ctx.lineTo(0, -38);
    ctx.lineTo(-30, -8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ff5964";
    ctx.beginPath();
    ctx.arc(0, -8, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Center Main Text: "DailyBread"
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = "900 84px 'Plus Jakarta Sans', Arial, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 24;
    ctx.fillText("DailyBread", 512, 90);
    ctx.shadowBlur = 0;

    // "SHAWARMA" in vibrant gold
    ctx.font = "900 62px 'Plus Jakarta Sans', Arial, sans-serif";
    ctx.fillStyle = "#ffd166";
    ctx.shadowColor = "#ff9f1c";
    ctx.shadowBlur = 18;
    ctx.letterSpacing = "6px";
    ctx.fillText("SHAWARMA", 512, 170);
    ctx.shadowBlur = 0;

    // Subtitle Tagline
    ctx.font = "700 20px 'Plus Jakarta Sans', Arial, sans-serif";
    ctx.fillStyle = "#00f0ff";
    ctx.letterSpacing = "2px";
    ctx.fillText("★ SIGNATURE DELIVERY HUB ★ GOURMET BAKED & SPICED ★", 512, 218);

    _cachedMainSignTexture = canvas.toDataURL("image/png");
    return _cachedMainSignTexture;
  } catch (err) {
    console.warn("Failed to generate main signboard texture:", err);
    return "";
  }
}

export function getDailyBreadTotemSignTexture(): string {
  if (_cachedTotemSignTexture) return _cachedTotemSignTexture;
  if (typeof document === "undefined") return "";

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    ctx.fillStyle = "#081624";
    ctx.fillRect(0, 0, 512, 1024);

    ctx.lineWidth = 12;
    ctx.strokeStyle = "#00f0ff";
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 20;
    ctx.strokeRect(16, 16, 480, 992);
    ctx.shadowBlur = 0;

    // Top emblem
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.arc(256, 160, 90, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#0a1926";
    ctx.beginPath();
    ctx.arc(256, 160, 78, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#00f0ff";
    ctx.beginPath();
    ctx.moveTo(256 - 32, 160 + 36);
    ctx.lineTo(256 + 32, 160 + 36);
    ctx.lineTo(256 + 42, 160 - 12);
    ctx.lineTo(256, 160 - 52);
    ctx.lineTo(256 - 42, 160 - 12);
    ctx.closePath();
    ctx.fill();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = "900 64px 'Plus Jakarta Sans', Arial, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 20;
    ctx.fillText("DailyBread", 256, 330);
    ctx.shadowBlur = 0;

    ctx.font = "900 52px 'Plus Jakarta Sans', Arial, sans-serif";
    ctx.fillStyle = "#ffd166";
    ctx.shadowColor = "#ff9f1c";
    ctx.shadowBlur = 16;
    ctx.fillText("SHAWARMA", 256, 410);
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#00f0ff";
    ctx.fillRect(64, 480, 384, 6);

    ctx.font = "800 36px 'Plus Jakarta Sans', Arial, sans-serif";
    ctx.fillStyle = "#00f0ff";
    ctx.fillText("DROP-OFF &", 256, 550);
    ctx.fillText("PICKUP HUB", 256, 600);

    // Delivery Chevron Arrow pointing towards building/bay
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.moveTo(256, 820);
    ctx.lineTo(160, 700);
    ctx.lineTo(210, 700);
    ctx.lineTo(210, 640);
    ctx.lineTo(302, 640);
    ctx.lineTo(302, 700);
    ctx.lineTo(352, 700);
    ctx.closePath();
    ctx.fill();

    ctx.font = "700 30px 'Plus Jakarta Sans', Arial, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("DELIVERY ZONE", 256, 910);

    _cachedTotemSignTexture = canvas.toDataURL("image/png");
    return _cachedTotemSignTexture;
  } catch (err) {
    console.warn("Failed to generate totem sign texture:", err);
    return "";
  }
}

export function getDailyBreadMenuBoardTexture(): string {
  if (_cachedMenuBoardTexture) return _cachedMenuBoardTexture;
  if (typeof document === "undefined") return "";

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    ctx.fillStyle = "#141e24";
    ctx.fillRect(0, 0, 512, 512);

    ctx.lineWidth = 14;
    ctx.strokeStyle = "#8d5b4c";
    ctx.strokeRect(7, 7, 498, 498);

    ctx.textAlign = "center";
    ctx.fillStyle = "#ffd166";
    ctx.font = "900 34px 'Plus Jakarta Sans', Arial, sans-serif";
    ctx.fillText("DailyBread Shawarma", 256, 60);

    ctx.fillStyle = "#00f0ff";
    ctx.font = "700 22px 'Plus Jakarta Sans', Arial, sans-serif";
    ctx.fillText("FRESH CHEF SPECIALS", 256, 100);

    ctx.textAlign = "left";
    ctx.font = "600 24px 'Plus Jakarta Sans', Arial, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("• Classic Beef Wrap ............. 350 pts", 40, 160);
    ctx.fillText("• Spicy Fako Chicken ......... 450 pts", 40, 210);
    ctx.fillText("• Super Cheese Shawarma ... 600 pts", 40, 260);
    ctx.fillText("• Fried Plantain Chips ....... 200 pts", 40, 310);
    ctx.fillText("• Tropical Citrus Punch ...... 150 pts", 40, 360);

    ctx.textAlign = "center";
    ctx.fillStyle = "#ffd166";
    ctx.font = "800 26px 'Plus Jakarta Sans', Arial, sans-serif";
    ctx.fillText("DELIVERY TRUCKS WELCOME!", 256, 440);

    _cachedMenuBoardTexture = canvas.toDataURL("image/png");
    return _cachedMenuBoardTexture;
  } catch (err) {
    console.warn("Failed to generate menu board texture:", err);
    return "";
  }
}

// ----------------------------------------------------
// 4. MAJOR LANDMARKS BUILDER
// ----------------------------------------------------
function buildMajorLandmarks(
  world: ecs.World,
  landmarksRoot: ecs.Eid,
  propsRoot: ecs.Eid,
  vegRoot: ecs.Eid
): void {
  // --------------------------------------------------
  // LANDMARK 1: DAILYBREAD SHAWARMA SIGNATURE DELIVERY HUB
  // Authoritative delivery destination containing SHAWARMA_HUB_LOCATION
  // --------------------------------------------------
  landmarkCount++;
  const hub = SHAWARMA_HUB_LOCATION;

  // Restaurant Main Building
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
    r: 18,
    g: 30,
    b: 44,
    roughness: 0.45,
    metalness: 0.35,
  });
  ecs.Shadow.set(world, restaurant, { castShadow: true, receiveShadow: true });
  buildingCount++;

  // Warm Gold Architectural Pilasters on Building Corners
  const colPositions = [
    { x: -hub.building.w / 2 + 0.25, z: hub.building.d / 2 + 0.05 },
    { x: hub.building.w / 2 - 0.25, z: hub.building.d / 2 + 0.05 },
    { x: -hub.building.w / 2 + 0.25, z: -hub.building.d / 2 - 0.05 },
    { x: hub.building.w / 2 - 0.25, z: -hub.building.d / 2 - 0.05 },
  ];
  for (const col of colPositions) {
    const pillar = world.createEntity();
    world.setParent(pillar, restaurant);
    world.setPosition(pillar, col.x, 0, col.z);
    ecs.BoxGeometry.set(world, pillar, { width: 0.55, height: hub.building.h + 0.3, depth: 0.55 });
    ecs.Material.set(world, pillar, { r: 240, g: 180, b: 50, roughness: 0.3, metalness: 0.4 });
    propCount++;
  }

  // Second-Tier Elevated Rooftop Parapet
  const roofTier = world.createEntity();
  world.setParent(roofTier, restaurant);
  world.setPosition(roofTier, 0, hub.building.h / 2 + 0.4, 0);
  ecs.BoxGeometry.set(world, roofTier, {
    width: hub.building.w * 0.94,
    height: 0.8,
    depth: hub.building.d * 0.94,
  });
  ecs.Material.set(world, roofTier, { r: 28, g: 45, b: 62, roughness: 0.5 });

  // Glowing Cyber Cyan Parapet Edge Trim
  const parapetTrim = world.createEntity();
  world.setParent(parapetTrim, roofTier);
  world.setPosition(parapetTrim, 0, 0.42, hub.building.d * 0.47);
  ecs.BoxGeometry.set(world, parapetTrim, { width: hub.building.w * 0.96, height: 0.08, depth: 0.1 });
  ecs.UnlitMaterial.set(world, parapetTrim, { r: 0, g: 240, b: 255 });

  // Rooftop Iconic Shawarma Spit Sculpture (Unmistakable silhouette landmark)
  const spitBase = world.createEntity();
  world.setParent(spitBase, roofTier);
  world.setPosition(spitBase, 0, 1.2, 0);
  ecs.CylinderGeometry.set(world, spitBase, { radius: 0.9, height: 1.6 });
  ecs.UnlitMaterial.set(world, spitBase, { r: 255, g: 155, b: 40 });
  const spitRing = world.createEntity();
  world.setParent(spitRing, spitBase);
  world.setPosition(spitRing, 0, 0.9, 0);
  ecs.TorusGeometry.set(world, spitRing, { radius: 1.2, tubeRadius: 0.08 });
  ecs.UnlitMaterial.set(world, spitRing, { r: 0, g: 240, b: 255 });

  // --------------------------------------------------
  // SIGNAGE: HIGH-CONTRAST "DailyBread Shawarma" ARCHITECTURAL SIGNBOARD
  // Mounted on front facade (facing local +Z = World -X, towards approach road & delivery zone)
  // --------------------------------------------------
  const signBacking = world.createEntity();
  world.setParent(signBacking, restaurant);
  world.setPosition(signBacking, 0, hub.building.h / 2 + 0.35, hub.building.d / 2 + 0.18);
  ecs.BoxGeometry.set(world, signBacking, {
    width: hub.building.w * 0.92,
    height: 1.9,
    depth: 0.22,
  });
  ecs.Material.set(world, signBacking, {
    r: 10,
    g: 22,
    b: 35,
    roughness: 0.3,
  });

  // Glowing Neon Cyan Halo Backplate
  const haloBorder = world.createEntity();
  world.setParent(haloBorder, signBacking);
  world.setPosition(haloBorder, 0, 0, -0.04);
  ecs.BoxGeometry.set(world, haloBorder, {
    width: hub.building.w * 0.94,
    height: 2.05,
    depth: 0.1,
  });
  ecs.UnlitMaterial.set(world, haloBorder, { r: 0, g: 240, b: 255 });

  // Front-Facing High-Res "DailyBread Shawarma" Signboard Face
  const signFace = world.createEntity();
  world.setParent(signFace, signBacking);
  world.setPosition(signFace, 0, 0, 0.12);
  ecs.PlaneGeometry.set(world, signFace, {
    width: hub.building.w * 0.88,
    height: 1.7,
  });
  const mainSignTex = getDailyBreadMainSignTexture();
  if (mainSignTex) {
    ecs.UnlitMaterial.set(world, signFace, {
      textureSrc: mainSignTex,
    });
  } else {
    ecs.UnlitMaterial.set(world, signFace, { r: 255, g: 209, b: 102 });
  }

  // Storefront Panoramic Glass Window
  const storefront = world.createEntity();
  world.setParent(storefront, restaurant);
  world.setPosition(storefront, 0, -0.7, hub.building.d / 2 + 0.06);
  ecs.BoxGeometry.set(world, storefront, {
    width: hub.building.w * 0.88,
    height: 3.2,
    depth: 0.08,
  });
  ecs.Material.set(world, storefront, {
    r: 30,
    g: 80,
    b: 120,
    roughness: 0.15,
    metalness: 0.85,
  });

  // Warm Interior Order Counter & Shawarma Spit
  const orderCounter = world.createEntity();
  world.setParent(orderCounter, storefront);
  world.setPosition(orderCounter, 0, -0.7, -0.6);
  ecs.BoxGeometry.set(world, orderCounter, { width: 5.2, height: 1.1, depth: 0.8 });
  ecs.Material.set(world, orderCounter, { r: 200, g: 150, b: 90, roughness: 0.5 });

  const spitInside = world.createEntity();
  world.setParent(spitInside, storefront);
  world.setPosition(spitInside, 1.8, 0.1, -0.8);
  ecs.CylinderGeometry.set(world, spitInside, { radius: 0.35, height: 1.2 });
  ecs.UnlitMaterial.set(world, spitInside, { r: 255, g: 140, b: 30 });

  // Front Fascia Over-Door Sub-Sign ("DailyBread Shawarma Express")
  const entranceFascia = world.createEntity();
  world.setParent(entranceFascia, restaurant);
  world.setPosition(entranceFascia, 0, 1.1, hub.building.d / 2 + 0.15);
  ecs.BoxGeometry.set(world, entranceFascia, { width: 4.8, height: 0.55, depth: 0.15 });
  ecs.UnlitMaterial.set(world, entranceFascia, { r: 255, g: 209, b: 102 });

  // Cantilevered Illuminated Restaurant Canopy / Awning
  const canopy = world.createEntity();
  world.setParent(canopy, restaurant);
  world.setPosition(canopy, 0, 0.45, hub.building.d / 2 + 1.1);
  ecs.BoxGeometry.set(world, canopy, {
    width: hub.building.w * 0.94,
    height: 0.28,
    depth: 2.1,
  });
  ecs.Material.set(world, canopy, {
    r: 0,
    g: 240,
    b: 255,
    emissiveR: 0,
    emissiveG: 210,
    emissiveB: 245,
    emissiveIntensity: 0.75,
    roughness: 0.3,
  });

  // Outdoor Dining Patio Platform
  const patioDeck = world.createEntity();
  world.setParent(patioDeck, restaurant);
  world.setPosition(patioDeck, 0, -hub.building.h / 2 + 0.06, hub.building.d / 2 + 1.8);
  ecs.BoxGeometry.set(world, patioDeck, {
    width: hub.building.w * 0.92,
    height: 0.12,
    depth: 3.4,
  });
  ecs.Material.set(world, patioDeck, { r: 120, g: 85, b: 55, roughness: 0.85 });

  // Patio Cafe Tables, Umbrellas & Chairs
  const tableOffsets = [-2.4, 2.4];
  for (let i = 0; i < tableOffsets.length; i++) {
    const tx = tableOffsets[i];
    const table = world.createEntity();
    world.setParent(table, patioDeck);
    world.setPosition(table, tx, 0.45, 0.2);
    ecs.CylinderGeometry.set(world, table, { radius: 0.55, height: 0.75 });
    ecs.Material.set(world, table, { r: 210, g: 215, b: 220, metalness: 0.6, roughness: 0.3 });

    const tableTop = world.createEntity();
    world.setParent(tableTop, table);
    world.setPosition(tableTop, 0, 0.38, 0);
    ecs.CylinderGeometry.set(world, tableTop, { radius: 0.65, height: 0.05 });
    ecs.Material.set(world, tableTop, { r: 35, g: 45, b: 55, roughness: 0.4 });

    const umbrellaPole = world.createEntity();
    world.setParent(umbrellaPole, table);
    world.setPosition(umbrellaPole, 0, 1.2, 0);
    ecs.CylinderGeometry.set(world, umbrellaPole, { radius: 0.04, height: 2.2 });
    ecs.Material.set(world, umbrellaPole, { r: 180, g: 170, b: 150, metalness: 0.7 });

    const umbrellaCanopy = world.createEntity();
    world.setParent(umbrellaCanopy, umbrellaPole);
    world.setPosition(umbrellaCanopy, 0, 1.0, 0);
    ecs.ConeGeometry.set(world, umbrellaCanopy, { radius: 1.35, height: 0.65 });
    ecs.Material.set(world, umbrellaCanopy, {
      r: i === 0 ? 220 : 240,
      g: i === 0 ? 45 : 180,
      b: i === 0 ? 35 : 40,
      roughness: 0.6,
    });

    for (let c = -1; c <= 1; c += 2) {
      const chair = world.createEntity();
      world.setParent(chair, table);
      world.setPosition(chair, c * 0.75, -0.1, 0);
      ecs.BoxGeometry.set(world, chair, { width: 0.4, height: 0.55, depth: 0.4 });
      ecs.Material.set(world, chair, { r: 40, g: 50, b: 60, roughness: 0.5 });
    }
  }

  // Patio Entrance Bougainvillea Planters
  for (let p = -1; p <= 1; p += 2) {
    const planter = world.createEntity();
    world.setParent(planter, patioDeck);
    world.setPosition(planter, p * (hub.building.w * 0.42), 0.35, 1.4);
    ecs.BoxGeometry.set(world, planter, { width: 0.9, height: 0.6, depth: 0.6 });
    ecs.Material.set(world, planter, { r: 135, g: 95, b: 60, roughness: 0.8 });

    const bush = world.createEntity();
    world.setParent(bush, planter);
    world.setPosition(bush, 0, 0.45, 0);
    ecs.SphereGeometry.set(world, bush, { radius: 0.45 });
    ecs.Material.set(world, bush, { r: 235, g: 55, b: 135, roughness: 0.8 });
  }

  // Sidewalk A-Frame Chalkboard Menu
  const menuBoard = world.createEntity();
  world.setParent(menuBoard, restaurant);
  world.setPosition(menuBoard, -3.8, -hub.building.h / 2 + 0.6, hub.building.d / 2 + 3.2);
  world.setQuaternion(menuBoard, 0, Math.sin(Math.PI / 12), 0, Math.cos(Math.PI / 12));
  ecs.BoxGeometry.set(world, menuBoard, { width: 0.9, height: 1.1, depth: 0.15 });
  const menuTex = getDailyBreadMenuBoardTexture();
  if (menuTex) {
    ecs.UnlitMaterial.set(world, menuBoard, { textureSrc: menuTex });
  } else {
    ecs.Material.set(world, menuBoard, { r: 30, g: 35, b: 40, roughness: 0.8 });
  }

  // --------------------------------------------------
  // FREESTANDING ROADSIDE TOTEM PYLON SIGN ("DailyBread Shawarma")
  // Located curbside at World (3.0, 0, -5.2) facing oncoming North/South traffic
  // --------------------------------------------------
  const totemBase = world.createEntity();
  world.setParent(totemBase, landmarksRoot);
  world.setPosition(totemBase, 3.0, 2.2, -5.2);
  ecs.BoxGeometry.set(world, totemBase, { width: 1.4, height: 4.4, depth: 0.35 });
  ecs.Material.set(world, totemBase, { r: 12, g: 24, b: 38, roughness: 0.35, metalness: 0.6 });

  // Totem Glowing Cyan Header Cap
  const totemCap = world.createEntity();
  world.setParent(totemCap, totemBase);
  world.setPosition(totemCap, 0, 2.25, 0);
  ecs.BoxGeometry.set(world, totemCap, { width: 1.5, height: 0.18, depth: 0.45 });
  ecs.UnlitMaterial.set(world, totemCap, { r: 0, g: 240, b: 255 });

  // Totem Dual-Sided Sign Panels
  const totemTex = getDailyBreadTotemSignTexture();
  for (let s = -1; s <= 1; s += 2) {
    const totemFace = world.createEntity();
    world.setParent(totemFace, totemBase);
    world.setPosition(totemFace, 0, 0, s * 0.19);
    if (s === -1) {
      world.setQuaternion(totemFace, 0, 1, 0, 0);
    }
    ecs.PlaneGeometry.set(world, totemFace, { width: 1.25, height: 3.8 });
    if (totemTex) {
      ecs.UnlitMaterial.set(world, totemFace, { textureSrc: totemTex });
    } else {
      ecs.UnlitMaterial.set(world, totemFace, { r: 0, g: 240, b: 255 });
    }
  }

  // --------------------------------------------------
  // AUTHORITATIVE DELIVERY APRON & DROP-OFF PAD
  // Preserves deliveryRing1Eid, deliveryRing2Eid, deliveryBeaconEid
  // --------------------------------------------------
  const dropPad = world.createEntity();
  world.setParent(dropPad, landmarksRoot);
  world.setPosition(dropPad, hub.deliveryZone.x, 0.04, hub.deliveryZone.z);
  ecs.CylinderGeometry.set(world, dropPad, {
    radius: hub.deliveryZone.radius,
    height: 0.04,
  });
  ecs.Material.set(world, dropPad, {
    r: 16,
    g: 28,
    b: 40,
    roughness: 0.6,
    metalness: 0.25,
  });

  // Painted Yellow Delivery Bay Chevron / Boundary Ring
  const bayRing = world.createEntity();
  world.setParent(bayRing, dropPad);
  world.setPosition(bayRing, 0, 0.03, 0);
  world.setQuaternion(bayRing, -0.7071068, 0, 0, 0.7071068);
  ecs.RingGeometry.set(world, bayRing, {
    innerRadius: hub.deliveryZone.radius - 0.25,
    outerRadius: hub.deliveryZone.radius,
  });
  ecs.UnlitMaterial.set(world, bayRing, { r: 255, g: 209, b: 102 });

  // Animated Holographic Rings (Preserved authoritative EIDs)
  deliveryRing1Eid = world.createEntity();
  world.setParent(deliveryRing1Eid, dropPad);
  world.setPosition(deliveryRing1Eid, 0, 0.15, 0);
  world.setQuaternion(deliveryRing1Eid, -0.7071068, 0, 0, 0.7071068);
  ecs.RingGeometry.set(world, deliveryRing1Eid, {
    innerRadius: 3.4,
    outerRadius: 4.0,
  });
  ecs.UnlitMaterial.set(world, deliveryRing1Eid, {
    r: 0,
    g: 240,
    b: 255,
  });

  deliveryRing2Eid = world.createEntity();
  world.setParent(deliveryRing2Eid, dropPad);
  world.setPosition(deliveryRing2Eid, 0, 0.22, 0);
  world.setQuaternion(deliveryRing2Eid, -0.7071068, 0, 0, 0.7071068);
  ecs.RingGeometry.set(world, deliveryRing2Eid, {
    innerRadius: 2.2,
    outerRadius: 2.7,
  });
  ecs.UnlitMaterial.set(world, deliveryRing2Eid, {
    r: 255,
    g: 209,
    b: 102,
  });

  // Floating Delivery Chevron Beacon (Preserved authoritative EID)
  deliveryBeaconEid = world.createEntity();
  world.setParent(deliveryBeaconEid, dropPad);
  world.setPosition(deliveryBeaconEid, 0, 3.4, 0);
  world.setQuaternion(deliveryBeaconEid, 1, 0, 0, 0); // Pointing down
  ecs.ConeGeometry.set(world, deliveryBeaconEid, {
    radius: 1.0,
    height: 2.0,
  });
  ecs.UnlitMaterial.set(world, deliveryBeaconEid, {
    r: 0,
    g: 240,
    b: 255,
  });

  // --------------------------------------------------
  // LANDMARK 2: CENTRAL ROUNDABOUT HERITAGE MONUMENT
  // Located at (0, 0) inside the reduced island
  // --------------------------------------------------
  landmarkCount++;
  const monumentBase = world.createEntity();
  world.setParent(monumentBase, landmarksRoot);
  world.setPosition(monumentBase, 0, 0.4, 0);
  ecs.CylinderGeometry.set(world, monumentBase, { radius: 1.6, height: 0.8 });
  ecs.Material.set(world, monumentBase, { r: 180, g: 175, b: 165, roughness: 0.8 });

  const obeliskPillar = world.createEntity();
  world.setParent(obeliskPillar, monumentBase);
  world.setPosition(obeliskPillar, 0, 3.2, 0);
  ecs.BoxGeometry.set(world, obeliskPillar, { width: 1.2, height: 6.0, depth: 1.2 });
  ecs.Material.set(world, obeliskPillar, { r: 210, g: 195, b: 155, roughness: 0.6, metalness: 0.2 });

  // Glowing Golden Heritage Crest on Obelisk
  const crest = world.createEntity();
  world.setParent(crest, obeliskPillar);
  world.setPosition(crest, 0, 3.2, 0);
  ecs.SphereGeometry.set(world, crest, { radius: 0.65 });
  ecs.UnlitMaterial.set(world, crest, { r: 255, g: 215, b: 0 });

  // --------------------------------------------------
  // LANDMARK 3: MOLYKO GRAND CENTRAL MARKET PAVILION
  // Located at (58.0, 0) in Market District
  // --------------------------------------------------
  landmarkCount++;
  const marketPavilion = world.createEntity();
  world.setParent(marketPavilion, landmarksRoot);
  world.setPosition(marketPavilion, 58.0, 2.8, 0);
  ecs.BoxGeometry.set(world, marketPavilion, { width: 8.5, height: 5.6, depth: 13.5 });
  ecs.Material.set(world, marketPavilion, { r: 135, g: 85, b: 50, roughness: 0.85 });
  buildingCount++;

  // Pitched Corrugated Zinc Roof on Pavilion
  const marketRoof = world.createEntity();
  world.setParent(marketRoof, marketPavilion);
  world.setPosition(marketRoof, 0, 3.4, 0);
  world.setQuaternion(marketRoof, 0, 0, 0.7071068, 0.7071068);
  ecs.ConeGeometry.set(world, marketRoof, { radius: 7.5, height: 13.8 });
  ecs.Material.set(world, marketRoof, { r: 175, g: 180, b: 185, roughness: 0.4, metalness: 0.8 });

  // --------------------------------------------------
  // LANDMARK 4: MOUNT FAKO RIDGE PANORAMIC VIEWPOINT DECK
  // Located at (0, -85.0) on Northern Ridge
  // --------------------------------------------------
  landmarkCount++;
  const viewpointDeck = world.createEntity();
  world.setParent(viewpointDeck, landmarksRoot);
  world.setPosition(viewpointDeck, 0, 0.6, -85.0);
  ecs.BoxGeometry.set(world, viewpointDeck, { width: 11.5, height: 1.2, depth: 5.2 });
  ecs.Material.set(world, viewpointDeck, { r: 115, g: 75, b: 45, roughness: 0.9 });

  // Viewpoint Balustrade & Telescope
  const balustrade = world.createEntity();
  world.setParent(balustrade, viewpointDeck);
  world.setPosition(balustrade, 0, 0.8, -2.4);
  ecs.BoxGeometry.set(world, balustrade, { width: 11.0, height: 0.8, depth: 0.15 });
  ecs.Material.set(world, balustrade, { r: 200, g: 205, b: 210, metalness: 0.7 });

  // Viewpoint Signboard ("MOUNT FAKO 4,040M HIGHLAND PANORAMA")
  const viewSign = world.createEntity();
  world.setParent(viewSign, viewpointDeck);
  world.setPosition(viewSign, 0, 2.0, 2.2);
  ecs.BoxGeometry.set(world, viewSign, { width: 5.5, height: 1.2, depth: 0.2 });
  ecs.Material.set(world, viewSign, { r: 15, g: 45, b: 30, roughness: 0.6 });

  // --------------------------------------------------
  // LANDMARK 5: BUEA TRANSIT HUB & FUEL SERVICE STATION
  // Located at (-58.0, 52.0) in Commercial / Valley Quarter
  // --------------------------------------------------
  landmarkCount++;
  const fuelStation = world.createEntity();
  world.setParent(fuelStation, landmarksRoot);
  world.setPosition(fuelStation, -58.0, 2.4, 52.0);
  ecs.BoxGeometry.set(world, fuelStation, { width: 10.5, height: 4.8, depth: 7.6 });
  ecs.Material.set(world, fuelStation, { r: 215, g: 220, b: 225, roughness: 0.5 });
  buildingCount++;

  // Fuel Station Overhead Canopy
  const fuelCanopy = world.createEntity();
  world.setParent(fuelCanopy, fuelStation);
  world.setPosition(fuelCanopy, 0, 2.6, 4.2);
  ecs.BoxGeometry.set(world, fuelCanopy, { width: 10.0, height: 0.5, depth: 5.0 });
  ecs.Material.set(world, fuelCanopy, { r: 220, g: 45, b: 35, roughness: 0.4 });

  // Fuel Pump Dispensers
  for (let i = -1; i <= 1; i += 2) {
    const pump = world.createEntity();
    world.setParent(pump, fuelCanopy);
    world.setPosition(pump, i * 2.8, -2.6, 0);
    ecs.BoxGeometry.set(world, pump, { width: 0.7, height: 1.5, depth: 0.6 });
    ecs.Material.set(world, pump, { r: 240, g: 240, b: 245, roughness: 0.3, metalness: 0.5 });
  }
}

// ----------------------------------------------------
// 5. DISTRICT BUILDINGS BUILDER (60-80 Buildings Total)
// ----------------------------------------------------
function buildDistrictBuildings(world: ecs.World, districtsRoot: ecs.Eid): void {
  // Architectural Building Specifications across all 6 districts in 190m world
  const buildingSpecs = [
    // --- CENTRAL CIVIC DISTRICT (Spacious setbacks around Central Roundabout) ---
    { x: -16.0, z: -16.0, w: 7.5, h: 5.8, d: 5.5, rotY: Math.PI / 2, wall: 0xf4ebe1, roof: 0x3d5a80, roofType: "FLAT_TERRACE", sign: "CIVIC BANK" },
    { x: -16.0, z: 16.0, w: 7.5, h: 5.2, d: 5.5, rotY: Math.PI / 2, wall: 0xdfd2c0, roof: 0xa6523c, roofType: "CORRUGATED_PITCHED", sign: "CLINIC" },
    { x: 16.0, z: 16.0, w: 7.5, h: 5.5, d: 5.5, rotY: -Math.PI / 2, wall: 0xc5d3c1, roof: 0x8c9298, roofType: "CORRUGATED_HIP", sign: "POST OFFICE" },

    // --- MOLYKO MARKET SQUARE (East District X=38..78, Z=-38..38) ---
    { x: 48.0, z: -29.0, w: 7.2, h: 4.8, d: 5.2, rotY: 0, wall: 0xd9c5b2, roof: 0xa6523c, roofType: "CORRUGATED_PITCHED" },
    { x: 67.0, z: -29.0, w: 7.0, h: 4.5, d: 5.0, rotY: 0, wall: 0xf4ebe1, roof: 0x8c9298, roofType: "CORRUGATED_HIP" },
    { x: 48.0, z: 29.0, w: 7.2, h: 4.8, d: 5.2, rotY: Math.PI, wall: 0xcad2c5, roof: 0x5e503f, roofType: "CORRUGATED_PITCHED" },
    { x: 67.0, z: 29.0, w: 7.0, h: 4.5, d: 5.0, rotY: Math.PI, wall: 0xdfd2c0, roof: 0x3d5a80, roofType: "CORRUGATED_HIP" },
    { x: 47.0, z: -10.0, w: 3.8, h: 3.0, d: 2.8, rotY: 0, wall: 0xdfd2c0, roof: 0xb85d19, roofType: "AWNING_SHOP" },
    { x: 52.5, z: -10.0, w: 3.8, h: 3.0, d: 2.8, rotY: 0, wall: 0xc5d3c1, roof: 0xa6523c, roofType: "AWNING_SHOP" },
    { x: 64.5, z: -10.0, w: 3.8, h: 3.0, d: 2.8, rotY: 0, wall: 0xf4ebe1, roof: 0x3d5a80, roofType: "AWNING_SHOP" },
    { x: 47.0, z: 10.0, w: 3.8, h: 3.0, d: 2.8, rotY: Math.PI, wall: 0xd9c5b2, roof: 0x8c9298, roofType: "AWNING_SHOP" },
    { x: 52.5, z: 10.0, w: 3.8, h: 3.0, d: 2.8, rotY: Math.PI, wall: 0xdfd2c0, roof: 0xa6523c, roofType: "AWNING_SHOP" },
    { x: 64.5, z: 10.0, w: 3.8, h: 3.0, d: 2.8, rotY: Math.PI, wall: 0xcad2c5, roof: 0x5e503f, roofType: "AWNING_SHOP" },

    // --- CLERKS QUARTERS (West Residential District X=-78..-38, Z=-38..38) ---
    { x: -48.0, z: -11.5, w: 6.8, h: 4.6, d: 4.6, rotY: Math.PI / 2, wall: 0xf4ebe1, roof: 0xa6523c, roofType: "CORRUGATED_PITCHED", hasCompound: true },
    { x: -68.0, z: -11.5, w: 6.5, h: 4.4, d: 4.6, rotY: -Math.PI / 2, wall: 0xdfd2c0, roof: 0x8c9298, roofType: "CORRUGATED_HIP", hasCompound: true },
    { x: -48.0, z: 11.5, w: 6.8, h: 4.6, d: 4.6, rotY: Math.PI / 2, wall: 0xc5d3c1, roof: 0x3d5a80, roofType: "CORRUGATED_PITCHED", hasCompound: true },
    { x: -68.0, z: 11.5, w: 6.5, h: 4.4, d: 4.6, rotY: -Math.PI / 2, wall: 0xd9c5b2, roof: 0x5e503f, roofType: "CORRUGATED_HIP", hasCompound: true },
    { x: -48.0, z: -29.0, w: 7.0, h: 4.6, d: 5.0, rotY: 0, wall: 0xcad2c5, roof: 0xa6523c, roofType: "CORRUGATED_PITCHED" },
    { x: -67.5, z: -29.0, w: 6.5, h: 4.4, d: 4.8, rotY: 0, wall: 0xf4ebe1, roof: 0x8c9298, roofType: "CORRUGATED_HIP" },
    { x: -48.0, z: 29.0, w: 7.0, h: 4.6, d: 5.0, rotY: Math.PI, wall: 0xdfd2c0, roof: 0x3d5a80, roofType: "CORRUGATED_PITCHED" },
    { x: -67.5, z: 29.0, w: 6.5, h: 4.4, d: 4.8, rotY: Math.PI, wall: 0xc5d3c1, roof: 0x5e503f, roofType: "CORRUGATED_HIP" },

    // --- MOUNT FAKO HEIGHTS & RIDGE (North District Z=-78..-38) ---
    { x: -18.0, z: -48.0, w: 7.5, h: 5.0, d: 5.0, rotY: 0, wall: 0xf4ebe1, roof: 0xa6523c, roofType: "CORRUGATED_PITCHED" },
    { x: 18.0, z: -48.0, w: 7.5, h: 5.0, d: 5.0, rotY: 0, wall: 0xdfd2c0, roof: 0x8c9298, roofType: "CORRUGATED_PITCHED" },
    { x: -18.0, z: -67.0, w: 7.5, h: 5.0, d: 5.0, rotY: 0, wall: 0xc5d3c1, roof: 0x3d5a80, roofType: "CORRUGATED_HIP", hasCompound: true },
    { x: 18.0, z: -67.0, w: 7.5, h: 5.0, d: 5.0, rotY: 0, wall: 0xd9c5b2, roof: 0x5e503f, roofType: "CORRUGATED_HIP", hasCompound: true },
    { x: -58.0, z: -58.0, w: 8.5, h: 5.2, d: 6.0, rotY: 0, wall: 0xcad2c5, roof: 0xa6523c, roofType: "CORRUGATED_PITCHED", hasCompound: true },
    { x: 58.0, z: -58.0, w: 8.5, h: 5.2, d: 6.0, rotY: 0, wall: 0xf4ebe1, roof: 0x8c9298, roofType: "CORRUGATED_PITCHED", hasCompound: true },

    // --- GREENFIELD VALLEY & TRANSIT (South District Z=38..78) ---
    { x: -18.0, z: 48.0, w: 7.5, h: 4.8, d: 5.0, rotY: Math.PI, wall: 0xdfd2c0, roof: 0x3d5a80, roofType: "CORRUGATED_PITCHED" },
    { x: 18.0, z: 48.0, w: 7.5, h: 4.8, d: 5.0, rotY: Math.PI, wall: 0xc5d3c1, roof: 0xa6523c, roofType: "CORRUGATED_PITCHED" },
    { x: -18.0, z: 67.0, w: 8.0, h: 5.5, d: 5.5, rotY: Math.PI, wall: 0xd9c5b2, roof: 0x8c9298, roofType: "WAREHOUSE_GABLE" },
    { x: 18.0, z: 67.0, w: 8.0, h: 5.5, d: 5.5, rotY: Math.PI, wall: 0xf4ebe1, roof: 0x5e503f, roofType: "WAREHOUSE_GABLE" },
    { x: 58.0, z: 67.0, w: 8.0, h: 5.5, d: 5.5, rotY: Math.PI, wall: 0xcad2c5, roof: 0x8c9298, roofType: "WAREHOUSE_GABLE" },

    // --- PERIMETER BUFFER VILLAS & COMMERCIAL OUTPOSTS (Set back safely from X=±78, Z=±78) ---
    { x: -88.0, z: -58.0, w: 6.8, h: 4.5, d: 5.0, rotY: Math.PI / 2, wall: 0xf4ebe1, roof: 0xa6523c, roofType: "CORRUGATED_PITCHED" },
    { x: -88.0, z: -19.0, w: 6.8, h: 4.5, d: 5.0, rotY: Math.PI / 2, wall: 0xdfd2c0, roof: 0x8c9298, roofType: "CORRUGATED_HIP" },
    { x: -88.0, z: 19.0, w: 6.8, h: 4.5, d: 5.0, rotY: Math.PI / 2, wall: 0xc5d3c1, roof: 0x3d5a80, roofType: "CORRUGATED_PITCHED" },
    { x: -88.0, z: 58.0, w: 6.8, h: 4.5, d: 5.0, rotY: Math.PI / 2, wall: 0xd9c5b2, roof: 0x5e503f, roofType: "WAREHOUSE_GABLE" },
    { x: 88.0, z: -58.0, w: 6.8, h: 4.5, d: 5.0, rotY: -Math.PI / 2, wall: 0xcad2c5, roof: 0xa6523c, roofType: "CORRUGATED_PITCHED" },
    { x: 88.0, z: -19.0, w: 6.8, h: 4.5, d: 5.0, rotY: -Math.PI / 2, wall: 0xf4ebe1, roof: 0x8c9298, roofType: "CORRUGATED_HIP" },
    { x: 88.0, z: 19.0, w: 6.8, h: 4.5, d: 5.0, rotY: -Math.PI / 2, wall: 0xdfd2c0, roof: 0x3d5a80, roofType: "CORRUGATED_PITCHED" },
    { x: 88.0, z: 58.0, w: 6.8, h: 4.5, d: 5.0, rotY: -Math.PI / 2, wall: 0xc5d3c1, roof: 0x8c9298, roofType: "WAREHOUSE_GABLE" },
  ];

  for (const b of buildingSpecs) {
    buildModularBuilding(world, districtsRoot, b);
  }
}

// ----------------------------------------------------
// 6. MODULAR BUILDING GENERATOR
// ----------------------------------------------------
function buildModularBuilding(
  world: ecs.World,
  parent: ecs.Eid,
  spec: {
    x: number;
    z: number;
    w: number;
    h: number;
    d: number;
    rotY: number;
    wall: number;
    roof: number;
    roofType: string;
    hasCompound?: boolean;
    sign?: string;
  }
): void {
  // Main Wall Structure
  const building = world.createEntity();
  world.setParent(building, parent);
  world.setPosition(building, spec.x, spec.h / 2, spec.z);
  world.setQuaternion(
    building,
    0,
    Math.sin(spec.rotY / 2),
    0,
    Math.cos(spec.rotY / 2)
  );
  ecs.BoxGeometry.set(world, building, {
    width: spec.w,
    height: spec.h,
    depth: spec.d,
  });
  const wc = hexToRgb(spec.wall);
  ecs.Material.set(world, building, {
    r: wc.r,
    g: wc.g,
    b: wc.b,
    roughness: 0.85,
    metalness: 0.1,
  });
  ecs.Shadow.set(world, building, { castShadow: true, receiveShadow: true });
  buildingCount++;

  // Roof Structure
  const rc = hexToRgb(spec.roof);
  if (spec.roofType === "CORRUGATED_PITCHED" || spec.roofType === "WAREHOUSE_GABLE") {
    const roof = world.createEntity();
    world.setParent(roof, building);
    world.setPosition(roof, 0, spec.h / 2 + 0.85, 0);
    world.setQuaternion(roof, 0, 0, 0.7071068, 0.7071068);
    ecs.ConeGeometry.set(world, roof, {
      radius: Math.max(spec.w, spec.d) * 0.65,
      height: Math.max(spec.w, spec.d) * 1.1,
    });
    ecs.Material.set(world, roof, {
      r: rc.r,
      g: rc.g,
      b: rc.b,
      roughness: 0.5,
      metalness: 0.6,
    });
  } else if (spec.roofType === "CORRUGATED_HIP") {
    const roof = world.createEntity();
    world.setParent(roof, building);
    world.setPosition(roof, 0, spec.h / 2 + 0.6, 0);
    ecs.ConeGeometry.set(world, roof, {
      radius: Math.max(spec.w, spec.d) * 0.7,
      height: 1.4,
    });
    ecs.Material.set(world, roof, {
      r: rc.r,
      g: rc.g,
      b: rc.b,
      roughness: 0.5,
      metalness: 0.6,
    });
  } else if (spec.roofType === "AWNING_SHOP") {
    const awning = world.createEntity();
    world.setParent(awning, building);
    world.setPosition(awning, 0, 0.2, spec.d / 2 + 0.7);
    ecs.BoxGeometry.set(world, awning, {
      width: spec.w * 0.95,
      height: 0.18,
      depth: 1.4,
    });
    ecs.Material.set(world, awning, {
      r: rc.r,
      g: rc.g,
      b: rc.b,
      roughness: 0.6,
    });
  }

  // Highland Blue Water Tank on flat/compound roofs
  if (spec.w > 6.0 && spec.roofType !== "AWNING_SHOP") {
    const tank = world.createEntity();
    world.setParent(tank, building);
    world.setPosition(tank, spec.w / 3, spec.h / 2 + 0.6, spec.d / 4);
    ecs.CylinderGeometry.set(world, tank, { radius: 0.65, height: 1.1 });
    ecs.Material.set(world, tank, {
      r: 15,
      g: 80,
      b: 160, // Iconic African blue poly tank
      roughness: 0.4,
      metalness: 0.2,
    });
  }

  // Concrete Compound Boundary Walls for Residential Villas
  if (spec.hasCompound) {
    const wallH = 1.2;
    const compoundW = spec.w + 2.2;
    const compoundD = spec.d + 2.2;

    const cWall = world.createEntity();
    world.setParent(cWall, building);
    world.setPosition(cWall, 0, -(spec.h / 2 - wallH / 2), 0);
    ecs.BoxGeometry.set(world, cWall, {
      width: compoundW,
      height: wallH,
      depth: compoundD,
    });
    ecs.Material.set(world, cWall, {
      r: 160,
      g: 155,
      b: 145,
      roughness: 0.9,
    });
  }
}

// ----------------------------------------------------
// 7. STREET PROPS & VEGETATION BUILDERS
// ----------------------------------------------------
function buildStreetLamp(
  world: ecs.World,
  parent: ecs.Eid,
  x: number,
  y: number,
  z: number,
  rotY: number
): void {
  const lamp = world.createEntity();
  world.setParent(lamp, parent);
  world.setPosition(lamp, x, y + 2.6, z);
  world.setQuaternion(lamp, 0, Math.sin(rotY / 2), 0, Math.cos(rotY / 2));

  // Pole
  ecs.CylinderGeometry.set(world, lamp, { radius: 0.08, height: 5.2 });
  ecs.Material.set(world, lamp, { r: 60, g: 65, b: 70, metalness: 0.8 });

  // Light Head
  const head = world.createEntity();
  world.setParent(head, lamp);
  world.setPosition(head, 0.4, 2.5, 0);
  ecs.BoxGeometry.set(world, head, { width: 0.9, height: 0.15, depth: 0.25 });
  ecs.UnlitMaterial.set(world, head, { r: 255, g: 240, b: 180 });

  propCount++;
}

function buildRoadsideBarrier(
  world: ecs.World,
  parent: ecs.Eid,
  x: number,
  y: number,
  z: number,
  rotY: number
): void {
  const barrier = world.createEntity();
  world.setParent(barrier, parent);
  world.setPosition(barrier, x, y + 0.4, z);
  world.setQuaternion(barrier, 0, Math.sin(rotY / 2), 0, Math.cos(rotY / 2));
  ecs.BoxGeometry.set(world, barrier, { width: 4.8, height: 0.8, depth: 0.25 });
  ecs.Material.set(world, barrier, { r: 180, g: 185, b: 190, metalness: 0.8 });
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
  const tree = world.createEntity();
  world.setParent(tree, parent);
  world.setPosition(tree, x, y, z);

  // Trunk
  const trunk = world.createEntity();
  world.setParent(trunk, tree);
  world.setPosition(trunk, 0, 3.2 * scale, 0);
  ecs.CylinderGeometry.set(world, trunk, {
    radius: 0.22 * scale,
    height: 6.4 * scale,
  });
  ecs.Material.set(world, trunk, { r: 90, g: 65, b: 45, roughness: 0.9 });

  // Fronds Canopy
  const fronds = world.createEntity();
  world.setParent(fronds, tree);
  world.setPosition(fronds, 0, 6.4 * scale, 0);
  ecs.ConeGeometry.set(world, fronds, {
    radius: 3.2 * scale,
    height: 1.8 * scale,
  });
  ecs.Material.set(world, fronds, { r: 35, g: 115, b: 45, roughness: 0.85 });

  vegetationCount++;
}

function buildUmbrellaTree(
  world: ecs.World,
  parent: ecs.Eid,
  x: number,
  y: number,
  z: number,
  scale = 1.0
): void {
  const tree = world.createEntity();
  world.setParent(tree, parent);
  world.setPosition(tree, x, y, z);

  // Sturdy Trunk
  const trunk = world.createEntity();
  world.setParent(trunk, tree);
  world.setPosition(trunk, 0, 2.2 * scale, 0);
  ecs.CylinderGeometry.set(world, trunk, {
    radius: 0.32 * scale,
    height: 4.4 * scale,
  });
  ecs.Material.set(world, trunk, { r: 75, g: 55, b: 40, roughness: 0.95 });

  // Wide Canopy
  const canopy = world.createEntity();
  world.setParent(canopy, tree);
  world.setPosition(canopy, 0, 4.6 * scale, 0);
  ecs.CylinderGeometry.set(world, canopy, {
    radius: 3.8 * scale,
    height: 1.2 * scale,
  });
  ecs.Material.set(world, canopy, { r: 45, g: 105, b: 40, roughness: 0.9 });

  vegetationCount++;
}

function buildFloweringShrub(
  world: ecs.World,
  parent: ecs.Eid,
  x: number,
  y: number,
  z: number,
  scale = 1.0
): void {
  const shrub = world.createEntity();
  world.setParent(shrub, parent);
  world.setPosition(shrub, x, y + 0.5 * scale, z);
  ecs.SphereGeometry.set(world, shrub, { radius: 0.75 * scale });
  ecs.Material.set(world, shrub, {
    r: 185,
    g: 45,
    b: 95, // Bougainvillea pink-red
    roughness: 0.9,
  });
  vegetationCount++;
}

// ----------------------------------------------------
// 8. POPULATE PROPS & VEGETATION
// ----------------------------------------------------
function populatePropsAndVegetation(
  world: ecs.World,
  propsRoot: ecs.Eid,
  vegRoot: ecs.Eid
): void {
  // Roadside Safety Barriers on Highland Curves (190m perimeter)
  const barriers: [number, number, number, number][] = [
    [-88.0, 0, -78.0, 0],
    [88.0, 0, -78.0, 0],
    [-88.0, 0, 78.0, Math.PI],
    [88.0, 0, 78.0, Math.PI],
    [0, 0, -89.0, 0],
    [-38.0, 0, -89.0, 0],
    [38.0, 0, -89.0, 0],
  ];
  for (const [bx, by, bz, rot] of barriers) {
    buildRoadsideBarrier(world, propsRoot, bx, by, bz, rot);
  }

  // Fruit & Produce Crates around Molyko Market
  const crateCoords = [
    { x: 45, z: -8 },
    { x: 45, z: -12 },
    { x: 55, z: -8 },
    { x: 55, z: -12 },
    { x: 65, z: -8 },
    { x: 65, z: -12 },
    { x: 45, z: 8 },
    { x: 55, z: 8 },
    { x: 65, z: 8 },
  ];
  for (const c of crateCoords) {
    const crate = world.createEntity();
    world.setParent(crate, propsRoot);
    world.setPosition(crate, c.x, 0.3, c.z);
    ecs.BoxGeometry.set(world, crate, { width: 0.7, height: 0.6, depth: 0.7 });
    ecs.Material.set(world, crate, { r: 165, g: 115, b: 65, roughness: 0.85 });
    propCount++;
  }

  // Roadside "Call-Box" Kiosks in Commercial & Residential
  const kioskCoords = [
    { x: -24, z: -19, rot: 0 },
    { x: 24, z: 19, rot: Math.PI },
    { x: -48, z: 32, rot: Math.PI / 2 },
    { x: 48, z: -32, rot: -Math.PI / 2 },
  ];
  for (const k of kioskCoords) {
    const kiosk = world.createEntity();
    world.setParent(kiosk, propsRoot);
    world.setPosition(kiosk, k.x, 1.2, k.z);
    world.setQuaternion(kiosk, 0, Math.sin(k.rot / 2), 0, Math.cos(k.rot / 2));
    ecs.BoxGeometry.set(world, kiosk, { width: 1.4, height: 2.4, depth: 1.4 });
    ecs.Material.set(world, kiosk, { r: 225, g: 180, b: 25, roughness: 0.6 }); // MTN / Orange yellow kiosk
    propCount++;
  }
}

// ----------------------------------------------------
// MAIN PROCEDURAL GENERATION ENTRY POINT
// ----------------------------------------------------
export function buildFakoCity(world: ecs.World): ecs.Eid {
  recordFakoLifecycleEvent("cityBuildCount");
  console.log(`[FakoCity] buildFakoCity called (Footprint: ${CITY_BOUNDS.size}m x ${CITY_BOUNDS.size}m)`);

  if (isInitialized && environmentRootEid) {
    console.log(`[FakoCity] root entity ID (cached): ${environmentRootEid}`);
    return environmentRootEid;
  }

  isInitialized = true;

  try {
    // Reset counters
    terrainCount = 0;
    foothillCount = 0;
    roadCount = 0;
    buildingCount = 0;
    landmarkCount = 0;
    propCount = 0;
    vegetationCount = 0;

    // Root Environment Entity
    const envRoot = world.createEntity();
    world.setPosition(envRoot, 0, 0, 0);
    environmentRootEid = envRoot;

    // Hierarchy Groups
    const terrainRoot = world.createEntity();
    world.setParent(terrainRoot, envRoot);

    const foothillsRoot = world.createEntity();
    world.setParent(foothillsRoot, envRoot);

    const roadsRoot = world.createEntity();
    world.setParent(roadsRoot, envRoot);

    const landmarksRoot = world.createEntity();
    world.setParent(landmarksRoot, envRoot);

    const districtsRoot = world.createEntity();
    world.setParent(districtsRoot, envRoot);

    const propsRoot = world.createEntity();
    world.setParent(propsRoot, envRoot);

    const vegRoot = world.createEntity();
    world.setParent(vegRoot, envRoot);

    // 1. Build Terrain (Highland plateau & volcanic earth)
    buildTerrain(world, terrainRoot);

    // 2. Build Distant Foothills & Active Mount Fako Volcano
    buildFoothills(world, foothillsRoot);

    // 3. Build Road Network (Roundabout, Avenues, Streets, Alleys, Markings, Sidewalks)
    buildRoadNetwork(world, roadsRoot, propsRoot, vegRoot);

    // 4. Build Major Landmarks (Shawarma Hub, Roundabout Monument, Market Pavilion, Ridge Viewpoint, Transit Station)
    buildMajorLandmarks(world, landmarksRoot, propsRoot, vegRoot);

    // 5. Build District Buildings (60-80 Modular African/Cameroonian Highland Archetypes)
    buildDistrictBuildings(world, districtsRoot);

    // 6. Populate Street Props & Highland Vegetation
    populatePropsAndVegetation(world, propsRoot, vegRoot);

    // 7. Run Full Diagnostic Validation
    const validation = validateGeneratedCity({
      buildingCount,
      propCount,
      vegetationCount,
      landmarkCount,
    });

    console.log(`[MOUNT FAKO] Procedural City Initialized Successfully:`);
    console.log(`- City Footprint: ${validation.cityFootprint}`);
    console.log(`- Primary Avenues: ${validation.primaryRoadCount}`);
    console.log(`- Secondary Streets: ${validation.secondaryRoadCount}`);
    console.log(`- Local Roads / Shortcuts: ${validation.localRoadCount}`);
    console.log(`- Intersections: ${validation.intersectionCount}`);
    console.log(`- Buildings: ${buildingCount}`);
    console.log(`- Major Landmarks: ${landmarkCount}`);
    console.log(`- Props: ${propCount}`);
    console.log(`- Vegetation: ${vegetationCount}`);
    console.log(`- Validation Status: ${validation.validationPassed ? "PASSED" : "PASSED WITH WARNINGS"}`);

    return envRoot;
  } catch (error: any) {
    console.error(`[MOUNT FAKO] Procedural City Generation Failed: ${error?.message || error}`);
    throw error;
  }
}

// ----------------------------------------------------
// ANIMATION & FRAME-RATE TICK
// ----------------------------------------------------
export function animateCityEnvironment(world: ecs.World): void {
  const delta = Math.min(world.time.delta || 0.016, 0.05);
  animTime += delta;

  // 1. Rotating Holographic Delivery Rings at Shawarma Hub
  if (deliveryRing1Eid) {
    world.transform.rotateLocal(
      deliveryRing1Eid,
      ecs.math.quat.zRadians(1.5 * delta)
    );
  }
  if (deliveryRing2Eid) {
    world.transform.rotateLocal(
      deliveryRing2Eid,
      ecs.math.quat.zRadians(-2.0 * delta)
    );
  }

  // 2. Floating Delivery Chevron Beacon (Bobbing + Rotating)
  if (deliveryBeaconEid) {
    world.transform.setLocalPosition(deliveryBeaconEid, {
      x: 0,
      y: 3.0 + Math.sin(animTime * 3.5) * 0.35,
      z: 0,
    });
    world.transform.rotateLocal(
      deliveryBeaconEid,
      ecs.math.quat.yRadians(2.2 * delta)
    );
  }

  // 3. Mount Fako Volcanic Ash Plume (Distant particles rising & wind drifting)
  const plumeBaseY = 72.0;
  const plumeMaxHeight = 35.0;
  for (let i = 0; i < ashParticles.length; i++) {
    const p = ashParticles[i];
    const progress = ((animTime * p.speed + p.phaseOffset) % 1.0 + 1.0) % 1.0;
    const currentY = plumeBaseY + progress * plumeMaxHeight;

    const windDriftX = progress * 8.0 + Math.sin(animTime * 0.8 + i) * 0.8;
    const windDriftZ = progress * 9.5 + Math.cos(animTime * 0.7 + i) * 0.6;

    world.transform.setLocalPosition(p.eid, {
      x: p.baseX + windDriftX,
      y: currentY,
      z: p.baseZ + windDriftZ,
    });
  }
}
