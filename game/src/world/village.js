// The stilt village (the one stage 4 must save): a rumah betang longhouse with carved guardian posts
// in the middle, rumah panggung around it facing in, each with its own roof, paint and yard props
// (water drums and tanks, firewood, laundry lines, lamp posts); plus a fishing landing on the lake
// shore with a jetty, moored klotok and jukung boats and three more houses, and shore rocks.
// All detailed PBR props (props/) merged per material.
import * as THREE from 'three';
import { rand } from '../core/rng.js';
import { painterRandom } from '../textures/texture-utils.js';
import { PLACES, terrainHeight, lakeLanding } from './terrain.js';
import { PropBuilder } from './props/prop-builder.js';
import { propPalette } from './props/prop-palette.js';
import { addStiltHouse, addLonghouse, addCarvedPost } from './props/stilt-house.js';
import { addBoat, addJetty, addRope } from './props/boats.js';
import { buildRocks } from './props/rocks.js';

const WALLS = ['wood', 'woodGreen', 'woodBlue', 'woodCream', 'wood', 'woodOchre'];
const ROOFS = ['shingle', 'zincRust', 'thatch', 'zinc', 'shingle', 'zincRust'];

function yardProps(b, rnd, w, d) {
  // Water drum or raised tank, firewood under the floor, sometimes a laundry line.
  if (rnd() < 0.5) {
    b.add(rnd() < 0.5 ? 'drumBlue' : 'drumRed', new THREE.CylinderGeometry(0.3, 0.3, 0.9, 14), { x: w / 2 + 0.8, y: 0.45, z: d / 2 - 0.5, tile: 1 });
  } else {
    const x = -w / 2 - 1.4, z = -d / 2 + 0.8;
    for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) b.box('woodDark', 0.12, 2.2, 0.12, { x: x + dx, y: 1.1, z: z + dz, tile: 1 });
    b.box('wood', 1.3, 0.08, 1.3, { x, y: 2.2, z, tile: 1 });
    b.add(rnd() < 0.5 ? 'tankPlastic' : 'tankOrange', new THREE.CylinderGeometry(0.55, 0.55, 1.1, 16), { x, y: 2.8, z });
  }
  for (let i = 0; i < 3; i++) b.add('woodDark', new THREE.CylinderGeometry(0.07, 0.07, 1.6, 6), { x: -1 + i * 0.16, y: 0.12 + (i % 2) * 0.12, z: 0.5, rz: Math.PI / 2, ry: 0.1 * i, tile: 1 });
  b.box('wood', 1.8, 0.4, 0.5, { x: 0.6, y: 0.2, z: -0.6, tile: 0.6 });
  if (rnd() < 0.55) {
    const z = d / 2 + 4.2, x0 = -w / 2, x1 = x0 + 4.5;
    for (const x of [x0, x1]) b.box('woodDark', 0.1, 2, 0.1, { x, y: 1, z, tile: 1 });
    addRope(b, [x0, 1.9, z], [x1, 1.9, z], 0.18);
    const cloths = ['clothA', 'clothB', 'clothC', 'clothD'];
    for (let i = 0; i < 4; i++) b.box(cloths[(i + Math.floor(rnd() * 4)) % 4], 0.6 + rnd() * 0.3, 0.5 + rnd() * 0.4, 0.02, { x: x0 + 0.7 + i * 1.0, y: 1.55 - Math.sin(((i + 0.7) / 4.5) * Math.PI) * 0.15, z, tile: 1 });
  }
  if (rnd() < 0.6) { // lamp post by the steps
    const x = w / 2 - 0.6, z = d / 2 + 2.6;
    b.box('woodDark', 0.12, 3, 0.12, { x, y: 1.5, z, tile: 1 });
    b.box('woodDark', 0.6, 0.08, 0.08, { x: x - 0.25, y: 2.95, z, tile: 1 });
    b.add('lamp', new THREE.SphereGeometry(0.12, 8, 6), { x: x - 0.5, y: 2.75, z });
  }
}

export function buildVillage(scene, quality = {}) {
  // The world's random stream is shared with the fire; consume what the old village did so the
  // fire scenario (and the staged screenshots) stay exactly where they were.
  for (let i = 0; i < 84; i++) rand();
  const rnd = painterRandom(2180);
  const pal = propPalette(quality.lite ? 128 : quality.phone ? 256 : 512);
  const b = new PropBuilder(pal);
  const v = PLACES.village;
  const houses = [];
  const place = (x, z, ry, fn) => {
    const y = terrainHeight(x, z) - 0.15;
    b.push(x, y, z, ry); fn(); b.pop();
    houses.push(new THREE.Vector3(x, y, z));
  };
  // Longhouse and guardian posts.
  place(v.x, v.z, 0.4, () => {
    addLonghouse(b, { rnd });
    for (const x of [-5, 9]) addCarvedPost(b, x, 13.5);
  });
  // Stilt houses facing the longhouse.
  const n = quality.phone ? 12 : 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.25;
    const r = 52 + rnd() * 62;
    const x = v.x + Math.cos(a) * r, z = v.z + Math.sin(a) * r;
    const ry = Math.atan2(-Math.cos(a), -Math.sin(a)) + (rnd() - 0.5) * 0.3;
    const w = 6 + rnd() * 3, d = 5 + rnd() * 2.5;
    place(x, z, ry, () => {
      addStiltHouse(b, { w, d, legH: 2.1 + rnd() * 0.8, wall: WALLS[i % WALLS.length], roofMat: ROOFS[(i * 7) % ROOFS.length], rnd, lit: 0.45 });
      yardProps(b, rnd, w, d);
    });
  }
  // Fishing landing on the lake shore: jetty, boats and three houses.
  const shore = lakeLanding();
  if (shore) {
    const out = Math.atan2(-shore.dz, -shore.dx); // jetty points into the lake
    const ry = -out;
    b.push(shore.x - shore.dx * 4, 0, shore.z - shore.dz * 4, ry);
    addJetty(b, 30);
    const moor = [[12, 2.9, 'klotok', 'hullBlue'], [22, -2.8, 'klotok', 'hullGreen'], [6, -2.2, 'jukung', 'hullRed'], [28, 4.2, 'jukung', 'hullBlue']];
    for (const [x, z, kind, col] of moor) { b.push(x, 0.05, z, (rnd() - 0.5) * 0.15); addBoat(b, kind, col); b.pop(); }
    b.pop();
    for (let i = 0; i < 3; i++) {
      const side = (i - 1) * 16;
      const x = shore.x + shore.dx * 22 + shore.dz * side, z = shore.z + shore.dz * 22 - shore.dx * side;
      place(x, z, Math.atan2(-shore.dx, -shore.dz) + (rnd() - 0.5) * 0.3, () => { // facing the lake
        addStiltHouse(b, { w: 6 + rnd() * 2, d: 5, legH: 2.6, wall: WALLS[(i + 2) % WALLS.length], roofMat: ROOFS[(i + 1) % ROOFS.length], rnd, lit: 0.5 });
        yardProps(b, rnd, 7, 5);
      });
    }
  }
  const group = b.build();
  scene.add(group);
  buildRocks(scene, pal, quality.phone ? 140 : 300);
  return { group, houses, center: new THREE.Vector3(v.x, v.h, v.z) };
}
