// Where the rainforest grows: a 0..1 mask shared by tree placement and the terrain's canopy layer,
// and the hotspots (fire zone, lake shore, airstrip, village) where trees are placed densest.
import { terrainHeight, isOnRunway, isOnApron, PLACES, riverDistance, lakeLanding, lakeLane } from './terrain.js';
import { smoothstep } from '../core/noise.js';

export function forestMask(x, z, h = terrainHeight(x, z)) {
  if (h < 3.2) return 0;
  if (isOnRunway(x, z, 105) || isOnApron(x, z, 35)) return 0;
  let m = smoothstep(3.2, 7, h) * (1 - smoothstep(760, 980, h));
  m *= smoothstep(150, 200, Math.hypot(x - PLACES.village.x, z - PLACES.village.z));
  m *= smoothstep(34, 60, riverDistance(x, z));
  m *= 1 - lakeLane(x, z).w; // scooping lanes off the lake ends stay clear
  const ld = lakeLanding(); // clearing around the fishing landing
  if (ld) m *= smoothstep(55, 85, Math.hypot(x - ld.x - ld.dx * 20, z - ld.z - ld.dz * 20));
  // Approach lanes off both runway ends are kept clear.
  const r = PLACES.runway;
  const ax = Math.abs(x - r.x), az = Math.abs(z - r.z);
  const lane = 150 + Math.max(0, az - r.length / 2) * 0.12;
  if (az < r.length / 2 + 1600) m *= smoothstep(lane, lane + 60, ax);
  return m;
}

// Hotspots: [x, z, radius, share of all trees].
export const treeHotspots = () => [
  [PLACES.fire.x, PLACES.fire.z, 1100, 0.3],
  [PLACES.lake.x, PLACES.lake.z, 1100, 0.12],
  [PLACES.runway.x, PLACES.runway.z, 1300, 0.12],
  [PLACES.village.x, PLACES.village.z, 700, 0.08],
];
