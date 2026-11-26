// The annunciator list shared by the cockpit warning panel and the HUD alert stack:
// red warnings, amber cautions, green/blue advisories, each lit from the flight and damage state.
import { ITT_REDLINE } from './damage-model.js';

export const LIGHTS = [
  { id: 'fire1', text: 'ENG 1 FIRE', level: 'warning', on: (s) => s.damage.engines[0].fire },
  { id: 'fire2', text: 'ENG 2 FIRE', level: 'warning', on: (s) => s.damage.engines[1].fire },
  { id: 'stall', text: 'STALL', level: 'warning', on: (s) => s.stall },
  { id: 'struct', text: 'STRUCTURE', level: 'warning', on: (s) => s.damage.structure < 0.4 },
  { id: 'hot1', text: 'ENG 1 ITT', level: 'caution', on: (s) => s.damage.engines[0].itt > ITT_REDLINE && !s.damage.engines[0].failed },
  { id: 'hot2', text: 'ENG 2 ITT', level: 'caution', on: (s) => s.damage.engines[1].itt > ITT_REDLINE && !s.damage.engines[1].failed },
  { id: 'out1', text: 'ENG 1 OUT', level: 'caution', on: (s) => s.damage.engines[0].failed },
  { id: 'out2', text: 'ENG 2 OUT', level: 'caution', on: (s) => s.damage.engines[1].failed },
  { id: 'fuel', text: 'LOW FUEL', level: 'caution', on: (s) => s.fuel / s.fuelMax < 0.15 },
  { id: 'leak', text: 'FUEL LEAK', level: 'caution', on: (s) => s.damage.fuelLeak > 0 },
  { id: 'overg', text: 'OVER G', level: 'caution', on: (s) => s.gLoad > 3.2 || s.gLoad < -1 },
  { id: 'wshld', text: 'WSHLD', level: 'caution', on: (s) => s.damage.windscreen > 0.05 },
  { id: 'smoke', text: 'SMOKE', level: 'caution', on: (s) => s.turbulence > 0.25 },
  { id: 'gear', text: 'GEAR DN', level: 'advisory', on: (s, p) => !!p && p.gearExt > 0.95 },
  { id: 'doors', text: 'DOORS', level: 'advisory', on: (s) => s.doors > 0.1 },
  { id: 'scoop', text: 'SCOOP', level: 'info', on: (s) => s.scooping },
];

export const LEVEL_COLOR = { warning: '#ff3b2f', caution: '#ffb21f', advisory: '#4dff88', info: '#3fb6ff' };

// Active lights for this frame. `parts` is the aircraft model's parts (gear position).
export function activeLights(s, parts) {
  return LIGHTS.filter((l) => l.on(s, parts));
}
