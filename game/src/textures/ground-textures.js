// Ground material layers painted in code, packed into texture arrays (albedo + normal):
// 0 tropical grass, 1 rainforest canopy seen from above, 2 laterite soil, 3 wet sand/mud,
// 4 rock, 5 burnt ash. Each is tileable; normals come from each layer's own height field.
import * as THREE from 'three';
import { tileFbm, tileNoise, tileWorley, heightToNormalBytes } from './texture-utils.js';

export const GROUND_LAYERS = ['grass', 'canopy', 'soil', 'sand', 'rock', 'ash'];
// Metres covered by one texture tile for each layer.
export const GROUND_TILE = [9, 46, 12, 10, 22, 14];

function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

const painters = {
  grass(u, v) {
    const blades = tileNoise(u * 180, v * 60, 180, 2) * 0.6 + tileNoise(u * 60, v * 180, 60, 3) * 0.4;
    const patch = tileFbm(u, v, 4, 4, 5);
    const dry = Math.max(0, tileFbm(u, v, 3, 3, 9) - 0.55) * 2.5;
    const clover = Math.pow(tileWorley(u, v, 24, 11).d1, 0.5);
    const lum = 0.55 + blades * 0.5 + (patch - 0.5) * 0.4;
    let r = 62 * lum, g = 92 * lum, b = 34 * lum;
    r += dry * 70; g += dry * 38; b += dry * 6;
    r *= 0.85 + clover * 0.15; g *= 0.85 + clover * 0.15;
    return [r, g, b, blades * 0.6 + patch * 0.4];
  },
  canopy(u, v) {
    // Crowns: Worley cells domed into tree tops, dark gaps between, leaf speckle on top.
    const w = tileWorley(u, v, 7, 21);
    const w2 = tileWorley(u, v, 19, 23);
    const crown = Math.max(0, 1 - w.d1 * 1.25);
    const small = Math.max(0, 1 - w2.d1 * 1.3);
    const h = Math.sqrt(crown) * 0.75 + Math.sqrt(small) * 0.35;
    const speck = tileNoise(u * 220, v * 220, 220, 25) * 0.6 + tileNoise(u * 90, v * 90, 90, 27) * 0.4;
    const gap = 1 - Math.min(1, (w.d2 - w.d1) * 6);
    const hue = w.id;
    const lit = (0.4 + h * 0.8) * (0.75 + speck * 0.5) * (1 - gap * 0.2);
    let r = (32 + hue * 26) * lit, g = (62 + hue * 22) * lit, b = (24 + (1 - hue) * 10) * lit;
    if (hue > 0.86) { r *= 1.35; g *= 1.2; } // the odd yellow-green pioneer crown
    if (hue < 0.06) { r *= 1.25; g *= 0.95; b *= 0.85; } // a reddish young-leaf crown
    return [r, g, b, h * 0.8 + speck * 0.2];
  },
  soil(u, v) {
    const f = tileFbm(u, v, 6, 5, 31);
    const peb = tileWorley(u, v, 40, 33);
    const pebble = Math.max(0, 1 - peb.d1 * 3.2);
    const dark = tileFbm(u, v, 3, 3, 35);
    const lum = 0.75 + (f - 0.5) * 0.6 + pebble * 0.25 - Math.max(0, dark - 0.6) * 0.8;
    return [150 * lum, 82 * lum, 48 * lum, f * 0.6 + pebble * 0.6];
  },
  sand(u, v) {
    const ripple = Math.sin((u * 18 + tileNoise(u * 6, v * 6, 6, 41) * 1.8) * Math.PI * 2) * 0.5 + 0.5;
    const f = tileFbm(u, v, 8, 5, 43);
    const wet = tileFbm(u, v, 2, 3, 45);
    const lum = 0.82 + (f - 0.5) * 0.35 + ripple * 0.08 - wet * 0.3;
    return [176 * lum, 150 * lum, 112 * lum, ripple * 0.4 + f * 0.6];
  },
  rock(u, v) {
    const f = tileFbm(u, v, 4, 6, 51);
    const cr = tileWorley(u, v, 9, 53);
    const crack = Math.pow(Math.min(1, (cr.d2 - cr.d1) * 4), 0.5);
    const moss = Math.max(0, tileFbm(u, v, 5, 4, 55) - 0.55) * 3;
    const lum = 0.55 + f * 0.6;
    let r = 118 * lum * crack, g = 112 * lum * crack, b = 100 * lum * crack;
    r = r * (1 - moss) + 52 * moss; g = g * (1 - moss) + 74 * moss; b = b * (1 - moss) + 34 * moss;
    return [r, g, b, f * 0.7 + crack * 0.3];
  },
  ash(u, v) {
    const f = tileFbm(u, v, 6, 5, 61);
    const fleck = Math.pow(tileNoise(u * 150, v * 150, 150, 63), 6);
    const ember = tileWorley(u, v, 14, 65);
    const charLog = Math.max(0, 1 - Math.abs(tileNoise(u * 8, v * 30, 8, 67) - 0.5) * 9) * (tileNoise(u * 3, v * 3, 3, 69) > 0.55 ? 1 : 0);
    const lum = 0.16 + f * 0.22 + fleck * 0.55 - charLog * 0.1;
    return [62 * lum * 1.6, 56 * lum * 1.6, 52 * lum * 1.6, Math.min(1, (1 - ember.d1) * 0.6 + f * 0.4)];
  },
};

// Build both texture arrays; alpha of the albedo layer holds the height used for blending.
export function buildGroundTextures(size = 512) {
  const n = GROUND_LAYERS.length;
  const albedo = new Uint8Array(size * size * 4 * n);
  const normals = new Uint8Array(size * size * 4 * n);
  const height = new Float32Array(size * size);
  GROUND_LAYERS.forEach((name, li) => {
    const paint = painters[name];
    const off = li * size * size * 4;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const [r, g, b, h] = paint(x / size, y / size);
        const k = off + (y * size + x) * 4;
        albedo[k] = clamp255(r); albedo[k + 1] = clamp255(g); albedo[k + 2] = clamp255(b); albedo[k + 3] = clamp255(h * 255);
        height[y * size + x] = h;
      }
    }
    const strength = [3, 5, 4, 2, 7, 3][li] * (size / 512);
    normals.set(heightToNormalBytes(height, size, size, strength), off);
  });
  const make = (data, srgb) => {
    const t = new THREE.DataArrayTexture(data, size, size, n);
    t.format = THREE.RGBAFormat;
    t.type = THREE.UnsignedByteType;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  };
  return { albedo: make(albedo, true), normal: make(normals, false), count: n };
}
