// Moving crew controls: twin ram's-horn yokes on columns (turn with roll input, slide with pitch),
// and the overhead power quadrant of a water bomber: two power levers, two prop levers and the
// flap selector, each following the aircraft state.
import * as THREE from 'three';

function yoke(mats) {
  const root = new THREE.Group();
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.5, 10), mats.frame);
  column.rotation.x = Math.PI / 2;
  column.position.z = -0.25;
  root.add(column);
  const wheel = new THREE.Group();
  root.add(wheel);
  // Horns: a tube following a U with grips rising at each end.
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.17, 0.11, 0.01), new THREE.Vector3(-0.185, 0.0, 0.0), new THREE.Vector3(-0.13, -0.06, 0),
    new THREE.Vector3(0, -0.075, 0), new THREE.Vector3(0.13, -0.06, 0), new THREE.Vector3(0.185, 0.0, 0), new THREE.Vector3(0.17, 0.11, 0.01),
  ]);
  wheel.add(new THREE.Mesh(new THREE.TubeGeometry(path, 40, 0.019, 10), mats.grip));
  for (const s of [-1, 1]) {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.022, 0.12, 10), mats.rubber);
    grip.position.set(s * 0.175, 0.07, 0.008);
    grip.rotation.z = s * 0.12;
    wheel.add(grip);
    const button = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.012, 8), new THREE.MeshStandardMaterial({ color: 0xc81e1e, roughness: 0.4 }));
    button.position.set(s * 0.165, 0.135, 0.01);
    wheel.add(button);
  }
  const hub = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.05), mats.grey);
  hub.position.set(0, -0.045, 0);
  wheel.add(hub);
  const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.03), new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.35, metalness: 0.3 }));
  badge.position.set(0, -0.045, 0.026);
  wheel.add(badge);
  return { root, wheel };
}

function lever(mats, knobMat, len, shape) {
  const g = new THREE.Group();
  const rod = new THREE.Mesh(new THREE.BoxGeometry(0.016, len, 0.016), mats.chrome);
  rod.position.y = -len / 2;
  g.add(rod);
  const knob = shape === 'T'
    ? new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.03, 0.03), knobMat)
    : shape === 'flap'
      ? new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.022, 0.045), knobMat)
      : new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), knobMat);
  knob.position.y = -len;
  g.add(knob);
  return g;
}

export function buildControls(group, mats) {
  const yokes = [];
  for (const x of [-0.55, 0.55]) {
    const y = yoke(mats);
    y.root.position.set(x, 0.88, -7.86);
    y.root.rotation.x = 0.12;
    group.add(y.root);
    yokes.push(y);
  }
  // Overhead power quadrant hanging from the roof between the seats.
  const quad = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.6), mats.grey);
  quad.position.set(0, 1.92, -7.95);
  group.add(quad);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.01, 0.5), mats.rubber);
  slot.position.set(0, 1.857, -7.95);
  group.add(slot);
  const black = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.4 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x1f5fc8, roughness: 0.35 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.4 });
  const levers = { power: [], prop: [], flap: null };
  [-0.12, -0.05].forEach((x) => { const l = lever(mats, black, 0.16, 'T'); l.position.set(x, 1.86, -7.95); group.add(l); levers.power.push(l); });
  [0.03, 0.09].forEach((x) => { const l = lever(mats, blue, 0.13, 'ball'); l.position.set(x, 1.86, -7.95); group.add(l); levers.prop.push(l); });
  levers.flap = lever(mats, white, 0.1, 'flap');
  levers.flap.position.set(0.17, 1.86, -7.95);
  group.add(levers.flap);
  return { yokes, levers };
}

export function animateControls(c, s) {
  for (const y of c.yokes) {
    y.wheel.rotation.z = -s.aileron * 0.7;
    y.wheel.position.z = s.elevator * 0.07;
  }
  // Levers swing fore/aft about the quadrant slot.
  c.levers.power.forEach((l, i) => { l.rotation.x = 0.7 - s.throttle * 1.2 - (s.damage.engines[i].failed ? -0.25 : 0); });
  c.levers.prop.forEach((l, i) => { l.rotation.x = s.damage.engines[i].failed ? 0.8 : -0.35; });
  c.levers.flap.rotation.x = 0.5 - s.flapTarget * 0.9;
}
