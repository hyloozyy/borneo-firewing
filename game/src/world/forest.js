// The Kalimantan rainforest: a closed canopy of procedural trees over the whole island, drawn at
// three levels of detail. Near the camera every tree is the full model (branching limbs, hundreds
// of leaf cards, buttress roots, casting shadows); further out a lighter model of the same tree;
// beyond that a baked impostor card of that tree. Trees sway in the wind and scorch one by one as
// the fire spreads (leaves brown and drop, trunks char with glowing cracks).
import * as THREE from 'three';
import { VARIANTS } from './trees/tree-species.js';
import { placeForest, forEachTreeNear } from './forest-placement.js';
import { bakeImpostors, buildImpostorMesh } from './trees/tree-impostors.js';
import { buildLeafAtlas, buildBarkTextures } from '../textures/foliage-textures.js';
import { buildLeafMaterial, buildLeafDepthMaterial, buildBarkMaterial, treeUniforms } from './trees/tree-materials.js';

function instanced(geo, mat, cap) {
  const g = geo.clone();
  const burn = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
  burn.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('burn', burn);
  const mesh = new THREE.InstancedMesh(g, mat, cap);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  return mesh;
}

export function buildForest(scene, quality, renderer) {
  const atlas = buildLeafAtlas(quality.texDetail ?? 1);
  const bark = buildBarkTextures(quality.texDetail < 1 ? 256 : 512);
  const leafMat = buildLeafMaterial(atlas);
  const leafDepth = buildLeafDepthMaterial(atlas);
  const barkMat = buildBarkMaterial(bark);
  const f = placeForest(quality.treeSpacing, quality.shrubChance);
  const lod = { hi: quality.hiTreeRadius, lo: quality.loTreeRadius, shrub: quality.shrubRadius };

  const geos = VARIANTS.map((v) => ({ hi: v.build('hi', v.seed), lo: v.build('lo', v.seed) }));
  // Instance capacity per variant from the densest possible packing inside each radius.
  const perArea = (1 + quality.shrubChance) / (quality.treeSpacing * quality.treeSpacing);
  const groups = VARIANTS.map((v, vi) => {
    const share = f.perVariant[vi] / Math.max(1, f.count);
    const isShrub = v.impostor === false;
    const capHi = Math.ceil(Math.PI * lod.hi * lod.hi * perArea * share * 1.6 + 40);
    const capLo = isShrub ? 0 : Math.ceil(Math.PI * lod.lo * lod.lo * perArea * share * 1.6 + 60);
    const hi = { wood: instanced(geos[vi].hi.wood, barkMat, capHi), leaves: instanced(geos[vi].hi.leaves, leafMat, capHi) };
    const lo = capLo ? { wood: instanced(geos[vi].lo.wood, barkMat, capLo), leaves: instanced(geos[vi].lo.leaves, leafMat, capLo) } : null;
    hi.wood.castShadow = hi.leaves.castShadow = quality.treeShadows;
    hi.wood.receiveShadow = hi.leaves.receiveShadow = quality.treeShadows;
    hi.leaves.customDepthMaterial = leafDepth;
    for (const m of [hi.wood, hi.leaves, ...(lo ? [lo.wood, lo.leaves] : [])]) scene.add(m);
    if (lo) lo.wood.receiveShadow = lo.leaves.receiveShadow = quality.treeShadows;
    return { v, hi, lo, capHi, capLo, nHi: 0, nLo: 0, shrub: isShrub };
  });

  // Far trees: impostors baked from the detailed models.
  const isImpostor = VARIANTS.map((v) => v.impostor !== false);
  const bakeList = [];
  const rowOf = VARIANTS.map((v, vi) => (isImpostor[vi] ? bakeList.push(geos[vi].hi) - 1 : -1));
  const baked = bakeImpostors(renderer, bakeList, atlas, bark.map, quality.impostorCell);
  baked.rowOf = rowOf;
  const impostors = buildImpostorMesh(f, baked, quality, isImpostor);
  scene.add(impostors);
  const impU = impostors.material.uniforms;

  const m4 = new Float32Array(16);
  function writeInstance(mesh, slot, i, tint) {
    const s = f.scale[i], r = f.rot[i];
    const c = Math.cos(r), sn = Math.sin(r);
    // Slight per-tree stretch so copies of a variant differ in proportion too.
    const sy = s * (0.9 + ((i * 7919) % 23) / 92), sx = s * (0.92 + ((i * 104729) % 17) / 100);
    m4[0] = c * sx; m4[1] = 0; m4[2] = -sn * sx; m4[3] = 0;
    m4[4] = 0; m4[5] = sy; m4[6] = 0; m4[7] = 0;
    m4[8] = sn * sx; m4[9] = 0; m4[10] = c * sx; m4[11] = 0;
    m4[12] = f.px[i]; m4[13] = f.py[i]; m4[14] = f.pz[i]; m4[15] = 1;
    mesh.instanceMatrix.array.set(m4, slot * 16);
    if (tint) mesh.instanceColor.array.set(f.tint.subarray(i * 3, i * 3 + 3), slot * 3);
    mesh.geometry.attributes.burn.array[slot] = f.burn[i];
  }

  const center = new THREE.Vector2(1e9, 1e9);
  // Sort the trees around the camera into the detailed and light meshes.
  function relod(x, z) {
    center.set(x, z);
    for (const g of groups) g.nHi = g.nLo = 0;
    const hi2 = lod.hi * lod.hi, sh2 = lod.shrub * lod.shrub;
    forEachTreeNear(f, x, z, lod.lo, (i, d2) => {
      const g = groups[f.variant[i]];
      if (g.shrub) {
        if (d2 < sh2 && g.nHi < g.capHi) { writeInstance(g.hi.wood, g.nHi, i, false); writeInstance(g.hi.leaves, g.nHi, i, true); g.nHi++; }
        return;
      }
      if (d2 < hi2 && g.nHi < g.capHi) {
        writeInstance(g.hi.wood, g.nHi, i, false); writeInstance(g.hi.leaves, g.nHi, i, true); g.nHi++;
      } else if (g.nLo < g.capLo) {
        writeInstance(g.lo.wood, g.nLo, i, false); writeInstance(g.lo.leaves, g.nLo, i, true); g.nLo++;
      }
    });
    for (const g of groups) {
      for (const [m, n] of [[g.hi.wood, g.nHi], [g.hi.leaves, g.nHi], ...(g.lo ? [[g.lo.wood, g.nLo], [g.lo.leaves, g.nLo]] : [])]) {
        m.count = n;
        m.instanceMatrix.needsUpdate = true;
        m.instanceColor.needsUpdate = true;
        m.geometry.attributes.burn.needsUpdate = true;
      }
    }
    impU.uLodCenter.value.copy(center);
    impU.uLodR2.value = lod.lo * lod.lo;
  }

  const last = new THREE.Vector3(1e9, 0, 0);
  let dirty = true, sinceRelod = 0, lastTime = 0;
  const sunView = new THREE.Vector3();
  return {
    data: f,
    groups,
    impostors,
    // Call once a frame after the camera moved: LOD swap, wind time, sun direction for leaves.
    update(camera, time, sunDir) {
      treeUniforms.uTime.value = time;
      impU.uTime.value = time;
      sunView.copy(sunDir).transformDirection(camera.matrixWorldInverse);
      treeUniforms.uSunView.value.copy(sunView);
      sinceRelod += Math.max(0, time - lastTime);
      lastTime = time;
      const moved = camera.position.distanceToSquared(last) > 24 * 24;
      if (moved || (dirty && sinceRelod > 0.4)) {
        last.copy(camera.position);
        dirty = false;
        sinceRelod = 0;
        relod(camera.position.x, camera.position.z);
      }
    },
    // Lighter detail on slow machines (called by the automatic quality step-down).
    reduceDetail() {
      lod.hi *= 0.7; lod.lo *= 0.75; lod.shrub *= 0.7;
      dirty = true; sinceRelod = 1;
    },
    scorch(x, z, radius, amount) {
      let any = false;
      forEachTreeNear(f, x, z, radius, (i, d2) => {
        const d = Math.sqrt(d2);
        const k = ((i * 2654435761) >>> 0) / 4294967296;
        f.burn[i] = Math.min(1, f.burn[i] + amount * (1 - d / radius) * (0.6 + k * 0.6));
        any = true;
      });
      if (any) {
        impostors.geometry.attributes.iBurn.needsUpdate = true;
        dirty = true;
      }
    },
  };
}
