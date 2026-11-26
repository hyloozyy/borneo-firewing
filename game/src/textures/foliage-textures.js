// Painted foliage: a leaf atlas (four leaf-cluster cells + palm and fern fronds) and a bark atlas
// (pale dipterocarp bark and dark ringed palm/broadleaf bark) with a normal map. All drawn in code.
import { makeCanvas, canvasToTexture, tileFbm, tileNoise, heightToNormalTexture, dataTexture, painterRandom } from './texture-utils.js';

// Atlas layout (u,v ranges) shared with the tree builder.
export const LEAF_CELLS = {
  canopy: [0, 0, 0.25, 0.5], // dense small dark leaves (dipterocarp, canopy trees)
  broad: [0.25, 0, 0.5, 0.5], // big glossy leaves
  young: [0, 0.5, 0.25, 1], // light yellow-green pioneer leaves
  shrub: [0.25, 0.5, 0.5, 1], // understorey: long drooping leaves
  palm: [0.5, 0, 0.75, 1], // pinnate palm frond, base at v=0
  fern: [0.75, 0, 1, 1], // fern frond
};

function hsl(h, s, l, a = 1) {
  return `hsla(${h},${s}%,${l}%,${a})`;
}

// One leaf: pointed ellipse with a gradient, a lighter midrib, faint veins and a glossy side.
function drawLeaf(g, rnd, x, y, ang, len, wid, hue, sat, lit) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  const grad = g.createLinearGradient(0, -wid, 0, wid);
  grad.addColorStop(0, hsl(hue, sat, lit + 9));
  grad.addColorStop(0.45, hsl(hue, sat, lit + 4));
  grad.addColorStop(0.55, hsl(hue + 2, sat - 4, lit - 3));
  grad.addColorStop(1, hsl(hue + 4, sat - 6, lit - 9));
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(len * 0.25, -wid * 1.15, len * 0.7, -wid * 0.9, len, 0);
  g.bezierCurveTo(len * 0.7, wid * 0.9, len * 0.25, wid * 1.15, 0, 0);
  g.fill();
  // Edge darkening for depth.
  g.strokeStyle = hsl(hue, sat, lit - 14, 0.5);
  g.lineWidth = Math.max(0.6, wid * 0.08);
  g.stroke();
  g.strokeStyle = hsl(hue - 6, sat - 15, lit + 16, 0.7);
  g.lineWidth = Math.max(0.5, wid * 0.09);
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(len * 0.5, -wid * 0.06, len * 0.97, 0);
  g.stroke();
  g.strokeStyle = hsl(hue - 4, sat - 10, lit + 10, 0.25);
  g.lineWidth = Math.max(0.4, wid * 0.04);
  for (let i = 1; i < 6; i++) {
    const t = i / 6.5;
    g.beginPath();
    g.moveTo(len * t, 0);
    g.lineTo(len * (t + 0.12), -wid * 0.75 * Math.sin(t * Math.PI));
    g.moveTo(len * t, 0);
    g.lineTo(len * (t + 0.12), wid * 0.75 * Math.sin(t * Math.PI));
    g.stroke();
  }
  // Sun glint on the waxy surface.
  if (rnd() < 0.55) {
    g.fillStyle = `rgba(255,250,215,${0.08 + rnd() * 0.12})`;
    g.beginPath();
    g.ellipse(len * 0.45, -wid * 0.35, len * 0.25, wid * 0.22, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

// A leaf cluster filling a cell: twigs radiate from the centre, leaves painted back to front
// (deep leaves darker) so each card already looks like a lit clump with self-shadowing.
function drawCluster(g, ox, oy, size, opts, seed) {
  const rnd = painterRandom(seed);
  const cx = ox + size / 2, cy = oy + size / 2;
  g.save();
  g.beginPath();
  g.rect(ox + 3, oy + 3, size - 6, size - 6);
  g.clip();
  g.strokeStyle = 'rgba(70,52,36,0.9)';
  g.lineCap = 'round';
  const twigs = [];
  for (let i = 0; i < opts.twigs; i++) {
    const a = (i / opts.twigs) * Math.PI * 2 + rnd() * 0.5;
    const l = size * (0.28 + rnd() * 0.16);
    twigs.push({ a, l });
    g.lineWidth = size * 0.012;
    g.beginPath();
    g.moveTo(cx, cy);
    g.quadraticCurveTo(cx + Math.cos(a + 0.3) * l * 0.5, cy + Math.sin(a + 0.3) * l * 0.5, cx + Math.cos(a) * l, cy + Math.sin(a) * l);
    g.stroke();
  }
  const leaves = [];
  for (let i = 0; i < opts.count; i++) {
    const tw = twigs[Math.floor(rnd() * twigs.length)];
    const t = 0.25 + rnd() * 0.75;
    const bx = cx + Math.cos(tw.a) * tw.l * t, by = cy + Math.sin(tw.a) * tw.l * t;
    const ang = tw.a + (rnd() - 0.5) * opts.spread;
    const len = size * opts.len * (0.7 + rnd() * 0.5);
    // Depth: leaves near the cluster centre and the first drawn are deeper (darker).
    const depth = i / opts.count;
    leaves.push({ bx, by, ang, len, depth });
  }
  for (const l of leaves) {
    const lit = opts.light + (l.depth - 0.5) * opts.contrast + (rnd() - 0.5) * 6;
    drawLeaf(g, rnd, l.bx, l.by, l.ang, l.len, l.len * opts.width, opts.hue + (rnd() - 0.5) * opts.hueVar, opts.sat + (rnd() - 0.5) * 10, lit);
  }
  g.restore();
}

// Pinnate frond: a curved rachis with many narrow leaflets on both sides, base at the top edge.
function drawFrond(g, ox, oy, w, h, opts, seed) {
  const rnd = painterRandom(seed);
  const cx = ox + w / 2;
  g.save();
  g.beginPath();
  g.rect(ox + 3, oy + 2, w - 6, h - 4);
  g.clip();
  const n = opts.leaflets;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < n; i++) {
      const t = 0.04 + (i / n) * 0.94;
      const y = oy + t * h;
      const env = Math.sin(Math.min(1, t * 1.25) * Math.PI) * (opts.taper ? 1 - t * 0.35 : 1);
      const len = (w * 0.47) * (0.25 + 0.75 * env) * (0.85 + rnd() * 0.2);
      const a = opts.angle + (rnd() - 0.5) * 0.2;
      const ang = side > 0 ? a : Math.PI - a;
      const lit = opts.light + (rnd() - 0.5) * 10 + (side > 0 ? 3 : -3);
      drawLeaf(g, rnd, cx + side * 2, y, ang, len, len * opts.width, opts.hue + (rnd() - 0.5) * 8, opts.sat, lit);
    }
  }
  g.strokeStyle = opts.rachis;
  g.lineWidth = w * 0.025;
  g.beginPath();
  g.moveTo(cx, oy);
  g.lineTo(cx, oy + h * 0.99);
  g.stroke();
  g.restore();
}

export function buildLeafAtlas(scale = 1) {
  const S = Math.round(512 * scale);
  const c = makeCanvas(S * 4, S * 2);
  const g = c.getContext('2d');
  drawCluster(g, 0, 0, S, { twigs: 7, count: 150, len: 0.13, width: 0.36, spread: 1.6, hue: 100, hueVar: 14, sat: 44, light: 19, contrast: 22 }, 11);
  drawCluster(g, S, 0, S, { twigs: 6, count: 70, len: 0.22, width: 0.34, spread: 1.4, hue: 98, hueVar: 12, sat: 46, light: 21, contrast: 24 }, 23);
  drawCluster(g, 0, S, S, { twigs: 6, count: 95, len: 0.19, width: 0.42, spread: 1.5, hue: 84, hueVar: 12, sat: 52, light: 29, contrast: 22 }, 37);
  drawCluster(g, S, S, S, { twigs: 9, count: 80, len: 0.26, width: 0.2, spread: 0.7, hue: 104, hueVar: 16, sat: 42, light: 22, contrast: 20 }, 41);
  // Fronds are painted horizontally squeezed: leaflets angle toward the tip (down the cell).
  drawFrond(g, S * 2, 0, S, S * 2, { leaflets: 46, angle: 0.75, width: 0.12, hue: 84, sat: 50, light: 32, rachis: 'rgba(150,140,70,1)', taper: true }, 51);
  drawFrond(g, S * 3, 0, S, S * 2, { leaflets: 30, angle: 0.55, width: 0.3, hue: 98, sat: 52, light: 30, rachis: 'rgba(80,90,40,1)', taper: false }, 63);
  return canvasToTexture(c, { bleed: true });
}

// Bark atlas: left half pale grey-brown dipterocarp bark with lichen, right half dark ringed bark.
// Alpha holds the crack mask (used for ember glow on burning trunks).
export function buildBarkTextures(size = 512) {
  const w = size, h = size;
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  const height = new Float32Array(w * h);
  const half = w / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const right = x >= half;
      const u = (x % half) / half, v = y / h;
      const k = (y * w + x) * 4;
      let r, gg, b, hgt, crack;
      if (!right) {
        // Long vertical fissures, flaky plates and pale lichen.
        const f = tileFbm(u, v, 4, 5, 3);
        const fis = Math.abs(tileNoise(u * 14 + tileNoise(u * 4, v * 3, 4, 8) * 2.2, v * 2.5, 14, 9) - 0.5) * 2;
        crack = Math.pow(1 - fis, 6);
        const lichen = Math.max(0, tileFbm(u, v, 6, 4, 21) - 0.52) * 4;
        hgt = f * 0.6 - crack * 0.9;
        const base = 128 + (f - 0.5) * 70 - crack * 70;
        r = base * 1.02; gg = base * 0.97; b = base * 0.86;
        r += lichen * 30; gg += lichen * 42; b += lichen * 26;
      } else {
        // Dark furrowed bark with horizontal growth rings (also reads as palm trunk rings).
        const f = tileFbm(u, v, 5, 5, 31);
        const ring = Math.pow(Math.abs(Math.sin(v * Math.PI * 10 + tileNoise(u * 4, v * 8, 4, 33) * 1.5)), 10);
        const fur = Math.pow(Math.abs(tileNoise(u * 10, v * 1.2 + f, 10, 35) - 0.5) * 2, 0.5);
        crack = Math.max(ring, (1 - fur) * 0.8);
        hgt = f * 0.5 + fur * 0.5 - ring * 0.6;
        const base = 70 + f * 60 + fur * 30 - ring * 40;
        r = base * 1.08; gg = base * 0.9; b = base * 0.72;
      }
      img.data[k] = Math.max(0, Math.min(255, r));
      img.data[k + 1] = Math.max(0, Math.min(255, gg));
      img.data[k + 2] = Math.max(0, Math.min(255, b));
      img.data[k + 3] = Math.max(0, Math.min(255, crack * 255));
      height[y * w + x] = hgt;
    }
  }
  const map = dataTexture(new Uint8Array(img.data.buffer.slice(0)), w, h, { srgb: true });
  const normalMap = heightToNormalTexture(height, w, h, 6);
  return { map, normalMap };
}
