// Helpers for procedural textures: tileable noise, canvas -> texture with colour bleeding into
// transparent texels (so alpha-tested foliage has no dark fringes), and height -> normal maps.
import * as THREE from 'three';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  // Painted once on the CPU and read back: a CPU-backed context is much faster for that than a
  // GPU canvas (and avoids a GPU readback on phones).
  c.getContext('2d', { willReadFrequently: true });
  return c;
}

function hash3(x, y, s) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Value noise that wraps every `period` lattice cells, so textures tile seamlessly.
export function tileNoise(x, y, period, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const x0 = ((ix % period) + period) % period, y0 = ((iy % period) + period) % period;
  const x1 = (x0 + 1) % period, y1 = (y0 + 1) % period;
  const a = hash3(x0, y0, seed), b = hash3(x1, y0, seed), c = hash3(x0, y1, seed), d = hash3(x1, y1, seed);
  return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
}

// Fractal sum of tileable noise; u,v in 0..1 over the texture, base = lattice cells across it.
export function tileFbm(u, v, base, octaves = 5, seed = 0, gain = 0.5) {
  let sum = 0, amp = 0.5, norm = 0, p = base;
  for (let i = 0; i < octaves; i++) {
    sum += tileNoise(u * p, v * p, p, seed + i * 13) * amp;
    norm += amp;
    amp *= gain;
    p *= 2;
  }
  return sum / norm;
}

// Cellular (Worley) distance for crowns, pebbles and cracks; wraps over `cells` per side.
export function tileWorley(u, v, cells, seed = 0) {
  const x = u * cells, y = v * cells;
  const ix = Math.floor(x), iy = Math.floor(y);
  let d1 = 9, d2 = 9, id = 0;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cx = ix + ox, cy = iy + oy;
      const wx = ((cx % cells) + cells) % cells, wy = ((cy % cells) + cells) % cells;
      const px = cx + hash3(wx, wy, seed), py = cy + hash3(wx, wy, seed + 7);
      const d = Math.hypot(px - x, py - y);
      if (d < d1) { d2 = d1; d1 = d; id = hash3(wx, wy, seed + 3); } else if (d < d2) d2 = d;
    }
  }
  return { d1, d2, id };
}

// Copy a canvas into a DataTexture; transparent texels take the average opaque colour so
// mipmaps of alpha-tested cards stay green instead of fading to black.
export function canvasToTexture(canvas, { srgb = true, bleed = false, repeat = false } = {}) {
  const g = canvas.getContext('2d');
  const img = g.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  if (bleed) {
    let r = 0, gg = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
    n = Math.max(1, n);
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3] / 255;
      if (a < 1) {
        d[i] = d[i] * a + (r / n) * (1 - a);
        d[i + 1] = d[i + 1] * a + (gg / n) * (1 - a);
        d[i + 2] = d[i + 2] * a + (b / n) * (1 - a);
      }
    }
  }
  return dataTexture(new Uint8Array(d.buffer.slice(0)), canvas.width, canvas.height, { srgb, repeat });
}

export function dataTexture(bytes, w, h, { srgb = true, repeat = true } = {}) {
  const t = new THREE.DataTexture(bytes, w, h, THREE.RGBAFormat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  t.flipY = false;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

// Height field (Float32Array w*h, wrapping) -> tangent-space normal map bytes.
export function heightToNormalBytes(height, w, h, strength = 2) {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const l = height[y * w + ((x - 1 + w) % w)], r = height[y * w + ((x + 1) % w)];
      const u = height[((y - 1 + h) % h) * w + x], dn = height[((y + 1) % h) * w + x];
      const nx = (l - r) * strength, ny = (u - dn) * strength;
      const inv = 1 / Math.hypot(nx, ny, 1);
      const k = (y * w + x) * 4;
      out[k] = (nx * inv * 0.5 + 0.5) * 255;
      out[k + 1] = (ny * inv * 0.5 + 0.5) * 255;
      out[k + 2] = (inv * 0.5 + 0.5) * 255;
      out[k + 3] = 255;
    }
  }
  return out;
}

export function heightToNormalTexture(height, w, h, strength = 2) {
  return dataTexture(heightToNormalBytes(height, w, h, strength), w, h, { srgb: false });
}

// Tiny seeded generator for texture painting (independent of the world's random stream).
export function painterRandom(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
