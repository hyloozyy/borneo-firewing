// Physical runway furniture under the light glows: edge and threshold light units on yellow stems,
// approach-light masts with crossbars and lamp housings stepping out from the threshold, PAPI
// housings on legs, the concrete apron with its taxiway and yellow guide lines, and a taxi sign.
// Coordinates are relative to the runway centre at runway ground level; groundAt(x, z) gives the
// local terrain height there.
import * as THREE from 'three';
import { PLACES } from '../terrain.js';

const lampHead = new THREE.SphereGeometry(0.11, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);

function lightUnit(b, x, y, z) {
  b.beam('steelYellow', [x, y, z], [x, y + 0.38, z], 0.07, { round: true });
  b.add('steel', new THREE.CylinderGeometry(0.12, 0.1, 0.1, 10), { x, y: y + 0.42, z });
  b.add('glassLit', lampHead, { x, y: y + 0.47, z });
}

export function addRunwayFixtures(b, groundAt) {
  const r = PLACES.runway, L = r.length, W = r.width;
  for (let z = -L / 2; z <= L / 2; z += 60) for (const s of [-1, 1]) lightUnit(b, s * (W / 2 + 2), groundAt(s * (W / 2 + 2), z), z);
  for (let x = -W / 2; x <= W / 2; x += 4) {
    for (const z of [L / 2 + 3, -L / 2 - 3]) {
      b.box('steel', 0.5, 0.12, 0.35, { x, y: groundAt(x, z) + 0.06, z, tile: 1 });
      b.add('glassLit', new THREE.BoxGeometry(0.34, 0.1, 0.06), { x, y: groundAt(x, z) + 0.12, z: z + (z > 0 ? -0.18 : 0.18) });
    }
  }
  // Approach lighting masts south of runway 36: frangible red/white masts, crossbar, five lamps.
  for (let i = 1; i <= 12; i++) {
    const z = L / 2 + i * 30;
    const g = groundAt(0, z);
    const top = Math.max(g + 1.4, 1.2);
    for (const x of [-6, 6]) {
      b.beam('steelRed', [x, g, z], [x, top, z], 0.16, { round: true });
      b.beam('steelWhite', [x, (g + top) / 2, z], [x, top, z], 0.17, { round: true });
      b.box('concrete', 0.7, 0.3, 0.7, { x, y: g + 0.1, z, tile: 1 });
    }
    b.beam('steel', [-9, top, z], [9, top, z], 0.12, { round: true });
    for (let x = -8; x <= 8; x += 4) {
      b.box('steel', 0.32, 0.3, 0.42, { x, y: top + 0.2, z, tile: 1 });
      b.add('glassLit', new THREE.CircleGeometry(0.12, 10), { x, y: top + 0.22, z: z - 0.22, ry: Math.PI });
    }
  }
  // PAPI housings (their lights are the glows in airstrip.js).
  for (let i = 0; i < 4; i++) {
    const x = -W / 2 - 14 - i * 5, z = L / 2 - 200, g = groundAt(x, z);
    b.box('steelYellow', 1.5, 0.7, 1.0, { x, y: g + 0.75, z, tile: 1 });
    b.box('steel', 1.2, 0.5, 0.05, { x, y: g + 0.78, z: z + 0.52, tile: 1 });
    for (const [lx, lz] of [[-0.6, -0.35], [0.6, -0.35], [0, 0.35]]) b.beam('steel', [x + lx, g, z + lz], [x + lx, g + 0.42, z + lz], 0.07, { round: true });
  }
  // Apron, taxiway and markings.
  const ap = PLACES.apron;
  const ax0 = ap.x0, ax1 = ap.x1 - 26, az0 = ap.z0 + 32, az1 = ap.z1 - 12;
  b.box('concrete', ax1 - ax0, 0.4, az1 - az0, { x: (ax0 + ax1) / 2, y: 0.12, z: (az0 + az1) / 2, tile: 7.5 });
  b.box('concrete', ax0 - W / 2 + 2, 0.36, 24, { x: (W / 2 + ax0) / 2, y: 0.1, z: 490, tile: 7.5 });
  b.box('paintYellow', ax0 - W / 2 + 30, 0.02, 0.35, { x: (W / 2 + ax0) / 2 + 14, y: 0.33, z: 490 });
  b.box('paintYellow', 0.35, 0.02, az1 - az0 - 30, { x: ax0 + 26, y: 0.33, z: (az0 + az1) / 2 });
  for (const z of [410, 550]) b.box('paintYellow', 12, 0.02, 0.35, { x: ax0 + 32, y: 0.33, z });
  b.box('paintWhite', 0.25, 0.02, az1 - az0 - 4, { x: ax0 + 2, y: 0.33, z: (az0 + az1) / 2 });
  // Taxi sign at the runway exit.
  b.push(W / 2 + 12, 0, 474);
  b.box('signTaxi', 2.6, 0.8, 0.12, { y: 0.9, ry: -Math.PI / 2, uvScale: [1, 1] });
  b.box('steel', 2.8, 1.0, 0.1, { y: 0.9, x: 0.08, ry: Math.PI / 2, tile: 1 });
  for (const z of [-1.1, 1.1]) b.beam('steel', [0.1, 0, z], [0.1, 0.5, z], 0.08, { round: true });
  b.pop();
}
