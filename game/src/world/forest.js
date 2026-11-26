// The Kalimantan rainforest: thousands of procedural trees of six species, instanced at two levels
// of detail (full trees with hundreds of leaf cards near the camera, light versions further out),
// swaying in the wind, and scorched tree by tree as the fire spreads.
import * as THREE from 'three';
import { rand, randRange } from '../core/rng.js';
import { terrainHeight, PLACES, riverDistance } from './terrain.js';
import { forestMask, TREE_HOTSPOTS } from './forest-layout.js';
import { SPECIES } from './trees/tree-species.js';
import { buildLeafAtlas, buildBarkTextures } from '../textures/foliage-textures.js';
import { buildLeafMaterial, buildLeafDepthMaterial, buildBarkMaterial, treeUniforms } from './trees/tree-materials.js';

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

function samplePosition(species) {
  const r0 = rand();
  let acc = 0;
  for (const [hx, hz, hr, share] of TREE_HOTSPOTS) {
    acc += share;
    if (r0 < acc) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * hr;
      return [hx + Math.cos(a) * r, hz + Math.sin(a) * r];
    }
  }
  const a = rand() * Math.PI * 2, r = Math.pow(rand(), 0.7) * 4600;
  return [Math.cos(a) * r, -300 + Math.sin(a) * r * 1.05];
}

function accept(species, x, z, h) {
  const m = forestMask(x, z, h);
  if (m <= 0.05 || rand() > m) return false;
  if (species.lowland) {
    const wet = h < 30 || riverDistance(x, z) < 160 || Math.hypot(x - PLACES.lake.x, z - PLACES.lake.z) < 800 || x > PLACES.coastX - 700;
    if (!wet && rand() < 0.85) return false;
  }
  if (species.edge && m > 0.97 && rand() < 0.5) return false;
  return true;
}

function instanced(geo, mat, count, n) {
  const g = geo.clone();
  g.setAttribute('burn', new THREE.InstancedBufferAttribute(new Float32Array(count), 1));
  const mesh = new THREE.InstancedMesh(g, mat, count);
  mesh.count = n;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return mesh;
}

export function buildForest(scene, quality) {
  const atlas = buildLeafAtlas(quality.name === 'low' ? 0.5 : 1);
  const bark = buildBarkTextures(quality.name === 'low' ? 256 : 512);
  const leafMat = buildLeafMaterial(atlas);
  const leafDepth = buildLeafDepthMaterial(atlas);
  const barkMat = buildBarkMaterial(bark);
  const total = quality.trees;
  const hiRadius = quality.hiTreeRadius;
  const trees = [];
  const groups = SPECIES.map((sp, si) => {
    const hiGeo = sp.build('hi', 100 + si * 7);
    const loGeo = sp.build('lo', 100 + si * 7);
    const want = Math.floor(total * sp.share);
    const matrices = new Float32Array(want * 16);
    const list = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const tint = new THREE.Color();
    const tints = new Float32Array(want * 3);
    let tries = 0;
    while (list.length < want && tries < want * 12) {
      tries++;
      const [x, z] = samplePosition(sp);
      const h = terrainHeight(x, z);
      if (!accept(sp, x, z, h)) continue;
      const sc = randRange(sp.scale[0], sp.scale[1]);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2);
      s.set(sc * randRange(0.9, 1.1), sc * randRange(0.88, 1.12), sc * randRange(0.9, 1.1));
      p.set(x, h - 0.3, z);
      m.compose(p, q, s);
      const i = list.length;
      m.toArray(matrices, i * 16);
      // Gentle per-tree colour shifts: yellowish, bluish and darker crowns.
      const k = rand();
      tint.setRGB(0.8 + k * 0.3, 0.88 + rand() * 0.18, 0.72 + rand() * 0.25).multiplyScalar(randRange(0.7, 1.05));
      tint.toArray(tints, i * 3);
      const t = { group: si, index: i, x, z, burnt: 0 };
      list.push(t);
      trees.push(t);
    }
    const n = list.length;
    const hiCap = Math.max(8, Math.ceil(quality.hiTrees * sp.share * 1.4));
    const lo = { wood: instanced(loGeo.wood, barkMat, n, n), leaves: instanced(loGeo.leaves, leafMat, n, n) };
    const hi = { wood: instanced(hiGeo.wood, barkMat, hiCap, 0), leaves: instanced(hiGeo.leaves, leafMat, hiCap, 0) };
    for (const mesh of [lo.wood, lo.leaves, hi.wood, hi.leaves]) {
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(mesh.instanceMatrix.count * 3).fill(1), 3);
      scene.add(mesh);
    }
    for (const mesh of [lo.leaves, hi.leaves]) mesh.instanceColor.array.set(tints.subarray(0, Math.min(tints.length, mesh.instanceColor.array.length)));
    lo.wood.instanceMatrix.array.set(matrices.subarray(0, n * 16));
    lo.leaves.instanceMatrix.array.set(matrices.subarray(0, n * 16));
    hi.wood.castShadow = hi.leaves.castShadow = quality.treeShadows;
    hi.wood.receiveShadow = hi.leaves.receiveShadow = quality.treeShadows;
    hi.leaves.customDepthMaterial = leafDepth;
    return { sp, list, matrices, tints, lo, hi, hiCap, near: [] };
  });

  const burnable = trees.filter((t) => Math.hypot(t.x - PLACES.fire.x, t.z - PLACES.fire.z) < 1600);
  const last = new THREE.Vector3(1e9, 0, 0);
  let dirty = true;

  // Move the trees nearest the camera into the detailed meshes (hidden in the light ones).
  function relod(cam) {
    const r2 = hiRadius * hiRadius;
    for (const gr of groups) {
      const { list, matrices, lo, hi, hiCap } = gr;
      const near = [];
      for (const t of list) {
        const dx = t.x - cam.x, dz = t.z - cam.z;
        const d = dx * dx + dz * dz;
        if (d < r2) near.push([d, t.index]);
      }
      near.sort((a, b) => a[0] - b[0]);
      if (near.length > hiCap) near.length = hiCap;
      const loM = lo.wood.instanceMatrix.array, loL = lo.leaves.instanceMatrix.array;
      loM.set(matrices.subarray(0, list.length * 16));
      const zero = ZERO.elements;
      const hiW = hi.wood.instanceMatrix.array, hiL = hi.leaves.instanceMatrix.array;
      const hiTint = hi.leaves.instanceColor.array;
      const burnHiW = hi.wood.geometry.attributes.burn.array, burnHiL = hi.leaves.geometry.attributes.burn.array;
      near.forEach(([, idx], k) => {
        loM.set(zero, idx * 16);
        const src = matrices.subarray(idx * 16, idx * 16 + 16);
        hiW.set(src, k * 16); hiL.set(src, k * 16);
        hiTint.set(gr.tints.subarray(idx * 3, idx * 3 + 3), k * 3);
        burnHiW[k] = burnHiL[k] = list[idx].burnt;
      });
      loL.set(loM);
      hi.wood.count = hi.leaves.count = near.length;
      const loBurnW = lo.wood.geometry.attributes.burn.array, loBurnL = lo.leaves.geometry.attributes.burn.array;
      for (const t of list) loBurnW[t.index] = loBurnL[t.index] = t.burnt;
      for (const mesh of [lo.wood, lo.leaves, hi.wood, hi.leaves]) {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.geometry.attributes.burn.needsUpdate = true;
      }
      hi.leaves.instanceColor.needsUpdate = true;
      gr.near = near;
    }
  }

  const sunView = new THREE.Vector3();
  return {
    trees,
    groups,
    // Call once a frame after the camera moved: LOD swap, wind time, sun direction for leaves.
    update(camera, time, sunDir) {
      treeUniforms.uTime.value = time;
      sunView.copy(sunDir).transformDirection(camera.matrixWorldInverse);
      treeUniforms.uSunView.value.copy(sunView);
      if (dirty || camera.position.distanceToSquared(last) > 18 * 18) {
        last.copy(camera.position);
        dirty = false;
        relod(camera.position);
      }
    },
    scorch(x, z, radius, amount) {
      for (const t of burnable) {
        const d = Math.hypot(t.x - x, t.z - z);
        if (d > radius) continue;
        t.burnt = Math.min(1, t.burnt + amount * (1 - d / radius) * randRange(0.6, 1.2));
      }
      dirty = true;
    },
  };
}
