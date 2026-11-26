// Jungle airstrip: asphalt runway with markings, edge lights, approach lights, PAPI, hangar and windsock.
import * as THREE from 'three';
import { makeCanvas, glowTexture } from '../core/canvas-textures.js';
import { mergeParts, paint, placed } from '../core/geometry-utils.js';
import { PLACES } from './terrain.js';

function runwayTexture(lengthM, widthM) {
  const c = makeCanvas(256, 2048);
  const g = c.getContext('2d');
  g.fillStyle = '#3b3b3a';
  g.fillRect(0, 0, 256, 2048);
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? 20 : 90},${Math.random() < 0.5 ? 20 : 85},${Math.random() < 0.5 ? 20 : 80},0.12)`;
    g.fillRect(Math.random() * 256, Math.random() * 2048, 2, 3);
  }
  const ppm = 2048 / lengthM;
  g.fillStyle = '#e8e6df';
  // Edge lines
  g.fillRect(8, 0, 5, 2048); g.fillRect(243, 0, 5, 2048);
  // Centreline dashes
  for (let y = 120; y < 2048 - 120; y += 60) g.fillRect(124, y, 8, 30);
  // Threshold bars at both ends
  for (let i = 0; i < 8; i++) {
    g.fillRect(22 + i * 28, 14, 14, 60);
    g.fillRect(22 + i * 28, 2048 - 74, 14, 60);
  }
  // Runway numbers 36 / 18
  g.font = 'bold 54px sans-serif';
  g.textAlign = 'center';
  g.save(); g.translate(128, 2048 - 110); g.fillText('36', 0, 0); g.restore();
  g.save(); g.translate(128, 110); g.rotate(Math.PI); g.fillText('18', 0, 0); g.restore();
  // Touchdown zone marks
  for (const y of [260, 420, 2048 - 260, 2048 - 420]) { g.fillRect(60, y, 30, 40 * ppm * 8); g.fillRect(166, y, 30, 40 * ppm * 8); }
  // Tyre marks
  g.fillStyle = 'rgba(15,15,15,0.35)';
  for (let i = 0; i < 30; i++) g.fillRect(100 + Math.random() * 50, 1700 + Math.random() * 200 - (i % 2) * 1400, 4, 60);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function buildAirstrip(scene) {
  const r = PLACES.runway;
  const group = new THREE.Group();
  group.position.set(r.x, r.h + 0.15, r.z);
  const runway = new THREE.Mesh(
    new THREE.PlaneGeometry(r.width, r.length),
    new THREE.MeshLambertMaterial({ map: runwayTexture(r.length, r.width) }),
  );
  runway.rotation.x = -Math.PI / 2;
  runway.receiveShadow = true;
  group.add(runway);
  // Grass shoulders and apron.
  const shoulder = new THREE.Mesh(new THREE.PlaneGeometry(r.width + 50, r.length + 120), new THREE.MeshLambertMaterial({ color: 0x5d6b33 }));
  shoulder.rotation.x = -Math.PI / 2;
  shoulder.position.y = -0.08;
  shoulder.receiveShadow = true;
  group.add(shoulder);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(70, 90), new THREE.MeshLambertMaterial({ color: 0x55534c }));
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(62, -0.02, 300);
  group.add(apron);

  // Hangar, tower, fuel tanks.
  const lam = new THREE.MeshLambertMaterial({ vertexColors: true });
  const hangarRoof = new THREE.CylinderGeometry(14, 14, 36, 16, 1, false, 0, Math.PI);
  placed(hangarRoof, { rx: Math.PI / 2, rz: Math.PI / 2, y: 0 });
  const buildings = mergeParts([
    paint(placed(hangarRoof, { x: 80, y: 6, z: 330, sz: 1 }), 0x8f9698),
    paint(placed(new THREE.BoxGeometry(28, 6, 36), { x: 80, y: 3, z: 330 }), 0xa7a9a2),
    paint(placed(new THREE.BoxGeometry(5, 14, 5), { x: 75, y: 7, z: 270 }), 0xd8d2c4),
    paint(placed(new THREE.BoxGeometry(7, 3, 7), { x: 75, y: 15.5, z: 270 }), 0x2b3b44),
    paint(placed(new THREE.CylinderGeometry(3, 3, 5, 12), { x: 95, y: 2.5, z: 250 }), 0xc63a2a),
    paint(placed(new THREE.CylinderGeometry(3, 3, 5, 12), { x: 103, y: 2.5, z: 250 }), 0xe6e6e0),
    paint(placed(new THREE.BoxGeometry(14, 3.2, 6), { x: 50, y: 1.6, z: 360 }), 0xb6452e),
  ]);
  const bm = new THREE.Mesh(buildings, lam);
  bm.castShadow = true;
  group.add(bm);
  // Windsock
  const sock = new THREE.Mesh(new THREE.ConeGeometry(0.8, 4, 8, 1, true), new THREE.MeshLambertMaterial({ color: 0xff6a1a, side: THREE.DoubleSide }));
  sock.rotation.z = Math.PI / 2;
  sock.position.set(40, 8, -380);
  group.add(sock);
  group.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 8, 4), new THREE.MeshLambertMaterial({ color: 0xdddddd })), {}));
  group.children[group.children.length - 1].position.set(38, 4, -380);

  // Edge, threshold and approach lights as glowing sprites.
  const glow = glowTexture('rgba(255,230,170,1)');
  const greenGlow = glowTexture('rgba(120,255,140,1)');
  const redGlow = glowTexture('rgba(255,80,60,1)');
  const add = (tex, x, y, z, s) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    sp.position.set(x, y, z);
    sp.scale.setScalar(s);
    group.add(sp);
    return sp;
  };
  for (let z = -r.length / 2; z <= r.length / 2; z += 60) {
    add(glow, -r.width / 2 - 2, 0.6, z, 3.2);
    add(glow, r.width / 2 + 2, 0.6, z, 3.2);
  }
  for (let x = -r.width / 2; x <= r.width / 2; x += 4) {
    add(greenGlow, x, 0.6, r.length / 2 + 3, 3);
    add(redGlow, x, 0.6, -r.length / 2 - 3, 3);
  }
  // Approach light bars south of runway 36 (landing northbound), with sequenced flashers.
  const flashers = [];
  for (let i = 1; i <= 12; i++) {
    const z = r.length / 2 + i * 30;
    for (let x = -8; x <= 8; x += 4) add(glow, x, 1.5, z, 3.5);
    flashers.push(add(glow, 0, 2.2, z, 7));
  }
  // PAPI: 4 lights left of the touchdown zone.
  const papi = [];
  for (let i = 0; i < 4; i++) papi.push(add(redGlow, -r.width / 2 - 14 - i * 5, 1, r.length / 2 - 200, 4));
  scene.add(group);

  return {
    group,
    papi,
    update(t, plane) {
      const k = Math.floor((t * 2.5) % 1 * 12);
      flashers.forEach((f, i) => (f.visible = 11 - i === k));
      if (!plane) return;
      // PAPI shows white above / red below a 3.5 degree glide path.
      const dz = plane.position.z - (r.z + r.length / 2 - 200);
      const glide = Math.atan2(plane.position.y - r.h, Math.max(1, dz)) * 57.3;
      papi.forEach((p, i) => {
        const white = glide > 2.5 + i * 0.66;
        p.material.map = white ? glow : redGlow;
      });
    },
  };
}
