// Procedural textures painted on canvases at start-up (no image files are loaded).
import * as THREE from 'three';
import { rand } from './rng.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  // Painted once on the CPU and read back: a CPU-backed context is much faster for that than a
  // GPU canvas (and avoids a GPU readback on phones).
  c.getContext('2d', { willReadFrequently: true });
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
