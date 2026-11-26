// Multi-function display on the centre panel: a heading-up moving map (terrain, fires, village,
// runway, rings, objective with bearing and distance), a compass arc, range rings, the aircraft's
// breadcrumb trail, and data bars (ground speed, wind, water, ETA).
import { terrainMap, MAP_EXTENT } from '../hud/terrain-map.js';
import { PLACES } from '../world/terrain.js';
import { font } from './gauge-drawing.js';

const CYAN = '#5fe3ff', MAGENTA = '#ff5cf0', GREEN = '#7dff9a', AMBER = '#ffbf3c', WHITE = '#eef6ff';

export function drawMovingMap(g, game, mfd, x, y, w, h, time) {
  const s = game.flight;
  const map = terrainMap();
  // Screen frame
  g.save();
  g.fillStyle = '#060708';
  g.beginPath(); g.roundRect(x - 14, y - 14, w + 28, h + 28, 10); g.fill();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = '#02060a';
  g.fillRect(x, y, w, h);
  const range = 3000; // metres from the aircraft to the top of the compass arc
  const cx = x + w / 2, cy = y + h * 0.78;
  const scale = (h * 0.7) / range;
  const hdg = (s.heading * Math.PI) / 180;
  g.save();
  g.translate(cx, cy);
  g.rotate(-hdg);
  g.globalAlpha = 0.85;
  g.drawImage(map.canvas, (-MAP_EXTENT / 2 - s.position.x) * scale, (-MAP_EXTENT / 2 - s.position.z) * scale, MAP_EXTENT * scale, MAP_EXTENT * scale);
  g.globalAlpha = 1;
  const P = (wx, wz) => [(wx - s.position.x) * scale, (wz - s.position.z) * scale];
  // Breadcrumb trail
  mfd.trail = mfd.trail || [];
  if (!mfd.lastCrumb || time - mfd.lastCrumb > 1) {
    mfd.lastCrumb = time;
    mfd.trail.push([s.position.x, s.position.z]);
    if (mfd.trail.length > 90) mfd.trail.shift();
  }
  g.strokeStyle = 'rgba(95,227,255,0.55)'; g.lineWidth = 2; g.setLineDash([4, 6]);
  g.beginPath();
  mfd.trail.forEach(([a, b], i) => { const [px, pz] = P(a, b); if (i) g.lineTo(px, pz); else g.moveTo(px, pz); });
  g.stroke(); g.setLineDash([]);
  // Runway
  const r = PLACES.runway;
  const [r0x, r0z] = P(r.x, r.z - r.length / 2), [r1x, r1z] = P(r.x, r.z + r.length / 2);
  g.strokeStyle = WHITE; g.lineWidth = 5;
  g.beginPath(); g.moveTo(r0x, r0z); g.lineTo(r1x, r1z); g.stroke();
  // Fires
  const pulse = 0.5 + 0.5 * Math.sin(time * 5);
  for (const c of game.fire.activeCells()) {
    const [px, pz] = P(c.x, c.z);
    g.fillStyle = `rgba(255,${80 + c.heat * 70},30,${0.55 + 0.45 * pulse})`;
    g.beginPath(); g.arc(px, pz, 3 + c.heat * 4, 0, Math.PI * 2); g.fill();
  }
  // Village
  const [vx, vz] = P(PLACES.village.x, PLACES.village.z);
  g.strokeStyle = WHITE; g.lineWidth = 2;
  g.strokeRect(vx - 7, vz - 7, 14, 14);
  // Rings and objective
  const rings = (game.stageData.rings || []).filter((k) => k.visible).concat(game.stageData.ring ? [game.stageData.ring] : []);
  g.strokeStyle = AMBER; g.lineWidth = 2.5;
  for (const k of rings) { const [px, pz] = P(k.position.x, k.position.z); g.beginPath(); g.arc(px, pz, 8, 0, Math.PI * 2); g.stroke(); }
  if (game.objective) {
    const [ox, oz] = P(game.objective.pos.x, game.objective.pos.z);
    g.strokeStyle = MAGENTA; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(ox, oz); g.stroke();
    g.fillStyle = MAGENTA;
    g.beginPath(); g.moveTo(ox, oz - 9); g.lineTo(ox + 9, oz); g.lineTo(ox, oz + 9); g.lineTo(ox - 9, oz); g.closePath(); g.fill();
  }
  g.restore();
  // Range rings and compass arc (fixed, heading-up)
  g.strokeStyle = 'rgba(238,246,255,0.35)'; g.lineWidth = 1.5;
  g.beginPath(); g.arc(cx, cy, h * 0.35, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
  g.strokeStyle = WHITE; g.lineWidth = 2;
  g.beginPath(); g.arc(cx, cy, h * 0.7, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
  font(g, 700, 15, 'mono');
  g.fillStyle = WHITE; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let d = -40; d <= 40; d += 10) {
    const deg = Math.round(s.heading / 10) * 10 + d;
    const a = ((deg - s.heading) * Math.PI) / 180;
    if (Math.abs(a) > 0.72) continue;
    const r0 = h * 0.7, r1 = h * 0.7 + (deg % 30 === 0 ? 12 : 7);
    g.beginPath(); g.moveTo(cx + Math.sin(a) * r0, cy - Math.cos(a) * r0); g.lineTo(cx + Math.sin(a) * r1, cy - Math.cos(a) * r1); g.stroke();
    if (deg % 30 === 0) {
      const n = ((deg % 360) + 360) % 360;
      g.fillText(String(n / 10).padStart(2, '0'), cx + Math.sin(a) * (r1 + 12), cy - Math.cos(a) * (r1 + 12));
    }
  }
  font(g, 700, 12, 'mono');
  g.fillStyle = 'rgba(238,246,255,0.7)';
  g.fillText('0.8', cx + h * 0.36, cy - 8);
  // Own aircraft
  g.fillStyle = '#fff';
  g.beginPath(); g.moveTo(cx, cy - 13); g.lineTo(cx + 10, cy + 9); g.lineTo(cx, cy + 4); g.lineTo(cx - 10, cy + 9); g.closePath(); g.fill();
  // Top bar
  g.fillStyle = 'rgba(0,0,0,0.75)';
  g.fillRect(x, y, w, 30);
  font(g, 700, 15, 'mono');
  g.textAlign = 'left';
  g.fillStyle = GREEN; g.fillText('MAP', x + 10, y + 15);
  g.fillStyle = WHITE; g.fillText(`HDG ${String(Math.round(s.heading) % 360).padStart(3, '0')}`, x + 60, y + 15);
  g.textAlign = 'right';
  if (game.objective) {
    const d = s.position.distanceTo(game.objective.pos);
    g.fillStyle = MAGENTA; g.fillText(`${game.objective.label.slice(0, 14)} ${(d / 1852).toFixed(1)}NM`, x + w - 10, y + 15);
  }
  // Bottom bar: ground speed, wind, water, ETA
  g.fillStyle = 'rgba(0,0,0,0.75)';
  g.fillRect(x, y + h - 30, w, 30);
  const gs = Math.hypot(s.velocity.x, s.velocity.z) * 1.944;
  const wind = game.wind;
  const eta = game.objective && gs > 5 ? s.position.distanceTo(game.objective.pos) / (gs / 1.944) : 0;
  font(g, 700, 14, 'mono');
  g.textAlign = 'left';
  g.fillStyle = CYAN; g.fillText(`GS ${Math.round(gs)}`, x + 10, y + h - 15);
  g.fillText(`WIND ${Math.round(Math.hypot(wind.x, wind.z) * 1.944)}KT`, x + 92, y + h - 15);
  g.fillStyle = '#6fb8ff'; g.fillText(`H2O ${Math.round((100 * s.water) / s.waterMax)}%`, x + 222, y + h - 15);
  g.textAlign = 'right';
  g.fillStyle = MAGENTA; g.fillText(`ETA ${Math.floor(eta / 60)}:${String(Math.floor(eta % 60)).padStart(2, '0')}`, x + w - 10, y + h - 15);
  g.restore();
  // Bezel buttons under the screen
  for (let i = 0; i < 5; i++) {
    const bx = x + 18 + i * ((w - 36) / 4);
    g.fillStyle = '#202326';
    g.beginPath(); g.roundRect(bx - 22, y + h + 18, 44, 18, 4); g.fill();
    font(g, 700, 10);
    g.fillStyle = 'rgba(255,244,222,0.6)'; g.textAlign = 'center';
    g.fillText(['MAP', 'ENG', 'FUEL', 'WX', 'RNG'][i], bx, y + h + 28);
  }
}
