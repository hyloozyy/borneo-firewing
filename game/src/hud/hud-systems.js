// Mission status strip with stage progress, the engines & systems panel (per-engine RPM arc and
// ITT, fuel, water tank, airframe), readout pairs under the tapes and the G-meter.
import { C, font, glow, panel, bar, labelValue } from './hud-style.js';
import { ITT_REDLINE } from '../flight/damage-model.js';
import { MISSION_TIME_LIMIT } from '../mission/mission-director.js';
import { STAGES } from '../mission/mission-stages.js';

export function statusStrip(g, game, x, y, u) {
  const m = game.mission;
  const fires = game.fire.activeCells().length;
  const tl = Math.max(0, MISSION_TIME_LIMIT - m.elapsed);
  const cells = [
    ['FIRES', String(fires), fires > 0 ? C.fire : C.green],
    ['MISSION', `${Math.floor(tl / 60)}:${String(Math.floor(tl % 60)).padStart(2, '0')}`, tl < 120 ? C.red : C.white],
    ['SCORE', String(m.total() + Math.round(m.stagePoints || 0)).padStart(5, '0'), C.white],
  ];
  const cw = 80 * u, h = 52 * u;
  panel(g, x, y, cw * cells.length, h, u);
  cells.forEach(([label, value, color], i) => {
    const cx = x + cw * i + 11 * u;
    if (i) { g.fillStyle = C.edge; g.fillRect(x + cw * i, y + 8 * u, 1, 26 * u); }
    g.textAlign = 'left';
    g.fillStyle = C.greenDim;
    font(g, 700, 9 * u);
    g.fillText(label, cx, y + 11 * u);
    font(g, 700, 16 * u, 'mono');
    glow(g, value, cx, y + 27 * u, color, 5);
  });
  // Stage progress: five segments, the current one pulsing.
  const sx = x + 10 * u, sy = y + h - 11 * u, sw = cw * cells.length - 20 * u;
  const seg = sw / STAGES.length;
  for (let i = 0; i < STAGES.length; i++) {
    const done = i < m.index, cur = i === m.index;
    g.fillStyle = done ? C.green : cur ? `rgba(255,200,97,${0.55 + 0.45 * Math.sin(game.time * 4)})` : 'rgba(255,255,255,0.14)';
    g.fillRect(sx + i * seg + 1.5 * u, sy, seg - 3 * u, 4 * u);
  }
  return { bottom: y + h, right: x + cw * cells.length };
}

// Arc gauge for one engine: RPM sweep with the ITT value and a coloured state ring.
function engineArc(g, x, y, r, e, rpm, u, time) {
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
  g.save();
  g.lineCap = 'round';
  g.lineWidth = 4 * u;
  g.strokeStyle = 'rgba(255,255,255,0.12)';
  g.beginPath(); g.arc(x, y, r, a0, a1); g.stroke();
  const hot = e.itt > ITT_REDLINE;
  const col = e.fire ? C.red : e.failed ? '#777' : hot ? C.amber : C.green;
  g.strokeStyle = col;
  g.shadowColor = col; g.shadowBlur = 6;
  g.beginPath(); g.arc(x, y, r, a0, a0 + (a1 - a0) * Math.max(0.001, Math.min(1, rpm))); g.stroke();
  g.restore();
  g.textAlign = 'center';
  if (e.fire && Math.floor(time * 4) % 2) {
    g.fillStyle = 'rgba(255,60,40,0.35)';
    g.beginPath(); g.arc(x, y, r - 3 * u, 0, Math.PI * 2); g.fill();
  }
  font(g, 700, 11 * u, 'mono');
  glow(g, e.failed ? 'OFF' : `${Math.round(rpm * 100)}`, x, y - 2 * u, col, 4);
  font(g, 700, 7.5 * u);
  g.fillStyle = C.greenDim;
  g.fillText(`ENG ${e.id}`, x, y + 9 * u);
  font(g, 700, 8.5 * u, 'mono');
  g.fillStyle = hot || e.fire ? C.red : C.white;
  g.fillText(`${Math.round(e.itt)}°`, x, y + r + 6 * u);
}

// Bottom-right panel: two engine arcs, then fuel / water / airframe bars.
export function systemsPanel(g, game, x, y, w, u) {
  const s = game.flight, d = s.damage;
  const h = 128 * u;
  panel(g, x, y, w, h, u, { accent: d.engines.some((e) => e.fire) ? C.red : null });
  const r = 19 * u;
  engineArc(g, x + 30 * u, y + 30 * u, r, d.engines[0], s.engRpm[0], u, game.time);
  engineArc(g, x + 80 * u, y + 30 * u, r, d.engines[1], s.engRpm[1], u, game.time);
  // Right of the arcs: throttle and torque split.
  const tx = x + 112 * u, tw = w - 122 * u;
  labelValue(g, tx, y + 14 * u, tw, 'THROTTLE', `${Math.round(s.throttle * 100)}%`, u);
  bar(g, tx, y + 21 * u, tw, 4 * u, s.throttle, C.green, u);
  labelValue(g, tx, y + 36 * u, tw, 'ITT LIMIT', `${ITT_REDLINE}°`, u, C.greenDim);
  const hottest = Math.max(...d.engines.map((e) => (e.failed ? 0 : e.itt)));
  bar(g, tx, y + 43 * u, tw, 4 * u, hottest / 1000, hottest > ITT_REDLINE ? C.red : C.amber, u, ITT_REDLINE / 1000);
  // Bars
  const bx = x + 12 * u, bw = w - 24 * u;
  const fuel = s.fuel / s.fuelMax;
  const rows = [
    ['FUEL', `${Math.round(s.fuel)} KG${d.fuelLeak ? ' LEAK' : ''}`, fuel, fuel < 0.15 ? C.red : '#ffb347'],
    ['WATER', `${Math.round(s.water)} L`, s.water / s.waterMax, C.blue],
    ['AIRFRAME', `${Math.round(d.structure * 100)}%`, d.structure, d.structure < 0.4 ? C.red : d.structure < 0.8 ? C.amber : C.green],
  ];
  rows.forEach(([l, v, f, col], i) => {
    const ry = y + 66 * u + i * 21 * u;
    labelValue(g, bx, ry, bw, l, v, u, col);
    bar(g, bx, ry + 6 * u, bw, 4.5 * u, f, col, u);
  });
  return h;
}

// Rows of label/value under a tape.
export function readouts(g, x, y, rows, u) {
  const w = 108 * u, rh = 17 * u;
  panel(g, x - w / 2, y, w, rows.length * rh + 8 * u, u);
  rows.forEach(([label, value, color], i) => {
    const ry = y + 4 * u + rh * (i + 0.5);
    labelValue(g, x - w / 2 + 9 * u, ry, w - 18 * u, label, value, u, color || C.green);
  });
}

// G-meter: small arc from -1 to +4 g, needle, peak marker.
export function gMeter(g, x, y, r, gl, peak, u) {
  const a0 = Math.PI * 0.8, a1 = Math.PI * 2.2;
  const toA = (v) => a0 + ((Math.max(-1, Math.min(4, v)) + 1) / 5) * (a1 - a0);
  panel(g, x - r - 8 * u, y - r - 8 * u, r * 2 + 16 * u, r * 2 + 10 * u, u);
  g.save();
  g.lineWidth = 3 * u;
  g.strokeStyle = 'rgba(255,255,255,0.15)';
  g.beginPath(); g.arc(x, y, r, a0, a1); g.stroke();
  g.strokeStyle = C.red;
  g.beginPath(); g.arc(x, y, r, toA(3.2), a1); g.stroke();
  g.beginPath(); g.arc(x, y, r, a0, toA(-0.9)); g.stroke();
  g.strokeStyle = C.amber; g.lineWidth = 2;
  const pa = toA(peak);
  g.beginPath(); g.moveTo(x + Math.cos(pa) * (r - 5 * u), y + Math.sin(pa) * (r - 5 * u)); g.lineTo(x + Math.cos(pa) * (r + 2 * u), y + Math.sin(pa) * (r + 2 * u)); g.stroke();
  const a = toA(gl);
  const col = gl > 3.2 || gl < -0.9 ? C.red : C.green;
  g.strokeStyle = col; g.lineWidth = 2; g.shadowColor = col; g.shadowBlur = 5;
  g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * (r - 3 * u), y + Math.sin(a) * (r - 3 * u)); g.stroke();
  g.restore();
  g.textAlign = 'center';
  font(g, 700, 10 * u, 'mono');
  glow(g, `${gl.toFixed(1)}G`, x, y + r * 0.55, col, 4);
}
