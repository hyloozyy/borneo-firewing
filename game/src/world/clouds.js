// Volumetric-looking tropical cumulus: each cloud is a flat-based heap of many camera-facing puffs
// with two-octave noise density (crisp cauliflower edges). Lighting is computed for the cloud as a
// whole (the puff's place in its cloud gives the normal, the puff's own bulge only adds relief), so
// the sun side glows, the far side and the flat base sit in blue-grey shade and the thin edges
// light up against the sun, instead of every puff shading like its own ball. Weather sets the
// coverage (extra clouds fade in for a storm), darkness and lightning flashes inside the clouds.
// Puffs are re-sorted back to front as the camera moves.
import * as THREE from 'three';
import { rand } from '../core/rng.js';
import { painterRandom } from '../textures/texture-utils.js';
import { SUN_DIR } from './sky.js';

const vert = `
attribute vec4 puff;      // xyz centre, w radius
attribute vec2 info;      // x seed, y height within the cloud (0 base .. 1 top)
attribute vec4 shape;     // xyz offset of the puff from its cloud's centre / cloud size, w coverage rank
uniform float coverage;
varying vec2 vUv;
varying vec3 vCloudN;
varying float vRank;
varying float vSeed;
varying float vH;
varying vec3 vFogRel;
void main() {
  vUv = position.xy;
  vSeed = info.x;
  vH = info.y;
  vRank = shape.w;
  vCloudN = normalize(mat3(viewMatrix) * normalize(shape.xyz + vec3(0.0, 0.25, 0.0)));
  vec4 mv = viewMatrix * vec4(puff.xyz, 1.0);
  if (shape.w > coverage) mv.xy += 1e5; // clouds beyond the weather's coverage stay hidden
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
uniform float darkness;
uniform float coverage;
uniform float flash;
varying vec3 vCloudN;
varying float vRank;
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
  vec2 q = vUv * 2.6 + vSeed * 31.0 + vec2(time * 0.01, 0.0);
  float n = fbm(q);
  float nd = fbm(q * 2.9 + 5.0); // fine detail: crisp cauliflower edges instead of soft cotton balls
  float dens = smoothstep(0.0, 0.32, 1.0 - r + (n - 0.5) * 0.75 + (nd - 0.5) * 0.35) * (0.8 + 0.2 * n);
  // Flat bases: puffs fade out below their own centre near the cloud base.
  dens *= mix(smoothstep(-0.65, 0.05, vUv.y), 1.0, smoothstep(0.0, 0.35, vH));
  if (dens < 0.01) discard;
  vec3 Nl = normalize(vec3(vUv + (vec2(vn(q * 2.0), vn(q * 2.0 + 7.0)) - 0.5) * 0.9, sqrt(max(0.0, 1.0 - r * r))));
  vec3 N = normalize(vCloudN * 1.3 + Nl * 0.55);
  float lam = max(dot(N, sunView), 0.0);
  float wrap = max(dot(N, sunView) * 0.5 + 0.5, 0.0);
  // Forward scattering: thin edges glow when the sun is behind the cloud.
  float silver = pow(max(-sunView.z, 0.0), 3.0) * pow(1.0 - dens, 2.0) * 2.2;
  // Depth in the cloud: lower and sun-averted puffs are in the cloud's own shade; the base is flat grey.
  float self = mix(0.42, 1.0, smoothstep(0.0, 0.8, vH)) * (0.7 + 0.3 * n) * mix(0.75, 1.0, smoothstep(-0.9, 0.5, vUv.y + Nl.y * 0.3));
  float shade = mix(0.35, 1.0, smoothstep(-0.35, 0.6, dot(vCloudN, sunView)));
  vec3 amb = mix(skyBottom * 0.9, skyTop, N.y * 0.5 + 0.5) * self;
  vec3 col = amb + sunColor * (lam * 0.85 + wrap * 0.2) * self * shade + sunColor * silver * (1.0 - darkness);
  col *= 1.0 - darkness * 0.72;
  col += vec3(0.75, 0.8, 1.0) * flash * (0.6 + 0.8 * n) * (1.0 - vH * 0.5);
  float dist = length(vFogRel);
  col = mix(col, fogColor * 1.4, 1.0 - exp(-dist * 0.00009));
  gl_FragColor = vec4(col, dens * 0.97 * step(vRank, coverage));
}`;

export function buildClouds(scene, count) {
  const puffs = [];
  const total = Math.round(count * 1.8); // the extra ones only show in a storm (coverage rank)
  const own = painterRandom(7177); // storm clouds use their own stream so the world's stays as it was
  for (let i = 0; i < total; i++) {
    const R = i < count ? rand : own;
    const RR = (a, b) => a + (b - a) * R();
    const rank = (i + 0.5) / total;
    const storm = i >= count;
    const cx = RR(-9000, 9000), cz = RR(-10000, 7000), base = storm ? RR(700, 950) : RR(850, 1300);
    const w = RR(500, 1100) * (storm ? 1.4 : 1), tall = RR(300, 800) * (storm ? 1.5 : 1);
    const n = 18 + Math.floor(R() * 16); // many smaller puffs: towers with detail, not blobs
    for (let j = 0; j < n; j++) {
      const t = R();
      const hgt = Math.pow(t, 0.8);
      const spread = w * (1 - hgt * 0.6);
      const rad = RR(170, 330) * (1 - hgt * 0.35) * (w / 800);
      const px = cx + RR(-spread, spread), py = base + hgt * tall + rad * 0.35, pz = cz + RR(-spread, spread) * 0.7;
      puffs.push({ x: px, y: py, z: pz, r: rad, seed: R(), h: hgt, sx: (px - cx) / w, sy: (py - base - tall * 0.4) / tall, sz: (pz - cz) / (w * 0.7), rank });
    }
  }
  const quad = new THREE.PlaneGeometry(2, 2);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  const puffArr = new Float32Array(puffs.length * 4), infoArr = new Float32Array(puffs.length * 2);
  const puffAttr = new THREE.InstancedBufferAttribute(puffArr, 4);
  const infoAttr = new THREE.InstancedBufferAttribute(infoArr, 2);
  const shapeArr = new Float32Array(puffs.length * 4);
  const shapeAttr = new THREE.InstancedBufferAttribute(shapeArr, 4);
  geo.setAttribute('shape', shapeAttr);
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
    coverage: { value: count / total },
    darkness: { value: 0 },
    flash: { value: 0 },
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
      shapeArr[k * 4] = p.sx; shapeArr[k * 4 + 1] = p.sy; shapeArr[k * 4 + 2] = p.sz; shapeArr[k * 4 + 3] = p.rank;
    });
    shapeAttr.needsUpdate = true;
    puffAttr.needsUpdate = true;
    infoAttr.needsUpdate = true;
  }
  return {
    mesh,
    uniforms,
    baseCoverage: count / total,
    update(t, camera) {
      uniforms.time.value = t;
      uniforms.sunView.value.copy(SUN_DIR).transformDirection(camera.matrixWorldInverse);
      if (camera.position.distanceToSquared(last) > 40 * 40) { last.copy(camera.position); sortFrom(camera.position); }
    },
  };
}
