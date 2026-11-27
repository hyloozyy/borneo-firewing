// Graphics settings. Four modes the player can pick (title screen and pause menu, remembered in
// localStorage) plus a render-scale slider:
//   PERFORMANCE  light scene, ~1.25x resolution        BALANCED  light scene, ~1.6x resolution
//   SHARP        light scene on phones / full on PC, full-resolution 2x (default on phones)
//   ULTRA        full scene, shadows, reflections, 2x resolution (default on computers)
// Speed is won back from scene cost (trees, particles, shadows, reflections), never by rendering
// below the screen's own resolution, so the picture stays crisp. ?quality=low|high still works.
const KEY = 'fw-gfx';
export const MODES = ['performance', 'balanced', 'sharp', 'ultra'];
const RATIO = { performance: 1.25, balanced: 1.6, sharp: 2, ultra: 2 };

export function isPhone() {
  return matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
}

export function loadSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { s = {}; }
  const mode = MODES.includes(s.mode) ? s.mode : isPhone() ? 'sharp' : 'ultra';
  const scale = Math.max(0.6, Math.min(1, Number(s.scale) || 1));
  return { mode, scale };
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode */ }
}

// Device pixels per CSS pixel for a mode and render scale (never below 1 unless the player asks).
export function ratioFor(mode, scale) {
  return Math.max(0.6, Math.min(devicePixelRatio || 1, RATIO[mode]) * scale);
}

export function pickQuality() {
  const params = new URLSearchParams(location.search);
  const q = params.get('quality');
  const phone = isPhone();
  const shot = params.has('shot');
  const set = shot ? { mode: 'ultra', scale: 1 } : loadSettings();
  if (q === 'low') set.mode = 'balanced';
  if (q === 'high') set.mode = 'ultra';
  const full = set.mode === 'ultra' || (set.mode === 'sharp' && !phone);
  const out = full
    ? { name: 'high', phone, treeSpacing: 16, shrubChance: 0.3, hiTreeRadius: 230, loTreeRadius: 600, shrubRadius: 170, impostorCell: 256, treeShadows: true, msaa: phone ? 0 : 4, grass: 40000, reflections: true, groundTexture: 512, shadowSize: phone ? 2048 : 4096, shadowBox: 170, terrainSegments: 360, flameParticles: 4500, smokeParticles: 2200, waterParticles: 3000, shadows: true, clouds: 30, birds: 5, texDetail: 1 }
    : { name: 'low', phone, // phones: no MSAA (FXAA instead), no shadows or reflections, fewer trees, particles and clouds
      treeSpacing: 26, shrubChance: 0.2, hiTreeRadius: 150, loTreeRadius: 520, shrubRadius: 110, impostorCell: 128, treeShadows: false, msaa: 0, grass: 12000, reflections: false, groundTexture: 256, shadowSize: 1024, shadowBox: 90, terrainSegments: 140, flameParticles: 1500, smokeParticles: 800, waterParticles: 1000, shadows: false, clouds: 14, birds: 3, texDetail: set.mode === 'performance' ? 0.5 : 1 };
  out.mode = set.mode;
  out.scale = set.scale;
  out.baseRatio = ratioFor(set.mode, 1);
  out.pixelRatio = ratioFor(set.mode, set.scale);
  const pr = Number(params.get('pr')); // ?pr=0.5 render-scale override (testing)
  if (pr > 0) out.pixelRatio = pr;
  return out;
}
