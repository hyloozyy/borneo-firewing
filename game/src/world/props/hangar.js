// Arched-roof maintenance hangar for the water bomber: corrugated zinc barrel roof with real
// thickness and steel ribs, corrugated side walls with a clerestory window strip, a gable with the
// base sign, red-and-white sliding doors standing half open on their track, a lit interior with
// crates and a workbench, an office lean-to with lit windows and AC units, gutters and downpipes.
// Built in its own frame: span along X, depth along Z, doors facing +Z.
import * as THREE from 'three';
import { sweptSheet, slab } from './prop-builder.js';

const SPAN = 36, WALL = 6, RISE = 8.5, DEPTH = 40;

function archProfile(radiusX, rise, base, segs = 28) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = Math.PI - (i / segs) * Math.PI; // left to right, so the sheet's normals face out
    pts.push([radiusX * Math.cos(t), base + rise * Math.sin(t)]);
  }
  return pts;
}

export function addHangar(b) {
  const hx = SPAN / 2, hz = DEPTH / 2;
  // Plinth and floor.
  b.box('concrete', SPAN + 2, 0.5, DEPTH + 2, { y: 0.25, tile: 7.5 });
  // Barrel roof with steel ribs and a ridge vent.
  b.add('zinc', sweptSheet(archProfile(hx, RISE, WALL), DEPTH, 0.22, 2), { uvScale: [1 / 2.2, 1 / 2.2] });
  for (let z = -hz; z <= hz + 0.01; z += DEPTH / 6) {
    b.add('steel', sweptSheet(archProfile(hx + 0.2, RISE + 0.2, WALL), 0.35, 0.3), { z, uvScale: [0.5, 0.5] });
  }
  b.box('steel', 1.6, 0.5, DEPTH + 0.6, { y: WALL + RISE + 0.45, tile: 3 });
  // Side walls with a clerestory strip of windows and the eaves gutters.
  for (const s of [-1, 1]) {
    b.box('zincWhite', 0.25, WALL, DEPTH, { x: s * hx, y: WALL / 2 + 0.5, tile: 2.2 });
    b.box('steelWhite', 0.6, 0.3, DEPTH + 0.4, { x: s * (hx + 0.3), y: WALL + 0.3, tile: 3 }); // gutter
    for (let z = -hz + 4; z < hz - 2; z += 6) {
      b.box('glass', 0.08, 1.4, 4.2, { x: s * (hx + 0.14), y: 4.3, z });
      b.box('steelWhite', 0.16, 0.14, 4.5, { x: s * (hx + 0.18), y: 5.05, z, tile: 2 });
      b.box('steelWhite', 0.16, 0.14, 4.5, { x: s * (hx + 0.18), y: 3.55, z, tile: 2 });
      b.box('steelWhite', 0.16, 1.4, 0.12, { x: s * (hx + 0.18), y: 4.3, z, tile: 2 });
    }
    for (const z of [-hz - 0.1, hz + 0.1]) b.beam('steelWhite', [s * (hx + 0.45), WALL + 0.2, z], [s * (hx + 0.45), 0.5, z], 0.18, { round: true }); // downpipes
  }
  // Gables: front with the door opening and the sign, back closed.
  const prof = archProfile(hx, RISE, WALL);
  const outline = [[-hx, 0.5], [hx, 0.5], ...prof.slice().reverse().map(([x, y]) => [x, y])];
  const doorW = 30, doorH = 9;
  const front = [[-hx, 0.5], [-doorW / 2, 0.5], [-doorW / 2, doorH], [doorW / 2, doorH], [doorW / 2, 0.5], ...outline.slice(1)];
  b.add('zincWhite', slab(front, 0.25), { z: hz, tile: 2.2 });
  b.add('zincWhite', slab(outline, 0.25), { z: -hz, tile: 2.2 });
  b.box('steel', doorW + 2, 0.6, 0.5, { y: doorH + 0.3, z: hz + 0.35, tile: 3 }); // door track
  b.box('signBase', 17, 3.5, 0.1, { y: doorH + 2.9, z: hz + 0.2, uvScale: [1, 1] });
  b.box('steelWhite', 17.6, 4.1, 0.08, { y: doorH + 2.9, z: hz + 0.15, tile: 2 });
  // Sliding doors: two panels stacked open each side, alternating red and white, with a stripe.
  const panelW = 5.3;
  [[-doorW / 2 + panelW / 2, 0], [-doorW / 2 + panelW * 0.95, 1], [doorW / 2 - panelW / 2, 0], [doorW / 2 - panelW * 0.95, 1]].forEach(([x, layer], i) => {
    const z = hz + 0.55 + layer * 0.28;
    b.box(i % 2 ? 'zincWhite' : 'zincRed', panelW, doorH - 0.6, 0.12, { x, y: 0.5 + (doorH - 0.6) / 2, z, tile: 2.2 });
    b.box(i % 2 ? 'zincRed' : 'zincWhite', panelW, 0.7, 0.14, { x, y: 3.2, z, tile: 2.2 });
    b.box('steel', panelW, 0.18, 0.2, { x, y: 0.62, z, tile: 2 });
    b.box('steel', 0.12, doorH - 0.6, 0.18, { x: x - panelW / 2 + 0.06, y: 0.5 + (doorH - 0.6) / 2, z, tile: 2 });
  });
  // Interior: dark floor, lamps under the roof, back wall, crates, workbench, tool cabinets, spare prop.
  b.box('interior', SPAN - 0.6, 0.05, DEPTH - 0.6, { y: 0.53 });
  b.box('interiorLit', SPAN - 1, WALL + RISE - 2, 0.1, { y: (WALL + RISE) / 2, z: -hz + 0.4 });
  for (const z of [-hz + 8, 0, hz - 8]) for (const x of [-8, 0, 8]) {
    b.box('lamp', 1.6, 0.12, 0.5, { x, y: WALL + RISE - 1.6 - Math.abs(x) * 0.12, z });
    b.beam('steel', [x, WALL + RISE - 1.5 - Math.abs(x) * 0.12, z], [x, WALL + RISE - 0.3 - Math.abs(x) * 0.05, z], 0.05, { round: true });
  }
  for (const [x, z, w, h, d] of [[-14, -14, 2.4, 1.6, 1.6], [-14, -11.8, 1.6, 1.2, 1.4], [-11.6, -14, 1.8, 2.2, 1.6], [13.5, 8, 2, 1.4, 1.4], [14, 10.5, 1.6, 1, 1.2]]) {
    b.box('wood', w, h, d, { x, y: 0.5 + h / 2, z, tile: 1.2 });
  }
  b.box('steelRed', 0.6, 2, 3.6, { x: hx - 0.7, y: 1.5, z: -8, tile: 1 }); // tool cabinets
  b.box('steelBlue', 0.6, 2, 2.4, { x: hx - 0.7, y: 1.5, z: -11.5, tile: 1 });
  b.box('wood', 4, 0.12, 1.2, { x: -hx + 1.2, y: 1.4, z: 4, ry: Math.PI / 2, tile: 1 }); // workbench
  for (const dz of [-1.7, 1.7]) b.box('steel', 0.1, 0.9, 1, { x: -hx + 1.2, y: 0.95, z: 4 + dz, tile: 1 });
  for (let i = 0; i < 4; i++) { // spare four-blade propeller on a stand
    const a = (i / 4) * Math.PI * 2 + 0.4;
    b.add('steel', new THREE.BoxGeometry(0.28, 1.7, 0.06), { x: -8 + Math.cos(a) * 0.95, y: 2.6 + Math.sin(a) * 0.95, z: -15, rz: a - Math.PI / 2, tile: 1 });
  }
  b.add('chrome', new THREE.SphereGeometry(0.32, 12, 8), { x: -8, y: 2.6, z: -14.9 });
  b.beam('steel', [-8, 0.5, -15], [-8, 2.3, -15], 0.12, { round: true });
  // Office lean-to on the east side: plank walls, lit windows, shed roof, AC units, door with steps.
  b.push(hx + 4, 0, 6);
  b.box('concrete', 8.4, 0.4, 12.4, { y: 0.2, tile: 3 });
  b.box('woodCream', 8, 3.4, 12, { y: 2.1, tile: 2 });
  b.box('zincRust', 9.2, 0.16, 13.4, { y: 4.05, rz: 0.12, tile: 2.2 });
  for (const z of [-3.5, 0.5, 4]) {
    b.box('glassLit', 0.08, 1.2, 1.8, { x: 4.03, y: 2.4, z });
    b.box('woodDark', 0.14, 0.12, 2.1, { x: 4.08, y: 1.75, z, tile: 1 });
    b.box('woodDark', 0.14, 0.12, 2.1, { x: 4.08, y: 3.05, z, tile: 1 });
  }
  b.box('woodDark', 0.1, 2.2, 1.1, { x: 4.04, y: 1.6, z: -5.6, tile: 1 });
  b.box('steelWhite', 0.7, 0.6, 1, { x: 4.4, y: 2.9, z: 2.3, tile: 1 });
  b.box('steelWhite', 0.7, 0.6, 1, { x: 4.4, y: 2.9, z: -1.6, tile: 1 });
  for (let i = 0; i < 3; i++) b.box('concrete', 0.5, 0.18 * (i + 1), 1.4, { x: 4.3 + (2 - i) * 0.45, y: 0.09 * (i + 1), z: -5.6, tile: 1 });
  b.pop();
}
