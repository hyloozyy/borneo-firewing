// Chase-view instrument cluster: a glass strip along the bottom edge with six live gauges
// (airspeed, attitude, altimeter, heading card, vertical speed, twin-needle engine RPM) and a row
// of annunciator lights (STALL, LOW FUEL, ITT, SMOKE, GEAR, FLAPS, DOORS, WATER). Toggle with I.
// Needles move smoothly and shiver with engine vibration and turbulence.
import { C, font, glow } from './hud-style.js';
import { ITT_REDLINE } from '../flight/damage-model.js';

const KT = 1.944, FT = 3.281;
const TAU = Math.PI * 2;

// Lights in the cluster row: [label, test(s, game) -> level or null]
const LAMPS = [
  ['STALL', (s) => (s.stall ? 'warn' : null)],
  ['LOW FUEL', (s) => (s.fuel / s.fuelMax < 0.15 ? 'caut' : null)],
  ['ITT', (s) => (s.damage.engines.some((e) => e.fire) ? 'warn' : s.damage.engines.some((e) => e.itt > ITT_REDLINE && !e.failed) ? 'caut' : null)],
  ['SMOKE', (s) => (s.turbulence > 0.25 ? 'caut' : null)],
  ['GEAR', (s, g) => { const x = g.plane.userData.parts.gearExt; return x > 0.95 ? 'ok' : x > 0.05 ? 'caut' : null; }],
  ['FLAPS', (s) => (s.flaps > 0.05 ? 'ok' : null)],
  ['DOORS', (s) => (s.doors > 0.1 ? 'info' : null)],
  ['WATER', (s) => (s.scooping ? 'info' : s.water > 0 ? 'ok' : null)],
];
const LAMP_COL = { warn: C.red, caut: C.amber, ok: C.green, info: C.blue };

export class InstrumentCluster {
  constructor() {
    this.v = null; // smoothed needle values
  }

  // Draws the strip centred at cx with its bottom at `bottom`; returns its top edge.
  draw(g, game, cx, bottom, u, dt, time) {
    const s = game.flight;
    const target = {
      kt: s.airspeed * KT,
      ft: s.position.y * FT,
      vs: s.vs * 196.85,
      hdg: s.heading,
      pitch: s.pitch,
      roll: s.roll,
      e1: s.engRpm[0],
      e2: s.engRpm[1],
    };
    if (!this.v) this.v = { ...target };
    const k = Math.min(1, dt ? dt * 8 : 1);
    for (const key in target) {
      if (key === 'hdg') this.v.hdg += ((((target.hdg - this.v.hdg) % 360) + 540) % 360 - 180) * k;
      else this.v[key] += (target[key] - this.v[key]) * k;
    }
    // Vibration: a fine shiver from the props plus the turbulence in smoke.
    const shake = (s.rpm * 0.006 + s.turbulence * 0.03) * Math.sin(time * 61);

    const r = 30 * u, gap = 12 * u, n = 6;
    const w = n * 2 * r + (n - 1) * gap + 28 * u;
    const lampH = 15 * u;
    const h = 2 * r + lampH + 34 * u;
    const x = cx - w / 2, y = bottom - h;
    // Glass housing
    g.save();
    const grad = g.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, 'rgba(10,22,18,0.72)');
    grad.addColorStop(1, 'rgba(2,8,6,0.62)');
    g.fillStyle = grad;
    g.strokeStyle = C.edge;
    g.lineWidth = 1;
    g.beginPath(); g.roundRect(x, y, w, h, 8 * u); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.08)';
    g.beginPath(); g.moveTo(x + 10 * u, y + 1); g.lineTo(x + w - 10 * u, y + 1); g.stroke();
    g.restore();

    // Annunciator row
    const lw = (w - 20 * u - (LAMPS.length - 1) * 4 * u) / LAMPS.length;
    LAMPS.forEach(([label, test], i) => {
      const lv = test(s, game);
      const lx = x + 10 * u + i * (lw + 4 * u), ly = y + 7 * u;
      const blink = lv === 'warn' && Math.floor(time * 4) % 2;
      const col = lv ? LAMP_COL[lv] : null;
      g.save();
      g.fillStyle = col && !blink ? hexA(col, 0.22) : 'rgba(255,255,255,0.04)';
      g.strokeStyle = col && !blink ? col : 'rgba(255,255,255,0.12)';
      g.lineWidth = 1;
      if (col && !blink) { g.shadowColor = col; g.shadowBlur = 8; }
      g.beginPath(); g.roundRect(lx, ly, lw, lampH, 3 * u); g.fill(); g.stroke();
      g.restore();
      font(g, 700, 7.6 * u);
      g.textAlign = 'center';
      g.fillStyle = col && !blink ? col : 'rgba(200,230,210,0.32)';
      g.fillText(label, lx + lw / 2, ly + lampH / 2 + 0.5);
    });

    const gy = y + lampH + 14 * u + r;
    const gx = (i) => x + 14 * u + r + i * (2 * r + gap);
    const v = this.v;
    // 1 Airspeed 0..200 kt over 300°
    dial(g, gx(0), gy, r, u, 'AIRSPEED', 'KT', `${Math.round(v.kt)}`, {
      arcs: [[0, 62, C.red], [62, 120, 'rgba(92,200,255,0.9)'], [120, 175, C.green], [175, 200, C.amber]], max: 200, ticks: 10,
      needle: v.kt / 200 + shake,
    });
    // 2 Attitude
    attitude(g, gx(1), gy, r, u, v.pitch + shake * 0.5, v.roll);
    // 3 Altimeter: long needle per 1000 ft, short per 10 000 ft
    dial(g, gx(2), gy, r, u, 'ALTITUDE', 'FT', `${Math.round(v.ft)}`, {
      max: 1000, ticks: 10, needle: (v.ft % 1000) / 1000 + shake * 0.3, needle2: v.ft / 10000, full: true,
    });
    // 4 Heading card
    compass(g, gx(3), gy, r, u, v.hdg, game);
    // 5 Vertical speed -2000..+2000 fpm, zero at 9 o'clock
    vsi(g, gx(4), gy, r, u, v.vs + shake * 300);
    // 6 Engines: two needles, ITT colour on the hub
    engines(g, gx(5), gy, r, u, v.e1 + shake, v.e2 - shake, s);
    return y;
  }
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function face(g, x, y, r, u) {
  g.save();
  const grad = g.createRadialGradient(x, y - r * 0.3, r * 0.1, x, y, r);
  grad.addColorStop(0, 'rgba(18,34,28,0.92)');
  grad.addColorStop(1, 'rgba(4,10,8,0.95)');
  g.fillStyle = grad;
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(166,255,191,0.45)';
  g.lineWidth = 1.4 * u;
  g.shadowColor = C.green; g.shadowBlur = 5;
  g.stroke();
  g.restore();
}

function glare(g, x, y, r) {
  g.save();
  const grad = g.createLinearGradient(x - r, y - r, x + r * 0.3, y + r * 0.2);
  grad.addColorStop(0, 'rgba(255,255,255,0.13)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.02)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.beginPath(); g.arc(x, y, r - 1, 0, TAU); g.fill();
  g.restore();
}

function label(g, x, y, r, u, text) {
  font(g, 700, 7.4 * u);
  g.textAlign = 'center';
  g.fillStyle = C.greenDim;
  g.fillText(text, x, y + r + 8 * u);
}

function needleAt(g, x, y, len, a, color, width, u, tail = 0.18) {
  g.save();
  g.strokeStyle = color;
  g.lineWidth = width * u;
  g.lineCap = 'round';
  g.shadowColor = color; g.shadowBlur = 6;
  g.beginPath();
  g.moveTo(x - Math.cos(a) * len * tail, y - Math.sin(a) * len * tail);
  g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
  g.stroke();
  g.restore();
}

function hub(g, x, y, u, color = '#dfe') {
  g.fillStyle = color;
  g.beginPath(); g.arc(x, y, 2.6 * u, 0, TAU); g.fill();
}

// Generic round dial: 300° sweep from 7:30 (or a full circle), optional coloured arcs and readout.
function dial(g, x, y, r, u, name, unit, readout, o) {
  face(g, x, y, r, u);
  const sweep = o.full ? TAU : (TAU * 300) / 360;
  const a0 = o.full ? -Math.PI / 2 : Math.PI / 2 + (TAU - sweep) / 2;
  const ang = (f) => a0 + sweep * f;
  g.save();
  g.lineWidth = 3 * u;
  for (const [from, to, col] of o.arcs || []) {
    g.strokeStyle = col;
    g.beginPath(); g.arc(x, y, r - 4 * u, ang(from / o.max), ang(to / o.max)); g.stroke();
  }
  g.strokeStyle = 'rgba(230,255,240,0.7)';
  for (let i = 0; i <= o.ticks * 2; i++) {
    if (o.full && i === o.ticks * 2) break;
    const a = ang(i / (o.ticks * 2));
    const major = i % 2 === 0;
    g.lineWidth = (major ? 1.4 : 0.8) * u;
    const r0 = r - (major ? 9 : 6) * u;
    g.beginPath(); g.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); g.lineTo(x + Math.cos(a) * (r - 2 * u), y + Math.sin(a) * (r - 2 * u)); g.stroke();
  }
  g.restore();
  font(g, 700, 8.8 * u, 'mono');
  g.textAlign = 'center';
  glow(g, readout, x, y + r * 0.42, C.white, 3);
  font(g, 700, 6 * u);
  g.fillStyle = C.greenDim;
  g.fillText(unit, x, y - r * 0.38);
  if (o.needle2 != null) needleAt(g, x, y, r * 0.5, ang(o.needle2 % 1), C.amber, 2.4, u, 0.1);
  needleAt(g, x, y, r * 0.84, ang(Math.max(-0.02, Math.min(1.02, o.full ? o.needle % 1 : o.needle))), C.green, 1.8, u);
  hub(g, x, y, u);
  glare(g, x, y, r);
  label(g, x, y, r, u, name);
}

function attitude(g, x, y, r, u, pitch, roll) {
  face(g, x, y, r, u);
  g.save();
  g.beginPath(); g.arc(x, y, r - 2 * u, 0, TAU); g.clip();
  g.translate(x, y);
  g.rotate(-roll);
  const off = Math.max(-r, Math.min(r, pitch * r * 1.6));
  g.fillStyle = 'rgba(40,110,190,0.85)';
  g.fillRect(-r * 2, -r * 2 + off, r * 4, r * 2);
  g.fillStyle = 'rgba(120,74,36,0.85)';
  g.fillRect(-r * 2, off, r * 4, r * 2);
  g.strokeStyle = '#fff'; g.lineWidth = 1.2 * u;
  g.beginPath(); g.moveTo(-r * 2, off); g.lineTo(r * 2, off); g.stroke();
  g.lineWidth = 0.8 * u;
  for (const p of [-20, -10, 10, 20]) {
    const py = off - (p / 57.3) * r * 1.6, hw = (Math.abs(p) === 10 ? 7 : 11) * u;
    g.beginPath(); g.moveTo(-hw, py); g.lineTo(hw, py); g.stroke();
  }
  g.restore();
  // Fixed aircraft symbol and bank pointer
  g.save();
  g.strokeStyle = C.amber; g.lineWidth = 2.2 * u; g.shadowColor = C.amber; g.shadowBlur = 5;
  g.beginPath(); g.moveTo(x - r * 0.6, y); g.lineTo(x - r * 0.2, y); g.lineTo(x - r * 0.1, y + 4 * u);
  g.moveTo(x + r * 0.6, y); g.lineTo(x + r * 0.2, y); g.lineTo(x + r * 0.1, y + 4 * u); g.stroke();
  g.fillStyle = C.amber;
  g.beginPath(); g.arc(x, y, 1.8 * u, 0, TAU); g.fill();
  g.translate(x, y); g.rotate(-roll);
  g.beginPath(); g.moveTo(0, -r + 3 * u); g.lineTo(-3.5 * u, -r + 9 * u); g.lineTo(3.5 * u, -r + 9 * u); g.closePath(); g.fill();
  g.restore();
  glare(g, x, y, r);
  label(g, x, y, r, u, 'ATTITUDE');
}

function compass(g, x, y, r, u, hdg, game) {
  face(g, x, y, r, u);
  g.save();
  g.translate(x, y);
  g.rotate((-hdg * Math.PI) / 180);
  g.strokeStyle = 'rgba(230,255,240,0.7)';
  for (let d = 0; d < 360; d += 10) {
    const a = (d * Math.PI) / 180 - Math.PI / 2, major = d % 30 === 0;
    g.lineWidth = (major ? 1.3 : 0.7) * u;
    const r0 = r - (major ? 8 : 5) * u;
    g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * (r - 2 * u), Math.sin(a) * (r - 2 * u)); g.stroke();
  }
  font(g, 700, 8 * u);
  g.textAlign = 'center';
  ['N', 'E', 'S', 'W'].forEach((t, i) => {
    g.save();
    g.rotate((i * Math.PI) / 2);
    g.fillStyle = i === 0 ? C.fire : C.white;
    g.fillText(t, 0, -r + 14 * u);
    g.restore();
  });
  // Objective bug
  if (game.objective) {
    const s = game.flight, o = game.objective.pos;
    const b = Math.atan2(o.x - s.position.x, -(o.z - s.position.z));
    g.rotate(b);
    g.fillStyle = C.amber;
    g.beginPath(); g.moveTo(0, -r + 1 * u); g.lineTo(-4 * u, -r - 4 * u); g.lineTo(4 * u, -r - 4 * u); g.closePath(); g.fill();
  }
  g.restore();
  // Lubber line and plane symbol
  g.save();
  g.strokeStyle = C.green; g.lineWidth = 1.6 * u; g.shadowColor = C.green; g.shadowBlur = 5;
  g.beginPath(); g.moveTo(x, y - r + 1 * u); g.lineTo(x, y - r + 9 * u); g.stroke();
  g.beginPath(); g.moveTo(x, y - 8 * u); g.lineTo(x, y + 8 * u); g.moveTo(x - 7 * u, y - 1 * u); g.lineTo(x + 7 * u, y - 1 * u); g.moveTo(x - 3 * u, y + 7 * u); g.lineTo(x + 3 * u, y + 7 * u); g.stroke();
  g.restore();
  font(g, 700, 8.4 * u, 'mono');
  g.textAlign = 'center';
  glow(g, `${String(Math.round(((hdg % 360) + 360) % 360)).padStart(3, '0')}°`, x, y + r * 0.5, C.white, 3);
  glare(g, x, y, r);
  label(g, x, y, r, u, 'HEADING');
}

function vsi(g, x, y, r, u, fpm) {
  face(g, x, y, r, u);
  // ±2000 fpm over ±160° from 9 o'clock.
  const ang = (v) => Math.PI + (Math.max(-2000, Math.min(2000, v)) / 2000) * ((160 * Math.PI) / 180);
  g.save();
  g.strokeStyle = 'rgba(230,255,240,0.7)';
  for (let v = -2000; v <= 2000; v += 250) {
    const a = ang(v), major = v % 1000 === 0;
    g.lineWidth = (major ? 1.4 : 0.8) * u;
    const r0 = r - (major ? 9 : 5) * u;
    g.beginPath(); g.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); g.lineTo(x + Math.cos(a) * (r - 2 * u), y + Math.sin(a) * (r - 2 * u)); g.stroke();
  }
  g.lineWidth = 3 * u;
  g.strokeStyle = 'rgba(255,77,61,0.8)';
  g.beginPath(); g.arc(x, y, r - 4 * u, ang(-2000), ang(-1000)); g.stroke();
  g.restore();
  font(g, 700, 6.5 * u);
  g.textAlign = 'center';
  g.fillStyle = C.greenDim;
  g.fillText('UP', x - r * 0.35, y - r * 0.42);
  g.fillText('DN', x - r * 0.35, y + r * 0.46);
  font(g, 700, 8.4 * u, 'mono');
  glow(g, `${fpm >= 0 ? '+' : ''}${Math.round(fpm / 10) * 10}`, x + r * 0.22, y + r * 0.42, fpm < -1000 ? C.amber : C.white, 3);
  needleAt(g, x, y, r * 0.84, ang(-fpm), C.green, 1.8, u);
  hub(g, x, y, u);
  glare(g, x, y, r);
  label(g, x, y, r, u, 'VERT SPEED');
}

function engines(g, x, y, r, u, e1, e2, s) {
  face(g, x, y, r, u);
  const sweep = (TAU * 270) / 360, a0 = Math.PI * 0.75;
  const ang = (f) => a0 + sweep * Math.max(0, Math.min(1.1, f) / 1.1);
  g.save();
  g.lineWidth = 3 * u;
  g.strokeStyle = 'rgba(166,255,191,0.7)';
  g.beginPath(); g.arc(x, y, r - 4 * u, ang(0.55), ang(1.0)); g.stroke();
  g.strokeStyle = 'rgba(255,77,61,0.85)';
  g.beginPath(); g.arc(x, y, r - 4 * u, ang(1.02), ang(1.1)); g.stroke();
  g.strokeStyle = 'rgba(230,255,240,0.7)';
  for (let i = 0; i <= 11; i++) {
    const a = ang(i / 10);
    g.lineWidth = (i % 2 ? 0.8 : 1.4) * u;
    const r0 = r - (i % 2 ? 5 : 9) * u;
    g.beginPath(); g.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); g.lineTo(x + Math.cos(a) * (r - 2 * u), y + Math.sin(a) * (r - 2 * u)); g.stroke();
  }
  g.restore();
  const [d1, d2] = s.damage.engines;
  const col = (e) => (e.fire ? C.red : e.failed ? '#888' : e.itt > ITT_REDLINE ? C.amber : C.green);
  needleAt(g, x, y, r * 0.82, ang(e1), col(d1), 1.8, u);
  needleAt(g, x, y, r * 0.66, ang(e2), d2.fire ? C.red : d2.failed ? '#888' : C.gold, 1.8, u);
  font(g, 700, 6.4 * u, 'mono');
  g.textAlign = 'center';
  g.fillStyle = col(d1);
  g.fillText(`1 ${d1.failed ? 'OFF' : Math.round(e1 * 100)}`, x - r * 0.3, y + r * 0.5);
  g.fillStyle = d2.fire ? C.red : d2.failed ? '#888' : C.gold;
  g.fillText(`2 ${d2.failed ? 'OFF' : Math.round(e2 * 100)}`, x + r * 0.32, y + r * 0.5);
  hub(g, x, y, u);
  glare(g, x, y, r);
  label(g, x, y, r, u, 'ENG RPM %');
}
