// The glareshield strip facing the crew: MASTER WARNING / MASTER CAUTION push-lights (flashing
// when anything is lit) on both sides and a mode panel with orange LED windows for IAS, HDG, ALT, VS.
import { lamp, digits, caption, hub, font } from './gauge-drawing.js';
import { activeLights } from '../flight/annunciators.js';

export const STRIP_W = 1760, STRIP_H = 88; // 800 px per metre: 2.2 m x 0.11 m

export class GlareshieldDisplay {
  constructor(scale) {
    this.scale = scale;
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(STRIP_W * scale);
    this.canvas.height = Math.round(STRIP_H * scale);
  }

  draw(game, time) {
    const g = this.canvas.getContext('2d');
    const s = game.flight;
    g.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    const bg = g.createLinearGradient(0, 0, 0, STRIP_H);
    bg.addColorStop(0, '#24272b'); bg.addColorStop(1, '#141618');
    g.fillStyle = bg;
    g.fillRect(0, 0, STRIP_W, STRIP_H);
    const lights = activeLights(s, game.plane.userData.parts);
    const warn = lights.some((l) => l.level === 'warning');
    const caut = lights.some((l) => l.level === 'caution');
    const blink = Math.floor(time * 3) % 2 === 0;
    // Captain's master lights sit straight ahead of the left seat; the first officer's on the right.
    for (const x0 of [380, 1420]) {
      lamp(g, x0, 14, 120, 60, 'MASTER WARN', '#ff3b2f', warn && blink);
      lamp(g, x0 + 130, 14, 120, 60, 'MASTER CAUT', '#ffb21f', caut);
    }
    // Mode panel in the middle
    g.fillStyle = '#0d0e10';
    g.beginPath(); g.roundRect(700, 8, 620, 72, 8); g.fill();
    const hdgBug = game.objective ? (Math.atan2(game.objective.pos.x - s.position.x, -(game.objective.pos.z - s.position.z)) * 57.3 + 360) % 360 : s.heading;
    const cells = [
      ['IAS', String(Math.round(s.airspeed * 1.944)).padStart(3, '0')],
      ['HDG', String(Math.round(hdgBug) % 360).padStart(3, '0')],
      ['ALT', String(Math.round((s.position.y * 3.281) / 10) * 10).padStart(5, '0')],
      ['VS', `${s.vs >= 0 ? '+' : '-'}${String(Math.abs(Math.round(s.vs * 1.9685)) * 100).padStart(4, '0')}`],
    ];
    cells.forEach(([label, value], i) => {
      const x = 716 + i * 152;
      caption(g, label, x + 60, 20, 12, 'rgba(255,244,222,0.6)');
      g.fillStyle = '#000'; g.fillRect(x, 32, 120, 36);
      digits(g, value, x + 60, 51, 24, '#ff9a1a');
      hub(g, x + 136, 50, 10);
    });
    font(g, 700, 11);
    g.fillStyle = 'rgba(255,244,222,0.35)'; g.textAlign = 'left';
    g.fillText('FW-218 · MODE CONTROL', 20, 46);
  }
}
