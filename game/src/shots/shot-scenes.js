// Staged, deterministic scenes for the screenshots (?shot=cover|cockpit|scoop|landing).
import * as THREE from 'three';
import { PLACES, terrainHeight } from '../world/terrain.js';
import { setFlying, GEAR_HEIGHT } from '../flight/flight-model.js';

const deg = Math.PI / 180;

export const SHOTS = {
  // Chase view: FW-218 releasing its load over the burning forest, drop ring ahead.
  cover(game) {
    game.startMission(2, { quiet: true });
    game.fire.update(0.1, game.wind, 0, null);
    for (let i = 0; i < 12; i++) game.fire.spreadStep(game.wind);
    game.stageData.startHeat = game.fire.totalHeat() * 1.25;
    const ring = game.stageData.ring;
    const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(ring.quaternion);
    const start = ring.position.clone().addScaledVector(dir, -440);
    start.y = ring.position.y + 14;
    const hdg = Math.atan2(dir.x, -dir.z);
    setFlying(game.flight, start, -hdg, 58, -2 * deg, -6 * deg);
    game.flight.water = game.flight.waterMax;
    game.rig.yaw = 0.95; game.rig.pitch = 0.06; game.rig.dist = 21;
    return { warm: 3.2, dropFrom: 1.2, mode: 'chase' };
  },
  // Cockpit on final approach: runway, approach lights and the green gate ahead, panel lit.
  cockpit(game) {
    game.startMission(4, { quiet: true });
    const r = PLACES.runway;
    setFlying(game.flight, new THREE.Vector3(r.x - 2, r.h + 48, r.z + r.length / 2 + 560), 0, 56, -3 * deg, 1 * deg);
    game.stageData.gate = true;
    game.flight.flaps = game.flight.flapTarget = 1;
    game.rig.yaw = 0; game.rig.pitch = 0.1;
    return { warm: 1.5, mode: 'cockpit' };
  },
  // Skimming the lake: hull on the water, spray, tank filling.
  scoop(game) {
    game.startMission(1, { quiet: true });
    const l = PLACES.lake;
    setFlying(game.flight, new THREE.Vector3(l.x - 260, GEAR_HEIGHT - 0.25, l.z + 40), -80 * deg, 44, 2 * deg, 0);
    game.flight.water = game.flight.waterMax * 0.45;
    game.flight.flaps = game.flight.flapTarget = 0.5;
    game.rig.yaw = -2.15; game.rig.pitch = 0.12; game.rig.dist = 34;
    return { warm: 1.6, scoop: true, mode: 'chase' };
  },
  // Golden-hour approach to the jungle airstrip, flaps out, lights on.
  landing(game) {
    game.startMission(4, { quiet: true });
    const r = PLACES.runway;
    const z = r.z + r.length / 2 + 420;
    setFlying(game.flight, new THREE.Vector3(r.x + 2, r.h + 44, z), 0, 54, -1 * deg, -2 * deg);
    game.flight.flaps = game.flight.flapTarget = 1;
    game.stageData.gate = true;
    game.rig.yaw = 0.5; game.rig.pitch = 0.3; game.rig.dist = 30;
    return { warm: 1.0, mode: 'chase' };
  },
  // Close look at the aircraft from behind and above, cruising over the hills (detail check).
  rear(game) {
    game.startMission(1, { quiet: true });
    setFlying(game.flight, new THREE.Vector3(-200, 230, 200), 200 * deg, 60, 1 * deg, 8 * deg);
    game.flight.flaps = game.flight.flapTarget = 0.5;
    game.rig.yaw = 2.75; game.rig.pitch = 0.2; game.rig.dist = 22;
    return { warm: 1.0, mode: 'chase' };
  },
};

// Move the aircraft along its velocity for the warm-up so particles and trails look natural.
export function runShot(game, name) {
  const setup = SHOTS[name](game);
  game.kinematic = true;
  game.rig.hold = true;
  game.rig.mode = setup.mode;
  game.cameraMode = setup.mode;
  game.rig.first = true;
  const dt = 1 / 30;
  for (let t = 0; t < setup.warm; t += dt) {
    if (setup.dropFrom !== undefined && t > setup.dropFrom) game.forceDrop = true;
    if (setup.scoop) game.forceScoop = true;
    game.simulate(dt);
  }
  game.hud.bannerTime = 0;
}
