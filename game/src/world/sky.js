// Physically based golden-hour sky: single-scattering atmosphere (Rayleigh + Mie) ray-marched per
// pixel, a limb-darkened sun disc, high cirrus streaks and a smoky haze band toward the fire.
// Also owns the sun (with a camera-following shadow box) and the soft sky fill light.
import * as THREE from 'three';

export const SUN_DIR = new THREE.Vector3(-0.62, 0.2, 0.76).normalize();

const vert = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const frag = `
uniform vec3 sunDir;
uniform float sunPower;
uniform float smoke;
uniform vec3 smokeDir;
uniform float time;
uniform float overcast; // storm deck: grey sky, no sun disc
uniform float haze;     // karhutla smoke haze: brown-orange sky, dim red sun
uniform float flash;    // lightning
varying vec3 vDir;

const float RE = 6360.0;   // km
const float RA = 6420.0;
const float HR = 8.0;
const float HM = 1.2;
const vec3 BR = vec3(5.8e-3, 13.5e-3, 33.1e-3);
const vec3 BM = vec3(4.0e-3);

float rayExit(vec3 o, vec3 d) {
  float b = dot(o, d);
  float c = dot(o, o) - RA * RA;
  return -b + sqrt(max(b * b - c, 0.0));
}

// Optical depth toward the sun from a point (4-step march).
vec2 sunDepth(vec3 p) {
  float L = rayExit(p, sunDir);
  float st = L / 4.0;
  vec2 od = vec2(0.0);
  for (int i = 0; i < 4; i++) {
    vec3 q = p + sunDir * (float(i) + 0.5) * st;
    float h = length(q) - RE;
    if (h < 0.0) return vec2(1e4);
    od += vec2(exp(-h / HR), exp(-h / HM)) * st;
  }
  return od;
}

vec3 atmosphere(vec3 d) {
  vec3 o = vec3(0.0, RE + 0.4, 0.0);
  float L = rayExit(o, d);
  float st = L / 10.0;
  vec2 odView = vec2(0.0);
  vec3 sumR = vec3(0.0), sumM = vec3(0.0);
  for (int i = 0; i < 10; i++) {
    vec3 p = o + d * (float(i) + 0.5) * st;
    float h = max(length(p) - RE, 0.0);
    vec2 dens = vec2(exp(-h / HR), exp(-h / HM)) * st;
    odView += dens;
    vec2 odSun = sunDepth(p);
    vec3 tau = BR * (odView.x + odSun.x) + BM * 1.1 * (odView.y + odSun.y);
    vec3 att = exp(-tau);
    sumR += dens.x * att;
    sumM += dens.y * att;
  }
  float mu = dot(d, sunDir);
  float pr = 3.0 / (16.0 * 3.14159) * (1.0 + mu * mu);
  float g = 0.78;
  float pm = 3.0 / (8.0 * 3.14159) * ((1.0 - g * g) * (1.0 + mu * mu)) / ((2.0 + g * g) * pow(1.0 + g * g - 2.0 * g * mu, 1.5));
  return sunPower * (sumR * BR * pr + sumM * BM * pm);
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + 1.7; a *= 0.5; }
  return s;
}

void main() {
  vec3 d = normalize(vDir);
  vec3 dd = vec3(d.x, max(d.y, 0.003), d.z);
  vec3 col = atmosphere(normalize(dd));
  float mu = dot(d, sunDir);
  // Sun disc with limb darkening, seen through the atmosphere (reddened near the horizon).
  vec3 sunTint = exp(-(BR * 22.0 + BM * 26.0) * (1.0 / max(sunDir.y + 0.08, 0.05)) * 0.35);
  sunTint *= mix(vec3(1.0), vec3(1.0, 0.42, 0.16) * 0.55, haze); // seen through smoke: a dim red disc
  sunTint *= 1.0 - overcast;
  float disc = smoothstep(0.99985, 0.99992, mu);
  float limb = sqrt(max(0.0, 1.0 - (1.0 - mu) / (1.0 - 0.99985)));
  col += disc * sunTint * 260.0 * (0.6 + 0.4 * limb);
  col += sunTint * pow(max(mu, 0.0), 900.0) * 6.0;
  // High cirrus streaks lit by the low sun.
  if (d.y > 0.0) {
    vec2 uv = d.xz / (d.y + 0.08) * 0.9 + vec2(time * 0.002, 0.0);
    float c = fbm(vec2(uv.x * 0.6, uv.y * 2.4) * 1.3);
    c = smoothstep(0.52, 0.85, c) * smoothstep(0.0, 0.25, d.y) * 0.6;
    vec3 lit = sunTint * (1.4 + 4.0 * pow(max(mu, 0.0), 6.0)) * sunPower * 0.012 + col * 0.6;
    col = mix(col, lit, c);
  }
  // Smoke haze from the fire: a brown-orange pall low over the horizon on that side.
  float toward = max(dot(normalize(vec3(d.x, 0.0, d.z)), smokeDir), 0.0);
  float band = exp(-max(d.y, 0.0) * 7.0);
  col = mix(col, vec3(0.42, 0.27, 0.16) * (0.7 + 1.6 * pow(max(mu, 0.0), 4.0)) * sunPower * 0.05, band * smoke * (0.25 + 0.55 * toward));
  // Heavy smoke haze: the whole sky goes brown-orange, brightest around the sun, thickest low down.
  vec3 hazeCol = vec3(0.6, 0.4, 0.24) * sunPower * 0.04 * (0.75 + 1.2 * pow(max(mu, 0.0), 3.0));
  col = mix(col, hazeCol, haze * (0.55 + 0.4 * exp(-max(d.y, 0.0) * 3.5)));
  // Storm: a low grey deck, a little lighter toward the horizon; lightning lights it up.
  vec3 deck = vec3(0.26, 0.29, 0.33) * sunPower * 0.028 * (0.75 + 0.35 * exp(-max(d.y, 0.0) * 4.0));
  float deckN = fbm(d.xz / (abs(d.y) + 0.15) * 1.2 + vec2(time * 0.01, 0.0));
  col = mix(col, deck * (0.75 + 0.5 * deckN), overcast);
  col += vec3(0.55, 0.6, 0.75) * flash * sunPower * 0.06 * (0.6 + 0.6 * deckN);
  // Below the horizon: the far haze over the land.
  if (d.y < 0.0) col = mix(col, col * vec3(0.55, 0.5, 0.45), smoothstep(0.0, -0.2, d.y));
  gl_FragColor = vec4(col, 1.0);
}`;

export function buildSky(scene, quality = { shadowSize: 2048, shadowBox: 160 }) {
  const uniforms = {
    sunDir: { value: SUN_DIR },
    sunPower: { value: 22 },
    smoke: { value: 0.55 },
    smokeDir: { value: new THREE.Vector3(0.3, 0, -1).normalize() },
    time: { value: 0 },
    overcast: { value: 0 },
    haze: { value: 0 },
    flash: { value: 0 },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 24),
    new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, side: THREE.BackSide, depthWrite: false, fog: false }),
  );
  dome.scale.setScalar(20000);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  scene.add(dome);

  // Aerial perspective (see render/atmosphere-fog.js): colour = in-scattered haze, near = density
  // per metre at sea level, far = the haze's scale height in metres.
  scene.fog = new THREE.Fog(0xb08868, 0.00016, 420);

  const hemi = new THREE.HemisphereLight(0xffd2a8, 0x3a4a2a, 0.35);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffc896, 3.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
  const sc = sun.shadow.camera;
  const box = quality.shadowBox;
  sc.left = -box; sc.right = box; sc.top = box; sc.bottom = -box; sc.near = 10; sc.far = 1400;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  scene.add(sun);
  scene.add(sun.target);

  const snap = new THREE.Vector3();
  return {
    dome,
    sun,
    hemi,
    uniforms,
    // Keep the dome around the camera and the shadow box over what the camera looks at;
    // the box is snapped to shadow texels so shadows do not shimmer as it moves.
    follow(cameraPos, focus) {
      dome.position.copy(cameraPos);
      const texel = (box * 2) / quality.shadowSize;
      snap.copy(focus);
      snap.x = Math.round(snap.x / texel) * texel;
      snap.z = Math.round(snap.z / texel) * texel;
      sun.target.position.copy(snap);
      sun.position.copy(snap).addScaledVector(SUN_DIR, 700);
    },
  };
}
