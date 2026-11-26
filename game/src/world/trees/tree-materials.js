// Bark and leaf materials for the instanced forest: PBR (standard) materials patched with wind
// sway, leaf flutter, sun translucency through leaves, and per-tree burning (leaves scorch and
// drop away, trunks char black with glowing ember cracks).
import * as THREE from 'three';

export const treeUniforms = {
  uTime: { value: 0 },
  uWind: { value: 1 },
  uSunView: { value: new THREE.Vector3(0, 1, 0) },
  uSunColor: { value: new THREE.Color(1.0, 0.72, 0.45) },
};

const swayVertex = `
#include <begin_vertex>
#ifdef USE_INSTANCING
vec2 treePos = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
#else
vec2 treePos = vec2(0.0);
#endif
float treePh = dot(treePos, vec2(0.031, 0.017));
float treeBend = sway.x * (sin(uTime * 0.9 + treePh) * 0.6 + sin(uTime * 1.73 + treePh * 1.3) * 0.25) * uWind;
transformed.x += treeBend * 0.32;
transformed.z += treeBend * 0.22;
transformed += objectNormal * sway.y * sin(uTime * 6.5 + position.x * 2.1 + position.y * 1.7 + treePh * 9.0) * 0.07 * uWind;
vBurn = burn;
vRand = sway.z;
`;

const commonVertexHead = `
attribute vec3 sway;
attribute float burn;
uniform float uTime;
uniform float uWind;
varying float vBurn;
varying float vRand;
`;

function patchCommon(shader) {
  Object.assign(shader.uniforms, treeUniforms);
  shader.vertexShader = commonVertexHead + shader.vertexShader.replace('#include <begin_vertex>', swayVertex);
  shader.fragmentShader = `
uniform float uTime;
uniform vec3 uSunView;
uniform vec3 uSunColor;
varying float vBurn;
varying float vRand;
` + shader.fragmentShader;
}

export function buildLeafMaterial(atlas) {
  const m = new THREE.MeshStandardMaterial({
    map: atlas,
    vertexColors: true,
    alphaTest: 0.42,
    alphaToCoverage: true,
    side: THREE.DoubleSide,
    roughness: 0.72,
    metalness: 0,
    envMapIntensity: 0.6,
  });
  m.onBeforeCompile = (shader) => {
    patchCommon(shader);
    // Keep the crown-centred normals on both faces (no back-face flip) for soft volume shading.
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <normal_fragment_begin>', `
float faceDirection = gl_FrontFacing ? 1.0 : -1.0;
vec3 normal = normalize( vNormal );
vec3 nonPerturbedNormal = normal;`)
      .replace('#include <map_fragment>', `
#include <map_fragment>
if (vBurn > 0.02) {
  if (vRand < vBurn * 1.1 - 0.12) discard;
  vec3 scorched = mix(vec3(0.33, 0.2, 0.07), vec3(0.05, 0.035, 0.03), smoothstep(0.35, 0.9, vBurn));
  diffuseColor.rgb = mix(diffuseColor.rgb, scorched * (0.6 + vRand * 0.6), smoothstep(0.0, 0.45, vBurn));
}`)
      .replace('#include <lights_fragment_end>', `
#include <lights_fragment_end>
{
  // Light passing through thin leaves when the sun is behind them.
  float back = pow(max(dot(normalize(-vViewPosition), uSunView), 0.0), 3.0);
  float wrap = 0.35 + 0.65 * max(dot(-normal, uSunView), 0.0);
  reflectedLight.directDiffuse += diffuseColor.rgb * uSunColor * back * wrap * 1.1 * (1.0 - vBurn);
}`);
  };
  m.customProgramCacheKey = () => 'tree-leaf-v1';
  return m;
}

export function buildLeafDepthMaterial(atlas) {
  return new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: atlas, alphaTest: 0.5, side: THREE.DoubleSide });
}

export function buildBarkMaterial(bark) {
  const m = new THREE.MeshStandardMaterial({
    map: bark.map,
    normalMap: bark.normalMap,
    normalScale: new THREE.Vector2(1.2, 1.2),
    vertexColors: true,
    roughness: 0.92,
    metalness: 0,
  });
  m.onBeforeCompile = (shader) => {
    patchCommon(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_fragment>', `
#include <map_fragment>
float barkCrack = texture2D(map, vMapUv).a;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.035, 0.03, 0.028) * (1.0 + barkCrack), smoothstep(0.05, 0.6, vBurn));`)
      .replace('#include <emissivemap_fragment>', `
#include <emissivemap_fragment>
float ember = smoothstep(0.25, 0.55, vBurn) * (1.0 - smoothstep(0.88, 1.0, vBurn));
float flick = 0.65 + 0.35 * sin(uTime * 9.0 + vRand * 40.0 + vMapUv.y * 30.0);
totalEmissiveRadiance += vec3(4.0, 1.1, 0.15) * pow(barkCrack, 2.0) * ember * flick;`);
  };
  m.customProgramCacheKey = () => 'tree-bark-v1';
  return m;
}
