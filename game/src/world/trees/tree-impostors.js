// Far trees as impostors: every tree variant is rendered once at start-up from eight directions
// into two atlases (albedo with baked leaf occlusion, and object-space normals). Far away each tree
// is one camera-facing card that picks (and cross-fades) the two nearest views and is lit in the
// shader with the same sun and sky as the real trees, so the whole forest to the horizon is made of
// the same trees as the ones beside the camera. Cards inside the detailed radius fold away on the GPU.
import * as THREE from 'three';
import { SUN_DIR } from '../sky.js';

export const FRAMES = 8;
const ELEVATION = 0.12;

const bakeVert = `
attribute vec3 color;
varying vec3 vN;
varying vec2 vUv;
varying vec3 vC;
void main() {
  vN = normal; vUv = uv; vC = color;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const bakeFrag = `
uniform sampler2D map;
uniform float leaf;
uniform float mode;
varying vec3 vN;
varying vec2 vUv;
varying vec3 vC;
void main() {
  vec4 t = texture2D(map, vUv);
  if (leaf > 0.5 && t.a < 0.45) discard;
  if (mode < 0.5) {
    gl_FragColor = vec4(sqrt(t.rgb * vC * (leaf > 0.5 ? 1.0 : 0.85)), 1.0);
  } else {
    gl_FragColor = vec4(normalize(vN) * 0.5 + 0.5, leaf > 0.5 ? 1.0 : 0.6);
  }
}`;

function bakeMaterial(map, leaf) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, leaf: { value: leaf ? 1 : 0 }, mode: { value: 0 } },
    vertexShader: bakeVert, fragmentShader: bakeFrag, side: THREE.DoubleSide,
  });
}

// geos: [{ wood, leaves }] (detailed versions). All views of all variants are laid out in one
// scene (each copy turned to its view angle and scaled to its cell) and drawn in a single pass per
// atlas, so the mip chain is built once. Returns the atlases and per-variant boxes.
export function bakeImpostors(renderer, geos, leafAtlas, barkMap, cell) {
  const rows = geos.length;
  const W = cell * FRAMES, H = cell * rows;
  const mk = () => {
    const rt = new THREE.WebGLRenderTarget(W, H, { depthBuffer: true, type: THREE.UnsignedByteType });
    rt.texture.generateMipmaps = true;
    rt.texture.minFilter = THREE.LinearMipmapLinearFilter;
    rt.texture.magFilter = THREE.LinearFilter;
    return rt;
  };
  const albedo = mk(), normal = mk();
  const leafMat = bakeMaterial(leafAtlas, true), woodMat = bakeMaterial(barkMap, false);
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(0, W, H, 0, 1, 4 * Math.max(W, H));
  cam.position.set(0, 0, 2 * Math.max(W, H));
  cam.updateMatrixWorld();
  const boxes = [];
  const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), ELEVATION);
  const qy = new THREE.Quaternion();
  geos.forEach((g, row) => {
    let maxR = 1, yMin = Infinity, yMax = -Infinity;
    for (const geo of [g.wood, g.leaves]) {
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        maxR = Math.max(maxR, Math.hypot(p.getX(i), p.getZ(i)));
        yMin = Math.min(yMin, p.getY(i)); yMax = Math.max(yMax, p.getY(i));
      }
    }
    yMin = Math.max(yMin, -0.5);
    const S = Math.max(maxR * 2, yMax - yMin) * 1.06;
    const yc = (yMin + yMax) / 2;
    boxes.push(new THREE.Vector3(S, yc, 0));
    for (let f = 0; f < FRAMES; f++) {
      const a = (f / FRAMES) * Math.PI * 2;
      const pivot = new THREE.Group();
      pivot.position.set((f + 0.5) * cell, (row + 0.5) * cell, 0);
      pivot.quaternion.copy(qx).multiply(qy.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a));
      pivot.scale.setScalar(cell / S);
      const wood = new THREE.Mesh(g.wood, woodMat), leaves = new THREE.Mesh(g.leaves, leafMat);
      wood.position.y = leaves.position.y = -yc;
      pivot.add(wood, leaves);
      scene.add(pivot);
    }
  });
  const prev = { target: renderer.getRenderTarget(), color: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha() };
  for (const [rt, mode, clear] of [[albedo, 0, [0.16, 0.2, 0.12]], [normal, 1, [0.5, 1, 0.5]]]) {
    leafMat.uniforms.mode.value = woodMat.uniforms.mode.value = mode;
    renderer.setRenderTarget(rt);
    renderer.setClearColor(new THREE.Color().setRGB(clear[0], clear[1], clear[2], THREE.LinearSRGBColorSpace), 0);
    renderer.clear(true, true, true);
    renderer.render(scene, cam);
  }
  renderer.setRenderTarget(prev.target);
  renderer.setClearColor(prev.color, prev.alpha);
  leafMat.dispose(); woodMat.dispose();
  return { albedo: albedo.texture, normal: normal.texture, boxes, rows, width: W, height: H };
}

const impVert = `
attribute vec3 iPos;
attribute vec4 iData;
attribute vec3 iTint;
attribute float iBurn;
uniform vec3 uBoxes[16];
uniform vec2 uLodCenter;
uniform float uLodR2;
uniform float uRows;
uniform float uTime;
varying vec2 vUv0;
varying vec2 vUv1;
varying vec2 vCorner;
varying float vBlend;
varying vec3 vTint;
varying float vBurn;
varying float vRot;
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vec2 d = iPos.xz - uLodCenter;
  if (dot(d, d) < uLodR2 || iData.z < 0.0) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  vec3 box = uBoxes[int(iData.z + 0.5)];
  float S = box.x * iData.x;
  vec3 toCam = cameraPosition - iPos;
  vec2 h = normalize(toCam.xz + vec2(1e-4, 0.0));
  vec3 right = vec3(h.y, 0.0, -h.x);
  float az = atan(toCam.x, toCam.z) - iData.y;
  float f = mod(az / (6.28318531 / ${FRAMES}.0), ${FRAMES}.0);
  float f0 = floor(f);
  float f1 = mod(f0 + 1.0, ${FRAMES}.0);
  vBlend = f - f0;
  vec2 c = position.xy;
  vec3 world = iPos + right * c.x * S + vec3(0.0, (box.y - box.x * 0.5) * iData.x + c.y * S, 0.0);
  float sw = c.y * c.y * (sin(uTime * 0.9 + iPos.x * 0.031 + iPos.z * 0.017) * 0.6 + sin(uTime * 1.73 + iPos.z * 0.05) * 0.25);
  world.x += sw * 0.3 * iData.x;
  world.z += sw * 0.2 * iData.x;
  vec2 cuv = vec2(c.x + 0.5, c.y);
  vUv0 = (vec2(f0, iData.z) + cuv) / vec2(${FRAMES}.0, uRows);
  vUv1 = (vec2(f1, iData.z) + cuv) / vec2(${FRAMES}.0, uRows);
  vCorner = cuv;
  vTint = iTint;
  vBurn = iBurn;
  vRot = iData.y;
  vWorld = world;
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const impFrag = `
uniform sampler2D uAlbedo;
uniform sampler2D uNormal;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSky;
uniform vec3 uGround;
uniform vec3 uAmbient;
uniform vec2 uAtlasSize;
varying vec2 vUv0;
varying vec2 vUv1;
varying vec2 vCorner;
varying float vBlend;
varying vec3 vTint;
varying float vBurn;
varying float vRot;
varying vec3 vWorld;
#include <fog_pars_fragment>
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec4 a = mix(texture2D(uAlbedo, vUv0), texture2D(uAlbedo, vUv1), vBlend);
  vec4 nn = mix(texture2D(uNormal, vUv0), texture2D(uNormal, vUv1), vBlend);
  // Mip levels average coverage down; boost it with distance so far crowns stay solid.
  vec2 texel = vUv0 * uAtlasSize;
  float lod = max(0.0, 0.5 * log2(max(dot(dFdx(texel), dFdx(texel)), dot(dFdy(texel), dFdy(texel)))));
  float cover = a.a * (1.0 + 1.1 * lod);
  if (cover < 0.5) discard;
  float leaf = smoothstep(0.7, 0.95, nn.a / max(a.a, 1e-3));
  if (vBurn > 0.02 && leaf > 0.5 && hash(floor(vCorner * 48.0)) < vBurn * 1.05 - 0.1) discard;
  vec3 alb = a.rgb * a.rgb;
  alb *= mix(vec3(1.0), vTint, leaf);
  alb = mix(alb, vec3(0.03, 0.025, 0.022), smoothstep(0.05, 0.7, vBurn));
  vec3 n = normalize(nn.xyz * 2.0 - 1.0);
  float cr = cos(vRot), sr = sin(vRot);
  vec3 N = normalize(vec3(n.x * cr + n.z * sr, n.y, -n.x * sr + n.z * cr));
  float ndl = max(dot(N, uSunDir), 0.0);
  vec3 hemi = mix(uGround, uSky, N.y * 0.5 + 0.5);
  vec3 toCam = normalize(cameraPosition - vWorld);
  float back = pow(max(dot(toCam, uSunDir), 0.0), 3.0) * (0.35 + 0.65 * max(dot(-N, uSunDir), 0.0));
  vec3 col = alb * ((uSunColor * (ndl * 1.25 + back * 1.1 * leaf) + hemi) * 0.31831 + uAmbient);
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}`;

// One instanced card per tree (all trees; the ones near the camera fold away in the shader).
export function buildImpostorMesh(forest, baked, quality, isImpostor) {
  const N = forest.count;
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const pos = new Float32Array(N * 3), data = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = forest.px[i]; pos[i * 3 + 1] = forest.py[i]; pos[i * 3 + 2] = forest.pz[i];
    const v = forest.variant[i];
    data[i * 4] = forest.scale[i]; data[i * 4 + 1] = forest.rot[i];
    data[i * 4 + 2] = isImpostor[v] ? baked.rowOf[v] : -1;
  }
  geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(pos, 3));
  geo.setAttribute('iData', new THREE.InstancedBufferAttribute(data, 4));
  geo.setAttribute('iTint', new THREE.InstancedBufferAttribute(forest.tint.subarray(0, N * 3), 3));
  const burn = new THREE.InstancedBufferAttribute(forest.burn.subarray(0, N), 1);
  burn.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('iBurn', burn);
  geo.instanceCount = N;
  const boxes = Array.from({ length: 16 }, (_, i) => baked.boxes[i] || new THREE.Vector3());
  const sun = new THREE.Color(0xffc896).multiplyScalar(3.4);
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uLodCenter: { value: new THREE.Vector2(1e9, 1e9) },
      uLodR2: { value: 0 },
      uRows: { value: baked.rows },
      uTime: { value: 0 },
      uSunDir: { value: SUN_DIR.clone() },
      uSunColor: { value: sun },
      uSky: { value: new THREE.Color(0xffd2a8).multiplyScalar(0.35) },
      uGround: { value: new THREE.Color(0x3a4a2a).multiplyScalar(0.35) },
      // Stands in for the sky reflection (environment map) the real leaves get.
      uAmbient: { value: new THREE.Color(0.55, 0.62, 0.7).multiplyScalar(Number(new URLSearchParams(location.search).get('impk') || 1.1)) },
    }]),
    vertexShader: impVert,
    fragmentShader: impFrag,
    fog: true,
  });
  // Added after the merge: render-target textures cannot be cloned by UniformsUtils.
  mat.uniforms.uAlbedo = { value: baked.albedo };
  mat.uniforms.uNormal = { value: baked.normal };
  mat.uniforms.uBoxes = { value: boxes };
  mat.uniforms.uAtlasSize = { value: new THREE.Vector2(baked.width, baked.height) };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.name = 'tree-impostors';
  return mesh;
}
