// Head-up display on a 2D canvas: lays out the flight symbology (hud-flight), radar (hud-radar),
// systems panels (hud-systems) and messages (hud-messages) on one margin grid, desktop and phone.
import { C, font, glow } from './hud-style.js';
import { tape, headingTape, bankScale, pitchLadder, pathMarker } from './hud-flight.js';
import { radar } from './hud-radar.js';
import { statusStrip, systemsPanel, readouts, gMeter } from './hud-systems.js';
import { radioBox, bannerDraw, toastsDraw, alertsDraw, dropResultDraw, objectiveMarker, missionPanel } from './hud-messages.js';
import { activeLights } from '../flight/annunciators.js';

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
    const M = 14 * u;
    g.lineWidth = 1.5;
    g.textBaseline = 'middle';

    const kt = s.airspeed * KT;
    const ft = s.position.y * FT;
    if (dt > 0) {
      if (this.prevKt != null) this.spdRate += ((kt - this.prevKt) / dt - this.spdRate) * Math.min(1, dt * 2);
      this.prevKt = kt;
    }
    // In the cockpit the symbology is projected into the windscreen above the glareshield;
    // the panel itself carries the engine, fuel and map displays.
    const cockpit = game.cameraMode === 'cockpit';
    const cy = cockpit ? H * 0.27 : H * 0.48;
    const tapeH = cockpit ? Math.min(150, (H * 0.36) / u) : 210;
    if (cockpit) {
      pitchLadder(g, s, W / 2, cy, u, tapeH / 2);
      bankScale(g, s, W / 2, cy, 92 * u, u);
    } else pathMarker(g, game, W, H, u);

    // Speed and altitude tapes with their readouts.
    const tx = cockpit ? Math.min(W * 0.2, 300 * u) : Math.min(W * (compact ? 0.3 : 0.27), 430 * u);
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
    if (!cockpit) readouts(g, W / 2 - tx, below, [
      ['THR', `${Math.round(s.throttle * 100)}%`],
      ['FLAPS', ['UP', '1', 'FULL'][Math.round(s.flapTarget * 2)]],
      ['GEAR', gear > 0.95 ? 'DOWN' : gear < 0.05 ? 'UP' : 'TRANS', gear > 0.95 ? C.green : gear < 0.05 ? C.white : C.amber],
    ], u);
    const fpm = Math.round(s.vs * 196.85);
    if (cockpit) {
      readouts(g, W / 2 + tx + 96 * u, cy - 26 * u, [['VS', `${fpm >= 0 ? '+' : ''}${fpm}`, fpm < -1000 ? C.amber : C.green], ['RA', `${Math.max(0, Math.round(s.agl * FT))}`, s.agl < 30 && !s.onGround ? C.amber : C.green]], u);
      readouts(g, W / 2 - tx - 96 * u, cy - 26 * u, [['THR', `${Math.round(s.throttle * 100)}%`], ['G', s.gLoad.toFixed(1), s.gLoad > 3.2 ? C.red : C.green]], u);
    } else readouts(g, W / 2 + tx, below, [
      ['VS', `${fpm >= 0 ? '+' : ''}${fpm}`, fpm < -1000 ? C.amber : C.green],
      ['RA', `${Math.max(0, Math.round(s.agl * FT))}`, s.agl < 30 && !s.onGround ? C.amber : C.green],
      ['AOA', `${(s.alpha * 57.3).toFixed(1)}°`, s.stall ? C.red : C.green],
    ], u);
    if (!compact && !cockpit) gMeter(g, W / 2 - tx - 66 * u, cy + 78 * u, 20 * u, s.gLoad, s.damage.maxG, u);

    const bug = game.objective ? (Math.atan2(game.objective.pos.x - s.position.x, -(game.objective.pos.z - s.position.z)) * 180) / Math.PI : null;
    headingTape(g, W / 2, M + 2 * u, s.heading, u, bug == null ? null : (bug + 360) % 360, game.wind);

    // Centre call-outs
    const cy2 = cockpit ? cy + (tapeH / 2 - 14) * u : cy + 76 * u;
    if (s.stall) flash(g, 'STALL · PUSH', W / 2, cy2, C.red, u, this.time);
    else if (s.scooping) flash(g, `SCOOPING · ${Math.round((100 * s.water) / s.waterMax)}%`, W / 2, cy2, C.blue, u, this.time, true);
    else if (game.dropWindow > 0 && s.water > 0) flash(g, 'DROP NOW · SPACE', W / 2, cy2, C.amber, u, this.time);
    if (s.turbulence > 0.2) flash(g, 'SMOKE · TURBULENCE', W / 2, cy2 + 26 * u, C.amber, u, this.time, true);

    const lights = activeLights(s, game.plane.userData.parts);
    alertsDraw(g, this, lights, W / 2, M + 64 * u, u);

    // Corners
    const status = statusStrip(g, game, M, M, u);
    const mw = 290 * u;
    const mh = missionPanel(g, game, this, W - M - mw, M, mw, u);
    const sw = 236 * u;
    let radarR = (compact ? 50 : 72) * u;
    if (cockpit) {
      radarR = 0;
    } else if (compact) {
      radar(g, game, M + 6 * u + radarR, status.bottom + 14 * u + radarR, radarR, u, this.time);
      systemsPanel(g, game, W - M - sw, M + mh + 8 * u, sw, u);
    } else {
      radar(g, game, M + 6 * u + radarR, H - M - 6 * u - radarR, radarR, u, this.time);
      systemsPanel(g, game, W - M - sw, H - M - 128 * u, sw, u);
    }
    objectiveMarker(g, game, W, H, u, this.time);
    const side = compact ? Math.min(280, W * 0.3) : radarR * 2 + M * 3 + 12 * u;
    const rw = Math.min(W - side * 2, 560 * u);
    radioBox(g, this, W / 2 - rw / 2, H - M, rw, u, dt);
    dropResultDraw(g, this, W / 2, H * 0.4, u, dt);
    toastsDraw(g, this, W, H, u, dt);
    bannerDraw(g, this, W, H, u, dt);
    g.globalAlpha = 1;
  }
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
