// Layered rainforest: tall dipterocarps, broadleaf canopy, palms and ferns as instanced meshes.
import * as THREE from 'three';
import { mergeParts, paint, placed } from '../core/geometry-utils.js';
import { rand, randRange } from '../core/rng.js';
import { terrainHeight, isOnRunway, PLACES, riverDistance } from './terrain.js';

function crownBlob(x, y, z, r, color, flat = 0.6) {
  return placed(paint(new THREE.IcosahedronGeometry(r, 1), color), { x, y, z, sy: flat });
}

function dipterocarpGeometry() {
  const parts = [paint(placed(new THREE.CylinderGeometry(0.55, 1.1, 30, 7), { y: 15 }), 0xb8ab94)];
  parts.push(paint(placed(new THREE.CylinderGeometry(0.12, 0.3, 7, 4), { x: 2.5, y: 27, rz: -0.9 }), 0x9d917b));
  parts.push(paint(placed(new THREE.CylinderGeometry(0.12, 0.3, 7, 4), { x: -2.4, y: 28, rz: 0.8 }), 0x9d917b));
  parts.push(crownBlob(0, 32, 0, 7.5, 0x2f5a1f, 0.42));
  parts.push(crownBlob(4.8, 30.5, 1.5, 5.2, 0x3b6b24, 0.5));
  parts.push(crownBlob(-4.5, 31, -1.8, 5.5, 0x295019, 0.5));
  parts.push(crownBlob(0.6, 34.2, -3.5, 4.6, 0x46792b, 0.5));
  return mergeParts(parts);
}

function broadleafGeometry() {
  const parts = [paint(placed(new THREE.CylinderGeometry(0.35, 0.6, 12, 6), { y: 6 }), 0x5e4a36)];
  parts.push(crownBlob(0, 13, 0, 5.2, 0x24491a, 0.7));
  parts.push(crownBlob(3, 11.5, 1, 3.8, 0x2e5a1e, 0.75));
  parts.push(crownBlob(-2.6, 12, -1.6, 3.6, 0x1f4016, 0.75));
  return mergeParts(parts);
}

function palmGeometry() {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    parts.push(paint(placed(new THREE.CylinderGeometry(0.26, 0.32, 3.2, 5), { x: i * i * 0.05, y: 1.6 + i * 3, rz: -0.03 * i }), 0x7a6648));
  }
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const leaf = paint(new THREE.BoxGeometry(0.9, 0.08, 5.5), i % 2 ? 0x4e7d2a : 0x3d6b22);
    leaf.translate(0, 0, 2.6);
    leaf.rotateX(0.45 + (i % 3) * 0.1);
    leaf.rotateY(a);
    leaf.translate(0.8, 15.6, 0);
    parts.push(leaf);
  }
  parts.push(crownBlob(0.8, 15.4, 0, 0.8, 0x5a4a1e, 1));
  return mergeParts(parts);
}

function fernGeometry() {
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const f = paint(new THREE.ConeGeometry(0.7, 4.2, 4), i % 2 ? 0x4f8a2c : 0x3a6e22);
    f.rotateX(Math.PI / 2 - 0.6);
    f.translate(0, 1.2, 1.6);
    f.rotateY((i / 7) * Math.PI * 2);
    parts.push(f);
  }
  return mergeParts(parts);
}

function treeAllowed(x, z, h) {
  if (h < 3.5) return false;
  if (isOnRunway(x, z, 110)) return false;
  if (Math.hypot(x - PLACES.village.x, z - PLACES.village.z) < 170) return false;
  if (riverDistance(x, z) < 40) return false;
  return true;
}

export function buildForest(scene, quality) {
  const kinds = [
    { geo: dipterocarpGeometry(), share: 0.18, scale: [0.75, 1.25] },
    { geo: broadleafGeometry(), share: 0.48, scale: [0.8, 1.6] },
    { geo: palmGeometry(), share: 0.14, scale: [0.8, 1.15] },
    { geo: fernGeometry(), share: 0.2, scale: [0.9, 1.8] },
  ];
  const total = quality.trees;
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const trees = [];
  const meshes = kinds.map((k) => {
    const count = Math.floor(total * k.share);
    const mesh = new THREE.InstancedMesh(k.geo, mat, count);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const col = new THREE.Color();
    let placedCount = 0, tries = 0;
    while (placedCount < count && tries < count * 6) {
      tries++;
      // Denser near the action, sparser far away.
      const r = Math.pow(rand(), 0.75) * 4200;
      const a = rand() * Math.PI * 2;
      const x = 0 + Math.cos(a) * r, z = -300 + Math.sin(a) * r * 1.05;
      const h = terrainHeight(x, z);
      if (!treeAllowed(x, z, h)) continue;
      if (k === kinds[2] && h > 60 && rand() < 0.7) continue; // palms prefer lowlands
      const sc = randRange(k.scale[0], k.scale[1]);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2);
      s.set(sc, sc * randRange(0.85, 1.15), sc);
      p.set(x, h - 0.5, z);
      m.compose(p, q, s);
      mesh.setMatrixAt(placedCount, m);
      col.setHSL(0.22 + rand() * 0.1, 0.35 + rand() * 0.3, 0.75 + rand() * 0.35);
      mesh.setColorAt(placedCount, col);
      trees.push({ mesh, index: placedCount, x, z, base: col.clone(), burnt: 0 });
      placedCount++;
    }
    mesh.count = placedCount;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  });

  // Trees near the fire zone and the village can be scorched as the fire spreads.
  const burnable = trees.filter((t) => Math.hypot(t.x - PLACES.fire.x, t.z - PLACES.fire.z) < 1500);
  const charred = new THREE.Color(0x1c1612);
  return {
    meshes,
    trees,
    scorch(x, z, radius, amount) {
      const touched = new Set();
      for (const t of burnable) {
        const d = Math.hypot(t.x - x, t.z - z);
        if (d > radius) continue;
        t.burnt = Math.min(1, t.burnt + amount * (1 - d / radius));
        const c = t.base.clone().lerp(charred, t.burnt);
        t.mesh.setColorAt(t.index, c);
        touched.add(t.mesh);
      }
      for (const m of touched) m.instanceColor.needsUpdate = true;
    },
  };
}
