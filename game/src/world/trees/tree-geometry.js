// Geometry builder for procedural trees: tapered bark tubes (with buttress roots), leaf cards with
// volumetric (crown-centred) normals and baked occlusion, and drooping folded fronds for palms.
// Vertex attributes: position, normal, uv, color (occlusion/tint), sway (bend, flutter, random).
import * as THREE from 'three';

const _v = new THREE.Vector3();

export class TreeMeshBuilder {
  constructor() {
    this.pos = []; this.nor = []; this.uv = []; this.col = []; this.sway = []; this.idx = [];
  }

  get count() { return this.pos.length / 3; }

  vertex(p, n, u, v, c, sw) {
    this.pos.push(p.x, p.y, p.z);
    this.nor.push(n.x, n.y, n.z);
    this.uv.push(u, v);
    this.col.push(c[0], c[1], c[2]);
    this.sway.push(sw[0], sw[1], sw[2]);
  }

  // A tube through `points` with `radii`; uv rect [u0,u1] around, v advances with length so bark
  // keeps its aspect. Optional buttress(angle, heightAboveBase) multiplies the radius.
  tube(points, radii, { radial = 8, u0 = 0, u1 = 0.5, vScale = 0.25, buttress = null, sway = () => [0, 0, 0], shade = () => 1, cap = false } = {}) {
    const n = points.length;
    const tangents = [], normals = [], binormals = [];
    for (let i = 0; i < n; i++) {
      const a = points[Math.max(0, i - 1)], b = points[Math.min(n - 1, i + 1)];
      tangents.push(new THREE.Vector3().subVectors(b, a).normalize());
    }
    let nrm = Math.abs(tangents[0].y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    nrm = new THREE.Vector3().crossVectors(tangents[0], nrm).normalize();
    for (let i = 0; i < n; i++) {
      if (i > 0) {
        const axis = new THREE.Vector3().crossVectors(tangents[i - 1], tangents[i]);
        const len = axis.length();
        if (len > 1e-6) nrm.applyAxisAngle(axis.divideScalar(len), Math.asin(Math.min(1, len)));
      }
      normals.push(nrm.clone());
      binormals.push(new THREE.Vector3().crossVectors(tangents[i], nrm).normalize());
    }
    const base = this.count;
    let vAcc = 0;
    const baseY = points[0].y;
    for (let i = 0; i < n; i++) {
      if (i > 0) vAcc += points[i].distanceTo(points[i - 1]) / (Math.PI * 2 * Math.max(0.05, radii[i]) * 1.0) * vScale * 4;
      const sw = sway(points[i], i / (n - 1));
      for (let j = 0; j <= radial; j++) {
        const th = (j / radial) * Math.PI * 2;
        let r = radii[i];
        if (buttress) r *= buttress(th, points[i].y - baseY);
        const cx = Math.cos(th), sx = Math.sin(th);
        const dir = new THREE.Vector3().copy(normals[i]).multiplyScalar(cx).addScaledVector(binormals[i], sx);
        _v.copy(points[i]).addScaledVector(dir, r);
        const s = shade(points[i], i / (n - 1));
        this.vertex(_v, dir, u0 + (u1 - u0) * (j / radial), vAcc, [s, s, s], sw);
      }
    }
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < radial; j++) {
        const a = base + i * (radial + 1) + j, b = a + radial + 1;
        this.idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    if (cap) {
      const c = this.count;
      const last = points[n - 1];
      this.vertex(last, tangents[n - 1], (u0 + u1) / 2, vAcc, [0.6, 0.6, 0.6], sway(last, 1));
      const ringStart = base + (n - 1) * (radial + 1);
      for (let j = 0; j < radial; j++) this.idx.push(ringStart + j, ringStart + j + 1, c);
    }
  }

  // A leaf card centred at `p`, facing `facing`, spun by `spin`; `center` is the crown/clump centre
  // used for the soft volumetric normals; ao darkens cards deep inside the crown.
  card(p, facing, spin, w, h, rect, center, ao, sw, flip = false) {
    const f = facing.clone().normalize();
    const up0 = Math.abs(f.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up0, f).normalize();
    const up = new THREE.Vector3().crossVectors(f, right).normalize();
    right.applyAxisAngle(f, spin); up.applyAxisAngle(f, spin);
    const base = this.count;
    const [ua, va, ub, vb] = rect;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const [cx, cy] of corners) {
      const q = p.clone().addScaledVector(right, cx * w * 0.5).addScaledVector(up, cy * h * 0.5);
      const n = q.clone().sub(center).normalize().multiplyScalar(0.75).addScaledVector(f, 0.25).normalize();
      const c = [ao, ao, ao];
      const u = flip ? (cx < 0 ? ub : ua) : (cx < 0 ? ua : ub);
      this.vertex(q, n, u, cy < 0 ? vb : va, c, sw);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  // Same as card() but each corner's normal comes from normalAt(corner) (clump + crown blend).
  cardN(p, facing, spin, w, h, rect, normalAt, ao, sw, flip = false) {
    const f = facing;
    const up0 = Math.abs(f.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up0, f).normalize();
    const up = new THREE.Vector3().crossVectors(f, right).normalize();
    right.applyAxisAngle(f, spin); up.applyAxisAngle(f, spin);
    const base = this.count;
    const [ua, va, ub, vb] = rect;
    const q = new THREE.Vector3();
    for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      q.copy(p).addScaledVector(right, cx * w * 0.5).addScaledVector(up, cy * h * 0.5);
      const n = normalAt(q).clone().multiplyScalar(0.85).addScaledVector(f, 0.15).normalize();
      const u = flip ? (cx < 0 ? ub : ua) : (cx < 0 ? ua : ub);
      this.vertex(q, n, u, cy < 0 ? vb : va, [ao, ao, ao], sw);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  // A drooping palm/fern frond from `base` along heading `yaw`, rising at `pitch`, folded in a V.
  frond(base, yaw, pitch, length, width, droop, rect, sw, segs = 7, fold = 0.35) {
    const [ua, va, ub, vb] = rect;
    const dir = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
    const side = new THREE.Vector3(-Math.sin(yaw), 0, Math.cos(yaw));
    const start = this.count;
    let p = base.clone();
    let a = pitch;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const halfW = width * 0.5 * Math.sin(Math.min(1, t * 1.6 + 0.12) * Math.PI * 0.5 + 0.0) * (1 - t * 0.55);
      const fw = new THREE.Vector3().copy(dir).multiplyScalar(Math.cos(a)).setY(Math.sin(a));
      const up = new THREE.Vector3().crossVectors(side, fw).normalize().negate();
      const rachis = p.clone();
      const ao = 0.75 + 0.25 * t;
      const swt = [sw[0] + t * 0.6, sw[1] + t * 0.8, sw[2]];
      const v = va + (vb - va) * t;
      for (const s of [-1, 0, 1]) {
        const q = rachis.clone().addScaledVector(side, s * halfW).addScaledVector(up, Math.abs(s) * halfW * fold);
        const n = up.clone().addScaledVector(side, -s * fold).normalize();
        const u = s < 0 ? ua : s > 0 ? ub : (ua + ub) / 2;
        this.vertex(q, n, u, v, [ao, ao, ao], swt);
      }
      p.addScaledVector(fw, length / segs);
      a -= droop / segs;
    }
    for (let i = 0; i < segs; i++) {
      const r0 = start + i * 3, r1 = r0 + 3;
      this.idx.push(r0, r1, r0 + 1, r1, r1 + 1, r0 + 1, r0 + 1, r1 + 1, r0 + 2, r1 + 1, r1 + 2, r0 + 2);
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('sway', new THREE.Float32BufferAttribute(this.sway, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

// Leaves of one crown clump: cards spread through an ellipsoid, denser toward its skin.
export function leafClump(b, center, radius, cards, size, rect, rnd, { flat = 0.7, crownCenter = center, aoBase = 0.6, sway = 0.8 } = {}) {
  for (let i = 0; i < cards; i++) {
    const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const out = new THREE.Vector3(s * Math.cos(th), u * flat + 0.15, s * Math.sin(th)).normalize();
    if (out.y < -0.55) out.y = -0.55 + rnd() * 0.2;
    const depth = 0.45 + 0.55 * Math.sqrt(rnd());
    const p = center.clone().addScaledVector(out, radius * depth).setY(center.y + out.y * radius * depth * flat);
    const facing = out.clone().multiplyScalar(0.7).add(new THREE.Vector3(rnd() - 0.5, rnd() * 0.6, rnd() - 0.5)).normalize();
    const lift = (p.y - crownCenter.y) / (radius * 2.5);
    const ao = Math.max(0.3, Math.min(1.05, aoBase + 0.45 * depth + 0.25 * lift + 0.12 * out.y));
    const sz = size * (0.75 + rnd() * 0.5);
    b.card(p, facing, rnd() * Math.PI * 2, sz, sz, rect, crownCenter, ao, [sway, 1, rnd()], rnd() < 0.5);
  }
}

export function inset(rect, px = 0.004) {
  return [rect[0] + px, rect[1] + px, rect[2] - px, rect[3] - px];
}
