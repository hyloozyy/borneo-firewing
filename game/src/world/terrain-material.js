// Terrain shading: six painted ground layers (texture arrays) blended per pixel by the vertex splat
// weights and each layer's height (so grass grows between pebbles, sand fills cracks), sampled at
// two scales to hide tiling, with blended normal maps, wet banks, and the live burn map
// (black ash, glowing embers, soaked soil) over the fire zone.
import * as THREE from 'three';
import { GROUND_TILE } from '../textures/ground-textures.js';
import { BURN_SIZE } from '../fire/burn-map.js';

export function buildTerrainMaterial(ground, burnMap) {
  const uniforms = {
    gAlbedo: { value: ground.albedo },
    gNormal: { value: ground.normal },
    gTile: { value: GROUND_TILE.map((t) => 1 / t) },
    burnTex: { value: burnMap.texture },
    burnOrigin: { value: burnMap.origin },
    burnSize: { value: BURN_SIZE },
    uTime: { value: 0 },
  };
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `
attribute vec4 splatA;
attribute vec4 splatB;
varying vec4 vSplatA;
varying vec4 vSplatB;
varying vec3 vGroundPos;
varying vec3 vGroundN;
` + shader.vertexShader.replace('#include <begin_vertex>', `
#include <begin_vertex>
vSplatA = splatA;
vSplatB = splatB;
vGroundPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vGroundN = normalize(mat3(modelMatrix) * objectNormal);`);
    shader.fragmentShader = `
precision highp sampler2DArray;
uniform sampler2DArray gAlbedo;
uniform sampler2DArray gNormal;
uniform float gTile[6];
uniform sampler2D burnTex;
uniform vec2 burnOrigin;
uniform float burnSize;
uniform float uTime;
varying vec4 vSplatA;
varying vec4 vSplatB;
varying vec3 vGroundPos;
varying vec3 vGroundN;
vec3 groundNormalTS;
float groundRough;
float gHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
float gNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(gHash(i), gHash(i + vec2(1, 0)), u.x), mix(gHash(i + vec2(0, 1)), gHash(i + vec2(1, 1)), u.x), u.y);
}
` + shader.fragmentShader
      .replace('#include <map_fragment>', `
{
  vec2 wp = vGroundPos.xz;
  vec2 dX = dFdx(wp), dY = dFdy(wp);
  float macro = gNoise(wp * 0.004) * 0.6 + gNoise(wp * 0.017) * 0.4;
  float w[6];
  w[0] = vSplatA.x; w[1] = vSplatA.y; w[2] = vSplatA.z; w[3] = vSplatA.w; w[4] = vSplatB.x; w[5] = vSplatB.y;
  // Live burn map: ash replaces whatever grew here; wet soil darkens it.
  vec2 buv = (wp - burnOrigin) / burnSize;
  vec4 burn = vec4(0.0);
  if (buv.x > 0.0 && buv.y > 0.0 && buv.x < 1.0 && buv.y < 1.0) burn = texture2D(burnTex, buv);
  float ashW = burn.r * (0.75 + 0.5 * gNoise(wp * 0.08));
  for (int i = 0; i < 5; i++) w[i] *= (1.0 - clamp(ashW, 0.0, 1.0));
  w[5] = max(w[5], ashW);
  vec4 alb[6];
  vec3 nrm[6];
  float best = 0.0;
  for (int i = 0; i < 6; i++) {
    alb[i] = vec4(0.0); nrm[i] = vec3(0.0, 0.0, 1.0);
    if (w[i] < 0.004) { w[i] = 0.0; continue; }
    float s = gTile[i];
    vec2 uvA = wp * s;
    vec2 uvB = vec2(wp.x * 0.81 + wp.y * 0.59, -wp.x * 0.59 + wp.y * 0.81) * s * 0.27;
    vec4 a1 = textureGrad(gAlbedo, vec3(uvA, float(i)), dX * s, dY * s);
    vec4 a2 = textureGrad(gAlbedo, vec3(uvB, float(i)), dX * s * 0.27, dY * s * 0.27);
    vec3 n1 = textureGrad(gNormal, vec3(uvA, float(i)), dX * s, dY * s).xyz * 2.0 - 1.0;
    vec3 n2 = textureGrad(gNormal, vec3(uvB, float(i)), dX * s * 0.27, dY * s * 0.27).xyz * 2.0 - 1.0;
    float mixB = 0.35 + 0.3 * macro;
    alb[i] = mix(a1, a2, mixB);
    nrm[i] = normalize(mix(n1, n2, mixB));
    w[i] = w[i] * (0.35 + alb[i].a * 1.3);
    best = max(best, w[i]);
  }
  float sum = 0.0;
  for (int i = 0; i < 6; i++) { w[i] = max(w[i] - best * 0.55, 0.0); sum += w[i]; }
  vec3 col = vec3(0.0);
  vec3 nb = vec3(0.0);
  for (int i = 0; i < 6; i++) {
    float k = w[i] / max(sum, 1e-4);
    col += alb[i].rgb * k;
    nb += nrm[i] * k;
  }
  // Large-scale colour drift so the land never looks tiled from altitude.
  col *= mix(vec3(0.82, 0.86, 0.8), vec3(1.12, 1.08, 1.0), macro) * (0.9 + vSplatB.w * 0.25);
  float wet = vSplatB.z + burn.b * 0.8;
  col *= 1.0 - wet * 0.45;
  groundNormalTS = normalize(nb + vec3(0.0, 0.0, 0.001));
  groundRough = mix(0.93, 0.45, clamp(wet, 0.0, 1.0));
  diffuseColor.rgb *= col;
}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = groundRough;`)
      .replace('#include <normal_fragment_maps>', `
{
  vec3 N = normalize(vGroundN);
  vec3 T = normalize(vec3(1.0, 0.0, 0.0) - N * N.x);
  vec3 B = normalize(vec3(0.0, 0.0, 1.0) - N * N.z);
  vec3 nW = normalize(T * groundNormalTS.x + B * groundNormalTS.y + N * groundNormalTS.z);
  normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{
  vec2 buv = (vGroundPos.xz - burnOrigin) / burnSize;
  if (buv.x > 0.0 && buv.y > 0.0 && buv.x < 1.0 && buv.y < 1.0) {
    float glow = texture2D(burnTex, buv).g;
    float n = gNoise(vGroundPos.xz * 0.35 + uTime * 0.6) * gNoise(vGroundPos.xz * 1.3 - uTime * 0.9);
    float cracks = smoothstep(0.25, 0.7, n);
    totalEmissiveRadiance += vec3(5.0, 1.3, 0.18) * glow * (0.25 + cracks * 1.6);
  }
}`);
  };
  m.customProgramCacheKey = () => 'terrain-splat-v1';
  return { material: m, uniforms };
}
