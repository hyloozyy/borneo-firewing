// Grass tufts and wild ginger clumps on the open ground around the airstrip, the village and the
// lake banks: instanced crossed cards with painted blades that bend in the wind.
import * as THREE from 'three';
import { rand, randRange } from '../core/rng.js';
import { terrainHeight, isOnRunway, PLACES } from './terrain.js';
import { forestMask } from './forest-layout.js';
import { makeCanvas, canvasToTexture, painterRandom } from '../textures/texture-utils.js';
import { treeUniforms } from './trees/tree-materials.js';

function grassTexture() {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d', { willReadFrequently: true });
  const rnd = painterRandom(77);
  for (let i = 0; i < 110; i++) {
    const x = 20 + rnd() * 216, h = 120 + rnd() * 130, lean = (rnd() - 0.5) * 90, w = 2 + rnd() * 4;
    const dry = rnd() < 0.22;
    const hue = dry ? 48 + rnd() * 10 : 78 + rnd() * 25, lit = dry ? 52 + rnd() * 12 : 26 + rnd() * 18;
    const grad = g.createLinearGradient(0, 256, 0, 256 - h);
    grad.addColorStop(0, `hsl(${hue},45%,${lit * 0.45}%)`);
    grad.addColorStop(1, `hsl(${hue - 6},${dry ? 40 : 55}%,${lit + 10}%)`);
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(x - w, 256);
    g.quadraticCurveTo(x + lean * 0.3, 256 - h * 0.6, x + lean, 256 - h);
    g.quadraticCurveTo(x + lean * 0.3 + w * 0.5, 256 - h * 0.6, x + w, 256);
    g.fill();
  }
  return canvasToTexture(c, { bleed: true });
}

function tuftGeometry() {
  const parts = [];
  for (let k = 0; k < 3; k++) {
    const q = new THREE.PlaneGeometry(1.4, 0.9, 1, 2);
    q.translate(0, 0.45, 0);
    q.rotateY((k / 3) * Math.PI);
    parts.push(q);
  }
  const pos = [], uv = [], idx = [];
  let base = 0;
  for (const q of parts) {
    pos.push(...q.attributes.position.array);
    uv.push(...q.attributes.uv.array);
    for (const i of q.index.array) idx.push(i + base);
    base += q.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  // Normals point up so tufts light like the ground they stand on.
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length / 3).fill([0, 1, 0]).flat(), 3));
  g.setIndex(idx);
  return g;
}

function grassAllowed(x, z, h) {
  if (h < 1.8 || isOnRunway(x, z, 3)) return false;
  return forestMask(x, z, h) < 0.35;
}

export function buildGrass(scene, count) {
  const mat = new THREE.MeshStandardMaterial({ map: grassTexture(), alphaTest: 0.45, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.85 });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, treeUniforms);
    shader.vertexShader = 'uniform float uTime;\nuniform float uWind;\n' + shader.vertexShader.replace('#include <begin_vertex>', `
#include <begin_vertex>
vec2 gp = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
float bend = uv.y * uv.y * (0.18 + 0.12 * sin(uTime * 2.1 + gp.x * 0.13 + gp.y * 0.07)) * uWind;
transformed.x += bend;
transformed.z += bend * 0.6;`);
  };
  mat.customProgramCacheKey = () => 'grass-v1';
  const mesh = new THREE.InstancedMesh(tuftGeometry(), mat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  const zones = [
    [PLACES.runway.x, PLACES.runway.z, 260, PLACES.runway.length / 2 + 500, 0.55],
    [PLACES.village.x, PLACES.village.z, 260, 260, 0.2],
    [PLACES.lake.x, PLACES.lake.z, 900, 900, 0.25],
  ];
  let n = 0, tries = 0;
  while (n < count && tries < count * 8) {
    tries++;
    const zr = rand();
    let acc = 0, zone = zones[0];
    for (const zz of zones) { acc += zz[4]; if (zr < acc) { zone = zz; break; } }
    const x = zone[0] + randRange(-zone[2], zone[2]), z = zone[1] + randRange(-zone[3], zone[3]);
    const h = terrainHeight(x, z);
    if (!grassAllowed(x, z, h)) continue;
    const sc = randRange(0.6, 1.5);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI);
    s.set(sc, sc * randRange(0.7, 1.3), sc);
    p.set(x, h - 0.05, z);
    m.compose(p, q, s);
    mesh.setMatrixAt(n, m);
    col.setRGB(randRange(0.8, 1.15), randRange(0.85, 1.1), randRange(0.75, 1.0));
    mesh.setColorAt(n, col);
    n++;
  }
  mesh.count = n;
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}
