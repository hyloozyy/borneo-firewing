// Windscreen glass as a living surface: faint sky and instrument-glow reflections, edge grime,
// soot that builds up while flying through smoke, spray droplets from scooping that streak up and
// out in the slipstream, and a crack pattern after a bird strike.
import * as THREE from 'three';

const W = 512, H = 256;

export class Windscreen {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.material = new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    this.base = this.bakeBase();
    this.drops = [];
    this.soot = 0;
    this.crack = null;
    this.frame = 0;
  }

  bakeBase() {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    // Sky reflection: a soft bright band near the top of the glass.
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, 'rgba(210,225,240,0.10)');
    sky.addColorStop(0.35, 'rgba(210,225,240,0.03)');
    sky.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    // Warm reflections of the lit instruments low on the glass.
    for (const [x, w] of [[0.2, 0.22], [0.44, 0.12], [0.62, 0.2]]) {
      const r = g.createRadialGradient(x * W, H * 1.02, 4, x * W, H * 1.02, w * W);
      r.addColorStop(0, 'rgba(255,190,120,0.14)');
      r.addColorStop(1, 'rgba(255,190,120,0)');
      g.fillStyle = r; g.fillRect(0, 0, W, H);
    }
    // Grime and dried water spots, heavier toward the frame.
    for (let i = 0; i < 1400; i++) {
      const x = Math.random() * W, y = Math.random() * H;
      const edge = Math.min(x, W - x, y * 1.5, H - y) / 60;
      if (Math.random() < edge) continue;
      g.fillStyle = `rgba(200,190,170,${0.03 + Math.random() * 0.06})`;
      g.beginPath(); g.arc(x, y, Math.random() * 2.2 + 0.4, 0, Math.PI * 2); g.fill();
    }
    // Wiper arc smears
    g.strokeStyle = 'rgba(220,210,190,0.05)'; g.lineWidth = 2;
    for (const cx of [0.27, 0.73]) for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(cx * W, H * 1.05, H * (0.55 + k * 0.06), Math.PI * 1.2, Math.PI * 1.8); g.stroke(); }
    return c;
  }

  // Splash a burst of droplets (scooping spray, water drop mist).
  splash(n) {
    for (let i = 0; i < n && this.drops.length < 260; i++) {
      this.drops.push({ x: Math.random() * W, y: H * (0.25 + Math.random() * 0.75), r: 1.2 + Math.random() ** 2 * 5, life: 3 + Math.random() * 5 });
    }
  }

  update(s, dt) {
    const d = s.damage;
    this.soot = Math.min(0.55, Math.max(0, this.soot + (s.turbulence * 0.04 - (s.scooping ? 0.08 : 0.004)) * dt));
    if (s.scooping) this.splash(Math.ceil(dt * 60));
    if (d.windscreen > 0.05 && !this.crack) this.crack = makeCrack();
    // Slipstream: drops run up and outward from the centre line, faster with airspeed.
    const v = Math.min(1, s.airspeed / 50);
    for (const p of this.drops) {
      p.y -= v * dt * (40 + p.r * 18);
      p.x += (p.x < W / 2 ? -1 : 1) * v * dt * 12;
      p.life -= dt;
    }
    this.drops = this.drops.filter((p) => p.life > 0 && p.y > -10);
    if (++this.frame % 3 && dt > 0) return;
    this.redraw();
  }

  redraw() {
    const g = this.canvas.getContext('2d');
    g.clearRect(0, 0, W, H);
    if (this.soot > 0.01) {
      const sg = g.createLinearGradient(0, H, 0, 0);
      sg.addColorStop(0, `rgba(60,44,30,${this.soot})`);
      sg.addColorStop(1, `rgba(60,44,30,${this.soot * 0.45})`);
      g.fillStyle = sg; g.fillRect(0, 0, W, H);
    }
    g.drawImage(this.base, 0, 0);
    for (const p of this.drops) {
      const a = Math.min(1, p.life);
      g.fillStyle = `rgba(20,30,40,${0.35 * a})`;
      g.beginPath(); g.ellipse(p.x, p.y, p.r, p.r * 1.25, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = `rgba(255,255,255,${0.55 * a})`;
      g.beginPath(); g.arc(p.x - p.r * 0.3, p.y - p.r * 0.35, p.r * 0.35, 0, Math.PI * 2); g.fill();
      if (p.r > 3) { g.strokeStyle = `rgba(230,240,255,${0.12 * a})`; g.lineWidth = p.r * 0.6; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x, p.y + p.r * 6); g.stroke(); }
    }
    if (this.crack) {
      g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1.2;
      for (const line of this.crack) { g.beginPath(); line.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath(); g.arc(this.crack[0][0][0], this.crack[0][0][1], 7, 0, Math.PI * 2); g.fill();
    }
    this.texture.needsUpdate = true;
  }
}

function makeCrack() {
  const cx = W * (0.62 + Math.random() * 0.2), cy = H * (0.3 + Math.random() * 0.3);
  const lines = [];
  for (let i = 0; i < 11; i++) {
    let a = (i / 11) * Math.PI * 2 + Math.random() * 0.4, x = cx, y = cy;
    const pts = [[x, y]];
    const n = 4 + Math.floor(Math.random() * 5);
    for (let k = 0; k < n; k++) { a += (Math.random() - 0.5) * 0.7; x += Math.cos(a) * 18; y += Math.sin(a) * 18; pts.push([x, y]); }
    lines.push(pts);
  }
  for (const rr of [16, 34]) {
    const ring = [];
    for (let k = 0; k <= 12; k++) { const a = (k / 12) * Math.PI * 2; ring.push([cx + Math.cos(a) * rr * (0.8 + Math.random() * 0.4), cy + Math.sin(a) * rr * (0.8 + Math.random() * 0.4)]); }
    lines.push(ring);
  }
  return lines;
}
