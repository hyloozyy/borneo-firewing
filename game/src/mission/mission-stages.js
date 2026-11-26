// The karhutla mission in five stages, each with its own goal, radio calls, checklist and score.
import * as THREE from 'three';
import { PLACES, terrainHeight } from '../world/terrain.js';
import { makeRing, orientRing, passedRing } from './rings.js';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

export const STAGES = [
  {
    id: 'takeoff',
    title: 'TAHAP 1 · TAKE-OFF & PATROL',
    subtitle: 'Lepas landas dari landasan hutan dan lewati 3 cincin patroli di atas sungai.',
    radio: [
      'POSKO DAMKAR: Enggang 218, titik api besar terpantau di utara. Mesin hidup, flaps 1, lepas landas landasan 36.',
      'POSKO DAMKAR: Ikuti sungai ke utara, lewati cincin patroli.',
    ],
    enter(game) {
      const pts = [v3(-420, 160, 900), v3(-640, 210, 250), v3(-300, 260, -650)];
      game.stageData.rings = pts.map((p, i) => {
        const r = makeRing(42, 0xffc040);
        const next = pts[i + 1] || v3(PLACES.fire.x, 0, PLACES.fire.z);
        const prev = pts[i - 1] || v3(PLACES.runway.x, 0, PLACES.runway.z);
        orientRing(r, p, next.x - prev.x, next.z - prev.z);
        game.scene.add(r);
        return r;
      });
      game.stageData.index = 0;
    },
    update(game) {
      const d = game.stageData;
      const ring = d.rings[d.index];
      if (ring && passedRing(ring, game.prevPos, game.flight.position)) {
        game.events.ring();
        ring.visible = false;
        d.index++;
        game.addScore(150, 'Cincin patroli');
      }
      return d.index >= d.rings.length ? 'pass' : null;
    },
    objective(game) {
      const d = game.stageData;
      const ring = d.rings[d.index];
      return ring ? { pos: ring.position, label: `CINCIN ${d.index + 1}/3` } : null;
    },
    checklist(game) {
      const s = game.flight, d = game.stageData;
      return [
        [s.rpm > 0.3, 'Mesin hidup (R = gas)'],
        [s.flaps > 0.2 || !s.onGround, 'Flaps 1 (V)'],
        [!s.onGround, 'Rotate ±75 kt, tarik (S)'],
        [d.index >= 3, `Cincin patroli ${Math.min(3, d.index)}/3`],
      ];
    },
    exit(game) { for (const r of game.stageData.rings) game.scene.remove(r); },
  },
  {
    id: 'scoop',
    title: 'TAHAP 2 · FIRST SCOOP',
    subtitle: 'Terbang ke danau, sentuh air pelan (60–115 kt) dan isi tangki air.',
    radio: ['POSKO DAMKAR: Isi air di danau barat. Turun landai, kecepatan di bawah 115 knot, jangan menukik!'],
    enter(game) { game.stageData.min = 0.8; },
    update(game) {
      return game.flight.water >= game.flight.waterMax * game.stageData.min && !game.flight.onWater ? 'pass' : null;
    },
    objective(game) {
      return { pos: v3(PLACES.lake.x + 250, 0, PLACES.lake.z), label: 'DANAU' };
    },
    checklist(game) {
      const s = game.flight;
      const pct = Math.round((100 * s.water) / s.waterMax);
      return [
        [s.position.distanceTo(v3(PLACES.lake.x, 0, PLACES.lake.z)) < 900, 'Menuju danau'],
        [s.onWater || s.water > 0, 'Sentuh air (VS > -6 m/s)'],
        [pct >= 80, `Tangki air ${pct}% / 80%`],
        [pct >= 80 && !s.onWater, 'Naik kembali'],
      ];
    },
  },
  {
    id: 'attack',
    title: 'TAHAP 3 · FIRE ATTACK',
    subtitle: 'Lewati cincin target di atas api lalu jatuhkan air (SPACE). Isi ulang dan ulangi.',
    radio: ['POSKO DAMKAR: Api menyebar ke arah angin! Lewati cincin target, buka pintu air tepat di atasnya.'],
    enter(game) {
      const d = game.stageData;
      d.ring = makeRing(55, 0xff5a1e);
      game.scene.add(d.ring);
      d.startHeat = game.fire.totalHeat();
      game.fire.spreadRate = 0.5;
      d.drops = 0;
      placeDropRing(game, d.ring);
    },
    update(game) {
      const d = game.stageData;
      if (passedRing(d.ring, game.prevPos, game.flight.position)) {
        game.events.ring();
        game.dropWindow = 2.5;
        game.addScore(100, 'Masuk cincin target');
      }
      if (game.lastDropDone) { game.lastDropDone = false; d.drops++; placeDropRing(game, d.ring); }
      const ratio = game.fire.totalHeat() / d.startHeat;
      d.ratio = ratio;
      return ratio < 0.45 ? 'pass' : null;
    },
    objective(game) {
      const d = game.stageData;
      if (game.flight.water < 600) return { pos: v3(PLACES.lake.x + 250, 0, PLACES.lake.z), label: 'ISI AIR' };
      return { pos: d.ring.position, label: 'CINCIN TARGET' };
    },
    checklist(game) {
      const d = game.stageData, s = game.flight;
      const out = Math.max(0, Math.round((1 - (d.ratio ?? 1)) * 100));
      return [
        [s.water > 600, `Air di tangki ${Math.round((100 * s.water) / s.waterMax)}%`],
        [game.dropWindow > 0, 'Masuk cincin target'],
        [d.drops > 0, `Jatuhkan air (SPACE) · ${d.drops}x`],
        [out >= 55, `Api utama padam ${Math.min(100, out)}% / 55%`],
      ];
    },
    exit(game) { game.scene.remove(game.stageData.ring); },
  },
  {
    id: 'village',
    title: 'TAHAP 4 · SAVE THE VILLAGE',
    subtitle: 'Angin berbalik! Api mengejar desa panggung. Padamkan api dekat desa sebelum waktu habis.',
    radio: ['POSKO DAMKAR: DARURAT! Angin berbalik ke timur, api bergerak ke desa. Buat garis basah di depan desa!'],
    enter(game) {
      const d = game.stageData;
      const v = PLACES.village;
      game.wind.set(7, 0, 3.5);
      game.fire.target = v3(v.x, 0, v.z);
      game.fire.spreadRate = 0.45;
      // A new front breaks out toward the village.
      for (let i = 0; i < 9; i++) game.fire.ignite(v.x - 520 + i * 30, v.z - 240 + i * 25, 0.9);
      d.timer = 210;
      d.ring = makeRing(55, 0xff3b30);
      game.scene.add(d.ring);
      d.drops = 0;
      placeDropRing(game, d.ring);
    },
    update(game, dt) {
      const d = game.stageData;
      d.timer -= dt;
      if (passedRing(d.ring, game.prevPos, game.flight.position)) { game.events.ring(); game.dropWindow = 2.5; game.addScore(120, 'Cincin desa'); }
      if (game.lastDropDone) { game.lastDropDone = false; d.drops++; placeDropRing(game, d.ring); }
      d.threat = villageThreat(game);
      if (d.threat.near === 0 && d.drops > 0) return 'pass';
      if (d.threat.closest < 70) return 'fail:Api mencapai desa. Desa terbakar.';
      if (d.timer <= 0) return 'fail:Waktu habis, api menelan desa.';
      return null;
    },
    objective(game) {
      const d = game.stageData;
      if (game.flight.water < 600) return { pos: v3(PLACES.lake.x + 250, 0, PLACES.lake.z), label: 'ISI AIR' };
      return { pos: d.ring.position, label: 'LINDUNGI DESA' };
    },
    checklist(game) {
      const d = game.stageData;
      const t = d.threat || { near: 0, closest: 999 };
      return [
        [false, `Waktu ${Math.max(0, Math.ceil(d.timer))} dtk`],
        [d.drops > 0, `Garis basah di depan desa · ${d.drops}x`],
        [t.near === 0, `Titik api < 350 m dari desa: ${t.near}`],
        [t.closest > 200, `Jarak api terdekat ${Math.round(t.closest)} m`],
      ];
    },
    exit(game) { game.scene.remove(game.stageData.ring); game.fire.target = null; game.fire.spreadRate = 0.45; },
  },
  {
    id: 'land',
    title: 'TAHAP 5 · RETURN & LAND',
    subtitle: 'Bahan bakar menipis. Kembali dan mendarat di landasan 36, ikuti lampu PAPI.',
    radio: ['POSKO DAMKAR: Kerja bagus, Enggang 218! BBM menipis, kembali ke landasan 36. Angin tenang.'],
    enter(game) {
      game.flight.fuel = Math.min(game.flight.fuel, 900);
      game.wind.set(1, 0, 0.5);
      const r = PLACES.runway;
      const d = game.stageData;
      d.ring = makeRing(48, 0x5cf08a);
      orientRing(d.ring, v3(r.x, r.h + 95, r.z + r.length / 2 + 1400), 0, -1);
      game.scene.add(d.ring);
      d.gate = false;
    },
    update(game) {
      const s = game.flight, d = game.stageData;
      if (!d.gate && passedRing(d.ring, game.prevPos, s.position)) { d.gate = true; game.events.ring(); game.addScore(150, 'Gerbang final approach'); }
      if (s.onGround && !s.onWater && s.velocity.length() < 3) return 'pass';
      return null;
    },
    objective(game) {
      const r = PLACES.runway, d = game.stageData;
      if (!d.gate) return { pos: d.ring.position, label: 'FINAL APPROACH' };
      return { pos: v3(r.x, r.h, r.z + r.length / 2 - 200), label: 'LANDASAN 36' };
    },
    checklist(game) {
      const s = game.flight, d = game.stageData;
      return [
        [d.gate, 'Gerbang approach (cincin hijau)'],
        [s.flaps > 0.6, 'Flaps penuh (V)'],
        [!!(s.lastTouchdown && !s.lastTouchdown.water && s.onGround), 'Touchdown halus (VS > -2.5 m/s)'],
        [s.onGround && s.velocity.length() < 3, 'Berhenti (B = rem)'],
      ];
    },
    exit(game) { game.scene.remove(game.stageData.ring); },
  },
];

function villageThreat(game) {
  const v = PLACES.village;
  let near = 0, closest = 1e9;
  for (const c of game.fire.activeCells()) {
    const d = Math.hypot(c.x - v.x, c.z - v.z);
    if (d < 350) near++;
    if (d < closest) closest = d;
  }
  return { near, closest };
}

// Hang the drop ring above the hottest part of the fire, facing the run-in from the aircraft.
export function placeDropRing(game, ring) {
  const spot = game.fire.hottestSpot();
  if (!spot) return;
  const p = game.flight.position;
  let dx = spot.x - p.x, dz = spot.z - p.z;
  const l = Math.hypot(dx, dz) || 1;
  dx /= l; dz /= l;
  // Water falls ahead of the release point: put the ring ~180 m before the target.
  const pos = new THREE.Vector3(spot.x - dx * 170, Math.max(spot.y, terrainHeight(spot.x - dx * 170, spot.z - dz * 170)) + 75, spot.z - dz * 170);
  orientRing(ring, pos, dx, dz);
}
