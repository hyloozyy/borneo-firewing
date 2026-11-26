// Volumetric-looking cumulus: each cloud is a flat-based heap of camera-facing puffs whose noise
// density, sphere-like normals, sun lighting, silver lining and blue-grey shaded undersides are
// computed per pixel. Puffs are re-sorted back to front as the camera moves.
import * as THREE from 'three';
import { rand, randRange } from '../core/rng.js';
import { SUN_DIR } from './sky.js';

const vert = `
attribute vec4 puff;      // xyz centre, w radius
attribute vec2 info;      // x seed, y height within the cloud (0 base .. 1 top)
varying vec2 vUv;
varying float vSeed;
varying float vH;
varying vec3 vFogRel;
void main() {
  vUv = position.xy;
  vSeed = info.x;
  vH = info.y;
  vec4 mv = viewMatrix * vec4(puff.xyz, 1.0);
  mv.xy += position.xy * puff.w;
  vFogRel = transpose(mat3(viewMatrix)) * mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

const frag = `
uniform vec3 sunView;
uniform vec3 sunColor;
uniform vec3 skyTop;
uniform vec3 skyBottom;
uniform float time;
uniform vec3 fogColor;
varying vec2 vUv;
varying float vSeed;
varying float vH;
varying vec3 vFogRel;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.07 + 1.3; a *= 0.5; } return s; }
void main() {
  float r = length(vUv);
  if (r > 1.0) discard;
  vec2 q = vUv * 2.2 + vSeed * 31.0 + vec2(time * 0.01, 0.0);
  float n = fbm(q);
  float dens = smoothstep(0.0, 0.75, 1.0 - r + (n - 0.5) * 0.6) * (0.75 + 0.25 * n);
  // Flat bases: puffs fade out below their own centre near the cloud base.
  dens *= mix(smoothstep(-0.65, 0.05, vUv.y), 1.0, smoothstep(0.0, 0.35, vH));
  if (dens < 0.01) discard;
  vec3 N = normalize(vec3(vUv + (vec2(vn(q * 2.0), vn(q * 2.0 + 7.0)) - 0.5) * 0.9, sqrt(max(0.0, 1.0 - r * r))));
  float lam = max(dot(N, sunView), 0.0);
  float wrap = max(dot(N, sunView) * 0.5 + 0.5, 0.0);
  // Forward scattering: thin edges glow when the sun is behind the cloud.
  float silver = pow(max(-sunView.z, 0.0), 3.0) * pow(1.0 - dens, 2.0) * 3.0;
  float self = mix(0.45, 1.0, vH) * (0.6 + 0.4 * n);
  vec3 amb = mix(skyBottom, skyTop, N.y * 0.5 + 0.5) * self;
  vec3 col = amb + sunColor * (lam * 0.75 + wrap * 0.35) * self + sunColor * silver;
  float dist = length(vFogRel);
  col = mix(col, fogColor * 1.4, 1.0 - exp(-dist * 0.00009));
  gl_FragColor = vec4(col, dens * 0.92);
}`;

export function buildClouds(scene, count) {
  const puffs = [];
  for (let i = 0; i < count; i++) {
    const cx = randRange(-9000, 9000), cz = randRange(-10000, 7000), base = randRange(850, 1300);
    const w = randRange(500, 1100), tall = randRange(300, 800);
    const n = 10 + Math.floor(rand() * 10);
    for (let j = 0; j < n; j++) {
      const t = rand();
      const hgt = Math.pow(t, 0.8);
      const spread = w * (1 - hgt * 0.6);
      const rad = randRange(240, 420) * (1 - hgt * 0.35) * (w / 800);
      puffs.push({ x: cx + randRange(-spread, spread), y: base + hgt * tall + rad * 0.35, z: cz + randRange(-spread, spread) * 0.7, r: rad, seed: rand(), h: hgt });
    }
  }
  const quad = new THREE.PlaneGeometry(2, 2);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  const puffArr = new Float32Array(puffs.length * 4), infoArr = new Float32Array(puffs.length * 2);
  const puffAttr = new THREE.InstancedBufferAttribute(puffArr, 4);
  const infoAttr = new THREE.InstancedBufferAttribute(infoArr, 2);
  geo.setAttribute('puff', puffAttr);
  geo.setAttribute('info', infoAttr);
  geo.instanceCount = puffs.length;
  const uniforms = {
    sunView: { value: new THREE.Vector3() },
    sunColor: { value: new THREE.Color(2.3, 1.35, 0.75) },
    skyTop: { value: new THREE.Color(0.4, 0.5, 0.72) },
    skyBottom: { value: new THREE.Color(0.32, 0.25, 0.26) },
    time: { value: 0 },
    fogColor: { value: new THREE.Color(0.95, 0.72, 0.55) },
  };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -5;
  scene.add(mesh);
  const last = new THREE.Vector3(1e9, 0, 0);
  const order = puffs.map((_, i) => i);
  function sortFrom(cam) {
    for (const p of puffs) p.d = (p.x - cam.x) ** 2 + (p.y - cam.y) ** 2 + (p.z - cam.z) ** 2;
    order.sort((a, b) => puffs[b].d - puffs[a].d);
    order.forEach((idx, k) => {
      const p = puffs[idx];
      puffArr[k * 4] = p.x; puffArr[k * 4 + 1] = p.y; puffArr[k * 4 + 2] = p.z; puffArr[k * 4 + 3] = p.r;
      infoArr[k * 2] = p.seed; infoArr[k * 2 + 1] = p.h;
    });
    puffAttr.needsUpdate = true;
    infoAttr.needsUpdate = true;
  }
  return {
    mesh,
    update(t, camera) {
      uniforms.time.value = t;
      uniforms.sunView.value.copy(SUN_DIR).transformDirection(camera.matrixWorldInverse);
      if (camera.position.distanceToSquared(last) > 40 * 40) { last.copy(camera.position); sortFrom(camera.position); }
    },
  };
}
