// Jungle airstrip: asphalt runway with markings, edge lights, approach lights, PAPI, hangar and windsock.
import * as THREE from 'three';
import { makeCanvas, glowTexture } from '../core/canvas-textures.js';
import { tileNoise, tileFbm, painterRandom } from '../textures/texture-utils.js';
import { mergeParts, paint, placed } from '../core/geometry-utils.js';
import { PLACES } from './terrain.js';

// Worn jungle runway: weathered asphalt aggregate, laterite dust blown in from the edges, cracks,
// darker patch repairs, rubber in the touchdown zones and sun-faded paint.
function runwayTexture(lengthM) {
  const W = 384, H = 3072;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d', { willReadFrequently: true });
  const img = g.createImageData(W, H);
  const d = img.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H;
      const grain = tileNoise(x * 0.9, y * 0.9, 4096, 3) * 0.55 + tileNoise(x * 0.25, y * 0.25, 4096, 5) * 0.45;
      const blot = tileFbm(u * 0.5, v * 4, 8, 4, 7);
      const edge = Math.min(u, 1 - u);
      const dust = Math.max(0, 1 - edge / 0.12) * (0.6 + 0.4 * tileNoise(x * 0.05, y * 0.02, 4096, 9));
      const patch = tileNoise(u * 3, v * 40, 4096, 11) > 0.78 ? 0.75 : 1;
      let l = (88 + grain * 40 + (blot - 0.5) * 30) * patch;
      let r = l, gg = l * 0.98, bb = l * 0.94;
      r = r * (1 - dust * 0.7) + 150 * dust * 0.7; gg = gg * (1 - dust * 0.7) + 92 * dust * 0.7; bb = bb * (1 - dust * 0.7) + 60 * dust * 0.7;
      const k = (y * W + x) * 4;
      d[k] = r; d[k + 1] = gg; d[k + 2] = bb; d[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const ppm = H / lengthM;
  g.globalAlpha = 0.82;
  g.fillStyle = '#e9e6dc';
  g.fillRect(14, 0, 7, H); g.fillRect(W - 21, 0, 7, H);
  for (let y = 180; y < H - 180; y += 90) g.fillRect(W / 2 - 6, y, 12, 45);
  for (let i = 0; i < 8; i++) { g.fillRect(34 + i * 41, 20, 20, 90); g.fillRect(34 + i * 41, H - 110, 20, 90); }
  g.font = 'bold 84px sans-serif';
  g.textAlign = 'center';
  g.save(); g.translate(W / 2, H - 150); g.fillText('36', 0, 0); g.restore();
  g.save(); g.translate(W / 2, 150); g.rotate(Math.PI); g.fillText('18', 0, 0); g.restore();
  for (const y of [300, 450, 600, H - 360, H - 510, H - 660]) { g.fillRect(90, y, 44, 22 * ppm); g.fillRect(W - 134, y, 44, 22 * ppm); }
  g.globalAlpha = 1;
  // Paint scuffed away, rubber deposits and cracks.
  const rnd = painterRandom(5);
  g.fillStyle = 'rgba(95,92,86,0.55)';
  for (let i = 0; i < 2500; i++) g.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 4, 2 + rnd() * 3);
  g.fillStyle = 'rgba(12,12,12,0.22)';
  for (let i = 0; i < 140; i++) {
    const end = i % 2 ? H - 500 - rnd() * 500 : 300 + rnd() * 500;
    g.fillRect(W / 2 - 70 + rnd() * 140, end, 4 + rnd() * 5, 40 + rnd() * 120);
  }
  g.strokeStyle = 'rgba(25,22,20,0.45)';
  g.lineWidth = 1.2;
  for (let i = 0; i < 160; i++) {
    let x = rnd() * W, y = rnd() * H;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 30; y += (rnd() - 0.3) * 30; g.lineTo(x, y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Laterite and trampled grass verge around the runway, fading out into the terrain at its edge.
function vergeTexture() {
  const c = makeCanvas(256, 512);
  const g = c.getContext('2d', { willReadFrequently: true });
  const img = g.createImageData(256, 512);
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 256; x++) {
      const u = x / 256, v = y / 512;
      const n = tileFbm(u, v, 8, 4, 21);
      const edge = Math.min(u, 1 - u, v * 0.5, (1 - v) * 0.5) * 2;
      const a = Math.max(0, Math.min(1, (edge * 2.2 + (n - 0.5) * 0.9) * 1.6));
      const grassy = tileFbm(u, v, 16, 3, 23);
      const k = (y * 256 + x) * 4;
      img.data[k] = 120 + n * 40 - grassy * 50;
      img.data[k + 1] = 80 + n * 30 + grassy * 10;
      img.data[k + 2] = 46 + n * 15 - grassy * 10;
      img.data[k + 3] = a * 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildAirstrip(scene) {
  const r = PLACES.runway;
  const group = new THREE.Group();
  group.position.set(r.x, r.h + 0.5, r.z);
  const runway = new THREE.Mesh(
    new THREE.PlaneGeometry(r.width, r.length),
    new THREE.MeshStandardMaterial({ map: runwayTexture(r.length), roughness: 0.88, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }),
  );
  runway.rotation.x = -Math.PI / 2;
  runway.receiveShadow = true;
  group.add(runway);
  // Grass shoulders and apron.
  const shoulder = new THREE.Mesh(new THREE.PlaneGeometry(r.width + 70, r.length + 160), new THREE.MeshStandardMaterial({ map: vergeTexture(), transparent: true, depthWrite: false, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  shoulder.rotation.x = -Math.PI / 2;
  shoulder.position.y = -0.2;
  shoulder.receiveShadow = true;
  group.add(shoulder);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(70, 90), new THREE.MeshLambertMaterial({ color: 0x55534c, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
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
    add(glow, -r.width / 2 - 2, 0.6, z, 5);
    add(glow, r.width / 2 + 2, 0.6, z, 5);
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
