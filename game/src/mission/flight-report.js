// Crash and landing report: what happened, with the numbers that explain it (speed, sink rate,
// g-load, bank, damage), so a crash or a landing reads as what happened.
import { landingRating } from './mission-director.js';
import { damageSummary } from '../flight/damage-model.js';
import { terrainHeight, isOnRunway } from '../world/terrain.js';

const FPM = 196.85, KT = 1.944, DEG = 180 / Math.PI;

export function buildFlightReport(game, passed) {
  const s = game.flight, d = s.damage, m = game.mission;
  const td = s.lastTouchdown;
  const items = [];
  const add = (label, value, tone = '') => items.push({ label, value, tone });
  let headline, kind;
  if (passed) {
    kind = 'landing';
    headline = 'MISSION ACCOMPLISHED · FIRE CONTAINED';
    const vs = td ? td.vs * FPM : 0;
    add('TOUCHDOWN', `${Math.round(vs)} fpm`, vs > -300 ? 'ok' : vs > -500 ? 'warn' : 'bad');
    add('RATING', landingRating(td), vs > -400 ? 'ok' : 'warn');
    add('G AT TOUCHDOWN', `${(td?.g ?? 1).toFixed(2)} g`, (td?.g ?? 1) < 1.8 ? 'ok' : 'warn');
    add('CENTRELINE', `${Math.abs(td?.x ?? 0).toFixed(1)} m off`, Math.abs(td?.x ?? 0) < 6 ? 'ok' : 'warn');
  } else if (s.crashed) {
    kind = 'crash';
    const water = terrainHeight(s.position.x, s.position.z) < 0;
    headline = 'AIRCRAFT LOST';
    add('IMPACT SPEED', `${Math.round(s.velocity.length() * KT)} kt`, 'bad');
    add('SINK RATE', `${Math.round(s.velocity.y * FPM)} fpm`, s.velocity.y < -4.5 ? 'bad' : 'warn');
    add('BANK / PITCH', `${Math.round(s.roll * DEG)}° / ${Math.round(s.pitch * DEG)}°`, Math.abs(s.roll) > 0.3 ? 'bad' : '');
    add('SURFACE', water ? 'Water' : isOnRunway(s.position.x, s.position.z, 4) ? 'Runway' : 'Forest');
  } else {
    kind = 'fail';
    headline = 'MISSION FAILED';
    add('FIRES BURNING', String(game.fire.activeCells().length), 'bad');
    add('FUEL LEFT', `${Math.round((100 * s.fuel) / s.fuelMax)}%`, s.fuel < 300 ? 'bad' : '');
  }
  add('MAX G', `${d.maxG.toFixed(1)} g`, d.maxG > 3.2 ? 'bad' : '');
  add('MIN G', `${d.minG.toFixed(1)} g`, d.minG < -1 ? 'bad' : '');
  add('FLIGHT TIME', `${Math.floor(m.elapsed / 60)}:${String(Math.floor(m.elapsed % 60)).padStart(2, '0')}`);
  add('DISTANCE', `${(game.stats.flown / 1852).toFixed(1)} nm`);
  add('WATER DROPPED', `${Math.round(game.stats.dropped).toLocaleString('en-US')} L`);
  const acc = game.water.landed ? Math.round((100 * game.water.hits) / game.water.landed) : 0;
  add('DROP ACCURACY', game.stats.drops ? `${acc}%` : '-', acc > 60 ? 'ok' : '');
  const damage = damageSummary(d);
  const timeline = d.log.slice(-6).map((e) => `${clock(e.t - (game.time - m.elapsed))} ${e.text}`);
  return { kind, headline, cause: s.crashed || m.failReason || '', items, damage, timeline };
}

function clock(t) {
  t = Math.max(0, t);
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
}
