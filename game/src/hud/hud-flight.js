// Flight symbology: speed tape (stall barber pole, scoop band, 6 s trend arrow), altitude tape
// (ground shading, trend arrow), heading tape (objective bug, wind arrow), bank scale, pitch ladder
// and flight-path marker.
import * as THREE from 'three';
import { C, font, glow, panel } from './hud-style.js';

const _p = new THREE.Vector3();
const DEG = 180 / Math.PI;

// Vertical tape. opts: { left, label, unit, step, color, trend (units per 6 s), bands: [{from,to,color,hatch}] }
export function tape(g, x, cy, value, u, opts) {
  const h = 210 * u, w = 60 * u;
  const { left, step, color } = opts;
  panel(g, x - w / 2, cy - h / 2, w, h, u, { bracket: color });
  const pxPer = 3.0 * u * (10 / step);
  g.save();
  g.beginPath();
  g.rect(x - w / 2 + 1, cy - h / 2 + 2, w - 2, h - 4);
  g.clip();
  // Coloured bands (stall barber pole, scoop speed range, ground).
  for (const b of opts.bands || []) {
    const y0 = cy - (b.to - value) * pxPer, y1 = cy - (b.from - value) * pxPer;
    const bx = left ? x + w / 2 - 6 * u : x - w / 2;
    if (b.hatch) {
      g.fillStyle = b.color;
      for (let yy = Math.max(y0, cy - h); yy < Math.min(y1, cy + h); yy += 8 * u) g.fillRect(bx, yy, 6 * u, 4 * u);
    } else {
      g.fillStyle = b.color;
      g.fillRect(bx, y0, 6 * u, y1 - y0);
    }
  }
  g.strokeStyle = color; g.fillStyle = color;
  g.lineWidth = 1.4;
  g.textAlign = left ? 'right' : 'left';
  font(g, 400, 11 * u, 'mono');
  const base = Math.floor(value / step) * step;
  for (let k = -9; k <= 9; k++) {
    const v = base + k * step;
    const y = cy - (v - value) * pxPer;
    const major = Math.round(v / step) % 5 === 0;
    const ex = left ? x + w / 2 : x - w / 2;
    g.beginPath();
    g.moveTo(ex, y);
    g.lineTo(ex + (left ? -1 : 1) * (major ? 12 : 6) * u, y);
    g.stroke();
    if (major && v >= 0) g.fillText(String(v), left ? x + w / 2 - 15 * u : x - w / 2 + 15 * u, y);
  }
  g.restore();
  // Trend arrow: where the value will be in 6 seconds.
  if (Math.abs(opts.trend) > step * 0.15) {
    const ty = cy - Math.max(-h / 2 + 6, Math.min(h / 2 - 6, opts.trend * pxPer));
    const tx = left ? x + w / 2 + 5 * u : x - w / 2 - 5 * u;
    g.save();
    g.strokeStyle = C.amber; g.fillStyle = C.amber; g.lineWidth = 2;
    g.shadowColor = C.amber; g.shadowBlur = 4;
    g.beginPath(); g.moveTo(tx, cy); g.lineTo(tx, ty); g.stroke();
    const dir = ty < cy ? -1 : 1;
    g.beginPath(); g.moveTo(tx - 4 * u, ty - dir * 6 * u); g.lineTo(tx, ty); g.lineTo(tx + 4 * u, ty - dir * 6 * u); g.fill();
    g.restore();
  }
  // Rolling value box with a pointer toward the scale.
  const bw = w + 16 * u, bh = 28 * u;
  const bx = x - bw / 2;
  g.save();
  g.fillStyle = 'rgba(0,0,0,0.82)';
  g.strokeStyle = color; g.lineWidth = 1.6;
  g.shadowColor = color; g.shadowBlur = 8;
  g.beginPath();
  if (left) { g.moveTo(bx, cy - bh / 2); g.lineTo(bx + bw, cy - bh / 2); g.lineTo(bx + bw, cy - 5 * u); g.lineTo(bx + bw + 7 * u, cy); g.lineTo(bx + bw, cy + 5 * u); g.lineTo(bx + bw, cy + bh / 2); g.lineTo(bx, cy + bh / 2); }
  else { g.moveTo(bx + bw, cy - bh / 2); g.lineTo(bx, cy - bh / 2); g.lineTo(bx, cy - 5 * u); g.lineTo(bx - 7 * u, cy); g.lineTo(bx, cy + 5 * u); g.lineTo(bx, cy + bh / 2); g.lineTo(bx + bw, cy + bh / 2); }
  g.closePath();
  g.fill(); g.stroke();
  g.restore();
  // Last digit rolls like a drum counter.
  const v = Math.max(0, value);
  const whole = Math.floor(v);
  g.save();
  g.beginPath(); g.rect(bx + 2, cy - bh / 2 + 2, bw - 4, bh - 4); g.clip();
  g.textAlign = 'center';
  font(g, 700, 18 * u, 'mono');
  // Roll only over the last 15% of each unit, so a still frame reads cleanly.
  const frac = Math.max(0, (v - whole - 0.85) / 0.15);
  const head = String(Math.floor(whole / 10) || '');
  const last = whole % 10;
  const cw = g.measureText('0').width;
  const total = String(whole).length;
  const startX = x - (total * cw) / 2 + cw / 2;
  for (let i = 0; i < head.length; i++) glow(g, head[i], startX + i * cw, cy + 1, color, 6);
  const lx = startX + head.length * cw;
  glow(g, String(last), lx, cy + 1 + frac * 18 * u, color, 6);
  glow(g, String((last + 1) % 10), lx, cy + 1 + (frac - 1) * 18 * u, color, 6);
  g.restore();
  g.textAlign = 'center';
  font(g, 700, 10.5 * u);
  g.fillStyle = C.greenDim;
  g.fillText(`${opts.label} ${opts.unit}`, x, cy - h / 2 - 10 * u);
}

// Heading tape across the top, with an amber bug toward the objective and a wind arrow.
export function headingTape(g, cx, y, hdg, u, bug, wind) {
  const w = 360 * u;
  panel(g, cx - w / 2, y - 2 * u, w, 30 * u, u);
  g.save();
  g.beginPath(); g.rect(cx - w / 2 + 4 * u, y - 2 * u, w - 8 * u, 30 * u); g.clip();
  g.strokeStyle = C.green; g.fillStyle = C.greenDim; g.textAlign = 'center'; g.lineWidth = 1.4;
  font(g, 400, 10.5 * u, 'mono');
  const pxPerDeg = 3.6 * u;
  const base = Math.floor(hdg / 5) * 5;
  for (let k = -55; k <= 55; k += 5) {
    const d = base + k;
    const x = cx + (d - hdg) * pxPerDeg;
    const n = ((d % 360) + 360) % 360;
    g.beginPath(); g.moveTo(x, y + 28 * u); g.lineTo(x, y + (n % 10 === 0 ? 19 : 23) * u); g.stroke();
    if (n % 30 === 0) {
      const lbl = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[n] ?? String(n / 10).padStart(2, '0');
      g.fillStyle = lbl.length === 1 ? C.green : C.greenDim;
      g.fillText(lbl, x, y + 11 * u);
    }
  }
  if (bug != null) {
    let d = ((bug - hdg + 540) % 360) - 180;
    const x = cx + Math.max(-w / 2 + 10 * u, Math.min(w / 2 - 10 * u, d * pxPerDeg));
    g.fillStyle = C.amber;
    g.shadowColor = C.amber; g.shadowBlur = 6;
    g.beginPath(); g.moveTo(x, y + 28 * u); g.lineTo(x - 6 * u, y + 19 * u); g.lineTo(x - 6 * u, y + 15 * u); g.lineTo(x + 6 * u, y + 15 * u); g.lineTo(x + 6 * u, y + 19 * u); g.closePath(); g.fill();
  }
  g.restore();
  const bw = 66 * u, bh = 22 * u, by = y + 31 * u;
  g.save();
  g.fillStyle = 'rgba(0,0,0,0.82)';
  g.strokeStyle = C.green;
  g.shadowColor = C.green; g.shadowBlur = 8;
  g.beginPath(); g.roundRect(cx - bw / 2, by, bw, bh, 4 * u); g.fill(); g.stroke();
  g.fillStyle = C.green;
  g.beginPath(); g.moveTo(cx - 5 * u, by); g.lineTo(cx, by - 6 * u); g.lineTo(cx + 5 * u, by); g.fill();
  g.restore();
  g.textAlign = 'center';
  font(g, 700, 14 * u, 'mono');
  glow(g, String(Math.round(hdg) % 360).padStart(3, '0') + '°', cx, by + bh / 2 + 1, C.green, 6);
  // Wind: arrow showing where the wind blows relative to the nose, plus speed.
  if (wind) {
    const wx = cx + w / 2 + 26 * u, wy = y + 14 * u;
    panel(g, wx - 20 * u, wy - 16 * u, 40 * u, 40 * u, u);
    const toDir = Math.atan2(wind.x, -wind.z) * DEG; // direction the wind blows toward
    const rel = ((toDir - hdg) * Math.PI) / 180;
    g.save();
    g.translate(wx, wy);
    g.rotate(rel);
    g.strokeStyle = C.blue; g.fillStyle = C.blue; g.lineWidth = 2;
    g.shadowColor = C.blue; g.shadowBlur = 5;
    g.beginPath(); g.moveTo(0, 9 * u); g.lineTo(0, -6 * u); g.stroke();
    g.beginPath(); g.moveTo(-5 * u, -3 * u); g.lineTo(0, -11 * u); g.lineTo(5 * u, -3 * u); g.fill();
    g.restore();
    g.textAlign = 'center';
    font(g, 700, 8.5 * u, 'mono');
    g.fillStyle = C.blue;
    g.fillText(`${Math.round(Math.hypot(wind.x, wind.z) * 1.944)}KT`, wx, wy + 18 * u);
  }
}

// Bank scale arc with roll pointer and a slip indicator (both views).
export function bankScale(g, s, cx, cy, r, u) {
  g.save();
  g.strokeStyle = C.green; g.lineWidth = 1.5;
  g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2 - 1.05, -Math.PI / 2 + 1.05); g.stroke();
  for (const d of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
    const a = (d * Math.PI) / 180 - Math.PI / 2;
    const len = d % 30 === 0 ? 10 : 6;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    g.lineTo(cx + Math.cos(a) * (r + len * u), cy + Math.sin(a) * (r + len * u));
    g.stroke();
  }
  g.translate(cx, cy);
  g.rotate(-s.roll);
  const over = Math.abs(s.roll) > 0.78;
  g.fillStyle = over ? C.red : C.amber;
  g.shadowColor = g.fillStyle; g.shadowBlur = 6;
  g.beginPath(); g.moveTo(0, -r + 1); g.lineTo(-6 * u, -r + 12 * u); g.lineTo(6 * u, -r + 12 * u); g.fill();
  // Slip/skid brick under the pointer.
  const slip = Math.max(-1, Math.min(1, (s.angular?.y || 0) * -3));
  g.fillRect(-7 * u + slip * 10 * u, -r + 14 * u, 14 * u, 3 * u);
  g.restore();
}

// Pitch ladder (cockpit view): horizon line and 5° rungs, rolling with the aircraft.
export function pitchLadder(g, s, cx, cy, u) {
  g.save();
  g.translate(cx, cy);
  g.rotate(-s.roll);
  g.strokeStyle = 'rgba(166,255,191,0.8)';
  g.fillStyle = 'rgba(166,255,191,0.9)';
  g.lineWidth = 1.5;
  g.shadowColor = C.green; g.shadowBlur = 4;
  font(g, 400, 10.5 * u, 'mono');
  const ppd = 7 * u;
  const p = s.pitch * DEG;
  g.beginPath(); g.rect(-170 * u, -110 * u, 340 * u, 220 * u); g.clip();
  for (let d = -30; d <= 30; d += 5) {
    const y = (p - d) * ppd;
    const w = d === 0 ? 170 * u : d % 10 === 0 ? 56 * u : 34 * u;
    g.setLineDash(d < 0 ? [6, 5] : []);
    g.beginPath();
    g.moveTo(-w, y); g.lineTo(-w * 0.3, y);
    g.moveTo(w * 0.3, y); g.lineTo(w, y);
    if (d !== 0) { g.moveTo(-w, y); g.lineTo(-w, y + (d > 0 ? 6 : -6) * u); g.moveTo(w, y); g.lineTo(w, y + (d > 0 ? 6 : -6) * u); }
    g.stroke();
    if (d !== 0 && d % 10 === 0) { g.textAlign = 'left'; g.fillText(String(Math.abs(d)), w + 5 * u, y); g.textAlign = 'right'; g.fillText(String(Math.abs(d)), -w - 5 * u, y); }
  }
  g.setLineDash([]);
  g.restore();
  // Aircraft reference (gull wing)
  g.save();
  g.strokeStyle = C.amber; g.lineWidth = 2.5; g.shadowColor = C.amber; g.shadowBlur = 6;
  g.beginPath();
  g.moveTo(cx - 44 * u, cy); g.lineTo(cx - 14 * u, cy); g.lineTo(cx, cy + 9 * u); g.lineTo(cx + 14 * u, cy); g.lineTo(cx + 44 * u, cy);
  g.stroke();
  g.restore();
}

// Flight-path marker: where the aircraft is actually going. Returns its screen position.
export function pathMarker(g, game, w, h, u) {
  const s = game.flight;
  if (s.airspeed < 5) return null;
  _p.copy(s.velocity).normalize().multiplyScalar(400).add(s.position).project(game.camera);
  if (_p.z > 1) return null;
  const x = (_p.x * 0.5 + 0.5) * w, y = (-_p.y * 0.5 + 0.5) * h;
  g.save();
  g.strokeStyle = C.green; g.lineWidth = 2; g.shadowColor = C.green; g.shadowBlur = 6;
  g.beginPath(); g.arc(x, y, 7 * u, 0, Math.PI * 2);
  g.moveTo(x - 7 * u, y); g.lineTo(x - 19 * u, y); g.moveTo(x + 7 * u, y); g.lineTo(x + 19 * u, y);
  g.moveTo(x, y - 7 * u); g.lineTo(x, y - 14 * u);
  g.stroke();
  g.restore();
  return { x, y };
}
