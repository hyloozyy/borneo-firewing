// Builds props from many small parts and merges them into one mesh per material, so a whole
// village or airfield costs a handful of draw calls. Parts get world-scale UVs (box-projected by
// their dominant normal, or their own UVs scaled), then the current transform is applied.
import * as THREE from 'three';

const _n = new THREE.Vector3();

// UVs from the two axes across the dominant normal, `tile` metres per texture repeat.
function boxProjectUV(geo, tile) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    _n.set(Math.abs(n.getX(i)), Math.abs(n.getY(i)), Math.abs(n.getZ(i)));
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let u, v;
    if (_n.y >= _n.x && _n.y >= _n.z) { u = x; v = z; } else if (_n.x >= _n.z) { u = z; v = y; } else { u = x; v = y; }
    uv[i * 2] = u / tile; uv[i * 2 + 1] = -v / tile;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

export class PropBuilder {
  constructor(materials) {
    this.materials = materials; // key -> THREE.Material
    this.buckets = new Map();
    this.stack = [new THREE.Matrix4()];
  }

  get matrix() { return this.stack[this.stack.length - 1]; }

  // Enter a local frame (position, yaw, optional uniform scale).
  push(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1));
    this.stack.push(this.matrix.clone().multiply(m));
    return this;
  }

  pop() { this.stack.pop(); return this; }

  // Add a geometry under material `key`. opts: tile (m per repeat, box projection) or uvScale [su, sv]
  // to keep the geometry's own UVs; at {x,y,z,rx,ry,rz} places it within the current frame.
  // uvLocal: project UVs before the part's own rotation (roof slopes keep their courses running downhill).
  add(key, geo, { tile = 2, uvScale = null, uvLocal = false, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (sx !== 1 || sy !== 1 || sz !== 1) g.scale(sx, sy, sz);
    if (!g.attributes.normal) g.computeVertexNormals();
    const uvs = () => {
      if (uvScale && g.attributes.uv) {
        const a = g.attributes.uv;
        for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * uvScale[0], a.getY(i) * uvScale[1]);
      } else boxProjectUV(g, tile);
    };
    if (uvLocal) uvs();
    if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')));
    if (x || y || z) g.translate(x, y, z);
    if (!uvLocal) uvs();
    g.applyMatrix4(this.matrix);
    if (!this.buckets.has(key)) this.buckets.set(key, []);
    this.buckets.get(key).push(g);
    return this;
  }

  box(key, w, h, d, opts = {}) { return this.add(key, new THREE.BoxGeometry(w, h, d), opts); }

  // A square or round member from a to b (posts, braces, rails, pipes).
  beam(key, a, b, t = 0.15, { round = false, tile = 1.5 } = {}) {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const len = va.distanceTo(vb);
    const geo = round ? new THREE.CylinderGeometry(t / 2, t / 2, len, 8, 1) : new THREE.BoxGeometry(t, len, t);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    const mid = va.clone().add(vb).multiplyScalar(0.5);
    const g = geo.toNonIndexed();
    g.applyMatrix4(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)));
    return this.add(key, g, { tile });
  }

  // Merge every bucket into one mesh per material.
  build({ castShadow = true, receiveShadow = true } = {}) {
    const group = new THREE.Group();
    for (const [key, list] of this.buckets) {
      let count = 0;
      for (const g of list) count += g.attributes.position.count;
      const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), uv = new Float32Array(count * 2);
      let o = 0;
      for (const g of list) {
        const n = g.attributes.position.count;
        pos.set(g.attributes.position.array, o * 3);
        nor.set(g.attributes.normal.array, o * 3);
        if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
        o += n;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.computeBoundingSphere();
      const mat = this.materials[key];
      if (!mat) throw new Error(`prop material ${key} missing`);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = castShadow && !mat.transparent && !mat.userData.noShadow;
      mesh.receiveShadow = receiveShadow;
      mesh.name = key;
      group.add(mesh);
    }
    return group;
  }
}

// Sheet bent along a profile curve (x,y points in the XY plane) and swept `length` along Z,
// with real thickness (outer, inner and edge faces). UVs: u = distance along the profile, v = z.
export function sweptSheet(profile, length, thickness, segZ = 1) {
  const n = profile.length;
  // Normals of the profile (perpendicular to the tangent, pointing "outside" = left of travel).
  const norms = profile.map((p, i) => {
    const a = profile[Math.max(0, i - 1)], b = profile[Math.min(n - 1, i + 1)];
    const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
    return [-ty / l, tx / l];
  });
  const dist = [0];
  for (let i = 1; i < n; i++) dist.push(dist[i - 1] + Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]));
  const pos = [], nor = [], uv = [];
  const quad = (a, b, c, d, na, nb, nc, nd, ua, ub, uc, ud) => {
    for (const [p, nn, u] of [[a, na, ua], [b, nb, ub], [c, nc, uc], [a, na, ua], [c, nc, uc], [d, nd, ud]]) { pos.push(...p); nor.push(...nn); uv.push(...u); }
  };
  const z0 = -length / 2;
  for (let s = 0; s < segZ; s++) {
    const za = z0 + (length * s) / segZ, zb = z0 + (length * (s + 1)) / segZ;
    for (let i = 0; i < n - 1; i++) {
      const [x0, y0] = profile[i], [x1, y1] = profile[i + 1];
      const [nx0, ny0] = norms[i], [nx1, ny1] = norms[i + 1];
      const o0 = [x0 + nx0 * thickness, y0 + ny0 * thickness], o1 = [x1 + nx1 * thickness, y1 + ny1 * thickness];
      // outer
      quad([o0[0], o0[1], za], [o0[0], o0[1], zb], [o1[0], o1[1], zb], [o1[0], o1[1], za],
        [nx0, ny0, 0], [nx0, ny0, 0], [nx1, ny1, 0], [nx1, ny1, 0],
        [dist[i], za], [dist[i], zb], [dist[i + 1], zb], [dist[i + 1], za]);
      // inner (reversed)
      quad([x1, y1, za], [x1, y1, zb], [x0, y0, zb], [x0, y0, za],
        [-nx1, -ny1, 0], [-nx1, -ny1, 0], [-nx0, -ny0, 0], [-nx0, -ny0, 0],
        [dist[i + 1], za], [dist[i + 1], zb], [dist[i], zb], [dist[i], za]);
    }
  }
  // Edge strips along both open ends (z = ±length/2).
  for (const [z, dz] of [[-length / 2, -1], [length / 2, 1]]) {
    for (let i = 0; i < n - 1; i++) {
      const [x0, y0] = profile[i], [x1, y1] = profile[i + 1];
      const [nx0, ny0] = norms[i], [nx1, ny1] = norms[i + 1];
      const a = [x0, y0, z], b = [x1, y1, z], c = [x1 + nx1 * thickness, y1 + ny1 * thickness, z], d = [x0 + nx0 * thickness, y0 + ny0 * thickness, z];
      const N = [0, 0, dz];
      if (dz > 0) quad(a, b, c, d, N, N, N, N, [0, 0], [0, 0], [0, 0], [0, 0]);
      else quad(d, c, b, a, N, N, N, N, [0, 0], [0, 0], [0, 0], [0, 0]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

// Flat polygon (XY points) extruded to a slab `depth` thick along Z, centred on z = 0.
export function slab(points, depth, holes = []) {
  const s = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return g;
}

// A pitched roof plane with real thickness: width across the slope, run down the slope, pitch angle.
// Returned in a frame where the ridge runs along X at the origin and the slab falls toward +Z.
export function roofPlane(length, run, pitch, thick = 0.12) {
  const g = new THREE.BoxGeometry(length, thick, run);
  g.translate(0, -thick / 2, run / 2);
  g.rotateX(pitch);
  return g;
}
