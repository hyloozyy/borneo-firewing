// Cockpit view from the captain's seat: assembles the shell (cockpit-shell), the lit instrument
// panel (instrument-panel), the glareshield display, the windscreen surface and the moving controls,
// and keeps them alive each frame (needles, screens, vibration, warm panel flood light).
import * as THREE from 'three';
import { cockpitMaterials, buildShell } from './cockpit-shell.js';
import { buildControls, animateControls } from './cockpit-controls.js';
import { InstrumentPanel } from './instrument-panel.js';
import { GlareshieldDisplay } from './glareshield-display.js';
import { Windscreen } from './windscreen.js';

export const EYE = new THREE.Vector3(-0.55, 1.4, -7.3);

function canvasPlane(canvas, w, h) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  return { mesh, tex };
}

export function buildCockpit(quality = { name: 'high' }) {
  const group = new THREE.Group();
  const inner = new THREE.Group(); // vibrates with the engines
  group.add(inner);
  const mats = cockpitMaterials();
  const windscreen = new Windscreen();
  buildShell(inner, mats, windscreen.material);
  const scale = quality.texDetail ?? 1;
  const panel = new InstrumentPanel(scale);
  const p = canvasPlane(panel.canvas, 2.7, 0.62);
  p.mesh.position.set(0, 0.87, -8.12);
  p.mesh.rotation.x = -0.12;
  inner.add(p.mesh);
  const glare = new GlareshieldDisplay(scale);
  const gs = canvasPlane(glare.canvas, 2.2, 0.11);
  gs.mesh.position.set(0, 1.235, -8.045);
  inner.add(gs.mesh);
  const controls = buildControls(inner, mats);
  // Warm flood light over the panel and a cool fill from the windscreen.
  const flood = new THREE.PointLight(0xffc48a, 2.2, 3, 2);
  flood.position.set(-0.3, 1.75, -7.7);
  inner.add(flood);
  group.visible = false;
  return { group, inner, panel, panelTex: p.tex, glare, glareTex: gs.tex, windscreen, controls, frame: 0 };
}

export function updateCockpit(cp, game, dt) {
  const s = game.flight;
  animateControls(cp.controls, s);
  cp.windscreen.update(s, dt);
  // Airframe vibration: engine buzz plus turbulence bumps.
  const t = game.time;
  const buzz = 0.0012 * s.rpm + s.turbulence * 0.006;
  cp.inner.position.set(Math.sin(t * 53) * buzz, Math.sin(t * 61 + 1) * buzz, 0);
  cp.frame++;
  // Redraw the panel every other frame (every frame in a staged shot).
  if (cp.frame % 2 === 0 || dt === 0) {
    cp.panel.draw(game, t);
    cp.panelTex.needsUpdate = true;
    cp.glare.draw(game, t);
    cp.glareTex.needsUpdate = true;
  }
}
