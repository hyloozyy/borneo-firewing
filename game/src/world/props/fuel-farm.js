// Fuel farm and ground vehicles: a concrete bund with two horizontal jet-fuel tanks on saddles and
// a tall vertical tank with a caged ladder, pipework to a pump shed and dispenser, the AVTUR sign,
// oil drums, and a six-wheel fuel bowser and a fire-crew pickup parked on the apron.
import * as THREE from 'three';

function horizontalTank(b, x, z, len = 9, r = 1.6) {
  b.add('steelWhite', new THREE.CylinderGeometry(r, r, len, 24, 1, true), { x, y: 2.1, z, rx: Math.PI / 2, tile: 3 });
  for (const s of [-1, 1]) b.add('steelWhite', new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), { x, y: 2.1, z: z + s * len / 2, rx: s * Math.PI / 2, sy: 0.3, tile: 3 });
  b.add('steelRed', new THREE.CylinderGeometry(r + 0.02, r + 0.02, 0.8, 24, 1, true), { x, y: 2.1, z, rx: Math.PI / 2, tile: 3 });
  for (const dz of [-len / 3, 0, len / 3]) {
    b.box('concrete', r * 1.7, 0.7, 0.5, { x, y: 0.35, z: z + dz, tile: 1 });
    b.box('steel', r * 1.5, 0.4, 0.3, { x, y: 0.85, z: z + dz, tile: 1 });
  }
  b.add('steel', new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12), { x, y: 2.1 + r + 0.1, z: z - len / 4 });
  b.beam('steel', [x, 2.1 + r, z + len / 4], [x, 2.1 + r + 1.2, z + len / 4], 0.1, { round: true }); // vent
}

function verticalTank(b, x, z, r = 3, h = 6.5) {
  b.add('steelWhite', new THREE.CylinderGeometry(r, r, h, 28, 1, true), { x, y: h / 2 + 0.4, z, tile: 3 });
  b.add('steelWhite', new THREE.ConeGeometry(r + 0.1, 0.9, 28, 1, true), { x, y: h + 0.85, z, tile: 3 });
  b.add('steelRed', new THREE.CylinderGeometry(r + 0.02, r + 0.02, 0.7, 28, 1, true), { x, y: h - 0.8, z, tile: 3 });
  b.add('concrete', new THREE.CylinderGeometry(r + 0.4, r + 0.5, 0.4, 28), { x, y: 0.2, z, tile: 3 });
  // Caged ladder on the -X side and roof railing.
  const lx = x - r - 0.35;
  b.beam('steel', [lx, 0.4, z - 0.25], [lx, h + 0.4, z - 0.25], 0.06, { round: true });
  b.beam('steel', [lx, 0.4, z + 0.25], [lx, h + 0.4, z + 0.25], 0.06, { round: true });
  for (let y = 0.7; y < h + 0.4; y += 0.35) b.beam('steel', [lx, y, z - 0.25], [lx, y, z + 0.25], 0.035, { round: true });
  for (let y = 2.5; y < h + 1.2; y += 0.9) b.add('steelYellow', new THREE.TorusGeometry(0.45, 0.03, 4, 12, Math.PI), { x: lx - 0.05, y, z, rx: Math.PI / 2, rz: Math.PI / 2 });
  for (let i = 0; i < 10; i++) {
    const a0 = Math.PI * 0.6 + (i / 10) * Math.PI * 0.8, a1 = Math.PI * 0.6 + ((i + 1) / 10) * Math.PI * 0.8;
    const p0 = [x + Math.cos(a0) * (r - 0.2), z + Math.sin(a0) * (r - 0.2)], p1 = [x + Math.cos(a1) * (r - 0.2), z + Math.sin(a1) * (r - 0.2)];
    b.beam('steelYellow', [p0[0], h + 0.6, p0[1]], [p0[0], h + 1.6, p0[1]], 0.05, { round: true });
    b.beam('steelYellow', [p0[0], h + 1.6, p0[1]], [p1[0], h + 1.6, p1[1]], 0.05, { round: true });
  }
}

export function addFuelFarm(b) {
  // Bund walls around the tanks.
  const W = 24, D = 16;
  b.box('concrete', W, 0.05, D, { y: 0.03, tile: 7.5 });
  for (const s of [-1, 1]) {
    b.box('concrete', W, 0.9, 0.3, { y: 0.45, z: s * D / 2, tile: 3 });
    b.box('concrete', 0.3, 0.9, D, { x: s * W / 2, y: 0.45, tile: 3 });
  }
  horizontalTank(b, -6.5, 0);
  horizontalTank(b, -1.5, 0);
  verticalTank(b, 6.5, 0);
  // Pipework to the pump shed and dispenser outside the bund.
  b.beam('steel', [-6.5, 0.6, -4.5], [6.5, 0.6, -4.5], 0.22, { round: true });
  for (const x of [-6.5, -1.5]) b.beam('steel', [x, 0.6, -4.5], [x, 0.6, -2.6], 0.18, { round: true });
  b.beam('steel', [6.5, 0.6, -4.5], [6.5, 0.6, -3.1], 0.18, { round: true });
  b.beam('steel', [0, 0.6, -4.5], [0, 0.6, -10.5], 0.22, { round: true });
  for (let x = -6; x <= 6; x += 3) b.box('steel', 0.3, 0.5, 0.3, { x, y: 0.25, z: -4.5, tile: 1 });
  b.push(0, 0, -11.5);
  b.box('concrete', 4.6, 0.25, 3.6, { y: 0.12, tile: 3 });
  b.box('zincWhite', 4, 2.6, 3, { y: 1.55, tile: 2.2 });
  b.box('zincRed', 4.6, 0.14, 3.6, { y: 2.95, rx: 0.08, tile: 2.2 });
  b.box('woodDark', 1, 2, 0.06, { x: 0.8, y: 1.25, z: -1.53, tile: 1 });
  b.box('steelRed', 1, 1.9, 0.7, { x: -2.9, y: 0.95, z: -0.5, tile: 1 }); // dispenser
  b.add('rubber', new THREE.TorusGeometry(0.35, 0.05, 6, 16), { x: -2.9, y: 1.2, z: -0.9 });
  b.pop();
  // Sign on the bund.
  b.box('signFuel', 6.4, 1, 0.06, { x: 0, y: 1.6, z: D / 2 + 0.25, uvScale: [1, 1] });
  b.beam('steel', [-3, 0, D / 2 + 0.2], [-3, 2.1, D / 2 + 0.2], 0.08, { round: true });
  b.beam('steel', [3, 0, D / 2 + 0.2], [3, 2.1, D / 2 + 0.2], 0.08, { round: true });
  // Oil drums.
  for (let i = 0; i < 11; i++) {
    const x = W / 2 + 2 + (i % 4) * 0.66, z = -4 + Math.floor(i / 4) * 0.66;
    b.add(i % 3 ? 'drumRed' : 'drumBlue', new THREE.CylinderGeometry(0.29, 0.29, 0.88, 14), { x, y: 0.44, z, tile: 1 });
    b.add('steel', new THREE.TorusGeometry(0.29, 0.02, 4, 14), { x, y: 0.3, z, rx: Math.PI / 2 });
    b.add('steel', new THREE.TorusGeometry(0.29, 0.02, 4, 14), { x, y: 0.6, z, rx: Math.PI / 2 });
  }
}

function wheels(b, positions, r = 0.5) {
  for (const [x, z] of positions) {
    b.add('rubber', new THREE.CylinderGeometry(r, r, 0.32, 16), { x, y: r, z, rz: Math.PI / 2 });
    b.add('chrome', new THREE.CylinderGeometry(r * 0.5, r * 0.5, 0.34, 10), { x, y: r, z, rz: Math.PI / 2 });
  }
}

// Six-wheel fuel bowser, nose toward -Z.
export function addFuelBowser(b) {
  b.box('steel', 2.2, 0.35, 8.2, { y: 0.9, tile: 2 });
  b.box('steelWhite', 2.4, 2.1, 2.2, { y: 2.0, z: -3.0, tile: 2 }); // cab
  b.box('glass', 2.2, 0.9, 0.06, { y: 2.45, z: -4.12, rx: -0.12 });
  for (const s of [-1, 1]) b.box('glass', 0.06, 0.8, 1.2, { x: s * 1.21, y: 2.45, z: -3.4 });
  b.box('steelRed', 2.42, 0.35, 2.22, { y: 1.3, z: -3.0, tile: 2 });
  b.box('rubber', 2.5, 0.35, 0.3, { y: 0.85, z: -4.2 });
  b.add('lampAmber', new THREE.BoxGeometry(0.9, 0.18, 0.3), { y: 3.15, z: -3.0 });
  b.add('steelWhite', new THREE.CylinderGeometry(1.15, 1.15, 5.6, 22), { y: 2.3, z: 1.2, rx: Math.PI / 2, sx: 1.05, sz: 0.85, tile: 3 });
  b.add('steelRed', new THREE.CylinderGeometry(1.17, 1.17, 0.5, 22, 1, true), { y: 2.3, z: 1.2, rx: Math.PI / 2, sx: 1.05, sz: 0.85, tile: 3 });
  b.box('steel', 0.5, 0.12, 5, { y: 3.32, z: 1.2, tile: 1 });
  b.box('steel', 2.3, 1.0, 0.9, { y: 1.5, z: 4.4, tile: 1 }); // hose cabinet
  wheels(b, [[-1.05, -2.8], [1.05, -2.8], [-1.05, 1.8], [1.05, 1.8], [-1.05, 3.0], [1.05, 3.0]]);
}

// Fire-crew double-cab pickup, nose toward -Z.
export function addCrewPickup(b) {
  b.box('steelRed', 1.9, 0.75, 5.2, { y: 0.95, tile: 2 });
  b.box('steelRed', 1.85, 0.8, 2.6, { y: 1.7, z: -0.6, tile: 2 });
  b.box('glass', 1.7, 0.66, 0.05, { y: 1.72, z: -1.93, rx: -0.3 });
  for (const s of [-1, 1]) b.box('glass', 0.05, 0.5, 2.2, { x: s * 0.94, y: 1.78, z: -0.6 });
  b.box('steelWhite', 1.95, 0.12, 5.25, { y: 1.05, tile: 2 });
  b.add('lampRed', new THREE.BoxGeometry(1.1, 0.14, 0.26), { y: 2.17, z: -0.9 });
  b.box('steel', 0.08, 0.5, 2.2, { x: -0.9, y: 1.6, z: 1.6, tile: 1 });
  b.box('steel', 0.08, 0.5, 2.2, { x: 0.9, y: 1.6, z: 1.6, tile: 1 });
  b.add('rubber', new THREE.TorusGeometry(0.42, 0.14, 6, 14), { y: 1.55, z: 1.6, rx: Math.PI / 2 }); // hose reel
  wheels(b, [[-0.95, -1.6], [0.95, -1.6], [-0.95, 1.7], [0.95, 1.7]], 0.42);
}
