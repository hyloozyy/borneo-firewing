// Sky life: towering sunset cumulus made of lit puffs, and flocks of hornbills with flapping wings.
import * as THREE from 'three';
import { cloudTexture } from '../core/canvas-textures.js';
import { rand, randRange } from '../core/rng.js';
import { mergeParts, paint, placed } from '../core/geometry-utils.js';

export function buildClouds(scene, count) {
  const tex = cloudTexture();
  const group = new THREE.Group();
  const tints = [0xfff0dc, 0xffd8b0, 0xf4c8a8, 0xe8d6c8];
  for (let i = 0; i < count; i++) {
    const cx = randRange(-6500, 6500), cz = randRange(-7000, 5000), cy = randRange(700, 1300);
    const puffs = 5 + Math.floor(rand() * 6);
    for (let j = 0; j < puffs; j++) {
      const mat = new THREE.SpriteMaterial({ map: tex, color: tints[j % tints.length], transparent: true, opacity: 0.85, depthWrite: false });
      const s = new THREE.Sprite(mat);
      const sc = randRange(260, 520);
      s.scale.set(sc * 1.6, sc, 1);
      s.position.set(cx + randRange(-300, 300), cy + randRange(-60, 160) + j * 25, cz + randRange(-200, 200));
      group.add(s);
    }
  }
  scene.add(group);
  return { group, update(t) { group.position.x = Math.sin(t * 0.01) * 80; } };
}

function hornbillParts() {
  const body = paint(placed(new THREE.CapsuleGeometry(0.22, 0.7, 3, 6), { rx: Math.PI / 2 }), 0x161616);
  const tail = paint(placed(new THREE.BoxGeometry(0.35, 0.05, 0.8), { z: 0.75 }), 0xf2f0e8);
  const beak = paint(placed(new THREE.ConeGeometry(0.1, 0.6, 5), { z: -0.75, rx: -Math.PI / 2 }), 0xf0c020);
  const casque = paint(placed(new THREE.BoxGeometry(0.12, 0.12, 0.35), { y: 0.13, z: -0.6 }), 0xe0501c);
  return mergeParts([body, tail, beak, casque]);
}

export function buildBirds(scene, flocks) {
  const bodyGeo = hornbillParts();
  const wingGeo = mergeParts([
    paint(placed(new THREE.BoxGeometry(1.4, 0.04, 0.55), { x: 0.7 }), 0x1a1a1a),
    paint(placed(new THREE.BoxGeometry(0.5, 0.045, 0.5), { x: 1.15, z: 0.02 }), 0xeeeeee),
  ]);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const birds = [];
  const group = new THREE.Group();
  const centers = [[-600, 260, 700], [300, 320, -600], [-1300, 200, -900], [900, 280, 900], [100, 260, 1500]];
  for (let f = 0; f < flocks; f++) {
    const c = centers[f % centers.length];
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Group();
      b.add(new THREE.Mesh(bodyGeo, mat));
      const wl = new THREE.Mesh(wingGeo, mat);
      const wr = new THREE.Mesh(wingGeo, mat);
      wr.scale.x = -1;
      b.add(wl, wr);
      b.scale.setScalar(2.2);
      group.add(b);
      birds.push({ g: b, wl, wr, cx: c[0], cy: c[1], cz: c[2], r: 60 + i * 12, ph: i * 0.5 + f, sp: 0.12 + rand() * 0.03, flap: rand() * 6 });
    }
  }
  scene.add(group);
  return {
    update(t) {
      for (const b of birds) {
        const a = t * b.sp + b.ph;
        b.g.position.set(b.cx + Math.cos(a) * b.r, b.cy + Math.sin(t * 0.3 + b.ph) * 6, b.cz + Math.sin(a) * b.r);
        b.g.rotation.set(0, Math.PI - a, -0.35);
        const fl = Math.sin(t * 7 + b.flap) * 0.6;
        b.wl.rotation.z = fl;
        b.wr.rotation.z = -fl;
      }
    },
  };
}
