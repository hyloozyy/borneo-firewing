// Living forest fire: burning cells that grow, spread downwind into unburnt jungle, scorch trees,
// throw flames, embers and towering smoke, and die when doused by water.
import * as THREE from 'three';
import { rand, randRange } from '../core/rng.js';
import { terrainHeight, PLACES } from '../world/terrain.js';
import { ParticlePool } from './particles.js';

const CELL = 55;

export class FireSystem {
  constructor(scene, forest, quality, burnMap) {
    this.scene = scene;
    this.forest = forest;
    this.cells = new Map(); // key -> {x,z,h,heat,burnt}
    this.flames = new ParticlePool(quality.flameParticles, { additive: true, look: 'flame', lite: quality.lite });
    this.smoke = new ParticlePool(quality.smokeParticles, { look: 'smoke', lite: quality.lite });
    scene.add(this.smoke.points);
    scene.add(this.flames.points);
    this.light = new THREE.PointLight(0xff7a2a, 0, 900, 1.4);
    scene.add(this.light);
    // A second, local glow over the burning patch nearest the camera: lights the aircraft's
    // underside, the smoke and the trunks when flying low over the fire.
    this.nearLight = new THREE.PointLight(0xff6420, 0, 320, 1.5);
    scene.add(this.nearLight);
    this.spreadTimer = 0;
    this.spreadRate = 1;
    this.target = null; // optional bias point (the village)
    this.emberClock = 0;
    this.burnMap = burnMap;
    this.glowClock = 0;
    this.doused = 0; // heat knocked down by water, for the stage goals
  }

  key(x, z) { return `${Math.round(x / CELL)},${Math.round(z / CELL)}`; }

  ignite(x, z, heat = 0.6) {
    x = Math.round(x / CELL) * CELL; z = Math.round(z / CELL) * CELL;
    const k = this.key(x, z);
    const h = terrainHeight(x, z);
    if (h < 3) return null;
    let c = this.cells.get(k);
    if (c) { if (!c.burnt) c.heat = Math.max(c.heat, heat); return c; }
    // Each patch of forest holds fuel for a minute or two; then it collapses to ash and cannot reburn.
    c = { x, z, h, heat, burnt: false, age: 0, life: 65 + rand() * 55 };
    this.cells.set(k, c);
    return c;
  }

  // Start the scenario: a main fire front and some spot fires.
  seedScenario() {
    const f = PLACES.fire;
    for (let i = 0; i < 26; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 220;
      const c = this.ignite(f.x + Math.cos(a) * r * 1.3, f.z + Math.sin(a) * r, randRange(0.5, 1));
      if (c) c.age = rand() * 45; // the fire has been burning for a while: not every patch is fresh
    }
    this.forest.scorch(f.x, f.z, 260, 0.9);
    // The ground the fire already swept: ash in a ragged patch around the seed.
    for (let i = 0; i < 40; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 300;
      this.burnMap.paint(f.x + Math.cos(a) * r * 1.2, f.z + Math.sin(a) * r, randRange(40, 90), 0, randRange(0.6, 1));
    }
  }

  activeCells() {
    const out = [];
    for (const c of this.cells.values()) if (!c.burnt && c.heat > 0.05) out.push(c);
    return out;
  }

  centroid(list = this.activeCells()) {
    if (!list.length) return null;
    let x = 0, z = 0, w = 0;
    for (const c of list) { x += c.x * c.heat; z += c.z * c.heat; w += c.heat; }
    return new THREE.Vector3(x / w, terrainHeight(x / w, z / w), z / w);
  }

  // Biggest burning cluster: the best target for the next drop.
  hottestSpot() {
    let best = null, bestScore = -1;
    const list = this.activeCells();
    for (const c of list) {
      let s = 0;
      for (const o of list) if (Math.abs(o.x - c.x) < 130 && Math.abs(o.z - c.z) < 130) s += o.heat;
      if (this.target) s += 4 / (1 + Math.hypot(c.x - this.target.x, c.z - this.target.z) / 200);
      if (s > bestScore) { bestScore = s; best = c; }
    }
    return best ? new THREE.Vector3(best.x, best.h, best.z) : null;
  }

  totalHeat() {
    let s = 0;
    for (const c of this.cells.values()) if (!c.burnt) s += c.heat;
    return s;
  }

  // Water lands at (x,z): cools every cell within the radius. Returns heat removed.
  douse(x, z, radius, amount) {
    let removed = 0;
    this.burnMap.paint(x, z, radius * 0.7, 2, 0.9);
    for (const c of this.cells.values()) {
      if (c.burnt || c.heat <= 0) continue;
      const d = Math.hypot(c.x - x, c.z - z);
      if (d > radius) continue;
      const cut = Math.min(c.heat, amount * (1 - d / radius));
      c.heat -= cut;
      removed += cut;
      c.wet = 1;
      this.burnMap.paint(c.x, c.z, CELL * 0.6, 1, 0, 'set');
      if (c.heat < 0.05) { c.heat = 0; c.burnt = true; this.addScorch(c.x, c.z, CELL * 0.8, false); }
    }
    this.doused += removed;
    return removed;
  }

  addScorch(x, z, r, glowing) {
    this.burnMap.paint(x, z, r * 1.3, 0, 1);
    if (glowing) this.burnMap.paint(x, z, r, 1, 0.9);
    else this.burnMap.paint(x, z, r * 1.1, 1, 0, 'set');
  }

  spreadStep(wind) {
    const list = this.activeCells();
    const wl = Math.hypot(wind.x, wind.z) || 1;
    for (const c of list) {
      if (c.age > c.life) {
        // Fuel spent: the patch dies down to glowing ash.
        c.heat -= 0.14;
        if (c.heat <= 0.05) { c.heat = 0; c.burnt = true; this.addScorch(c.x, c.z, CELL * 0.8, false); }
        continue;
      }
      c.heat = Math.min(1.2, c.heat + 0.04 * this.spreadRate);
      if (c.heat < 0.55 || rand() > 0.22 * this.spreadRate) continue;
      // Pick a neighbour, preferring downwind and toward the target.
      let best = null, bestS = -9;
      for (let t = 0; t < 4; t++) {
        const a = rand() * Math.PI * 2;
        const nx = c.x + Math.cos(a) * CELL, nz = c.z + Math.sin(a) * CELL;
        let s = (Math.cos(a) * wind.x + Math.sin(a) * wind.z) / wl + rand() * 0.6;
        if (this.target && Math.hypot(this.target.x - c.x, this.target.z - c.z) < 800) s += 0.6 * (Math.cos(a) * (this.target.x - c.x) + Math.sin(a) * (this.target.z - c.z)) / (Math.hypot(this.target.x - c.x, this.target.z - c.z) || 1);
        if (s > bestS) { bestS = s; best = [nx, nz]; }
      }
      const k = this.key(best[0], best[1]);
      const ex = this.cells.get(k);
      if (ex && (ex.burnt || ex.wet)) continue;
      const n = this.ignite(best[0], best[1], 0.3);
      if (n && !ex) { this.forest.scorch(n.x, n.z, CELL * 1.2, 0.5); this.addScorch(n.x, n.z, CELL * 0.7, true); }
    }
  }

  update(dt, wind, time, camPos) {
    this.spreadTimer += dt;
    if (this.spreadTimer > 2.5) { this.spreadTimer = 0; this.spreadStep(wind); }
    let lx = 0, lz = 0, lw = 0, near = null, nearD = 1e18;
    for (const c of this.cells.values()) {
      if (c.burnt || c.heat <= 0) continue;
      c.age += dt;
      lx += c.x * c.heat; lz += c.z * c.heat; lw += c.heat;
      if (camPos) { const d = (camPos.x - c.x) ** 2 + (camPos.z - c.z) ** 2; if (d < nearD) { nearD = d; near = c; } }
      const far = camPos ? Math.hypot(camPos.x - c.x, camPos.z - c.z) : 0;
      const rate = c.heat * (far > 2500 ? 3 : 9) * dt;
      // Flames: bright cores that rise and cool to deep orange.
      for (let n = 0; n < rate * 2 + (rand() < (rate * 2) % 1 ? 1 : 0); n++) {
        const ox = randRange(-CELL * 0.5, CELL * 0.5), oz = randRange(-CELL * 0.5, CELL * 0.5);
        const hgt = randRange(0, 8);
        this.flames.spawn(c.x + ox, c.h + hgt, c.z + oz, randRange(-1, 1), randRange(9, 18) * (0.6 + c.heat * 0.5), randRange(-1, 1),
          randRange(0.9, 1.7), randRange(14, 26) * (0.6 + c.heat), 4,
          [1.0, 0.85, 0.45, 0.95], [0.9, 0.18, 0.02, 0.0], 0.3, 2);
      }
      // Crown fire: tall tongues licking out of the burning canopy, visible from the air.
      for (let n = 0; c.heat > 0.35 && n < rate * 1.2 + (rand() < (rate * 1.2) % 1 ? 1 : 0); n++) {
        const ox = randRange(-CELL * 0.45, CELL * 0.45), oz = randRange(-CELL * 0.45, CELL * 0.45);
        this.flames.spawn(c.x + ox, c.h + randRange(20, 40), c.z + oz, randRange(-1.5, 1.5), randRange(10, 16) * (0.7 + c.heat * 0.4), randRange(-1.5, 1.5),
          randRange(1.0, 1.7), randRange(26, 44) * (0.6 + c.heat * 0.6), 8,
          [1.0, 0.8, 0.4, 0.9], [0.85, 0.15, 0.02, 0.0], 0.35, 2);
      }
      // Smoke: dark at the base, lit brown-grey higher up, drifting downwind.
      if (rand() < rate * 0.55) {
        this.smoke.spawn(c.x + randRange(-20, 20), c.h + randRange(25, 40), c.z + randRange(-20, 20),
          randRange(-2, 2), randRange(16, 26), randRange(-2, 2),
          randRange(12, 20), randRange(18, 30), randRange(150, 260),
          [0.14, 0.11, 0.09, 0.62], [0.62, 0.55, 0.5, 0.0], 0.1, 0.8);
      }
      // Rain on the fire: white steam boils up off the burning canopy.
      if (this.steam && rand() < rate * 0.5) {
        this.smoke.spawn(c.x + randRange(-25, 25), c.h + randRange(28, 42), c.z + randRange(-25, 25),
          randRange(-1.5, 1.5), randRange(8, 14), randRange(-1.5, 1.5),
          randRange(5, 9), randRange(14, 22), randRange(70, 120),
          [0.85, 0.85, 0.86, 0.38], [0.9, 0.9, 0.92, 0.0], 0.15, 0.4);
      }
      // Embers
      if (rand() < rate * 0.6) {
        this.flames.spawn(c.x + randRange(-25, 25), c.h + randRange(5, 20), c.z + randRange(-25, 25), randRange(-4, 4), randRange(8, 20), randRange(-4, 4),
          randRange(1.5, 3), 1.6, 0.6, [1, 0.7, 0.2, 1], [1, 0.2, 0, 0], 0.4, -2);
      }
    }
    // Embers fade on their own; burning cells keep their ground glowing.
    this.glowClock += dt;
    if (this.glowClock > 0.5) {
      this.glowClock = 0;
      const d = this.burnMap.data;
      for (let i = 1; i < d.length; i += 4) if (d[i]) d[i] = Math.floor(d[i] * 0.96);
      for (const c of this.cells.values()) if (!c.burnt && c.heat > 0.05) this.burnMap.paint(c.x, c.z, CELL * 0.75, 1, Math.min(1, 0.35 + c.heat * 0.6));
      this.burnMap.dirty = true;
    }
    this.burnMap.flush();
    this.flames.update(dt, wind, null);
    this.smoke.update(dt, wind, null);
    if (lw > 0) {
      this.light.position.set(lx / lw, terrainHeight(lx / lw, lz / lw) + 40, lz / lw);
      this.light.intensity = Math.min(9, lw * 0.6) * (0.8 + 0.2 * Math.sin(time * 13) * Math.sin(time * 7.3)) * 1000;
    } else this.light.intensity = 0;
    if (near && nearD < 500 * 500) {
      this.nearLight.position.set(near.x, near.h + 28, near.z);
      this.nearLight.intensity = Math.min(1.2, near.heat) * 2500 * (0.75 + 0.25 * Math.sin(time * 11) * Math.sin(time * 6.7));
    } else this.nearLight.intensity = 0;
  }

  // How deep the aircraft is in smoke (0..1): drives turbulence and visibility.
  smokeAt(pos) {
    let s = 0;
    for (const c of this.cells.values()) {
      if (c.burnt || c.heat <= 0.1) continue;
      const d = Math.hypot(pos.x - c.x, pos.z - c.z);
      if (d < 160 && pos.y - c.h < 380) s += c.heat * (1 - d / 160) * 0.35;
    }
    return Math.min(1, s);
  }
}
