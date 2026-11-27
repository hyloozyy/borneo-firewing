// Draw-call saver for the aircraft: every mesh that never moves on its own (everything except the
// animated parts listed in `parts`: props, control surfaces, doors, gear, lights, hull, canopy) is
// baked into one mesh per material and attribute layout. Same triangles, same look, ~100 fewer
// draw calls a frame.
import * as THREE from 'three';

export function mergeStaticMeshes(model, parts) {
  const keep = new Set();
  const mark = (o) => { if (o && o.isObject3D) o.traverse((c) => keep.add(c)); };
  for (const [k, v] of Object.entries(parts)) if (k !== 'model') (Array.isArray(v) ? v : [v]).forEach(mark);
  model.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const groups = new Map();
  model.traverse((m) => {
    if (!m.isMesh || keep.has(m) || m.isInstancedMesh || m.isSkinnedMesh || Array.isArray(m.material) || m.material.transparent) return;
    for (let p = m; p && p !== model; p = p.parent) if (!p.visible) return;
    const g = m.geometry;
    const sig = Object.keys(g.attributes).sort().join(',');
    if (!g.attributes.normal || !g.attributes.position) return;
    const key = m.material.uuid + '|' + sig + '|' + (m.castShadow ? 1 : 0);
    if (!groups.has(key)) groups.set(key, { mat: m.material, cast: m.castShadow, recv: m.receiveShadow, list: [] });
    groups.get(key).list.push(m);
  });
  let removed = 0;
  for (const grp of groups.values()) {
    if (grp.list.length < 2) continue;
    const geos = grp.list.map((m) => {
      const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone());
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      return g;
    });
    const out = new THREE.BufferGeometry();
    for (const name of Object.keys(geos[0].attributes)) {
      const a0 = geos[0].attributes[name];
      const total = geos.reduce((n, g) => n + g.attributes[name].count, 0);
      const arr = new a0.array.constructor(total * a0.itemSize);
      let o = 0;
      for (const g of geos) {
        const a = g.attributes[name];
        arr.set(a.array, o);
        o += a.array.length;
      }
      out.setAttribute(name, new THREE.BufferAttribute(arr, a0.itemSize, a0.normalized));
    }
    if (!out.attributes.position) continue;
    out.computeBoundingSphere();
    const mesh = new THREE.Mesh(out, grp.mat);
    mesh.castShadow = grp.cast;
    mesh.receiveShadow = grp.recv;
    mesh.name = 'fw218-static';
    model.add(mesh);
    for (const m of grp.list) { m.parent.remove(m); removed++; }
  }
  return removed;
}
