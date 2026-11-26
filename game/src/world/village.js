// Riverside village of rumah panggung (stilt houses) with a longhouse, jetty and boats.
import * as THREE from 'three';
import { mergeParts, paint, placed } from '../core/geometry-utils.js';
import { rand } from '../core/rng.js';
import { PLACES, terrainHeight } from './terrain.js';

function stiltHouse(w, d, roofColor) {
  const parts = [];
  const legH = 2.6;
  for (const sx of [-1, 1]) for (const sz of [-1, 0, 1]) {
    parts.push(paint(placed(new THREE.CylinderGeometry(0.12, 0.14, legH, 5), { x: sx * (w / 2 - 0.3), y: legH / 2, z: sz * (d / 2 - 0.3) }), 0x4b3824));
  }
  parts.push(paint(placed(new THREE.BoxGeometry(w + 1.2, 0.2, d + 1.0), { y: legH }), 0x6e5232));
  parts.push(paint(placed(new THREE.BoxGeometry(w, 2.6, d), { y: legH + 1.4 }), 0x9a7448));
  // Pitched roof built from a stretched triangular prism.
  const roof = new THREE.CylinderGeometry(1, 1, d + 1.4, 3, 1);
  placed(roof, { y: legH + 3.3, rx: Math.PI / 2, rz: Math.PI / 2, sx: 1.3, sy: 1, sz: (w + 1.4) / 1.6 });
  parts.push(paint(roof, roofColor));
  parts.push(paint(placed(new THREE.BoxGeometry(0.9, 1.6, 0.05), { y: legH + 1.0, z: d / 2 + 0.03 }), 0x3a2a1a));
  parts.push(paint(placed(new THREE.BoxGeometry(0.8, 0.7, 0.05), { x: w / 3, y: legH + 1.7, z: d / 2 + 0.03 }), 0xffc777));
  return mergeParts(parts);
}

export function buildVillage(scene) {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const roofs = [0x8a3b22, 0x6b4a2c, 0x9c5a2a, 0x5a6a6c];
  const houses = [];
  const v = PLACES.village;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rand() * 0.3;
    const r = 45 + rand() * 75;
    const x = v.x + Math.cos(a) * r, z = v.z + Math.sin(a) * r;
    const g = stiltHouse(6 + rand() * 3, 5 + rand() * 3, roofs[i % roofs.length]);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, terrainHeight(x, z) - 0.2, z);
    m.rotation.y = -a + Math.PI / 2;
    m.castShadow = true;
    group.add(m);
    houses.push(m);
  }
  // Longhouse (rumah betang) in the middle.
  const lh = new THREE.Mesh(stiltHouse(34, 8, 0x7a3a1c), mat);
  lh.position.set(v.x, terrainHeight(v.x, v.z), v.z);
  lh.rotation.y = 0.4;
  group.add(lh);
  houses.push(lh);
  // Lamps glowing in the dusk.
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffb760 });
  for (let i = 0; i < 10; i++) {
    const a = rand() * Math.PI * 2, r = 20 + rand() * 100;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 4), lampMat);
    lamp.position.set(v.x + Math.cos(a) * r, terrainHeight(v.x + Math.cos(a) * r, v.z + Math.sin(a) * r) + 3, v.z + Math.sin(a) * r);
    group.add(lamp);
  }
  scene.add(group);
  return { group, houses, center: new THREE.Vector3(v.x, v.h, v.z) };
}
