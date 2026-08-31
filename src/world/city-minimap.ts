// =====================================================
// CYBERWRAP: PROCEDURAL CITY MINIMAP RADAR SYSTEM
// Accurately maps the actual generated Buea / Mount Fako Heights
// road network, districts, player truck, Shawarma Shop, and collectibles.
// =====================================================

import { CITY_BOUNDS, CITY_ROADS, CITY_DISTRICTS, SHAWARMA_HUB_LOCATION } from "./city-config";
import { gameData } from "../core/game-data";

let radarScanAngle = 0;

export function renderCityMinimap(
  canvas: HTMLCanvasElement,
  hudWorld: any
): void {
  if (!canvas || !hudWorld) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const radarRadius = w / 2 - 4;

  const mapSpan = CITY_BOUNDS.size / 2; // 46 units from center
  const project = (pos: { x: number; z: number }) => ({
    x: cx + Math.max(-1, Math.min(1, pos.x / mapSpan)) * (radarRadius - 8),
    y: cy + Math.max(-1, Math.min(1, pos.z / mapSpan)) * (radarRadius - 8),
  });

  ctx.clearRect(0, 0, w, h);

  // 1. Circular Clip for Radar
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2);
  ctx.clip();

  // 2. Background Gradient (Dark Cyber Radar)
  const bgGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, radarRadius);
  bgGrad.addColorStop(0, "#0a1e2f");
  bgGrad.addColorStop(0.7, "#05131f");
  bgGrad.addColorStop(1, "#020910");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // 3. Concentric Distance Rings
  ctx.strokeStyle = "rgba(0, 240, 255, 0.16)";
  ctx.lineWidth = 1;
  [0.35, 0.68, 0.95].forEach((pct) => {
    ctx.beginPath();
    ctx.arc(cx, cy, radarRadius * pct, 0, Math.PI * 2);
    ctx.stroke();
  });

  // 4. Crosshair Grid Lines
  ctx.strokeStyle = "rgba(0, 240, 255, 0.12)";
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, h);
  ctx.moveTo(0, cy);
  ctx.lineTo(w, cy);
  ctx.stroke();

  // 5. Draw Actual Procedural Road Network
  for (const road of CITY_ROADS) {
    const p1 = project({ x: road.startX, z: road.startZ });
    const p2 = project({ x: road.endX, z: road.endZ });

    if (road.type === "MAIN_AVENUE") {
      ctx.strokeStyle = "rgba(0, 240, 255, 0.45)";
      ctx.lineWidth = 4.5;
    } else if (road.type === "SECONDARY") {
      ctx.strokeStyle = "rgba(0, 240, 255, 0.3)";
      ctx.lineWidth = 3.2;
    } else {
      ctx.strokeStyle = "rgba(0, 240, 255, 0.2)";
      ctx.lineWidth = 2.2;
    }

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  // Central Roundabout on Radar
  ctx.fillStyle = "rgba(0, 240, 255, 0.5)";
  ctx.beginPath();
  ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
  ctx.fill();

  // 6. Rotating Radar Scan Sweep
  radarScanAngle = (radarScanAngle + 0.035) % (Math.PI * 2);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(radarScanAngle);
  const scanGrad = ctx.createLinearGradient(0, 0, radarRadius, 0);
  scanGrad.addColorStop(0, "rgba(0, 240, 255, 0.45)");
  scanGrad.addColorStop(1, "rgba(0, 240, 255, 0.0)");
  ctx.strokeStyle = scanGrad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(radarRadius, 0);
  ctx.stroke();
  ctx.restore();

  // 7. Shawarma Flagship Shop / Drop-Off Zone Beacon
  const hubPos = project(SHAWARMA_HUB_LOCATION.deliveryZone);
  // Cyan pulsing glow
  ctx.fillStyle = "rgba(0, 240, 255, 0.4)";
  ctx.beginPath();
  ctx.arc(hubPos.x, hubPos.y, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#00f0ff";
  ctx.shadowColor = "#00ffff";
  ctx.shadowBlur = 8;
  ctx.fillRect(hubPos.x - 3.5, hubPos.y - 3.5, 7, 7);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 6px Orbitron, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("HUB", hubPos.x, hubPos.y + 9);

  // 8. Active Collectibles Markers (Gold Pings)
  ctx.fillStyle = "#ffd166";
  ctx.shadowColor = "#ffaa00";
  ctx.shadowBlur = 6;
  for (const eid of gameData.collectibleEids) {
    try {
      const pos = hudWorld.transform.getWorldPosition(eid);
      if (pos && !isNaN(pos.x) && !isNaN(pos.z)) {
        const marker = project(pos);
        ctx.beginPath();
        ctx.arc(marker.x, marker.y, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
    } catch {
      // ignore deleted entities
    }
  }
  ctx.shadowBlur = 0;

  // 9. Player Truck Directional Indicator (Neon Red Heading Chevron)
  if (gameData.truckEid !== null) {
    try {
      const truckPos = hudWorld.transform.getWorldPosition(gameData.truckEid);
      const marker = project(truckPos);
      const angle = -gameData.truckHeading;

      ctx.save();
      ctx.translate(marker.x, marker.y);
      ctx.rotate(angle);

      // Red Glow Halo
      ctx.fillStyle = "rgba(255, 51, 68, 0.45)";
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();

      // Heading Chevron
      ctx.fillStyle = "#ff3344";
      ctx.shadowColor = "#ff0033";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(0, -6.5);
      ctx.lineTo(4.5, 4.5);
      ctx.lineTo(0, 2.5);
      ctx.lineTo(-4.5, 4.5);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.restore();
    } catch {
      // ignore
    }
  }

  ctx.restore();
}
