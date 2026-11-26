// Damage and systems model for the FW-218: per-engine temperature (ITT), overheating in smoke and
// heat, engine fires and the fire bottle, engine failure (fly on one), bird strikes, structural
// stress from g-load and hard landings, fuel leaks. Produces events for the HUD, cockpit
// annunciators, audio and the crash/landing report.

export const ITT_REDLINE = 800; // °C
const ITT_IDLE = 470;

export function createDamage() {
  const engine = (i) => ({ id: i + 1, health: 1, itt: ITT_IDLE, fire: false, fireTime: 0, failed: false, bottle: true, overTime: 0, bias: i ? 1.06 : 0.97 });
  return {
    engines: [engine(0), engine(1)],
    structure: 1,
    gear: 1,
    windscreen: 0, // 0 clean .. 1 cracked / smeared
    fuelLeak: 0, // kg/s
    maxG: 1, minG: 1,
    log: [], // { t, text, level }
    events: [], // consumed each frame by the game (toasts, sounds)
    birdCooldown: 0,
  };
}

function report(d, t, text, level = 'caution') {
  d.log.push({ t, text, level });
  d.events.push({ text, level });
}

// Thrust share of each engine (0..1): a failed or burning engine gives little or nothing.
export function engineOutput(e) {
  if (e.failed) return 0;
  const hot = e.itt > ITT_REDLINE + 60 ? 0.85 : 1;
  return Math.max(0.15, e.health) * hot * (e.fire ? 0.5 : 1);
}

export function worstEngineHealth(d) {
  return Math.min(...d.engines.map((e) => (e.failed ? 0 : e.health)));
}

export function damageSummary(d) {
  const out = [];
  for (const e of d.engines) {
    if (e.failed) out.push(`ENGINE ${e.id} SHUT DOWN`);
    else if (e.fire) out.push(`ENGINE ${e.id} ON FIRE`);
    else if (e.health < 0.95) out.push(`ENGINE ${e.id} ${Math.round(e.health * 100)}%`);
  }
  if (d.structure < 0.97) out.push(`AIRFRAME ${Math.round(d.structure * 100)}%`);
  if (d.gear < 0.97) out.push(`GEAR ${Math.round(d.gear * 100)}%`);
  if (d.windscreen > 0.05) out.push('WINDSCREEN CRACKED');
  if (d.fuelLeak > 0) out.push('FUEL LEAK');
  return out;
}

// env: { dt, time, heat (0..1 smoke/heat around the aircraft), birds: [{ position }] }
export function updateDamage(s, d, env) {
  const { dt, time } = env;
  if (!(dt > 0)) return;
  d.birdCooldown = Math.max(0, d.birdCooldown - dt);
  d.maxG = Math.max(d.maxG, s.gLoad);
  d.minG = Math.min(d.minG, s.gLoad);

  // Engine temperatures: throttle, hot smoky air and damage push ITT up; airspeed cools it.
  d.engines.forEach((e, i) => {
    const running = s.engines && !e.failed && s.fuel > 0;
    const thr = running ? s.throttle : 0;
    const cooling = Math.min(1, s.airspeed / 60) * 60;
    const target = running
      ? ITT_IDLE + thr * 250 * e.bias + env.heat * 330 * e.bias + (1 - e.health) * 120 - cooling + (e.fire ? 260 : 0)
      : 60 + (e.fire ? 600 : 0);
    e.itt += (target - e.itt) * Math.min(1, dt * (running ? 0.35 : 0.15));
    s.engRpm[i] += ((running ? 0.25 + thr * 0.75 * Math.max(0.6, e.health) : 0) - s.engRpm[i]) * Math.min(1, dt * 1.5);

    if (e.itt > ITT_REDLINE && running) {
      e.overTime += dt;
      e.health = Math.max(0, e.health - dt * 0.012 * (1 + (e.itt - ITT_REDLINE) / 60));
      if (e.overTime > 3 && !e.warned) { e.warned = true; report(d, time, `ENGINE ${e.id} OVERHEAT · REDUCE POWER`); }
      if (e.health < 0.45 && !e.fire && Math.random() < dt * 0.08) { e.fire = true; report(d, time, `ENGINE ${e.id} FIRE · PRESS X`, 'warning'); }
    } else {
      e.overTime = Math.max(0, e.overTime - dt * 2);
      if (e.overTime === 0) e.warned = false;
    }
    if (e.fire) {
      e.fireTime += dt;
      e.health = Math.max(0, e.health - dt * 0.05);
      d.structure = Math.max(0, d.structure - dt * 0.006);
      if (e.health <= 0 && !e.failed) { e.failed = true; report(d, time, `ENGINE ${e.id} FAILED`, 'warning'); }
      if (e.fireTime > 45) { s.crashed = `Engine ${e.id} fire burned through the wing`; d.cause = 'fire'; }
    } else if (e.health <= 0 && !e.failed) {
      e.failed = true;
      report(d, time, `ENGINE ${e.id} FLAME-OUT`, 'warning');
    }
  });

  // Structure: over-g in turbulence or hard pulls.
  if (!s.onGround && (s.gLoad > 3.2 || s.gLoad < -1)) {
    const over = s.gLoad > 3.2 ? s.gLoad - 3.2 : -1 - s.gLoad;
    d.structure = Math.max(0, d.structure - over * dt * 0.25);
    if (!d.overG) { d.overG = true; report(d, time, `OVER-G ${s.gLoad.toFixed(1)} G`); }
  } else if (s.gLoad < 2.6 && s.gLoad > -0.4) d.overG = false;

  // Bird strikes: hornbills over the canopy.
  if (!d.birdCooldown && env.birds && s.airspeed > 20) {
    for (const b of env.birds) {
      if (b.position.distanceToSquared(s.position) < 110) { birdStrike(s, d, time); break; }
    }
  }

  if (d.fuelLeak > 0) s.fuel = Math.max(0, s.fuel - d.fuelLeak * dt);
  if (d.structure <= 0 && !s.crashed) { s.crashed = 'Airframe failure in flight'; d.cause = 'structure'; }
}

function birdStrike(s, d, time) {
  d.birdCooldown = 6;
  const r = Math.random();
  if (r < 0.4) {
    d.windscreen = Math.min(1, d.windscreen + 0.6);
    report(d, time, 'BIRD STRIKE · WINDSCREEN');
  } else if (r < 0.8) {
    const e = d.engines[Math.random() < 0.5 ? 0 : 1];
    e.health = Math.max(0, e.health - 0.45);
    report(d, time, `BIRD STRIKE · ENGINE ${e.id}`, 'warning');
  } else {
    d.structure = Math.max(0, d.structure - 0.12);
    d.fuelLeak = Math.max(d.fuelLeak, 1.2);
    report(d, time, 'BIRD STRIKE · WING · FUEL LEAK', 'warning');
  }
}

// A firm touchdown below the crash limit still costs gear and airframe.
export function landingDamage(s, d, vs, time) {
  const v = Math.abs(vs);
  if (v < 2.6) return;
  const k = Math.min(1, (v - 2.6) / 2);
  d.gear = Math.max(0, d.gear - 0.25 - k * 0.5);
  d.structure = Math.max(0, d.structure - 0.05 - k * 0.2);
  report(d, time, `HARD LANDING ${Math.round(vs * 196.85)} FPM`);
}

// Fire bottle (X): puts out the burning engine and shuts it down for good (one bottle each).
export function fireBottle(d, time) {
  const e = d.engines.find((x) => x.fire && x.bottle) || d.engines.find((x) => x.itt > ITT_REDLINE + 40 && x.bottle && !x.failed);
  if (!e) return false;
  e.bottle = false;
  e.fire = false;
  e.failed = true;
  e.itt = Math.min(e.itt, 500);
  report(d, time, `ENGINE ${e.id} FIRE OUT · SHUT DOWN · FLY ON ONE`, 'caution');
  return true;
}
