// The main instrument panel, drawn on a canvas in three layers: a cached static layer (panel plate,
// bezels, scales, placards), the live layer (needles that jitter with engine vibration, attitude
// ball, HSI card, moving map, annunciators, radios, digits) and a cached glass layer on top.
// Layout in panel pixels (800 px per metre, panel 2.7 m x 0.62 m).
import { bezel, dialScale, caption, needle, glassGlare, digits, lamp, toggle, font, hub, INK, INK_DIM } from './gauge-drawing.js';
import { drawMovingMap } from './moving-map.js';
import { LIGHTS, LEVEL_COLOR } from '../flight/annunciators.js';
import { ITT_REDLINE } from '../flight/damage-model.js';

export const PANEL_W = 2160, PANEL_H = 496;
const TAU = Math.PI * 2;
const KT = 1.944, FT = 3.281;

const G = {
  asi: [472, 104, 70], att: [640, 104, 76], alt: [808, 104, 70],
  turn: [472, 272, 70], hsi: [640, 272, 76], vsi: [808, 272, 70],
  fuel: [216, 140, 56], water: [216, 296, 56], clock: [150, 428, 40], gm: [290, 428, 40],
  trq: [1440, 104, 70], itt: [1616, 104, 70], np: [1440, 272, 70], ff: [1616, 272, 70],
  hyd: [1820, 430, 42], oil: [2040, 430, 42],
};
const MFD = [920, 24, 416, 212];
const ANN = [920, 300, 104, 44];

const SCALES = {
  asi: { a0: 0.25, a1: TAU - 0.25, min: 0, max: 220, major: 20, minor: 10, label: (v) => (v ? String(v) : null), arcs: [{ from: 50, to: 110, color: '#e8e8e8' }, { from: 70, to: 180, color: '#2fbf4a' }, { from: 180, to: 200, color: '#e8c020' }, { from: 199, to: 202, color: '#e02020' }] },
  alt: { a0: 0, a1: TAU, min: 0, max: 1000, major: 100, minor: 20, label: (v) => (v < 1000 ? String(v / 100) : null) },
  vsi: { a0: -Math.PI / 2 - 0.9 * Math.PI, a1: -Math.PI / 2 + 0.9 * Math.PI, min: -2000, max: 2000, major: 500, minor: 100, label: (v) => (v % 1000 === 0 ? String(Math.abs(v / 1000)) : null) },
  fuel: { a0: -0.75 * Math.PI, a1: 0.75 * Math.PI, min: 0, max: 32, major: 8, minor: 2, label: (v) => String(v / 2), arcs: [{ from: 0, to: 4.8, color: '#e02020' }] },
  water: { a0: -0.75 * Math.PI, a1: 0.75 * Math.PI, min: 0, max: 6, major: 1, minor: 0.5, label: (v) => String(v), arcs: [{ from: 4.8, to: 6, color: '#2f8fff' }] },
  gm: { a0: -0.8 * Math.PI, a1: 0.8 * Math.PI, min: -2, max: 5, major: 1, minor: 0.5, label: (v) => String(v), arcs: [{ from: 3.2, to: 5, color: '#e02020' }, { from: -2, to: -1, color: '#e02020' }] },
  clock: { a0: 0, a1: TAU, min: 0, max: 60, major: 5, minor: 1, label: (v) => (v < 60 ? String(v / 5 || 12) : null) },
  trq: { a0: -0.75 * Math.PI, a1: 0.75 * Math.PI, min: 0, max: 120, major: 20, minor: 10, label: (v) => String(v), arcs: [{ from: 0, to: 100, color: '#2fbf4a' }, { from: 100, to: 120, color: '#e02020' }] },
  itt: { a0: -0.75 * Math.PI, a1: 0.75 * Math.PI, min: 0, max: 1000, major: 200, minor: 50, label: (v) => String(v / 100), arcs: [{ from: 400, to: 760, color: '#2fbf4a' }, { from: 760, to: ITT_REDLINE, color: '#e8c020' }, { from: ITT_REDLINE, to: 1000, color: '#e02020' }] },
  np: { a0: -0.75 * Math.PI, a1: 0.75 * Math.PI, min: 0, max: 110, major: 20, minor: 10, label: (v) => (v <= 100 ? String(v) : null), arcs: [{ from: 70, to: 100, color: '#2fbf4a' }, { from: 100, to: 110, color: '#e02020' }] },
  ff: { a0: -0.75 * Math.PI, a1: 0.75 * Math.PI, min: 0, max: 400, major: 100, minor: 25, label: (v) => String(v / 100) },
  hyd: { a0: -0.75 * Math.PI, a1: 0.75 * Math.PI, min: 0, max: 4, major: 1, minor: 0.5, label: (v) => String(v), arcs: [{ from: 2.6, to: 3.2, color: '#2fbf4a' }] },
  oil: { a0: -0.75 * Math.PI, a1: 0.75 * Math.PI, min: 0, max: 150, major: 50, minor: 25, label: (v) => String(v), arcs: [{ from: 60, to: 110, color: '#2fbf4a' }, { from: 130, to: 150, color: '#e02020' }] },
};
const CAPTIONS = {
  asi: ['AIRSPEED', 'KNOTS'], alt: ['ALT', '×100 FT'], vsi: ['VERT SPEED', '×1000 FPM'], fuel: ['FUEL', '×1000 KG'], water: ['WATER', '×1000 L'],
  gm: ['G', ''], clock: ['', ''], trq: ['TORQUE', '%'], itt: ['ITT', '×100 °C'], np: ['PROP', '% RPM'], ff: ['FUEL FLOW', '×100 KG/H'],
  hyd: ['HYD', '×1000 PSI'], oil: ['OIL', '°C'],
};

function toAngle(sc, v) {
  return sc.a0 + ((Math.max(sc.min, Math.min(sc.max, v)) - sc.min) / (sc.max - sc.min)) * (sc.a1 - sc.a0);
}

export class InstrumentPanel {
  constructor(scale) {
    this.scale = scale;
    const mk = () => { const c = document.createElement('canvas'); c.width = Math.round(PANEL_W * scale); c.height = Math.round(PANEL_H * scale); return c; };
    this.canvas = mk();
    this.base = mk();
    this.over = mk();
    this.mfd = {};
    this.drawBase(this.base.getContext('2d'));
    this.drawGlass(this.over.getContext('2d'));
  }

  drawBase(g) {
    g.scale(this.scale, this.scale);
    // Panel plate: dark grey crinkle paint, lighter sub-panels with engraved group names.
    const bg = g.createLinearGradient(0, 0, 0, PANEL_H);
    bg.addColorStop(0, '#1d2024'); bg.addColorStop(1, '#2a2e33');
    g.fillStyle = bg;
    g.fillRect(0, 0, PANEL_W, PANEL_H);
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.05)';
      g.fillRect(Math.random() * PANEL_W, Math.random() * PANEL_H, 2, 2);
    }
    const sub = (x, y, w, h, name) => {
      g.fillStyle = 'rgba(255,255,255,0.035)';
      g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 3;
      g.beginPath(); g.roundRect(x, y, w, h, 10); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 1;
      g.beginPath(); g.roundRect(x + 2, y + 2, w - 4, h - 4, 9); g.stroke();
      for (const [sx, sy] of [[x + 10, y + 10], [x + w - 10, y + 10], [x + 10, y + h - 10], [x + w - 10, y + h - 10]]) hub(g, sx, sy, 4);
      if (name) caption(g, name, x + w / 2, y + h - 12, 11, 'rgba(255,244,222,0.35)');
    };
    sub(110, 6, 220, 484, 'QUANTITY');
    sub(378, 6, 524, 484, 'FLIGHT');
    sub(906, 6, 444, 484, 'DISPLAY · WARNING');
    sub(1356, 6, 344, 484, 'ENGINES 1 · 2');
    sub(1706, 6, 448, 484, 'RADIO · SYSTEMS');
    // Round instruments (static parts)
    for (const [k, sc] of Object.entries(SCALES)) {
      const [x, y, r] = G[k];
      bezel(g, x, y, r, { square: k !== 'clock' && k !== 'gm' && k !== 'hyd' && k !== 'oil' });
      dialScale(g, x, y, r, sc);
      const [c1, c2] = CAPTIONS[k];
      if (c1) caption(g, c1, x, y + r * 0.32, r * 0.15, INK);
      if (c2) caption(g, c2, x, y + r * 0.5, r * 0.12);
    }
    for (const k of ['att', 'hsi', 'turn']) { const [x, y, r] = G[k]; bezel(g, x, y, r, { square: true }); }
    // Turn coordinator markings
    {
      const [x, y, r] = G.turn;
      g.strokeStyle = INK; g.lineWidth = 3;
      for (const a of [-1.85, -1.57, 1.57, 1.85]) { g.beginPath(); g.moveTo(x + Math.sin(a) * r * 0.78, y - Math.cos(a) * r * 0.78); g.lineTo(x + Math.sin(a) * r * 0.95, y - Math.cos(a) * r * 0.95); g.stroke(); }
      caption(g, 'L', x - r * 0.72, y + r * 0.42, r * 0.17, INK);
      caption(g, 'R', x + r * 0.72, y + r * 0.42, r * 0.17, INK);
      caption(g, 'TURN COORDINATOR', x, y - r * 0.55, r * 0.11);
      caption(g, '2 MIN', x, y + r * 0.78, r * 0.11);
      g.fillStyle = '#c8c0a8';
      g.beginPath(); g.roundRect(x - r * 0.45, y + r * 0.42, r * 0.9, r * 0.18, r * 0.09); g.fill();
    }
    // Switch row under the flight instruments and its placard
    caption(g, 'ELECTRICAL · LIGHTS', 640, 372, 11, 'rgba(255,244,222,0.4)');
    // Placards
    font(g, 700, 12);
    g.fillStyle = 'rgba(255,244,222,0.45)'; g.textAlign = 'left';
    g.fillText('FW-218 ENGGANG · PK-FWE', 120, 22);
    g.fillStyle = 'rgba(255,190,90,0.6)';
    g.fillText('SCOOP 60-115 KT · DOORS CLOSED ABOVE 140 KT', 1366, 476);
    // Annunciator panel frame
    g.fillStyle = '#070809';
    g.fillRect(ANN[0] - 8, ANN[1] - 8, ANN[2] * 4 + 8, ANN[3] * 4 + 8);
    // Radio heads (static frames)
    ['COM 1', 'COM 2', 'NAV 1', 'XPDR'].forEach((n, i) => {
      const y = 24 + i * 80;
      g.fillStyle = '#141618'; g.beginPath(); g.roundRect(1720, y, 420, 66, 8); g.fill();
      g.fillStyle = '#030404'; g.fillRect(1800, y + 10, 270, 46);
      caption(g, n, 1760, y + 33, 14, INK);
      for (const kx of [2104]) { hub(g, kx, y + 33, 18); hub(g, kx, y + 33, 11); }
    });
  }

  drawGlass(g) {
    g.scale(this.scale, this.scale);
    for (const [, [x, y, r]] of Object.entries(G)) glassGlare(g, x, y, r);
    // Attitude indicator fixed parts: bank scale and the orange aircraft symbol.
    {
      const [x, y, r] = G.att;
      g.strokeStyle = INK; g.lineWidth = 3;
      for (const d of [-60, -45, -30, -20, -10, 10, 20, 30, 45, 60]) {
        const a = (d * Math.PI) / 180;
        const l = Math.abs(d) % 30 === 0 ? 0.8 : 0.86;
        g.beginPath(); g.moveTo(x + Math.sin(a) * r * l, y - Math.cos(a) * r * l); g.lineTo(x + Math.sin(a) * r * 0.97, y - Math.cos(a) * r * 0.97); g.stroke();
      }
      g.fillStyle = INK;
      g.beginPath(); g.moveTo(x, y - r * 0.8); g.lineTo(x - 7, y - r * 0.95); g.lineTo(x + 7, y - r * 0.95); g.fill();
      g.strokeStyle = '#ff9a1a'; g.lineWidth = 6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x - r * 0.55, y); g.lineTo(x - r * 0.18, y); g.lineTo(x, y + r * 0.12); g.lineTo(x + r * 0.18, y); g.lineTo(x + r * 0.55, y); g.stroke();
      g.fillStyle = '#ff9a1a'; g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill();
      glassGlare(g, x, y, r);
    }
    // HSI lubber line and aircraft
    {
      const [x, y, r] = G.hsi;
      g.fillStyle = '#ff9a1a';
      g.beginPath(); g.moveTo(x, y - r * 0.98); g.lineTo(x - 7, y - r * 1.1); g.lineTo(x + 7, y - r * 1.1); g.fill();
      g.strokeStyle = INK; g.lineWidth = 4;
      g.beginPath(); g.moveTo(x, y - r * 0.22); g.lineTo(x, y + r * 0.22); g.moveTo(x - r * 0.2, y - r * 0.02); g.lineTo(x + r * 0.2, y - r * 0.02); g.moveTo(x - r * 0.08, y + r * 0.2); g.lineTo(x + r * 0.08, y + r * 0.2); g.stroke();
    }
    // Warm pools of light from the glareshield flood lamps.
    g.globalCompositeOperation = 'lighter';
    for (const x of [260, 640, 1130, 1530, 1930]) {
      const f = g.createRadialGradient(x, -30, 10, x, -30, 420);
      f.addColorStop(0, 'rgba(255,170,90,0.16)');
      f.addColorStop(1, 'rgba(255,170,90,0)');
      g.fillStyle = f;
      g.fillRect(x - 420, 0, 840, PANEL_H);
    }
    g.globalCompositeOperation = 'source-over';
    // Soft vignette toward the panel edges
    const v = g.createRadialGradient(PANEL_W * 0.32, PANEL_H * 0.4, PANEL_W * 0.15, PANEL_W * 0.4, PANEL_H * 0.5, PANEL_W * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = v;
    g.fillRect(0, 0, PANEL_W, PANEL_H);
  }

  // Redraw the live layer. Vibration: every needle jitters with engine RPM and turbulence.
  draw(game, time) {
    const g = this.canvas.getContext('2d');
    const s = game.flight, d = s.damage;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(this.base, 0, 0);
    g.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    const vib = 0.004 * (0.3 + s.rpm) + s.turbulence * 0.02;
    const jit = (i) => (Math.sin(time * 41 + i * 7.3) + Math.sin(time * 67 + i * 3.1)) * vib;
    const dial = (k, v, i, opts) => { const [x, y, r] = G[k]; needle(g, x, y, r, toAngle(SCALES[k], v) + jit(i), opts); };

    const kt = s.airspeed * KT, ft = Math.max(0, s.position.y * FT), fpm = s.vs * 196.85;
    dial('asi', kt, 1);
    // Altimeter: drum window plus thousands and hundreds needles.
    {
      const [x, y, r] = G.alt;
      g.fillStyle = '#000'; g.fillRect(x - r * 0.42, y - r * 0.52, r * 0.84, r * 0.26);
      digits(g, String(Math.round(ft / 10) * 10).padStart(5, '0'), x, y - r * 0.39, r * 0.2, '#fff4de');
      needle(g, x, y, r, ((ft / 10000) * TAU) + jit(2), { width: 0.11, len: 0.55 });
      needle(g, x, y, r, (((ft % 1000) / 1000) * TAU) + jit(3));
    }
    dial('vsi', fpm, 4);
    this.attitude(g, s, jit(5));
    this.turnCoordinator(g, s, jit(6));
    this.hsi(g, game, s, jit(7));
    dial('fuel', s.fuel / 100, 8, { color: s.fuel / s.fuelMax < 0.15 ? '#ff5040' : INK });
    dial('water', s.water / 1000, 9, { color: '#9ad6ff' });
    {
      const t = 17 * 3600 + 42 * 60 + game.mission.elapsed;
      const [x, y, r] = G.clock;
      needle(g, x, y, r, (((t / 3600) % 12) / 12) * TAU, { width: 0.1, len: 0.55 });
      needle(g, x, y, r, (((t / 60) % 60) / 60) * TAU);
      needle(g, x, y, r, ((t % 60) / 60) * TAU, { color: '#ff7a3d', width: 0.03 });
    }
    dial('gm', s.gLoad, 10, { color: s.gLoad > 3.2 ? '#ff5040' : INK });
    // Engines: two needles each, labelled 1 and 2.
    const eng = d.engines;
    const twin = (k, v1, v2, i) => {
      const [x, y, r] = G[k];
      const sc = SCALES[k];
      needle(g, x, y, r, toAngle(sc, v1) + jit(i), { color: '#fff4de', len: 0.86 });
      needle(g, x, y, r, toAngle(sc, v2) + jit(i + 1), { color: '#ffd23c', len: 0.74 });
      font(g, 700, r * 0.14, 'mono');
      g.fillStyle = '#fff4de'; g.fillText('1', x - r * 0.2, y + r * 0.72);
      g.fillStyle = '#ffd23c'; g.fillText('2', x + r * 0.2, y + r * 0.72);
    };
    const trq = (i) => (eng[i].failed ? 0 : s.engRpm[i] * s.throttle * 108 * Math.max(0.3, eng[i].health));
    twin('trq', trq(0), trq(1), 11);
    twin('itt', eng[0].itt, eng[1].itt, 13);
    twin('np', s.engRpm[0] * 100, s.engRpm[1] * 100, 15);
    const ff = (i) => (eng[i].failed || s.fuel <= 0 ? 0 : 90 + s.throttle * 280 * s.engRpm[i]);
    twin('ff', ff(0), ff(1), 17);
    dial('hyd', 3 * Math.min(1, s.rpm * 2), 19);
    dial('oil', 40 + s.rpm * 50 + (eng[0].itt > ITT_REDLINE || eng[1].itt > ITT_REDLINE ? 30 : 0), 20);
    // Moving map
    drawMovingMap(g, game, this.mfd, MFD[0], MFD[1], MFD[2], MFD[3], time);
    // Annunciators: warnings flash, cautions steady.
    const parts = game.plane.userData.parts;
    LIGHTS.forEach((l, i) => {
      const on = l.on(s, parts);
      const lit = on && (l.level !== 'warning' || Math.floor(time * 3) % 2 === 0);
      lamp(g, ANN[0] + (i % 4) * ANN[2], ANN[1] + Math.floor(i / 4) * ANN[3], ANN[2] - 8, ANN[3] - 8, l.text, LEVEL_COLOR[l.level], lit);
    });
    // Switch row
    const gearDown = parts.gearExt > 0.9;
    [['BATT', true], ['GEN 1', !eng[0].failed], ['GEN 2', !eng[1].failed], ['PUMPS', s.fuel > 0], ['NAV LT', true], ['LDG LT', gearDown]].forEach(([n, on], i) => toggle(g, 430 + i * 84, 420, n, on, 1));
    // Flap indicator and gear lights under the engine gauges
    {
      const x = 1400, y = 372;
      caption(g, 'FLAPS', x, y, 12, INK_DIM);
      g.fillStyle = '#060708'; g.fillRect(x - 12, y + 12, 24, 80);
      ['UP', '1', 'FULL'].forEach((t, i) => caption(g, t, x + 36, y + 18 + i * 34, 11, INK_DIM));
      g.fillStyle = '#ffd23c';
      g.fillRect(x - 10, y + 14 + s.flaps * 68, 20, 8);
      caption(g, 'GEAR', 1540, y, 12, INK_DIM);
      for (let i = 0; i < 3; i++) lamp(g, 1500 + i * 30, y + 16, 24, 24, '', gearDown ? '#4dff88' : '#ff3b2f', gearDown || (parts.gearExt > 0.05 && parts.gearExt < 0.95));
      caption(g, 'DOORS', 1640, y, 12, INK_DIM);
      lamp(g, 1606, y + 16, 70, 24, 'OPEN', '#ffb21f', s.doors > 0.1);
      caption(g, 'SCOOP', 1540, y + 62, 12, INK_DIM);
      lamp(g, 1500, y + 74, 84, 24, 'PROBES', '#3fb6ff', s.scooping);
      lamp(g, 1606, y + 74, 70, 24, 'BTL', '#ff3b2f', eng.some((e) => e.fire && e.bottle));
    }
    // Radio stack
    const xpdr = eng.some((e) => e.fire) || d.structure < 0.4 ? '7700' : '1200';
    [['123.450', '121.500'], ['118.700', '132.025'], ['110.30', '114.10'], [xpdr, 'ALT']].forEach(([a, b], i) => {
      const y = 24 + i * 80 + 33;
      digits(g, a, 1880, y, 26, i === 3 && xpdr === '7700' ? '#ff5040' : '#7dff9a');
      digits(g, b, 2010, y, 20, '#3fd06a');
    });
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(this.over, 0, 0);
  }

  attitude(g, s, jit) {
    const [x, y, r] = G.att;
    g.save();
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip();
    g.translate(x, y);
    g.rotate(-s.roll + jit);
    const ppd = r / 28;
    const off = s.pitch * 57.3 * ppd;
    const sky = g.createLinearGradient(0, -r * 1.6 + off, 0, off);
    sky.addColorStop(0, '#0b4f9a'); sky.addColorStop(1, '#3d9be6');
    g.fillStyle = sky; g.fillRect(-r * 1.6, -r * 2.6 + off, r * 3.2, r * 2.6);
    const gr = g.createLinearGradient(0, off, 0, off + r * 1.6);
    gr.addColorStop(0, '#8a5a2b'); gr.addColorStop(1, '#4a2c12');
    g.fillStyle = gr; g.fillRect(-r * 1.6, off, r * 3.2, r * 2.6);
    g.strokeStyle = '#fff'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-r * 1.6, off); g.lineTo(r * 1.6, off); g.stroke();
    g.lineWidth = 2;
    font(g, 700, r * 0.13, 'mono');
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let dd = -30; dd <= 30; dd += 5) {
      if (!dd) continue;
      const yy = off - dd * ppd;
      const w = dd % 10 === 0 ? r * 0.35 : r * 0.16;
      g.beginPath(); g.moveTo(-w, yy); g.lineTo(w, yy); g.stroke();
      if (dd % 10 === 0) { g.fillText(String(Math.abs(dd)), -w - r * 0.13, yy); g.fillText(String(Math.abs(dd)), w + r * 0.13, yy); }
    }
    // Roll pointer moves with the card
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(0, -r * 0.78); g.lineTo(-8, -r * 0.66); g.lineTo(8, -r * 0.66); g.fill();
    g.restore();
  }

  turnCoordinator(g, s, jit) {
    const [x, y, r] = G.turn;
    g.save();
    g.translate(x, y);
    g.rotate(Math.max(-0.5, Math.min(0.5, -s.angular.y * 2.2)) + jit);
    g.fillStyle = INK; g.strokeStyle = INK; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-r * 0.78, 0); g.lineTo(r * 0.78, 0); g.stroke();
    g.beginPath(); g.arc(0, 0, r * 0.12, 0, TAU); g.fill();
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(0, -r * 0.12); g.lineTo(0, -r * 0.3); g.moveTo(-r * 0.18, r * 0.2); g.lineTo(r * 0.18, r * 0.2); g.stroke();
    g.restore();
    // Inclinometer ball
    const slip = Math.max(-1, Math.min(1, s.angular.y * 4 - s.roll * 0.1));
    const bg = g.createRadialGradient(x + slip * r * 0.35 - 3, y + r * 0.5, 1, x + slip * r * 0.35, y + r * 0.51, r * 0.08);
    bg.addColorStop(0, '#666'); bg.addColorStop(1, '#050505');
    g.fillStyle = bg;
    g.beginPath(); g.arc(x + slip * r * 0.35, y + r * 0.51, r * 0.075, 0, TAU); g.fill();
  }

  hsi(g, game, s, jit) {
    const [x, y, r] = G.hsi;
    g.save();
    g.translate(x, y);
    g.rotate((-s.heading * Math.PI) / 180 + jit);
    g.strokeStyle = INK; g.fillStyle = INK;
    font(g, 700, r * 0.17);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let dd = 0; dd < 360; dd += 5) {
      const a = (dd * Math.PI) / 180;
      const l = dd % 30 === 0 ? 0.8 : dd % 10 === 0 ? 0.86 : 0.9;
      g.lineWidth = dd % 10 === 0 ? 3 : 1.5;
      g.beginPath(); g.moveTo(Math.sin(a) * r * l, -Math.cos(a) * r * l); g.lineTo(Math.sin(a) * r * 0.97, -Math.cos(a) * r * 0.97); g.stroke();
      if (dd % 30 === 0) {
        g.save(); g.rotate(a);
        g.fillText({ 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[dd] ?? String(dd / 10), 0, -r * 0.64);
        g.restore();
      }
    }
    // Bearing pointer to the objective (magenta)
    if (game.objective) {
      const b = Math.atan2(game.objective.pos.x - s.position.x, -(game.objective.pos.z - s.position.z));
      g.rotate(b);
      g.strokeStyle = '#ff5cf0'; g.fillStyle = '#ff5cf0'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(0, r * 0.75); g.lineTo(0, -r * 0.6); g.stroke();
      g.beginPath(); g.moveTo(0, -r * 0.78); g.lineTo(-9, -r * 0.58); g.lineTo(9, -r * 0.58); g.fill();
    }
    g.restore();
    digits(g, String(Math.round(s.heading) % 360).padStart(3, '0'), x, y + r * 0.45, r * 0.16, '#ff9a1a');
  }
}
