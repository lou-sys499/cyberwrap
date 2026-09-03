// =====================================================
// CYBERWRAP: MOUNT FAKO HIGHLANDS (BUEA PROCEDURAL CITY)
// Authoritative City Configuration, Hierarchy & Road Network
// Redesigned for Phase 17: Spacious Open-World Delivery Map (190m x 190m)
// =====================================================

export interface RoadSegment {
  id: string;
  name: string;
  type: "MAIN_AVENUE" | "SECONDARY" | "LOCAL" | "ROUNDABOUT";
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
  width: number;
  hasLanes: boolean;
  hasLamps: boolean;
  hasTrees: boolean;
  speedLimit?: number;
}

export interface Intersection {
  id: string;
  x: number;
  z: number;
  radius: number;
  type: "ROUNDABOUT" | "CROSS_4WAY" | "TEE_JUNCTION";
  name: string;
}

export interface DistrictInfo {
  id: string;
  name: string;
  fictionalZone: string;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  color: string;
  description: string;
}

export interface BuildingPlot {
  id: string;
  name: string;
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  rotY: number;
  districtId: string;
  category: "RESIDENTIAL" | "COMMERCIAL" | "URBAN" | "MARKET" | "INDUSTRIAL" | "CIVIC";
  wallColor: number;
  roofColor: number;
  roofType: "CORRUGATED_PITCHED" | "CORRUGATED_HIP" | "FLAT_TERRACE" | "AWNING_SHOP" | "WAREHOUSE_GABLE";
  hasCompoundWall?: boolean;
  hasBalcony?: boolean;
  hasVeranda?: boolean;
  hasWaterTank?: boolean;
  signText?: string;
}

export interface StreetPropPlot {
  x: number;
  z: number;
  rotY: number;
  type: "LAMP_POST" | "KIOSK_BOOTH" | "MARKET_STALL" | "WOODEN_CRATES" | "BARRIER" | "TRASH_BIN" | "UTILITY_POLE";
  districtId?: string;
}

export interface VegetationPlot {
  x: number;
  z: number;
  type: "ROYAL_PALM" | "COCONUT_PALM" | "UMBRELLA_TREE" | "FLOWERING_BUSH" | "HEDGE_ROW";
  scale: number;
  rotY?: number;
}

export interface SpawnPointCoord {
  x: number;
  y: number;
  z: number;
  district: string;
  name: string;
  difficulty?: "EASY" | "MEDIUM" | "HARD";
  roadDistanceToHub?: number;
}

export interface CityObstacle {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  type: "building" | "compoundWall" | "marketStall" | "boundary" | "landmark";
  name?: string;
}

// -----------------------------------------------------
// 1. CITY MAP BOUNDS (Spacious 190m x 190m Open-World Footprint)
// -----------------------------------------------------
export const CITY_BOUNDS = {
  minX: -95.0,
  maxX: 95.0,
  minZ: -95.0,
  maxZ: 95.0,
  size: 190.0,
  terrainSize: 250.0,
};

export const PLAYABLE_BOUNDARY_LIMIT = 91.0; // In meters from center
export const TRUCK_COLLISION_RADIUS = 1.20; // Authoritative truck collision radius

// -----------------------------------------------------
// 2. DISTRICTS (6 Distinct Character Zones)
// -----------------------------------------------------
export const CITY_DISTRICTS: DistrictInfo[] = [
  {
    id: "center",
    name: "FAKO CENTRAL PLAZA",
    fictionalZone: "Commercial & Delivery Flagship Hub",
    bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 },
    color: "#00f0ff",
    description: "Central Heritage Roundabout, CyberWrap / DailyBread flagship restaurant & commercial civic buildings",
  },
  {
    id: "market",
    name: "MOLYKO MARKET SQUARE",
    fictionalZone: "Artisan & Food Market District",
    bounds: { minX: 30, maxX: 92, minZ: -30, maxZ: 45 },
    color: "#ffd166",
    description: "Vibrant roadside stalls, produce canopies, textile bazaars & artisan craft shops with wide pedestrian plazas",
  },
  {
    id: "commercial",
    name: "TRANSIT & CIVIC QUARTER",
    fictionalZone: "Business, Fuel Station & Bus Terminal",
    bounds: { minX: -92, maxX: -30, minZ: 0, maxZ: 75 },
    color: "#ff0077",
    description: "Fuel service station, municipal annex, clinics & taxi transit depots with drivable parking bypasses",
  },
  {
    id: "residential",
    name: "CLERKS QUARTERS",
    fictionalZone: "West Residential Compound District",
    bounds: { minX: -92, maxX: -30, minZ: -75, maxZ: 0 },
    color: "#118ab2",
    description: "Walled villas, verandas, corrugated metal roofs, open palm-lined yards & spacious garden avenues",
  },
  {
    id: "hillside",
    name: "MOUNT FAKO HEIGHTS",
    fictionalZone: "Upper Ridge & Panoramic Mountain Viewpoint",
    bounds: { minX: -92, maxX: 92, minZ: -92, maxZ: -30 },
    color: "#06d6a0",
    description: "Highland climbing road, tea estate lookouts, panoramic summit deck & scenic mountain views",
  },
  {
    id: "valley",
    name: "GREENFIELD VALLEY & INDUSTRIAL EDGE",
    fictionalZone: "South Greenways & Logistics Outskirts",
    bounds: { minX: -92, maxX: 92, minZ: 30, maxZ: 92 },
    color: "#70e000",
    description: "Scenic southern expressway, supply warehouses, logistics yards & lush tropical mango groves",
  },
];

// -----------------------------------------------------
// 3. ROAD NETWORK (Hierarchical, 100% Connected, 190m Grid with Hero Roads & Shortcuts)
// Main Avenues = 12.0m, Secondary = 8.0m, Local = 5.0m
// -----------------------------------------------------
export const CITY_ROADS: RoadSegment[] = [
  // --------------------------------------------------
  // PRIMARY ARTERIAL HERO AVENUES (12.0m Width, 4.0m Lanes)
  // --------------------------------------------------
  // 1. Mount Fako Central Avenue (North Spine)
  {
    id: "road_central_north_ave",
    name: "Mount Fako Central Ave (North)",
    type: "MAIN_AVENUE",
    startX: 0,
    startZ: -11,
    endX: 0,
    endZ: -78,
    width: 12.0,
    hasLanes: true,
    hasLamps: false,
    hasTrees: false,
    speedLimit: 12.5,
  },
  // 2. Mount Fako Central Avenue (South Spine)
  {
    id: "road_central_south_ave",
    name: "Mount Fako Central Ave (South)",
    type: "MAIN_AVENUE",
    startX: 0,
    startZ: 11,
    endX: 0,
    endZ: 78,
    width: 12.0,
    hasLanes: true,
    hasLamps: false,
    hasTrees: false,
    speedLimit: 12.5,
  },
  // 3. Grand Commercial Boulevard (East Spine towards Market)
  {
    id: "road_central_east_blvd",
    name: "Grand Commercial Blvd (East)",
    type: "MAIN_AVENUE",
    startX: 11,
    startZ: 0,
    endX: 78,
    endZ: 0,
    width: 12.0,
    hasLanes: true,
    hasLamps: false,
    hasTrees: false,
    speedLimit: 12.5,
  },
  // 4. Grand Commercial Boulevard (West Spine towards Clerks Quarters)
  {
    id: "road_central_west_blvd",
    name: "Grand Commercial Blvd (West)",
    type: "MAIN_AVENUE",
    startX: -11,
    startZ: 0,
    endX: -78,
    endZ: 0,
    width: 12.0,
    hasLanes: true,
    hasLamps: false,
    hasTrees: false,
    speedLimit: 12.5,
  },

  // Outer Arterial Ring Highways (12.0m Width)
  // 5. Mount Fako Panoramic Ridge Parkway (North)
  {
    id: "road_north_ridge_highway",
    name: "Mount Fako Ridge Parkway (North)",
    type: "MAIN_AVENUE",
    startX: -78,
    startZ: -78,
    endX: 78,
    endZ: -78,
    width: 12.0,
    hasLanes: true,
    hasLamps: false,
    hasTrees: false,
    speedLimit: 12.5,
  },
  // 6. Greenfield Valley Express Parkway (South)
  {
    id: "road_south_valley_highway",
    name: "Valley Express Greenway (South)",
    type: "MAIN_AVENUE",
    startX: -78,
    startZ: 78,
    endX: 78,
    endZ: 78,
    width: 12.0,
    hasLanes: true,
    hasLamps: false,
    hasTrees: false,
    speedLimit: 12.5,
  },
  // 7. Molyko Eastern Ring Bypass (East)
  {
    id: "road_east_perimeter_pkwy",
    name: "Molyko Eastern Bypass (East)",
    type: "MAIN_AVENUE",
    startX: 78,
    startZ: -78,
    endX: 78,
    endZ: 78,
    width: 12.0,
    hasLanes: true,
    hasLamps: false,
    hasTrees: false,
    speedLimit: 12.5,
  },
  // 8. Clerks Western Perimeter Highway (West)
  {
    id: "road_west_perimeter_pkwy",
    name: "Clerks Western Perimeter (West)",
    type: "MAIN_AVENUE",
    startX: -78,
    startZ: -78,
    endX: -78,
    endZ: 78,
    width: 12.0,
    hasLanes: true,
    hasLamps: false,
    hasTrees: false,
    speedLimit: 12.5,
  },

  // --------------------------------------------------
  // SECONDARY CONNECTING STREETS (8.0m Width)
  // --------------------------------------------------
  // Intermediate North Highland Crossway
  {
    id: "road_north_mid_street",
    name: "Highland Intermediate Street (Z=-38)",
    type: "SECONDARY",
    startX: -78,
    startZ: -38,
    endX: 78,
    endZ: -38,
    width: 8.0,
    hasLanes: true,
    hasLamps: false,
    hasTrees: false,
    speedLimit: 10.0,
  },
  // Intermediate South Valley Crossway
  {
    id: "road_south_mid_street",
    name: "Valley Logistics Crossway (Z=38)",
    type: "SECONDARY",
    startX: -78,
    startZ: 38,
    endX: 78,
    endZ: 38,
    width: 8.0,
    hasLanes: true,
    hasLamps: false,
    hasTrees: false,
    speedLimit: 10.0,
  },
  // Intermediate West Residential Spine
  {
    id: "road_west_mid_street",
    name: "Clerks Quarters Drive (X=-38)",
    type: "SECONDARY",
    startX: -38,
    startZ: -78,
    endX: -38,
    endZ: 78,
    width: 8.0,
    hasLanes: true,
    hasLamps: false,
    hasTrees: false,
    speedLimit: 10.0,
  },
  // Intermediate East Market Spine
  {
    id: "road_east_mid_street",
    name: "Market Bazaar Avenue (X=38)",
    type: "SECONDARY",
    startX: 38,
    startZ: -78,
    endX: 38,
    endZ: 78,
    width: 8.0,
    hasLanes: true,
    hasLamps: false,
    hasTrees: false,
    speedLimit: 10.0,
  },

  // --------------------------------------------------
  // LOCAL ACCESS ROADS, SHORTCUTS & ALLEYWAYS (5.0m Width)
  // --------------------------------------------------
  // Market Food Stalls North Alley Shortcut
  {
    id: "road_market_bazaar_loop_n",
    name: "Market Food Stalls North Alley",
    type: "LOCAL",
    startX: 38,
    startZ: -19,
    endX: 78,
    endZ: -19,
    width: 5.0,
    hasLanes: false,
    hasLamps: false,
    hasTrees: false,
    speedLimit: 8.0,
  },
  // Market Artisan Stalls South Alley Shortcut
  {
    id: "road_market_bazaar_loop_s",
    name: "Market Artisan Stalls South Alley",
    type: "LOCAL",
    startX: 38,
    startZ: 19,
    endX: 78,
    endZ: 19,
    width: 5.0,
    hasLanes: false,
    hasLamps: false,
    hasTrees: false,
    speedLimit: 8.0,
  },
  // Market Center Promenade
  {
    id: "road_market_mid_spine",
    name: "Market Center Promenade",
    type: "LOCAL",
    startX: 58.0,
    startZ: -38,
    endX: 58.0,
    endZ: 38,
    width: 5.0,
    hasLanes: false,
    hasLamps: false,
    hasTrees: false,
    speedLimit: 8.0,
  },
  // Clerks Upper Villa Lane Shortcut
  {
    id: "road_clerks_residential_n",
    name: "Clerks Upper Villa Lane",
    type: "LOCAL",
    startX: -78,
    startZ: -19,
    endX: -38,
    endZ: -19,
    width: 5.0,
    hasLanes: false,
    hasLamps: false,
    hasTrees: false,
    speedLimit: 8.0,
  },
  // Clerks Lower Compound Lane Shortcut
  {
    id: "road_clerks_residential_s",
    name: "Clerks Lower Compound Lane",
    type: "LOCAL",
    startX: -78,
    startZ: 19,
    endX: -38,
    endZ: 19,
    width: 5.0,
    hasLanes: false,
    hasLamps: false,
    hasTrees: false,
    speedLimit: 8.0,
  },
  // Clerks Palms Way
  {
    id: "road_clerks_mid_spine",
    name: "Clerks Palms Way",
    type: "LOCAL",
    startX: -58.0,
    startZ: -38,
    endX: -58.0,
    endZ: 38,
    width: 5.0,
    hasLanes: false,
    hasLamps: false,
    hasTrees: false,
    speedLimit: 8.0,
  },
  // Hillside Overlook Terrace Road (North Lookout Approach)
  {
    id: "road_hillside_lookout_climb",
    name: "Hillside Overlook Terrace Road",
    type: "LOCAL",
    startX: -38,
    startZ: -58.0,
    endX: 38,
    endZ: -58.0,
    width: 5.0,
    hasLanes: false,
    hasLamps: false,
    hasTrees: false,
    speedLimit: 8.0,
  },
  // Valley Logistics Service Way (South Outskirts)
  {
    id: "road_valley_warehouse_drive",
    name: "Valley Logistics Service Way",
    type: "LOCAL",
    startX: -38,
    startZ: 58.0,
    endX: 38,
    endZ: 58.0,
    width: 5.0,
    hasLanes: false,
    hasLamps: false,
    hasTrees: false,
    speedLimit: 8.0,
  },
  // Transit Hub Fuel Station Drivable Parking Shortcut
  {
    id: "road_transit_parking_shortcut",
    name: "Transit Hub Drivable Service Bypass",
    type: "LOCAL",
    startX: -78,
    startZ: 52.0,
    endX: -38,
    endZ: 52.0,
    width: 5.0,
    hasLanes: false,
    hasLamps: false,
    hasTrees: false,
    speedLimit: 8.0,
  },
];

// -----------------------------------------------------
// 4. MAJOR INTERSECTIONS (Checked for Clear 14m+ Envelopes)
// -----------------------------------------------------
export const CITY_INTERSECTIONS: Intersection[] = [
  // Central Roundabout Monument (Diameter = 22m, Radius = 11m, Island Radius = 5.0m)
  { id: "int_central_roundabout", x: 0, z: 0, radius: 11.0, type: "ROUNDABOUT", name: "Central Buea Heritage Roundabout" },

  // Primary Arterial 4-Way Crossings (14m x 14m Clearance Envelope)
  { id: "int_north_spine_mid", x: 0, z: -38, radius: 7.0, type: "CROSS_4WAY", name: "Central North & Highland Crossing" },
  { id: "int_north_spine_ridge", x: 0, z: -78, radius: 7.0, type: "CROSS_4WAY", name: "Central North & Ridge Parkway Crossing" },
  { id: "int_south_spine_mid", x: 0, z: 38, radius: 7.0, type: "CROSS_4WAY", name: "Central South & Valley Crossing" },
  { id: "int_south_spine_valley", x: 0, z: 78, radius: 7.0, type: "CROSS_4WAY", name: "Central South & Valley Express Crossing" },
  { id: "int_east_blvd_mid", x: 38, z: 0, radius: 7.0, type: "CROSS_4WAY", name: "Grand East Blvd & Market Ave Crossing" },
  { id: "int_east_blvd_pkwy", x: 78, z: 0, radius: 7.0, type: "CROSS_4WAY", name: "Grand East Blvd & Eastern Bypass Crossing" },
  { id: "int_west_blvd_mid", x: -38, z: 0, radius: 7.0, type: "CROSS_4WAY", name: "Grand West Blvd & Clerks Drive Crossing" },
  { id: "int_west_blvd_pkwy", x: -78, z: 0, radius: 7.0, type: "CROSS_4WAY", name: "Grand West Blvd & Western Perimeter Crossing" },

  // Grid Secondary 4-Way Crossings
  { id: "int_grid_nw", x: -38, z: -38, radius: 6.0, type: "CROSS_4WAY", name: "Highland & Clerks Intersection" },
  { id: "int_grid_ne", x: 38, z: -38, radius: 6.0, type: "CROSS_4WAY", name: "Highland & Market Intersection" },
  { id: "int_grid_sw", x: -38, z: 38, radius: 6.0, type: "CROSS_4WAY", name: "Valley & Clerks Intersection" },
  { id: "int_grid_se", x: 38, z: 38, radius: 6.0, type: "CROSS_4WAY", name: "Valley & Market Intersection" },

  // Outer Perimeter Corner Junctions
  { id: "int_corner_nw", x: -78, z: -78, radius: 7.0, type: "CROSS_4WAY", name: "North-West Ridge Junction" },
  { id: "int_corner_ne", x: 78, z: -78, radius: 7.0, type: "CROSS_4WAY", name: "North-East Ridge Junction" },
  { id: "int_corner_sw", x: -78, z: 78, radius: 7.0, type: "CROSS_4WAY", name: "South-West Valley Junction" },
  { id: "int_corner_se", x: 78, z: 78, radius: 7.0, type: "CROSS_4WAY", name: "South-East Valley Junction" },
];

// -----------------------------------------------------
// 5. SHAWARMA FLAGSHIP HUB & DELIVERY DROP-OFF
// (Authoritative integration: deliveryRing1Eid, deliveryRing2Eid, deliveryBeaconEid)
// -----------------------------------------------------
export const SHAWARMA_HUB_LOCATION = {
  building: {
    x: 10.0,
    z: -10.0,
    w: 10.5,
    h: 5.6,
    d: 6.5,
    rotY: -Math.PI / 2, // Facing Central Avenue
  },
  deliveryZone: {
    x: 5.2,
    y: 0.03,
    z: -10.0,
    radius: 4.2,
  },
};

// -----------------------------------------------------
// 6. PLAYER TRUCK SPAWN LOCATION
// (Positioned on Central South Ave facing North towards Hub)
// -----------------------------------------------------
export const PLAYER_SPAWN_LOCATION = {
  x: 0.0,
  y: 0.0,
  z: 14.0,
  heading: 0, // Facing North (heading 0 = towards Z negative)
};

// -----------------------------------------------------
// 7. ROAD CORRIDOR BOUNDARY DETECTION HELPER
// Tests whether a coordinate intersects any drivable road corridor
// -----------------------------------------------------
export function isInsideRoadCorridor(
  x: number,
  z: number,
  margin = 0.6
): boolean {
  // 1. Central Roundabout Roadway Ring (Outer R=11.0m, Inner Island R=5.0m)
  const distOrigin = Math.hypot(x, z);
  if (distOrigin <= 11.0 + margin && distOrigin >= 4.6 - margin) {
    return true;
  }

  // 2. Linear Road Segments
  for (let i = 0; i < CITY_ROADS.length; i++) {
    const road = CITY_ROADS[i];
    const dx = road.endX - road.startX;
    const dz = road.endZ - road.startZ;
    const lenSq = dx * dx + dz * dz;
    if (lenSq < 0.001) continue;

    const t = Math.max(
      0,
      Math.min(1, ((x - road.startX) * dx + (z - road.startZ) * dz) / lenSq)
    );
    const px = road.startX + t * dx;
    const pz = road.startZ + t * dz;
    const dist = Math.hypot(x - px, z - pz);

    if (dist <= road.width / 2 + margin) {
      return true;
    }
  }

  return false;
}

// -----------------------------------------------------
// 8. HELPER TO CREATE 2D SOLID COLLIDER AABBs
// -----------------------------------------------------
export function makeObstacle(
  x: number,
  z: number,
  w: number,
  d: number,
  rotY: number,
  type: CityObstacle["type"],
  name?: string
): CityObstacle {
  const cos = Math.abs(Math.cos(rotY));
  const sin = Math.abs(Math.sin(rotY));
  const effW = w * cos + d * sin;
  const effD = w * sin + d * cos;
  return {
    minX: x - effW / 2,
    maxX: x + effW / 2,
    minZ: z - effD / 2,
    maxZ: z + effD / 2,
    type,
    name,
  };
}

// -----------------------------------------------------
// 9. SOLID OBSTACLE REGISTRY (Exact Setbacks, Zero Road Overlap across 190m World)
// -----------------------------------------------------
export const CITY_OBSTACLES: CityObstacle[] = [
  // Landmark 1: CyberWrap / DailyBread Shawarma Hub Flagship (Authoritative)
  makeObstacle(
    SHAWARMA_HUB_LOCATION.building.x,
    SHAWARMA_HUB_LOCATION.building.z,
    SHAWARMA_HUB_LOCATION.building.w,
    SHAWARMA_HUB_LOCATION.building.d,
    SHAWARMA_HUB_LOCATION.building.rotY,
    "landmark",
    "CyberWrap Shawarma Hub"
  ),

  // Landmark 2: Central Roundabout Heritage Monument (Inside R=5.0m island)
  makeObstacle(0, 0, 3.8, 3.8, 0, "landmark", "Central Heritage Monument"),

  // Landmark 3: Molyko Grand Market Pavilion
  makeObstacle(58.0, 0, 8.5, 13.5, 0, "landmark", "Molyko Central Market Pavilion"),

  // Landmark 4: Mount Fako Ridge Panoramic Viewpoint Deck
  makeObstacle(0, -85.0, 11.5, 5.2, 0, "landmark", "Mount Fako Ridge Viewpoint Deck"),

  // Landmark 5: Buea Transit Hub & Fuel Station
  makeObstacle(-58.0, 52.0, 10.5, 7.6, 0, "landmark", "Buea Transit Fuel Station"),

  // --- CENTRAL CIVIC DISTRICT BUILDINGS (Generous Setback) ---
  makeObstacle(-16.0, -16.0, 7.5, 5.5, Math.PI / 2, "building", "Civic Commercial Bank"),
  makeObstacle(-16.0, 16.0, 7.5, 5.5, Math.PI / 2, "building", "Central Pharmacy & Clinic"),
  makeObstacle(16.0, 16.0, 7.5, 5.5, -Math.PI / 2, "building", "Central Post & Telecom Annex"),

  // --- MOLYKO MARKET SQUARE BUILDINGS & STALLS (East Block X=38..78, Z=-38..38) ---
  makeObstacle(47.0, -10.0, 3.8, 2.8, 0, "marketStall", "Market Stall Produce A"),
  makeObstacle(52.5, -10.0, 3.8, 2.8, 0, "marketStall", "Market Stall Spices B"),
  makeObstacle(64.5, -10.0, 3.8, 2.8, 0, "marketStall", "Market Stall Textiles C"),
  makeObstacle(47.0, 10.0, 3.8, 2.8, Math.PI, "marketStall", "Market Stall Crafts D"),
  makeObstacle(52.5, 10.0, 3.8, 2.8, Math.PI, "marketStall", "Market Stall Electronics E"),
  makeObstacle(64.5, 10.0, 3.8, 2.8, Math.PI, "marketStall", "Market Stall Fresh Bakery F"),
  makeObstacle(48.0, -29.0, 7.2, 5.2, 0, "building", "Market Wholesale Storehouse North"),
  makeObstacle(67.0, -29.0, 7.0, 5.0, 0, "building", "Market Artisan Guild Hall"),
  makeObstacle(48.0, 29.0, 7.2, 5.2, Math.PI, "building", "Market Wholesale Storehouse South"),
  makeObstacle(67.0, 29.0, 7.0, 5.0, Math.PI, "building", "Market Cold Storage Logistics"),

  // --- CLERKS QUARTERS RESIDENTIAL VILLAS (West Block X=-78..-38, Z=-38..38) ---
  makeObstacle(-48.0, -11.5, 6.8, 4.6, Math.PI / 2, "building", "Clerks Villa Camwood"),
  makeObstacle(-68.0, -11.5, 6.5, 4.6, -Math.PI / 2, "building", "Clerks Villa Hibiscus"),
  makeObstacle(-48.0, 11.5, 6.8, 4.6, Math.PI / 2, "building", "Clerks Villa Palm Crest"),
  makeObstacle(-68.0, 11.5, 6.5, 4.6, -Math.PI / 2, "building", "Clerks Villa Acacia"),
  makeObstacle(-48.0, -29.0, 7.0, 5.0, 0, "building", "Clerks Upper Residence West"),
  makeObstacle(-67.5, -29.0, 6.5, 4.8, 0, "building", "Clerks Compound Manor North"),
  makeObstacle(-48.0, 29.0, 7.0, 5.0, Math.PI, "building", "Clerks Lower Residence West"),
  makeObstacle(-67.5, 29.0, 6.5, 4.8, Math.PI, "building", "Clerks Compound Manor South"),

  // --- MOUNT FAKO HEIGHTS & RIDGE VILLAS (North Block Z=-78..-38) ---
  makeObstacle(-18.0, -48.0, 7.5, 5.0, 0, "building", "Highland Tea Estate Villa 1"),
  makeObstacle(18.0, -48.0, 7.5, 5.0, 0, "building", "Highland Tea Estate Villa 2"),
  makeObstacle(-18.0, -67.0, 7.5, 5.0, 0, "building", "Mount Fako Summit Manor West"),
  makeObstacle(18.0, -67.0, 7.5, 5.0, 0, "building", "Mount Fako Summit Manor East"),
  makeObstacle(-58.0, -58.0, 8.5, 6.0, 0, "building", "North-West Ridge Compound"),
  makeObstacle(58.0, -58.0, 8.5, 6.0, 0, "building", "North-East Tea Overlook Villa"),

  // --- GREENFIELD VALLEY & TRANSIT BUILDINGS (South Block Z=38..78) ---
  makeObstacle(-18.0, 48.0, 7.5, 5.0, Math.PI, "building", "Valley Plantation Villa 1"),
  makeObstacle(18.0, 48.0, 7.5, 5.0, Math.PI, "building", "Valley Plantation Villa 2"),
  makeObstacle(-18.0, 67.0, 8.0, 5.5, Math.PI, "building", "Greenfield South Logistics Depot 1"),
  makeObstacle(18.0, 67.0, 8.0, 5.5, Math.PI, "building", "Greenfield South Logistics Depot 2"),
  makeObstacle(58.0, 67.0, 8.0, 5.5, Math.PI, "building", "South-East Valley Agro Hub"),

  // --- OUTER PERIMETER BUFFER BUILDINGS (Set back safely from X=±78, Z=±78) ---
  makeObstacle(-88.0, -58.0, 6.8, 5.0, Math.PI / 2, "building", "West Perimeter Villa NW"),
  makeObstacle(-88.0, -19.0, 6.8, 5.0, Math.PI / 2, "building", "West Perimeter Villa Mid-N"),
  makeObstacle(-88.0, 19.0, 6.8, 5.0, Math.PI / 2, "building", "West Perimeter Villa Mid-S"),
  makeObstacle(-88.0, 58.0, 6.8, 5.0, Math.PI / 2, "building", "West Perimeter Service Garage"),
  makeObstacle(88.0, -58.0, 6.8, 5.0, -Math.PI / 2, "building", "East Perimeter Storehouse NE"),
  makeObstacle(88.0, -19.0, 6.8, 5.0, -Math.PI / 2, "building", "East Perimeter Market Annex"),
  makeObstacle(88.0, 19.0, 6.8, 5.0, -Math.PI / 2, "building", "East Perimeter Agro Store"),
  makeObstacle(88.0, 58.0, 6.8, 5.0, -Math.PI / 2, "building", "East Perimeter Warehouse SE"),
];

// -----------------------------------------------------
// 10. CONTINUOUS SURFACE ELEVATION SAMPLER
// (Playable city drive zone is a flat highland plateau at Y = 0)
// -----------------------------------------------------
export function getCitySurfaceElevation(_x: number, _z: number): number {
  return 0.0;
}

// -----------------------------------------------------
// 11. 2D FOOTPRINT-BASED COLLISION RESOLVER & SLIDE RESPONSE
// -----------------------------------------------------
export function resolveCityCollision(
  proposedX: number,
  proposedZ: number,
  radius: number = TRUCK_COLLISION_RADIUS
): { x: number; z: number; collided: boolean } {
  let resX = proposedX;
  let resZ = proposedZ;
  let collided = false;

  // 1. Enforce hard perimeter boundary limits (91m from center)
  const boundMin = -PLAYABLE_BOUNDARY_LIMIT + radius;
  const boundMax = PLAYABLE_BOUNDARY_LIMIT - radius;
  if (resX < boundMin) {
    resX = boundMin;
    collided = true;
  } else if (resX > boundMax) {
    resX = boundMax;
    collided = true;
  }
  if (resZ < boundMin) {
    resZ = boundMin;
    collided = true;
  } else if (resZ > boundMax) {
    resZ = boundMax;
    collided = true;
  }

  // 2. Central Roundabout Monument Island Inner Curb Collision (Radius = 5.0m)
  const distFromCenter = Math.hypot(resX, resZ);
  const islandRadius = 4.8;
  if (distFromCenter < islandRadius + radius) {
    collided = true;
    if (distFromCenter > 0.001) {
      const pushOut = (islandRadius + radius) / distFromCenter;
      resX *= pushOut;
      resZ *= pushOut;
    } else {
      resZ = islandRadius + radius;
    }
  }

  // 3. Multi-pass circle-to-AABB collision check and wall-slide projection
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < CITY_OBSTACLES.length; i++) {
      const obs = CITY_OBSTACLES[i];

      // Quick broadphase AABB bounding rejection
      if (
        resX + radius < obs.minX ||
        resX - radius > obs.maxX ||
        resZ + radius < obs.minZ ||
        resZ - radius > obs.maxZ
      ) {
        continue;
      }

      // Find closest point on obstacle AABB
      const cx = Math.max(obs.minX, Math.min(resX, obs.maxX));
      const cz = Math.max(obs.minZ, Math.min(resZ, obs.maxZ));

      const dx = resX - cx;
      const dz = resZ - cz;
      const distSq = dx * dx + dz * dz;

      if (distSq < radius * radius) {
        collided = true;
        if (distSq > 0.00001) {
          const dist = Math.sqrt(distSq);
          const overlap = radius - dist;
          resX += (dx / dist) * overlap;
          resZ += (dz / dist) * overlap;
        } else {
          // Inside obstacle box: push out along shortest axis
          const dLeft = resX - obs.minX;
          const dRight = obs.maxX - resX;
          const dBottom = resZ - obs.minZ;
          const dTop = obs.maxZ - resZ;
          const minD = Math.min(dLeft, dRight, dBottom, dTop);
          if (minD === dLeft) resX = obs.minX - radius;
          else if (minD === dRight) resX = obs.maxX + radius;
          else if (minD === dBottom) resZ = obs.minZ - radius;
          else resZ = obs.maxZ + radius;
        }
      }
    }
  }

  return { x: resX, z: resZ, collided };
}

// -----------------------------------------------------
// 12. INTELLIGENT ROAD-NETWORK ALIGNED COLLECTIBLE SPAWN NODES
// Distributed across all 6 districts, strictly inside drivable roads/pull-offs/plazas
// Categorized by realistic road-distance from Shawarma Hub (5.2, -10.0)
// -----------------------------------------------------
export const CITY_COLLECTIBLE_SPAWN_NODES: SpawnPointCoord[] = [
  // --- EASY ROUTES (50–110m Road Distance / 12–20s Travel) ---
  { x: 0.0, y: 0.45, z: -38.0, district: "center", name: "Central North Ave Crossing", difficulty: "EASY", roadDistanceToHub: 65 },
  { x: 0.0, y: 0.45, z: 0.0, district: "center", name: "Roundabout North Entrance", difficulty: "EASY", roadDistanceToHub: 70 },
  { x: 24.0, y: 0.45, z: 0.0, district: "center", name: "Grand East Blvd Apron", difficulty: "EASY", roadDistanceToHub: 75 },
  { x: -24.0, y: 0.45, z: 0.0, district: "center", name: "Grand West Blvd Apron", difficulty: "EASY", roadDistanceToHub: 75 },
  { x: 18.0, y: 0.45, z: -38.0, district: "hillside", name: "Highland East Branch Turn", difficulty: "EASY", roadDistanceToHub: 85 },
  { x: -18.0, y: 0.45, z: -38.0, district: "residential", name: "Clerks North Branch Turn", difficulty: "EASY", roadDistanceToHub: 85 },
  { x: 38.0, y: 0.45, z: -19.0, district: "market", name: "Market North Gate Entry", difficulty: "EASY", roadDistanceToHub: 90 },
  { x: -38.0, y: 0.45, z: -19.0, district: "residential", name: "Clerks Villa Court Entry", difficulty: "EASY", roadDistanceToHub: 90 },

  // --- MEDIUM ROUTES (130–210m Road Distance / 25–40s Travel) ---
  { x: 0.0, y: 0.45, z: 38.0, district: "valley", name: "Central South Crossing", difficulty: "MEDIUM", roadDistanceToHub: 130 },
  { x: 38.0, y: 0.45, z: 0.0, district: "market", name: "Molyko Market Plaza Crossing", difficulty: "MEDIUM", roadDistanceToHub: 125 },
  { x: -38.0, y: 0.45, z: 0.0, district: "residential", name: "Clerks Central Boulevard", difficulty: "MEDIUM", roadDistanceToHub: 125 },
  { x: 58.0, y: 0.45, z: -19.0, district: "market", name: "Market Produce Pavilion", difficulty: "MEDIUM", roadDistanceToHub: 155 },
  { x: 58.0, y: 0.45, z: 19.0, district: "market", name: "Market Artisan Promenade", difficulty: "MEDIUM", roadDistanceToHub: 165 },
  { x: -58.0, y: 0.45, z: -19.0, district: "residential", name: "Clerks Upper Palms Way", difficulty: "MEDIUM", roadDistanceToHub: 155 },
  { x: -58.0, y: 0.45, z: 19.0, district: "commercial", name: "Clerks Lower Compound Way", difficulty: "MEDIUM", roadDistanceToHub: 165 },
  { x: 0.0, y: 0.45, z: -58.0, district: "hillside", name: "Highland Lookout Terrace", difficulty: "MEDIUM", roadDistanceToHub: 150 },
  { x: 38.0, y: 0.45, z: -38.0, district: "market", name: "Market North-West Corner", difficulty: "MEDIUM", roadDistanceToHub: 145 },
  { x: -38.0, y: 0.45, z: -38.0, district: "residential", name: "Highland & Clerks Crossway", difficulty: "MEDIUM", roadDistanceToHub: 145 },
  { x: 38.0, y: 0.45, z: 38.0, district: "market", name: "Market South-West Corner", difficulty: "MEDIUM", roadDistanceToHub: 175 },
  { x: -38.0, y: 0.45, z: 38.0, district: "commercial", name: "Transit Hub East Approach", difficulty: "MEDIUM", roadDistanceToHub: 175 },

  // --- HARD & PERIMETER ROUTES (230–310m Road Distance / 45–60s Travel) ---
  { x: 0.0, y: 0.45, z: -78.0, district: "hillside", name: "Mount Fako Ridge Highway", difficulty: "HARD", roadDistanceToHub: 230 },
  { x: 0.0, y: 0.45, z: 78.0, district: "valley", name: "Greenfield Valley Express", difficulty: "HARD", roadDistanceToHub: 240 },
  { x: 78.0, y: 0.45, z: 0.0, district: "market", name: "Eastern Perimeter Terminal", difficulty: "HARD", roadDistanceToHub: 235 },
  { x: -78.0, y: 0.45, z: 0.0, district: "commercial", name: "Western Perimeter Terminal", difficulty: "HARD", roadDistanceToHub: 235 },
  { x: -78.0, y: 0.45, z: -78.0, district: "hillside", name: "North-West Highland Lookout", difficulty: "HARD", roadDistanceToHub: 275 },
  { x: 78.0, y: 0.45, z: -78.0, district: "hillside", name: "North-East Tea Estate Curve", difficulty: "HARD", roadDistanceToHub: 275 },
  { x: -78.0, y: 0.45, z: 78.0, district: "commercial", name: "South-West Transit Depot", difficulty: "HARD", roadDistanceToHub: 285 },
  { x: 78.0, y: 0.45, z: 78.0, district: "valley", name: "South-East Valley Agro Hub", difficulty: "HARD", roadDistanceToHub: 285 },
  { x: 78.0, y: 0.45, z: -38.0, district: "market", name: "East Bypass North Pull-Off", difficulty: "HARD", roadDistanceToHub: 255 },
  { x: 78.0, y: 0.45, z: 38.0, district: "market", name: "East Bypass South Pull-Off", difficulty: "HARD", roadDistanceToHub: 265 },
  { x: -78.0, y: 0.45, z: -38.0, district: "residential", name: "West Ring North Corner", difficulty: "HARD", roadDistanceToHub: 255 },
  { x: -78.0, y: 0.45, z: 38.0, district: "commercial", name: "West Ring South Corner", difficulty: "HARD", roadDistanceToHub: 265 },
];
