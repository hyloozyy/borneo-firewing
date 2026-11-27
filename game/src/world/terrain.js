// Kalimantan terrain: rolling jungle hills, a winding river, a lake, the coast, the airstrip pad.
import * as THREE from 'three';
import { fbm, ridgeNoise, smoothstep, lerp } from '../core/noise.js';
import { forestMask } from './forest-layout.js';
import { buildTerrainMaterial } from './terrain-material.js';

export const WORLD_SIZE = 10000;

// Key places (metres; north is -Z, east is +X).
export const PLACES = {
  runway: { x: 0, z: 1800, length: 1100, width: 42, h: 16 },
  lake: { x: -1550, z: -450, r: 560 },
  fire: { x: 750, z: -1750 },
  village: { x: 1500, z: -950, h: 12 },
  // Apron, hangar, tower and fuel farm east of the southern half of the runway (relative to its centre).
  apron: { x0: 44, x1: 178, z0: 338, z1: 615 },
  coastX: 2900,
};

// River from the lake down past the airstrip to the sea.
export const RIVER = [
  [-1050, -250], [-760, 120], [-560, 560], [-430, 1050], [-470, 1600], [-380, 2250],
  [-60, 2800], [560, 3150], [1350, 3200], [2150, 3000], [3200, 2850],
];

function distToRiver(x, z) {
  let best = 1e9;
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [ax, az] = RIVER[i], [bx, bz] = RIVER[i + 1];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < best) best = d;
  }
  return best;
}

export function terrainHeight(x, z) {
  let h = 26 + 95 * fbm(x * 0.00062 + 3.1, z * 0.00062 - 7.4, 5);
  h += 18 * fbm(x * 0.004, z * 0.004, 3) - 9;
  // Mountains along the northern horizon.
  const north = smoothstep(-2600, -4400, z);
  h += north * 520 * ridgeNoise(x * 0.0007, z * 0.0007);
  // Coastline and sea to the east.
  const coast = PLACES.coastX + 220 * Math.sin(z * 0.0011) + 120 * Math.sin(z * 0.0037);
  if (x > coast - 400) h = lerp(h, -30, smoothstep(coast - 400, coast + 300, x));
  // Lake basin.
  const dl = Math.hypot((x - PLACES.lake.x) * 0.85, z - PLACES.lake.z);
  h = lerp(h, -14, 1 - smoothstep(PLACES.lake.r * 0.8, PLACES.lake.r * 1.5, dl));
  // River channel.
  const dr = distToRiver(x, z);
  h = lerp(h, -6, 1 - smoothstep(26, 120, dr));
  // Airstrip pad.
  const r = PLACES.runway;
  const ax = Math.abs(x - r.x), az = Math.abs(z - r.z);
  const pad = (1 - smoothstep(70, 220, ax)) * (1 - smoothstep(r.length / 2 + 60, r.length / 2 + 300, az));
  h = lerp(h, r.h, pad);
  // Flat apron for the hangar, tower and fuel farm.
  const ap = PLACES.apron, rx = x - r.x, rz = z - r.z;
  const apd = Math.max(ap.x0 - rx, rx - ap.x1, ap.z0 - rz, rz - ap.z1);
  h = lerp(h, r.h, 1 - smoothstep(0, 60, apd));
  // Keep both approach corridors clear of hills (a valley below the 3.5 degree glide path).
  const corridor = 1 - smoothstep(160, 520, ax);
  const beyond = Math.max(0, az - r.length / 2);
  const cap = r.h + beyond * 0.03;
  if (corridor > 0 && h > cap) h = lerp(h, cap, corridor);
  // Village clearing.
  const dv = Math.hypot(x - PLACES.village.x, z - PLACES.village.z);
  h = lerp(h, PLACES.village.h, 1 - smoothstep(120, 280, dv));
  return h;
}

export function isOnRunway(x, z, margin = 0) {
  const r = PLACES.runway;
  return Math.abs(x - r.x) < r.width / 2 + margin && Math.abs(z - r.z) < r.length / 2 + margin;
}

// The fishing landing on the lake's south shore: the first dry point going out from the lake centre
// at LANDING_ANGLE, and the outward direction (cached).
export const LANDING_ANGLE = 1.25;
let landing;
export function lakeLanding() {
  if (landing !== undefined) return landing;
  const l = PLACES.lake;
  landing = null;
  for (let d = l.r * 0.7; d < l.r * 2; d += 2) {
    const x = l.x + (Math.cos(LANDING_ANGLE) * d) / 0.85, z = l.z + Math.sin(LANDING_ANGLE) * d;
    if (terrainHeight(x, z) > 0.6) {
      const dx = Math.cos(LANDING_ANGLE) / 0.85, dz = Math.sin(LANDING_ANGLE), n = Math.hypot(dx, dz);
      landing = { x, z, dx: dx / n, dz: dz / n };
      break;
    }
  }
  return landing;
}

export function isOnApron(x, z, margin = 0) {
  const r = PLACES.runway, ap = PLACES.apron;
  const rx = x - r.x, rz = z - r.z;
  return rx > ap.x0 - margin && rx < ap.x1 + margin && rz > ap.z0 - margin && rz < ap.z1 + margin;
}

export function riverDistance(x, z) {
  return distToRiver(x, z);
}

// Splat weights per vertex: grass, canopy, soil, sand | rock, ash, wet, macro tint.
function groundWeights(x, z, h, slope, a, b) {
  const forest = forestMask(x, z, h);
  const n = fbm(x * 0.012, z * 0.012, 3);
  const sand = 1 - smoothstep(1.5, 5.5 + n * 3, h);
  const rock = Math.min(1, smoothstep(0.7, 0.98, slope) + smoothstep(820, 1000, h) * 0.8);
  const open = Math.max(0, 1 - forest - sand);
  const soil = open * smoothstep(0.55, 0.75, fbm(x * 0.02 + 5, z * 0.02, 3)) + smoothstep(0.3, 0.6, slope) * 0.5;
  const r = PLACES.runway;
  const apron = Math.abs(x - (r.x + 75)) < 60 && Math.abs(z - (r.z + 120)) < 70 ? 0.8 : 0;
  a[0] = Math.max(0, open - soil * 0.6) * (1 - rock);
  a[1] = forest * (1 - rock * 0.7);
  a[2] = Math.min(1, soil + apron) * (1 - rock * 0.5);
  a[3] = sand;
  b[0] = rock;
  b[1] = 0;
  b[2] = 1 - smoothstep(-1, 2.2, h);
  b[3] = n;
}

export function buildTerrain(segments, burnMap, ground) {
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const sa = new Float32Array(p.count * 4), sb = new Float32Array(p.count * 4);
  const a = [0, 0, 0, 0], b = [0, 0, 0, 0];
  const step = WORLD_SIZE / segments;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const h = terrainHeight(x, z);
    p.setY(i, h);
    const sx = terrainHeight(x + step, z) - h, sz = terrainHeight(x, z + step) - h;
    const slope = Math.min(1, Math.hypot(sx, sz) / step);
    groundWeights(x, z, h, slope, a, b);
    sa.set(a, i * 4); sb.set(b, i * 4);
  }
  geo.setAttribute('splatA', new THREE.BufferAttribute(sa, 4));
  geo.setAttribute('splatB', new THREE.BufferAttribute(sb, 4));
  geo.computeVertexNormals();
  const { material, uniforms } = buildTerrainMaterial(ground, burnMap);
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  mesh.userData.uniforms = uniforms;
  return mesh;
}
