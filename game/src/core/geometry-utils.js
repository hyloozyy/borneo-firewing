// Small geometry helpers: merge coloured parts into one mesh, planar UVs, vertex colouring.
import * as THREE from 'three';

export function paint(geometry, color) {
  const c = new THREE.Color(color);
  const n = geometry.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geometry;
}

// Merge non-indexed copies of geometries (position, normal, color) into one BufferGeometry.
export function mergeParts(parts) {
  const flat = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  let total = 0;
  for (const g of flat) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  let o = 0;
  for (const g of flat) {
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.color) col.set(g.attributes.color.array, o * 3);
    else col.fill(1, o * 3, (o + n) * 3);
    o += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

// Place a geometry: translate, rotate (euler) and scale in one call.
export function placed(geometry, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );
  geometry.applyMatrix4(m);
  return geometry;
}

// Project UVs from two position axes over the geometry's bounds.
export function planarUV(geometry, axisU = 'z', axisV = 'y', flipU = false) {
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  const p = geometry.attributes.position;
  const uv = new Float32Array(p.count * 2);
  const get = { x: (i) => p.getX(i), y: (i) => p.getY(i), z: (i) => p.getZ(i) };
  const ru = bb.max[axisU] - bb.min[axisU] || 1;
  const rv = bb.max[axisV] - bb.min[axisV] || 1;
  for (let i = 0; i < p.count; i++) {
    let u = (get[axisU](i) - bb.min[axisU]) / ru;
    if (flipU) u = 1 - u;
    uv[i * 2] = u;
    uv[i * 2 + 1] = (get[axisV](i) - bb.min[axisV]) / rv;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}
