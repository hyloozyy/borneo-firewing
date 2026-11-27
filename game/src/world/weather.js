// Weather: three real-looking presets chosen on the title screen (remembered) or with ?weather=.
//   CLEAR  the default: tropical late-afternoon sun, scattered cumulus, a thin smoke haze from the fires
//   HAZE   karhutla smoke haze: brown-orange sky, a dim red sun, thick haze layers, few clouds
//   STORM  tropical thunderstorm: a dark low cloud deck, rain streaks, wet glossy canopy and ground,
//          grey light, lightning flashes in the clouds with thunder, rain on the windscreen
// Sets the sky, sun, ambient light, haze, clouds, exposure and materials, rebuilds the reflection
// environment, and runs the rain and lightning.
import * as THREE from 'three';

const KEY = 'fw-weather';
export const WEATHERS = ['clear', 'haze', 'storm'];
export const WEATHER_LABELS = { clear: 'CLEAR', haze: 'SMOKE HAZE', storm: 'STORM' };

const PRESETS = {
  clear: { overcast: 0, haze: 0.12, smoke: 0.55, sunPower: 22, fog: 0xb08868, fogDensity: 0.00016, fogHeight: 420,
    sun: [0xffc896, 3.4], hemi: [0xffd2a8, 0x3a4a2a, 0.35], exposure: 1.05, cloudDark: 0, cloudCover: 'base', cloudSun: [2.3, 1.35, 0.75], rain: 0, wet: 0 },
  haze: { overcast: 0, haze: 0.78, smoke: 1, sunPower: 19, fog: 0x9c7050, fogDensity: 0.0006, fogHeight: 700,
    sun: [0xff9858, 2.0], hemi: [0xe0a070, 0x3a3226, 0.5], exposure: 1.12, cloudDark: 0.3, cloudCover: 0.35, cloudSun: [1.9, 0.95, 0.45], rain: 0, wet: 0 },
  storm: { overcast: 0.9, haze: 0, smoke: 0.25, sunPower: 22, fog: 0x5c656e, fogDensity: 0.00062, fogHeight: 650,
    sun: [0xc6d0dc, 0.85], hemi: [0xaab6c6, 0x2a3324, 0.95], exposure: 1.2, cloudDark: 0.72, cloudCover: 1, cloudSun: [1.2, 1.25, 1.35], rain: 1, wet: 1 },
};

export function pickWeather() {
  const q = new URLSearchParams(location.search).get('weather');
  if (WEATHERS.includes(q)) return q;
  try { const s = localStorage.getItem(KEY); if (WEATHERS.includes(s)) return s; } catch (e) { /* private mode */ }
  return 'clear';
}

export function saveWeather(kind) {
  try { localStorage.setItem(KEY, kind); } catch (e) { /* private mode */ }
}

// Rain: streaks in a box that follows the camera, animated on the GPU, slanted by the wind and
// stretched by the aircraft's speed.
function buildRain(count) {
  const pos = new Float32Array(count * 2 * 3), end = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = Math.random(), y = Math.random(), z = Math.random();
    for (let k = 0; k < 2; k++) { pos.set([x, y, z], (i * 2 + k) * 3); end[i * 2 + k] = k; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('tail', new THREE.BufferAttribute(end, 1));
  const uniforms = { time: { value: 0 }, origin: { value: new THREE.Vector3() }, fall: { value: new THREE.Vector3(0, -11, 0) }, size: { value: 90 }, amount: { value: 1 }, tint: { value: new THREE.Color(0.75, 0.8, 0.86) }, firePos: { value: new THREE.Vector3(0, -1e5, 0) }, fireGlow: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `
attribute float tail;
uniform float time;
uniform vec3 origin;
uniform vec3 fall;
uniform float size;
uniform vec3 firePos;
uniform float fireGlow;
varying float vA;
varying float vFire;
void main() {
  // Each drop falls through the box and wraps; the box is centred on the camera.
  vec3 p = position * size;
  p += fall * time * (0.85 + 0.3 * fract(position.x * 91.7));
  p = mod(p - origin + size * 0.5, size) - size * 0.5;
  vec3 w = origin + p - fall * 0.07 * tail;
  vec4 mv = viewMatrix * vec4(w, 1.0);
  vA = (1.0 - smoothstep(size * 0.2, size * 0.5, length(p))) * mix(1.0, 0.2, tail); // the streak fades toward its tail
  vFire = fireGlow / (1.0 + length(w - firePos) / 160.0); // drops near the fire catch its light
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `
uniform vec3 tint;
uniform float amount;
varying float vA;
varying float vFire;
void main() { gl_FragColor = vec4(tint + vec3(1.6, 0.6, 0.15) * vFire, vA * (0.55 + 0.3 * min(vFire, 1.0)) * amount); }`,
  });
  const lines = new THREE.LineSegments(g, mat);
  lines.frustumCulled = false;
  lines.renderOrder = 5;
  return { lines, uniforms };
}

export class Weather {
  constructor(game, kind = pickWeather()) {
    this.game = game;
    this.rain = buildRain(game.quality.phone ? 5000 : 14000);
    game.scene.add(this.rain.lines);
    this.flash = 0;
    this.nextStrike = 6;
    this.base = {
      leafRough: game.forest.materials.leaf.roughness, leafColor: game.forest.materials.leaf.color.clone(),
      barkColor: game.forest.materials.bark.color.clone(), terrainRough: game.terrain.material.roughness, terrainColor: game.terrain.material.color.clone(),
    };
    this.set(kind, { env: false });
  }

  set(kind, { env = true } = {}) {
    const g = this.game, p = PRESETS[kind] || PRESETS.clear;
    this.kind = kind;
    this.p = p;
    const u = g.sky.uniforms;
    u.overcast.value = p.overcast; u.haze.value = p.haze; u.smoke.value = p.smoke; u.sunPower.value = p.sunPower;
    g.scene.fog.color.setHex(p.fog);
    g.scene.fog.far = p.fogHeight;
    this.fogDensity = p.fogDensity;
    g.sky.sun.color.setHex(p.sun[0]); g.sky.sun.intensity = p.sun[1];
    g.sky.hemi.color.setHex(p.hemi[0]); g.sky.hemi.groundColor.setHex(p.hemi[1]); g.sky.hemi.intensity = p.hemi[2];
    this.sunIntensity = p.sun[1];
    this.hemiIntensity = p.hemi[2];
    g.renderer.toneMappingExposure = p.exposure;
    const c = g.clouds.uniforms;
    c.coverage.value = p.cloudCover === 'base' ? g.clouds.baseCoverage : p.cloudCover;
    c.darkness.value = p.cloudDark;
    c.sunColor.value.setRGB(...p.cloudSun);
    c.fogColor.value.setHex(p.fog).multiplyScalar(1.2);
    // Wet canopy and ground: darker, glossier.
    const m = g.forest.materials, b = this.base;
    m.leaf.roughness = b.leafRough * (1 - p.wet * 0.5);
    m.leaf.color.copy(b.leafColor).multiplyScalar(1 - p.wet * 0.18);
    m.bark.color.copy(b.barkColor).multiplyScalar(1 - p.wet * 0.35);
    g.terrain.material.roughness = b.terrainRough * (1 - p.wet * 0.42);
    g.terrain.material.color.copy(b.terrainColor).multiplyScalar(1 - p.wet * 0.22);
    // Rain-soaked runway: a glossy sheen that mirrors the sky and catches the lights.
    if (g.airstrip && g.airstrip.runway) { const m = g.airstrip.runway.material; m.roughness = p.wet ? 0.28 : 0.88; m.metalness = p.wet ? 0.15 : 0; m.envMapIntensity = p.wet ? 1.6 : 1; }
    if (g.fire) g.fire.steam = p.rain > 0; // rain on the fire raises steam
    this.rain.lines.visible = p.rain > 0;
    this.rain.uniforms.amount.value = p.rain;
    if (env && g.rebuildEnvironment) g.rebuildEnvironment();
  }

  update(dt, time) {
    const g = this.game, p = this.p, s = g.flight;
    s.rain = p.rain;
    if (p.rain > 0) {
      const r = this.rain.uniforms;
      r.time.value = time;
      r.origin.value.copy(g.camera.position);
      // Streaks fall at ~11 m/s, slanted by the wind and by the aircraft's motion through them.
      r.fall.value.set(g.wind.x * 1.5 - s.velocity.x * 0.35, -11, g.wind.z * 1.5 - s.velocity.z * 0.35);
      r.tint.value.setRGB(0.72, 0.77, 0.84).multiplyScalar(1 + this.flash * 2);
      const fire = g.fire && g.fire.nearLight;
      if (fire && fire.intensity > 0) { r.firePos.value.copy(fire.position); r.fireGlow.value = Math.min(1.5, fire.intensity / 2500); } else r.fireGlow.value = 0;
    }
    // Lightning: a double flicker inside the clouds, thunder a few seconds later.
    let f = 0;
    if (p.overcast > 0.5) {
      this.nextStrike -= dt;
      if (this.nextStrike <= 0) {
        this.strikeAt = time;
        this.nextStrike = 7 + Math.random() * 12;
        const delay = 0.8 + Math.random() * 3;
        setTimeout(() => g.audio.thunder?.(1.6 - delay * 0.25), delay * 1000);
      }
      if (this.strikeAt !== undefined) {
        const k = time - this.strikeAt;
        f = k < 0 ? 0 : Math.max(0, 1 - k * 7) + (k > 0.18 ? Math.max(0, 0.7 - (k - 0.18) * 5) : 0);
      }
    }
    this.flash = f;
    g.sky.uniforms.flash.value = f;
    g.clouds.uniforms.flash.value = f;
    g.sky.hemi.intensity = this.hemiIntensity + f * 2.2;
  }

  // Force a flash now (staged screenshots).
  strike(time) { this.strikeAt = time - 0.02; this.nextStrike = 9; }
}
