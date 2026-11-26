// The karhutla mission in five stages, each with its own goal, radio calls, checklist and score.
import * as THREE from 'three';
import { PLACES, terrainHeight } from '../world/terrain.js';
import { makeRing, orientRing, passedRing } from './rings.js';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

export const STAGES = [
  {
    id: 'takeoff',
    title: 'STAGE 1 · TAKE-OFF & PATROL',
    subtitle: 'Take off from the jungle strip and fly through 3 patrol rings along the river.',
    radio: [
      'POSKO DAMKAR: Enggang 218, large hotspot reported north of the strip. Start both engines, flaps 1, cleared for take-off runway 36.',
      'POSKO DAMKAR: Follow the river north and fly the patrol rings. Report the fire front.',
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
        game.addScore(150, 'PATROL RING');
      }
      return d.index >= d.rings.length ? 'pass' : null;
    },
    objective(game) {
      const d = game.stageData;
      const ring = d.rings[d.index];
      return ring ? { pos: ring.position, label: `RING ${d.index + 1}/3` } : null;
    },
    checklist(game) {
      const s = game.flight, d = game.stageData;
      return [
        [s.rpm > 0.3, 'Engines running (R throttle)'],
        [s.flaps > 0.2 || !s.onGround, 'Flaps 1 (V)'],
        [!s.onGround, 'Rotate at 75 kt (S)'],
        [d.index >= 3, `Patrol rings ${Math.min(3, d.index)}/3`],
      ];
    },
    exit(game) { for (const r of game.stageData.rings) game.scene.remove(r); },
  },
  {
    id: 'scoop',
    title: 'STAGE 2 · FIRST SCOOP',
    subtitle: 'Fly to the lake, touch down gently at 60–115 kt and fill the tank.',
    radio: ['POSKO DAMKAR: Fill up on the west lake. Shallow descent, under 115 knots, keep the nose up and do not dive at the water!'],
    enter(game) { game.stageData.min = 0.8; },
    update(game) {
      return game.flight.water >= game.flight.waterMax * game.stageData.min && !game.flight.onWater ? 'pass' : null;
    },
    objective(game) {
      return { pos: v3(PLACES.lake.x + 250, 0, PLACES.lake.z), label: 'LAKE' };
    },
    checklist(game) {
      const s = game.flight;
      const pct = Math.round((100 * s.water) / s.waterMax);
      return [
        [s.position.distanceTo(v3(PLACES.lake.x, 0, PLACES.lake.z)) < 900, 'Head for the lake'],
        [s.onWater || s.water > 0, 'Touch the water gently'],
        [pct >= 80, `Water tank ${pct}% / 80%`],
        [pct >= 80 && !s.onWater, 'Climb away'],
      ];
    },
  },
  {
    id: 'attack',
    title: 'STAGE 3 · FIRE ATTACK',
    subtitle: 'Fly through the target ring over the fire and drop (SPACE). Refill and repeat.',
    radio: ['POSKO DAMKAR: The fire is running downwind! Fly through the target ring and open the doors right over it.', 'POSKO DAMKAR: Mind your engine temperatures in that smoke, 218. Ease the power if ITT climbs.'],
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
        game.addScore(100, 'TARGET RING');
      }
      if (game.lastDropDone) { game.lastDropDone = false; d.drops++; placeDropRing(game, d.ring); }
      const ratio = game.fire.totalHeat() / d.startHeat;
      d.ratio = ratio;
      return ratio < 0.45 ? 'pass' : null;
    },
    objective(game) {
      const d = game.stageData;
      if (game.flight.water < 600) return { pos: v3(PLACES.lake.x + 250, 0, PLACES.lake.z), label: 'REFILL' };
      return { pos: d.ring.position, label: 'TARGET RING' };
    },
    checklist(game) {
      const d = game.stageData, s = game.flight;
      const out = Math.max(0, Math.round((1 - (d.ratio ?? 1)) * 100));
      return [
        [s.water > 600, `Water on board ${Math.round((100 * s.water) / s.waterMax)}%`],
        [game.dropWindow > 0, 'Through the target ring'],
        [d.drops > 0, `Drops (SPACE) ${d.drops}`],
        [out >= 55, `Main fire out ${Math.min(100, out)}% / 55%`],
      ];
    },
    exit(game) { game.scene.remove(game.stageData.ring); },
  },
  {
    id: 'village',
    title: 'STAGE 4 · SAVE THE VILLAGE',
    subtitle: 'Wind shift! The fire races toward the stilt village. Lay a wet line before time runs out.',
    radio: ['POSKO DAMKAR: MAYDAY RELAY! The wind has swung east and the fire is racing toward the village. Lay a wet line in front of it!'],
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
      if (passedRing(d.ring, game.prevPos, game.flight.position)) { game.events.ring(); game.dropWindow = 2.5; game.addScore(120, 'VILLAGE RING'); }
      if (game.lastDropDone) { game.lastDropDone = false; d.drops++; placeDropRing(game, d.ring); }
      d.threat = villageThreat(game);
      if (d.threat.near === 0 && d.drops > 0) return 'pass';
      if (d.threat.closest < 70) return 'fail:The fire reached the village. The stilt houses are burning.';
      if (d.timer <= 0) return 'fail:Out of time: the fire swallowed the village.';
      return null;
    },
    objective(game) {
      const d = game.stageData;
      if (game.flight.water < 600) return { pos: v3(PLACES.lake.x + 250, 0, PLACES.lake.z), label: 'REFILL' };
      return { pos: d.ring.position, label: 'PROTECT VILLAGE' };
    },
    checklist(game) {
      const d = game.stageData;
      const t = d.threat || { near: 0, closest: 999 };
      return [
        [false, `Time left ${Math.max(0, Math.ceil(d.timer))} s`],
        [d.drops > 0, `Wet line drops ${d.drops}`],
        [t.near === 0, `Fires within 350 m: ${t.near}`],
        [t.closest > 200, `Nearest fire ${Math.round(t.closest)} m`],
      ];
    },
    exit(game) { game.scene.remove(game.stageData.ring); game.fire.target = null; game.fire.spreadRate = 0.45; },
  },
  {
    id: 'land',
    title: 'STAGE 5 · RETURN & LAND',
    subtitle: 'Fuel is low. Return and land on runway 36, follow the PAPI lights.',
    radio: ['POSKO DAMKAR: Outstanding work, Enggang 218! Fuel is low, return to runway 36. Wind calm, PAPI lights on.'],
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
      if (!d.gate && passedRing(d.ring, game.prevPos, s.position)) { d.gate = true; game.events.ring(); game.addScore(150, 'APPROACH GATE'); }
      if (s.onGround && !s.onWater && s.velocity.length() < 3) return 'pass';
      return null;
    },
    objective(game) {
      const r = PLACES.runway, d = game.stageData;
      if (!d.gate) return { pos: d.ring.position, label: 'FINAL APPROACH' };
      return { pos: v3(r.x, r.h, r.z + r.length / 2 - 200), label: 'RUNWAY 36' };
    },
    checklist(game) {
      const s = game.flight, d = game.stageData;
      return [
        [d.gate, 'Approach gate (green ring)'],
        [s.flaps > 0.6, 'Flaps full (V)'],
        [!!(s.lastTouchdown && !s.lastTouchdown.water && s.onGround), 'Smooth touchdown'],
        [s.onGround && s.velocity.length() < 3, 'Stop (B brakes)'],
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
