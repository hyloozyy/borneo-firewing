// FW-218 flight physics: thrust, lift with stall, drag, weight of the water load, banked turns,
// ground roll on the runway, water landing and scooping, touchdown and crash detection.
// Each engine gives its own thrust (see damage-model.js): one engine out yaws the aircraft.
import * as THREE from 'three';
import { terrainHeight, isOnRunway } from '../world/terrain.js';
import { clamp } from '../core/noise.js';
import { createDamage, engineOutput, landingDamage } from './damage-model.js';

const RHO = 1.2, WING_AREA = 128, G = 9.81;
const EMPTY_MASS = 12500, FUEL_MAX = 3200, WATER_MAX = 6000;
const MAX_THRUST = 58000; // two turboprops: a full water load still climbs ~1000 ft/min
export const GEAR_HEIGHT = 1.75; // keel below the origin (on the water, or a belly landing)
export { WHEEL_HEIGHT } from '../aircraft/fw218-gear.js';
import { WHEEL_HEIGHT } from '../aircraft/fw218-gear.js';

const _f = new THREE.Vector3(), _u = new THREE.Vector3(), _r = new THREE.Vector3();
const _v = new THREE.Vector3(), _force = new THREE.Vector3(), _tmp = new THREE.Vector3();
const _q = new THREE.Quaternion();

export function createFlightState() {
  return {
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    angular: new THREE.Vector3(), // body rates: pitch (x), yaw (y), roll (z)
    throttle: 0, rpm: 0, flaps: 0, flapTarget: 0,
    aileron: 0, elevator: 0, rudder: 0, doors: 0,
    fuel: FUEL_MAX, fuelMax: FUEL_MAX, water: 0, waterMax: WATER_MAX,
    engines: true, onGround: true, onWater: false, scooping: false, crashed: null,
    airspeed: 0, alpha: 0, stall: false, vs: 0, agl: 0, heading: 0, pitch: 0, roll: 0,
    lastTouchdown: null, turbulence: 0, brakes: false, gearDown: true,
    engRpm: [0, 0], gLoad: 1, damage: createDamage(),
  };
}

export function placeOnRunway(s, x, z, headingRad) {
  s.position.set(x, terrainHeight(x, z) + WHEEL_HEIGHT + 0.05, z); // standing on its wheels
  s.gearDown = true;
  s.quaternion.setFromEuler(new THREE.Euler(0.03, headingRad, 0, 'YXZ'));
  s.velocity.set(0, 0, 0);
  s.angular.set(0, 0, 0);
  s.onGround = true;
}

export function setFlying(s, pos, headingRad, speed, pitchRad = 0, rollRad = 0) {
  s.position.copy(pos);
  s.quaternion.setFromEuler(new THREE.Euler(pitchRad, headingRad, rollRad, 'YXZ'));
  s.velocity.set(0, 0, -speed).applyQuaternion(s.quaternion);
  s.onGround = false;
  s.gearDown = false;
  s.throttle = s.rpm = 0.7;
  s.engRpm[0] = s.engRpm[1] = 0.7;
}

function surfaceUnder(x, z) {
  const h = terrainHeight(x, z);
  return h < 0 ? { h: 0, water: true } : { h, water: false };
}

// input: { pitch, roll, yaw, throttleDelta, drop, flapsToggle, brakes } in -1..1
export function stepFlight(s, input, dt, env) {
  if (s.crashed) return;
  s.throttle = clamp(s.throttle + input.throttleDelta * dt * 0.6, 0, 1);
  if (s.fuel <= 0) { s.fuel = 0; s.engines = false; }
  const dmg = s.damage;
  const out = dmg.engines.map(engineOutput);
  const running = out.filter((o) => o > 0).length;
  const power = s.engines ? s.throttle : 0;
  s.rpm = (s.engRpm[0] + s.engRpm[1]) / 2;
  s.fuel = Math.max(0, s.fuel - (0.35 + power * 2.4) * (running / 2) * dt * env.fuelBurn);
  s.flaps += (s.flapTarget - s.flaps) * Math.min(1, dt * 0.8);
  s.brakes = input.brakes;

  const mass = EMPTY_MASS + s.fuel + s.water;
  _f.set(0, 0, -1).applyQuaternion(s.quaternion);
  _u.set(0, 1, 0).applyQuaternion(s.quaternion);
  _r.set(1, 0, 0).applyQuaternion(s.quaternion);

  // Air-relative velocity (wind) and angle of attack.
  _v.copy(s.velocity).sub(env.wind);
  const V = _v.length();
  s.airspeed = V;
  const vf = _v.dot(_f), vu = _v.dot(_u), vr = _v.dot(_r);
  const alpha = V > 2 ? Math.atan2(-vu, Math.max(0.1, vf)) : 0;
  s.alpha = alpha;
  const q = 0.5 * RHO * V * V;

  // Lift curve with flaps and a soft stall above ~16 degrees.
  const stallA = 0.28 - s.flaps * 0.03;
  let cl = 0.32 + s.flaps * 0.55 + 4.6 * alpha;
  s.stall = alpha > stallA && V > 5 && !s.onGround;
  if (alpha > stallA) cl = Math.max(0.2, (0.32 + s.flaps * 0.55 + 4.6 * stallA) - (alpha - stallA) * 6);
  if (alpha < -0.25) cl = Math.min(cl, -0.6);
  const dead = dmg.engines.filter((e) => e.failed).length * 0.012; // windmilling / feathered prop drag
  const cd = 0.034 + s.flaps * 0.05 + 0.045 * cl * cl + s.doors * 0.02 + (s.scooping ? 0.03 : 0) + (1 - dmg.structure) * 0.03 + dead;

  _force.set(0, 0, 0);
  _force.addScaledVector(_f, power * MAX_THRUST * ((out[0] + out[1]) / 2) * clamp(1.15 - V / 140, 0.35, 1.1));
  if (V > 1) {
    // Lift perpendicular to airflow in the body's symmetry plane.
    _tmp.copy(_v).normalize();
    const liftDir = _tmp.clone().cross(_r).normalize();
    if (liftDir.dot(_u) < 0) liftDir.negate();
    _force.addScaledVector(liftDir, q * WING_AREA * cl);
    s.liftRatio = (q * WING_AREA * cl) / (mass * G);
    _force.addScaledVector(_tmp, -q * WING_AREA * cd);
    // Side force keeps the aircraft from sliding.
    _force.addScaledVector(_r, -vr * Math.min(V, 60) * 220);
  }
  // Planing hull on the water: its drag is friction on the load the water still carries, so it fades
  // as the wings take the weight (the hull gets "on the step" and unsticks).
  if (s.onWater && V > 0.5) {
    const load = clamp(1 - (s.liftRatio || 0), 0, 1);
    _tmp.set(s.velocity.x, 0, s.velocity.z).normalize();
    _force.addScaledVector(_tmp, -mass * G * load * (V < 12 ? 0.12 : 0.065));
  }
  // Load factor felt by the crew: aerodynamic force along the aircraft's up axis.
  const g = _force.dot(_u) / (mass * G);
  s.gLoad += ((s.onGround ? 1 : g) - s.gLoad) * Math.min(1, dt * 8);
  _force.y -= mass * G;
  // Smoke turbulence
  if (s.turbulence > 0) {
    _force.x += (Math.random() - 0.5) * s.turbulence * mass * 6;
    _force.y += (Math.random() - 0.5) * s.turbulence * mass * 9;
  }

  // Control authority grows with dynamic pressure.
  const auth = clamp(q / 1600, 0.1, 1.2) * (0.6 + 0.4 * dmg.structure);
  s.aileron += (input.roll - s.aileron) * Math.min(1, dt * 6);
  s.elevator += (input.pitch - s.elevator) * Math.min(1, dt * 6);
  s.rudder += (input.yaw - s.rudder) * Math.min(1, dt * 5);
  const heavy = 1 - (s.water / WATER_MAX) * 0.3;
  // Asymmetric thrust: the live engine swings the nose toward the dead one (engine 1 is the left).
  const asym = (out[1] - out[0]) * power * 0.16;
  const targetPitch = s.elevator * 0.75 * auth * heavy;
  const targetRoll = -s.aileron * 1.45 * auth * heavy + asym * 0.6;
  const bank = Math.asin(clamp(_r.y, -1, 1));
  const targetYaw = s.rudder * -0.3 * auth + (s.onGround ? 0 : bank * 0.12 * auth) + asym;
  const k = Math.min(1, dt * 3.5);
  s.angular.x += (targetPitch - s.angular.x) * k;
  s.angular.y += (targetYaw - s.angular.y) * k;
  s.angular.z += (targetRoll - s.angular.z) * k;
  if (s.stall) { s.angular.x -= 0.6 * dt; s.angular.z += Math.sin(env.time * 3) * 0.4 * dt; }

  // Weathervane: nose follows the flight path (keeps pitch smooth at every speed).
  if (V > 15 && !s.onGround) {
    // Auto-trim: the weathervane settles at the angle of attack that holds level flight.
    const cl0 = 0.32 + s.flaps * 0.55;
    const alphaTrim = clamp(((mass * G) / Math.max(1, q * WING_AREA) - cl0) / 4.6, -0.05, 0.13);
    s.angular.x += (alphaTrim - alpha) * 1.2 * auth * dt * 3;
    s.angular.y += Math.atan2(vr, vf) * -1.5 * auth * dt * 3;
  }
  _q.setFromEuler(new THREE.Euler(s.angular.x * dt, s.angular.y * dt, s.angular.z * dt, 'XYZ'));
  s.quaternion.multiply(_q).normalize();

  s.velocity.addScaledVector(_force, dt / mass);
  s.position.addScaledVector(s.velocity, dt);

  contact(s, dt, input, env, _f);
  updateReadouts(s);
}

function contact(s, dt, input, env, fwd) {
  const surf = surfaceUnder(s.position.x, s.position.z);
  // On land the aircraft stands on its wheels (gear down); the hull meets the water.
  const H = !surf.water && s.gearDown ? WHEEL_HEIGHT : GEAR_HEIGHT;
  const bottom = s.position.y - H;
  s.agl = bottom - surf.h;
  s.onWater = false;
  s.scooping = false;
  if (s.agl > 0.05 || (s.agl > -0.3 && s.velocity.y > 0.2)) { if (s.onGround) s.onGround = false; return; }

  const vs = s.velocity.y;
  const e = new THREE.Euler().setFromQuaternion(s.quaternion, 'YXZ');
  const speed = s.velocity.length();
  const wasAir = !s.onGround;
  const runway = isOnRunway(s.position.x, s.position.z, 4);
  if (surf.water) {
    if (s.gearDown) { s.gearDown = false; s.damage.gear = Math.max(0, s.damage.gear - 0.25); s.damage.events.push({ text: 'GEAR DOWN ON THE WATER · GEAR RETRACTED, GEAR DAMAGED', level: 'warning' }); }
    // Hull on the water: gentle enough is a landing / scoop, too hard is a crash.
    if (vs < -9 || Math.abs(e.z) > 0.45 || e.x < -0.25 || speed > 85) { s.crashed = speed > 85 ? 'Hull broke up: far too fast on the water' : vs < -9 ? 'Hit the water too hard' : 'Wingtip or nose dug into the water'; return; }
    if (vs < -3.5 || speed > 66) {
      // Too steep or too fast: the hull skips off the water.
      s.velocity.y = Math.abs(vs) * 0.45 + 1;
      s.position.y = surf.h + GEAR_HEIGHT;
      s.bounce = (s.bounce || 0) + 1;
      s.lastTouchdown = { vs, speed, water: true, time: env.time, bounce: true };
      return;
    }
    s.onWater = true;
    s.waterRun = true;
    s.position.y = Math.max(s.position.y, surf.h + GEAR_HEIGHT - 0.25);
    // The hull clings to the water unless the pilot rotates at flying speed: then it unsticks.
    const unstick = speed > 31 && (s.elevator > 0.12 || ((s.liftRatio || 0) > 1.02 && s.elevator > -0.05));
    // The hull rides at its planing attitude: the water will not let the nose dig in or a wing drop,
    // and with the stick neutral the nose settles a few degrees up.
    const att = new THREE.Euler(Math.max(-0.02, Math.min(0.22, e.x)), e.y, e.z * (1 - Math.min(1, dt * 2)), 'YXZ');
    if (!unstick && s.elevator < 0.1) att.x += (0.05 - att.x) * Math.min(1, dt * 1.5);
    s.quaternion.setFromEuler(att);
    if (s.angular.x < 0) s.angular.x *= 0.5;
    s.angular.z *= 0.5;
    s.velocity.y = Math.max(0, s.velocity.y) * (unstick ? 1 : 0.3);
    if (unstick) s.position.y += 0.6 * dt;
    if (wasAir) s.lastTouchdown = { vs, speed, water: true, time: env.time, g: 1 + Math.abs(vs) * 0.3 };
    s.onGround = true;
    // Scoop when skimming between 30 and 60 m/s with the probes down.
    if (speed > 28 && speed < 62 && s.water < s.waterMax) {
      s.scooping = true;
      s.water = Math.min(s.waterMax, s.water + 520 * dt);
    }
  } else {
    if (!runway && speed > 8) { s.crashed = wasAir ? (vs < -6 ? 'Dived into the forest' : 'Flew into the forest canopy') : s.waterRun ? 'Ran out of lake: the hull hit the shore' : 'Ran off the runway into the trees'; return; }
    s.waterRun = false;
    const limit = -4.5 * (0.5 + 0.5 * s.damage.gear);
    if (vs < limit || Math.abs(e.z) > 0.3 || e.x < -0.15) { s.crashed = vs < limit ? 'Touchdown far too hard: the landing gear collapsed' : 'A wingtip or the nose struck the runway'; return; }
    if (wasAir) {
      s.lastTouchdown = { vs, speed, water: false, time: env.time, x: s.position.x, z: s.position.z, g: 1 + Math.abs(vs) * 0.42, bank: e.z, pitch: e.x };
      landingDamage(s, s.damage, vs, env.time);
    }
    if (wasAir && !s.gearDown) s.damage.events.push({ text: 'BELLY LANDING · GEAR WAS UP', level: 'warning' });
    s.onGround = true;
    s.position.y = Math.max(s.position.y, surf.h + H);
    s.velocity.y = Math.max(0, s.velocity.y);
    // Rolling friction and brakes; steer the nose wheel with the rudder/roll.
    _tmp.copy(fwd).setY(0).normalize();
    const along = s.velocity.x * _tmp.x + s.velocity.z * _tmp.z;
    const fr = (s.brakes ? 0.9 : 0.25) * dt;
    const newAlong = Math.sign(along) * Math.max(0, Math.abs(along) - fr * 9.81 * 0.4 * (s.brakes ? 1 : 0.4));
    s.velocity.set(_tmp.x * newAlong, s.velocity.y, _tmp.z * newAlong);
    // Keep wings level and nose from digging in on the ground.
    const lvl = new THREE.Euler(Math.max(e.x, -0.02), e.y + (-(s.rudder + s.aileron * 0.5)) * dt * 0.5 * Math.min(1, speed / 10), 0, 'YXZ');
    // Tail-strike limit, and the nose settles back on the wheels without back pressure.
    lvl.x = Math.min(lvl.x, 0.2);
    if (s.elevator < 0.1) lvl.x += (0.03 - lvl.x) * Math.min(1, dt * 1.5);
    if (speed < 25) lvl.x = Math.max(0, Math.min(lvl.x, 0.05));
    s.quaternion.setFromEuler(lvl);
  }
}

function updateReadouts(s) {
  const e = new THREE.Euler().setFromQuaternion(s.quaternion, 'YXZ');
  s.pitch = e.x;
  s.roll = e.z;
  s.heading = ((-e.y * 180) / Math.PI + 360) % 360;
  s.vs = s.velocity.y;
}

export const LIMITS = { EMPTY_MASS, FUEL_MAX, WATER_MAX };
