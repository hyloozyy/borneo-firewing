// A small shaded map of the mission area (water, hills, forest, runway, village), baked once from the
// terrain height function. Shared by the HUD radar and the cockpit moving-map display.
import { terrainHeight, PLACES } from '../world/terrain.js';

export const MAP_EXTENT = 7000; // metres covered, centred on the origin
const SIZE = 256;
let baked = null;

export function terrainMap() {
  if (baked) return baked;
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d', { willReadFrequently: true });
  const img = g.createImageData(SIZE, SIZE);
  const step = MAP_EXTENT / SIZE;
  const hAt = (i, j) => terrainHeight(-MAP_EXTENT / 2 + (i + 0.5) * step, -MAP_EXTENT / 2 + (j + 0.5) * step);
  const H = new Float32Array(SIZE * SIZE);
  for (let j = 0; j < SIZE; j++) for (let i = 0; i < SIZE; i++) H[j * SIZE + i] = hAt(i, j);
  for (let j = 0; j < SIZE; j++) {
    for (let i = 0; i < SIZE; i++) {
      const h = H[j * SIZE + i];
      const k = (j * SIZE + i) * 4;
      if (h < 0) {
        const deep = Math.min(1, -h / 12);
        img.data[k] = 14 - deep * 8; img.data[k + 1] = 70 - deep * 30; img.data[k + 2] = 118 - deep * 30;
      } else {
        // Hill shade from the north-west, greener low ground, browner ridges.
        const dx = H[j * SIZE + Math.min(SIZE - 1, i + 1)] - h, dz = H[Math.min(SIZE - 1, j + 1) * SIZE + i] - h;
        const shade = Math.max(0.45, Math.min(1.35, 1 - (dx + dz) * 0.045));
        const e = Math.min(1, h / 260);
        img.data[k] = (22 + e * 50) * shade; img.data[k + 1] = (58 + e * 22) * shade; img.data[k + 2] = (30 + e * 8) * shade;
      }
      img.data[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // Runway and village drawn on top.
  const px = (x) => ((x + MAP_EXTENT / 2) / MAP_EXTENT) * SIZE;
  const r = PLACES.runway;
  g.fillStyle = '#c9c4b8';
  g.fillRect(px(r.x) - 1.2, px(r.z - r.length / 2), 2.4, (r.length / MAP_EXTENT) * SIZE);
  baked = { canvas: c, size: SIZE, toPx: px };
  return baked;
}
