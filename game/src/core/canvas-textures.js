// Procedural textures painted on canvases at start-up (no image files are loaded).
import * as THREE from 'three';
import { rand } from './rng.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = canvas(64, 64);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.55)'));
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Soft cumulus puff: many overlapping shaded blobs, lit from the top.
export function cloudTexture() {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  for (let i = 0; i < 46; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 70;
    const x = 128 + Math.cos(a) * r * 1.2;
    const y = 140 + Math.sin(a) * r * 0.6;
    const s = 30 + rand() * 46;
    const shade = y < 130 ? 255 : 235 - (y - 130) * 0.6;
    const grad = g.createRadialGradient(x, y - s * 0.25, 0, x, y, s);
    grad.addColorStop(0, `rgba(${shade},${shade},${shade},0.55)`);
    grad.addColorStop(1, `rgba(${shade},${shade},${shade},0)`);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, s, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Tileable rippled normal map for the water surfaces.
export function waterNormalTexture() {
  const size = 256;
  const c = canvas(size, size);
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const waves = [];
  for (let i = 0; i < 14; i++) {
    waves.push({ kx: Math.round(rand() * 8 - 4) || 1, kz: Math.round(rand() * 8 - 4), a: 0.4 + rand(), p: rand() * 6.28 });
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let dx = 0, dz = 0;
      for (const w of waves) {
        const ph = ((w.kx * x + w.kz * y) / size) * Math.PI * 2 + w.p;
        const d = Math.cos(ph) * w.a;
        dx += d * w.kx; dz += d * w.kz;
      }
      const nx = -dx * 0.05, nz = -dz * 0.05;
      const inv = 1 / Math.hypot(nx, 1, nz);
      const k = (y * size + x) * 4;
      img.data[k] = (nx * inv * 0.5 + 0.5) * 255;
      img.data[k + 1] = (nz * inv * 0.5 + 0.5) * 255;
      img.data[k + 2] = (inv * 0.5 + 0.5) * 255;
      img.data[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function makeCanvas(w, h) {
  return canvas(w, h);
}
