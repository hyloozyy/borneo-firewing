// Granite boulders and river stones: a few unique rock shapes (subdivided icosahedra displaced by
// layered noise, flattened and fractured with planar cuts) instanced along the lake shore, the
// river banks and the village landing, half-buried, with the PBR rock texture.
import * as THREE from 'three';
import { fbm } from '../../core/noise.js';
import { painterRandom } from '../../textures/texture-utils.js';
import { terrainHeight, PLACES, RIVER } from '../terrain.js';

function rockGeometry(seed) {
  const g = new THREE.IcosahedronGeometry(1, 4);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const cuts = [0, 1, 2].map((i) => ({ n: new THREE.Vector3(Math.sin(seed * 3 + i * 2.1), 0.4 + 0.3 * Math.cos(seed + i), Math.cos(seed * 5 + i * 1.7)).normalize(), d: 0.62 + 0.1 * Math.sin(seed * 7 + i) }));
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = fbm(v.x * 1.6 + seed * 10, v.z * 1.6 + v.y * 1.3 - seed * 4, 4);
    const fine = fbm(v.x * 6 + seed, v.y * 6 - v.z * 4, 2);
    v.multiplyScalar(0.72 + n * 0.55 + fine * 0.08);
    for (const c of cuts) { const k = v.dot(c.n) - c.d; if (k > 0) v.addScaledVector(c.n, -k * 0.85); } // fractured faces
    v.y *= 0.62;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  // Smooth the facets: average the normals of coincident vertices (the cuts stay crisp in the shape).
  const nrm = g.attributes.normal, acc = new Map();
  const key = (i) => `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
  for (let i = 0; i < p.count; i++) {
    const k = key(i), a = acc.get(k) || [0, 0, 0];
    a[0] += nrm.getX(i); a[1] += nrm.getY(i); a[2] += nrm.getZ(i);
    acc.set(k, a);
  }
  for (let i = 0; i < p.count; i++) {
    const a = acc.get(key(i)), l = Math.hypot(a[0], a[1], a[2]) || 1;
    nrm.setXYZ(i, a[0] / l, a[1] / l, a[2] / l);
  }
  // Triplanar-ish UVs from position.
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) + p.getZ(i) * 0.7) * 0.5; uv[i * 2 + 1] = (p.getY(i) + p.getZ(i) * 0.4) * 0.5; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

export function buildRocks(scene, palette, count = 260) {
  const rand = painterRandom(9031), randRange = (a, b) => a + (b - a) * rand(); // own stream: the world's stays as it was
  const shapes = [0.3, 1.7, 2.9, 4.4].map(rockGeometry);
  const spots = [];
  // Along the lake shore and the river banks, where the ground meets the water.
  let tries = 0;
  while (spots.length < count && tries < count * 40) {
    tries++;
    let x, z;
    const pick = rand();
    if (pick < 0.55) {
      const a = rand() * Math.PI * 2, d = PLACES.lake.r * randRange(0.95, 1.35);
      x = PLACES.lake.x + (Math.cos(a) * d) / 0.85; z = PLACES.lake.z + Math.sin(a) * d;
    } else {
      const i = Math.floor(rand() * (RIVER.length - 1)), t = rand();
      const [ax, az] = RIVER[i], [bx, bz] = RIVER[i + 1];
      const side = rand() < 0.5 ? -1 : 1, nx = -(bz - az), nz = bx - ax, nl = Math.hypot(nx, nz);
      const off = randRange(28, 60) * side;
      x = ax + (bx - ax) * t + (nx / nl) * off; z = az + (bz - az) * t + (nz / nl) * off;
    }
    const h = terrainHeight(x, z);
    if (h < -0.6 || h > 3.5) continue;
    spots.push([x, h, z]);
    // Clusters: a few smaller stones around each boulder.
    for (let k = 0; k < 2 && spots.length < count; k++) {
      const cx = x + randRange(-4, 4), cz = z + randRange(-4, 4), ch = terrainHeight(cx, cz);
      if (ch > -0.6 && ch < 3.5) spots.push([cx, ch, cz, 0.45]);
    }
  }
  const group = new THREE.Group();
  const per = Math.ceil(spots.length / shapes.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pos = new THREE.Vector3();
  shapes.forEach((geo, k) => {
    const list = spots.slice(k * per, (k + 1) * per);
    const mesh = new THREE.InstancedMesh(geo, palette.rock, list.length);
    list.forEach(([x, h, z, small = 1], i) => {
      const size = randRange(0.6, 2.4) * small * (rand() < 0.12 ? 2.2 : 1);
      q.setFromEuler(new THREE.Euler(randRange(-0.2, 0.2), rand() * 6.28, randRange(-0.2, 0.2)));
      s.set(size * randRange(0.8, 1.3), size * randRange(0.7, 1.2), size * randRange(0.8, 1.3));
      pos.set(x, Math.max(h, -0.3) - size * 0.2, z);
      mesh.setMatrixAt(i, m.compose(pos, q, s));
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });
  scene.add(group);
  return group;
}
