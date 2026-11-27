// Grass tufts and wild ginger clumps on the open ground around the airstrip, the village and the
// lake banks: instanced clumps of modelled blades that bend in the wind.
import * as THREE from 'three';
import { rand, randRange } from '../core/rng.js';
import { terrainHeight, isOnRunway, isOnApron, PLACES } from './terrain.js';
import { forestMask } from './forest-layout.js';
import { painterRandom } from '../textures/texture-utils.js';
import { treeUniforms } from './trees/tree-materials.js';

// One tuft: real blades, each a curved, tapering strip (three segments, pointed tip) leaning out
// from the clump, dark and dense at the root, lighter and yellower toward the tips; a few dry blades.
function tuftGeometry(BLADES = 13) {
  const rnd = painterRandom(77);
  const pos = [], col = [], bend = [], nor = [];
  const SEG = BLADES > 8 ? 3 : 2;
  const c0 = new THREE.Color(), c1 = new THREE.Color(), c = new THREE.Color();
  for (let i = 0; i < BLADES; i++) {
    const a = rnd() * Math.PI * 2, r0 = rnd() * 0.18;
    const bx = Math.cos(a) * r0, bz = Math.sin(a) * r0;
    const dir = a + (rnd() - 0.5) * 0.8, lean = 0.15 + rnd() * 0.45, h = 0.38 + rnd() * 0.55, w = 0.022 + rnd() * 0.02;
    const dx = Math.cos(dir), dz = Math.sin(dir), px = -dz, pz = dx; // lean direction and blade width axis
    const dry = rnd() < 0.18;
    c0.setHSL(dry ? 0.12 : 0.24 + rnd() * 0.04, 0.5, dry ? 0.2 : 0.07 + rnd() * 0.03);
    c1.setHSL(dry ? 0.11 : 0.2 + rnd() * 0.05, dry ? 0.45 : 0.55, dry ? 0.5 : 0.26 + rnd() * 0.1);
    const at = (t) => [bx + dx * lean * t * t, h * t - lean * 0.25 * t * t * t, bz + dz * lean * t * t];
    const ring = [];
    for (let k = 0; k <= SEG; k++) {
      const t = k / SEG, [x, y, z] = at(t), ww = w * (1 - t * 0.85);
      c.copy(c0).lerp(c1, Math.pow(t, 0.7));
      ring.push({ l: [x - px * ww, y, z - pz * ww], r: [x + px * ww, y, z + pz * ww], t, col: [c.r, c.g, c.b] });
    }
    const tip = at(1.08);
    const push = (p, t, cc) => { pos.push(...p); bend.push(t); col.push(...cc); nor.push(dx * 0.25, 0.95, dz * 0.25); };
    for (let k = 0; k < SEG; k++) {
      const A = ring[k], B = ring[k + 1];
      if (k === SEG - 1) { push(A.l, A.t, A.col); push(A.r, A.t, A.col); push(tip, 1, B.col); continue; }
      push(A.l, A.t, A.col); push(A.r, A.t, A.col); push(B.r, B.t, B.col);
      push(A.l, A.t, A.col); push(B.r, B.t, B.col); push(B.l, B.t, B.col);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('bend', new THREE.Float32BufferAttribute(bend, 1));
  // Normals lean up so blades light like the ground they stand on, with a hint of their own lean.
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

function grassAllowed(x, z, h) {
  if (h < 1.8 || isOnRunway(x, z, 3) || isOnApron(x, z, 2)) return false;
  return forestMask(x, z, h) < 0.35;
}

export function buildGrass(scene, count, blades = 13) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, treeUniforms);
    shader.vertexShader = 'uniform float uTime;\nuniform float uWind;\nattribute float bend;\n' + shader.vertexShader.replace('#include <begin_vertex>', `
#include <begin_vertex>
vec2 gp = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
float sway = bend * bend * (0.18 + 0.12 * sin(uTime * 2.1 + gp.x * 0.13 + gp.y * 0.07)) * uWind;
transformed.x += sway;
transformed.z += sway * 0.6;`);
  };
  mat.customProgramCacheKey = () => 'grass-blades-v2';
  const mesh = new THREE.InstancedMesh(tuftGeometry(blades), mat, count);
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
