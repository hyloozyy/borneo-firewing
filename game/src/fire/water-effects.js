// Water: the belly drop (a falling white curtain whose landing cools the fire), scoop spray and wakes.
import * as THREE from 'three';
import { randRange } from '../core/rng.js';
import { ParticlePool } from './particles.js';
import { terrainHeight } from '../world/terrain.js';

const _door = new THREE.Vector3(), _side = new THREE.Vector3(), _back = new THREE.Vector3();

export class WaterEffects {
  constructor(scene, fire, quality) {
    this.fire = fire;
    this.pool = new ParticlePool(quality.waterParticles, { look: 'water', lite: quality.lite, fadeIn: 30 });
    this.sheet = quality.lite ? 1 : 2; // dense sheet particles per mist particle
    this.spray = quality.lite ? 0.5 : 1; // scoop spray density
    scene.add(this.pool.points);
    // Scoop spray has its own droplet look.
    this.sprayPool = new ParticlePool(quality.lite ? 900 : 3200, { look: 'spray', lite: quality.lite, fadeIn: 30 });
    scene.add(this.sprayPool.points);
    this.hits = 0;
    this.landed = 0;
    this.heatRemoved = 0;
    this.pool.onLand = (x, y, z) => {
      this.landed++;
      const removed = this.fire.douse(x, z, 70, 0.4);
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

  // Release some of the load this frame from the belly doors: a dense white sheet that leaves the
  // doors at the aircraft's speed (spread along this frame's path so it never breaks into puffs),
  // plus the billowing mist it turns into as the air tears it apart on the way down.
  emitDrop(s, dt, kgPerSec) {
    const release = Math.min(s.water, kgPerSec * dt);
    s.water -= release;
    const n = Math.ceil(release / 12);
    const v = s.velocity;
    const door = _door.set(0, -2.0, -1.4).applyQuaternion(s.quaternion).add(s.position);
    const side = _side.set(1, 0, 0).applyQuaternion(s.quaternion);
    for (let i = 0; i < n; i++) {
      const back = randRange(0, dt), w = randRange(-0.7, 0.7);
      this.pool.spawn(door.x - v.x * back + side.x * w, door.y - randRange(0, 1.5), door.z - v.z * back + side.z * w,
        v.x * 0.9 + randRange(-2.5, 2.5), v.y - randRange(2, 6), v.z * 0.9 + randRange(-2.5, 2.5),
        8, randRange(2.2, 3.5), randRange(12, 20), [0.92, 0.95, 0.98, 0.75], [0.85, 0.9, 0.95, 0.08], 0.55, -9.81, 1);
    }
    for (let i = 0; i < n * this.sheet; i++) {
      const back = randRange(0, dt), w = randRange(-0.8, 0.8);
      this.pool.spawn(door.x - v.x * back + side.x * w, door.y + randRange(-0.3, 0.2), door.z - v.z * back + side.z * w,
        v.x * 0.95 + randRange(-1, 1), v.y - randRange(4, 9), v.z * 0.95 + randRange(-1, 1),
        randRange(1.6, 2.6), randRange(1.1, 1.8), randRange(5, 9), [1, 1, 1, 0.98], [0.9, 0.94, 0.98, 0.25], 0.3, -9.81, 0);
    }
    return release;
  }

  // Spray kicked up while skimming the lake: bow-wave sheets thrown sideways off the chines, the
  // white rooster tail the scoop probes throw up behind the step, and low churned water in the wake.
  emitScoopSpray(s) {
    const p = s.position, v = s.velocity;
    const back = _back.set(0, 0, 1).applyQuaternion(s.quaternion);
    const r = _side.set(1, 0, 0).applyQuaternion(s.quaternion);
    for (let i = 0; i < this.spray * 16; i++) {
      const side = i % 2 ? 1 : -1;
      const f = randRange(-2, 4); // along the hull, from the step forward
      this.sprayPool.spawn(p.x + back.x * f + r.x * side * 1.5, 0.3, p.z + back.z * f + r.z * side * 1.5,
        v.x * 0.45 + r.x * side * randRange(5, 11), randRange(3, 8), v.z * 0.45 + r.z * side * randRange(5, 11),
        randRange(0.8, 1.4), randRange(0.6, 1.1), randRange(2.5, 4.5), [1, 1, 1, 0.95], [0.92, 0.96, 1, 0], 0.6, -9.81, 0);
    }
    for (let i = 0; i < this.spray * 8; i++) {
      const w = randRange(-1.2, 1.2);
      this.sprayPool.spawn(p.x + back.x * 4 + r.x * w, 0.5, p.z + back.z * 4 + r.z * w,
        v.x * 0.55 + r.x * w * 2, randRange(7, 13), v.z * 0.55 + r.z * w * 2,
        randRange(1.1, 1.8), randRange(0.7, 1.2), randRange(3.5, 6.5), [1, 1, 1, 0.9], [0.9, 0.95, 1, 0], 0.45, -9.81, 0);
    }
    for (let i = 0; i < 2; i++) {
      this.sprayPool.spawn(p.x + back.x * randRange(6, 10) + r.x * randRange(-2, 2), 0.4, p.z + back.z * randRange(6, 10) + r.z * randRange(-2, 2),
        v.x * 0.2, randRange(0.5, 2), v.z * 0.2, randRange(1.4, 2.4), 2, randRange(6, 10), [0.95, 0.97, 1, 0.45], [0.85, 0.9, 0.95, 0], 0.9, -1, 0);
    }
  }

  steam(x, y, z) {
    this.steamPool.spawn(x + randRange(-6, 6), y, z + randRange(-6, 6), 0, randRange(5, 10), 0, randRange(3, 5), 20, 70,
      [0.95, 0.95, 0.95, 0.5], [0.8, 0.8, 0.8, 0], 0.2, 1, 0);
  }

  update(dt, wind) {
    this.pool.update(dt, wind, (x, z) => this.ground(x, z));
    this.sprayPool.update(dt, wind, null);
  }
}
