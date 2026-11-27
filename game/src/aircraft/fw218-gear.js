// FW-218 retractable amphibian landing gear: a twin-wheel nose gear folding back into a nose well
// with two doors, and main legs with twin wheels folding up into sponson fairings on the hull sides,
// each with a door. Every leg has an outer strut, a chrome oleo piston that compresses on the ground,
// torque links, a drag brace and wheels that spin with ground speed. Static pieces inside each moving
// part are merged per material (few draw calls); the whole gear is hidden when it is up.
import * as THREE from 'three';
import { PropBuilder } from '../world/props/prop-builder.js';
import { latheZ, profileOf } from './fw218-parts.js';

export const WHEEL_HEIGHT = 2.7; // aircraft origin to the tyre bottoms, gear down and compressed
const TYRE_R = 0.4;

function tyreGeometry(r, w) {
  const g = new THREE.TorusGeometry(r - w * 0.5, w * 0.55, 10, 24);
  g.rotateY(Math.PI / 2);
  g.scale(w / (w * 1.1), 1, 1);
  return g;
}

// Twin wheels on an axle along X at the origin of the returned group.
function wheelPair(mats, gap, r = TYRE_R, w = 0.26) {
  const b = new PropBuilder(mats);
  for (const s of [-1, 1]) {
    b.add('rubber', tyreGeometry(r, w), { x: s * gap });
    b.add('grey', new THREE.CylinderGeometry(r * 0.55, r * 0.55, w * 0.9, 16), { x: s * gap, rz: Math.PI / 2 });
    b.add('chrome', new THREE.CylinderGeometry(r * 0.2, r * 0.2, w + 0.02, 10), { x: s * gap, rz: Math.PI / 2 });
  }
  b.add('dark', new THREE.CylinderGeometry(0.06, 0.06, gap * 2, 8), { rz: Math.PI / 2 });
  return b.build({ castShadow: true });
}

// One leg hanging down -Y from its hinge: strut, sliding oleo with wheels, torque links, brace.
function leg(mats, { strut, gap, brace }) {
  const hinge = new THREE.Group();
  const b = new PropBuilder(mats);
  b.add('grey', new THREE.CylinderGeometry(0.1, 0.12, strut, 12), { y: -strut / 2 });
  b.add('grey', new THREE.CylinderGeometry(0.15, 0.15, 0.3, 12), { rz: Math.PI / 2 }); // trunnion
  if (brace) b.beam('grey', [0, -strut * 0.55, 0], brace, 0.06, { round: true });
  hinge.add(b.build({ castShadow: true }));
  const oleo = new THREE.Group();
  oleo.position.y = -strut;
  oleo.userData.base = -strut;
  const ob = new PropBuilder(mats);
  ob.add('chrome', new THREE.CylinderGeometry(0.07, 0.07, 0.5, 12), { y: 0.05 });
  ob.add('dark', new THREE.BoxGeometry(0.05, 0.26, 0.05), { y: 0.2, z: -0.12, rx: 0.5 }); // torque links
  ob.add('dark', new THREE.BoxGeometry(0.05, 0.26, 0.05), { y: -0.02, z: -0.12, rx: -0.5 });
  ob.add('grey', new THREE.BoxGeometry(gap * 2 - 0.2, 0.14, 0.18), { y: -0.2 }); // axle beam
  oleo.add(ob.build({ castShadow: true }));
  const wheels = wheelPair(mats, gap);
  wheels.position.y = -0.2;
  oleo.add(wheels);
  hinge.add(oleo);
  return { hinge, oleo, wheels };
}

function door(mat, w, len, thick = 0.04) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, thick, len), mat);
  m.position.x = w / 2; // hinge along the door's inner edge, the panel extends toward +X
  m.castShadow = true;
  g.add(m);
  return g;
}

export function buildGear(model, m, parts) {
  const mats = { grey: m.grey, chrome: m.chrome, dark: m.dark, rubber: m.rubber };
  parts.gear = [];
  parts.gearDoors = [];
  parts.oleos = [];
  parts.wheels = [];
  // Nose gear: folds back into the nose well; two doors hinge open along the well edges.
  const nose = leg(mats, { strut: 0.97, gap: 0.2, brace: [0, -0.2, 0.75] });
  nose.hinge.position.set(0, -1.15, -7.45);
  nose.hinge.userData = { axis: 'x', sign: -1, fold: 1.75 };
  model.add(nose.hinge);
  parts.gear.push(nose.hinge);
  parts.oleos.push(nose.oleo); parts.wheels.push(nose.wheels);
  for (const side of [-1, 1]) {
    const d = door(m.red, 0.26, 1.3);
    d.position.set(side * 0.36, -1.62, -7.3);
    d.scale.x = -side; // panel extends toward the centre line
    d.userData = { side, open: side * 1.45 }; // hangs straight down when open
    model.add(d);
    parts.gearDoors.push(d);
  }
  // Main gear: sponson fairings on the hull sides take the legs, which fold up and outward.
  for (const side of [-1, 1]) {
    const sp = new THREE.Mesh(latheZ(profileOf(-1.0, 2.6, 14, (t) => Math.pow(Math.sin(Math.PI * Math.pow(t, 0.7)), 0.6) * 0.46), { segments: 16, sx: 0.8, sy: 0.75 }), m.red);
    sp.position.set(side * 1.3, -0.95, 0.9);
    sp.castShadow = true;
    model.add(sp);
    const main = leg(mats, { strut: 1.17, gap: 0.24, brace: [-side * 0.45, -0.05, -0.55] });
    main.hinge.position.set(side * 1.42, -0.95, 0.9);
    main.hinge.userData = { axis: 'z', sign: -side, fold: 1.6 }; // folds inward, up into the sponson
    model.add(main.hinge);
    parts.gear.push(main.hinge);
    parts.oleos.push(main.oleo); parts.wheels.push(main.wheels);
    const d = door(m.red, 0.5, 1.4);
    d.position.set(side * 1.08, -1.32, 0.9);
    d.scale.x = side; // panel extends outward
    d.userData = { side, open: -side * 1.5 };
    model.add(d);
    parts.gearDoors.push(d);
  }
  parts.gearExt = null;
}

// Gear state: s.gearDown (true/false). Extends/retracts over ~4 s (instant when on the ground),
// doors open when the gear is moving or down, oleos compress on the ground, wheels roll.
export function animateGear(p, s, dt) {
  const want = s.gearDown ? 1 : 0;
  if (p.gearExt === null || (s.onGround && !s.onWater)) p.gearExt = want;
  else p.gearExt += Math.sign(want - p.gearExt) * Math.min(Math.abs(want - p.gearExt), dt * 0.28);
  const ext = p.gearExt, up = 1 - ext;
  for (const g of p.gear) {
    const a = g.userData.sign * up * g.userData.fold;
    if (g.userData.axis === 'x') g.rotation.x = a; else g.rotation.z = a;
    g.visible = ext > 0.02;
  }
  // Doors swing open for the first and last part of the travel, stay open while down.
  const open = Math.min(1, ext * 4);
  for (const d of p.gearDoors) d.rotation.z = d.userData.open * open;
  const onLand = s.onGround && !s.onWater;
  p.oleoTravel = (p.oleoTravel ?? 0) + ((onLand ? 0 : 0.16) - (p.oleoTravel ?? 0)) * Math.min(1, dt * 6);
  for (const o of p.oleos) o.position.y = o.userData.base - p.oleoTravel;
  // Wheels roll with the ground speed and spin down slowly after lift-off.
  p.wheelOmega = onLand ? s.airspeed / TYRE_R : (p.wheelOmega || 0) * Math.max(0, 1 - dt * 0.6);
  p.wheelAngle = ((p.wheelAngle || 0) + p.wheelOmega * dt) % (Math.PI * 2);
  for (const w of p.wheels) w.rotation.x = -p.wheelAngle;
}
