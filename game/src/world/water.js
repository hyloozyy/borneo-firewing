// Sea, lake and river: one water surface at sea level with a real planar reflection (the scene is
// re-rendered from a mirrored camera), Fresnel, two layers of moving normal-mapped waves, depth
// colour from a baked depth map, shoreline foam and a bright sun glitter path.
import * as THREE from 'three';
import { waterNormalTexture } from '../core/canvas-textures.js';
import { WORLD_SIZE, terrainHeight } from './terrain.js';
import { SUN_DIR } from './sky.js';

const vert = `
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const frag = `
uniform sampler2D normalTex;
uniform sampler2D reflTex;
uniform sampler2D depthTex;
uniform mat4 reflMatrix;
uniform float useRefl;
uniform float time;
uniform vec3 sunDir;
uniform vec3 sunColor;
uniform vec3 skyColor;
uniform vec3 deepColor;
uniform vec3 shallowColor;
uniform float worldSize;
varying vec3 vWorld;
#include <fog_pars_fragment>

float h21(vec2 p) { return fract(sin(dot(p, vec2(12.7, 78.1))) * 43758.5); }
float n2(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y);
}

void main() {
  vec2 p = vWorld.xz;
  float dist = length(cameraPosition - vWorld);
  vec3 n1 = texture2D(normalTex, p * 0.09 + vec2(time * 0.018, time * 0.011)).xyz * 2.0 - 1.0;
  vec3 n2v = texture2D(normalTex, p * 0.027 - vec2(time * 0.007, -time * 0.012)).xyz * 2.0 - 1.0;
  vec3 n3 = texture2D(normalTex, p * 0.17 + vec2(-time * 0.04, time * 0.05)).xyz * 2.0 - 1.0;
  vec2 slope = n1.xy * 0.6 + n2v.xy * 0.8 + n3.xy * 0.35 * exp(-dist * 0.004);
  slope *= mix(1.0, 0.35, smoothstep(200.0, 3000.0, dist));
  vec3 N = normalize(vec3(slope.x * 0.35, 1.0, slope.y * 0.35));
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);

  vec3 refl;
  vec3 R = reflect(-V, N);
  if (useRefl > 0.5) {
    vec4 rp = reflMatrix * vec4(vWorld, 1.0);
    vec2 ruv = rp.xy / rp.w * 0.5 + 0.5 + N.xz * 0.045;
    refl = texture2D(reflTex, clamp(ruv, 0.001, 0.999)).rgb;
  } else {
    refl = skyColor * (0.6 + 0.6 * max(R.y, 0.0));
  }
  // Depth: shallow banks show warm silt, deep water is a dark tannin green-brown (peat rivers).
  vec2 duv = vWorld.xz / worldSize + 0.5;
  float depth = texture2D(depthTex, duv).r * 25.0;
  vec3 body = mix(shallowColor, deepColor, smoothstep(0.0, 9.0, depth));
  vec3 sunLit = body * sunColor * 0.08 * (0.4 + 0.6 * max(dot(N, sunDir), 0.0)) + body * skyColor * 0.25;
  vec3 col = mix(sunLit, refl, fres);
  // Sun glitter.
  float spec = pow(max(dot(R, sunDir), 0.0), 700.0) * 60.0 + pow(max(dot(R, sunDir), 0.0), 120.0) * 0.12;
  col += sunColor * spec;
  // Shoreline foam that laps in and out.
  float shore = 1.0 - smoothstep(0.0, 1.6, depth);
  float lap = sin(depth * 6.0 - time * 1.8 + n2(p * 0.08) * 6.0) * 0.5 + 0.5;
  float foam = shore * smoothstep(0.45, 0.8, n2(p * 0.9 + time * 0.3) * 0.6 + lap * 0.5) * step(0.02, depth);
  col = mix(col, sunColor * 0.13 + skyColor * 0.3, foam * 0.75);
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}`;

// Water depth (0..25 m) baked over the whole world into a byte texture.
function depthTexture(res) {
  const data = new Uint8Array(res * res * 4);
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const x = (i / (res - 1) - 0.5) * WORLD_SIZE, z = (j / (res - 1) - 0.5) * WORLD_SIZE;
      const d = Math.max(0, Math.min(25, -terrainHeight(x, z)));
      data[(j * res + i) * 4] = Math.round((d / 25) * 255);
      data[(j * res + i) * 4 + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, res, res, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

export function buildWater(quality = { reflections: true, pixelRatio: 1 }) {
  const normals = waterNormalTexture();
  normals.wrapS = normals.wrapT = THREE.RepeatWrapping;
  const reflRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    normalTex: { value: null },
    reflTex: { value: null },
    depthTex: { value: null },
    reflMatrix: { value: new THREE.Matrix4() },
    useRefl: { value: quality.reflections ? 1 : 0 },
    time: { value: 0 },
    sunDir: { value: SUN_DIR.clone() },
    sunColor: { value: new THREE.Color(9, 5.6, 3.2) },
    skyColor: { value: new THREE.Color(0.9, 1.0, 1.25) },
    deepColor: { value: new THREE.Color(0.012, 0.03, 0.022) },
    shallowColor: { value: new THREE.Color(0.11, 0.09, 0.05) },
    worldSize: { value: WORLD_SIZE },
  }]);
  uniforms.normalTex.value = normals;
  uniforms.reflTex.value = reflRT.texture;
  uniforms.depthTex.value = depthTexture(quality.reflections ? 512 : 256);
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, fog: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_SIZE * 1.6, WORLD_SIZE * 1.6), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.name = 'water';

  const mirrorCam = new THREE.PerspectiveCamera();
  const clip = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.4)];
  const fwd = new THREE.Vector3(), up = new THREE.Vector3(), target = new THREE.Vector3();
  return {
    mesh,
    uniforms,
    setSize(w, h, pr) {
      reflRT.setSize(Math.max(1, Math.floor(w * pr * 0.5)), Math.max(1, Math.floor(h * pr * 0.5)));
    },
    // Render the mirrored scene (everything above the water) into the reflection texture.
    renderReflection(renderer, scene, camera) {
      // High above, the water is a small part of the view: the sky-only reflection is enough.
      const use = quality.reflections && camera.position.y > 0.2 && camera.position.y < 900;
      uniforms.useRefl.value = use ? 1 : 0;
      if (!use) return;
      mirrorCam.copy(camera);
      mirrorCam.position.set(camera.position.x, -camera.position.y, camera.position.z);
      camera.getWorldDirection(fwd);
      target.copy(camera.position).add(fwd);
      target.y = -target.y;
      up.set(0, 1, 0).applyQuaternion(camera.quaternion);
      up.y = -up.y;
      mirrorCam.up.copy(up);
      mirrorCam.lookAt(target);
      mirrorCam.updateMatrixWorld();
      uniforms.reflMatrix.value.multiplyMatrices(mirrorCam.projectionMatrix, mirrorCam.matrixWorldInverse);
      mesh.visible = false;
      const autoShadow = renderer.shadowMap.autoUpdate;
      renderer.shadowMap.autoUpdate = false;
      renderer.clippingPlanes = clip;
      renderer.setRenderTarget(reflRT);
      renderer.render(scene, mirrorCam);
      renderer.clippingPlanes = [];
      renderer.shadowMap.autoUpdate = autoShadow;
      mesh.visible = true;
    },
    update(t) {
      uniforms.time.value = t;
    },
  };
}
