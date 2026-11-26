// Heading-up radar / mini-map: baked terrain map, range rings, rotating sweep, fires (pulsing),
// the stilt village, the runway, rings and the objective, with the aircraft at the centre.
import { C, font, glow, panel } from './hud-style.js';
import { terrainMap, MAP_EXTENT } from './terrain-map.js';
import { PLACES } from '../world/terrain.js';

export function radar(g, game, cx, cy, r, u, time, range = 2600) {
  const s = game.flight;
  const map = terrainMap();
  const scale = r / range; // px per metre
  const hdg = (s.heading * Math.PI) / 180;
  // World (x,z) to radar screen, heading-up.
  const toScreen = (x, z) => {
    const dx = x - s.position.x, dz = z - s.position.z;
    const rx = dx * Math.cos(hdg) + dz * Math.sin(hdg);
    const rz = -dx * Math.sin(hdg) + dz * Math.cos(hdg);
    return [cx + rx * scale, cy + rz * scale];
  };
  panel(g, cx - r - 6 * u, cy - r - 6 * u, r * 2 + 12 * u, r * 2 + 12 * u, u);
  g.save();
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
  // Terrain map, rotated so the nose points up.
  g.translate(cx, cy);
  g.rotate(-hdg);
  g.globalAlpha = 0.9;
  g.imageSmoothingEnabled = true;
  g.drawImage(map.canvas, (-MAP_EXTENT / 2 - s.position.x) * scale, (-MAP_EXTENT / 2 - s.position.z) * scale, MAP_EXTENT * scale, MAP_EXTENT * scale);
  g.restore();
  g.save();
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
  // Darken + green tint so symbols read on top.
  g.fillStyle = 'rgba(0,18,10,0.35)';
  g.fillRect(cx - r, cy - r, r * 2, r * 2);
  // Range rings and cross hair
  g.strokeStyle = C.greenFaint; g.lineWidth = 1;
  for (const k of [0.33, 0.66]) { g.beginPath(); g.arc(cx, cy, r * k, 0, Math.PI * 2); g.stroke(); }
  g.beginPath(); g.moveTo(cx - r, cy); g.lineTo(cx + r, cy); g.moveTo(cx, cy - r); g.lineTo(cx, cy + r); g.stroke();
  // Sweep: a fading wedge turning once every 3 s.
  const a = (time * Math.PI * 2) / 3;
  for (let i = 0; i < 14; i++) {
    g.fillStyle = `rgba(120,255,160,${0.16 * (1 - i / 14)})`;
    g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, a - (i + 1) * 0.05, a - i * 0.05); g.closePath(); g.fill();
  }
  // Fires: pulsing orange blips.
  const pulse = 0.6 + 0.4 * Math.sin(time * 6);
  for (const c of game.fire.activeCells()) {
    const [x, y] = toScreen(c.x, c.z);
    if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
    g.fillStyle = `rgba(255,${90 + c.heat * 60},40,${0.5 + 0.5 * pulse * Math.min(1, c.heat + 0.3)})`;
    g.beginPath(); g.arc(x, y, (1.6 + c.heat * 1.8) * u, 0, Math.PI * 2); g.fill();
  }
  // Village
  {
    const [x, y] = toScreen(PLACES.village.x, PLACES.village.z);
    g.strokeStyle = C.white; g.fillStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(x - 5 * u, y + 3 * u); g.lineTo(x - 5 * u, y - 1 * u); g.lineTo(x, y - 6 * u); g.lineTo(x + 5 * u, y - 1 * u); g.lineTo(x + 5 * u, y + 3 * u); g.closePath(); g.stroke();
  }
  // Rings of the current stage
  const rings = (game.stageData.rings || []).filter((k) => k.visible).concat(game.stageData.ring ? [game.stageData.ring] : []);
  for (const ring of rings) {
    const [x, y] = toScreen(ring.position.x, ring.position.z);
    g.strokeStyle = C.amber; g.lineWidth = 1.5;
    g.beginPath(); g.arc(x, y, 4 * u, 0, Math.PI * 2); g.stroke();
  }
  // Objective diamond with a dashed bearing line
  if (game.objective) {
    let [x, y] = toScreen(game.objective.pos.x, game.objective.pos.z);
    const d = Math.hypot(x - cx, y - cy);
    if (d > r - 6 * u) { x = cx + ((x - cx) / d) * (r - 6 * u); y = cy + ((y - cy) / d) * (r - 6 * u); }
    g.strokeStyle = 'rgba(255,200,97,0.7)'; g.setLineDash([3, 3]);
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(x, y); g.stroke(); g.setLineDash([]);
    g.fillStyle = C.amber; g.shadowColor = C.amber; g.shadowBlur = 6;
    g.beginPath(); g.moveTo(x, y - 5 * u); g.lineTo(x + 5 * u, y); g.lineTo(x, y + 5 * u); g.lineTo(x - 5 * u, y); g.closePath(); g.fill();
    g.shadowBlur = 0;
  }
  g.restore();
  // Aircraft symbol
  g.save();
  g.translate(cx, cy);
  g.fillStyle = C.white; g.shadowColor = C.white; g.shadowBlur = 5;
  g.beginPath();
  g.moveTo(0, -7 * u); g.lineTo(1.4 * u, -2 * u); g.lineTo(7 * u, 0); g.lineTo(7 * u, 1.6 * u); g.lineTo(1.2 * u, 1 * u); g.lineTo(1 * u, 4.5 * u);
  g.lineTo(3 * u, 6 * u); g.lineTo(-3 * u, 6 * u); g.lineTo(-1 * u, 4.5 * u); g.lineTo(-1.2 * u, 1 * u); g.lineTo(-7 * u, 1.6 * u); g.lineTo(-7 * u, 0); g.lineTo(-1.4 * u, -2 * u);
  g.closePath(); g.fill();
  g.restore();
  // Outer ring with the north mark rotating around it.
  g.save();
  g.strokeStyle = C.green; g.lineWidth = 1.5; g.shadowColor = C.green; g.shadowBlur = 4;
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  const na = -hdg - Math.PI / 2;
  g.textAlign = 'center';
  font(g, 700, 10 * u, 'mono');
  glow(g, 'N', cx + Math.cos(na) * (r - 9 * u), cy + Math.sin(na) * (r - 9 * u), C.amber, 4);
  font(g, 700, 8.5 * u, 'mono');
  g.fillStyle = C.greenDim;
  g.textAlign = 'right';
  g.fillText(`${(range / 1000).toFixed(1)} KM`, cx + r, cy + r + 2 * u);
  g.restore();
}
