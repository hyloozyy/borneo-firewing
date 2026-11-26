// Cockpit interior seen from the captain's seat: glareshield, window posts, yokes, throttle quadrant
// and a lit instrument panel (attitude, airspeed, altimeter, heading, VSI, fuel, water, engines).
import * as THREE from 'three';
import { makeCanvas } from '../core/canvas-textures.js';

export const EYE = new THREE.Vector3(-0.55, 1.4, -7.3);

export function buildCockpit() {
  const group = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.8 });
  const frame = new THREE.MeshStandardMaterial({ color: 0x6c7277, roughness: 0.55 });
  const panelCanvas = makeCanvas(1024, 384);
  const panelTex = new THREE.CanvasTexture(panelCanvas);
  panelTex.colorSpace = THREE.SRGBColorSpace;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.79), new THREE.MeshBasicMaterial({ map: panelTex, toneMapped: false }));
  panel.position.set(0, 0.62, -8.4);
  panel.rotation.x = -0.32;
  group.add(panel);
  const glare = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.12, 0.55), dark);
  glare.position.set(0, 1.04, -8.5);
  group.add(glare);
  const lower = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 0.4), dark);
  lower.position.set(0, 0.05, -8.45);
  group.add(lower);
  // Windscreen posts and roof frame
  // Windscreen posts lean back toward the crew, like the real glazing.
  for (const x of [-1.32, 0.02, 1.32]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(x === 0.02 ? 0.05 : 0.07, 0.95, 0.05), frame);
    post.position.set(x, 1.5, -8.4 + Math.abs(x) * 0.25);
    post.rotation.x = 0.5;
    post.rotation.z = -Math.sign(x) * 0.12;
    group.add(post);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.06, 1.6), frame);
  roof.position.set(0, 2.12, -7.2);
  group.add(roof);
  const sill = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.05, 0.05), frame);
  sill.position.set(0, 1.08, -8.72);
  group.add(sill);
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 2.6), dark);
    wall.position.set(side * 1.32, 0.6, -7.3);
    group.add(wall);

  }
  // Yokes
  const yokes = [];
  for (const x of [-0.5, 0.5]) {
    const y = new THREE.Group();
    y.position.set(x, 0.62, -7.95);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 6), frame);
    col.rotation.x = Math.PI / 2;
    col.position.z = 0.2;
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 6, 16, Math.PI), dark);
    wheel.rotation.z = Math.PI;
    wheel.position.z = 0.42;
    y.add(col, wheel);
    group.add(y);
    yokes.push(y);
  }
  // Throttle quadrant with two red-knobbed levers
  const quad = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.5), dark);
  quad.position.set(0, 0.5, -7.75);
  group.add(quad);
  const levers = [];
  for (const x of [-0.06, 0.06]) {
    const l = new THREE.Group();
    l.position.set(x, 0.58, -7.75);
    const rod = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 0.02), frame);
    rod.position.y = 0.1;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd02020 }));
    knob.position.y = 0.2;
    l.add(rod, knob);
    group.add(l);
    levers.push(l);
  }
  group.visible = false;
  return { group, panelCanvas, panelTex, yokes, levers, frame: 0 };
}

export function updateCockpit(cp, s) {
  cp.yokes.forEach((y) => { y.rotation.z = s.aileron * 0.5; y.position.z = -7.95 + s.elevator * 0.08; });
  cp.levers.forEach((l) => { l.rotation.x = -0.6 + s.throttle * 1.0; });
  cp.frame++;
  if (cp.frame % 3 === 0) { drawPanel(cp.panelCanvas.getContext('2d'), s); cp.panelTex.needsUpdate = true; }
}

function dial(g, x, y, r, label) {
  const grad = g.createRadialGradient(x, y, r * 0.2, x, y, r);
  grad.addColorStop(0, '#15191d');
  grad.addColorStop(1, '#0a0c0e');
  g.fillStyle = grad;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#6b7178'; g.lineWidth = 4; g.stroke();
  g.fillStyle = '#d8f5ff'; g.font = 'bold 13px Arial'; g.textAlign = 'center';
  g.fillText(label, x, y + r * 0.55);
}

function needle(g, x, y, r, angle, color = '#ffffff') {
  g.save(); g.translate(x, y); g.rotate(angle);
  g.strokeStyle = color; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, r * 0.15); g.lineTo(0, -r * 0.85); g.stroke();
  g.restore();
  g.fillStyle = '#333'; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
}

function ticks(g, x, y, r, n, a0, a1) {
  g.strokeStyle = '#e8eef2'; g.lineWidth = 2;
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    g.beginPath();
    g.moveTo(x + Math.sin(a) * r * 0.82, y - Math.cos(a) * r * 0.82);
    g.lineTo(x + Math.sin(a) * r * 0.95, y - Math.cos(a) * r * 0.95);
    g.stroke();
  }
}

function drawPanel(g, s) {
  g.fillStyle = '#2c3137';
  g.fillRect(0, 0, 1024, 384);
  g.fillStyle = '#23272c';
  g.fillRect(20, 20, 984, 344);
  const r = 70;
  // Airspeed
  dial(g, 110, 120, r, 'KT');
  ticks(g, 110, 120, r, 16, -2.6, 2.6);
  needle(g, 110, 120, r, -2.6 + Math.min(1, s.airspeed * 1.944 / 240) * 5.2);
  // Attitude indicator
  g.save();
  g.beginPath(); g.arc(290, 120, r, 0, Math.PI * 2); g.clip();
  g.translate(290, 120); g.rotate(-s.roll);
  const off = s.pitch * 180 / Math.PI * 2.4;
  g.fillStyle = '#3a8fd8'; g.fillRect(-150, -150 + off, 300, 150);
  g.fillStyle = '#8a5a2b'; g.fillRect(-150, off, 300, 150);
  g.strokeStyle = '#fff'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(-150, off); g.lineTo(150, off); g.stroke();
  for (let d = -20; d <= 20; d += 10) if (d) { g.beginPath(); g.moveTo(-20, off - d * 2.4); g.lineTo(20, off - d * 2.4); g.stroke(); }
  g.restore();
  g.strokeStyle = '#6b7178'; g.lineWidth = 4; g.beginPath(); g.arc(290, 120, r, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = '#ffc020'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(250, 120); g.lineTo(280, 120); g.lineTo(290, 130); g.lineTo(300, 120); g.lineTo(330, 120); g.stroke();
  // Altimeter
  dial(g, 470, 120, r, 'ALT FT');
  ticks(g, 470, 120, r, 10, 0, Math.PI * 2 * 0.9);
  const ft = Math.max(0, s.position.y * 3.281);
  needle(g, 470, 120, r * 0.7, (ft / 10000) * Math.PI * 2, '#9cf');
  needle(g, 470, 120, r, ((ft % 1000) / 1000) * Math.PI * 2);
  g.fillStyle = '#fff'; g.font = 'bold 16px monospace'; g.fillText(String(Math.round(ft)), 470, 100);
  // Heading (compass card)
  dial(g, 650, 120, r, 'HDG');
  g.save(); g.translate(650, 120); g.rotate(-s.heading * Math.PI / 180);
  g.fillStyle = '#fff'; g.font = 'bold 14px Arial'; g.textAlign = 'center';
  ['N', 'E', 'S', 'W'].forEach((l, i) => { g.save(); g.rotate(i * Math.PI / 2); g.fillText(l, 0, -r * 0.62); g.restore(); });
  g.restore();
  g.fillStyle = '#ffc020'; g.beginPath(); g.moveTo(650, 55); g.lineTo(642, 70); g.lineTo(658, 70); g.fill();
  // VSI
  dial(g, 830, 120, r, 'VS');
  ticks(g, 830, 120, r, 12, -2.4 - Math.PI / 2, 2.4 - Math.PI / 2);
  needle(g, 830, 120, r, -Math.PI / 2 + Math.max(-2.4, Math.min(2.4, s.vs / 10 * 2.4)));
  // Lower row: engines, fuel, water, flaps, warning lights
  const bars = [
    ['ENG 1', s.rpm, '#7dff9a'], ['ENG 2', s.rpm, '#7dff9a'],
    ['FUEL', s.fuel / s.fuelMax, s.fuel / s.fuelMax < 0.2 ? '#ff5040' : '#ffb347'],
    ['WATER', s.water / s.waterMax, '#46b6ff'], ['FLAPS', s.flaps, '#e0e0e0'], ['THR', s.throttle, '#ffd36b'],
  ];
  bars.forEach(([l, v, c], i) => {
    const x = 70 + i * 120, y = 230;
    g.fillStyle = '#0b0d10'; g.fillRect(x, y, 70, 110);
    g.fillStyle = c; g.fillRect(x + 6, y + 6 + 98 * (1 - v), 58, 98 * v);
    g.fillStyle = '#d8f5ff'; g.font = 'bold 14px Arial'; g.textAlign = 'center';
    g.fillText(l, x + 35, y + 128 > 380 ? 376 : y + 126);
  });
  const warn = [['STALL', s.stall, '#ff3020'], ['SCOOP', s.scooping, '#30a0ff'], ['DOORS', s.doors > 0.1, '#ffb020'], ['LOW FUEL', s.fuel / s.fuelMax < 0.15, '#ff3020']];
  warn.forEach(([l, on, c], i) => {
    const x = 800 + (i % 2) * 100, y = 240 + Math.floor(i / 2) * 60;
    g.fillStyle = on ? c : '#26292d'; g.fillRect(x, y, 90, 44);
    g.fillStyle = on ? '#000' : '#555'; g.font = 'bold 14px Arial'; g.fillText(l, x + 45, y + 27);
  });
}
