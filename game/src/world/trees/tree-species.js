// Kalimantan tree species built from the tree builder, each at two levels of detail:
// emergent dipterocarp (tall pale trunk, buttress roots, cauliflower crown), dense canopy tree,
// round broadleaf, light-green pioneer, palm with drooping fronds, and understorey shrub/fern.
import * as THREE from 'three';
import { TreeMeshBuilder, leafClump, inset } from './tree-geometry.js';
import { LEAF_CELLS } from '../../textures/foliage-textures.js';
import { painterRandom } from '../../textures/texture-utils.js';

const PALE = [0, 0.5], DARK = [0.5, 1];
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// Points along a gently curving limb from a to b, sagging/bending by `bend`.
function limbPath(a, b, segs, bend, rnd) {
  const pts = [];
  const mid = a.clone().lerp(b, 0.5).add(V3((rnd() - 0.5) * bend, bend * 0.5, (rnd() - 0.5) * bend));
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = a.clone().multiplyScalar((1 - t) * (1 - t)).addScaledVector(mid, 2 * t * (1 - t)).addScaledVector(b, t * t);
    pts.push(p);
  }
  return pts;
}

function taper(n, r0, r1) {
  return Array.from({ length: n }, (_, i) => r0 + (r1 - r0) * (i / (n - 1)));
}

function trunkSway(H) {
  return (p) => [Math.pow(Math.max(0, p.y) / H, 2) * 0.6, 0, 0];
}

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

// Shared crown recipe: limbs from the trunk top to clump centres, sub-branches, leaf clumps.
function crown(wood, leaves, rnd, o, lod) {
  const hi = lod === 'hi';
  const top = V3(0, o.trunkTop, 0);
  const crownC = V3(0, o.crownY, 0);
  for (let i = 0; i < o.limbs; i++) {
    const a = (i / o.limbs) * Math.PI * 2 + rnd() * 0.6;
    const reach = o.spread * (0.65 + rnd() * 0.45);
    const end = V3(Math.cos(a) * reach, o.crownY + (rnd() - 0.3) * o.clumpR * 0.8, Math.sin(a) * reach);
    const start = top.clone().add(V3(0, -rnd() * o.trunkTop * 0.08, 0));
    const path = limbPath(start, end, hi ? 6 : 3, reach * 0.3, rnd);
    wood.tube(path, taper(path.length, o.limbR, o.limbR * 0.35), { radial: hi ? 6 : 4, u0: o.bark[0], u1: o.bark[1], sway: (p) => [0.25 + (p.y / o.H) * 0.4, 0, 0], shade: () => 0.7 });
    const clumps = hi ? o.subClumps : 1;
    for (let k = 0; k < clumps; k++) {
      const off = k === 0 ? V3(0, 0, 0) : V3((rnd() - 0.5) * o.clumpR * 1.5, (rnd() - 0.2) * o.clumpR * 0.7, (rnd() - 0.5) * o.clumpR * 1.5);
      const c = end.clone().add(off);
      if (hi && k > 0) {
        const sp = limbPath(path[Math.floor(path.length * 0.6)], c, 3, 1, rnd);
        wood.tube(sp, taper(sp.length, o.limbR * 0.45, o.limbR * 0.15), { radial: 4, u0: o.bark[0], u1: o.bark[1], sway: () => [0.6, 0, 0], shade: () => 0.6 });
      }
      const r = o.clumpR * (k === 0 ? 1 : 0.75);
      leafClump(leaves, c, r, hi ? o.cards : o.loCards, o.card * (hi ? 1 : 1.55), inset(o.cell), rnd, { flat: o.flat, crownCenter: crownC, aoBase: 0.55, sway: 0.7 });
    }
  }
  if (o.topClump) leafClump(leaves, V3(0, o.crownY + o.clumpR * 0.6, 0), o.clumpR * 1.1, hi ? o.cards : o.loCards, o.card * (hi ? 1 : 1.55), inset(o.cell), rnd, { flat: o.flat, crownCenter: crownC, aoBase: 0.62, sway: 0.8 });
}

function trunk(wood, rnd, o, lod) {
  const hi = lod === 'hi';
  const n = hi ? 12 : 5;
  const pts = [];
  const lean = V3((rnd() - 0.5) * o.lean, 0, (rnd() - 0.5) * o.lean);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    // Finer rings near the base for the buttresses.
    const y = -1.2 + (o.trunkTop + 1.2) * (t * t * 0.6 + t * 0.4);
    pts.push(V3(lean.x * t * t + Math.sin(t * 5 + o.H) * o.wobble, y, lean.z * t * t + Math.cos(t * 4) * o.wobble));
  }
  const radii = pts.map((p) => o.r0 + (o.r1 - o.r0) * Math.pow(Math.max(0, p.y) / o.trunkTop, 0.8));
  wood.tube(pts, radii, {
    radial: hi ? (o.buttress ? 18 : 10) : (o.buttress ? 8 : 5),
    u0: o.bark[0], u1: o.bark[1],
    buttress: o.buttress ? buttressFn(o.buttress, o.buttressAmp, o.buttressH, rnd) : null,
    sway: trunkSway(o.H),
    shade: (p) => 0.55 + 0.45 * Math.min(1, Math.max(0, p.y) / (o.trunkTop * 0.5)),
  });
}

function broadleafRecipe(o) {
  return (lod, seed) => {
    const rnd = painterRandom(seed);
    const wood = new TreeMeshBuilder(), leaves = new TreeMeshBuilder();
    trunk(wood, rnd, o, lod);
    crown(wood, leaves, rnd, o, lod);
    return { wood: wood.build(), leaves: leaves.build() };
  };
}

function palmRecipe(lod, seed) {
  const rnd = painterRandom(seed);
  const hi = lod === 'hi';
  const wood = new TreeMeshBuilder(), leaves = new TreeMeshBuilder();
  const H = 15;
  const pts = [];
  const lean = 2.2;
  for (let i = 0; i <= (hi ? 10 : 4); i++) {
    const t = i / (hi ? 10 : 4);
    pts.push(V3(lean * t * t, -0.5 + (H + 0.5) * t, 0.3 * Math.sin(t * 3)));
  }
  wood.tube(pts, pts.map((p, i) => 0.36 - 0.12 * (i / (pts.length - 1)) + (i === 0 ? 0.12 : 0)), { radial: hi ? 8 : 5, u0: DARK[0], u1: DARK[1], vScale: 0.6, sway: (p) => [Math.pow(p.y / H, 2) * 0.9, 0, 0], shade: () => 0.85 });
  const crownP = pts[pts.length - 1].clone();
  const fronds = hi ? 16 : 9;
  for (let i = 0; i < fronds; i++) {
    const yaw = (i / fronds) * Math.PI * 2 + rnd() * 0.3;
    const ring = i % 3;
    const pitch = [0.95, 0.45, -0.05][ring] + (rnd() - 0.5) * 0.2;
    const len = 5.4 + rnd() * 1.4 - ring * 0.3;
    leaves.frond(crownP.clone().add(V3(0, 0.2 - ring * 0.25, 0)), yaw, pitch, len, 1.9 + rnd() * 0.4, 1.6 + ring * 0.35, inset(LEAF_CELLS.palm, 0.002), [0.9, 0.5, rnd()], hi ? 8 : 4, 0.3);
  }
  // A few dry hanging fronds and the coconut cluster read as a real palm from close.
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
  const c = V3(0, 2.4, 0);
  leafClump(leaves, c, 2.4, hi ? 26 : 6, hi ? 1.9 : 3, inset(LEAF_CELLS.shrub), rnd, { flat: 0.7, aoBase: 0.5, sway: 0.5 });
  const fr = hi ? 9 : 5;
  for (let i = 0; i < fr; i++) {
    leaves.frond(V3((rnd() - 0.5) * 1.5, 0.2, (rnd() - 0.5) * 1.5), (i / fr) * Math.PI * 2 + rnd(), 0.9 + rnd() * 0.3, 2.6 + rnd(), 0.95, 1.7, inset(LEAF_CELLS.fern, 0.002), [0.3, 0.8, rnd()], hi ? 5 : 3, 0.15);
  }
  return { wood: wood.build(), leaves: leaves.build() };
}

// Each species: builder, share of the forest, scale range, and where it grows.
export const SPECIES = [
  {
    name: 'dipterocarp',
    share: 0.12,
    scale: [0.8, 1.2],
    build: broadleafRecipe({ H: 46, trunkTop: 33, r0: 1.0, r1: 0.5, lean: 2, wobble: 0.3, buttress: 5, buttressAmp: 2.4, buttressH: 2.6, bark: PALE, limbs: 7, limbR: 0.42, spread: 9.5, crownY: 37, clumpR: 6.4, flat: 0.5, subClumps: 3, cards: 42, loCards: 13, card: 5.0, cell: LEAF_CELLS.canopy, topClump: true }),
  },
  {
    name: 'canopy',
    share: 0.36,
    scale: [0.8, 1.3],
    build: broadleafRecipe({ H: 28, trunkTop: 16, r0: 0.55, r1: 0.32, lean: 3, wobble: 0.25, buttress: 4, buttressAmp: 1.3, buttressH: 1.4, bark: DARK, limbs: 6, limbR: 0.26, spread: 6.5, crownY: 20, clumpR: 5.6, flat: 0.7, subClumps: 2, cards: 40, loCards: 12, card: 4.4, cell: LEAF_CELLS.canopy, topClump: true }),
  },
  {
    name: 'broadleaf',
    share: 0.2,
    scale: [0.75, 1.2],
    build: broadleafRecipe({ H: 22, trunkTop: 11, r0: 0.42, r1: 0.25, lean: 3, wobble: 0.3, buttress: 0, bark: PALE, limbs: 5, limbR: 0.2, spread: 4.8, crownY: 15, clumpR: 4.6, flat: 0.8, subClumps: 2, cards: 36, loCards: 11, card: 4.0, cell: LEAF_CELLS.broad, topClump: true }),
  },
  {
    name: 'pioneer',
    share: 0.1,
    scale: [0.8, 1.15],
    build: broadleafRecipe({ H: 16, trunkTop: 10, r0: 0.28, r1: 0.16, lean: 2.5, wobble: 0.2, buttress: 0, bark: PALE, limbs: 5, limbR: 0.13, spread: 4.0, crownY: 12.5, clumpR: 3.4, flat: 0.5, subClumps: 2, cards: 26, loCards: 9, card: 3.4, cell: LEAF_CELLS.young, topClump: false }),
  },
  { name: 'palm', share: 0.1, scale: [0.8, 1.2], build: palmRecipe, lowland: true },
  { name: 'shrub', share: 0.12, scale: [0.8, 1.6], build: shrubRecipe, edge: true },
];
