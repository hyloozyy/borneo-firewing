// Head-up display drawn on a 2D canvas: speed and altitude tapes, heading tape, pitch ladder,
// water/fuel/throttle gauges, stage checklist, objective arrow and marker, radio text, banners.
import * as THREE from 'three';

const GREEN = '#9dffb0';
const AMBER = '#ffc861';
const RED = '#ff5a4a';
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

  draw(game, dt) {
    const { g } = this;
    this.time += dt;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    if (!game.showHud) return;
    const s = game.flight;
    const W = this.w, H = this.h;
    const small = W < 760;
    const u = Math.max(0.62, Math.min(1.15, Math.min(W / 1280, H / 640)));
    g.lineWidth = 1.6;
    g.font = `600 ${13 * u}px "Segoe UI", Arial, sans-serif`;
    g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,0.65)';
    g.shadowBlur = 4;

    const kt = s.airspeed * 1.944;
    const ft = s.position.y * 3.281;
    if (game.cameraMode === 'cockpit') this.pitchLadder(s, W / 2, H * 0.5, H * 0.5, u, true);
    else this.pathMarker(game, u);
    const tx = Math.max(270 * u, W * 0.36);
    this.tape(W / 2 - tx, H * 0.5, kt, 'SPD', 'KT', 10, u, s.stall ? RED : GREEN, true);
    this.tape(W / 2 + tx, H * 0.5, ft, 'ALT', 'FT', 100, u, s.agl < 30 && !s.onGround ? AMBER : GREEN, false);
    this.headingTape(W / 2, 30 * u, s.heading, u);

    // Vertical speed, AGL, G
    g.fillStyle = GREEN;
    g.textAlign = 'left';
    g.fillText(`VS ${(s.vs * 196.85 >= 0 ? '+' : '') + Math.round(s.vs * 196.85)} FPM`, W / 2 + tx - 48 * u, H * 0.5 + 128 * u);
    g.fillText(`RA ${Math.max(0, Math.round(s.agl * 3.281))} FT`, W / 2 + tx - 48 * u, H * 0.5 + 148 * u);
    g.textAlign = 'right';
    g.fillText(`THR ${Math.round(s.throttle * 100)}%`, W / 2 - tx + 48 * u, H * 0.5 + 128 * u);
    g.fillText(`FLAPS ${['UP', '1', 'FULL'][Math.round(s.flapTarget * 2)]}`, W / 2 - tx + 48 * u, H * 0.5 + 148 * u);
    if (s.stall) this.flash('STALL', W / 2, H * 0.5 + 90 * u, RED, u);
    else if (s.scooping) this.flash('SCOOPING', W / 2, H * 0.5 + 90 * u, '#7fd8ff', u);
    else if (game.dropWindow > 0 && s.water > 0) this.flash('DROP NOW · SPACE', W / 2, H * 0.5 + 90 * u, AMBER, u);
    if (s.turbulence > 0.2) this.flash('SMOKE · TURBULENCE', W / 2, H * 0.5 + 112 * u, AMBER, u);

    this.gauges(game, 16 * u, game.controls.isTouch ? H * 0.42 : H - 16 * u, u);
    this.objective(game, u);
    this.missionPanel(game, u, small);
    this.radioBox(dt, u);
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
    g.lineWidth = 1.6;
  }

  flash(text, x, y, color, u) {
    const g = this.g;
    if (Math.floor(this.time * 3) % 2) return;
    g.font = `800 ${16 * u}px Arial`;
    g.textAlign = 'center';
    g.fillStyle = color;
    g.fillText(text, x, y);
    g.font = `600 ${13 * u}px Arial`;
  }

  tape(x, cy, value, label, unit, step, u, color, left) {
    const g = this.g;
    const h = 220 * u, w = 64 * u;
    g.save();
    g.strokeStyle = color; g.fillStyle = color;
    g.globalAlpha = 0.9;
    g.beginPath();
    g.rect(x - w / 2, cy - h / 2, w, h);
    g.clip();
    g.fillStyle = 'rgba(5,20,10,0.28)';
    g.fillRect(x - w / 2, cy - h / 2, w, h);
    g.fillStyle = color;
    g.textAlign = left ? 'right' : 'left';
    const pxPer = 3.2 * u * (10 / step);
    const base = Math.floor(value / step) * step;
    for (let k = -8; k <= 8; k++) {
      const v = base + k * step;
      const y = cy - (v - value) * pxPer;
      const major = Math.round(v / step) % 5 === 0;
      const tx = left ? x + w / 2 : x - w / 2;
      g.beginPath();
      g.moveTo(tx, y);
      g.lineTo(tx + (left ? -1 : 1) * (major ? 14 : 7) * u, y);
      g.stroke();
      if (major && v >= 0) g.fillText(String(v), left ? x + w / 2 - 17 * u : x - w / 2 + 17 * u, y);
    }
    g.restore();
    // Current value box
    g.fillStyle = 'rgba(0,0,0,0.65)';
    g.strokeStyle = color;
    g.fillRect(x - w / 2 - 6 * u, cy - 14 * u, w + 12 * u, 28 * u);
    g.strokeRect(x - w / 2 - 6 * u, cy - 14 * u, w + 12 * u, 28 * u);
    g.fillStyle = color;
    g.textAlign = 'center';
    g.font = `800 ${18 * u}px Arial`;
    g.fillText(String(Math.max(0, Math.round(value))), x, cy + 1);
    g.font = `700 ${12 * u}px Arial`;
    g.fillText(`${label} ${unit}`, x, cy - 125 * u);
    g.font = `600 ${13 * u}px Arial`;
  }

  headingTape(cx, y, hdg, u) {
    const g = this.g;
    const w = 360 * u;
    g.save();
    g.beginPath(); g.rect(cx - w / 2, y - 16 * u, w, 40 * u); g.clip();
    g.strokeStyle = GREEN; g.fillStyle = GREEN; g.textAlign = 'center';
    const pxPerDeg = 4 * u;
    const base = Math.floor(hdg / 5) * 5;
    for (let k = -40; k <= 40; k += 5) {
      const d = base + k;
      const x = cx + (d - hdg) * pxPerDeg;
      const n = ((d % 360) + 360) % 360;
      g.beginPath(); g.moveTo(x, y + 10 * u); g.lineTo(x, y + (n % 10 === 0 ? 2 : 6) * u); g.stroke();
      if (n % 30 === 0) {
        const lbl = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[n] ?? String(n / 10).padStart(2, '0');
        g.fillText(lbl, x, y + 20 * u);
      }
    }
    g.restore();
    g.fillStyle = 'rgba(0,0,0,0.65)';
    g.fillRect(cx - 30 * u, y - 18 * u, 60 * u, 18 * u);
    g.strokeStyle = GREEN;
    g.strokeRect(cx - 30 * u, y - 18 * u, 60 * u, 18 * u);
    g.fillStyle = GREEN;
    g.font = `800 ${14 * u}px Arial`;
    g.fillText(`HDG ${String(Math.round(hdg) % 360).padStart(3, '0')}`, cx, y - 9 * u);
    g.font = `600 ${13 * u}px Arial`;
  }

  pitchLadder(s, cx, cy, span, u, cockpit) {
    const g = this.g;
    g.save();
    g.translate(cx, cy);
    g.rotate(-s.roll);
    g.strokeStyle = 'rgba(157,255,176,0.75)';
    g.fillStyle = 'rgba(157,255,176,0.85)';
    const ppd = 7 * u;
    const p = (s.pitch * 180) / Math.PI;
    g.beginPath(); g.rect(-160 * u, -130 * u, 320 * u, 260 * u); g.clip();
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
    // Aircraft symbol (waterline)
    g.strokeStyle = AMBER; g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(cx - 40 * u, cy); g.lineTo(cx - 12 * u, cy); g.lineTo(cx, cy + 8 * u); g.lineTo(cx + 12 * u, cy); g.lineTo(cx + 40 * u, cy);
    g.stroke();
    g.lineWidth = 1.6;
    // Bank scale
    g.strokeStyle = GREEN;
    g.beginPath(); g.arc(cx, cy, 120 * u, -Math.PI / 2 - 0.8, -Math.PI / 2 + 0.8); g.stroke();
    g.save(); g.translate(cx, cy); g.rotate(-s.roll);
    g.fillStyle = AMBER;
    g.beginPath(); g.moveTo(0, -118 * u); g.lineTo(-6 * u, -106 * u); g.lineTo(6 * u, -106 * u); g.fill();
    g.restore();
  }

  bar(x, y, w, h, frac, color, label, value, u) {
    const g = this.g;
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(x, y, w, h);
    g.fillStyle = color;
    g.fillRect(x + 2, y + 2, (w - 4) * Math.max(0, Math.min(1, frac)), h - 4);
    g.strokeStyle = 'rgba(255,255,255,0.5)';
    g.strokeRect(x, y, w, h);
    g.fillStyle = '#fff';
    g.textAlign = 'left';
    g.fillText(label, x, y - 9 * u);
    g.textAlign = 'right';
    g.fillText(value, x + w, y - 9 * u);
  }

  gauges(game, x, bottom, u) {
    const s = game.flight;
    const w = 210 * u, h = 13 * u;
    this.bar(x, bottom - h, w, h, s.water / s.waterMax, '#46b6ff', 'WATER TANK', `${Math.round(s.water)} L`, u);
    const fuelFrac = s.fuel / s.fuelMax;
    this.bar(x, bottom - h - 38 * u, w, h, fuelFrac, fuelFrac < 0.2 ? RED : '#ffb347', 'FUEL', `${Math.round(fuelFrac * 100)}%`, u);
    this.bar(x, bottom - h - 76 * u, w, h, s.rpm, '#9dffb0', 'ENGINES', `${Math.round(s.rpm * 100)}% RPM`, u);
  }

  objective(game, u) {
    const obj = game.objective;
    if (!obj) return;
    const g = this.g;
    const cam = game.camera;
    _p.copy(obj.pos).project(cam);
    const behind = _p.z > 1;
    const dist = game.flight.position.distanceTo(obj.pos);
    const W = this.w, H = this.h;
    let sx = (_p.x * 0.5 + 0.5) * W, sy = (-_p.y * 0.5 + 0.5) * H;
    const on = !behind && sx > 30 && sx < W - 30 && sy > 60 && sy < H - 60;
    if (on) {
      g.strokeStyle = AMBER;
      g.lineWidth = 2;
      // A chevron hovering above the target, so the target itself stays visible.
      const r = 9 * u, lift = 26 * u + Math.sin(this.time * 5) * 3 * u;
      g.beginPath(); g.moveTo(sx - r, sy - lift - r); g.lineTo(sx, sy - lift); g.lineTo(sx + r, sy - lift - r); g.stroke();
      g.fillStyle = AMBER; g.textAlign = 'center';
      g.fillText(`${obj.label} ${dist > 1000 ? (dist / 1000).toFixed(1) + ' KM' : Math.round(dist) + ' M'}`, sx, sy - lift - r - 12 * u);
      g.lineWidth = 1.6;
    } else {
      // Edge arrow pointing toward the objective.
      let dx = _p.x, dy = -_p.y;
      if (behind) { dx = -dx; dy = -dy; }
      const a = Math.atan2(dy, dx);
      const ex = W / 2 + Math.cos(a) * Math.min(W, H) * 0.36, ey = H / 2 + Math.sin(a) * Math.min(W, H) * 0.36;
      g.save(); g.translate(ex, ey); g.rotate(a);
      g.fillStyle = AMBER;
      g.beginPath(); g.moveTo(22 * u, 0); g.lineTo(-8 * u, -13 * u); g.lineTo(-2 * u, 0); g.lineTo(-8 * u, 13 * u); g.closePath(); g.fill();
      g.restore();
      g.fillStyle = AMBER; g.textAlign = 'center';
      g.fillText(`${obj.label} ${(dist / 1000).toFixed(1)} KM`, ex, ey + 26 * u);
    }
  }

  missionPanel(game, u, small) {
    const m = game.mission;
    if (!m.stage) return;
    const g = this.g;
    const x = this.w - 16 * u, y = 70 * u;
    const lines = m.stage.checklist(game);
    const w = 300 * u;
    g.fillStyle = 'rgba(8,12,16,0.5)';
    g.fillRect(x - w, y - 8 * u, w, (48 + lines.length * 20) * u);
    g.textAlign = 'left';
    g.fillStyle = AMBER;
    g.font = `800 ${13 * u}px Arial`;
    g.fillText(m.stage.title, x - w + 10 * u, y + 6 * u);
    g.font = `600 ${12.5 * u}px Arial`;
    lines.forEach(([done, text], i) => {
      g.fillStyle = done ? GREEN : '#ffffff';
      g.fillText(`${done ? '✔' : '○'} ${text}`, x - w + 10 * u, y + (28 + i * 20) * u);
    });
    // Status row: fires, village, time, score
    const fires = game.fire.activeCells().length;
    const tl = Math.max(0, 25 * 60 - m.elapsed);
    g.fillStyle = '#fff';
    g.textAlign = 'right';
    g.font = `700 ${13 * u}px Arial`;
    g.fillText(`🔥 TITIK API ${fires}   ⏱ ${Math.floor(tl / 60)}:${String(Math.floor(tl % 60)).padStart(2, '0')}   SKOR ${m.total() + Math.round(m.stagePoints || 0)}`, x, y + (52 + lines.length * 20) * u);
    g.font = `600 ${13 * u}px Arial`;
  }

  // Score and event pop-ups that rise and fade beside the aircraft symbol.
  toastsDraw(dt, u) {
    const g = this.g;
    this.toasts = this.toasts.filter((t) => (t.t += dt) < 2.4);
    this.toasts.slice(-4).forEach((t, i, arr) => {
      g.globalAlpha = Math.min(1, (2.4 - t.t) * 1.5);
      g.fillStyle = t.color;
      g.textAlign = 'center';
      g.font = `800 ${17 * u}px Arial`;
      g.fillText(t.text, this.w / 2, this.h * 0.3 - (arr.length - 1 - i) * 22 * u - t.t * 14 * u);
    });
    g.globalAlpha = 1;
    g.font = `600 ${13 * u}px Arial`;
  }

  radioBox(dt, u) {
    const g = this.g;
    const active = this.radioLines.filter((r) => { r.t += dt; return r.t > 0 && r.t < r.life; });
    this.radioLines = this.radioLines.filter((r) => r.t < r.life);
    if (!active.length) return;
    const line = active[active.length - 1];
    const w = Math.min(this.w - 40, 640 * u);
    const x = this.w / 2 - w / 2, y = this.h - 64 * u;
    g.fillStyle = 'rgba(10,16,24,0.72)';
    g.fillRect(x, y, w, 44 * u);
    g.fillStyle = '#ff7a3d';
    g.fillRect(x, y, 4 * u, 44 * u);
    g.fillStyle = '#e8f4ff';
    g.textAlign = 'left';
    g.font = `600 ${13 * u}px Arial`;
    const shown = line.text.slice(0, Math.floor(line.t * 60));
    wrap(g, '📻 ' + shown, x + 12 * u, y + 14 * u, w - 20 * u, 16 * u);
  }

  bannerDraw(dt, u) {
    if (!this.bannerText || this.bannerTime <= 0) return;
    this.bannerTime -= dt;
    const g = this.g;
    const a = Math.min(1, this.bannerTime, (6 - this.bannerTime) * 3);
    g.globalAlpha = a;
    g.textAlign = 'center';
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(0, this.h * 0.2 - 30 * u, this.w, 66 * u);
    g.fillStyle = '#ffd27a';
    g.font = `900 ${26 * u}px Arial`;
    g.fillText(this.bannerText.title, this.w / 2, this.h * 0.2 - 8 * u);
    g.fillStyle = '#fff';
    g.font = `600 ${14 * u}px Arial`;
    g.fillText(this.bannerText.sub, this.w / 2, this.h * 0.2 + 20 * u);
    g.globalAlpha = 1;
  }
}

function wrap(g, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (g.measureText(t).width > maxW && line) { g.fillText(line, x, y); line = w; y += lh; }
    else line = t;
  }
  g.fillText(line, x, y);
}
