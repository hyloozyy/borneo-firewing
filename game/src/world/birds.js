// Rhinoceros hornbills: black bodies, white tails with a black band, big yellow-orange bill and
// upturned red casque, wings with white trailing panels and fingered primaries. Wings flex in two
// joints with a phase lag, and each bird alternates heavy flapping with long glides.
import * as THREE from 'three';
import { rand } from '../core/rng.js';
import { mergeParts, paint, placed } from '../core/geometry-utils.js';

function shapeGeo(points, color) {
  const s = new THREE.Shape();
  points.forEach(([x, z], i) => (i ? s.lineTo(x, z) : s.moveTo(x, z)));
  const g = new THREE.ShapeGeometry(s);
  g.rotateX(Math.PI / 2);
  return paint(g, color);
}

function bodyGeometry() {
  const body = paint(placed(new THREE.SphereGeometry(0.3, 12, 8), { sz: 2.2, sx: 0.9 }), 0x111111);
  const neck = paint(placed(new THREE.SphereGeometry(0.17, 10, 6), { z: -0.62, y: 0.08, sz: 1.4 }), 0x141414);
  const head = paint(placed(new THREE.SphereGeometry(0.15, 10, 6), { z: -0.86, y: 0.12 }), 0x0f0f0f);
  const bill = paint(placed(new THREE.ConeGeometry(0.085, 0.75, 8), { z: -1.3, y: 0.05, rx: -Math.PI / 2 - 0.18 }), 0xf3d34a);
  const billBase = paint(placed(new THREE.ConeGeometry(0.1, 0.25, 8), { z: -1.02, y: 0.1, rx: -Math.PI / 2 }), 0xe8c030);
  const casque = paint(placed(new THREE.SphereGeometry(0.09, 8, 6), { z: -1.08, y: 0.24, sz: 2.4, sy: 0.8, rx: 0.35 }), 0xe0461a);
  const tail = shapeGeo([[-0.16, 0.45], [0.16, 0.45], [0.24, 1.35], [-0.24, 1.35]], 0xf4f1e8);
  const band = placed(shapeGeo([[-0.2, 0.95], [0.2, 0.95], [0.22, 1.12], [-0.22, 1.12]], 0x121212), { y: -0.005 });
  const legs = paint(placed(new THREE.BoxGeometry(0.12, 0.05, 0.3), { z: 0.45, y: -0.18 }), 0x2a2a2a);
  return mergeParts([body, neck, head, bill, billBase, casque, tail, band, legs]);
}

// Wing pieces built along +X; the root sits at x=0.
function innerWingGeometry() {
  return mergeParts([
    shapeGeo([[0, -0.32], [0.95, -0.3], [0.95, 0.32], [0, 0.38]], 0x151515),
    placed(shapeGeo([[0.05, 0.2], [0.95, 0.18], [0.95, 0.34], [0.05, 0.38]], 0xeeeeee), { y: 0.004 }),
  ]);
}

function outerWingGeometry() {
  const parts = [shapeGeo([[0, -0.3], [0.45, -0.26], [0.55, 0.3], [0, 0.32]], 0x151515)];
  // Fingered primaries.
  for (let i = 0; i < 5; i++) {
    const z = -0.24 + i * 0.12;
    parts.push(shapeGeo([[0.42, z], [1.05 - i * 0.06, z + 0.02], [1.02 - i * 0.06, z + 0.09], [0.42, z + 0.1]], i > 2 ? 0xe9e9e9 : 0x111111));
  }
  return mergeParts(parts);
}

export function buildBirds(scene, flocks) {
  const bodyGeo = bodyGeometry();
  const innerGeo = innerWingGeometry();
  const outerGeo = outerWingGeometry();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide });
  const birds = [];
  const group = new THREE.Group();
  const centers = [[-600, 260, 700], [300, 320, -600], [-1300, 200, -900], [900, 280, 900], [100, 260, 1500]];
  for (let f = 0; f < flocks; f++) {
    const c = centers[f % centers.length];
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Group();
      b.add(new THREE.Mesh(bodyGeo, mat));
      const wings = [];
      for (const side of [1, -1]) {
        const root = new THREE.Group();
        root.position.set(side * 0.18, 0.08, -0.1);
        root.scale.x = side;
        const inner = new THREE.Mesh(innerGeo, mat);
        const elbow = new THREE.Group();
        elbow.position.x = 0.95;
        const outer = new THREE.Mesh(outerGeo, mat);
        elbow.add(outer);
        root.add(inner, elbow);
        b.add(root);
        wings.push({ root, elbow, side });
      }
      b.scale.setScalar(2.4);
      group.add(b);
      birds.push({ g: b, wings, cx: c[0] + i * 9, cy: c[1] + i * 3, cz: c[2], r: 70 + i * 14, ph: i * 0.45 + f, sp: 0.11 + rand() * 0.03, flap: rand() * 6, glide: rand() * 10 });
    }
  }
  scene.add(group);
  return {
    update(t) {
      for (const b of birds) {
        const a = t * b.sp + b.ph;
        b.g.position.set(b.cx + Math.cos(a) * b.r, b.cy + Math.sin(t * 0.3 + b.ph) * 6, b.cz + Math.sin(a) * b.r);
        b.g.rotation.set(0.05, Math.PI - a, -0.3);
        // Flap for a few beats, then glide with wings held slightly raised.
        const cycle = (t + b.glide) % 9;
        const flapping = cycle < 4 ? 1 : cycle < 4.6 ? 1 - (cycle - 4) / 0.6 : cycle > 8.4 ? (cycle - 8.4) / 0.6 : 0;
        const ph = t * 5.2 + b.flap;
        const beat = Math.sin(ph) * 0.65 * flapping + 0.08 * (1 - flapping);
        const tip = Math.sin(ph - 0.8) * 0.45 * flapping - 0.04 * (1 - flapping);
        for (const w of b.wings) {
          w.root.rotation.z = beat * w.side;
          w.elbow.rotation.z = tip;
        }
        b.g.position.y += Math.sin(ph + 1.2) * 0.25 * flapping;
      }
    },
  };
}
