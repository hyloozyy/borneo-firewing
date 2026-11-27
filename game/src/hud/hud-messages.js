// Messages on the HUD: radio panel with speaker label, typing effect and voice meter; stage banners;
// score pop-ups; master warning/caution with the active annunciators; drop hit/miss feedback;
// objective marker; the stage checklist.
import { STAGES } from '../mission/mission-stages.js';
import * as THREE from 'three';
import { C, font, glow, panel, wrapLines } from './hud-style.js';
import { LEVEL_COLOR } from '../flight/annunciators.js';

const _p = new THREE.Vector3();

export function radioBox(g, hud, x, y, w, u, dt) {
  const active = hud.radioLines.filter((r) => { r.t += dt; return r.t > 0 && r.t < r.life; });
  hud.radioLines = hud.radioLines.filter((r) => r.t < r.life);
  if (!active.length) return;
  const line = active[active.length - 1];
  const [who, ...rest] = line.text.split(': ');
  const body = rest.length ? rest.join(': ') : who;
  const typed = Math.floor(line.t * 55);
  const shown = body.slice(0, typed);
  const typing = typed < body.length;
  font(g, 500, 13 * u, 'ui');
  const lines = wrapLines(g, shown || ' ', w - 28 * u);
  const h = 30 * u + Math.max(1, lines.length) * 17 * u;
  const fade = Math.min(1, (line.life - line.t) * 2, line.t * 4);
  g.save();
  g.globalAlpha = fade;
  panel(g, x, y - h, w, h, u, { accent: C.fire, bracket: C.fire });
  // Speaker label and a live voice meter while the message is "spoken".
  g.textAlign = 'left';
  font(g, 700, 9.5 * u);
  g.fillStyle = C.fire;
  const label = rest.length ? `◉ ${who}` : '◉ RADIO';
  g.fillText(label, x + 14 * u, y - h + 12 * u);
  const lw = g.measureText(label).width;
  g.fillStyle = 'rgba(255,190,140,0.65)';
  font(g, 400, 9 * u, 'mono');
  g.fillText('123.45 MHZ', x + 22 * u + lw, y - h + 12 * u);
  for (let i = 0; i < 12; i++) {
    const amp = typing ? 0.25 + Math.abs(Math.sin(hud.time * 17 + i * 1.7) * Math.sin(hud.time * 5 + i)) : 0.12;
    g.fillStyle = typing ? C.fire : 'rgba(255,122,61,0.35)';
    const bh = amp * 10 * u;
    g.fillRect(x + w - 16 * u - i * 4 * u, y - h + 12 * u - bh / 2, 2.4 * u, bh);
  }
  g.fillStyle = '#f3f7ff';
  font(g, 500, 13 * u, 'ui');
  lines.forEach((l, i) => {
    g.fillText(l, x + 14 * u, y - h + 30 * u + i * 17 * u);
    if (typing && i === lines.length - 1 && Math.floor(hud.time * 6) % 2) {
      g.fillStyle = C.fire;
      g.fillRect(x + 15 * u + g.measureText(l).width, y - h + 24 * u + i * 17 * u, 6 * u, 12 * u);
      g.fillStyle = '#f3f7ff';
    }
  });
  g.restore();
  return h;
}

// Stage banner: slides in, a scan line wipes across, then fades.
export function bannerDraw(g, hud, W, H, u, dt) {
  const b = hud.bannerText;
  if (!b || hud.bannerTime <= 0) return;
  hud.bannerTime -= dt;
  const age = 6 - hud.bannerTime;
  const a = Math.min(1, hud.bannerTime, age * 3);
  const slide = Math.max(0, 1 - age * 2.5) ** 2 * 60 * u;
  const cy = H * 0.27;
  g.save();
  g.globalAlpha = a;
  const grad = g.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.28, 'rgba(8,6,4,0.7)');
  grad.addColorStop(0.72, 'rgba(8,6,4,0.7)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, cy - 40 * u, W, 82 * u);
  g.fillStyle = C.fire;
  g.fillRect(W * 0.3, cy - 40 * u, W * 0.4 * Math.min(1, age * 2), 2 * u);
  g.fillRect(W * 0.7 - W * 0.4 * Math.min(1, age * 2), cy + 40 * u, W * 0.4 * Math.min(1, age * 2), 2 * u);
  const [num, ...rest] = b.title.split(' · ');
  g.textAlign = 'center';
  font(g, 700, 11 * u);
  g.fillStyle = C.fire;
  g.fillText(rest.length ? num : 'MISSION', W / 2, cy - 26 * u);
  font(g, 900, 34 * u, 'display');
  g.shadowColor = 'rgba(255,90,30,0.8)'; g.shadowBlur = 16;
  g.fillStyle = C.gold;
  g.fillText(rest.length ? rest.join(' · ') : b.title, W / 2 + slide, cy - 2 * u);
  g.shadowBlur = 0;
  g.fillStyle = '#f2ece6';
  font(g, 500, 14 * u, 'ui');
  g.fillText(b.sub, W / 2 - slide, cy + 26 * u);
  // Scan line wipe
  if (age < 0.8) {
    const sx = (age / 0.8) * W;
    const sg = g.createLinearGradient(sx - 80 * u, 0, sx, 0);
    sg.addColorStop(0, 'rgba(255,210,122,0)');
    sg.addColorStop(1, 'rgba(255,210,122,0.35)');
    g.fillStyle = sg;
    g.fillRect(sx - 80 * u, cy - 40 * u, 80 * u, 82 * u);
  }
  g.restore();
}

export function toastsDraw(g, hud, W, H, u, dt) {
  hud.toasts = hud.toasts.filter((t) => (t.t += dt) < 2.4);
  hud.toasts.slice(-4).forEach((t, i, arr) => {
    g.globalAlpha = Math.min(1, (2.4 - t.t) * 1.5);
    g.textAlign = 'center';
    font(g, 700, 19 * u, 'display');
    const pop = 1 + Math.max(0, 0.25 - t.t) * 1.6;
    g.save();
    g.translate(W / 2, H * 0.36 - (arr.length - 1 - i) * 24 * u - t.t * 14 * u);
    g.scale(pop, pop);
    glow(g, t.text, 0, 0, t.color, 8);
    g.restore();
  });
  g.globalAlpha = 1;
}

// Master warning / caution: a flashing lamp and the list of what is lit, under the heading box.
export function alertsDraw(g, hud, lights, cx, y, u) {
  const serious = lights.filter((l) => l.level === 'warning' || l.level === 'caution');
  // Fresh damage messages (from the damage model) scroll under the lamp for a few seconds.
  hud.alerts = hud.alerts.filter((a) => (a.t += hud.dt) < 5);
  if (!serious.length && !hud.alerts.length) return;
  const warn = serious.some((l) => l.level === 'warning') || hud.alerts.some((a) => a.level === 'warning');
  const col = warn ? C.red : C.amber;
  const on = Math.floor(hud.time * 3) % 2 === 0;
  font(g, 700, 11 * u);
  const title = warn ? 'MASTER WARNING' : 'MASTER CAUTION';
  const tw = g.measureText(title).width + 22 * u;
  g.save();
  g.fillStyle = on ? col : 'rgba(0,0,0,0.65)';
  g.strokeStyle = col; g.lineWidth = 1.5;
  g.shadowColor = col; g.shadowBlur = on ? 14 : 0;
  g.beginPath(); g.roundRect(cx - tw / 2, y, tw, 20 * u, 3 * u); g.fill(); g.stroke();
  g.restore();
  g.textAlign = 'center';
  g.fillStyle = on ? '#100' : col;
  g.fillText(title, cx, y + 10.5 * u);
  // Lit annunciators as chips
  font(g, 700, 9.5 * u, 'mono');
  const chips = serious.slice(0, 5);
  let total = chips.reduce((a, l) => a + g.measureText(l.text).width + 14 * u, 0) - 4 * u;
  let x = cx - total / 2;
  chips.forEach((l) => {
    const w = g.measureText(l.text).width + 10 * u;
    const c = LEVEL_COLOR[l.level];
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.strokeStyle = c;
    g.beginPath(); g.roundRect(x, y + 25 * u, w, 16 * u, 2 * u); g.fill(); g.stroke();
    g.textAlign = 'center';
    g.fillStyle = c;
    g.fillText(l.text, x + w / 2, y + 33.5 * u);
    x += w + 4 * u;
  });
  const latest = hud.alerts[hud.alerts.length - 1];
  if (latest) {
    font(g, 700, 13 * u, 'hud');
    g.textAlign = 'center';
    g.globalAlpha = Math.min(1, (5 - latest.t) * 2);
    glow(g, latest.text, cx, y + (chips.length ? 54 : 32) * u, LEVEL_COLOR[latest.level] || C.amber, 8);
    g.globalAlpha = 1;
  }
}

// Drop feedback: DIRECT HIT / PARTIAL / MISS with the share of water that landed on fire.
export function dropResultDraw(g, hud, cx, cy, u, dt) {
  const r = hud.drop;
  if (!r) return;
  r.t += dt;
  if (r.t > 2.8) { hud.drop = null; return; }
  const pct = Math.round(r.ratio * 100);
  const [text, col] = r.ratio > 0.55 ? ['DIRECT HIT', C.green] : r.ratio > 0.15 ? ['PARTIAL HIT', C.amber] : ['MISS', C.red];
  const a = Math.min(1, (2.8 - r.t) * 2);
  const pop = 1 + Math.max(0, 0.3 - r.t) * 2;
  g.save();
  g.globalAlpha = a;
  g.translate(cx, cy);
  // Expanding ring
  g.strokeStyle = col; g.lineWidth = 3 * u * (1 - Math.min(1, r.t / 0.8));
  g.beginPath(); g.arc(0, 0, (20 + r.t * 120) * u, 0, Math.PI * 2); g.stroke();
  g.scale(pop, pop);
  g.textAlign = 'center';
  font(g, 900, 30 * u, 'display');
  glow(g, text, 0, 0, col, 14);
  font(g, 700, 13 * u, 'mono');
  glow(g, `${pct}% ON TARGET`, 0, 24 * u, C.white, 4);
  g.restore();
}

// Objective marker on screen, or an edge arrow when it is off screen.
// avoid (phones): rectangles the distance label must not cover; it moves to the nearest free spot
// (or is left out), and its own rectangle is appended so the layout test sees it too.
export function objectiveMarker(g, game, W, H, u, time, avoid = null) {
  const obj = game.objective;
  if (!obj) return;
  _p.copy(obj.pos).project(game.camera);
  const behind = _p.z > 1;
  const dist = game.flight.position.distanceTo(obj.pos);
  const sx = (_p.x * 0.5 + 0.5) * W, sy = (-_p.y * 0.5 + 0.5) * H;
  const on = !behind && sx > 40 && sx < W - 40 && sy > 90 && sy < H - 60;
  const txt = `${obj.label}  ${dist >= 1000 ? (dist / 1000).toFixed(1) + ' KM' : Math.round(dist) + ' M'}`;
  let lx, ly;
  g.save();
  g.strokeStyle = C.amber; g.fillStyle = C.amber; g.shadowColor = C.amber; g.shadowBlur = 6;
  if (on) {
    g.lineWidth = 2;
    const r = 8 * u, lift = 24 * u + Math.sin(time * 5) * 3 * u;
    g.beginPath(); g.moveTo(sx - r, sy - lift - r); g.lineTo(sx, sy - lift); g.lineTo(sx + r, sy - lift - r); g.stroke();
    // Corner brackets that breathe around the target.
    const k = (14 + Math.sin(time * 4) * 2) * u;
    g.lineWidth = 1.5;
    for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      g.beginPath(); g.moveTo(sx + dx * k, sy + dy * (k - 5 * u)); g.lineTo(sx + dx * k, sy + dy * k); g.lineTo(sx + dx * (k - 5 * u), sy + dy * k); g.stroke();
    }
    lx = sx; ly = sy - lift - r - 14 * u;
  } else {
    let dx = _p.x, dy = -_p.y;
    if (behind) { dx = -dx; dy = -dy; }
    const a = Math.atan2(dy, dx);
    const ex = W / 2 + Math.cos(a) * Math.min(W, H) * 0.34, ey = H / 2 + Math.sin(a) * Math.min(W, H) * 0.34;
    g.translate(ex, ey); g.rotate(a);
    g.beginPath(); g.moveTo(20 * u, 0); g.lineTo(-8 * u, -12 * u); g.lineTo(-2 * u, 0); g.lineTo(-8 * u, 12 * u); g.closePath(); g.fill();
    lx = ex; ly = ey + 26 * u;
  }
  g.restore();
  font(g, 700, 11 * u);
  const tw = g.measureText(txt).width + 16 * u;
  if (avoid) {
    const free = (x, y) => x - tw / 2 >= 4 && x + tw / 2 <= W - 4 && y - 10 * u >= 4 && y + 10 * u <= H - 4
      && !avoid.some((o) => x - tw / 2 < o.x + o.w + 4 && o.x - 4 < x + tw / 2 && y - 10 * u < o.y + o.h + 4 && o.y - 4 < y + 10 * u);
    let spot = null;
    for (let k = 0; k <= 16 && !spot; k++) {
      const dy = Math.ceil(k / 2) * 22 * u * (k % 2 ? 1 : -1);
      for (const dx of [0, 60 * u, -60 * u, 120 * u, -120 * u]) if (!spot && free(lx + dx, ly + dy)) spot = [lx + dx, ly + dy];
    }
    if (!spot) return;
    [lx, ly] = spot;
    avoid.push({ name: 'objective label', x: lx - tw / 2, y: ly - 10 * u, w: tw, h: 20 * u });
  }
  panel(g, lx - tw / 2, ly - 10 * u, tw, 20 * u, u, { bracket: C.amber });
  g.textAlign = 'center';
  glow(g, txt, lx, ly + 1, C.amber, 4);
}

// Top-right: stage title and its checklist, ticks animate in when an item completes.
export function missionPanel(g, game, hud, x, y, w, u) {
  const m = game.mission;
  if (!m.stage) return 0;
  const lines = m.stage.checklist(game);
  const rh = 18 * u;
  const h = 32 * u + lines.length * rh + 8 * u;
  panel(g, x, y, w, h, u, { accent: C.fire, bracket: C.fire });
  g.textAlign = 'left';
  font(g, 700, 15 * u, 'display');
  glow(g, m.stage.title, x + 13 * u, y + 15 * u, C.gold, 6);
  // Where this stage sits in the mission (e.g. 3/5).
  g.textAlign = 'right';
  font(g, 600, 10.5 * u, 'mono');
  g.fillStyle = C.greenDim;
  g.fillText(`${m.index + 1}/${STAGES.length}`, x + w - 13 * u, y + 15 * u);
  g.textAlign = 'left';
  g.fillStyle = C.edge;
  g.fillRect(x + 13 * u, y + 28 * u, w - 26 * u, 1);
  hud.checks = hud.checks || {};
  lines.forEach(([done, text], i) => {
    const key = `${m.index}:${i}`;
    if (done) hud.checks[key] = Math.min(1, (hud.checks[key] || 0) + hud.dt * 4);
    else hud.checks[key] = 0;
    const k = hud.checks[key];
    const ly = y + 32 * u + rh * (i + 0.6);
    const ix = x + 19 * u;
    g.save();
    g.lineWidth = 1.6;
    if (done) {
      g.fillStyle = C.green; g.shadowColor = C.green; g.shadowBlur = 6;
      g.beginPath(); g.arc(ix, ly, 5.5 * u * (0.6 + 0.4 * k), 0, Math.PI * 2); g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = '#0b2414';
      g.beginPath(); g.moveTo(ix - 2.8 * u, ly); g.lineTo(ix - 0.6 * u, ly + 2.4 * u); g.lineTo(ix + 3 * u, ly - 2.4 * u); g.stroke();
    } else {
      g.strokeStyle = 'rgba(255,255,255,0.6)';
      g.beginPath(); g.arc(ix, ly, 5 * u, 0, Math.PI * 2); g.stroke();
    }
    g.restore();
    g.fillStyle = done ? C.green : C.white;
    font(g, 600, 12.5 * u, 'ui');
    g.fillText(text, ix + 12 * u, ly + 0.5);
  });
  return h;
}
