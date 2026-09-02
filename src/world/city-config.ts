// =====================================================
// CYBERWRAP: MOUNT FAKO HEIGHTS (BUEA CITY DISTRICT)
// Procedural World Configuration & Hierarchy Definitions
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
  elevationStart?: number;
  elevationEnd?: number;
  hasLanes: boolean;
  hasLamps: boolean;
  hasTrees: boolean;
}

export interface Intersection {
  id: string;
  x: number;
  z: number;
  radius: number;
  type: "ROUNDABOUT" | "CROSS" | "TEE";
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
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  rotY: number;
  districtId: string;
  category: "RESIDENTIAL" | "COMMERCIAL" | "URBAN" | "MARKET_STALL" | "SHAWARMA_SHOP";
  wallColor: number;
  roofColor: number;
  roofType: "CORRUGATED_PITCHED" | "CORRUGATED_HIP" | "FLAT_TERRACE" | "AWNING_SHOP" | "SHAWARMA_HQ";
  hasCompoundWall?: boolean;
  hasBalcony?: boolean;
  signText?: string;
}

export interface VegetationPlot {
  x: number;
  z: number;
  type: "PALM" | "UMBRELLA_TREE" | "TROPICAL_BUSH" | "FLOWERING_HEDGE";
  scale: number;
}

export interface SpawnPointCoord {
  x: number;
  y: number;
  z: number;
  district: string;
  name: string;
}

// -----------------------------------------------------
// CITY MAP EXTENTS & BOUNDS
// -----------------------------------------------------
export const CITY_BOUNDS = {
  minX: -46.0,
  maxX: 46.0,
  minZ: -46.0,
  maxZ: 46.0,
  size: 92.0,
  terrainSize: 130.0,
};

// -----------------------------------------------------
// DISTRICT DEFINITIONS (Inspired by Buea, Cameroon)
// -----------------------------------------------------
export const CITY_DISTRICTS: DistrictInfo[] = [
  {
    id: "center",
    name: "FAKO CENTRAL PLAZA",
    fictionalZone: "Commercial & Delivery Hub",
    bounds: { minX: -14, maxX: 14, minZ: -16, maxZ: 16 },
    color: "#00f0ff",
    description: "Central Avenue, Shawarma flagship restaurant & civic buildings",
  },
  {
    id: "market",
    name: "MOLYKO MARKET SQUARE",
    fictionalZone: "Open-Air Market District",
    bounds: { minX: 14, maxX: 46, minZ: -20, maxZ: 20 },
    color: "#ffd166",
    description: "Bustling roadside stalls, craft canopies & produce trade",
  },
  {
    id: "hillside",
    name: "MOUNT FAKO HEIGHTS",
    fictionalZone: "Upper Residential & Viewpoint",
    bounds: { minX: -46, maxX: 46, minZ: -46, maxZ: -16 },
    color: "#06d6a0",
    description: "Elevated highland road, mountain foothills & modern villas",
  },
  {
    id: "residential",
    name: "CLERKS QUARTERS",
    fictionalZone: "West Residential Enclave",
    bounds: { minX: -46, maxX: -14, minZ: -20, maxZ: 20 },
    color: "#118ab2",
    description: "Walled compound houses, balconies & quiet palm streets",
  },
  {
    id: "valley",
    name: "GREENFIELD VALLEY",
    fictionalZone: "South Greenways & Outskirts",
    bounds: { minX: -46, maxX: 46, minZ: 16, maxZ: 46 },
    color: "#70e000",
    description: "Scenic open bypass, roadside kiosks & lush tropical flora",
  },
];

// -----------------------------------------------------
// ROAD NETWORK DEFINITIONS (Hierarchical & Fully Connected)
// -----------------------------------------------------
export const CITY_ROADS: RoadSegment[] = [
  // 1. MAIN NORTH-SOUTH SPINE (Mount Fako Central Avenue)
  {
    id: "road_central_spine_n",
    name: "Mount Fako Central Ave (North)",
    type: "MAIN_AVENUE",
    startX: 0,
    startZ: 0,
    endX: 0,
    endZ: -40,
    width: 6.8,
    elevationStart: 0.0,
    elevationEnd: 0.0,
    hasLanes: true,
    hasLamps: true,
    hasTrees: true,
  },
  {
    id: "road_central_spine_s",
    name: "Mount Fako Central Ave (South)",
    type: "MAIN_AVENUE",
    startX: 0,
    startZ: 0,
    endX: 0,
    endZ: 40,
    width: 6.8,
    elevationStart: 0.0,
    elevationEnd: 0.0,
    hasLanes: true,
    hasLamps: true,
    hasTrees: true,
  },

  // 2. MAIN EAST-WEST SPINE (Grand Commercial Boulevard)
  {
    id: "road_grand_blvd_w",
    name: "Grand Commercial Blvd (West)",
    type: "MAIN_AVENUE",
    startX: 0,
    startZ: 0,
    endX: -40,
    endZ: 0,
    width: 6.5,
    elevationStart: 0.0,
    elevationEnd: 0.0,
    hasLanes: true,
    hasLamps: true,
    hasTrees: true,
  },
  {
    id: "road_grand_blvd_e",
    name: "Grand Commercial Blvd (East)",
    type: "MAIN_AVENUE",
    startX: 0,
    startZ: 0,
    endX: 40,
    endZ: 0,
    width: 6.5,
    elevationStart: 0.0,
    elevationEnd: 0.0,
    hasLanes: true,
    hasLamps: true,
    hasTrees: true,
  },

  // 3. NORTH HILLSIDE PARKWAY (Upper Ridge Loop)
  {
    id: "road_hillside_n",
    name: "Hillside Parkway",
    type: "SECONDARY",
    startX: -40,
    startZ: -32,
    endX: 40,
    endZ: -32,
    width: 5.6,
    elevationStart: 0.0,
    elevationEnd: 0.0,
    hasLanes: true,
    hasLamps: true,
    hasTrees: true,
  },

  // 4. SOUTH VALLEY DRIVE (Scenic Bypass)
  {
    id: "road_valley_s",
    name: "South Valley Bypass",
    type: "SECONDARY",
    startX: -40,
    startZ: 32,
    endX: 40,
    endZ: 32,
    width: 5.6,
    elevationStart: 0.0,
    elevationEnd: 0.0,
    hasLanes: true,
    hasLamps: true,
    hasTrees: true,
  },

  // 5. WEST RESIDENTIAL DRIVE (Perimeter Spine)
  {
    id: "road_west_perimeter",
    name: "West Compound Ring",
    type: "SECONDARY",
    startX: -40,
    startZ: -32,
    endX: -40,
    endZ: 32,
    width: 5.4,
    elevationStart: 0.0,
    elevationEnd: 0.0,
    hasLanes: true,
    hasLamps: true,
    hasTrees: true,
  },

  // 6. EAST MARKET AVENUE (Market Perimeter Spine)
  {
    id: "road_east_perimeter",
    name: "East Market Bypass",
    type: "SECONDARY",
    startX: 40,
    startZ: -32,
    endX: 40,
    endZ: 32,
    width: 5.4,
    elevationStart: 0.0,
    elevationEnd: 0.0,
    hasLanes: true,
    hasLamps: true,
    hasTrees: true,
  },

  // 7. MID NORTH CROSSWAY
  {
    id: "road_mid_north",
    name: "Clerks-Molyko North Lane",
    type: "LOCAL",
    startX: -40,
    startZ: -16,
    endX: 40,
    endZ: -16,
    width: 4.8,
    elevationStart: 0.0,
    elevationEnd: 0.0,
    hasLanes: false,
    hasLamps: true,
    hasTrees: true,
  },

  // 8. MID SOUTH CROSSWAY
  {
    id: "road_mid_south",
    name: "Greenfield South Lane",
    type: "LOCAL",
    startX: -40,
    startZ: 16,
    endX: 40,
    endZ: 16,
    width: 4.8,
    elevationStart: 0.0,
    elevationEnd: 0.0,
    hasLanes: false,
    hasLamps: true,
    hasTrees: true,
  },

  // 9. WEST INTERNAL CONNECTOR
  {
    id: "road_inner_west",
    name: "Compound Residential Alley",
    type: "LOCAL",
    startX: -20,
    startZ: -32,
    endX: -20,
    endZ: 32,
    width: 4.8,
    elevationStart: 0.0,
    elevationEnd: 0.0,
    hasLanes: false,
    hasLamps: true,
    hasTrees: true,
  },

  // 10. EAST MARKET INTERNAL CONNECTOR
  {
    id: "road_inner_east",
    name: "Market Bazaar Corridor",
    type: "LOCAL",
    startX: 20,
    startZ: -32,
    endX: 20,
    endZ: 32,
    width: 4.8,
    elevationStart: 0.0,
    elevationEnd: 0.0,
    hasLanes: false,
    hasLamps: true,
    hasTrees: true,
  },
];

// -----------------------------------------------------
// KEY INTERSECTIONS
// -----------------------------------------------------
export const CITY_INTERSECTIONS: Intersection[] = [
  { id: "int_center_roundabout", x: 0, z: 0, radius: 7.5, type: "ROUNDABOUT" },
  { id: "int_north_mid", x: 0, z: -16, radius: 4.5, type: "CROSS" },
  { id: "int_north_top", x: 0, z: -32, radius: 4.5, type: "CROSS" },
  { id: "int_south_mid", x: 0, z: 16, radius: 4.5, type: "CROSS" },
  { id: "int_south_bottom", x: 0, z: 32, radius: 4.5, type: "CROSS" },
  { id: "int_east_mid", x: 20, z: 0, radius: 4.5, type: "CROSS" },
  { id: "int_east_outer", x: 40, z: 0, radius: 4.5, type: "CROSS" },
  { id: "int_west_mid", x: -20, z: 0, radius: 4.5, type: "CROSS" },
  { id: "int_west_outer", x: -40, z: 0, radius: 4.5, type: "CROSS" },
];

// -----------------------------------------------------
// SHAWARMA FLAGSHIP HUB & DELIVERY LOCATION
// -----------------------------------------------------
export const SHAWARMA_HUB_LOCATION = {
  building: {
    x: 7.5,
    z: -7.5,
    w: 9.0,
    h: 5.2,
    d: 5.5,
    rotY: -Math.PI / 2, // Facing Central Avenue
  },
  deliveryZone: {
    x: 4.2,
    y: 0.03,
    z: -7.5,
    radius: 3.2,
  },
};

// -----------------------------------------------------
// PLAYER TRUCK SPAWN LOCATION
// -----------------------------------------------------
export const PLAYER_SPAWN_LOCATION = {
  x: 0.0,
  y: 0.0,
  z: 8.5,
  heading: 0, // Facing North towards Central Roundabout & Shawarma Hub
};

// -----------------------------------------------------
// MOUNT FAKO 2D SOLID OBSTACLE REGISTRY
// -----------------------------------------------------
export interface CityObstacle {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  type: "building" | "compoundWall" | "marketStall" | "boundary" | "landmark";
  name?: string;
}

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
// ROAD CORRIDOR BOUNDARY DETECTION HELPER
// Tests whether a coordinate (or circle) intersects any drivable road corridor
// -----------------------------------------------------
export function isInsideRoadCorridor(
  x: number,
  z: number,
  margin = 0.6
): boolean {
  // Roundabout check
  if (Math.hypot(x, z) <= 7.2 + margin) {
    return true;
  }

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
// SOLID OBSTACLE COLLIDERS
// Positioned with strict road corridor setbacks (zero road overlap)
// -----------------------------------------------------
export const CITY_OBSTACLES: CityObstacle[] = [
  // 1. Central Plaza Structures (Set back from Central Ave & Grand Blvd)
  makeObstacle(-8.0, -8.0, 6.8, 4.5, Math.PI / 2, "building", "Plaza Bank"),
  makeObstacle(-8.0, 8.0, 6.5, 4.2, Math.PI / 2, "building", "Plaza Pharmacy"),
  makeObstacle(8.0, 8.0, 6.2, 4.0, -Math.PI / 2, "building", "Plaza Commercial"),
  makeObstacle(-9.5, -23.0, 5.5, 4.0, 0, "building", "Plaza West Annex"),
  makeObstacle(9.5, -23.0, 5.5, 4.0, 0, "building", "Plaza East Annex"),

  // 2. CyberWrap Shawarma Hub Flagship Landmark (Exact footprint matching SHAWARMA_HUB_LOCATION)
  makeObstacle(
    SHAWARMA_HUB_LOCATION.building.x,
    SHAWARMA_HUB_LOCATION.building.z,
    SHAWARMA_HUB_LOCATION.building.w,
    SHAWARMA_HUB_LOCATION.building.d,
    SHAWARMA_HUB_LOCATION.building.rotY,
    "landmark",
    "CyberWrap Shawarma Hub"
  ),

  // 3. Molyko Market Square (East) (Set back from East Perimeter X=40 & Inner East X=20)
  makeObstacle(25.0, -8.0, 3.8, 3.2, 0, "marketStall", "Market Stall North 1"),
  makeObstacle(29.0, -8.0, 3.8, 3.2, 0, "marketStall", "Market Stall North 2"),
  makeObstacle(33.0, -8.0, 3.8, 3.2, 0, "marketStall", "Market Stall North 3"),
  makeObstacle(25.0, 8.0, 3.8, 3.2, Math.PI, "marketStall", "Market Stall South 1"),
  makeObstacle(29.0, 8.0, 3.8, 3.2, Math.PI, "marketStall", "Market Stall South 2"),
  makeObstacle(33.0, 8.0, 3.8, 3.2, Math.PI, "marketStall", "Market Stall South 3"),
  makeObstacle(28.0, -22.0, 6.2, 4.0, 0, "building", "Market Commercial NE"),
  makeObstacle(33.0, -22.0, 5.0, 4.0, 0, "building", "Market Store NE"),
  makeObstacle(28.0, 22.0, 6.0, 4.0, Math.PI, "building", "Market Commercial SE"),
  makeObstacle(33.0, 22.0, 5.0, 4.0, Math.PI, "building", "Market Store SE"),

  // 4. Mount Fako Heights & Hillside Ridge (North) (Set back from Hillside Parkway Z=-32)
  makeObstacle(-14.0, -38.0, 6.5, 5.0, 0, "building", "Fako Villa West"),
  makeObstacle(0.0, -44.0, 7.2, 5.2, 0, "building", "Fako Summit Villa"),
  makeObstacle(14.0, -38.0, 6.5, 5.0, 0, "building", "Fako Villa East"),
  makeObstacle(-30.0, -38.0, 8.0, 5.5, 0, "building", "Highland Compound West"),
  makeObstacle(30.0, -38.0, 8.0, 5.5, 0, "building", "Highland Compound East"),

  // 5. Clerks Quarters (West Residential) (Set back from West Perimeter X=-40 & Inner West X=-20)
  makeObstacle(-28.0, -8.0, 6.0, 4.8, Math.PI / 2, "building", "Clerks Villa NW"),
  makeObstacle(-28.0, 8.0, 6.0, 4.8, Math.PI / 2, "building", "Clerks Villa SW"),
  makeObstacle(-33.5, -8.0, 5.0, 4.0, -Math.PI / 2, "building", "Clerks Outer NW"),
  makeObstacle(-33.5, 8.0, 5.0, 4.0, -Math.PI / 2, "building", "Clerks Outer SW"),
  makeObstacle(-28.0, -22.0, 5.8, 4.5, 0, "building", "Clerks Villa North"),
  makeObstacle(-33.5, -22.0, 4.8, 4.5, 0, "building", "Clerks Outer North"),
  makeObstacle(-28.0, 22.0, 5.8, 4.5, Math.PI, "building", "Clerks Villa South"),
  makeObstacle(-33.5, 22.0, 4.8, 4.5, Math.PI, "building", "Clerks Outer South"),

  // 6. Greenfield Valley & Outskirts (South) (Set back from South Valley Drive Z=32)
  makeObstacle(-14.0, 38.0, 6.2, 4.5, Math.PI, "building", "Valley Villa West"),
  makeObstacle(0.0, 44.0, 7.0, 4.8, Math.PI, "building", "Valley South Manor"),
  makeObstacle(14.0, 38.0, 6.2, 4.5, Math.PI, "building", "Valley Villa East"),
  makeObstacle(-30.0, 38.0, 6.0, 4.2, Math.PI, "building", "Valley Compound West"),
  makeObstacle(30.0, 38.0, 6.0, 4.2, Math.PI, "building", "Valley Compound East"),
];

// Truck 2D collision radius in meters
export const TRUCK_COLLISION_RADIUS = 1.1;

// Playable city boundary limits in meters
export const PLAYABLE_BOUNDARY_LIMIT = 45.0;

// -----------------------------------------------------
// 2D FOOTPRINT-BASED COLLISION RESOLVER & SLIDE RESPONSE
// -----------------------------------------------------
export function resolveCityCollision(
  proposedX: number,
  proposedZ: number,
  radius: number = TRUCK_COLLISION_RADIUS
): { x: number; z: number; collided: boolean } {
  let resX = proposedX;
  let resZ = proposedZ;
  let collided = false;

  // 1. Enforce hard perimeter playable boundaries
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

  // 2. Multi-pass circle-to-AABB collision check and wall-slide projection
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
          // Inside obstacle box: push out along shortest axis to maintain playable position
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
// INTELLIGENT ROAD-ALIGNED COLLECTIBLE SPAWN NODES
// (36 carefully positioned nodes distributed across all 5 districts)
// -----------------------------------------------------
export const CITY_COLLECTIBLE_SPAWN_NODES: SpawnPointCoord[] = [
  // Center District
  { x: 0.0, y: 0.45, z: -12.0, district: "center", name: "Central Ave North Approach" },
  { x: -3.8, y: 0.45, z: -4.5, district: "center", name: "Central Plaza West Curbside" },
  { x: 3.8, y: 0.45, z: 4.5, district: "center", name: "Central Plaza East Curbside" },
  { x: 0.0, y: 0.45, z: 12.0, district: "center", name: "Central Ave South Approach" },
  { x: -7.5, y: 0.45, z: 0.0, district: "center", name: "Grand Blvd West Apron" },
  { x: 7.5, y: 0.45, z: 0.0, district: "center", name: "Grand Blvd East Apron" },

  // Molyko Market Square (East)
  { x: 20.0, y: 0.45, z: -8.0, district: "market", name: "Market Bazaar North Alley" },
  { x: 20.0, y: 0.45, z: 8.0, district: "market", name: "Market Bazaar South Alley" },
  { x: 28.0, y: 0.45, z: 0.0, district: "market", name: "Produce Stalls Mid-Way" },
  { x: 34.0, y: 0.45, z: -16.0, district: "market", name: "Artisan Canopy Corner" },
  { x: 34.0, y: 0.45, z: 16.0, district: "market", name: "Spice & Fruit Pavilion" },
  { x: 40.0, y: 0.45, z: -10.0, district: "market", name: "East Bypass North Pull-Off" },
  { x: 40.0, y: 0.45, z: 10.0, district: "market", name: "East Bypass South Pull-Off" },
  { x: 28.0, y: 0.45, z: -24.0, district: "market", name: "Market Overlook Terrace" },

  // Mount Fako Heights & Hillside Ridge (North)
  { x: 0.0, y: 0.45, z: -26.0, district: "hillside", name: "Fako Ridge Climbing Turn" },
  { x: 0.0, y: 0.45, z: -36.0, district: "hillside", name: "Mount Fako Summit Lookout" },
  { x: -14.0, y: 0.45, z: -32.0, district: "hillside", name: "Highland Villa Entrance" },
  { x: 14.0, y: 0.45, z: -32.0, district: "hillside", name: "Mountain Crest Overlook" },
  { x: -28.0, y: 0.45, z: -32.0, district: "hillside", name: "North-West Pine Vista" },
  { x: 28.0, y: 0.45, z: -32.0, district: "hillside", name: "North-East Tea Estate Curve" },
  { x: -36.0, y: 0.45, z: -24.0, district: "hillside", name: "Highland Compound Gate" },
  { x: 36.0, y: 0.45, z: -24.0, district: "hillside", name: "Hillside Guest House Bay" },

  // Clerks Quarters (West Residential)
  { x: -20.0, y: 0.45, z: -8.0, district: "residential", name: "Clerks Compound North" },
  { x: -20.0, y: 0.45, z: 8.0, district: "residential", name: "Clerks Compound South" },
  { x: -28.0, y: 0.45, z: 0.0, district: "residential", name: "Residential Palms Avenue" },
  { x: -34.0, y: 0.45, z: -16.0, district: "residential", name: "Villa Balcony Drive" },
  { x: -34.0, y: 0.45, z: 16.0, district: "residential", name: "Quiet Compound Court" },
  { x: -40.0, y: 0.45, z: -10.0, district: "residential", name: "West Ring North Corner" },
  { x: -40.0, y: 0.45, z: 10.0, district: "residential", name: "West Ring South Corner" },
  { x: -26.0, y: 0.45, z: -22.0, district: "residential", name: "Upper Residential Lane" },

  // Greenfield Valley & Outskirts (South)
  { x: 0.0, y: 0.45, z: 24.0, district: "valley", name: "Valley Greenways Stretch" },
  { x: 0.0, y: 0.45, z: 36.0, district: "valley", name: "South Terminal Overlook" },
  { x: -16.0, y: 0.45, z: 32.0, district: "valley", name: "Valley Palms Wayside" },
  { x: 16.0, y: 0.45, z: 32.0, district: "valley", name: "Mango Grove Pull-Off" },
  { x: -28.0, y: 0.45, z: 24.0, district: "valley", name: "South-West Kiosk Corner" },
  { x: 28.0, y: 0.45, z: 24.0, district: "valley", name: "South-East Garden Road" },
];

// -----------------------------------------------------
// AUTHORITATIVE CONTINUOUS SURFACE ELEVATION SAMPLER
// (Playable city drive zone is a flat plain at Y = 0)
// -----------------------------------------------------
export function getCitySurfaceElevation(_x: number, _z: number): number {
  return 0.0;
}
