// A live texture over the fire zone painted by the fire system: red = scorched/ash, green =
// glowing embers (burning now), blue = wet (doused). The terrain shader turns it into black ash,
// glowing ground and dark soaked soil.
import * as THREE from 'three';
import { PLACES } from '../world/terrain.js';

export const BURN_SIZE = 3600; // metres covered
export const BURN_RES = 256;

export class BurnMap {
  constructor() {
    this.data = new Uint8Array(BURN_RES * BURN_RES * 4);
    this.texture = new THREE.DataTexture(this.data, BURN_RES, BURN_RES, THREE.RGBAFormat);
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.needsUpdate = true;
    this.origin = new THREE.Vector2(PLACES.fire.x - BURN_SIZE / 2, PLACES.fire.z - BURN_SIZE / 2);
    this.dirty = false;
  }

  // Raise (or set, for glow) a channel inside a soft-edged disc; radius in metres.
  paint(x, z, radius, channel, value, mode = 'max') {
    const s = BURN_RES / BURN_SIZE;
    const cx = (x - this.origin.x) * s, cz = (z - this.origin.y) * s, r = radius * s;
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(BURN_RES - 1, Math.ceil(cx + r));
    const z0 = Math.max(0, Math.floor(cz - r)), z1 = Math.min(BURN_RES - 1, Math.ceil(cz + r));
    for (let j = z0; j <= z1; j++) {
      for (let i = x0; i <= x1; i++) {
        const d = Math.hypot(i - cx, j - cz) / r;
        if (d >= 1) continue;
        // Ragged edge so burns are not perfect circles.
        const rag = 0.75 + 0.25 * Math.sin(i * 1.7 + j * 2.3) * Math.cos(i * 0.9 - j * 1.3);
        const w = Math.max(0, Math.min(1, (1 - d) * 2.2 * rag));
        const k = (j * BURN_RES + i) * 4 + channel;
        const v = Math.round(value * w * 255);
        if (mode === 'max') this.data[k] = Math.max(this.data[k], v);
        else this.data[k] = Math.round(this.data[k] * (1 - w) + value * 255 * w);
      }
    }
    this.dirty = true;
  }

  flush() {
    if (this.dirty) { this.texture.needsUpdate = true; this.dirty = false; }
  }
}
