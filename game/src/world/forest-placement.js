// Where every tree stands: a jittered grid over the whole island (so the canopy closes up with no
// bare patches, hills included), thinned by the forest mask at clearings, water and the airstrip.
// Species follow the land: emergent dipterocarps scattered through old forest, pioneers on the
// edges, palms by the water, an understorey of shrubs and ferns. Stored in flat typed arrays with
// a spatial grid so the level-of-detail pass only visits trees near the camera.
import { terrainHeight, PLACES, riverDistance, WORLD_SIZE } from './terrain.js';
import { forestMask } from './forest-layout.js';
import { fbm } from '../core/noise.js';
import { painterRandom } from '../textures/texture-utils.js';
import { VARIANTS } from './trees/tree-species.js';

export const GRID_CELL = 120;

const byKind = (kind) => VARIANTS.map((v, i) => [v, i]).filter(([v]) => v.kind === kind);

function pickWeighted(list, r) {
  let total = 0;
  for (const [v] of list) total += v.share;
  let acc = 0;
  for (const [v, i] of list) {
    acc += v.share / total;
    if (r < acc) return i;
  }
  return list[list.length - 1][1];
}

export function placeForest(spacing, shrubChance) {
  const rnd = painterRandom(7218);
  const half = WORLD_SIZE / 2 - 200;
  const n = Math.ceil((half * 2) / spacing);
  const cap = Math.ceil(n * n * (1 + shrubChance));
  const px = new Float32Array(cap), py = new Float32Array(cap), pz = new Float32Array(cap);
  const scale = new Float32Array(cap), rot = new Float32Array(cap), burn = new Float32Array(cap);
  const variant = new Uint8Array(cap), tint = new Float32Array(cap * 3);
  const emergent = byKind('emergent'), canopy = byKind('canopy'), sub = byKind('sub');
  const pioneer = byKind('pioneer'), palm = byKind('palm'), shrub = byKind('shrub');
  let count = 0;

  const add = (x, z, h, vi, edge) => {
    const v = VARIANTS[vi];
    px[count] = x; py[count] = h - 0.3; pz[count] = z;
    scale[count] = v.scale[0] + (v.scale[1] - v.scale[0]) * rnd();
    rot[count] = rnd() * Math.PI * 2;
    variant[count] = vi;
    // Crown colour: mostly greens of slightly different hue and brightness, a few bronze
    // young-flush crowns and pale silvery emergents, lighter pioneers.
    const k = rnd(), b = 0.86 + rnd() * 0.26;
    let r = 0.82 + k * 0.28, g = 0.9 + rnd() * 0.16, bl = 0.74 + rnd() * 0.24;
    const s = rnd();
    if (v.kind === 'emergent' && s < 0.25) { r = 1.05; g = 1.08; bl = 0.95; }
    else if (s < 0.035 && v.kind !== 'palm') { r = 1.45; g = 0.92; bl = 0.55; }
    else if (v.kind === 'pioneer' || edge) { g *= 1.06; }
    tint[count * 3] = r * b; tint[count * 3 + 1] = g * b; tint[count * 3 + 2] = bl * b;
    count++;
  };

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = -half + (i + 0.5 + (rnd() - 0.5) * 0.9) * spacing;
      const z = -half + (j + 0.5 + (rnd() - 0.5) * 0.9) * spacing;
      const h = terrainHeight(x, z);
      const m = forestMask(x, z, h);
      const r0 = rnd();
      if (m <= 0.04 || r0 > m) continue;
      const edge = m < 0.85;
      const wet = h < 24 || riverDistance(x, z) < 170 || Math.hypot(x - PLACES.lake.x, z - PLACES.lake.z) < 820 || x > PLACES.coastX - 650;
      // Old-growth patches (more emergents) and secondary-growth patches (more pioneers).
      const age = fbm(x * 0.0016 + 11, z * 0.0016 - 4, 3);
      const r = rnd();
      let vi;
      if (wet && r < 0.2) vi = pickWeighted(palm, rnd());
      else if ((edge && r < 0.45) || r < 0.06 + Math.max(0, 0.42 - age) * 0.4) vi = pickWeighted(pioneer, rnd());
      else if (r < 0.1 + Math.max(0, age - 0.45) * 0.35 && h > 18) vi = pickWeighted(emergent, rnd());
      else if (r < 0.62) vi = pickWeighted(canopy, rnd());
      else vi = pickWeighted(sub, rnd());
      add(x, z, h, vi, edge);
      // Understorey shrub/fern beside it (only ever drawn near the camera).
      if (rnd() < shrubChance * (edge ? 1.6 : 1)) {
        const sx = x + (rnd() - 0.5) * spacing, sz = z + (rnd() - 0.5) * spacing;
        const sh = terrainHeight(sx, sz);
        if (forestMask(sx, sz, sh) > 0.1) add(sx, sz, sh, pickWeighted(shrub, rnd()), edge);
      }
    }
  }

  // Spatial grid: cell start offsets into a list of tree indices.
  const cells = Math.ceil(WORLD_SIZE / GRID_CELL);
  const start = new Int32Array(cells * cells + 1);
  const cellOf = (k) => {
    const cx = Math.min(cells - 1, Math.max(0, Math.floor((px[k] + WORLD_SIZE / 2) / GRID_CELL)));
    const cz = Math.min(cells - 1, Math.max(0, Math.floor((pz[k] + WORLD_SIZE / 2) / GRID_CELL)));
    return cz * cells + cx;
  };
  for (let k = 0; k < count; k++) start[cellOf(k) + 1]++;
  for (let c = 0; c < cells * cells; c++) start[c + 1] += start[c];
  const fill = start.slice(0, cells * cells);
  const index = new Int32Array(count);
  for (let k = 0; k < count; k++) index[fill[cellOf(k)]++] = k;

  const perVariant = new Int32Array(VARIANTS.length);
  for (let k = 0; k < count; k++) perVariant[variant[k]]++;
  return { count, px, py, pz, scale, rot, burn, variant, tint, perVariant, grid: { cells, start, index } };
}

// Visit every tree index within `radius` of (x, z): fn(index, distanceSquared).
export function forEachTreeNear(f, x, z, radius, fn) {
  const { cells, start, index } = f.grid;
  const off = WORLD_SIZE / 2;
  const c0x = Math.max(0, Math.floor((x - radius + off) / GRID_CELL)), c1x = Math.min(cells - 1, Math.floor((x + radius + off) / GRID_CELL));
  const c0z = Math.max(0, Math.floor((z - radius + off) / GRID_CELL)), c1z = Math.min(cells - 1, Math.floor((z + radius + off) / GRID_CELL));
  const r2 = radius * radius;
  const { px, pz } = f;
  for (let cz = c0z; cz <= c1z; cz++) {
    for (let cx = c0x; cx <= c1x; cx++) {
      const c = cz * cells + cx;
      for (let k = start[c]; k < start[c + 1]; k++) {
        const i = index[k];
        const dx = px[i] - x, dz = pz[i] - z;
        const d2 = dx * dx + dz * dz;
        if (d2 < r2) fn(i, d2);
      }
    }
  }
}
