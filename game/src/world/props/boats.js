// River craft and moorings: a lofted plank hull (pointed, raised bow and stern, gunwale rail, thwarts)
// used for the jukung canoe and the klotok river boat (with a zinc-roofed cabin on posts and a
// long-tail engine), plus a plank jetty on ironwood piles with a mooring ladder and bollards.
import * as THREE from 'three';

// Open hull along X, length L, beam W, depth H. Sections are U-shaped; the sheer rises at the ends.
function hullGeometry(L, W, H, nx = 18, nr = 8) {
  const pos = [], idx = [];
  for (let i = 0; i <= nx; i++) {
    const t = i / nx, e = Math.abs(2 * t - 1);
    const half = (W / 2) * Math.pow(Math.max(0, 1 - Math.pow(e, 2.2)), 0.6);
    const depth = H * (1 - Math.pow(e, 3) * 0.7);
    const sheer = 0.35 * Math.pow(e, 4) * H * 2.2;
    for (let j = 0; j <= nr; j++) {
      const a = (j / nr) * Math.PI;
      const z = Math.cos(a) * half;
      const y = -Math.pow(Math.sin(a), 0.7) * depth + sheer;
      pos.push((t - 0.5) * L, y, z);
    }
  }
  for (let i = 0; i < nx; i++) for (let j = 0; j < nr; j++) {
    const a = i * (nr + 1) + j, b = a + nr + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // UVs along the planks: u = length, v = girth.
  const uv = [];
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nr; j++) uv.push((i / nx) * L / 2, (j / nr) * W * 1.2 / 2);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

const hulls = new Map();
function hull(L, W, H) {
  const k = `${L}|${W}|${H}`;
  if (!hulls.has(k)) hulls.set(k, hullGeometry(L, W, H));
  return hulls.get(k);
}

// kind: 'jukung' (canoe) or 'klotok' (river boat with cabin). Waterline at y = 0, bow toward +X.
export function addBoat(b, kind, color = 'hullBlue') {
  const L = kind === 'klotok' ? 11 : 6.5, W = kind === 'klotok' ? 1.9 : 1.05, H = kind === 'klotok' ? 0.85 : 0.5;
  b.add(color, hull(L, W, H), { y: H * 0.45, uvScale: [1, 1] });
  // Gunwale rails and thwarts.
  for (const s of [-1, 1]) b.beam('woodDark', [-L * 0.42, H * 0.47, s * W * 0.44], [L * 0.42, H * 0.47, s * W * 0.44], 0.07);
  for (let x = -L * 0.3; x <= L * 0.3; x += L * 0.15) b.box('wood', 0.22, 0.05, W * 0.86, { x, y: H * 0.35, tile: 1 });
  b.box('woodDark', 0.4, 0.04, W * 0.7, { y: -H * 0.25, tile: 1 }); // floor boards
  if (kind === 'klotok') {
    for (const x of [-2.4, 1.6]) for (const s of [-1, 1]) b.beam('woodDark', [x, H * 0.45, s * 0.8], [x, H * 0.45 + 1.7, s * 0.8], 0.08);
    b.box('zincRust', 4.6, 0.06, 2.2, { x: -0.4, y: H * 0.45 + 1.75, tile: 2.2 });
    b.box('woodCream', 4, 0.5, 0.04, { x: -0.4, y: H * 0.45 + 0.6, z: 0.82, tile: 1.5 });
    b.box('woodCream', 4, 0.5, 0.04, { x: -0.4, y: H * 0.45 + 0.6, z: -0.82, tile: 1.5 });
    // Long-tail engine at the stern.
    b.box('steelBlue', 0.6, 0.45, 0.45, { x: -L / 2 + 0.6, y: H * 0.9, tile: 1 });
    b.beam('steel', [-L / 2 + 0.4, H * 0.8, 0], [-L / 2 - 2.0, -0.2, 0], 0.07, { round: true });
  } else {
    b.box('wood', 1.6, 0.03, 0.12, { x: 0.8, y: H * 0.5, z: 0.3, ry: 0.4, tile: 1 }); // paddle across the thwarts
  }
}

// Plank jetty along +X from the shore (x = 0) out over the water, deck at deckY above the water.
export function addJetty(b, length = 26, width = 2.4, deckY = 1.3) {
  for (let x = 0; x <= length; x += 2.6) for (const s of [-1, 1]) {
    b.add('woodDark', new THREE.CylinderGeometry(0.13, 0.15, deckY + 3, 7), { x, y: deckY - (deckY + 3) / 2 + 0.05, z: s * (width / 2 - 0.1), tile: 1.2 });
  }
  for (const s of [-1, 1]) b.box('woodDark', length + 0.4, 0.2, 0.16, { x: length / 2, y: deckY - 0.12, z: s * (width / 2 - 0.1), tile: 1.5 });
  for (let x = 0; x <= length; x += 0.3) b.box('wood', 0.26, 0.06, width, { x, y: deckY, z: (Math.sin(x * 7) * 0.05), tile: 1.5 });
  // T-head with bollards and a ladder down to the water.
  b.box('wood', 3, 0.08, 6, { x: length + 1.4, y: deckY, tile: 2 });
  for (const z of [-2.6, 2.6]) b.add('woodDark', new THREE.CylinderGeometry(0.15, 0.17, 0.6, 8), { x: length + 2.5, y: deckY + 0.3, z, tile: 1 });
  for (const s of [-1, 1]) b.beam('woodDark', [length + 2.8, deckY, s * 0.35], [length + 2.9, -0.8, s * 0.35], 0.08);
  for (let y = -0.5; y < deckY; y += 0.35) b.box('wood', 0.06, 0.05, 0.7, { x: length + 2.85, y, tile: 1 });
}

// Rope from a to b with a little sag.
export function addRope(b, a, c, sag = 0.3) {
  const n = 6;
  let prev = a;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const p = [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (c[2] - a[2]) * t];
    b.beam('rope', prev, p, 0.035, { round: true });
    prev = p;
  }
}
