// Small airfield control tower: a concrete base block with lit windows, a square shaft with an
// external steel staircase, an octagonal cab of outward-raked glass on mullions (lit consoles
// inside), a railed walkway, an overhanging roof with an antenna mast, an obstruction light and
// the rotating aerodrome beacon (returned so it can turn). Built in its own frame at ground level.
import * as THREE from 'three';

const CAB = 13; // cab floor height

export function addControlTower(b) {
  // Base block.
  b.box('concreteWhite', 9, 3.6, 9, { y: 1.8, tile: 7.5 });
  b.box('concrete', 9.6, 0.3, 9.6, { y: 3.75, tile: 3 });
  for (const [x, z, ry] of [[4.52, -2, Math.PI / 2], [4.52, 2, Math.PI / 2], [-2, 4.52, 0], [2, 4.52, 0]]) {
    b.box('glassLit', ry ? 0.06 : 1.6, 1.1, ry ? 1.6 : 0.06, { x, y: 2.2, z });
  }
  b.box('woodDark', 1.1, 2.2, 0.08, { x: -2.6, y: 1.1, z: -4.52, tile: 1 });
  // Shaft and its window slots.
  b.box('concreteWhite', 4.2, CAB - 3.6, 4.2, { y: 3.6 + (CAB - 3.6) / 2, tile: 7.5 });
  for (let y = 5.5; y < CAB - 1; y += 2.6) b.box('glass', 0.7, 1.1, 0.06, { y, z: 2.13 });
  // Cab: solid lower band, raked glazing, mullions, consoles and the roof.
  b.add('concreteWhite', new THREE.CylinderGeometry(3.7, 3.4, 1.1, 8), { y: CAB + 0.55, ry: Math.PI / 8, tile: 3 });
  b.add('interiorLit', new THREE.CylinderGeometry(3.6, 3.6, 0.9, 8), { y: CAB + 1.4, ry: Math.PI / 8 });
  b.add('interior', new THREE.CylinderGeometry(1.2, 1.2, 3.2, 8), { y: CAB + 2.5 });
  b.add('glassTower', new THREE.CylinderGeometry(4.25, 3.7, 3.0, 8, 1, true), { y: CAB + 2.6, ry: Math.PI / 8 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.beam('steel', [Math.cos(a) * 3.72, CAB + 1.1, Math.sin(a) * 3.72], [Math.cos(a) * 4.27, CAB + 4.1, Math.sin(a) * 4.27], 0.12);
  }
  b.add('steelWhite', new THREE.CylinderGeometry(5.0, 4.5, 0.5, 8), { y: CAB + 4.35, ry: Math.PI / 8, tile: 2 });
  b.add('steel', new THREE.CylinderGeometry(2.2, 2.6, 0.5, 8), { y: CAB + 4.85, ry: Math.PI / 8, tile: 2 });
  // Walkway with railing at cab level.
  b.add('concrete', new THREE.CylinderGeometry(5.3, 5.3, 0.25, 8), { y: CAB - 0.1, ry: Math.PI / 8, tile: 3 });
  const R = 5.15;
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2, a1 = ((i + 1) / 8) * Math.PI * 2;
    const p0 = [Math.cos(a0) * R, 0, Math.sin(a0) * R], p1 = [Math.cos(a1) * R, 0, Math.sin(a1) * R];
    b.beam('steelYellow', [p0[0], CAB, p0[2]], [p0[0], CAB + 1.1, p0[2]], 0.07, { round: true });
    b.beam('steelYellow', [p0[0], CAB + 1.1, p0[2]], [p1[0], CAB + 1.1, p1[2]], 0.07, { round: true });
    b.beam('steelYellow', [p0[0], CAB + 0.55, p0[2]], [p1[0], CAB + 0.55, p1[2]], 0.05, { round: true });
  }
  // External staircase up the west face: flights with stringers, landings and handrails.
  const flights = 4, rise = (CAB - 0.2) / flights;
  for (let f = 0; f < flights; f++) {
    const dir = f % 2 ? -1 : 1, y0 = f * rise, z0 = -dir * 1.7, x = -3.3;
    for (let s = 0; s < 9; s++) {
      const t = s / 9;
      b.box('steel', 1.1, 0.06, 0.4, { x, y: y0 + t * rise + 0.1, z: z0 + dir * t * 3.4, tile: 1 });
    }
    b.beam('steel', [x - 0.58, y0, z0], [x - 0.58, y0 + rise, z0 + dir * 3.4], 0.12);
    b.beam('steel', [x + 0.58, y0, z0], [x + 0.58, y0 + rise, z0 + dir * 3.4], 0.12);
    b.beam('steelYellow', [x - 0.6, y0 + 1, z0], [x - 0.6, y0 + rise + 1, z0 + dir * 3.4], 0.05, { round: true });
    b.box('steel', 1.2, 0.1, 1.2, { x, y: y0 + rise, z: z0 + dir * 3.9, tile: 1 });
    b.beam('steel', [x - 0.6, 0, z0 + dir * 3.9], [x - 0.6, y0 + rise, z0 + dir * 3.9], 0.1);
  }
  // Mast, obstruction light, beacon.
  b.beam('steelWhite', [1.2, CAB + 5, 1.2], [1.2, CAB + 10, 1.2], 0.12, { round: true });
  b.beam('steel', [1.2, CAB + 7.5, 0.4], [1.2, CAB + 7.5, 2], 0.05, { round: true });
  b.add('lampRed', new THREE.SphereGeometry(0.22, 10, 6), { x: 1.2, y: CAB + 10.15, z: 1.2 });
  b.add('steel', new THREE.CylinderGeometry(0.35, 0.45, 0.6, 10), { x: -1, y: CAB + 5.4, z: -0.6 });
}

// Rotating aerodrome beacon (green / white), placed on the tower roof by the caller.
export function towerBeacon(palette) {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.45, 12), palette.steel);
  g.add(head);
  const w = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), palette.lamp);
  w.position.set(0.28, 0, 0);
  const gr = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), palette.lampGreen);
  gr.position.set(-0.28, 0, 0);
  g.add(w, gr);
  g.position.set(-1, CAB + 5.95, -0.6);
  return g;
}
