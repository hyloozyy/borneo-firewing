// FW-218 flight physics: thrust, lift with stall, drag, weight of the water load, banked turns,
// ground roll on the runway, water landing and scooping, touchdown and crash detection.
import * as THREE from 'three';
import { terrainHeight, isOnRunway } from '../world/terrain.js';
import { clamp } from '../core/noise.js';

const RHO = 1.2, WING_AREA = 100, G = 9.81;
const EMPTY_MASS = 12500, FUEL_MAX = 4000, WATER_MAX = 6000;
const MAX_THRUST = 52000;
export const GEAR_HEIGHT = 1.75; // keel / wheels below the origin

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
    lastTouchdown: null, turbulence: 0, brakes: false,
  };
}

export function placeOnRunway(s, x, z, headingRad) {
  s.position.set(x, terrainHeight(x, z) + GEAR_HEIGHT + 0.15, z);
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
  s.throttle = s.rpm = 0.7;
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
  const power = s.engines ? s.throttle : 0;
  s.rpm += ((s.engines ? 0.25 + power * 0.75 : 0) - s.rpm) * Math.min(1, dt * 1.5);
  s.fuel = Math.max(0, s.fuel - (0.35 + power * 2.4) * dt * env.fuelBurn);
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
  const cd = 0.034 + s.flaps * 0.05 + 0.045 * cl * cl + s.doors * 0.02 + (s.onWater ? 0.25 : 0);

  _force.set(0, -mass * G, 0);
  _force.addScaledVector(_f, power * MAX_THRUST * clamp(1.15 - V / 140, 0.35, 1.1));
  if (V > 1) {
    // Lift perpendicular to airflow in the body's symmetry plane.
    _tmp.copy(_v).normalize();
    const liftDir = _tmp.clone().cross(_r).normalize();
    if (liftDir.dot(_u) < 0) liftDir.negate();
    _force.addScaledVector(liftDir, q * WING_AREA * cl);
    _force.addScaledVector(_tmp, -q * WING_AREA * cd);
    // Side force keeps the aircraft from sliding.
    _force.addScaledVector(_r, -vr * Math.min(V, 60) * 220);
  }
  // Smoke turbulence
  if (s.turbulence > 0) {
    _force.x += (Math.random() - 0.5) * s.turbulence * mass * 6;
    _force.y += (Math.random() - 0.5) * s.turbulence * mass * 9;
  }

  // Control authority grows with dynamic pressure.
  const auth = clamp(q / 3000, 0.08, 1.2);
  s.aileron += (input.roll - s.aileron) * Math.min(1, dt * 6);
  s.elevator += (input.pitch - s.elevator) * Math.min(1, dt * 6);
  s.rudder += (input.yaw - s.rudder) * Math.min(1, dt * 5);
  const heavy = 1 - (s.water / WATER_MAX) * 0.3;
  const targetPitch = s.elevator * 0.75 * auth * heavy;
  const targetRoll = -s.aileron * 1.45 * auth * heavy;
  const bank = Math.asin(clamp(_r.y, -1, 1));
  const targetYaw = s.rudder * -0.3 * auth + (s.onGround ? 0 : bank * 0.12 * auth);
  const k = Math.min(1, dt * 3.5);
  s.angular.x += (targetPitch - s.angular.x) * k;
  s.angular.y += (targetYaw - s.angular.y) * k;
  s.angular.z += (targetRoll - s.angular.z) * k;
  if (s.stall) { s.angular.x -= 0.6 * dt; s.angular.z += Math.sin(env.time * 3) * 0.4 * dt; }

  // Weathervane: nose follows the flight path (keeps pitch smooth at every speed).
  if (V > 15 && !s.onGround) {
    s.angular.x += -alpha * 1.2 * auth * dt * 3;
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
  const bottom = s.position.y - GEAR_HEIGHT;
  s.agl = bottom - surf.h;
  s.onWater = false;
  s.scooping = false;
  if (s.agl > 0.05) { if (s.onGround) s.onGround = false; return; }

  const vs = s.velocity.y;
  const e = new THREE.Euler().setFromQuaternion(s.quaternion, 'YXZ');
  const speed = s.velocity.length();
  const wasAir = !s.onGround;
  const runway = isOnRunway(s.position.x, s.position.z, 4);
  if (surf.water) {
    // Hull on the water: gentle enough is a landing / scoop, too hard is a crash.
    if (vs < -6 || Math.abs(e.z) > 0.45 || e.x < -0.2 || speed > 85) { s.crashed = speed > 85 ? 'Hull broke up: too fast on the water' : 'Hit the water too hard'; return; }
    s.onWater = true;
    s.position.y = surf.h + GEAR_HEIGHT - 0.25;
    s.velocity.y = Math.max(0, s.velocity.y) * 0.3;
    if (wasAir) s.lastTouchdown = { vs, speed, water: true, time: env.time };
    s.onGround = true;
    // Scoop when skimming between 30 and 60 m/s with the probes down.
    if (speed > 28 && speed < 62 && s.water < s.waterMax) {
      s.scooping = true;
      s.water = Math.min(s.waterMax, s.water + 520 * dt);
    }
    // Water drag
    s.velocity.multiplyScalar(1 - dt * 0.08);
  } else {
    if (!runway && speed > 8) { s.crashed = 'Crashed into the forest'; return; }
    if (vs < -4.5 || Math.abs(e.z) > 0.3 || e.x < -0.15) { s.crashed = vs < -4.5 ? 'Hard landing: the gear collapsed' : 'Wing or nose struck the runway'; return; }
    if (wasAir) s.lastTouchdown = { vs, speed, water: false, time: env.time, x: s.position.x };
    s.onGround = true;
    s.position.y = surf.h + GEAR_HEIGHT;
    s.velocity.y = Math.max(0, s.velocity.y);
    // Rolling friction and brakes; steer the nose wheel with the rudder/roll.
    const along = s.velocity.dot(fwd);
    const fr = (s.brakes ? 3.2 : 0.25) * dt;
    const newAlong = Math.sign(along) * Math.max(0, Math.abs(along) - fr * 9.81 * 0.4 * (s.brakes ? 1 : 0.4));
    _tmp.copy(fwd).setY(0).normalize();
    s.velocity.set(_tmp.x * newAlong, s.velocity.y, _tmp.z * newAlong);
    // Keep wings level and nose from digging in on the ground.
    const lvl = new THREE.Euler(Math.max(e.x, -0.02), e.y + (-(s.rudder + s.aileron * 0.5)) * dt * 0.5 * Math.min(1, speed / 10), 0, 'YXZ');
    if (speed < 35) lvl.x = Math.max(0, Math.min(lvl.x, 0.05));
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
