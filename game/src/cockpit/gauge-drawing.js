// Canvas primitives for backlit analogue instruments: machined bezels with screws, scales with
// coloured arcs, glowing needles, glass glare, seven-segment style readouts, annunciator lamps.
// Angles are clockwise from 12 o'clock, in radians.
import { FONTS } from '../ui/fonts.js';

export const INK = '#fff4de'; // warm backlight white
export const INK_DIM = 'rgba(255,244,222,0.55)';
export const GLOW = 'rgba(255,214,150,0.9)';

const pt = (x, y, r, a) => [x + Math.sin(a) * r, y - Math.cos(a) * r];

export function font(g, weight, size, family = 'hud') {
  g.font = `${weight} ${size}px ${FONTS[family]}`;
}

// Machined bezel, four screws and a deep black face.
export function bezel(g, x, y, r, { square = false } = {}) {
  g.save();
  const R = r * 1.16;
  const ring = g.createLinearGradient(x - R, y - R, x + R, y + R);
  ring.addColorStop(0, '#4a4f55');
  ring.addColorStop(0.45, '#1c1f22');
  ring.addColorStop(1, '#3a3e43');
  g.fillStyle = ring;
  g.shadowColor = 'rgba(0,0,0,0.8)';
  g.shadowBlur = r * 0.25;
  g.shadowOffsetY = r * 0.06;
  g.beginPath();
  if (square) g.roundRect(x - R, y - R, R * 2, R * 2, r * 0.18); else g.arc(x, y, R, 0, Math.PI * 2);
  g.fill();
  g.shadowColor = 'transparent';
  // Screws in the corners
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const cx = x + sx * R * 0.86, cy = y + sy * R * 0.86;
    const sg = g.createRadialGradient(cx - r * 0.02, cy - r * 0.02, 0, cx, cy, r * 0.07);
    sg.addColorStop(0, '#9aa0a6'); sg.addColorStop(1, '#2a2d30');
    g.fillStyle = sg;
    g.beginPath(); g.arc(cx, cy, r * 0.065, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#151719'; g.lineWidth = r * 0.015;
    g.beginPath(); g.moveTo(cx - r * 0.045, cy - r * 0.02); g.lineTo(cx + r * 0.045, cy + r * 0.02); g.stroke();
  }
  // Inner lip and face
  g.fillStyle = '#0c0d0f';
  g.beginPath(); g.arc(x, y, r * 1.02, 0, Math.PI * 2); g.fill();
  const face = g.createRadialGradient(x, y - r * 0.2, r * 0.1, x, y, r);
  face.addColorStop(0, '#1b1e21');
  face.addColorStop(1, '#08090a');
  g.fillStyle = face;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.restore();
}

// Scale with ticks, numbers and coloured arcs. opts: { a0, a1, min, max, major, minor, label(v), arcs }
export function dialScale(g, x, y, r, o) {
  g.save();
  const toA = (v) => o.a0 + ((v - o.min) / (o.max - o.min)) * (o.a1 - o.a0);
  for (const arc of o.arcs || []) {
    g.strokeStyle = arc.color;
    g.lineWidth = r * 0.07;
    g.beginPath();
    g.arc(x, y, r * 0.9, toA(arc.from) - Math.PI / 2, toA(arc.to) - Math.PI / 2);
    g.stroke();
  }
  g.strokeStyle = INK;
  g.shadowColor = GLOW;
  g.shadowBlur = r * 0.06;
  for (let v = o.min; v <= o.max + 1e-6; v += o.minor) {
    const major = Math.abs(v / o.major - Math.round(v / o.major)) < 1e-6;
    const a = toA(v);
    const [x0, y0] = pt(x, y, r * (major ? 0.78 : 0.85), a);
    const [x1, y1] = pt(x, y, r * 0.95, a);
    g.lineWidth = major ? r * 0.035 : r * 0.018;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    if (major && o.label) {
      const t = o.label(v);
      if (t != null) {
        font(g, 700, r * 0.2);
        g.fillStyle = INK;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        const [tx, ty] = pt(x, y, r * 0.6, a);
        g.fillText(t, tx, ty);
      }
    }
  }
  g.restore();
}

export function caption(g, text, x, y, size, color = INK_DIM, weight = 700) {
  font(g, weight, size);
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, x, y);
}

// A glowing needle with a counterweight tail and a domed hub.
export function needle(g, x, y, r, a, { color = INK, width = 0.06, len = 0.88, tail = 0.2 } = {}) {
  g.save();
  g.translate(x, y);
  g.rotate(a);
  g.shadowColor = 'rgba(0,0,0,0.7)';
  g.shadowBlur = r * 0.08;
  g.shadowOffsetX = r * 0.03; g.shadowOffsetY = r * 0.04;
  g.fillStyle = color;
  const w = r * width;
  g.beginPath();
  g.moveTo(-w * 0.5, r * tail);
  g.lineTo(-w * 0.5, -r * len * 0.82);
  g.lineTo(0, -r * len);
  g.lineTo(w * 0.5, -r * len * 0.82);
  g.lineTo(w * 0.5, r * tail);
  g.closePath();
  g.fill();
  g.restore();
  hub(g, x, y, r * 0.09);
}

export function hub(g, x, y, hr) {
  const hg = g.createRadialGradient(x - hr * 0.3, y - hr * 0.3, 0, x, y, hr);
  hg.addColorStop(0, '#6a6f75'); hg.addColorStop(1, '#111');
  g.fillStyle = hg;
  g.beginPath(); g.arc(x, y, hr, 0, Math.PI * 2); g.fill();
}

// Curved highlight on the cover glass (drawn on the overlay layer).
export function glassGlare(g, x, y, r) {
  g.save();
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.clip();
  const gl = g.createLinearGradient(x - r, y - r, x + r * 0.2, y + r * 0.3);
  gl.addColorStop(0, 'rgba(255,255,255,0.16)');
  gl.addColorStop(0.45, 'rgba(255,255,255,0.03)');
  gl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gl;
  g.beginPath(); g.ellipse(x - r * 0.25, y - r * 0.35, r * 0.95, r * 0.6, -0.5, 0, Math.PI * 2); g.fill();
  // Inner shadow at the rim
  const rim = g.createRadialGradient(x, y, r * 0.8, x, y, r);
  rim.addColorStop(0, 'rgba(0,0,0,0)'); rim.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = rim;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.restore();
}

// Digital readout: dim "8888" ghost segments behind lit digits, with glow.
export function digits(g, text, x, y, size, color, align = 'center') {
  g.save();
  font(g, 700, size, 'mono');
  g.textAlign = align; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,255,255,0.05)';
  g.fillText(text.replace(/[0-9]/g, '8'), x, y);
  g.shadowColor = color; g.shadowBlur = size * 0.5;
  g.fillStyle = color;
  g.fillText(text, x, y);
  g.restore();
}

// Annunciator lamp: dark with an engraved legend when off, glowing colour when lit.
export function lamp(g, x, y, w, h, text, color, on) {
  g.save();
  g.fillStyle = '#0b0c0d';
  g.fillRect(x - 2, y - 2, w + 4, h + 4);
  if (on) {
    const lg = g.createLinearGradient(x, y, x, y + h);
    lg.addColorStop(0, color); lg.addColorStop(1, shade(color));
    g.fillStyle = lg;
    g.shadowColor = color; g.shadowBlur = h * 0.6;
  } else g.fillStyle = '#1d1f21';
  g.fillRect(x, y, w, h);
  g.shadowBlur = 0;
  font(g, 700, Math.min(h * 0.42, (w / Math.max(5, text.length)) * 1.5));
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = on ? 'rgba(20,8,0,0.92)' : 'rgba(255,255,255,0.16)';
  g.fillText(text, x + w / 2, y + h / 2 + 1);
  g.restore();
}

function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.round(v * 0.65).toString(16).padStart(2, '0');
  return `#${f(n >> 16)}${f((n >> 8) & 255)}${f(n & 255)}`;
}

// Toggle switch with a label plate; `on` points the bat up.
export function toggle(g, x, y, label, on, s = 1) {
  g.save();
  g.fillStyle = '#121416';
  g.beginPath(); g.arc(x, y, 11 * s, 0, Math.PI * 2); g.fill();
  const bg = g.createLinearGradient(x - 5 * s, 0, x + 5 * s, 0);
  bg.addColorStop(0, '#d9dde0'); bg.addColorStop(1, '#6e7378');
  g.fillStyle = bg;
  g.beginPath(); g.roundRect(x - 4 * s, on ? y - 24 * s : y, 8 * s, 24 * s, 4 * s); g.fill();
  caption(g, label, x, y + 38 * s, 12 * s, INK_DIM);
  g.restore();
}
