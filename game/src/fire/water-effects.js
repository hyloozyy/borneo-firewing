// Water: the belly drop (a falling white curtain whose landing cools the fire), scoop spray and wakes.
import * as THREE from 'three';
import { randRange } from '../core/rng.js';
import { ParticlePool } from './particles.js';
import { terrainHeight } from '../world/terrain.js';

export class WaterEffects {
  constructor(scene, fire, quality) {
    this.fire = fire;
    this.pool = new ParticlePool(quality.waterParticles, { additive: false, soft: 0.05 });
    scene.add(this.pool.points);
    this.hits = 0;
    this.landed = 0;
    this.heatRemoved = 0;
    this.pool.onLand = (x, y, z) => {
      this.landed++;
      const removed = this.fire.douse(x, z, 70, 0.2);
      this.heatRemoved += removed;
      if (removed > 0) this.hits++;
      // Steam burst where water meets fire, splash elsewhere.
      if (removed > 0) this.steam(x, y, z);
    };
    this.steamPool = fire.smoke;
  }

  ground(x, z) {
    return Math.max(0, terrainHeight(x, z)) + 6;
  }

  // Release some of the load this frame from the belly doors.
  emitDrop(s, dt, kgPerSec) {
    const release = Math.min(s.water, kgPerSec * dt);
    s.water -= release;
    const n = Math.ceil(release / 20);
    const p = s.position, v = s.velocity;
    for (let i = 0; i < n; i++) {
      const sp = randRange(0, 1);
      this.pool.spawn(p.x + randRange(-1.2, 1.2), p.y - 2.2 - sp * 2, p.z + randRange(-1.2, 1.2),
        v.x * 0.9 + randRange(-3, 3), v.y - randRange(2, 6), v.z * 0.9 + randRange(-3, 3),
        8, randRange(4, 6), randRange(16, 26), [1, 1, 1, 0.9], [0.92, 0.95, 1, 0.15], 0.55, -9.81, 1);
    }
    return release;
  }

  // Spray kicked up while skimming the lake.
  emitScoopSpray(s) {
    const p = s.position, v = s.velocity;
    const back = new THREE.Vector3(0, 0, 1).applyQuaternion(s.quaternion);
    for (let i = 0; i < 12; i++) {
      const side = i % 2 ? 1 : -1;
      const r = new THREE.Vector3(side, 0, 0).applyQuaternion(s.quaternion);
      this.pool.spawn(p.x + back.x * 3 + r.x * 1.6, 0.4, p.z + back.z * 3 + r.z * 1.6,
        v.x * 0.35 + r.x * randRange(4, 10), randRange(4, 10), v.z * 0.35 + r.z * randRange(4, 10),
        randRange(0.9, 1.9), 3, randRange(12, 24), [1, 1, 1, 0.85], [0.9, 0.95, 1, 0], 0.8, -9.81, 0);
    }
  }

  steam(x, y, z) {
    this.steamPool.spawn(x + randRange(-6, 6), y, z + randRange(-6, 6), 0, randRange(5, 10), 0, randRange(3, 5), 20, 70,
      [0.95, 0.95, 0.95, 0.5], [0.8, 0.8, 0.8, 0], 0.2, 1, 0);
  }

  update(dt, wind) {
    this.pool.update(dt, wind, (x, z) => this.ground(x, z));
  }
}
