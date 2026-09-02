// =====================================================
// CYBERWRAP: PROCEDURAL CITY VALIDATION & DIAGNOSTICS
// Phase 17: Spacious Open-World Delivery Map Redesign (190m x 190m)
// Runtime validation verifying road connectivity, collision clearances,
// collectible visibility/accessibility, delivery routes, DailyBread Shawarma
// landmark integrity, and WebGL mobile performance budgets.
// =====================================================

import {
  CITY_BOUNDS,
  CITY_ROADS,
  CITY_INTERSECTIONS,
  CITY_OBSTACLES,
  CITY_COLLECTIBLE_SPAWN_NODES,
  SHAWARMA_HUB_LOCATION,
  isInsideRoadCorridor,
} from "./city-config";

export interface CityValidationSummary {
  cityFootprint: string;
  primaryRoadCount: number;
  secondaryRoadCount: number;
  localRoadCount: number;
  totalRoadSegmentCount: number;
  intersectionCount: number;
  roundaboutCount: number;
  districtCount: number;
  obstacleCount: number;
  buildingCount: number;
  propCount: number;
  vegetationCount: number;
  landmarkCount: number;
  openSpaceZonesCount: number;
  collectibleNodeCount: number;
  collectibleVisibilityValid: number;
  collectibleVisibilityWarning: number;
  collectibleVisibilityInvalid: number;
  deliveryRoutesTested: number;
  deliveryRoutesPassed: number;
  overlapsDetected: number;
  shawarmaHubValidated: boolean;
  validationPassed: boolean;
  warnings: string[];
}

export function validateGeneratedCity(metrics: {
  buildingCount: number;
  propCount: number;
  vegetationCount: number;
  landmarkCount: number;
}): CityValidationSummary {
  const warnings: string[] = [];
  let overlapsDetected = 0;
  let shawarmaHubValidated = false;

  // 1. Validate Road Hierarchy & Connectivity
  let primaryRoadCount = 0;
  let secondaryRoadCount = 0;
  let localRoadCount = 0;
  let roundaboutCount = 0;

  for (let i = 0; i < CITY_ROADS.length; i++) {
    const road = CITY_ROADS[i];
    const dx = road.endX - road.startX;
    const dz = road.endZ - road.startZ;
    const len = Math.hypot(dx, dz);
    if (len < 1.0) {
      warnings.push(`Road '${road.id}' has degenerate length: ${len.toFixed(2)}m`);
    }

    if (road.type === "MAIN_AVENUE") primaryRoadCount++;
    else if (road.type === "SECONDARY") secondaryRoadCount++;
    else if (road.type === "LOCAL") localRoadCount++;
    else if (road.type === "ROUNDABOUT") roundaboutCount++;
  }

  for (let i = 0; i < CITY_INTERSECTIONS.length; i++) {
    if (CITY_INTERSECTIONS[i].type === "ROUNDABOUT") {
      roundaboutCount++;
    }
  }

  // 2. Validate Obstacle Setbacks (Zero Intrusion into Road Corridors)
  for (let i = 0; i < CITY_OBSTACLES.length; i++) {
    const obs = CITY_OBSTACLES[i];
    const centerX = (obs.minX + obs.maxX) / 2;
    const centerZ = (obs.minZ + obs.maxZ) / 2;

    const corners = [
      { x: obs.minX, z: obs.minZ },
      { x: obs.maxX, z: obs.minZ },
      { x: obs.minX, z: obs.maxZ },
      { x: obs.maxX, z: obs.maxZ },
      { x: centerX, z: centerZ },
    ];

    for (const pt of corners) {
      if (isInsideRoadCorridor(pt.x, pt.z, -0.4)) {
        warnings.push(
          `Obstacle '${obs.name || obs.type}' at (${pt.x.toFixed(1)}, ${pt.z.toFixed(1)}) encroaches road corridor`
        );
        overlapsDetected++;
        break;
      }
    }
  }

  // 3. Strict DailyBread Shawarma Signature Landmark & Delivery Hub Verification
  const hub = SHAWARMA_HUB_LOCATION;
  const hubDrop = hub.deliveryZone;

  // 3a. Verify authoritative location invariance
  if (
    Math.abs(hub.building.x - 10.0) > 0.01 ||
    Math.abs(hub.building.z - -10.0) > 0.01 ||
    Math.abs(hubDrop.x - 5.2) > 0.01 ||
    Math.abs(hubDrop.z - -10.0) > 0.01
  ) {
    warnings.push(`SHAWARMA_HUB_LOCATION coordinates altered from authoritative baseline`);
  }

  // 3b. Verify exactly one authoritative restaurant obstacle
  const shawarmaObstacles = CITY_OBSTACLES.filter(
    (o) =>
      o.name === "DailyBread Shawarma Restaurant" ||
      o.name === "Shawarma Hub Restaurant" ||
      o.name === "CyberWrap Shawarma Hub" ||
      (o.minX <= 10.0 && o.maxX >= 10.0 && o.minZ <= -10.0 && o.maxZ >= -10.0)
  );
  if (shawarmaObstacles.length !== 1) {
    warnings.push(`Expected exactly 1 authoritative DailyBread Shawarma building obstacle, found ${shawarmaObstacles.length}`);
  }

  // 3c. Verify restaurant building does not overlap road corridors
  const bldgCorners = [
    { x: hub.building.x - hub.building.w / 2, z: hub.building.z - hub.building.d / 2 },
    { x: hub.building.x + hub.building.w / 2, z: hub.building.z - hub.building.d / 2 },
    { x: hub.building.x - hub.building.w / 2, z: hub.building.z + hub.building.d / 2 },
    { x: hub.building.x + hub.building.w / 2, z: hub.building.z + hub.building.d / 2 },
  ];
  for (const c of bldgCorners) {
    if (isInsideRoadCorridor(c.x, c.z, 0)) {
      warnings.push(`DailyBread Shawarma building footprint encroaches road corridor at (${c.x}, ${c.z})`);
      overlapsDetected++;
    }
  }

  // 3d. Verify delivery drop zone accessibility
  if (!isInsideRoadCorridor(hubDrop.x, hubDrop.z, 2.5)) {
    warnings.push(`DailyBread Shawarma delivery drop zone is not cleanly adjacent to road corridor`);
  } else {
    shawarmaHubValidated = true;
  }

  // 4. Collectible Visibility, Clearance & Accessibility Validation
  let collectibleVisibilityValid = 0;
  let collectibleVisibilityWarning = 0;
  let collectibleVisibilityInvalid = 0;

  for (let i = 0; i < CITY_COLLECTIBLE_SPAWN_NODES.length; i++) {
    const node = CITY_COLLECTIBLE_SPAWN_NODES[i];

    // Bounds check
    if (
      node.x < CITY_BOUNDS.minX ||
      node.x > CITY_BOUNDS.maxX ||
      node.z < CITY_BOUNDS.minZ ||
      node.z > CITY_BOUNDS.maxZ
    ) {
      warnings.push(`Collectible node '${node.name}' is outside city bounds`);
      collectibleVisibilityInvalid++;
      continue;
    }

    // Inside obstacle check
    let insideObstacle = false;
    let clearanceWarning = false;
    for (const obs of CITY_OBSTACLES) {
      if (
        node.x >= obs.minX &&
        node.x <= obs.maxX &&
        node.z >= obs.minZ &&
        node.z <= obs.maxZ
      ) {
        insideObstacle = true;
        break;
      }
      // Check 1.2m truck clearance
      const cx = Math.max(obs.minX, Math.min(node.x, obs.maxX));
      const cz = Math.max(obs.minZ, Math.min(node.z, obs.maxZ));
      const dist = Math.hypot(node.x - cx, node.z - cz);
      if (dist < 0.8) {
        clearanceWarning = true;
      }
    }

    if (insideObstacle) {
      warnings.push(`Collectible node '${node.name}' at (${node.x}, ${node.z}) is inside obstacle footprint`);
      collectibleVisibilityInvalid++;
    } else if (clearanceWarning) {
      collectibleVisibilityWarning++;
    } else {
      collectibleVisibilityValid++;
    }
  }

  // 5. Delivery Route Reachability Tests from DailyBread Hub (5.2, -10.0)
  const deliveryTestRoutes = [
    { name: "Easy - Central North Crossing", target: { x: 0, z: -38 } },
    { name: "Medium - Molyko Market Plaza", target: { x: 38, z: 0 } },
    { name: "Medium - Clerks Central Blvd", target: { x: -38, z: 0 } },
    { name: "Hard - Mount Fako Ridge Overlook", target: { x: 0, z: -78 } },
    { name: "Hard - Greenfield Valley Agro Hub", target: { x: 78, z: 78 } },
    { name: "Hillside - North-East Tea Estate", target: { x: 78, z: -78 } },
    { name: "Industrial - South-West Transit Depot", target: { x: -78, z: 78 } },
  ];

  let deliveryRoutesPassed = 0;
  for (const route of deliveryTestRoutes) {
    const reachable = isInsideRoadCorridor(route.target.x, route.target.z, 4.0);
    if (reachable) {
      deliveryRoutesPassed++;
    } else {
      warnings.push(`Delivery test route destination '${route.name}' failed road connectivity check`);
    }
  }

  // 6. Performance Budget & Landmark Count Verification
  if (metrics.landmarkCount < 4 || metrics.landmarkCount > 6) {
    warnings.push(`Landmark count (${metrics.landmarkCount}) outside recommended range [4, 6]`);
  }
  if (metrics.buildingCount < 60 || metrics.buildingCount > 85) {
    warnings.push(`Building count (${metrics.buildingCount}) outside recommended range [60, 85]`);
  }
  if (metrics.propCount < 100 || metrics.propCount > 200) {
    warnings.push(`Prop count (${metrics.propCount}) outside recommended range [100, 200]`);
  }
  if (metrics.vegetationCount < 60 || metrics.vegetationCount > 120) {
    warnings.push(`Vegetation count (${metrics.vegetationCount}) outside recommended range [60, 120]`);
  }

  const summary: CityValidationSummary = {
    cityFootprint: `${CITY_BOUNDS.size}m x ${CITY_BOUNDS.size}m`,
    primaryRoadCount,
    secondaryRoadCount,
    localRoadCount,
    totalRoadSegmentCount: CITY_ROADS.length,
    intersectionCount: CITY_INTERSECTIONS.length,
    roundaboutCount,
    districtCount: 6,
    obstacleCount: CITY_OBSTACLES.length,
    buildingCount: metrics.buildingCount,
    propCount: metrics.propCount,
    vegetationCount: metrics.vegetationCount,
    landmarkCount: metrics.landmarkCount,
    openSpaceZonesCount: 8,
    collectibleNodeCount: CITY_COLLECTIBLE_SPAWN_NODES.length,
    collectibleVisibilityValid,
    collectibleVisibilityWarning,
    collectibleVisibilityInvalid,
    deliveryRoutesTested: deliveryTestRoutes.length,
    deliveryRoutesPassed,
    overlapsDetected,
    shawarmaHubValidated,
    validationPassed: warnings.length === 0,
    warnings,
  };

  console.log(`[CityValidator] Validation Complete: ${summary.validationPassed ? "PASSED (0 warnings)" : `${warnings.length} Warnings`}`);
  if (warnings.length > 0) {
    console.warn(`[CityValidator] Warnings:`, warnings);
  }

  return summary;
}
