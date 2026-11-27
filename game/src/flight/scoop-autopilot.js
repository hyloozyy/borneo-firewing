// AUTO SCOOP: an autopilot for the scoop only. Engaged near the lake (K or the AUTO SCOOP button),
// it flies a guided path: heading, climb/sink rate and speed are commanded directly with realistic
// limits (turn rate, banking with the turn, climb and sink rates, acceleration), so the pattern always
// converges whatever the engage point:
//   TO THE LAKE   intercept the lake's long axis (from far away it simply flies there first)
//   OUTBOUND      too close or past the gate: fly out on a parallel leg, then a procedure turn
//   FINAL         established on the line, just above the canopy to the shore
//   DESCENT       down to the water past the shore
//   SKIMMING      hull on the water at scoop speed until the tank is full
//   CLIMB-OUT     up over the far bank and its trees, then "YOU HAVE CONTROL"
// If it is not lined up at the shore it goes round. Any firm stick input hands control back.
import * as THREE from 'three';
import { PLACES, terrainHeight } from '../world/terrain.js';
import { GEAR_HEIGHT } from './flight-model.js';

const KEY = 'fw-autoscoop';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (d) => (((d % 360) + 540) % 360) - 180;
const RAD = Math.PI / 180;
const CANOPY = 42; // rainforest height over dry land
const GATE = 900; // final approach starts this far before the shore
const SCOOP_RATE = 520; // litres per second on the water (as the flight model)
const _e = new THREE.Euler();

export function loadAutoScoop(phone) {
  try { const v = localStorage.getItem(KEY); if (v === 'on' || v === 'off') return v === 'on'; } catch (e) { /* private mode */ }
  return phone; // on by default on phones
}
export function saveAutoScoop(on) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) { /* private mode */ }
}

export const PHASE_LABEL = { inbound: 'TO THE LAKE', outbound: 'OUTBOUND', final: 'FINAL', descent: 'DESCENT', skim: 'SKIMMING', climb: 'CLIMB-OUT' };

// Where the water is along the lake's long (east-west) axis.
let lakeLine = null;
function lake() {
  if (lakeLine) return lakeLine;
  const L = PLACES.lake, z = L.z;
  let x0 = L.x, x1 = L.x;
  while (terrainHeight(x0 - 10, z) < -1) x0 -= 10;
  while (terrainHeight(x1 + 10, z) < -1) x1 += 10;
  lakeLine = { z, west: x0, east: x1, cx: L.x };
  return lakeLine;
}

export class ScoopAutopilot {
  constructor(enabled) {
    this.enabled = enabled;
    this.active = false;
    this.phase = null;
    this.message = null; // { text, color } for the HUD, consumed by the game
    this.target = null; // next point of the planned path, for the HUD marker
  }

  available(s) {
    if (!this.enabled || this.active || s.crashed || s.onGround || s.water >= s.waterMax * 0.9) return false;
    const k = lake();
    const dx = s.position.x < k.west ? k.west - s.position.x : s.position.x > k.east ? s.position.x - k.east : 0;
    return Math.hypot(dx, s.position.z - k.z) < 4500 && s.position.y < 1200 && s.airspeed > 25;
  }

  // Run geometry for a direction: along = metres past the entry shore, off = metres off the line.
  frame(dir, p) {
    const k = lake();
    const entry = dir > 0 ? k.west : k.east;
    return { along: (p.x - entry) * dir, off: p.z - k.z, length: k.east - k.west, track: dir > 0 ? 90 : 270, entry };
  }

  engage(s) {
    // Pick the run direction that is quicker from here.
    let best = null;
    for (const dir of [1, -1]) {
      const f = this.frame(dir, s.position);
      const before = f.along < -GATE * 0.7;
      const turn = Math.abs(wrap(f.track - s.heading));
      const cost = before ? Math.hypot(f.along + GATE, f.off) + turn * 6 : (f.along + GATE) * 2 + 1800;
      if (!best || cost < best.cost) best = { dir, cost, before };
    }
    this.dir = best.dir;
    this.phase = best.before ? 'inbound' : 'outbound';
    this.side = Math.sign(this.frame(this.dir, s.position).off) || 1;
    this.time = 0;
    this.active = true;
    this.turnRate = 0;
    this.speed = s.airspeed;
    this.hdg = s.heading;
    this.vs = s.velocity.y;
    this.bank = 0;
    this.touched = false;
    s.gearDown = false; // never on the water with the wheels down
    this.message = { text: 'AUTOPILOT: SCOOP', color: '#7fd0ff' };
  }

  disengage(text = 'YOU HAVE CONTROL', s = null) {
    if (s) {
      // Hand back a clean, flying aircraft.
      s.velocity.set(Math.sin(this.hdg * RAD), 0, -Math.cos(this.hdg * RAD)).multiplyScalar(Math.max(this.speed, 45));
      s.velocity.y = Math.min(this.vs, 2);
      s.angular.set(0, 0, 0);
      s.onGround = false; s.onWater = false; s.scooping = false;
      s.throttle = 0.8;
      if (s.agl > 60) s.flapTarget = 0;
    }
    this.active = false;
    this.phase = null;
    this.target = null;
    this.message = { text, color: '#9dffb0' };
  }

  // The pilot keeps the stick: a firm input cancels the autopilot.
  control(s, player) {
    if (this.active && (Math.abs(player.pitch) > 0.45 || Math.abs(player.roll) > 0.45)) this.disengage('AUTOPILOT OFF · YOU HAVE CONTROL', s);
    return player;
  }

  // Highest obstacle (terrain + canopy over land) along the path for the next `secs` seconds.
  clearance(p, secs, step = 1.5) {
    let h = 0;
    const vx = Math.sin(this.hdg * RAD) * this.speed, vz = -Math.cos(this.hdg * RAD) * this.speed;
    for (let t = 0; t <= secs; t += step) {
      const g = terrainHeight(p.x + vx * t, p.z + vz * t);
      h = Math.max(h, g > 0.5 ? g + CANOPY : 0);
    }
    return h;
  }

  // Fly one step along the guided path (replaces the flight model while engaged).
  fly(s, dt) {
    if (!this.active) return;
    this.time += dt;
    const p = s.position, dir = this.dir;
    const f = this.frame(dir, p);
    const k = lake();
    let speed = 62, alt = 140, hdg = f.track, maxTurn = 10, sinkMax = 8, climbMax = 8, flaps = 0;
    const intercept = (track, off, gain, cap) => (track + 360 - Math.sign(Math.sin(track * RAD)) * clamp(off * gain, -cap, cap)) % 360;
    const lined = Math.abs(f.off) < 45 && Math.abs(wrap(f.track - this.hdg)) < 7;
    const shoreY = (dir > 0 ? k.west : k.east);
    this.target = { x: shoreY - dir * GATE, y: 120, z: k.z };
    if (this.phase === 'outbound') {
      // Parallel leg, one turn diameter to the side, out past the gate; then turn back in.
      hdg = intercept((f.track + 180) % 360, f.off - this.side * 900, 0.1, 75);
      alt = Math.max(150, this.clearance(p, 14) + 60);
      this.target = { x: shoreY - dir * (GATE + 400), y: alt, z: k.z + this.side * 900 };
      if (f.along < -GATE - 350) this.phase = 'inbound';
    } else if (this.phase === 'inbound') {
      hdg = intercept(f.track, f.off, 0.12, 80);
      alt = Math.max(140, this.clearance(p, 14) + 60);
      if (lined && f.along > -GATE - 600) this.phase = 'final';
      else if (f.along > -450) { this.phase = 'outbound'; this.side = Math.sign(f.off) || 1; this.message = { text: 'AUTOPILOT: GOING ROUND', color: '#7fd0ff' }; }
    } else if (this.phase === 'final') {
      hdg = intercept(f.track, f.off, 0.12, 30);
      speed = 50; flaps = 0.5; sinkMax = 12;
      alt = Math.max(this.clearance(p, 10) + 14, 30);
      this.target = { x: shoreY + dir * 200, y: 2, z: k.z };
      if (f.along > 0) this.phase = Math.abs(f.off) < 80 ? 'descent' : 'climb';
    } else if (this.phase === 'descent') {
      hdg = intercept(f.track, f.off, 0.08, 8);
      speed = 42; flaps = 0.5; sinkMax = 12;
      alt = GEAR_HEIGHT - 0.6; // aim just below the surface: the hull settles on in a second
      this.target = { x: p.x + dir * 400, y: 0, z: k.z };
      if (p.y <= GEAR_HEIGHT + 0.3) this.phase = 'skim';
      if (f.along > f.length - this.climbRoom(s)) this.phase = 'climb';
    } else if (this.phase === 'skim') {
      hdg = intercept(f.track, f.off, 0.06, 4);
      speed = 40; flaps = 0.5; maxTurn = 2;
      alt = GEAR_HEIGHT - 0.6;
      this.target = { x: p.x + dir * 400, y: 0, z: k.z };
      if (s.water >= s.waterMax || f.along > f.length - this.climbRoom(s)) this.phase = 'climb';
    } else if (this.phase === 'climb') {
      hdg = f.track;
      speed = 52; flaps = 0.5; climbMax = 12;
      alt = this.clearance(p, 16) + 80;
      this.target = { x: p.x + dir * 800, y: alt, z: k.z };
      if (s.agl > 30) flaps = 0;
      if (p.y > this.clearance(p, 4) + 60 && f.along > f.length - 50) {
        if (s.water >= s.waterMax * 0.97) { this.disengage('TANK FULL · YOU HAVE CONTROL', s); return; }
        this.phase = 'outbound'; this.side = Math.sign(f.off) || 1;
        this.message = { text: `AUTOPILOT: ANOTHER PASS · TANK ${Math.round((100 * s.water) / s.waterMax)}%`, color: '#7fd0ff' };
      }
    }
    if (this.time > 300) { this.disengage('AUTOPILOT OFF · YOU HAVE CONTROL', s); return; }
    this.integrate(s, dt, { hdg, alt, speed, maxTurn, sinkMax, climbMax, flaps });
  }

  // Water left needed to climb over the far bank and its trees with a full-power climb.
  climbRoom(s) {
    const k = lake();
    const far = this.dir > 0 ? k.east : k.west;
    let h = 0;
    for (let d = 0; d <= 700; d += 50) { const g = terrainHeight(far + this.dir * d, k.z); h = Math.max(h, g > 0.5 ? g + CANOPY : 0); }
    return ((h + 12) / 12 + 1.6) * this.speed + 40;
  }

  integrate(s, dt, c) {
    // Turn: rate toward the wanted heading, limited and smoothed; the wings bank with the turn.
    const want = clamp(wrap(c.hdg - this.hdg) * 0.8, -c.maxTurn, c.maxTurn);
    this.turnRate += clamp(want - this.turnRate, -10 * dt, 10 * dt);
    this.hdg = (this.hdg + this.turnRate * dt + 360) % 360;
    // Speed and vertical speed with limited acceleration.
    this.speed += clamp(c.speed - this.speed, -3 * dt, 3 * dt);
    const vsWant = clamp((c.alt - s.position.y) * 0.5, -c.sinkMax, c.climbMax);
    this.vs += clamp(vsWant - this.vs, -6 * dt, 8 * dt);
    const v = this.speed, vh = Math.sqrt(Math.max(1, v * v - this.vs * this.vs));
    s.velocity.set(Math.sin(this.hdg * RAD) * vh, this.vs, -Math.cos(this.hdg * RAD) * vh);
    s.position.addScaledVector(s.velocity, dt);
    // On the water: the hull rides the surface and the probes scoop.
    const ground = terrainHeight(s.position.x, s.position.z);
    const overWater = ground < 0;
    s.onWater = false; s.scooping = false; s.onGround = false;
    if (overWater && s.position.y <= GEAR_HEIGHT) {
      s.position.y = GEAR_HEIGHT - 0.05;
      if (this.vs < 0) this.vs = 0;
      s.velocity.y = 0;
      s.onWater = true; s.onGround = true;
      if (!this.touched) { this.touched = true; s.lastTouchdown = { vs: -0.4, speed: v, water: true, time: this.time, g: 1.1 }; }
      if (v > 28 && v < 62 && s.water < s.waterMax) { s.scooping = true; s.water = Math.min(s.waterMax, s.water + SCOOP_RATE * dt); }
    }
    this.bank = Math.atan((v * this.turnRate * RAD) / 9.81);
    const pitch = Math.asin(clamp(this.vs / v, -0.5, 0.5)) + 0.05;
    s.quaternion.setFromEuler(_e.set(pitch, -this.hdg * RAD, -this.bank, 'YXZ')); // right turn = right wing down
    // Readouts and systems the rest of the game uses.
    s.flapTarget = c.flaps;
    s.flaps += clamp(c.flaps - s.flaps, -0.5 * dt, 0.5 * dt);
    s.throttle = clamp(0.45 + (c.speed - v) * 0.1 + this.vs * 0.04, 0.2, 1);
    s.rpm += (s.throttle - s.rpm) * Math.min(1, dt * 2);
    s.engRpm[0] = s.engRpm[1] = s.rpm;
    s.fuel = Math.max(0, s.fuel - (0.35 + s.throttle * 2.4) * dt * 1.6);
    s.airspeed = v; s.vs = this.vs; s.heading = this.hdg; s.pitch = pitch; s.roll = -this.bank;
    s.agl = s.position.y - GEAR_HEIGHT - Math.max(0, ground);
    s.alpha = 0.05; s.stall = false;
  }
}

