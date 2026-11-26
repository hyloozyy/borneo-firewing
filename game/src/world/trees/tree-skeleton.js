// Branching tree skeletons and the leaf crowns grown on them. A skeleton is a trunk, scaffold
// limbs leaving it at different heights (spiral phyllotaxis), and limbs that fork two or three
// times; every final twig carries a leaf clump. Clumps of a crown overlap but leave real gaps, so
// crowns read as lumpy "cauliflower" masses with branches visible inside, not as umbrellas.
// The skeleton is independent of the level of detail: near and far versions share one shape.
import * as THREE from 'three';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0);

// Turn `dir` away from itself by `angle`, around an axis rolled by `roll` about `dir`.
function deviate(dir, angle, roll) {
  const perp = Math.abs(dir.y) < 0.95 ? new THREE.Vector3().crossVectors(UP, dir).normalize() : V3(1, 0, 0);
  perp.applyAxisAngle(dir, roll);
  return dir.clone().applyAxisAngle(perp, angle).normalize();
}

function lerp(a, b, t) { return a + (b - a) * t; }

// o: H, trunkTop, r0, r1, lean, wobble, limbs, branchFrom (0..1 of trunkTop), elevLow/elevHigh
// (radians above horizontal for the lowest/highest limb), limbLen, lowLenK (length factor of the
// lowest limb), depth, children, lenDecay, splitAngle, upBend, leader (trunk keeps going up).
export function growSkeleton(o, rnd) {
  const branches = [];
  const tips = [];
  // Trunk: denser rings near the ground for the buttress roots.
  const top = o.leader ? o.H * 0.97 : o.trunkTop;
  const lean = V3((rnd() - 0.5) * o.lean, 0, (rnd() - 0.5) * o.lean);
  const trunk = [];
  const N = 12;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const y = -1.2 + (top + 1.2) * (t * t * 0.55 + t * 0.45);
    const f = Math.max(0, y) / top;
    trunk.push(V3(lean.x * f * f + Math.sin(f * 5 + o.H) * o.wobble, y, lean.z * f * f + Math.cos(f * 4 + o.H) * o.wobble));
  }
  const trunkR = (y) => lerp(o.r0, o.r1, Math.pow(Math.min(1, Math.max(0, y) / top), 0.8));
  branches.push({ pts: trunk, radii: trunk.map((p) => trunkR(p.y)), depth: 0 });
  const trunkAt = (y) => {
    for (let i = 1; i < trunk.length; i++) {
      if (trunk[i].y >= y) {
        const a = trunk[i - 1], b = trunk[i];
        return a.clone().lerp(b, (y - a.y) / Math.max(1e-3, b.y - a.y));
      }
    }
    return trunk[trunk.length - 1].clone();
  };

  function grow(p, dir, len, r, depth) {
    const bend = UP.clone().multiplyScalar(len * o.upBend);
    const jit = () => V3((rnd() - 0.5) * len * 0.18, (rnd() - 0.5) * len * 0.12, (rnd() - 0.5) * len * 0.18);
    const p1 = p.clone().addScaledVector(dir, len * 0.34).add(jit());
    const p2 = p.clone().addScaledVector(dir, len * 0.68).addScaledVector(bend, 0.45).add(jit());
    const p3 = p.clone().addScaledVector(dir, len).add(bend);
    branches.push({ pts: [p.clone(), p1, p2, p3], radii: [r, r * 0.82, r * 0.66, r * 0.52], depth });
    const endDir = p3.clone().sub(p2).normalize();
    if (depth >= o.depth) {
      tips.push({ p: p3, dir: endDir, len });
      // A side twig half way along keeps the crown full between the forks.
      if (rnd() < o.sideTips) tips.push({ p: p2.clone(), dir: deviate(endDir, 0.7, rnd() * 6.28), len: len * 0.7 });
      return;
    }
    const k = o.children + (rnd() < o.extraChild ? 1 : 0);
    const roll0 = rnd() * Math.PI * 2;
    for (let c = 0; c < k; c++) {
      const cd = deviate(endDir, o.splitAngle * (0.7 + rnd() * 0.6), roll0 + (c / k) * Math.PI * 2 + (rnd() - 0.5) * 0.8);
      cd.y += o.upward;
      cd.normalize();
      grow(p3, cd, len * o.lenDecay * (0.8 + rnd() * 0.4), r * 0.62, depth + 1);
    }
  }

  const from = o.branchFrom * o.trunkTop;
  const to = o.leader ? top * 0.9 : o.trunkTop;
  for (let i = 0; i < o.limbs; i++) {
    const t = o.limbs === 1 ? 1 : i / (o.limbs - 1);
    const y = lerp(from, to, Math.pow(t, 0.85)) + (rnd() - 0.5) * 0.6;
    const az = i * 2.39996 + rnd() * 0.9;
    const elev = lerp(o.elevLow, o.elevHigh, t) + (rnd() - 0.5) * 0.25;
    const dir = V3(Math.cos(elev) * Math.cos(az), Math.sin(elev), Math.cos(elev) * Math.sin(az));
    const len = o.limbLen * lerp(o.lowLenK, 1, o.leader ? 1 - t : t) * (0.8 + rnd() * 0.4);
    grow(trunkAt(y), dir, len, trunkR(y) * o.limbRK, 1);
  }
  if (o.leader || o.topTip) tips.push({ p: trunk[trunk.length - 1].clone(), dir: UP.clone(), len: o.limbLen * 0.8 });

  const center = new THREE.Vector3();
  for (const t of tips) center.add(t.p);
  center.divideScalar(Math.max(1, tips.length));
  let radius = 1, minY = Infinity, maxY = -Infinity;
  for (const t of tips) {
    radius = Math.max(radius, Math.hypot(t.p.x - center.x, t.p.z - center.z));
    minY = Math.min(minY, t.p.y); maxY = Math.max(maxY, t.p.y);
  }
  return { branches, tips, center, radius, minY, maxY: maxY + o.clumpR };
}

// Bark tubes for the skeleton. Far versions drop the finest forks and use fewer sides.
export function buildWood(builder, sk, o, lod, bark, buttressFn) {
  const hi = lod === 'hi';
  for (const b of sk.branches) {
    if (!hi && b.depth > 1) continue;
    const trunk = b.depth === 0;
    const radial = trunk ? (hi ? (buttressFn ? 14 : 9) : (buttressFn ? 6 : 5)) : hi ? Math.max(3, 6 - b.depth) : 3;
    let pts = b.pts, radii = b.radii;
    if (!hi && trunk) {
      pts = pts.filter((_, i) => i % 3 === 0 || i === pts.length - 1);
      radii = pts.map((p) => b.radii[b.pts.indexOf(p)]);
    }
    builder.tube(pts, radii, {
      radial,
      u0: bark[0], u1: bark[1],
      buttress: trunk ? buttressFn : null,
      sway: (p) => [Math.pow(Math.max(0, p.y) / o.H, 2) * 0.6 + (trunk ? 0 : 0.1 * b.depth), 0, 0],
      shade: (p) => (trunk ? 0.5 + 0.5 * Math.min(1, Math.max(0, p.y) / (o.trunkTop * 0.6)) : 0.62 + 0.1 * b.depth),
    });
  }
}

// Leaf clumps on every tip. Card normals blend the clump's own roundness with the whole crown's,
// so each clump is shaded like a ball of leaves and the crown still reads as one mass.
export function buildCrown(builder, sk, o, lod, rect, rnd) {
  const hi = lod === 'hi';
  const crownH = Math.max(1, sk.maxY - sk.minY);
  const R = Math.max(2, sk.radius + o.clumpR);
  const n = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  for (const tip of sk.tips) {
    const r = o.clumpR * (0.75 + rnd() * 0.5) * Math.min(1.2, Math.sqrt(tip.len / Math.max(1, o.limbLen * Math.pow(o.lenDecay, o.depth - 1))));
    const c = tip.p.clone().addScaledVector(tip.dir, r * 0.35);
    c.y += r * 0.2;
    const crownC = sk.center;
    const normalAt = (q) => {
      a.subVectors(q, c).divideScalar(r);
      b.subVectors(q, crownC).divideScalar(R);
      b.y *= 1.4;
      return n.copy(a).multiplyScalar(0.55).addScaledVector(b, 0.45).addScaledVector(UP, 0.18).normalize();
    };
    const heightK = (c.y - sk.minY) / crownH;
    const outer = Math.min(1, Math.hypot(c.x - crownC.x, c.z - crownC.z) / R);
    const count = hi ? o.cards : o.loCards;
    const size = o.card * (hi ? 1 : o.loCardK);
    const swayBase = 0.25 + Math.max(0, c.y / o.H) * 0.55;
    for (let i = 0; i < count; i++) {
      // Points on a top-heavy ellipsoid, mostly in the outer shell.
      const u = rnd() * 1.7 - 0.7;
      const th = rnd() * Math.PI * 2;
      const s = Math.sqrt(Math.max(0, 1 - u * u));
      const dir = V3(s * Math.cos(th), u, s * Math.sin(th));
      const depth = hi ? 0.4 + 0.6 * Math.sqrt(rnd()) : 0.25 + 0.4 * rnd();
      const p = c.clone().add(V3(dir.x * r * depth, dir.y * r * depth * o.flat, dir.z * r * depth));
      const facing = dir.clone().multiplyScalar(0.6).add(V3(rnd() - 0.5, rnd() * 0.7, rnd() - 0.5)).normalize();
      const ao = Math.max(0.28, Math.min(1.08, o.ao + 0.3 * depth + 0.22 * dir.y + 0.28 * heightK + 0.18 * outer));
      const sz = size * (0.75 + rnd() * 0.5);
      builder.cardN(p, facing, rnd() * Math.PI * 2, sz, sz, rect, normalAt, ao, [swayBase, 1, rnd()], rnd() < 0.5);
    }
  }
}
