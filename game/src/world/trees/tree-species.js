// Kalimantan tree species and their variants. Broadleaf species grow from branching skeletons
// (tree-skeleton.js): emergent dipterocarp (pale clear bole, buttress roots, broad cauliflower
// crown of many clumps), main-canopy tree, round sub-canopy broadleaf, tiered light-green pioneer
// (Macaranga-like). Plus palms with drooping fronds and understorey shrub/fern. Each variant is
// built at two levels of detail from the same skeleton; far trees use baked impostors.
import * as THREE from 'three';
import { TreeMeshBuilder, leafClump, inset } from './tree-geometry.js';
import { growSkeleton, buildWood, buildCrown } from './tree-skeleton.js';
import { LEAF_CELLS } from '../../textures/foliage-textures.js';
import { painterRandom } from '../../textures/texture-utils.js';

const PALE = [0, 0.5], DARK = [0.5, 1];
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

function buttressFn(fins, amp, height, rnd) {
  const ang = Array.from({ length: fins }, (_, i) => (i / fins) * Math.PI * 2 + (rnd() - 0.5) * 0.7);
  const a = ang.map(() => amp * (0.6 + rnd() * 0.6));
  return (th, h) => {
    let r = 1;
    const fall = Math.exp(-h / height);
    for (let i = 0; i < fins; i++) {
      const d = Math.cos(th - ang[i]);
      r += a[i] * fall * Math.pow(Math.max(0, d), 26);
    }
    return r + 0.25 * fall;
  };
}

function branchedRecipe(o) {
  return (lod, seed) => {
    // Separate streams: the skeleton is identical for both levels of detail.
    const sk = growSkeleton(o, painterRandom(seed));
    const wood = new TreeMeshBuilder(), leaves = new TreeMeshBuilder();
    const bf = o.buttress ? buttressFn(o.buttress, o.buttressAmp, o.buttressH, painterRandom(seed + 1)) : null;
    buildWood(wood, sk, o, lod, o.bark, bf);
    buildCrown(leaves, sk, o, lod, inset(o.cell), painterRandom(seed + 2));
    return { wood: wood.build(), leaves: leaves.build() };
  };
}

function palmRecipe(lod, seed) {
  const rnd = painterRandom(seed);
  const hi = lod === 'hi';
  const wood = new TreeMeshBuilder(), leaves = new TreeMeshBuilder();
  const H = 13 + rnd() * 4;
  const pts = [];
  const lean = 1.2 + rnd() * 1.6;
  for (let i = 0; i <= (hi ? 10 : 4); i++) {
    const t = i / (hi ? 10 : 4);
    pts.push(V3(lean * t * t, -0.5 + (H + 0.5) * t, 0.3 * Math.sin(t * 3)));
  }
  wood.tube(pts, pts.map((p, i) => 0.36 - 0.12 * (i / (pts.length - 1)) + (i === 0 ? 0.12 : 0)), { radial: hi ? 8 : 5, u0: DARK[0], u1: DARK[1], vScale: 0.6, sway: (p) => [Math.pow(p.y / H, 2) * 0.9, 0, 0], shade: () => 0.85 });
  const crownP = pts[pts.length - 1].clone();
  const fronds = hi ? 18 : 10;
  for (let i = 0; i < fronds; i++) {
    const yaw = (i / fronds) * Math.PI * 2 + rnd() * 0.3;
    const ring = i % 3;
    const pitch = [0.95, 0.45, -0.05][ring] + (rnd() - 0.5) * 0.2;
    const len = 5.4 + rnd() * 1.4 - ring * 0.3;
    leaves.frond(crownP.clone().add(V3(0, 0.2 - ring * 0.25, 0)), yaw, pitch, len, 1.9 + rnd() * 0.4, 1.6 + ring * 0.35, inset(LEAF_CELLS.palm, 0.002), [0.9, 0.5, rnd()], hi ? 8 : 4, 0.3);
  }
  if (hi) {
    for (let i = 0; i < 3; i++) {
      const yaw = rnd() * Math.PI * 2;
      leaves.frond(crownP.clone().add(V3(0, -0.4, 0)), yaw, -0.9, 3.6, 1.2, 0.4, inset(LEAF_CELLS.palm, 0.002), [0.6, 0.3, rnd()], 4, 0.2);
    }
    const nuts = new THREE.IcosahedronGeometry(0.3, 1);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const c = crownP.clone().add(V3(Math.cos(a) * 0.45, -0.55, Math.sin(a) * 0.45));
      const p = nuts.attributes.position;
      const base = wood.count;
      for (let k = 0; k < p.count; k++) {
        const v = V3(p.getX(k), p.getY(k), p.getZ(k));
        wood.vertex(v.clone().add(c), v.clone().normalize(), 0.75, 0.2, [0.5, 0.45, 0.25], [0.9, 0, 0]);
      }
      for (let k = 0; k < p.count; k++) wood.idx.push(base + k);
    }
  }
  return { wood: wood.build(), leaves: leaves.build() };
}

function shrubRecipe(lod, seed) {
  const rnd = painterRandom(seed);
  const hi = lod === 'hi';
  const wood = new TreeMeshBuilder(), leaves = new TreeMeshBuilder();
  wood.tube([V3(0, -0.5, 0), V3(0.1, 1.5, 0), V3(0.2, 3.2, 0.1)], [0.12, 0.09, 0.05], { radial: 4, u0: DARK[0], u1: DARK[1], sway: (p) => [p.y * 0.1, 0, 0] });
  for (let k = 0; k < 3; k++) {
    const c = V3((rnd() - 0.5) * 2, 1.8 + rnd() * 1.4, (rnd() - 0.5) * 2);
    leafClump(leaves, c, 1.7, hi ? 14 : 4, hi ? 1.6 : 2.6, inset(LEAF_CELLS.shrub), rnd, { flat: 0.7, aoBase: 0.5, sway: 0.5, crownCenter: V3(0, 2, 0) });
  }
  const fr = hi ? 10 : 5;
  for (let i = 0; i < fr; i++) {
    leaves.frond(V3((rnd() - 0.5) * 1.5, 0.2, (rnd() - 0.5) * 1.5), (i / fr) * Math.PI * 2 + rnd(), 0.9 + rnd() * 0.3, 2.6 + rnd(), 0.95, 1.7, inset(LEAF_CELLS.fern, 0.002), [0.3, 0.8, rnd()], hi ? 5 : 3, 0.15);
  }
  return { wood: wood.build(), leaves: leaves.build() };
}

const DIPTEROCARP = {
  H: 50, trunkTop: 30, r0: 1.05, r1: 0.5, lean: 1.6, wobble: 0.3, buttress: 5, buttressAmp: 2.4, buttressH: 2.6, bark: PALE,
  limbs: 6, branchFrom: 0.84, elevLow: 0.32, elevHigh: 0.75, limbLen: 9.5, lowLenK: 1.05, limbRK: 0.5,
  depth: 3, children: 2, extraChild: 0.35, lenDecay: 0.58, splitAngle: 0.62, upward: 0.12, upBend: 0.12, sideTips: 0.55,
  clumpR: 3.6, flat: 0.55, cards: 15, loCards: 3, loCardK: 2.0, card: 2.9, ao: 0.42, cell: LEAF_CELLS.canopy,
};
const CANOPY = {
  H: 30, trunkTop: 13, r0: 0.6, r1: 0.32, lean: 2.6, wobble: 0.25, buttress: 4, buttressAmp: 1.3, buttressH: 1.4, bark: DARK,
  limbs: 5, branchFrom: 0.62, elevLow: 0.5, elevHigh: 0.95, limbLen: 7.2, lowLenK: 1.1, limbRK: 0.55,
  depth: 2, children: 2, extraChild: 0.5, lenDecay: 0.62, splitAngle: 0.58, upward: 0.15, upBend: 0.18, sideTips: 0.6,
  clumpR: 3.3, flat: 0.6, cards: 15, loCards: 3, loCardK: 2.0, card: 2.6, ao: 0.4, cell: LEAF_CELLS.canopy, topTip: true,
};
const BROADLEAF = {
  H: 22, trunkTop: 6.5, r0: 0.45, r1: 0.26, lean: 2.6, wobble: 0.3, buttress: 0, bark: PALE,
  limbs: 5, branchFrom: 0.55, elevLow: 0.6, elevHigh: 1.05, limbLen: 5.2, lowLenK: 1.0, limbRK: 0.55,
  depth: 2, children: 2, extraChild: 0.5, lenDecay: 0.62, splitAngle: 0.6, upward: 0.12, upBend: 0.18, sideTips: 0.5,
  clumpR: 3.0, flat: 0.65, cards: 15, loCards: 3, loCardK: 2.0, card: 2.5, ao: 0.42, cell: LEAF_CELLS.broad, topTip: true,
};
const PIONEER = {
  H: 17, trunkTop: 15, r0: 0.3, r1: 0.14, lean: 2.0, wobble: 0.2, buttress: 0, bark: PALE, leader: true,
  limbs: 7, branchFrom: 0.42, elevLow: 0.12, elevHigh: 0.5, limbLen: 4.4, lowLenK: 0.45, limbRK: 0.6,
  depth: 1, children: 2, extraChild: 0.3, lenDecay: 0.6, splitAngle: 0.5, upward: 0.05, upBend: 0.08, sideTips: 0.7,
  clumpR: 2.2, flat: 0.45, cards: 13, loCards: 3, loCardK: 2.0, card: 2.3, ao: 0.5, cell: LEAF_CELLS.young,
};

// Variants: one geometry each (two levels of detail); `impostor` false = never drawn far away.
// share = fraction of the forest; `kind` drives where the placement puts it.
export const VARIANTS = [
  { name: 'dipterocarp-a', kind: 'emergent', share: 0.045, scale: [0.85, 1.2], build: branchedRecipe(DIPTEROCARP), seed: 101 },
  { name: 'dipterocarp-b', kind: 'emergent', share: 0.045, scale: [0.85, 1.2], build: branchedRecipe({ ...DIPTEROCARP, limbs: 7, elevHigh: 0.9, H: 46 }), seed: 131 },
  { name: 'canopy-a', kind: 'canopy', share: 0.15, scale: [0.8, 1.25], build: branchedRecipe(CANOPY), seed: 211 },
  { name: 'canopy-b', kind: 'canopy', share: 0.15, scale: [0.8, 1.25], build: branchedRecipe({ ...CANOPY, limbs: 6, limbLen: 6.4, trunkTop: 15 }), seed: 223 },
  { name: 'canopy-c', kind: 'canopy', share: 0.13, scale: [0.8, 1.25], build: branchedRecipe({ ...CANOPY, limbs: 4, elevLow: 0.35, limbLen: 8, clumpR: 3.6 }), seed: 241 },
  { name: 'broadleaf-a', kind: 'sub', share: 0.13, scale: [0.8, 1.2], build: branchedRecipe(BROADLEAF), seed: 307 },
  { name: 'broadleaf-b', kind: 'sub', share: 0.12, scale: [0.8, 1.2], build: branchedRecipe({ ...BROADLEAF, limbs: 6, trunkTop: 8, cell: LEAF_CELLS.canopy }), seed: 331 },
  { name: 'pioneer', kind: 'pioneer', share: 0.1, scale: [0.85, 1.2], build: branchedRecipe(PIONEER), seed: 401 },
  { name: 'palm', kind: 'palm', share: 0.07, scale: [0.85, 1.2], build: palmRecipe, seed: 503 },
  { name: 'shrub', kind: 'shrub', share: 0, scale: [1.0, 2.0], build: shrubRecipe, seed: 601, impostor: false },
];
