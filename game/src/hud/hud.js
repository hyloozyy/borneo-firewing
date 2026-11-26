// Head-up display drawn on a 2D canvas in one consistent style: aviation font (B612) for
// instruments, condensed display font for stage banners, rounded translucent panels on a fixed
// margin grid. Speed and altitude tapes, heading tape, pitch ladder (cockpit), flight-path marker,
// status strip, stage checklist, systems panel, objective marker, radio text, banners, pop-ups.
import * as THREE from 'three';
import { FONTS } from '../ui/fonts.js';

const GREEN = '#9dffb0';
const GREEN_DIM = 'rgba(157,255,176,0.62)';
const AMBER = '#ffc861';
const RED = '#ff5a4a';
const WHITE = '#f4fbf6';
const PANEL = 'rgba(4,12,9,0.55)';
const EDGE = 'rgba(157,255,176,0.26)';
const _p = new THREE.Vector3();

export class Hud {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.radioLines = [];
    this.bannerText = null;
    this.bannerTime = 0;
    this.toasts = [];
    this.time = 0;
  }

  resize(w, h, dpr) {
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.dpr = dpr; this.w = w; this.h = h;
  }

  banner(title, sub) { this.bannerText = { title, sub }; this.bannerTime = 6; }
  radio(text, delay = 0) { this.radioLines.push({ text, t: -delay, life: 9 }); }
  toast(text, color = AMBER) { this.toasts.push({ text, t: 0, color }); }

  font(weight, size, family) { this.g.font = `${weight} ${size}px ${family}`; }

  panel(x, y, w, h, accent) {
    const g = this.g;
    g.save();
    g.shadowBlur = 0;
    g.fillStyle = PANEL;
    g.strokeStyle = EDGE;
    g.lineWidth = 1;
    g.beginPath();
    g.roundRect(x, y, w, h, 6 * this.u);
    g.fill();
    g.stroke();
    if (accent) {
      g.fillStyle = accent;
      g.beginPath();
      g.roundRect(x, y, 3 * this.u, h, [6 * this.u, 0, 0, 6 * this.u]);
      g.fill();
    }
    g.restore();
  }

  draw(game, dt) {
    const { g } = this;
    this.time += dt;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    if (!game.showHud) return;
    const s = game.flight;
    const W = this.w, H = this.h;
    const u = (this.u = Math.max(0.6, Math.min(1.2, Math.min(W / 1280, H / 600))));
    const compact = W < 900 || H < 430;
    const M = 14 * u;
    this.M = M;
    g.lineWidth = 1.5;
    g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,0.6)';
    g.shadowBlur = 3;

    const kt = s.airspeed * 1.944;
    const ft = s.position.y * 3.281;
    if (game.cameraMode === 'cockpit') this.pitchLadder(s, W / 2, H * 0.5, u);
    else this.pathMarker(game, u);
    const tx = Math.min(W * (compact ? 0.3 : 0.27), 430 * u);
    const cy = H * 0.5;
    this.tape(W / 2 - tx, cy, kt, 'SPD', 'KT', 10, u, s.stall ? RED : GREEN, true);
    this.tape(W / 2 + tx, cy, ft, 'ALT', 'FT', 100, u, s.agl < 30 && !s.onGround ? AMBER : GREEN, false);
    const below = cy + 100 * u + 18 * u;
    this.readouts(W / 2 - tx, below, [['THR', `${Math.round(s.throttle * 100)}%`], ['FLAPS', ['UP', '1', 'FULL'][Math.round(s.flapTarget * 2)]]], u);
    const vs = Math.round(s.vs * 196.85);
    this.readouts(W / 2 + tx, below, [['VS', `${vs >= 0 ? '+' : ''}${vs}`], ['RA', `${Math.max(0, Math.round(s.agl * 3.281))}`]], u);
    this.headingTape(W / 2, M + 14 * u, s.heading, u);

    const cy2 = cy + 74 * u;
    if (s.stall) this.flash('STALL', W / 2, cy2, RED, u);
    else if (s.scooping) this.flash('SCOOPING', W / 2, cy2, '#7fd8ff', u);
    else if (game.dropWindow > 0 && s.water > 0) this.flash('DROP NOW · SPACE', W / 2, cy2, AMBER, u);
    if (s.turbulence > 0.2) this.flash('SMOKE · TURBULENCE', W / 2, cy2 + 26 * u, AMBER, u, true);

    const status = this.statusStrip(game, M, M, u);
    if (compact) this.systems(game, M, status.bottom + 8 * u, u, true);
    else this.systems(game, M, H - M, u, false);
    this.objective(game, u);
    this.missionPanel(game, u);
    this.radioBox(dt, u, compact);
    this.toastsDraw(dt, u);
    this.bannerDraw(dt, u);
    g.shadowBlur = 0;
  }

  // Flight-path marker: where the aircraft is actually going (chase view).
  pathMarker(game, u) {
    const s = game.flight;
    if (s.airspeed < 5) return;
    _p.copy(s.velocity).normalize().multiplyScalar(400).add(s.position).project(game.camera);
    if (_p.z > 1) return;
    const g = this.g;
    const x = (_p.x * 0.5 + 0.5) * this.w, y = (-_p.y * 0.5 + 0.5) * this.h;
    g.strokeStyle = GREEN; g.lineWidth = 2;
    g.beginPath(); g.arc(x, y, 7 * u, 0, Math.PI * 2);
    g.moveTo(x - 7 * u, y); g.lineTo(x - 18 * u, y); g.moveTo(x + 7 * u, y); g.lineTo(x + 18 * u, y);
    g.moveTo(x, y - 7 * u); g.lineTo(x, y - 14 * u);
    g.stroke();
    g.lineWidth = 1.5;
  }

  flash(text, x, y, color, u, steady = false) {
    const g = this.g;
    if (!steady && Math.floor(this.time * 3) % 2) return;
    this.font(700, 15 * u, FONTS.hud);
    const w = g.measureText(text).width + 24 * u;
    this.panel(x - w / 2, y - 12 * u, w, 24 * u);
    g.textAlign = 'center';
    g.fillStyle = color;
    g.fillText(text, x, y + 1);
  }

  tape(x, cy, value, label, unit, step, u, color, left) {
    const g = this.g;
    const h = 200 * u, w = 58 * u;
    this.panel(x - w / 2, cy - h / 2, w, h);
    g.save();
    g.beginPath();
    g.rect(x - w / 2, cy - h / 2 + 2, w, h - 4);
    g.clip();
    g.strokeStyle = color; g.fillStyle = color;
    g.textAlign = left ? 'right' : 'left';
    this.font(400, 11 * u, FONTS.mono);
    const pxPer = 3.0 * u * (10 / step);
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
    // Current value box with a pointer toward the scale.
    const bw = w + 14 * u, bh = 26 * u;
    const bx = x - bw / 2;
    g.save();
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(0,0,0,0.78)';
    g.strokeStyle = color;
    g.lineWidth = 1.5;
    g.beginPath();
    g.roundRect(bx, cy - bh / 2, bw, bh, 4 * u);
    g.fill(); g.stroke();
    g.restore();
    g.fillStyle = color;
    g.textAlign = 'center';
    this.font(700, 17 * u, FONTS.mono);
    g.fillText(String(Math.max(0, Math.round(value))), x, cy + 1);
    this.font(700, 11 * u, FONTS.hud);
    g.fillStyle = GREEN_DIM;
    g.fillText(`${label} ${unit}`, x, cy - h / 2 - 10 * u);
  }

  // Two label/value rows under a tape, in a small panel aligned with it.
  readouts(x, y, rows, u) {
    const g = this.g;
    const w = 104 * u, rh = 18 * u;
    this.panel(x - w / 2, y, w, rows.length * rh + 6 * u);
    rows.forEach(([label, value], i) => {
      const ry = y + 3 * u + rh * (i + 0.5);
      g.textAlign = 'left';
      g.fillStyle = GREEN_DIM;
      this.font(700, 10.5 * u, FONTS.hud);
      g.fillText(label, x - w / 2 + 9 * u, ry);
      g.textAlign = 'right';
      g.fillStyle = GREEN;
      this.font(700, 12.5 * u, FONTS.mono);
      g.fillText(value, x + w / 2 - 9 * u, ry);
    });
  }

  headingTape(cx, y, hdg, u) {
    const g = this.g;
    const w = 320 * u;
    this.panel(cx - w / 2, y - 2 * u, w, 30 * u);
    g.save();
    g.beginPath(); g.rect(cx - w / 2 + 4 * u, y - 2 * u, w - 8 * u, 30 * u); g.clip();
    g.strokeStyle = GREEN; g.fillStyle = GREEN_DIM; g.textAlign = 'center';
    this.font(400, 10.5 * u, FONTS.mono);
    const pxPerDeg = 3.6 * u;
    const base = Math.floor(hdg / 5) * 5;
    for (let k = -50; k <= 50; k += 5) {
      const d = base + k;
      const x = cx + (d - hdg) * pxPerDeg;
      const n = ((d % 360) + 360) % 360;
      g.beginPath(); g.moveTo(x, y + 28 * u); g.lineTo(x, y + (n % 10 === 0 ? 19 : 23) * u); g.stroke();
      if (n % 30 === 0) {
        const lbl = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[n] ?? String(n / 10).padStart(2, '0');
        g.fillText(lbl, x, y + 11 * u);
      }
    }
    g.restore();
    // Value box hanging below the tape centre.
    const bw = 62 * u, bh = 20 * u, by = y + 30 * u;
    g.save();
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(0,0,0,0.78)';
    g.strokeStyle = GREEN;
    g.beginPath(); g.roundRect(cx - bw / 2, by, bw, bh, 4 * u); g.fill(); g.stroke();
    g.fillStyle = GREEN;
    g.beginPath(); g.moveTo(cx - 5 * u, by); g.lineTo(cx, by - 6 * u); g.lineTo(cx + 5 * u, by); g.fill();
    g.restore();
    g.fillStyle = GREEN;
    g.textAlign = 'center';
    this.font(700, 13 * u, FONTS.mono);
    g.fillText(String(Math.round(hdg) % 360).padStart(3, '0') + '°', cx, by + bh / 2 + 1);
  }

  pitchLadder(s, cx, cy, u) {
    const g = this.g;
    g.save();
    g.translate(cx, cy);
    g.rotate(-s.roll);
    g.strokeStyle = 'rgba(157,255,176,0.75)';
    g.fillStyle = 'rgba(157,255,176,0.85)';
    this.font(400, 10.5 * u, FONTS.mono);
    const ppd = 7 * u;
    const p = (s.pitch * 180) / Math.PI;
    g.beginPath(); g.rect(-160 * u, -120 * u, 320 * u, 240 * u); g.clip();
    for (let d = -30; d <= 30; d += 5) {
      const y = (p - d) * ppd;
      const w = d === 0 ? 150 * u : 50 * u;
      g.setLineDash(d < 0 ? [6, 5] : []);
      g.beginPath();
      g.moveTo(-w, y); g.lineTo(-w * 0.3, y);
      g.moveTo(w * 0.3, y); g.lineTo(w, y);
      g.stroke();
      if (d !== 0) { g.textAlign = 'left'; g.fillText(String(d), w + 4 * u, y); }
    }
    g.setLineDash([]);
    g.restore();
    g.strokeStyle = AMBER; g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(cx - 40 * u, cy); g.lineTo(cx - 12 * u, cy); g.lineTo(cx, cy + 8 * u); g.lineTo(cx + 12 * u, cy); g.lineTo(cx + 40 * u, cy);
    g.stroke();
    g.lineWidth = 1.5;
    g.strokeStyle = GREEN;
    g.beginPath(); g.arc(cx, cy, 112 * u, -Math.PI / 2 - 0.8, -Math.PI / 2 + 0.8); g.stroke();
    g.save(); g.translate(cx, cy); g.rotate(-s.roll);
    g.fillStyle = AMBER;
    g.beginPath(); g.moveTo(0, -110 * u); g.lineTo(-6 * u, -98 * u); g.lineTo(6 * u, -98 * u); g.fill();
    g.restore();
  }

  // Top-left strip: fires burning, mission time left, score.
  statusStrip(game, x, y, u) {
    const g = this.g, m = game.mission;
    const fires = game.fire.activeCells().length;
    const tl = Math.max(0, 25 * 60 - m.elapsed);
    const cells = [
      ['FIRES', String(fires), fires > 0 ? '#ff9a4a' : GREEN],
      ['TIME', `${Math.floor(tl / 60)}:${String(Math.floor(tl % 60)).padStart(2, '0')}`, tl < 120 ? RED : WHITE],
      ['SCORE', String(m.total() + Math.round(m.stagePoints || 0)), WHITE],
    ];
    const cw = 78 * u, h = 40 * u;
    this.panel(x, y, cw * cells.length, h);
    cells.forEach(([label, value, color], i) => {
      const cx = x + cw * i + 10 * u;
      if (i) { g.fillStyle = EDGE; g.fillRect(x + cw * i, y + 8 * u, 1, h - 16 * u); }
      g.textAlign = 'left';
      g.fillStyle = GREEN_DIM;
      this.font(700, 9.5 * u, FONTS.hud);
      g.fillText(label, cx, y + 12 * u);
      g.fillStyle = color;
      this.font(700, 15 * u, FONTS.hud);
      g.fillText(value, cx, y + 27 * u);
    });
    return { bottom: y + h, right: x + cw * cells.length };
  }

  bar(x, y, w, frac, color, label, value, u) {
    const g = this.g;
    g.textAlign = 'left';
    g.fillStyle = GREEN_DIM;
    this.font(700, 9.5 * u, FONTS.hud);
    g.fillText(label, x, y);
    g.textAlign = 'right';
    g.fillStyle = WHITE;
    this.font(700, 11.5 * u, FONTS.mono);
    g.fillText(value, x + w, y);
    const by = y + 8 * u, bh = 6 * u;
    g.save();
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.beginPath(); g.roundRect(x, by, w, bh, bh / 2); g.fill();
    g.fillStyle = color;
    g.beginPath(); g.roundRect(x, by, Math.max(bh, w * Math.max(0, Math.min(1, frac))), bh, bh / 2); g.fill();
    g.restore();
  }

  // Engines, fuel and water in one panel (bottom-left; under the status strip on small screens).
  systems(game, x, anchor, u, top) {
    const s = game.flight;
    const w = 214 * u, rh = 28 * u, pad = 10 * u;
    const h = rh * 3 + pad * 1.2;
    const y = top ? anchor : anchor - h;
    this.panel(x, y, w, h);
    const fuelFrac = s.fuel / s.fuelMax;
    const iw = w - pad * 2;
    this.bar(x + pad, y + pad + 4 * u, iw, s.rpm, GREEN, 'ENGINES', `${Math.round(s.rpm * 100)}%`, u);
    this.bar(x + pad, y + pad + 4 * u + rh, iw, fuelFrac, fuelFrac < 0.2 ? RED : '#ffb347', 'FUEL', `${Math.round(fuelFrac * 100)}%`, u);
    this.bar(x + pad, y + pad + 4 * u + rh * 2, iw, s.water / s.waterMax, '#4fbaff', 'WATER', `${Math.round(s.water)} L`, u);
  }

  objective(game, u) {
    const obj = game.objective;
    if (!obj) return;
    const g = this.g;
    _p.copy(obj.pos).project(game.camera);
    const behind = _p.z > 1;
    const dist = game.flight.position.distanceTo(obj.pos);
    const W = this.w, H = this.h;
    const sx = (_p.x * 0.5 + 0.5) * W, sy = (-_p.y * 0.5 + 0.5) * H;
    const on = !behind && sx > 40 && sx < W - 40 && sy > 90 && sy < H - 60;
    const txt = `${obj.label}  ${dist >= 1000 ? (dist / 1000).toFixed(1) + ' KM' : Math.round(dist) + ' M'}`;
    let lx, ly;
    if (on) {
      g.strokeStyle = AMBER;
      g.lineWidth = 2;
      const r = 8 * u, lift = 24 * u + Math.sin(this.time * 5) * 3 * u;
      g.beginPath(); g.moveTo(sx - r, sy - lift - r); g.lineTo(sx, sy - lift); g.lineTo(sx + r, sy - lift - r); g.stroke();
      g.lineWidth = 1.5;
      lx = sx; ly = sy - lift - r - 14 * u;
    } else {
      let dx = _p.x, dy = -_p.y;
      if (behind) { dx = -dx; dy = -dy; }
      const a = Math.atan2(dy, dx);
      const ex = W / 2 + Math.cos(a) * Math.min(W, H) * 0.34, ey = H / 2 + Math.sin(a) * Math.min(W, H) * 0.34;
      g.save(); g.translate(ex, ey); g.rotate(a);
      g.fillStyle = AMBER;
      g.beginPath(); g.moveTo(20 * u, 0); g.lineTo(-8 * u, -12 * u); g.lineTo(-2 * u, 0); g.lineTo(-8 * u, 12 * u); g.closePath(); g.fill();
      g.restore();
      lx = ex; ly = ey + 26 * u;
    }
    this.font(700, 11 * u, FONTS.hud);
    const tw = g.measureText(txt).width + 16 * u;
    this.panel(lx - tw / 2, ly - 10 * u, tw, 20 * u);
    g.fillStyle = AMBER;
    g.textAlign = 'center';
    g.fillText(txt, lx, ly + 1);
  }

  // Top-right: stage title and its checklist.
  missionPanel(game, u) {
    const m = game.mission;
    if (!m.stage) return;
    const g = this.g;
    const lines = m.stage.checklist(game);
    const w = 286 * u, rh = 18 * u;
    const x = this.w - this.M - w, y = this.M;
    const h = 30 * u + lines.length * rh + 8 * u;
    this.panel(x, y, w, h, '#ff7a3d');
    g.textAlign = 'left';
    g.fillStyle = '#ffd27a';
    this.font(700, 15 * u, FONTS.display);
    g.fillText(m.stage.title, x + 13 * u, y + 15 * u);
    g.fillStyle = EDGE;
    g.fillRect(x + 13 * u, y + 27 * u, w - 26 * u, 1);
    lines.forEach(([done, text], i) => {
      const ly = y + 30 * u + rh * (i + 0.6);
      const ix = x + 19 * u;
      g.save();
      g.shadowBlur = 0;
      g.lineWidth = 1.6;
      if (done) {
        g.fillStyle = GREEN;
        g.beginPath(); g.arc(ix, ly, 5.5 * u, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#0b2414';
        g.beginPath(); g.moveTo(ix - 2.8 * u, ly); g.lineTo(ix - 0.6 * u, ly + 2.4 * u); g.lineTo(ix + 3 * u, ly - 2.4 * u); g.stroke();
      } else {
        g.strokeStyle = 'rgba(255,255,255,0.6)';
        g.beginPath(); g.arc(ix, ly, 5 * u, 0, Math.PI * 2); g.stroke();
      }
      g.restore();
      g.fillStyle = done ? GREEN : WHITE;
      this.font(600, 12.5 * u, FONTS.ui);
      g.fillText(text, ix + 12 * u, ly + 0.5);
    });
  }

  // Score and event pop-ups that rise and fade above the centre.
  toastsDraw(dt, u) {
    const g = this.g;
    this.toasts = this.toasts.filter((t) => (t.t += dt) < 2.4);
    this.toasts.slice(-4).forEach((t, i, arr) => {
      g.globalAlpha = Math.min(1, (2.4 - t.t) * 1.5);
      g.fillStyle = t.color;
      g.textAlign = 'center';
      this.font(700, 19 * u, FONTS.display);
      g.fillText(t.text, this.w / 2, this.h * 0.32 - (arr.length - 1 - i) * 24 * u - t.t * 14 * u);
    });
    g.globalAlpha = 1;
  }

  radioBox(dt, u, compact) {
    const g = this.g;
    const active = this.radioLines.filter((r) => { r.t += dt; return r.t > 0 && r.t < r.life; });
    this.radioLines = this.radioLines.filter((r) => r.t < r.life);
    if (!active.length) return;
    const line = active[active.length - 1];
    const side = compact ? 150 * u : 214 * u + this.M * 2;
    const w = Math.min(this.w - side * 2, 560 * u);
    const [who, ...rest] = line.text.split(': ');
    const body = rest.length ? rest.join(': ') : who;
    const shown = body.slice(0, Math.floor(line.t * 60));
    this.font(400, 13 * u, FONTS.ui);
    const lines = wrapLines(g, shown || ' ', w - 26 * u);
    const h = 26 * u + lines.length * 17 * u;
    const x = this.w / 2 - w / 2, y = this.h - this.M - h;
    this.panel(x, y, w, h, '#ff7a3d');
    g.textAlign = 'left';
    g.fillStyle = '#ffb27a';
    this.font(700, 10 * u, FONTS.hud);
    g.fillText(rest.length ? `RADIO · ${who}` : 'RADIO', x + 13 * u, y + 12 * u);
    g.fillStyle = '#eef6ff';
    this.font(400, 13 * u, FONTS.ui);
    lines.forEach((l, i) => g.fillText(l, x + 13 * u, y + 29 * u + i * 17 * u));
  }

  bannerDraw(dt, u) {
    if (!this.bannerText || this.bannerTime <= 0) return;
    this.bannerTime -= dt;
    const g = this.g;
    const a = Math.min(1, this.bannerTime, (6 - this.bannerTime) * 3);
    const cy = this.h * 0.27;
    g.globalAlpha = a;
    const grad = g.createLinearGradient(0, 0, this.w, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.3, 'rgba(6,8,10,0.62)');
    grad.addColorStop(0.7, 'rgba(6,8,10,0.62)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, cy - 34 * u, this.w, 70 * u);
    g.fillStyle = 'rgba(255,122,61,0.9)';
    g.fillRect(this.w / 2 - 60 * u, cy - 34 * u, 120 * u, 2 * u);
    g.textAlign = 'center';
    g.fillStyle = '#ffd27a';
    this.font(900, 30 * u, FONTS.display);
    g.fillText(this.bannerText.title, this.w / 2, cy - 8 * u);
    g.fillStyle = '#f2ece6';
    this.font(400, 14 * u, FONTS.ui);
    g.fillText(this.bannerText.sub, this.w / 2, cy + 20 * u);
    g.globalAlpha = 1;
  }
}

function wrapLines(g, text, maxW) {
  const out = [];
  let line = '';
  for (const w of text.split(' ')) {
    const t = line ? line + ' ' + w : w;
    if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
  }
  out.push(line);
  return out;
}
