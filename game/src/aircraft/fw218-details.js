// Close-up detail for the FW-218, laid onto the real hull surface: framed glass windscreen and
// windows that reflect the sky, raised door, hatches and access panels painted in the livery
// (they share the hull's UVs, so the paint runs across them), seams around them, wipers,
// nav-light lenses, landing lights, a textured wing skin with panel lines and exhaust soot, and a
// motion-blurred propeller disc.
import * as THREE from 'three';
import { hullPoint } from './fw218-model.js';
import { makeCanvas, heightToNormalTexture } from '../textures/texture-utils.js';

const TAU = Math.PI * 2;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3();

// Outward normal of the hull skin at (t, th), from finite differences.
function hullNormal(t, th, out) {
  hullPoint(t, th, _c);
  hullPoint(Math.min(1, t + 0.002), th, _a).sub(_c);
  hullPoint(t, th + 0.004, _b).sub(_c);
  out.crossVectors(_b, _a).normalize();
  // Make sure it points away from the hull's centre line.
  const cx = 0, cy = 0.2;
  if (out.x * (_c.x - cx) + out.y * (_c.y - cy) < 0) out.negate();
  return out;
}

// A patch of skin between stations t0..t1 and angles th0..th1, lifted `off` metres off the hull.
// Corners can be rounded (`round`, as a share of the patch size). UVs follow the hull's own UVs
// (t, th / 2PI) so the livery texture lines up, or the patch's own 0..1 when `ownUV` is set.
export function hullPatch(t0, t1, th0, th1, off, { nu = 8, nv = 8, round = 0, ownUV = false } = {}) {
  const pos = [], uv = [], nor = [], idx = [];
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i <= nu; i++) {
    for (let j = 0; j <= nv; j++) {
      let u = i / nu, v = j / nv;
      // Rounded corners: pull the corner samples in along the diagonal.
      if (round > 0) {
        const du = Math.max(0, Math.abs(u - 0.5) * 2 - (1 - round * 2)) / (round * 2);
        const dv = Math.max(0, Math.abs(v - 0.5) * 2 - (1 - round * 2)) / (round * 2);
        const r = Math.hypot(du, dv);
        if (r > 1) {
          const k = 1 / r;
          u = 0.5 + Math.sign(u - 0.5) * ((1 - round * 2) + round * 2 * du * k) / 2;
          v = 0.5 + Math.sign(v - 0.5) * ((1 - round * 2) + round * 2 * dv * k) / 2;
        }
      }
      const t = t0 + (t1 - t0) * u, th = th0 + (th1 - th0) * v;
      hullPoint(t, th, p);
      hullNormal(t, th, n);
      p.addScaledVector(n, off);
      pos.push(p.x, p.y, p.z);
      nor.push(n.x, n.y, n.z);
      const thw = ((th % TAU) + TAU) % TAU;
      uv.push(...(ownUV ? [u, v] : [t, thw / TAU]));
    }
  }
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = i * (nv + 1) + j, b = a + nv + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  // Wind the triangles so their front faces look outward.
  const P = (k) => new THREE.Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
  const face = new THREE.Vector3().crossVectors(P(idx[1]).sub(P(idx[0])), P(idx[2]).sub(P(idx[0])));
  if (face.dot(new THREE.Vector3(nor[0], nor[1], nor[2])) < 0) for (let k = 0; k < idx.length; k += 3) [idx[k + 1], idx[k + 2]] = [idx[k + 2], idx[k + 1]];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// The window layout on the right side, [t0, t1, th0, th1, cornerRound]; mirrored for the left.
const WINDOWS = [
  [0.071, 0.111, 0.05, 0.43, 0.12], // windscreen, centre pane
  [0.079, 0.119, 0.49, 0.86, 0.14], // windscreen, corner pane
  [0.126, 0.166, 0.66, 1.02, 0.16], // sliding side window
  [0.171, 0.193, 0.70, 0.98, 0.2], // rear cockpit window
  [0.292, 0.31, 0.92, 1.12, 0.45], // cabin windows
  [0.342, 0.36, 0.92, 1.12, 0.45],
];
// Raised skin panels: [t0, t1, th0, th1, round, lift] (door, hatches, access panels).
const PANELS = [
  [0.428, 0.49, 0.78, 1.5, 0.08, 0.016], // crew/cargo door
  [0.215, 0.25, -0.26, 0.26, 0.15, 0.012], // roof escape hatch (centre)
  [0.135, 0.175, 1.6, 1.95, 0.1, 0.01], // avionics bay access
  [0.70, 0.73, 1.2, 1.45, 0.12, 0.01], // tail service panel
  [0.05, 0.068, 1.75, 2.05, 0.2, 0.008], // nose-gear inspection panel
];

export function addHullDetail(model, hullMaterial, mats) {
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x15181b, roughness: 0.55, metalness: 0.3 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x16303f, roughness: 0.03, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.03,
    envMapIntensity: 2.6, specularIntensity: 1, ior: 1.52, reflectivity: 0.6,
  });
  const seamMat = new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.8 });
  const added = [];
  const put = (g, m) => { const mesh = new THREE.Mesh(g, m); mesh.castShadow = false; model.add(mesh); added.push(mesh); return mesh; };
  for (const side of [1, -1]) {
    const mirror = (a, b) => (side > 0 ? [a, b] : [TAU - b, TAU - a]);
    for (const [t0, t1, a, b, r] of WINDOWS) {
      const [th0, th1] = mirror(a, b);
      const dt = 0.0022, dth = 0.02;
      put(hullPatch(t0 - dt, t1 + dt, th0 - dth, th1 + dth, 0.012, { round: r, nu: 6, nv: 6 }), frameMat);
      put(hullPatch(t0, t1, th0, th1, 0.03, { round: r, nu: 6, nv: 6, ownUV: true }), glass);
    }
    for (const [t0, t1, a, b, r, lift] of PANELS) {
      if (a < 0 && side < 0) continue; // the roof hatch spans both sides already
      const [th0, th1] = a < 0 ? [TAU + a, TAU + b] : mirror(a, b);
      put(hullPatch(t0 - 0.0016, t1 + 0.0016, th0 - 0.012, th1 + 0.012, lift * 0.45, { round: r, nu: 6, nv: 10 }), seamMat);
      put(hullPatch(t0, t1, th0, th1, lift, { round: r, nu: 8, nv: 12 }), hullMaterial);
    }
    // Door handle and a small window in the door.
    const [dh0, dh1] = mirror(0.98, 1.1);
    put(hullPatch(0.474, 0.484, dh0, dh1, 0.03, { nu: 2, nv: 3 }), mats.dark);
    const [dw0, dw1] = mirror(0.86, 1.0);
    put(hullPatch(0.44, 0.458, dw0, dw1, 0.024, { round: 0.45, nu: 6, nv: 6, ownUV: true }), glass);
  }
  return added;
}

// Wing / tailplane skin: white with spar and rib seams, rivet rows, an erosion strip along the
// leading edge, walkway pads by the root and soot trailing from each engine's exhaust.
// u runs along the span (-halfSpan..halfSpan), v along the chord (0 leading edge .. 1 trailing).
export function buildWingSkin(halfSpan, chord, { exhaustX = [], hi = true } = {}) {
  const w = hi ? 2048 : 1024, h = hi ? 256 : 128;
  const c = makeCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true });
  const hc = makeCanvas(w, h), hg = hc.getContext('2d', { willReadFrequently: true });
  const X = (x) => ((x + halfSpan) / (halfSpan * 2)) * w;
  const V = (v) => v * h;
  g.fillStyle = '#f1f1ed'; g.fillRect(0, 0, w, h);
  hg.fillStyle = '#808080'; hg.fillRect(0, 0, w, h);
  // Leading-edge erosion strip, slightly grey and metallic.
  const le = g.createLinearGradient(0, 0, 0, V(0.14));
  le.addColorStop(0, '#c9ccd0'); le.addColorStop(0.85, '#d9dbdc'); le.addColorStop(1, '#f1f1ed');
  g.fillStyle = le; g.fillRect(0, 0, w, V(0.14));
  // Walkway pads either side of the hull.
  g.fillStyle = 'rgba(70,74,80,0.18)';
  for (const s of [-1, 1]) g.fillRect(Math.min(X(s * 1.4), X(s * 3.2)), V(0.3), Math.abs(X(3.2) - X(1.4)), V(0.38));
  g.strokeStyle = 'rgba(200,16,46,0.55)'; g.lineWidth = 1.5;
  for (const s of [-1, 1]) g.strokeRect(Math.min(X(s * 1.4), X(s * 3.2)), V(0.3), Math.abs(X(3.2) - X(1.4)), V(0.38));
  // Exhaust soot: dark, streaky, fading toward the trailing edge.
  for (const ex of exhaustX) {
    for (let k = 0; k < 26; k++) {
      const x = X(ex) + (Math.random() - 0.5) * (w / halfSpan) * 0.55;
      const grd = g.createLinearGradient(0, V(0.5), 0, h);
      const a = 0.05 + Math.random() * 0.07;
      grd.addColorStop(0, `rgba(40,34,30,0)`); grd.addColorStop(0.2, `rgba(40,34,30,${a})`); grd.addColorStop(1, `rgba(40,34,30,${a * 0.4})`);
      g.fillStyle = grd; g.fillRect(x, V(0.5), 2 + Math.random() * 5, h);
    }
  }
  // Seams + rivets, drawn on the colour (faint) and the height map (pressed in).
  const seam = (x0, y0, x1, y1) => {
    for (const [ctx, col, lw] of [[g, 'rgba(60,62,70,0.32)', 1.4], [hg, '#3a3a3a', 2.2]]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
  };
  const rivets = (x0, y0, x1, y1, step) => {
    const len = Math.hypot(x1 - x0, y1 - y0), n = Math.floor(len / step);
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
      g.fillStyle = 'rgba(70,72,78,0.35)'; g.fillRect(x - 0.6, y - 0.6, 1.4, 1.4);
      hg.fillStyle = '#c8c8c8'; hg.beginPath(); hg.arc(x, y, 1.3, 0, TAU); hg.fill();
    }
  };
  for (const v of [0.14, 0.32, 0.7]) { seam(0, V(v), w, V(v)); rivets(0, V(v) + 3, w, V(v) + 3, 7); }
  for (let x = -halfSpan + 0.9; x < halfSpan; x += 1.15) {
    seam(X(x), V(0.14), X(x), h); rivets(X(x) + 3, V(0.14), X(x) + 3, h, 6);
  }
  // Tiny warning stencils by the walkway.
  g.fillStyle = 'rgba(30,30,34,0.8)'; g.font = `700 ${Math.round(h * 0.07)}px "JetBrains Mono", monospace`;
  for (const s of [-1, 1]) g.fillText('NO STEP', X(s * 5.2) - 30, V(0.24));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const img = hg.getImageData(0, 0, w, h).data, height = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) height[i] = img[i * 4] / 255;
  const normalMap = heightToNormalTexture(height, w, h, 1.4);
  normalMap.wrapS = normalMap.wrapT = THREE.ClampToEdgeWrapping;
  return { map: tex, normalMap };
}

// Planar UVs for a wing-like part: u along X over [-halfSpan, halfSpan], v along Z over the chord.
export function wingUV(geometry, x0, x1, z0, z1) {
  const p = geometry.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = (p.getX(i) - x0) / (x1 - x0);
    uv[i * 2 + 1] = 1 - (p.getZ(i) - z0) / (z1 - z0);
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}

// Propeller disc as a camera would catch it at full power: four smeared blade arcs (dense at the
// hub, thinning at the tips), a faint yellow tip ring and a near-clear gap between the blades.
export function propBlurTexture() {
  const S = 256, c = makeCanvas(S, S), g = c.getContext('2d');
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (x + 0.5) / S * 2 - 1, dy = (y + 0.5) / S * 2 - 1;
      const r = Math.hypot(dx, dy), i = (y * S + x) * 4;
      if (r > 1 || r < 0.13) { img.data[i + 3] = 0; continue; }
      const a = Math.atan2(dy, dx);
      // Distance to the nearest of four blades, smeared more toward the tip (faster there).
      const ph = ((a / (Math.PI / 2)) % 1 + 1) % 1;
      const d = Math.min(ph, 1 - ph);
      const smear = 0.06 + r * 0.22;
      const blade = Math.exp(-(d * d) / (smear * smear));
      const trail = ph < 0.5 ? Math.exp(-ph / (0.12 + r * 0.25)) * 0.5 : 0;
      let alpha = 0.06 + 0.42 * Math.max(blade, trail) * (1.05 - r * 0.45);
      let R = 34, G = 35, B = 38;
      if (r > 0.9) { const k = Math.min(1, (r - 0.9) / 0.04) * Math.min(1, (1 - r) / 0.03); R = 240; G = 196; B = 40; alpha = Math.max(alpha * 0.5, 0.22 * k * (0.3 + blade)); }
      img.data[i] = R; img.data[i + 1] = G; img.data[i + 2] = B; img.data[i + 3] = Math.round(Math.min(1, alpha) * 255);
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Engine cowling skin for the lathe-turned nacelles (u around the nacelle, 0 = underside, 0.25 =
// right side, 0.5 = top; v from the intake lip to the tail cone): red paint, cowl seams and
// latches, cooling louvres, rivet rows and the soot the exhaust leaves along the outboard flank.
export function buildNacelleSkin(hi = true) {
  const w = hi ? 1024 : 512, h = hi ? 1024 : 512, k = w / 512;
  const c = makeCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true });
  const hc = makeCanvas(w, h), hg = hc.getContext('2d', { willReadFrequently: true });
  g.scale(k, k); hg.scale(k, k);
  const Y = (v) => (1 - v) * 512; // canvas top is the tail end (flipY)
  const zv = (z) => (z + 5.15) / 7.75;
  g.fillStyle = '#c8102e'; g.fillRect(0, 0, 512, 512);
  hg.fillStyle = '#808080'; hg.fillRect(0, 0, 512, 512);
  const line = (x0, y0, x1, y1) => {
    g.strokeStyle = 'rgba(40,0,6,0.45)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    hg.strokeStyle = '#303030'; hg.lineWidth = 1.6; hg.beginPath(); hg.moveTo(x0, y0); hg.lineTo(x1, y1); hg.stroke();
  };
  // Cowl stations and the hinge lines of the side cowls.
  for (const z of [-4.6, -3.4, -1.0, 0.6, 1.6]) line(0, Y(zv(z)), 512, Y(zv(z)));
  for (const u of [0.07, 0.43, 0.57, 0.93]) line(u * 512, Y(zv(-4.6)), u * 512, Y(zv(0.6)));
  // Rivet rows along the stations.
  for (const z of [-4.6, -3.4, -1.0, 0.6]) {
    for (let x = 2; x < 512; x += 6) {
      g.fillStyle = 'rgba(60,0,10,0.35)'; g.fillRect(x, Y(zv(z)) + 3, 1.1, 1.1);
      hg.fillStyle = '#c0c0c0'; hg.fillRect(x, Y(zv(z)) + 3, 1.4, 1.4);
    }
  }
  // Latches on the side cowls.
  for (const u of [0.2, 0.3, 0.7, 0.8]) {
    g.fillStyle = 'rgba(30,30,34,0.85)'; g.fillRect(u * 512 - 5, Y(zv(-2.0)), 10, 3);
    hg.fillStyle = '#d0d0d0'; hg.fillRect(u * 512 - 5, Y(zv(-2.0)), 10, 3);
  }
  // Cooling louvres on the upper flanks.
  for (const u0 of [0.36, 0.6]) {
    for (let i = 0; i < 7; i++) {
      const y = Y(zv(-3.2 + i * 0.22));
      g.fillStyle = 'rgba(20,4,6,0.75)'; g.fillRect(u0 * 512, y, 22, 2.2);
      hg.fillStyle = '#202020'; hg.fillRect(u0 * 512, y, 22, 2.2);
      hg.fillStyle = '#c8c8c8'; hg.fillRect(u0 * 512, y - 2, 22, 1.4);
    }
  }
  // Exhaust soot on both flanks (one of them is outboard on each engine).
  for (const u of [0.25, 0.75]) {
    for (let i = 0; i < 30; i++) {
      const x = u * 512 + (Math.random() - 0.5) * 46;
      const grd = g.createLinearGradient(0, Y(zv(-2.0)), 0, Y(zv(1.4)));
      const a = 0.06 + Math.random() * 0.1;
      grd.addColorStop(0, `rgba(25,18,16,${a})`); grd.addColorStop(1, 'rgba(25,18,16,0)');
      g.fillStyle = grd; g.fillRect(x, Y(zv(1.4)), 2 + Math.random() * 4, Y(zv(-2.0)) - Y(zv(1.4)));
    }
  }
  // A white engine number placard on each flank.
  g.fillStyle = '#f2f2ee'; g.fillRect(0.25 * 512 - 9, Y(zv(-3.9)) - 6, 18, 12); g.fillRect(0.75 * 512 - 9, Y(zv(-3.9)) - 6, 18, 12);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const img = hg.getImageData(0, 0, w, h).data, height = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) height[i] = img[i * 4] / 255;
  return { map: tex, normalMap: heightToNormalTexture(height, w, h, 1.2) };
}
