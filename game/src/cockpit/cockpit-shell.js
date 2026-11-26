// Cockpit structure seen from the captain's seat: glareshield with its hood, instrument panel
// mounting, framed four-pane windscreen with corner panes and pillars, side windows, overhead
// console, side walls and consoles, wipers, and the white nose with its anti-glare panel outside.
import * as THREE from 'three';
import { tileFbm, heightToNormalTexture } from '../textures/texture-utils.js';
import { hullSection, NOSE_Z, TAIL_Z } from '../aircraft/fw218-model.js';

// Windscreen frame points (aircraft axes: nose -Z, right +X, up +Y).
export const SCREEN = {
  baseY: 1.2, baseZ: -8.78, topY: 1.8, topZ: -8.32,
  postX: [-1.36, -0.95, 0, 0.95, 1.36],
  cornerBack: 0.33, // corner panes sweep back this far
};

export function cockpitMaterials() {
  const size = 128, bump = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) bump[i] = tileFbm((i % size) / size, Math.floor(i / size) / size, 16, 3, 5);
  const crinkle = heightToNormalTexture(bump, size, size, 3);
  crinkle.repeat.set(4, 4);
  return {
    dark: new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.85, metalness: 0.05, normalMap: crinkle, normalScale: new THREE.Vector2(0.8, 0.8) }),
    grey: new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.7, metalness: 0.1, normalMap: crinkle, normalScale: new THREE.Vector2(0.5, 0.5) }),
    frame: new THREE.MeshStandardMaterial({ color: 0x2b2f34, roughness: 0.5, metalness: 0.4 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.95 }),
    grip: new THREE.MeshStandardMaterial({ color: 0x3b3d40, roughness: 0.55, metalness: 0.2 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.2, metalness: 1 }),
  };
}

// A square-section beam between two points.
export function beam(a, b, w, d, mat) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, d), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

function quad(p0, p1, p2, p3, mat) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...p0.toArray(), ...p1.toArray(), ...p2.toArray(), ...p3.toArray()], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

// Points along the windscreen base and top for a post at x.
function screenPoint(x, top) {
  const back = Math.max(0, Math.abs(x) - 0.95) / 0.41 * SCREEN.cornerBack;
  return new THREE.Vector3(x, top ? SCREEN.topY : SCREEN.baseY, (top ? SCREEN.topZ : SCREEN.baseZ) + back);
}

export function buildShell(group, mats, glassMat) {
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  // Glareshield: top surface sloping down toward the windscreen, with a rounded hood lip.
  const glare = new THREE.Mesh(new THREE.BoxGeometry(2.76, 0.05, 0.72), mats.dark);
  glare.position.set(0, 1.26, -8.44);
  glare.rotation.x = -0.08;
  group.add(glare);
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.76, 12), mats.dark);
  lip.rotation.z = Math.PI / 2;
  lip.position.set(0, 1.285, -8.085);
  group.add(lip);
  // Panel back and lower knee panel
  const knee = new THREE.Mesh(new THREE.BoxGeometry(2.76, 0.42, 0.3), mats.grey);
  knee.position.set(0, 0.36, -8.28);
  group.add(knee);
  // Windscreen: two front panes and two corner panes, posts, header and sill.
  const xs = SCREEN.postX;
  for (let i = 0; i < xs.length - 1; i++) {
    const a = screenPoint(xs[i], false), b = screenPoint(xs[i + 1], false), c = screenPoint(xs[i + 1], true), d = screenPoint(xs[i], true);
    const pane = quad(a, b, c, d, glassMat);
    pane.renderOrder = 5;
    group.add(pane);
  }
  for (const x of xs) {
    const outer = Math.abs(x) > 1.3;
    group.add(beam(screenPoint(x, false), screenPoint(x, true), outer ? 0.1 : x === 0 ? 0.055 : 0.075, 0.07, mats.frame));
  }
  for (let i = 0; i < xs.length - 1; i++) {
    group.add(beam(screenPoint(xs[i], true), screenPoint(xs[i + 1], true), 0.09, 0.08, mats.frame));
    group.add(beam(screenPoint(xs[i], false), screenPoint(xs[i + 1], false), 0.05, 0.05, mats.frame));
  }
  // Side windows with frames, walls under them.
  for (const side of [-1, 1]) {
    const x = side * 1.38;
    const a = v(x, 1.08, -8.42), b = v(x, 1.08, -7.0), c = v(x, 1.74, -7.0), d = v(x, 1.76, -8.05);
    const win = quad(side < 0 ? a : b, side < 0 ? b : a, side < 0 ? c : d, side < 0 ? d : c, glassMat);
    win.renderOrder = 5;
    group.add(win);
    group.add(beam(a, b, 0.06, 0.06, mats.frame), beam(d, c, 0.06, 0.08, mats.frame), beam(b, c, 0.07, 0.06, mats.frame));
    group.add(beam(v(x, 1.08, -7.72), v(x, 1.75, -7.72), 0.04, 0.05, mats.frame));
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.95, 2.2), mats.dark);
    wall.position.set(side * 1.42, 0.6, -7.5);
    group.add(wall);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 1.6), mats.grey);
    sill.position.set(side * 1.3, 1.06, -7.55);
    group.add(sill);
    const console = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 1.3), mats.grey);
    console.position.set(side * 1.22, 0.72, -7.5);
    group.add(console);
  }
  // Roof and the overhead console behind the header.
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.05, 1.5), mats.dark);
  roof.position.set(0, 2.02, -7.5);
  group.add(roof);
  // Wipers resting at the base of the front panes, outside the glass.
  for (const x of [-0.5, 0.5]) {
    const arm = beam(v(x + 0.12, SCREEN.baseY + 0.03, SCREEN.baseZ - 0.05), v(x - 0.3, SCREEN.baseY + 0.1, SCREEN.baseZ - 0.03), 0.018, 0.012, mats.rubber);
    group.add(arm);
    const blade = beam(v(x - 0.05, SCREEN.baseY + 0.07, SCREEN.baseZ - 0.06), v(x - 0.48, SCREEN.baseY + 0.12, SCREEN.baseZ - 0.04), 0.012, 0.025, mats.rubber);
    group.add(blade);
  }
  group.add(buildNose());
}

// The upper surface of the nose ahead of the windscreen: white paint, black anti-glare panel.
function buildNose() {
  const z0 = SCREEN.baseZ - 0.04, z1 = NOSE_Z + 0.05;
  const rows = 18, cols = 24;
  const pos = [], col = [], idx = [];
  const white = new THREE.Color(0xeeeeea), black = new THREE.Color(0x1a1b1d), red = new THREE.Color(0xc8102e);
  for (let i = 0; i <= rows; i++) {
    const z = z0 + (z1 - z0) * (i / rows);
    const t = (z - NOSE_Z) / (TAIL_Z - NOSE_Z);
    const { w, top, bot } = hullSection(t);
    for (let j = 0; j <= cols; j++) {
      const th = -Math.PI / 2 + (j / cols) * Math.PI;
      const s = Math.sin(th), c = Math.cos(th);
      const wy = bot + (top - bot) * 0.48;
      const x = w * Math.sign(s) * Math.pow(Math.abs(s), 0.65);
      const y = wy + (top - wy) * Math.pow(c, 0.75);
      pos.push(x, y + 0.004, z);
      const anti = Math.abs(x) < 0.55 && i < rows * 0.6;
      const lower = y < wy + 0.15;
      const cc = anti ? black : lower ? red : white;
      col.push(cc.r, cc.g, cc.b);
    }
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const a = i * (cols + 1) + j, b = a + cols + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1, side: THREE.DoubleSide }));
}
