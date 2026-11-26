// Living forest fire: burning cells that grow, spread downwind into unburnt jungle, scorch trees,
// throw flames, embers and towering smoke, and die when doused by water.
import * as THREE from 'three';
import { rand, randRange } from '../core/rng.js';
import { terrainHeight, PLACES } from '../world/terrain.js';
import { ParticlePool } from './particles.js';

const CELL = 55;

export class FireSystem {
  constructor(scene, forest, quality) {
    this.scene = scene;
    this.forest = forest;
    this.cells = new Map(); // key -> {x,z,h,heat,burnt}
    this.flames = new ParticlePool(quality.flameParticles, { additive: true, soft: 0.0 });
    this.smoke = new ParticlePool(quality.smokeParticles, { additive: false, soft: 0.0 });
    scene.add(this.smoke.points);
    scene.add(this.flames.points);
    this.light = new THREE.PointLight(0xff7a2a, 0, 900, 1.4);
    scene.add(this.light);
    this.spreadTimer = 0;
    this.spreadRate = 1;
    this.target = null; // optional bias point (the village)
    this.scorchMarks = [];
    this.emberClock = 0;
    const scorchGeo = new THREE.CircleGeometry(1, 16);
    scorchGeo.rotateX(-Math.PI / 2);
    this.scorchMesh = new THREE.InstancedMesh(scorchGeo, new THREE.MeshBasicMaterial({ color: 0x1a120c, transparent: true, opacity: 0.75, depthWrite: false }), 400);
    this.scorchMesh.count = 0;
    this.scorchMesh.frustumCulled = false;
    scene.add(this.scorchMesh);
    this.glowMesh = new THREE.InstancedMesh(scorchGeo, new THREE.MeshBasicMaterial({ color: 0xff4a10, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }), 400);
    this.glowMesh.count = 0;
    this.glowMesh.frustumCulled = false;
    scene.add(this.glowMesh);
  }

  key(x, z) { return `${Math.round(x / CELL)},${Math.round(z / CELL)}`; }

  ignite(x, z, heat = 0.6) {
    x = Math.round(x / CELL) * CELL; z = Math.round(z / CELL) * CELL;
    const k = this.key(x, z);
    const h = terrainHeight(x, z);
    if (h < 3) return null;
    let c = this.cells.get(k);
    if (c) { if (!c.burnt) c.heat = Math.max(c.heat, heat); return c; }
    c = { x, z, h, heat, burnt: false, age: 0 };
    this.cells.set(k, c);
    return c;
  }

  // Start the scenario: a main fire front and some spot fires.
  seedScenario() {
    const f = PLACES.fire;
    for (let i = 0; i < 26; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 220;
      this.ignite(f.x + Math.cos(a) * r * 1.3, f.z + Math.sin(a) * r, randRange(0.5, 1));
    }
    this.forest.scorch(f.x, f.z, 260, 0.9);
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
    for (const c of this.cells.values()) {
      if (c.burnt || c.heat <= 0) continue;
      const d = Math.hypot(c.x - x, c.z - z);
      if (d > radius) continue;
      const cut = Math.min(c.heat, amount * (1 - d / radius));
      c.heat -= cut;
      removed += cut;
      c.wet = 1;
      if (c.heat < 0.05) { c.heat = 0; c.burnt = true; this.addScorch(c.x, c.z, CELL * 0.8, false); }
    }
    return removed;
  }

  addScorch(x, z, r, glowing) {
    const mesh = glowing ? this.glowMesh : this.scorchMesh;
    if (mesh.count >= 400) return;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, terrainHeight(x, z) + 0.6 + (glowing ? 0.2 : 0), z), new THREE.Quaternion(), new THREE.Vector3(r, 1, r));
    mesh.setMatrixAt(mesh.count++, m);
    mesh.instanceMatrix.needsUpdate = true;
  }

  spreadStep(wind) {
    const list = this.activeCells();
    const wl = Math.hypot(wind.x, wind.z) || 1;
    for (const c of list) {
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
    let lx = 0, lz = 0, lw = 0;
    for (const c of this.cells.values()) {
      if (c.burnt || c.heat <= 0) continue;
      c.age += dt;
      lx += c.x * c.heat; lz += c.z * c.heat; lw += c.heat;
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
      // Smoke: dark at the base, lit brown-grey higher up, drifting downwind.
      if (rand() < rate * 0.55) {
        this.smoke.spawn(c.x + randRange(-20, 20), c.h + randRange(10, 25), c.z + randRange(-20, 20),
          randRange(-2, 2), randRange(12, 20), randRange(-2, 2),
          randRange(12, 20), randRange(30, 50), randRange(220, 360),
          [0.2, 0.15, 0.12, 0.5], [0.66, 0.58, 0.52, 0.0], 0.12, 0.6);
      }
      // Embers
      if (rand() < rate * 0.6) {
        this.flames.spawn(c.x + randRange(-25, 25), c.h + randRange(5, 20), c.z + randRange(-25, 25), randRange(-4, 4), randRange(8, 20), randRange(-4, 4),
          randRange(1.5, 3), 1.6, 0.6, [1, 0.7, 0.2, 1], [1, 0.2, 0, 0], 0.4, -2);
      }
    }
    this.flames.update(dt, wind, null);
    this.smoke.update(dt, wind, null);
    if (lw > 0) {
      this.light.position.set(lx / lw, terrainHeight(lx / lw, lz / lw) + 40, lz / lw);
      this.light.intensity = Math.min(9, lw * 0.6) * (0.8 + 0.2 * Math.sin(time * 13) * Math.sin(time * 7.3)) * 1000;
    } else this.light.intensity = 0;
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
