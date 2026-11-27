// PBR texture sets for the man-made props, painted procedurally once at load: an albedo map, a
// tangent-space normal map (from a painted height field) and a roughness/metalness map (G/B), each
// tileable. Sets: corrugated zinc, weathered planks, ironwood shingles (sirap), nipah thatch,
// concrete, rock, painted steel. Tints come from the material colour, so one set serves many props.
import * as THREE from 'three';
import { tileNoise, tileFbm, tileWorley, dataTexture, heightToNormalBytes, painterRandom } from '../../textures/texture-utils.js';

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const fract = (x) => x - Math.floor(x);
const hash1 = (n) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);

// Paint a set: fn(u, v, x, y) -> [r, g, b, height, roughness, metalness] (colour 0..255, rest 0..1).
function paintSet(size, fn, normalStrength) {
  const albedo = new Uint8Array(size * size * 4);
  const orm = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, h, rough, metal] = fn(x / size, y / size, x, y);
      const i = y * size + x, k = i * 4;
      albedo[k] = Math.max(0, Math.min(255, r)); albedo[k + 1] = Math.max(0, Math.min(255, g)); albedo[k + 2] = Math.max(0, Math.min(255, b)); albedo[k + 3] = 255;
      orm[k] = 255; orm[k + 1] = rough * 255; orm[k + 2] = metal * 255; orm[k + 3] = 255;
      height[i] = h;
    }
  }
  return {
    map: dataTexture(albedo, size, size),
    normalMap: dataTexture(heightToNormalBytes(height, size, size, normalStrength), size, size, { srgb: false }),
    ormMap: dataTexture(orm, size, size, { srgb: false }),
  };
}

// Galvanised corrugated zinc, sheets lapped every half tile, rust running down from the laps.
function corrugated(u, v) {
  const wave = 0.5 + 0.5 * Math.sin(u * Math.PI * 2 * 16);
  const lap = Math.min(fract(u * 2), 1 - fract(u * 2)) < 0.012 ? 1 : 0;
  const streak = tileNoise(u * 48, 0.5, 48, 3) * tileFbm(u, v, 4, 3, 5);
  const rust = smooth(0.32, 0.55, streak + (1 - v) * 0.12 * tileNoise(u * 8, v * 8, 8, 9)) * (0.6 + 0.4 * tileNoise(u * 16, v * 16, 16, 2));
  const n = tileFbm(u, v, 16, 4, 7);
  const l = 160 + (n - 0.5) * 50 + wave * 18 - lap * 50;
  const r = l * (1 - rust) + 118 * rust, g = l * 1.01 * (1 - rust) + 64 * rust, b = l * 1.02 * (1 - rust) + 34 * rust;
  return [r, g, b, wave * 0.8 - lap * 0.3 + rust * 0.05, 0.42 + rust * 0.45 + n * 0.1, 0.75 * (1 - rust)];
}

// Painted corrugated sheet: the same profile under factory paint, with faint grime runs, no rust.
function corrugatedPainted(u, v) {
  const wave = 0.5 + 0.5 * Math.sin(u * Math.PI * 2 * 16);
  const lap = Math.min(fract(u * 2), 1 - fract(u * 2)) < 0.012 ? 1 : 0;
  const n = tileFbm(u, v, 4, 3, 17); // only a broad, faint variation in the paint
  const l = 222 + (n - 0.5) * 8 + wave * 12 - lap * 34;
  return [l, l * 0.99, l * 0.975, wave * 0.8 - lap * 0.3, 0.42 + n * 0.06, 0.1];
}

// Horizontal boards 20 cm wide: silvered grain, butt joints, nail heads, gaps and stains.
function planks(u, v) {
  const rows = 10, row = Math.floor(v * rows), fv = fract(v * rows);
  const off = hash1(row) * 16;
  const grain = tileNoise(u * 16 + off, fv * 22, 16, 31) * 0.6 + tileNoise(u * 64 + off * 3, fv * 60, 64, 33) * 0.4;
  const joint = Math.abs(fract(u + hash1(row + 9)) - 0.5) > 0.494 ? 1 : 0;
  const gap = fv < 0.05 ? 1 : 0;
  const ju = fract(u + hash1(row + 9));
  const nail = (Math.hypot((Math.min(ju, 1 - ju)) * 120, (fv - 0.5) * 12) < 0.9 && Math.min(ju, 1 - ju) < 0.03) ? 1 : 0;
  const tone = hash1(row + 3);
  const weather = tileFbm(u, v, 6, 4, 41);
  const grey = smooth(0.35, 0.7, weather + tone * 0.3);
  let r = 128 + grain * 40, g = 92 + grain * 30, b = 60 + grain * 20;
  r = r * (1 - grey) + (150 + grain * 30) * grey; g = g * (1 - grey) + (140 + grain * 28) * grey; b = b * (1 - grey) + (124 + grain * 24) * grey;
  const shade = (0.82 + tone * 0.3) * (1 - gap * 0.75) * (1 - joint * 0.5) * (1 - nail * 0.6);
  const cup = Math.sin(fv * Math.PI);
  return [r * shade, g * shade, b * shade, cup * 0.5 + grain * 0.25 - gap * 0.8 - joint * 0.3, 0.78 + grey * 0.12, nail * 0.6];
}

// Ironwood shingles (sirap): eight overlapping courses, staggered, dark and weathered with lichen.
function shingles(u, v) {
  const rows = 8, row = Math.floor(v * rows), fv = fract(v * rows);
  const per = 12, x = u * per + (row % 2) * 0.5 + hash1(row) * 0.3;
  const idx = Math.floor(x), fs = fract(x);
  const id = hash1(idx * 7.1 + row * 13.3);
  const gap = fs < 0.06 ? 1 : 0;
  const grain = tileNoise(u * 96, fv * 10 + row * 3, 96, 51);
  const lichen = smooth(0.62, 0.8, tileFbm(u, v, 12, 4, 53));
  const tone = 0.7 + id * 0.45;
  let r = (72 + grain * 22) * tone, g = (60 + grain * 18) * tone, b = (50 + grain * 14) * tone;
  r = r * (1 - lichen * 0.6) + 120 * lichen * 0.6; g = g * (1 - lichen * 0.6) + 124 * lichen * 0.6; b = b * (1 - lichen * 0.6) + 86 * lichen * 0.6;
  const edge = fv > 0.9 ? 0.55 : 1; // shadow under the course above
  const s = (1 - gap * 0.7) * edge;
  return [r * s, g * s, b * s, fv * 0.9 + grain * 0.15 - gap * 0.6, 0.86, 0];
}

// Nipah palm thatch: layered courses of fibres running down the slope, sun-bleached on top.
function thatch(u, v) {
  const rows = 9, fv = fract(v * rows), row = Math.floor(v * rows);
  const fib = tileNoise(u * 128 + hash1(row) * 50, fv * 3, 128, 61) * 0.7 + tileNoise(u * 40, fv * 2 + row, 40, 63) * 0.3;
  const ragged = fv > 0.82 + tileNoise(u * 64, row, 64, 65) * 0.15 ? 1 : 0;
  const n = tileFbm(u, v, 6, 3, 67);
  const bleach = 0.75 + n * 0.5;
  const r = (118 + fib * 50) * bleach, g = (96 + fib * 40) * bleach, b = (62 + fib * 26) * bleach;
  const s = (0.7 + fv * 0.35) * (ragged ? 0.45 : 1);
  return [r * s, g * s, b * s, fv * 0.6 + fib * 0.5 - ragged * 0.5, 0.95, 0];
}

// Concrete: aggregate speckle, oil and rain stains, a saw-cut joint around each 5 m slab.
function concrete(u, v) {
  const n = tileFbm(u, v, 8, 5, 71), fine = tileNoise(u * 180, v * 180, 180, 73), pores = tileNoise(u * 400, v * 400, 400, 77);
  const stain = smooth(0.6, 0.78, tileFbm(u, v, 3, 4, 75));
  const joint = Math.min(u, 1 - u, v, 1 - v) < 0.004 ? 1 : 0;
  const l = (168 + (n - 0.5) * 18 + (fine - 0.5) * 12 + (pores < 0.12 ? -18 : 0)) * (1 - stain * 0.12) * (1 - joint * 0.28);
  return [l * 1.0, l * 0.985, l * 0.95, n * 0.15 + fine * 0.15 - joint, 0.84 + fine * 0.1, 0];
}

// Granite boulders: grainy mottle, dark fissures along Worley cell edges, a hint of moss.
function rock(u, v) {
  const w = tileWorley(u, v, 6, 81);
  const crack = smooth(0.06, 0.0, w.d2 - w.d1);
  const n = tileFbm(u, v, 8, 5, 83), fine = tileNoise(u * 128, v * 128, 128, 85);
  const moss = smooth(0.58, 0.72, tileFbm(u, v, 4, 4, 87));
  let l = 112 + (n - 0.5) * 70 + (fine - 0.5) * 30 + w.id * 22;
  let r = l * 1.02, g = l * 0.98, b = l * 0.9;
  r = r * (1 - moss * 0.6) + 70 * moss * 0.6; g = g * (1 - moss * 0.6) + 86 * moss * 0.6; b = b * (1 - moss * 0.6) + 44 * moss * 0.6;
  const s = 1 - crack * 0.55;
  return [r * s, g * s, b * s, n * 0.8 + fine * 0.15 - crack * 0.6, 0.82, 0];
}

// Painted steel: near-white paint (tinted by the material) with grime, chips and run-marks.
function paintedSteel(u, v) {
  const n = tileFbm(u, v, 6, 4, 91), fine = tileNoise(u * 96, v * 96, 96, 93);
  const runs = tileNoise(u * 64, 0.5, 64, 95) * smooth(0.3, 1, v);
  const chip = smooth(0.88, 0.9, tileNoise(u * 40, v * 40, 40, 97)) * 0.8;
  const l = 228 - (n - 0.5) * 18 - runs * 18 - fine * 6;
  const r = l * (1 - chip) + 90 * chip, g = l * (1 - chip) + 80 * chip, b = l * (1 - chip) + 72 * chip;
  return [r, g, b, -chip * 0.4 + fine * 0.05, 0.42 + n * 0.2 + chip * 0.3, 0.35 * (1 - chip)];
}

const SETS = {
  corrugated: [corrugated, 3],
  corrugatedPainted: [corrugatedPainted, 3],
  planks: [planks, 2.5],
  shingles: [shingles, 3],
  thatch: [thatch, 2.5],
  concrete: [concrete, 1.2],
  rock: [rock, 3],
  steel: [paintedSteel, 1],
};

const cache = new Map();

// One shared texture set per kind (256 px on phones, 512 px otherwise).
export function propTextureSet(kind, size = 256) {
  const key = kind + size;
  if (!cache.has(key)) {
    const [fn, strength] = SETS[kind];
    cache.set(key, paintSet(size, fn, strength));
  }
  return cache.get(key);
}

// A PBR material over a texture set, tinted by colour.
export function propMaterial(kind, color = 0xffffff, extra = {}, size = 256) {
  const t = propTextureSet(kind, size);
  return new THREE.MeshStandardMaterial({
    color, map: t.map, normalMap: t.normalMap, roughnessMap: t.ormMap, metalnessMap: t.ormMap,
    roughness: 1, metalness: 1, normalScale: new THREE.Vector2(1, 1), ...extra,
  });
}

// Signboard texture: painted letters on weathered board.
export function signTexture(lines, { w = 1024, h = 256, bg = '#e9e4d6', fg = '#9e1c14', font = 'Manrope', weight = 800 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const rnd = painterRandom(17);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(80,70,60,${rnd() * 0.08})`; g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 30, 1 + rnd() * 3); }
  g.fillStyle = fg;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((ln, i) => {
    const size = ln.size || h * 0.42;
    g.font = `${weight} ${size}px ${font}, sans-serif`;
    if ('letterSpacing' in g) g.letterSpacing = `${size * 0.08}px`;
    g.fillText(ln.text, w / 2, h * (lines.length === 1 ? 0.5 : 0.3 + i * 0.42));
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
