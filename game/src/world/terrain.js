// Kalimantan terrain: rolling jungle hills, a winding river, a lake, the coast, the airstrip pad.
import * as THREE from 'three';
import { fbm, ridgeNoise, smoothstep, lerp } from '../core/noise.js';

export const WORLD_SIZE = 10000;

// Key places (metres; north is -Z, east is +X).
export const PLACES = {
  runway: { x: 0, z: 1800, length: 1100, width: 34, h: 16 },
  lake: { x: -1550, z: -450, r: 560 },
  fire: { x: 750, z: -1750 },
  village: { x: 1500, z: -950, h: 12 },
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

export function riverDistance(x, z) {
  return distToRiver(x, z);
}

// Colour ramp: sand at the waterline, jungle floor greens, rocky highlands, scorched near the fire.
function groundColor(x, z, h, slope, out) {
  const n = fbm(x * 0.01, z * 0.01, 3);
  const sand = new THREE.Color(0xc9b088), mud = new THREE.Color(0x6b5a3a);
  const jungle = new THREE.Color().setHSL(0.27 + n * 0.05, 0.55, 0.16 + n * 0.08);
  const rock = new THREE.Color(0x6f6a5c);
  if (h < 2.5) out.copy(sand).lerp(mud, smoothstep(-4, 1, h) * 0.6);
  else out.copy(jungle);
  if (h > 2.5 && h < 6) out.lerp(sand, 1 - smoothstep(2.5, 6, h));
  out.lerp(rock, smoothstep(0.55, 0.85, slope) * 0.8 + smoothstep(260, 520, h) * 0.5);
  const df = Math.hypot(x - PLACES.fire.x, z - PLACES.fire.z);
  const scorch = (1 - smoothstep(120, 420, df)) * (0.6 + 0.4 * fbm(x * 0.02, z * 0.02, 2));
  out.lerp(new THREE.Color(0x231a14), scorch * 0.85);
  return out;
}

export function buildTerrain(segments) {
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  const step = WORLD_SIZE / segments;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const h = terrainHeight(x, z);
    p.setY(i, h);
    const sx = terrainHeight(x + step, z) - h, sz = terrainHeight(x, z + step) - h;
    const slope = Math.min(1, Math.hypot(sx, sz) / step);
    groundColor(x, z, h, slope, c);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}
