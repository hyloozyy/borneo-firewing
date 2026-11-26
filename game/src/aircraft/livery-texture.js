// FW-218 Enggang livery painted on a canvas: white over red, cheat line, FIRE FIGHTER titles,
// the flame-and-pines emblem, 218, the red-white flag and the cockpit glazing.
import * as THREE from 'three';
import { makeCanvas } from '../core/canvas-textures.js';
import { heightToNormalTexture, dataTexture } from '../textures/texture-utils.js';

const W = 2048, H = 1024;
// Canvas x = t (nose 0 -> tail 1). Canvas y = v around the hull: 0 top, 0.25 right, 0.5 keel, 0.75 left.

export function drawEmblem(g, cx, cy, s, flame = '#ffffff', bg = null) {
  g.save();
  g.translate(cx, cy);
  g.scale(s, s);
  if (bg) { g.fillStyle = bg; g.fillRect(-60, -60, 120, 120); }
  g.fillStyle = flame;
  // Three-tongued flame
  g.beginPath();
  g.moveTo(-46, 30);
  g.bezierCurveTo(-58, 0, -36, -20, -30, -40);
  g.bezierCurveTo(-20, -24, -14, -18, -12, -8);
  g.bezierCurveTo(-10, -30, 0, -46, 6, -58);
  g.bezierCurveTo(10, -36, 20, -24, 18, -10);
  g.bezierCurveTo(26, -18, 30, -30, 34, -36);
  g.bezierCurveTo(52, -10, 56, 10, 46, 30);
  g.closePath();
  g.fill();
  // Pine trees cut out of the flame
  g.fillStyle = bg || '#c8102e';
  for (const [x, h] of [[-22, 34], [0, 46], [22, 34]]) {
    g.beginPath();
    g.moveTo(x, 30 - h);
    g.lineTo(x - h * 0.36, 30);
    g.lineTo(x + h * 0.36, 30);
    g.closePath();
    g.fill();
  }
  g.fillStyle = flame;
  g.fillRect(-52, 32, 104, 5);
  g.restore();
}

// Draw something on one side of the hull, so it reads correctly from outside.
function onSide(g, side, t, phi, fn) {
  // phi: angle from the top (0) down to the keel (PI); 0.5*PI is the waist line.
  const x = t * W;
  const yRight = (phi / (Math.PI * 2)) * H;
  g.save();
  if (side === 'right') {
    g.translate(x, yRight);
    g.scale(-1, 1);
  } else {
    g.translate(x, H - yRight);
    g.scale(1, -1);
  }
  fn(g);
  g.restore();
}

export function buildLiveryTexture() {
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const red = '#c8102e';
  const yOf = (phi) => (phi / (Math.PI * 2)) * H;
  g.fillStyle = '#f4f4f1';
  g.fillRect(0, 0, W, H);

  // Red lower hull, sweeping up at the nose; mirrored for both sides.
  for (let px = 0; px < W; px += 2) {
    const t = px / W;
    const sweep = Math.max(0, 1 - t / 0.22);
    const tailLift = Math.max(0, (t - 0.82) / 0.18);
    const boundary = Math.PI * (0.4 - 0.1 * sweep * sweep + 0.06 * tailLift);
    // right side: y from boundary to keel (PI); left side mirrored around keel
    const y0 = yOf(boundary), y1 = yOf(Math.PI * 2 - boundary);
    g.fillStyle = red;
    g.fillRect(px, y0, 2, y1 - y0);
    // White cheat line inside the red, and a thin red pinstripe above
    const s0 = yOf(boundary + 0.06 * Math.PI), s1 = yOf(boundary + 0.075 * Math.PI);
    g.fillStyle = '#f4f4f1';
    g.fillRect(px, s0, 2, s1 - s0);
    g.fillRect(px, H - s1, 2, s1 - s0);
  }
  // Panel lines
  g.strokeStyle = 'rgba(60,60,70,0.25)';
  g.lineWidth = 2;
  for (const t of [0.2, 0.3, 0.42, 0.55, 0.66, 0.78, 0.9]) {
    g.beginPath(); g.moveTo(t * W, 0); g.lineTo(t * W, H); g.stroke();
  }
  g.beginPath(); g.moveTo(0, yOf(0.25 * Math.PI)); g.lineTo(W, yOf(0.25 * Math.PI)); g.stroke();
  g.beginPath(); g.moveTo(0, H - yOf(0.25 * Math.PI)); g.lineTo(W, H - yOf(0.25 * Math.PI)); g.stroke();

  // Cockpit windscreen: four dark panes over the nose top, two per side.
  const glass = (gg, w, h) => {
    const grad = gg.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#0d1a26');
    grad.addColorStop(0.5, '#28465c');
    grad.addColorStop(1, '#0a121a');
    gg.fillStyle = grad;
    gg.fillRect(0, 0, w, h);
    gg.strokeStyle = '#d9dbd8';
    gg.lineWidth = 5;
    gg.strokeRect(0, 0, w, h);
  };
  for (const side of ['right', 'left']) {
    onSide(g, side, 0.078, 0.03 * Math.PI, (gg) => { glass(gg, -58, 62); });
    onSide(g, side, 0.078, 0.15 * Math.PI, (gg) => { glass(gg, -58, 62); });
    // Side cockpit windows: a big sliding pane and a smaller rear one.
    onSide(g, side, 0.142, 0.2 * Math.PI, (gg) => { glass(gg, -78, 58); });
    onSide(g, side, 0.168, 0.21 * Math.PI, (gg) => { glass(gg, -40, 50); });
    // Cabin windows and observation bubble
    for (const t of [0.29, 0.34]) onSide(g, side, t, 0.3 * Math.PI, (gg) => { glass(gg, -24, 30); });
    // Door
    onSide(g, side, 0.4, 0.27 * Math.PI, (gg) => {
      gg.strokeStyle = '#7d8086'; gg.lineWidth = 4; gg.strokeRect(-70, 0, 60, 150);
      gg.fillStyle = '#9aa0a6'; gg.fillRect(-26, 70, 10, 4);
    });
    // FIRE FIGHTER titles with slash marks
    onSide(g, side, side === 'right' ? 0.84 : 0.52, 0.3 * Math.PI, (gg) => {
      gg.fillStyle = '#121a2c';
      gg.font = 'italic 900 84px Arial, sans-serif';
      gg.textAlign = 'left';
      gg.textBaseline = 'middle';
      gg.fillStyle = red;
      for (let i = 0; i < 3; i++) {
        gg.beginPath();
        gg.moveTo(i * 14, 22); gg.lineTo(i * 14 + 8, 22); gg.lineTo(i * 14 + 20, -22); gg.lineTo(i * 14 + 12, -22);
        gg.fill();
      }
      gg.fillStyle = '#121a2c';
      gg.fillText('FIRE FIGHTER', 52, 2);
      const tw = gg.measureText('FIRE FIGHTER').width;
      gg.fillStyle = red;
      for (let i = 0; i < 3; i++) {
        const x0 = 62 + tw + i * 14;
        gg.beginPath();
        gg.moveTo(x0, 22); gg.lineTo(x0 + 8, 22); gg.lineTo(x0 + 20, -22); gg.lineTo(x0 + 12, -22);
        gg.fill();
      }
    });
    // Nose number 218 in white on the red
    onSide(g, side, 0.115, 0.43 * Math.PI, (gg) => {
      gg.fillStyle = '#ffffff';
      gg.font = '900 58px Arial, sans-serif';
      gg.textAlign = 'center';
      gg.textBaseline = 'middle';
      gg.fillText('218', 0, 0);
    });
    // Nose emblem on the red
    onSide(g, side, 0.22, 0.5 * Math.PI, (gg) => drawEmblem(gg, 0, 0, 0.8, '#ffffff', null));
    // Small red-white flag behind the cockpit
    onSide(g, side, 0.19, 0.25 * Math.PI, (gg) => {
      gg.fillStyle = red; gg.fillRect(0, 0, 46, 15);
      gg.fillStyle = '#ffffff'; gg.fillRect(0, 15, 46, 15);
      gg.strokeStyle = '#888'; gg.lineWidth = 1; gg.strokeRect(0, 0, 46, 30);
    });
    // Belly scoop probe and water door outline
    onSide(g, side, 0.4, 0.86 * Math.PI, (gg) => {
      gg.strokeStyle = 'rgba(40,0,0,0.5)'; gg.lineWidth = 3; gg.strokeRect(-200, -12, 200, 24);
    });
  }
  // Small registration under the tail
  onSide(g, 'left', 0.86, 0.33 * Math.PI, (gg) => { gg.fillStyle = '#333'; gg.font = 'bold 26px Arial'; gg.fillText('PK-FWE', 0, 0); });
  onSide(g, 'right', 0.86, 0.33 * Math.PI, (gg) => { gg.fillStyle = '#333'; gg.font = 'bold 26px Arial'; gg.fillText('PK-FWE', -120, 0); });

  drawPanelLines(g, 0.16);
  // Soft grime along the waterline and exhaust staining, so the paint looks used.
  const grime = g.createLinearGradient(0, H * 0.4, 0, H * 0.5);
  grime.addColorStop(0, 'rgba(60,40,30,0)');
  grime.addColorStop(1, 'rgba(60,40,30,0.12)');
  g.fillStyle = grime;
  g.fillRect(0, H * 0.4, W, H * 0.2);
  const tex = new THREE.CanvasTexture(c);
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Tail fin artwork: red fin with a white band and the big emblem.
export function buildFinTexture() {
  const c = makeCanvas(512, 512);
  const g = c.getContext('2d');
  g.fillStyle = '#c8102e';
  g.fillRect(0, 0, 512, 512);
  g.fillStyle = '#f4f4f1';
  g.fillRect(0, 380, 512, 132);
  drawEmblem(g, 205, 215, 1.45, '#ffffff', null);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Skin panel seams (stations along the hull and stringer lines around it) with rivet rows.
function drawPanelLines(g, alpha) {
  g.save();
  g.strokeStyle = `rgba(30,30,35,${alpha})`;
  g.fillStyle = `rgba(30,30,35,${alpha * 1.4})`;
  g.lineWidth = 1.6;
  const stations = [];
  for (let t = 0.07; t < 0.98; t += 0.055 + (Math.sin(t * 40) * 0.01)) stations.push(t * W);
  for (const x of stations) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
    for (let y = 4; y < H; y += 11) { g.beginPath(); g.arc(x + 5, y, 1.1, 0, Math.PI * 2); g.fill(); }
  }
  for (const f of [0.12, 0.25, 0.37, 0.63, 0.75, 0.88]) {
    const y = f * H;
    g.beginPath(); g.moveTo(W * 0.06, y); g.lineTo(W, y); g.stroke();
    for (let x = W * 0.06; x < W; x += 12) { g.beginPath(); g.arc(x, y + 5, 1.0, 0, Math.PI * 2); g.fill(); }
  }
  g.restore();
}

// Matching normal map (seams pressed in, rivet heads raised) and a roughness map with wear.
export function buildHullDetailMaps() {
  const w = 1024, h = 512;
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, w, h);
  g.scale(w / W, h / H);
  g.lineWidth = 3;
  g.strokeStyle = '#303030';
  g.fillStyle = '#d0d0d0';
  for (let t = 0.07; t < 0.98; t += 0.055 + (Math.sin(t * 40) * 0.01)) {
    const x = t * W;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
    for (let y = 4; y < H; y += 11) { g.beginPath(); g.arc(x + 5, y, 2.2, 0, Math.PI * 2); g.fill(); }
  }
  for (const f of [0.12, 0.25, 0.37, 0.63, 0.75, 0.88]) {
    g.beginPath(); g.moveTo(W * 0.06, f * H); g.lineTo(W, f * H); g.stroke();
  }
  const img = g.getImageData(0, 0, w, h).data;
  const height = new Float32Array(w * h);
  const rough = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    height[i] = img[i * 4] / 255;
    const x = i % w, y = Math.floor(i / w);
    const n = Math.sin(x * 0.05) * Math.sin(y * 0.09 + x * 0.013) * 0.5 + 0.5;
    const r = 120 + n * 40 + (Math.sin(x * 1.7 + y * 3.1) * 0.5 + 0.5) * 12;
    rough[i * 4] = rough[i * 4 + 1] = rough[i * 4 + 2] = r;
    rough[i * 4 + 3] = 255;
  }
  return { normalMap: heightToNormalTexture(height, w, h, 1.2), roughnessMap: dataTexture(rough, w, h, { srgb: false }) };
}
