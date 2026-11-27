// Kalimantan rumah panggung (stilt house) and the rumah betang (longhouse), built from real parts:
// ironwood stilts with cross-bracing, joists and a plank floor, plank walls (bare or painted),
// framed windows with open shutters (some lit at dusk), a door, a railed front veranda under the
// roof, a gable roof of ironwood shingles, rusty zinc or nipah thatch with real thickness, fascia
// boards, ridge cap and gable vents, and steps down to the ground.
// Local frame: ground at y = 0, ridge along X, front (veranda) toward +Z.
import * as THREE from 'three';
import { slab, roofPlane } from './prop-builder.js';

function windowAt(b, { x, y, z, ry = 0, lit, w = 0.9, h = 0.9, wall }) {
  b.push(x, y, z, ry);
  b.box(lit ? 'glassLit' : 'interior', w, h, 0.04, { z: 0.02 });
  b.box('woodDark', w + 0.2, 0.1, 0.1, { y: h / 2 + 0.05, z: 0.04, tile: 1 });
  b.box('woodDark', w + 0.3, 0.08, 0.16, { y: -h / 2 - 0.04, z: 0.06, tile: 1 });
  for (const s of [-1, 1]) {
    b.box('woodDark', 0.08, h, 0.1, { x: s * (w / 2 + 0.04), z: 0.04, tile: 1 });
    // Shutter swung open on its hinge.
    b.box(wall, w / 2, h, 0.04, { x: s * (w / 2 + 0.08 + Math.cos(1.1) * w / 4), z: 0.08 + Math.sin(1.1) * w / 4, ry: -s * 1.1, tile: 1.2 });
  }
  b.pop();
}

function railing(b, x0, x1, z, y, step = 1.4) {
  const n = Math.max(1, Math.round((x1 - x0) / step));
  for (let i = 0; i <= n; i++) b.box('woodDark', 0.1, 0.95, 0.1, { x: x0 + ((x1 - x0) * i) / n, y: y + 0.47, z, tile: 1 });
  b.box('wood', x1 - x0, 0.08, 0.12, { x: (x0 + x1) / 2, y: y + 0.95, z, tile: 1.5 });
  b.box('wood', x1 - x0, 0.06, 0.06, { x: (x0 + x1) / 2, y: y + 0.45, z, tile: 1.5 });
  for (let x = x0 + 0.25; x < x1; x += 0.28) b.box('wood', 0.04, 0.42, 0.04, { x, y: y + 0.7, z, tile: 1 });
}

function roof(b, { w, D, zc, eaveY, pitch, mat, over = 0.7, gableOver = 0.6 }) {
  const half = D / 2 + over;
  const run = half / Math.cos(pitch), rise = half * Math.tan(pitch);
  const ridgeY = eaveY + (D / 2) * Math.tan(pitch);
  const len = w + gableOver * 2;
  const thick = mat === 'thatch' ? 0.35 : 0.12;
  for (const s of [1, -1]) {
    b.add(mat, roofPlane(len, run, pitch, thick), { uvLocal: true, ry: s > 0 ? 0 : Math.PI, x: 0, y: ridgeY + 0.02, z: zc, tile: 2 });
    // Fascia board along the eave.
    b.box('woodDark', len, 0.22, 0.05, { y: ridgeY - rise - 0.08, z: zc + s * (half + 0.02), tile: 1.5 });
  }
  b.box(mat === 'thatch' ? 'thatch' : 'woodDark', len + 0.1, 0.18, 0.4, { y: ridgeY + 0.1, z: zc, tile: 1.5 }); // ridge cap
  return ridgeY;
}

// opts: w, d, legH, wallH, veranda, wall material, roof material, rnd (0..1 generator), lit
export function addStiltHouse(b, { w = 7, d = 6, legH = 2.4, wallH = 2.5, veranda = 1.8, wall = 'wood', roofMat = 'shingle', rnd = Math.random, lit = 0.5 }) {
  const D = d + veranda, zc = veranda / 2; // floor spans z from -d/2 to d/2 + veranda
  const floorY = legH;
  // Stilts on a grid, cross-bracing, footing stones.
  const xs = [], zs = [];
  for (let x = -w / 2; x <= w / 2 + 0.01; x += w / Math.max(2, Math.round(w / 2.2))) xs.push(x);
  for (let z = -d / 2; z <= d / 2 + veranda + 0.01; z += (d + veranda) / Math.max(2, Math.round((d + veranda) / 2.2))) zs.push(z);
  for (const x of xs) for (const z of zs) {
    b.box('woodDark', 0.2, legH + 0.3, 0.2, { x, y: (legH - 0.3) / 2, z, tile: 1.2 });
    b.box('rock', 0.45, 0.25, 0.45, { x, y: 0.05, z, tile: 1 });
  }
  for (let i = 0; i < xs.length - 1; i += 2) for (const z of [zs[0], zs[zs.length - 1]]) {
    b.beam('woodDark', [xs[i], 0.3, z], [xs[i + 1], legH - 0.3, z], 0.09);
  }
  for (const x of [xs[0], xs[xs.length - 1]]) b.beam('woodDark', [x, 0.3, zs[0]], [x, legH - 0.3, zs[zs.length - 1]], 0.09);
  // Joists and plank floor.
  for (const z of zs) b.box('woodDark', w + 0.4, 0.22, 0.16, { y: floorY - 0.14, z, tile: 1.5 });
  b.box('wood', w + 0.5, 0.1, D + 0.2, { y: floorY + 0.02, z: zc, tile: 2 });
  // Walls (front wall at z = d/2, veranda in front of it).
  const wy = floorY + 0.07 + wallH / 2;
  b.box(wall, w, wallH, 0.1, { y: wy, z: d / 2, tile: 2 });
  b.box(wall, w, wallH, 0.1, { y: wy, z: -d / 2, tile: 2 });
  b.box(wall, 0.1, wallH, d, { x: w / 2, y: wy, tile: 2 });
  b.box(wall, 0.1, wallH, d, { x: -w / 2, y: wy, tile: 2 });
  for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) b.box('woodDark', 0.16, wallH + 0.1, 0.16, { x, y: wy, z, tile: 1 });
  b.box('woodDark', w + 0.2, 0.14, 0.14, { y: floorY + wallH + 0.05, z: d / 2 + 0.02, tile: 1.5 });
  // Door and windows.
  const dx = (rnd() - 0.5) * w * 0.3;
  b.box('woodDark', 0.95, 1.95, 0.05, { x: dx, y: floorY + 1.05, z: d / 2 + 0.06, tile: 1 });
  b.box('woodDark', 1.15, 0.1, 0.1, { x: dx, y: floorY + 2.05, z: d / 2 + 0.07, tile: 1 });
  const winY = floorY + 1.45;
  for (const x of [-w / 2 + 1.1, w / 2 - 1.1]) if (Math.abs(x - dx) > 1.3) windowAt(b, { x, y: winY, z: d / 2 + 0.05, lit: rnd() < lit, wall });
  for (const s of [-1, 1]) windowAt(b, { x: s * (w / 2 + 0.05), y: winY, z: 0, ry: s * Math.PI / 2, lit: rnd() < lit, wall });
  windowAt(b, { x: 0, y: winY, z: -d / 2 - 0.05, ry: Math.PI, lit: rnd() < lit * 0.6, wall });
  // Veranda railing, roof posts and steps.
  const vz = d / 2 + veranda;
  railing(b, -w / 2, dx - 0.8, vz, floorY + 0.07);
  railing(b, dx + 0.8, w / 2, vz, floorY + 0.07);
  for (const s of [-1, 1]) { b.push(s * w / 2, 0, 0, Math.PI / 2); railing(b, -vz, -d / 2, 0, floorY + 0.07); b.pop(); }
  for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) b.box('woodDark', 0.14, wallH + 0.3, 0.14, { x, y: floorY + (wallH + 0.3) / 2, z: vz, tile: 1 });
  const steps = Math.ceil(legH / 0.3);
  for (let i = 0; i < steps; i++) {
    const t = (i + 1) / steps;
    b.box('wood', 1.3, 0.06, 0.3, { x: dx, y: floorY - t * legH + 0.05, z: vz + 0.2 + t * legH * 0.7, tile: 1 });
  }
  for (const s of [-1, 1]) b.beam('woodDark', [dx + s * 0.68, floorY, vz + 0.1], [dx + s * 0.68, 0, vz + 0.25 + legH * 0.7], 0.1);
  // Gable roof with gable infill and vents.
  const pitch = roofMat === 'thatch' ? 0.72 : 0.55;
  const eaveY = floorY + wallH + 0.12;
  const ridgeY = roof(b, { w, D, zc, eaveY, pitch, mat: roofMat });
  const tri = [[-D / 2, 0], [D / 2, 0], [0, ridgeY - eaveY]];
  for (const s of [-1, 1]) {
    b.add(wall, slab(tri, 0.08), { x: s * (w / 2 + 0.02), y: eaveY, z: zc, ry: Math.PI / 2, tile: 2 });
    b.add('interior', slab([[-0.4, 0], [0.4, 0], [0, 0.45]], 0.04), { x: s * (w / 2 + 0.08), y: eaveY + (ridgeY - eaveY) * 0.45, z: zc, ry: Math.PI / 2 });
  }
}

// Rumah betang: a long communal house on tall posts with a roofed open gallery (ruai) along the
// front, many family doors, a notched-log ladder, crossed carved horn finials on the ridge ends.
export function addLonghouse(b, { w = 56, d = 9, rnd = Math.random }) {
  const legH = 3.8, wallH = 2.8, veranda = 4;
  addStiltHouse(b, { w, d, legH, wallH, veranda, wall: 'wood', roofMat: 'shingle', rnd, lit: 0.8 });
  // Family doors along the front wall, between the windows.
  for (let x = -w / 2 + 4; x < w / 2 - 3; x += 6) {
    b.box('woodDark', 0.9, 1.95, 0.05, { x, y: legH + 1.05, z: d / 2 + 0.06, tile: 1 });
    windowAt(b, { x: x + 2.5, y: legH + 1.5, z: d / 2 + 0.05, lit: rnd() < 0.7, wall: 'woodOchre' });
  }
  // Notched log ladder (tangga) up to the gallery.
  const vz = d / 2 + veranda;
  b.beam('woodDark', [6, 0, vz + legH * 0.55], [6, legH + 0.1, vz - 0.1], 0.36, { round: true, tile: 1.5 });
  for (let i = 1; i < 9; i++) b.box('wood', 0.42, 0.05, 0.2, { x: 6, y: (legH * i) / 9, z: vz + legH * 0.55 * (1 - i / 9) + 0.12, tile: 1 });
  // Crossed horn finials at the ridge ends and painted fascia boards.
  const pitch = 0.55, ridgeY = legH + wallH + 0.12 + ((d + veranda) / 2) * Math.tan(pitch), zc = veranda / 2;
  for (const s of [-1, 1]) {
    const x = s * (w / 2 + 0.7);
    b.beam('woodDark', [x, ridgeY - 0.6, zc - 1.2], [x, ridgeY + 1.6, zc + 0.9], 0.14);
    b.beam('woodDark', [x, ridgeY - 0.6, zc + 1.2], [x, ridgeY + 1.6, zc - 0.9], 0.14);
    b.add('woodOchre', new THREE.ConeGeometry(0.16, 0.6, 6), { x, y: ridgeY + 1.85, z: zc + 1.05, rx: 0.75, tile: 1 });
    b.add('woodOchre', new THREE.ConeGeometry(0.16, 0.6, 6), { x, y: ridgeY + 1.85, z: zc - 1.05, rx: -0.75, tile: 1 });
  }
  for (let x = -w / 2 + 1.5; x < w / 2 - 1; x += 3) b.box(Math.round(x / 3) % 2 ? 'woodOchre' : 'steelRed', 2.9, 0.3, 0.04, { x, y: legH - 0.25, z: vz + 0.1, tile: 1 });
}

// Carved guardian post (sapundu-style): a tall ironwood pole with stacked carved rings and a
// hornbill on top.
export function addCarvedPost(b, x, z, h = 5.5) {
  b.push(x, 0, z);
  b.add('woodDark', new THREE.CylinderGeometry(0.22, 0.28, h, 10), { y: h / 2, tile: 1.5 });
  for (let i = 0; i < 4; i++) b.add(i % 2 ? 'woodOchre' : 'woodDark', new THREE.CylinderGeometry(0.34, 0.3, 0.35, 10), { y: 1.2 + i * 1.0, tile: 1 });
  b.add('woodDark', new THREE.SphereGeometry(0.3, 10, 8), { y: h + 0.15, sz: 1.4 });
  b.add('woodOchre', new THREE.ConeGeometry(0.1, 0.7, 8), { y: h + 0.15, z: 0.65, rx: Math.PI / 2 + 0.3 });
  b.add('steelRed', new THREE.SphereGeometry(0.1, 8, 6), { y: h + 0.38, z: 0.35, sz: 2 });
  b.pop();
}
