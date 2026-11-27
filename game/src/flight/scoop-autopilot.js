// AUTO SCOOP: an autopilot for the scoop only. Near the lake (tank not full) the pilot engages it
// (K or the SCOOP button); it lines up along the lake's long axis, descends on a shallow glide
// with flaps 1, skims at scoop speed until the tank is full or the water runs out, climbs out to a
// safe height and hands control back. Any firm stick input cancels it. Everything else stays manual.
import { PLACES, terrainHeight } from '../world/terrain.js';

const KEY = 'fw-autoscoop';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function loadAutoScoop(phone) {
  try { const v = localStorage.getItem(KEY); if (v === 'on' || v === 'off') return v === 'on'; } catch (e) { /* private mode */ }
  return phone; // on by default on phones
}
export function saveAutoScoop(on) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) { /* private mode */ }
}

export const PHASE_LABEL = { position: 'LINING UP', approach: 'APPROACH', skim: 'SKIMMING', climb: 'CLIMB-OUT' };

export class ScoopAutopilot {
  constructor(enabled) {
    this.enabled = enabled;
    this.active = false;
    this.phase = null;
    this.message = null; // { text, color } for the HUD, consumed by the caller
  }

  // The lake's long axis runs east-west; the run is along it.
  geometry() {
    const L = PLACES.lake;
    return { cx: L.x, cz: L.z, rx: L.r / 0.85 };
  }

  available(s) {
    if (!this.enabled || this.active || s.crashed || s.onGround || s.water >= s.waterMax * 0.9) return false;
    const { cx, cz, rx } = this.geometry();
    const d = Math.hypot((s.position.x - cx) / rx, (s.position.z - cz) / PLACES.lake.r);
    return d < 3.2 && s.position.y < 800 && s.airspeed > 28;
  }

  engage(s) {
    const { cx, rx } = this.geometry();
    // Run toward the lake from the side the aircraft is on; over the lake, the way it points.
    const hx = Math.sin((s.heading * Math.PI) / 180);
    this.dir = Math.abs(s.position.x - cx) > rx * 0.9 ? Math.sign(cx - s.position.x) : Math.sign(hx) || 1;
    this.phase = 'position';
    s.gearDown = false; // never on the water with the wheels down
    this.outbound = false; // decided on the first control step
    this.time = 0;
    this.active = true;
    this.message = { text: 'AUTOPILOT: SCOOP', color: '#7fd0ff' };
  }

  disengage(text = 'YOU HAVE CONTROL') {
    this.active = false;
    this.phase = null;
    this.message = { text, color: '#9dffb0' };
  }

  // Replace the pilot's input while engaged. Returns the input to fly with.
  // Lateral guidance flies a heading: the run's track, turned toward the run line by an intercept
  // angle that grows with the distance off the line (capped at 60 degrees).
  control(s, player, dt) {
    if (!this.active) return player;
    this.time += dt;
    if (Math.abs(player.pitch) > 0.45 || Math.abs(player.roll) > 0.45) { this.disengage('AUTOPILOT OFF · YOU HAVE CONTROL'); return player; }
    if (s.crashed || this.time > 600) { this.disengage(); return player; }
    const { cx, cz, rx } = this.geometry();
    const p = s.position, dir = this.dir;
    const along = (p.x - cx) * dir; // metres along the run, 0 at the lake centre
    const entry = -rx * 0.3, exit = rx * 0.88, gate = entry - 2300; // aim to touch down well inside the shore
    const off = p.z - cz; // metres off the run line (south positive)
    const track = dir > 0 ? 90 : 270;
    const intercept = (t, k = 0.09, o = off) => (t + 360 - Math.sign(Math.sin((t * Math.PI) / 180)) * clamp(o * k, -60, 60)) % 360;
    const glide = (a) => 1.9 + Math.max(0, entry - a) * 0.065; // ~3.7 degree path to touch down at the entry
    // Ground ahead, with the rainforest canopy (~40 m) on top of dry land.
    const ground = (t) => { const h = terrainHeight(p.x + s.velocity.x * t, p.z + s.velocity.z * t); return h > 0.5 ? h + 42 : h; };
    const terrainAhead = Math.max(ground(0), ground(3), ground(6), ground(10));
    let spd = 50, vs = 0, hdg = intercept(track), bank = 0.45, flaps = s.flapTarget, pull = false;
    if (this.phase === 'position') {
      // Too close or too high for this run: fly the reciprocal track out to the gate, then turn back.
      // Procedure turn: the outbound leg runs parallel to the run line, one turn diameter to the
      // side, so the turn back at the gate rolls out on the line.
      if (this.outbound) {
        hdg = intercept((track + 180) % 360, 0.06, off - this.side * 1100);
        if (along < gate) this.outbound = false;
      }
      const alt = Math.max(this.outbound ? glide(gate) : Math.min(glide(along), glide(gate)), terrainAhead + 60);
      vs = clamp((alt - p.y) * 0.25, -6, 6);
      const err = this.wrap(track - s.heading);
      if (!this.outbound && along <= entry - 400 && Math.abs(off) < 160 && Math.abs(err) < 22 && Math.abs(p.y - glide(along)) < 40) this.phase = 'approach';
      else if (!this.outbound && along > entry - 700) this.goOut(off);
    } else if (this.phase === 'approach') {
      // Down the glide path to touch the water just past the shore; flaps 1, slowing to scoop speed.
      // Over the trees until the shore, then down to the water (steeply: the banks are high).
      const alt = Math.max(Math.min(glide(along), 60), terrainAhead + (terrainAhead > 1 ? 8 : 0));
      vs = clamp((alt - p.y) * 0.4, terrainHeight(p.x, p.z) < 0 ? -11 : -5.5, 3);
      spd = along > entry - 900 ? 42 : 50;
      flaps = terrainHeight(p.x, p.z) < 0 && p.y > 15 ? 1 : 0.5; // full flaps for the steep drop to the water
      if (p.y < 25) bank = 0.12;
      if (p.y < 12 && terrainHeight(p.x, p.z) < -1 && terrainHeight(p.x + s.velocity.x * 9, p.z + s.velocity.z * 9) < -1) this.phase = 'skim';
      else if (p.y >= 12 && terrainHeight(p.x + s.velocity.x * 9, p.z + s.velocity.z * 9) > -1 && terrainHeight(p.x, p.z) < -1) { this.phase = 'position'; this.goOut(off); this.message = { text: 'AUTOPILOT: GOING ROUND', color: '#7fd0ff' }; }
    } else if (this.phase === 'skim') {
      vs = s.onWater ? -0.3 : clamp((1.6 - p.y) * 0.9, -5, -0.8); // settle onto the water, then keep the hull on it
      spd = 46; flaps = 0.5; bank = 0.06;
      // Climb out with room to clear the far bank and its trees (a full tank climbs slower: leave more).
      const lead = 7.5 + 6 * (s.water / s.waterMax);
      if (s.water >= s.waterMax * 0.98 || along > exit || terrainHeight(p.x + s.velocity.x * lead, p.z + s.velocity.z * lead) > -1) this.phase = 'climb';
    } else if (this.phase === 'climb') {
      vs = 10; spd = 62; pull = true; // full power flaps = 0.5; bank = s.agl < 40 ? 0.08 : 0.3;
      if (s.agl > 60) flaps = 0;
      if (s.agl > 110 && !s.onWater) {
        if (s.water < s.waterMax * 0.85) { this.phase = 'position'; this.goOut(off); this.message = { text: `AUTOPILOT: ANOTHER PASS · TANK ${Math.round((100 * s.water) / s.waterMax)}%`, color: '#7fd0ff' }; }
        else { s.flapTarget = 0; this.disengage(); return { ...player, pitch: 0, roll: 0 }; }
      }
    }
    s.flapTarget = flaps;
    const err = this.wrap(hdg - s.heading);
    const wantRoll = -clamp(err * 0.04, -bank, bank);
    // Pitch = the flight-path angle for the wanted climb/sink rate + trim + a correction on the error.
    const gamma = Math.asin(clamp(vs / Math.max(s.airspeed, 20), -0.5, 0.5));
    const wantPitch = clamp(gamma + 0.04 + (vs - s.vs) * 0.03, -0.32, 0.32);
    const out = {
      ...player,
      pitch: clamp(4 * (wantPitch - s.pitch), -1, 1),
      roll: clamp(2.5 * (s.roll - wantRoll), -1, 1),
      yaw: 0,
      throttleDelta: 0,
      throttleSet: clamp(0.55 + (spd - s.airspeed) * 0.08 + vs * 0.05, 0.05, 1),
      drop: false,
    };
    if (pull && (s.onWater || s.agl < 3)) out.pitch = 0.7;
    return out;
  }

  goOut(off) { this.outbound = true; this.side = off >= 0 ? 1 : -1; }

  wrap(d) { return (((d % 360) + 540) % 360) - 180; }

}
