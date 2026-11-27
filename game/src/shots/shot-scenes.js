// Staged, deterministic scenes for the screenshots (?shot=title|cover|cockpit|scoop|landing|rear).
// Optional overrides for framing: &yaw= &pitch= &dist= (chase camera), &spread= (fire growth).
import * as THREE from 'three';
import { PLACES, terrainHeight, lakeLanding } from '../world/terrain.js';
import { setFlying, GEAR_HEIGHT } from '../flight/flight-model.js';
import { SUN_DIR } from '../world/sky.js';
import { showScreen } from '../ui/screens.js';

const deg = Math.PI / 180;
const params = new URLSearchParams(location.search);
const num = (k, d) => (params.has(k) ? Number(params.get(k)) : d);

export const SHOTS = {
  // Chase view: FW-218 releasing its load over the burning forest, drop ring ahead.
  cover(game) {
    game.startMission(2, { quiet: true });
    game.fire.update(0.1, game.wind, 0, null);
    for (let i = 0; i < num('spread', 12); i++) game.fire.spreadStep(game.wind);
    game.stageData.startHeat = game.fire.totalHeat() * 1.25;
    const ring = game.stageData.ring;
    const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(ring.quaternion);
    const start = ring.position.clone().addScaledVector(dir, -num('back', 440));
    start.y = ring.position.y + 14;
    const hdg = Math.atan2(dir.x, -dir.z);
    setFlying(game.flight, start, -hdg, 58, -2 * deg, -6 * deg);
    game.flight.water = game.flight.waterMax;
    game.rig.yaw = num('yaw', 0.95); game.rig.pitch = num('pitch', 0.06); game.rig.dist = num('dist', 21);
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
    // Skimming a couple of hundred metres off the fishing landing (jetty, boats, stilt houses beyond).
    const L = lakeLanding();
    const at = L ? new THREE.Vector3(L.x - L.dx * num('off', 105) - num('side', 70), GEAR_HEIGHT - 0.25, L.z - L.dz * num('off', 105)) : new THREE.Vector3(PLACES.lake.x - 260, GEAR_HEIGHT - 0.25, PLACES.lake.z + 40);
    setFlying(game.flight, at, -80 * deg, 44, 2 * deg, 0);
    game.flight.water = game.flight.waterMax * 0.45;
    game.flight.flaps = game.flight.flapTarget = 0.5;
    game.rig.yaw = num('yaw', -2.15); game.rig.pitch = num('pitch', 0.12); game.rig.dist = num('dist', 34);
    return { warm: 1.6, scoop: true, mode: 'chase' };
  },
  // Golden-hour short final, seen from the rear quarter: gear down, full flaps, the approach light bars
  // leading to runway 36, threshold lights and the PAPI, the low sun lighting the aircraft.
  landing(game) {
    game.startMission(4, { quiet: true });
    const r = PLACES.runway;
    const z = r.z + r.length / 2 + num('pz', 170);
    setFlying(game.flight, new THREE.Vector3(r.x + num('px', 1), r.h + num('py', 17), z), 0, 52, 3 * deg, num('bank', -4) * deg);
    game.flight.flaps = game.flight.flapTarget = 1;
    game.stageData.gate = true;
    game.flight.velocity.set(0, -3.4, -52); // 3.5° glide path, nose slightly up
    game.flight.gearDown = true; game.plane.userData.parts.gearExt = 1; // wheels down and locked
    game.renderer.toneMappingExposure = num('exp', 1.3);
    game.rig.yaw = num('yaw', 0.72); game.rig.pitch = num('pitch', 0.2); game.rig.dist = num('dist', 26);
    return { warm: 1.0, mode: 'chase' };
  },
  // Title screen over the orbiting fly-by of the fire.
  title(game) {
    game.menuFlyby();
    game.showHud = false;
    game.rig.yaw = num('yaw', 0.8); game.rig.pitch = num('pitch', 0.12); game.rig.dist = num('dist', 34);
    showScreen('title');
    document.getElementById('title').classList.add('staged');
    return { warm: 2.0, mode: 'chase', kinematic: 'orbit' };
  },
  // Inside the fire: low over the burning forest, chase camera above and behind; the smoke shakes
  // the aircraft and an overheating engine lights the caution panel.
  inferno(game) {
    game.startMission(2, { quiet: true });
    game.fire.update(0.1, game.wind, 0, null);
    for (let i = 0; i < num('spread', 22); i++) game.fire.spreadStep(game.wind);
    const spot = game.fire.hottestSpot() || { x: PLACES.fire.x, z: PLACES.fire.z };
    const hdg = num('hdg', 215) * deg;
    const back = num('back', 160);
    const x = spot.x - Math.sin(hdg) * back, z = spot.z + Math.cos(hdg) * back;
    setFlying(game.flight, new THREE.Vector3(x, terrainHeight(x, z) + num('agl', 85), z), -hdg, 58, -3 * deg, num('bank', 14) * deg);
    game.flight.water = 0;
    game.flight.damage.engines[1].itt = 845;
    if (game.stageData.ring) game.stageData.ring.visible = false; // just the aircraft and the fire
    game.renderer.toneMappingExposure = num('exp', 0.85);
    game.rig.yaw = num('yaw', 0.5); game.rig.pitch = num('pitch', 0.27); game.rig.dist = num('dist', 21);
    return { warm: 2.6, mode: 'chase' };
  },
  // On the runway, standing on the gear or rolling for take-off (&v= ground speed, m/s).
  runway(game) {
    game.startMission(0, { quiet: true });
    const s = game.flight;
    s.throttle = s.rpm = num('v', 0) > 0 ? 1 : 0.2; s.engRpm[0] = s.engRpm[1] = s.rpm;
    s.velocity.set(0, 0, -num('v', 0));
    game.rig.yaw = num('yaw', 0.9); game.rig.pitch = num('pitch', 0.08); game.rig.dist = num('dist', 24);
    return { warm: 1.0, mode: 'chase' };
  },
  // Asset inspection from a fixed camera: &at=x,y,z&look=x,y,z (metres, world), &fov=.
  // Named spots: &spot=airfield|village|lake.
  view(game) {
    const r = PLACES.runway, v = PLACES.village, l = PLACES.lake;
    const spots = {
      airfield: [[r.x + 30, r.h + 14, r.z + 630], [r.x + 110, r.h + 6, r.z + 490]],
      village: [[v.x - 160, v.h + 30, v.z + 120], [v.x, v.h + 4, v.z]],
      lake: [[l.x + 420, 20, l.z + 300], [l.x + 560, 4, l.z + 40]],
    };
    const vec = (s) => new THREE.Vector3(...s.split(',').map(Number));
    const [at, look] = spots[params.get('spot')] || spots.airfield;
    game.startMission(1, { quiet: true });
    setFlying(game.flight, new THREE.Vector3(-300, 400, -650), 100 * deg, 70);
    game.showHud = false;
    return { warm: 0.5, mode: 'chase', camera: { fov: num('fov', 55), pos: params.has('at') ? vec(params.get('at')) : new THREE.Vector3(...at), look: params.has('look') ? vec(params.get('look')) : new THREE.Vector3(...look) } };
  },
  // Close look at the aircraft from behind and above, cruising over the hills (detail check).
  rear(game) {
    game.startMission(1, { quiet: true });
    setFlying(game.flight, new THREE.Vector3(-200, 230, 200), 200 * deg, 60, 1 * deg, 8 * deg);
    game.flight.flaps = game.flight.flapTarget = 0.5;
    game.rig.yaw = 0.6; game.rig.pitch = 0.25; game.rig.dist = 22;
    return { warm: 1.0, mode: 'chase' };
  },
};

// Move the aircraft along its velocity for the warm-up so particles and trails look natural.
export function runShot(game, name) {
  const setup = SHOTS[name](game);
  game.kinematic = setup.kinematic ?? true;
  game.rig.hold = true;
  game.rig.mode = setup.mode;
  game.cameraMode = setup.mode;
  game.rig.first = true;
  // Framing: a longer lens (&fov=, vertical degrees) fills a wide 1280x480 frame with the aircraft
  // and compresses the fire, lake or runway behind it.
  game.rig.lookAhead = num('ahead', setup.ahead ?? 14);
  if (params.has('exp')) game.renderer.toneMappingExposure = num('exp', 1);
  const fov = num('fov', setup.fov ?? 0);
  if (fov > 0 && setup.mode === 'chase') { game.camera.fov = fov; game.camera.updateProjectionMatrix(); }
  const dt = 1 / 30;
  for (let t = 0; t < setup.warm; t += dt) {
    if (setup.dropFrom !== undefined && t > setup.dropFrom) game.forceDrop = true;
    if (setup.scoop) game.forceScoop = true;
    game.simulate(dt);
  }
  game.hud.bannerTime = 0;
  game.hud.toasts.length = 0; // no warm-up call-outs (e.g. the automatic GEAR DOWN) in staged shots
  if (params.has('strike')) { game.weather.strike(game.time - num('strike', 0.02)); game.weather.update(0, game.time); }
  // Fixed camera (outside the chase rig) for scenic shots.
  if (setup.camera) {
    const cam = game.camera;
    cam.fov = setup.camera.fov;
    cam.near = 1;
    cam.position.copy(setup.camera.pos);
    cam.up.set(0, 1, 0);
    cam.lookAt(setup.camera.look);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    game.forest.update(cam, game.time, SUN_DIR);
    game.sky.follow(cam.position, setup.camera.look.clone().setY(Math.max(0, setup.camera.look.y)));
  }
}
