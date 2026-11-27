// Head-up display on a 2D canvas: lays out the flight symbology (hud-flight), radar (hud-radar),
// systems panels (hud-systems) and messages (hud-messages) on one margin grid, desktop and phone.
import { touchObstacles, freeBand, bottomGap } from './touch-layout.js';
import { C, font, glow } from './hud-style.js';
import { tape, headingTape, bankScale, pitchLadder, pathMarker } from './hud-flight.js';
import { radar } from './hud-radar.js';
import { statusStrip, systemsPanel, readouts, gMeter } from './hud-systems.js';
import { radioBox, bannerDraw, toastsDraw, alertsDraw, dropResultDraw, objectiveMarker, missionPanel } from './hud-messages.js';
import { activeLights } from '../flight/annunciators.js';
import { InstrumentCluster } from './hud-cluster.js';
import { keyName } from '../input/key-names.js';
import { PHASE_LABEL } from '../flight/scoop-autopilot.js';
import { terrainHeight } from '../world/terrain.js';

const KT = 1.944, FT = 3.281;

export class Hud {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.radioLines = [];
    this.bannerText = null;
    this.bannerTime = 0;
    this.toasts = [];
    this.alerts = [];
    this.drop = null;
    this.time = 0;
    this.dt = 0;
    this.alpha = 0;
    this.spdRate = 0;
    this.prevKt = null;
    this.cluster = new InstrumentCluster();
  }

  resize(w, h, dpr) {
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.dpr = dpr; this.w = w; this.h = h;
  }

  banner(title, sub) { this.bannerText = { title, sub }; this.bannerTime = 6; }
  radio(text, delay = 0) { this.radioLines.push({ text, t: -delay, life: 10 }); }
  toast(text, color = C.amber) { this.toasts.push({ text, t: 0, color }); }
  alert(text, level) { this.alerts.push({ text, level, t: 0 }); }
  dropResult(ratio) { this.drop = { ratio, t: 0 }; }

  draw(game, dt) {
    const { g } = this;
    this.time += dt;
    this.dt = dt;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    // Fade the whole HUD in and out (H key, mission start and end).
    this.alpha += ((game.showHud ? 1 : 0) - this.alpha) * Math.min(1, dt ? dt * 5 : 1);
    if (this.alpha < 0.02) return;
    g.globalAlpha = this.alpha;
    const s = game.flight;
    const W = this.w, H = this.h;
    const u = Math.max(0.6, Math.min(1.2, Math.min(W / 1280, H / 600)));
    const compact = W < 900 || H < 430;
    // Phones: tapes pulled in, left column for radar + systems, right column free for the thumbs.
    const touch = compact && game.controls.isTouch;
    const M = 14 * u;
    g.lineWidth = 1.5;
    g.textBaseline = 'middle';

    const kt = s.airspeed * KT;
    const ft = s.position.y * FT;
    if (dt > 0) {
      if (this.prevKt != null) this.spdRate += ((kt - this.prevKt) / dt - this.spdRate) * Math.min(1, dt * 2);
      this.prevKt = kt;
    }
    // Phones in landscape (any size): a layout built around the touch controls, nothing under a thumb.
    this.rects = null;
    if (game.controls.isTouch && W >= H && game.state === 'playing') {
      const obstacles = touchObstacles(this, this.time);
      if (obstacles) { this.drawTouch(game, dt, s, W, H, u, kt, ft, obstacles); g.globalAlpha = 1; return; }
    }
    // In the cockpit the symbology is projected into the windscreen above the glareshield;
    // the panel itself carries the engine, fuel and map displays.
    const cockpit = game.cameraMode === 'cockpit';
    const cy = cockpit ? H * 0.27 : H * 0.48;
    const tapeH = cockpit ? Math.min(150, (H * 0.36) / u) : touch ? 150 : 210;
    if (cockpit) {
      pitchLadder(g, s, W / 2, cy, u, tapeH / 2);
      bankScale(g, s, W / 2, cy, 92 * u, u);
    } else pathMarker(g, game, W, H, u);

    // Speed and altitude tapes with their readouts.
    const tx = cockpit ? Math.min(W * 0.2, 300 * u) : Math.min(W * (touch ? 0.19 : compact ? 0.3 : 0.27), 430 * u);
    const mass = 12500 + s.fuel + s.water;
    const clmax = 0.32 + s.flaps * 0.55 + 4.6 * (0.28 - s.flaps * 0.03);
    const vs = Math.sqrt((2 * mass * 9.81) / (1.2 * 128 * clmax)) * KT;
    tape(g, W / 2 - tx, cy, kt, u, {
      left: true, h: tapeH, label: 'SPD', unit: 'KT', step: 10, color: s.stall ? C.red : C.green, trend: this.spdRate * 6,
      bands: [{ from: 0, to: vs, color: C.red, hatch: true }, { from: 60, to: 115, color: 'rgba(92,200,255,0.75)' }],
    });
    const groundFt = (s.position.y - s.agl - 1.75) * FT;
    tape(g, W / 2 + tx, cy, ft, u, {
      left: false, h: tapeH, label: 'ALT', unit: 'FT', step: 100, color: s.agl < 30 && !s.onGround ? C.amber : C.green, trend: s.vs * FT * 6,
      bands: [{ from: -2000, to: groundFt, color: 'rgba(190,120,60,0.85)', hatch: true }],
    });
    const below = cy + (tapeH / 2) * u + 14 * u;
    const gear = game.plane.userData.parts.gearExt;
    if (!cockpit && !touch) readouts(g, W / 2 - tx, below, [
      ['THR', `${Math.round(s.throttle * 100)}%`],
      ['FLAPS', ['UP', '1', 'FULL'][Math.round(s.flapTarget * 2)]],
      ['GEAR', gear > 0.95 ? 'DOWN' : gear < 0.05 ? 'UP' : 'TRANS', gear > 0.95 ? C.green : gear < 0.05 ? C.white : C.amber],
    ], u);
    const fpm = Math.round(s.vs * 196.85);
    if (cockpit && touch) {
      // Phones: the buttons own the corners; speed/altitude/heading are on the tapes.
    } else if (cockpit) {
      readouts(g, W / 2 + tx + 96 * u, cy - 26 * u, [['VS', `${fpm >= 0 ? '+' : ''}${fpm}`, fpm < -1000 ? C.amber : C.green], ['RA', `${Math.max(0, Math.round(s.agl * FT))}`, s.agl < 30 && !s.onGround ? C.amber : C.green]], u);
      readouts(g, W / 2 - tx - 96 * u, cy - 26 * u, [['THR', `${Math.round(s.throttle * 100)}%`], ['G', s.gLoad.toFixed(1), s.gLoad > 3.2 ? C.red : C.green]], u);
    } else if (!touch) readouts(g, W / 2 + tx, below, [
      ['VS', `${fpm >= 0 ? '+' : ''}${fpm}`, fpm < -1000 ? C.amber : C.green],
      ['RA', `${Math.max(0, Math.round(s.agl * FT))}`, s.agl < 30 && !s.onGround ? C.amber : C.green],
      ['AOA', `${(s.alpha * 57.3).toFixed(1)}°`, s.stall ? C.red : C.green],
    ], u);
    if (!compact && !cockpit) gMeter(g, W / 2 - tx - 66 * u, cy + 78 * u, 20 * u, s.gLoad, s.damage.maxG, u);

    const bug = game.objective ? (Math.atan2(game.objective.pos.x - s.position.x, -(game.objective.pos.z - s.position.z)) * 180) / Math.PI : null;
    // Portrait phones: the corner panels fill the top row, so the heading tape drops below them.
    const portrait = touch && H > W;
    const headY = portrait ? M + 124 * u : M + 2 * u;
    headingTape(g, W / 2, headY, s.heading, u, bug == null ? null : (bug + 360) % 360, game.wind);

    // Centre call-outs
    // Chase view: the call-outs sit under the caution panel, clear of the aircraft in the middle.
    const cy2 = cockpit ? cy + (tapeH / 2 - 14) * u : touch ? cy + 76 * u : M + 120 * u;
    if (s.stall) flash(g, 'STALL · PUSH', W / 2, cy2, C.red, u, this.time);
    else if (s.scooping) flash(g, `SCOOPING · ${Math.round((100 * s.water) / s.waterMax)}%`, W / 2, cy2, C.blue, u, this.time, true);
    else if (game.dropWindow > 0 && s.water > 0) flash(g, `DROP NOW · ${keyName(game, 'drop')}`, W / 2, cy2, C.amber, u, this.time);
    if (s.turbulence > 0.2) flash(g, 'SMOKE · TURBULENCE', W / 2, cy2 + 26 * u, C.amber, u, this.time, true);
    autopilotCallout(g, game, W / 2, cy2 + 52 * u, u, this.time);
    waterCallout(g, game, W / 2, cy2 - 26 * u, u, this.time);

    const lights = activeLights(s, game.plane.userData.parts);
    alertsDraw(g, this, lights, W / 2, portrait ? cy - (tapeH / 2 + 40) * u : headY + 62 * u, u);

    // Corners
    const status = statusStrip(g, game, M, M, u);
    const mw = 290 * u;
    const mh = missionPanel(g, game, this, W - M - mw, M, mw, u);
    const sw = 236 * u;
    let radarR = (compact ? 50 : 72) * u;
    if (cockpit) {
      radarR = 0;
    } else if (touch) {
      radarR = 40 * u;
      radar(g, game, M + 6 * u + radarR, status.bottom + 12 * u + radarR, radarR, u, this.time);
      systemsPanel(g, game, M, portrait ? headY + 96 * u : status.bottom + 24 * u + radarR * 2, sw * 0.9, u);
    } else if (compact) {
      radar(g, game, M + 6 * u + radarR, status.bottom + 14 * u + radarR, radarR, u, this.time);
      systemsPanel(g, game, W - M - sw, M + mh + 8 * u, sw, u);
    } else {
      radar(g, game, M + 6 * u + radarR, H - M - 6 * u - radarR, radarR, u, this.time);
      systemsPanel(g, game, W - M - sw, H - M - 128 * u, sw, u);
    }
    this.touchBarTop = portrait ? headY + 44 * u : M + mh + 6 * u; // the phone's CAM/TILT/HUD/pause buttons sit under the checklist
    objectiveMarker(g, game, W, H, u, this.time);
    // Chase view: the glass instrument cluster along the bottom (I toggles it); the radio sits above.
    let radioBottom = H - M;
    if (!cockpit && game.showCluster && !compact) radioBottom = this.cluster.draw(g, game, W / 2, H - M, u * 0.95, dt, this.time) - 8 * u;
    const side = compact ? Math.min(280, W * 0.3) : radarR * 2 + M * 3 + 12 * u;
    const rw = Math.min(W - side * 2, 560 * u);
    radioBox(g, this, W / 2 - rw / 2, radioBottom, rw, u, dt);
    dropResultDraw(g, this, W / 2, H * 0.4, u, dt);
    toastsDraw(g, this, W, H, u, dt);
    bannerDraw(g, this, W, H, u, dt);
    g.globalAlpha = 1;
  }
}

// Phone landscape HUD: every panel placed in the space the touch controls leave (see touch-layout.js).
Hud.prototype.drawTouch = function drawTouch(game, dt, s, W, H, u, kt, ft, obstacles) {
  const g = this.g;
  const gap = 8;
  const rects = [];
  const rec = (name, x, y, w, h) => { rects.push({ name, x, y, w, h }); };
  const thr = obstacles.find((o) => o.name === '.throttle');
  const label = obstacles.find((o) => o.name === '.zone-label');
  const M = 12 * u;
  const xL = Math.max(M, label ? label.x : M);
  const xR = W - Math.max(M, thr ? W - (thr.x + thr.w) : M);
  const top = M;
  const cockpit = game.cameraMode === 'cockpit';
  // Top row: status (left), checklist (right), heading tape centred in the gap between them.
  const status = statusStrip(g, game, xL, top, u);
  rec('status', xL, top, 240 * u, 52 * u);
  const mw = Math.min(290 * u, W * 0.34);
  const mh = missionPanel(g, game, this, xR - mw, top, mw, u);
  if (mh) rec('mission', xR - mw, top, mw, mh);
  this.touchBarTop = top + mh + 6 * u; // CAM / TILT / HUD / pause bar right under the checklist
  const hl = xL + 240 * u + gap, hr = xR - mw - gap;
  const uH = Math.min(u, (hr - hl) / 416);
  const hcx = hl + (hr - hl - 416 * uH) / 2 + 180 * uH;
  const bug = game.objective ? (Math.atan2(game.objective.pos.x - s.position.x, -(game.objective.pos.z - s.position.z)) * 180) / Math.PI : null;
  headingTape(g, hcx, top + 2 * uH, s.heading, uH, bug == null ? null : (bug + 360) % 360, game.wind);
  rec('heading', hcx - 180 * uH, top, 416 * uH, 54 * uH);
  const placed = () => obstacles.concat(rects);
  // Left column under the status strip, stopping above the stick: radar, then the systems panel.
  let colRight = xL;
  if (!cockpit) {
    const sw0 = 212;
    const colTop = status.bottom + gap;
    const colBottom = freeBand(placed(), xL, xL + sw0 * u, H, colTop).bottom - gap;
    const u2 = Math.min(u, (colBottom - colTop) / 228);
    if (u2 >= 0.42) {
      const r = 40 * u2, d = r * 2 + 12 * u2;
      radar(g, game, xL + 6 * u2 + r, colTop + 6 * u2 + r, r, u2, this.time);
      rec('radar', xL, colTop, d, d);
      const sy = colTop + d + 8 * u2;
      systemsPanel(g, game, xL, sy, sw0 * u2, u2);
      rec('systems', xL, sy, sw0 * u2, 128 * u2);
      colRight = xL + sw0 * u2;
    } else {
      const r = Math.max(18, (colBottom - colTop - 12 * u) / 2);
      radar(g, game, xL + 6 * u + r, colTop + 6 * u + r, r, u, this.time);
      rec('radar', xL, colTop, r * 2 + 12 * u, r * 2 + 12 * u);
      colRight = xL + r * 2 + 12 * u;
    }
  }
  // Speed and altitude tapes: symmetric, in the band both columns leave free.
  const half = 56 * u;
  let tx = Math.min(W * 0.2, 300 * u);
  tx = Math.min(tx, W / 2 - (colRight + gap + half));
  const xl = W / 2 - tx, xr = W / 2 + tx;
  const bl = freeBand(placed(), xl - half, xl + half, H), br = freeBand(placed(), xr - half, xr + half, H);
  const bandTop = Math.max(bl.top, br.top) + gap, bandBottom = Math.min(bl.bottom, br.bottom) - gap;
  const h = Math.max(40 * u, Math.min(150 * u, bandBottom - bandTop - 22 * u));
  const cy = bandTop + 18 * u + h / 2;
  if (cockpit) { pitchLadder(g, s, W / 2, cy, u, h / u / 2); bankScale(g, s, W / 2, cy, 92 * u, u); } else pathMarker(g, game, W, H, u);
  const mass = 12500 + s.fuel + s.water;
  const clmax = 0.32 + s.flaps * 0.55 + 4.6 * (0.28 - s.flaps * 0.03);
  const vs = Math.sqrt((2 * mass * 9.81) / (1.2 * 128 * clmax)) * KT;
  tape(g, xl, cy, kt, u, { left: true, h: h / u, label: 'SPD', unit: 'KT', step: 10, color: s.stall ? C.red : C.green, trend: this.spdRate * 6,
    bands: [{ from: 0, to: vs, color: C.red, hatch: true }, { from: 60, to: 115, color: 'rgba(92,200,255,0.75)' }] });
  const groundFt = (s.position.y - s.agl - 1.75) * FT;
  tape(g, xr, cy, ft, u, { left: false, h: h / u, label: 'ALT', unit: 'FT', step: 100, color: s.agl < 30 && !s.onGround ? C.amber : C.green, trend: s.vs * FT * 6,
    bands: [{ from: -2000, to: groundFt, color: 'rgba(190,120,60,0.85)', hatch: true }] });
  rec('speed tape', xl - half, cy - h / 2 - 18 * u, half * 2, h + 22 * u);
  rec('altitude tape', xr - half, cy - h / 2 - 18 * u, half * 2, h + 22 * u);
  // Call-outs between the tapes; caution lights under the heading tape.
  const cy2 = cy + h / 2 - 12 * u;
  if (s.stall) flash(g, 'STALL · PUSH', W / 2, cy2, C.red, u, this.time);
  else if (s.scooping) flash(g, `SCOOPING · ${Math.round((100 * s.water) / s.waterMax)}%`, W / 2, cy2, C.blue, u, this.time, true);
  else if (game.dropWindow > 0 && s.water > 0) flash(g, `DROP NOW · ${keyName(game, 'drop')}`, W / 2, cy2, C.amber, u, this.time);
  if (s.turbulence > 0.2) flash(g, 'SMOKE · TURBULENCE', W / 2, cy2 - 26 * u, C.amber, u, this.time, true);
  autopilotCallout(g, game, W / 2, cy2 - 52 * u, u, this.time);
  waterCallout(g, game, W / 2, cy2 - 78 * u, u, this.time);
  alertsDraw(g, this, activeLights(s, game.plane.userData.parts), W / 2, top + 66 * uH, u);
  // Radio: in the free gap along the bottom between the stick and the buttons.
  const gp = bottomGap(placed(), W, H, H - 100 * u); // only what reaches into the bottom strip
  const rw = Math.min(gp.right - gp.left - gap * 2, 440 * u);
  if (rw > 150) {
    const rx = (gp.left + gp.right) / 2 - rw / 2, rb = H - Math.max(M, H - (thr ? thr.y + thr.h : H - M));
    const rh = radioBox(g, this, rx, rb, rw, u, dt);
    if (rh) rec('radio', rx, rb - rh, rw, rh);
  } else {
    const rw2 = Math.min(xr - xl - half * 2 - gap * 2, 420 * u);
    const rh = radioBox(g, this, W / 2 - rw2 / 2, cy + h / 2 - 30 * u, rw2, u, dt);
    if (rh) rec('radio', W / 2 - rw2 / 2, cy + h / 2 - 30 * u - rh, rw2, rh);
  }
  // Target label last, so it can step around everything placed above.
  const avoid = placed();
  objectiveMarker(g, game, W, H, u, this.time, avoid);
  if (avoid.length > rects.length + obstacles.length) rects.push(avoid[avoid.length - 1]);
  dropResultDraw(g, this, W / 2, H * 0.4, u, dt);
  toastsDraw(g, this, W, H, u, dt);
  bannerDraw(g, this, W, H, u, dt);
  this.rects = rects;
};

// On the lake: when to rotate, and a warning when the shore comes up (lighten the load by dropping).
function waterCallout(g, game, x, y, u, time) {
  const s = game.flight;
  if (game.state !== 'playing' || (game.autopilot && game.autopilot.active) || s.crashed) return;
  const low = s.onWater || (s.agl < 40 && terrainHeight(s.position.x, s.position.z) < 0);
  if (!low) return;
  let shore = false;
  for (let t = 2; t <= 7 && !shore; t += 1) shore = terrainHeight(s.position.x + s.velocity.x * t, s.position.z + s.velocity.z * t) > 0;
  const kt = s.airspeed * KT;
  if (shore) flash(g, s.water > s.waterMax * 0.5 ? 'SHORE AHEAD · PULL UP · DROP TO LIGHTEN' : 'SHORE AHEAD · PULL UP', x, y, C.red, u, time);
  else if (s.onWater && s.water > s.waterMax * 0.8) flash(g, kt >= 72 ? 'PULL UP · ROTATE' : 'FULL POWER · ROTATE AT 75 KT', x, y, C.amber, u, time, true);
}

// AUTO SCOOP status: the phase while it flies, a prompt when it could take the scoop.
function autopilotCallout(g, game, x, y, u, time) {
  const ap = game.autopilot;
  if (!ap) return;
  if (ap.active) flash(g, `AUTOPILOT · SCOOP · ${PHASE_LABEL[ap.phase] || ''}`, x, y, C.blue, u, time, true);
  else if (game.state === 'playing' && ap.available(game.flight)) flash(g, game.controls.isTouch ? 'AUTO SCOOP READY · TAP AUTO SCOOP' : 'AUTO SCOOP READY · PRESS K', x, y, C.blue, u, time);
}

function flash(g, text, x, y, color, u, time, steady = false) {
  if (!steady && Math.floor(time * 3) % 2) return;
  font(g, 700, 14 * u);
  const w = g.measureText(text).width + 26 * u;
  g.save();
  g.fillStyle = 'rgba(0,0,0,0.6)';
  g.strokeStyle = color; g.lineWidth = 1.4;
  g.beginPath(); g.roundRect(x - w / 2, y - 12 * u, w, 24 * u, 4 * u); g.fill(); g.stroke();
  g.restore();
  g.textAlign = 'center';
  glow(g, text, x, y + 1, color, 8);
}
