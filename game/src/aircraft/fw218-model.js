// FW-218 "Enggang": twin-turboprop amphibious water bomber, modelled in code.
// Boat hull with rounded nose, high straight wing, red nacelles with chrome spinners and 4-blade props,
// wingtip floats, tall fin with mid stabiliser, moving controls, lights and belly water doors.
// Local axes: nose toward -Z, right wing +X, up +Y. Metres.
import * as THREE from 'three';
import { buildLiveryTexture, buildFinTexture, buildHullDetailMaps } from './livery-texture.js';
import { glowTexture } from '../core/canvas-textures.js';
import { planarUV } from '../core/geometry-utils.js';

const RED = 0xc8102e;
const WHITE = 0xf2f2ee;
const NOSE_Z = -10.2, TAIL_Z = 10.2;

// Hull cross-section at station t (0 nose .. 1 tail): half width, top and keel heights.
function hullSection(t) {
  const nose = Math.min(1, t / 0.2);
  const noseRound = Math.sqrt(Math.sin((nose * Math.PI) / 2));
  const tail = Math.max(0, (t - 0.6) / 0.4);
  const w = 1.4 * noseRound * (1 - 0.82 * tail * tail) + 0.03;
  const top = -0.1 + 1.75 * Math.sqrt(Math.sin((Math.min(1, t / 0.16) * Math.PI) / 2)) + 0.12 * tail;
  const keelNose = -1.75 + 1.0 * Math.pow(1 - nose, 2.2);
  const bot = t < 0.55 ? keelNose : keelNose + 1.9 * Math.pow((t - 0.55) / 0.45, 1.3);
  return { w, top, bot: Math.min(bot, top - 0.1) };
}

function buildHullGeometry() {
  const rings = 64, around = 40;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const z = NOSE_Z + (TAIL_Z - NOSE_Z) * t;
    const { w, top, bot } = hullSection(t);
    const waist = bot + (top - bot) * 0.48;
    for (let j = 0; j <= around; j++) {
      const th = (j / around) * Math.PI * 2;
      const s = Math.sin(th), c = Math.cos(th);
      let x, y;
      if (c >= 0) {
        x = w * Math.sign(s) * Math.pow(Math.abs(s), 0.65);
        y = waist + (top - waist) * Math.pow(c, 0.75);
      } else {
        // V-shaped planing hull below the waist with a chine.
        x = w * Math.sign(s) * Math.pow(Math.abs(s), 0.45);
        y = waist - (waist - bot) * Math.pow(-c, 1.25);
      }
      pos.push(x, y, z);
      uv.push(t, j / around);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < around; j++) {
      const a = i * (around + 1) + j, b = a + around + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A straight wing panel from an airfoil outline, extruded along the span (+X).
function airfoilShape(chord, thick) {
  const s = new THREE.Shape();
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const x = i / n;
    const y = 5 * thick * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1015 * x ** 4);
    if (i === 0) s.moveTo(-x * chord, y * chord);
    else s.lineTo(-x * chord, y * chord);
  }
  for (let i = n; i >= 0; i--) {
    const x = i / n;
    const y = 5 * thick * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1015 * x ** 4);
    s.lineTo(-x * chord, -y * chord * 0.45);
  }
  return s;
}

function wingPanel(chord, thick, span) {
  const g = new THREE.ExtrudeGeometry(airfoilShape(chord, thick), { depth: span, bevelEnabled: false, curveSegments: 4 });
  // shape x -> -Z (chord, leading edge at 0 pointing forward), shape y -> Y, extrude z -> X
  g.rotateY(Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

function std(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.1, ...extra });
}

function hinge(parent, x, y, z) {
  const h = new THREE.Group();
  h.position.set(x, y, z);
  parent.add(h);
  return h;
}

export function buildFW218() {
  const root = new THREE.Group();
  root.name = 'FW-218';
  const model = new THREE.Group();
  root.add(model);
  const parts = { model };

  // Painted metal: a clear lacquer over the colour coat, reflecting the sky.
  const paint = (color, extra = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.42, metalness: 0.05, clearcoat: 0.7, clearcoatRoughness: 0.12, envMapIntensity: 1.1, ...extra });
  const white = paint(WHITE);
  const red = paint(RED, { roughness: 0.4 });
  const grey = std(0xb9bcc0, { roughness: 0.38, metalness: 0.65 });
  const dark = std(0x24272b, { roughness: 0.55, metalness: 0.2 });
  const chrome = std(0xf2f4f8, { roughness: 0.06, metalness: 1.0, envMapIntensity: 1.6 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0c1a24, roughness: 0.02, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.2 });

  // Hull
  const detail = buildHullDetailMaps();
  const hull = new THREE.Mesh(buildHullGeometry(), new THREE.MeshPhysicalMaterial({
    map: buildLiveryTexture(), normalMap: detail.normalMap, normalScale: new THREE.Vector2(0.6, 0.6),
    roughnessMap: detail.roughnessMap, roughness: 0.85, metalness: 0.05, clearcoat: 0.75, clearcoatRoughness: 0.1, envMapIntensity: 1.1,
  }));
  hull.castShadow = true;
  model.add(hull);
  parts.hull = hull;
  // Cockpit glazing bump and roof hatch
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  canopy.scale.set(1.05, 0.32, 1.1);
  canopy.position.set(0, 1.5, -7.6);
  canopy.scale.set(0.9, 0.18, 0.9);
  parts.canopy = canopy;
  // Wing root fairing / pylon on top of the hull
  const pylon = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.7, 4.2), white);
  pylon.position.set(0, 1.85, -1.6);
  model.add(pylon);

  // Wing: centre + two outer panels, at the top of the pylon.
  const wingY = 2.2, wingLE = -3.6, chord = 3.4, halfSpan = 14.2;
  const wingMain = new THREE.Mesh(wingPanel(chord * 0.78, 0.16, halfSpan * 2), white);
  wingMain.position.set(-halfSpan, wingY, wingLE);
  wingMain.castShadow = true;
  model.add(wingMain);
  // Under-wing grey band for contrast
  const tips = [];
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8), red);
    tip.scale.set(0.55, 0.2, chord * 0.4);
    tip.position.set(side * halfSpan, wingY + 0.05, wingLE + chord * 0.38);
    model.add(tip);
    tips.push(tip);
  }
  // Flaps (inner) and ailerons (outer) hinge on the trailing edge.
  parts.flaps = [];
  parts.ailerons = [];
  const te = wingLE + chord * 0.78;
  for (const side of [-1, 1]) {
    const fh = hinge(model, side * 4.6, wingY + 0.02, te);
    const flap = new THREE.Mesh(wingPanel(chord * 0.22, 0.12, 7.4), grey);
    flap.position.set(-3.7, 0, 0);
    flap.rotation.y = 0;
    flap.position.z = -0.02;
    fh.add(flap);
    parts.flaps.push(fh);
    const ah = hinge(model, side * 11.1, wingY + 0.02, te);
    const ail = new THREE.Mesh(wingPanel(chord * 0.22, 0.12, 5.6), red);
    ail.position.set(-2.8, 0, 0);
    ah.add(ail);
    ah.userData.side = side;
    parts.ailerons.push(ah);
  }

  // Engine nacelles on the wing with spinners and 4-blade propellers.
  parts.props = [];
  parts.discs = [];
  const nacX = 4.6;
  const discTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 8, 64, 64, 64);
    grad.addColorStop(0, 'rgba(30,30,30,0.0)');
    grad.addColorStop(0.3, 'rgba(40,40,40,0.35)');
    grad.addColorStop(0.92, 'rgba(70,70,70,0.4)');
    grad.addColorStop(0.97, 'rgba(240,210,60,0.55)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  for (const side of [-1, 1]) {
    const nac = new THREE.Group();
    nac.position.set(side * nacX, wingY + 0.12, 0);
    model.add(nac);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.74, 4.4, 6, 16), red);
    body.rotation.x = Math.PI / 2;
    body.scale.set(1, 1, 1.15);
    body.position.z = -1.9;
    body.castShadow = true;
    nac.add(body);
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 1.2), dark);
    intake.position.set(0, -0.62, -4.3);
    nac.add(intake);
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.9, 8), dark);
    exhaust.rotation.z = Math.PI / 2;
    exhaust.position.set(side * 0.62, 0.05, -2.4);
    nac.add(exhaust);
    const badge = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), white);
    badge.position.set(side * 0.64, 0.25, -3.4);
    badge.rotation.y = side * Math.PI / 2;
    nac.add(badge);
    const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.0, 18), chrome);
    spinner.rotation.x = -Math.PI / 2;
    spinner.position.z = -5.65;
    nac.add(spinner);
    const prop = new THREE.Group();
    prop.position.z = -5.4;
    for (let b = 0; b < 4; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.05, 0.05), dark);
      blade.position.y = 1.15;
      const tipM = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.06), std(0xf0c419));
      tipM.position.y = 2.1;
      const arm = new THREE.Group();
      arm.add(blade, tipM);
      arm.rotation.z = (b * Math.PI) / 2;
      blade.rotation.y = 0.35;
      prop.add(arm);
    }
    nac.add(prop);
    parts.props.push(prop);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(2.25, 32), new THREE.MeshBasicMaterial({ map: discTex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    disc.position.z = -5.38;
    nac.add(disc);
    parts.discs.push(disc);
  }

  // Wingtip floats on swept pylons.
  for (const side of [-1, 1]) {
    const fx = side * 12.2;
    const floatBody = new THREE.Group();
    floatBody.position.set(fx, wingY - 2.6, wingLE + 1.6);
    model.add(floatBody);
    const lower = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), red);
    lower.scale.set(0.55, 0.45, 2.1);
    floatBody.add(lower);
    const upper = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), white);
    upper.scale.set(0.55, 0.35, 2.1);
    floatBody.add(upper);
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.5, 1.5), red);
    strut.position.set(fx, wingY - 1.3, wingLE + 1.8);
    strut.rotation.x = -0.15;
    model.add(strut);
  }

  // Tail fin (extruded outline) with the emblem, rudder, stabiliser and elevators.
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0); finShape.lineTo(3.8, 0); finShape.lineTo(3.4, 5.9); finShape.lineTo(1.9, 6.0); finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.28, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 1 });
  finGeo.rotateY(-Math.PI / 2);
  finGeo.translate(0.14, 0, 0);
  planarUV(finGeo, 'z', 'y', true);
  const fin = new THREE.Mesh(finGeo, new THREE.MeshPhysicalMaterial({ map: buildFinTexture(), roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.12 }));
  fin.position.set(0, 1.3, 5.7);
  fin.castShadow = true;
  model.add(fin);
  const rudderH = hinge(model, 0, 1.4, 9.35);
  const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5.3, 1.0), red);
  rudder.position.set(0, 2.75, 0.5);
  rudderH.add(rudder);
  parts.rudder = rudderH;
  const stabY = 4.6;
  const stab = new THREE.Mesh(wingPanel(2.0, 0.12, 10), white);
  stab.position.set(-5, stabY, 7.6);
  model.add(stab);
  const elevH = hinge(model, 0, stabY, 9.6);
  const elev = new THREE.Mesh(wingPanel(0.75, 0.1, 9.6), red);
  elev.position.set(-4.8, 0, 0);
  elevH.add(elev);
  parts.elevator = elevH;

  // Belly water doors (open when dropping) and scoop probes.
  parts.doors = [];
  for (const side of [-1, 1]) {
    const dh = hinge(model, side * 0.12, -1.66, -1.5);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.06, 2.6), red);
    door.position.x = side * 0.38;
    dh.add(door);
    dh.userData.side = side;
    parts.doors.push(dh);
  }
  const probe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.4), dark);
  probe.position.set(0, -1.8, 1.6);
  model.add(probe);

  // Navigation lights, strobes and beacon.
  const lightGlow = (col, size) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(col), blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.scale.setScalar(size);
    return sp;
  };
  const navL = lightGlow('rgba(255,40,40,1)', 1.6); navL.position.set(-halfSpan - 0.85, wingY, wingLE + 1.2);
  const navR = lightGlow('rgba(40,255,90,1)', 1.6); navR.position.set(halfSpan + 0.85, wingY, wingLE + 1.2);
  const strobeTail = lightGlow('rgba(255,255,255,1)', 3); strobeTail.position.set(0, 7.3, 9.8);
  const beacon = lightGlow('rgba(255,50,30,1)', 2.2); beacon.position.set(0, 1.85, 3.5);
  const landing = lightGlow('rgba(255,250,220,1)', 1.0); landing.position.set(0, -0.6, -10.2);
  model.add(navL, navR, strobeTail, beacon, landing);
  parts.strobes = [strobeTail];
  parts.beacon = beacon;

  // Pitot, antennas, step
  const ant = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.3), dark);
  ant.position.set(0, 1.55, 4.5);
  model.add(ant);

  root.userData.parts = parts;
  root.traverse((o) => { if (o.isMesh && o !== parts.discs[0] && o !== parts.discs[1]) o.castShadow = true; });
  return root;
}

// Animate controls, props, doors and lights from the flight state.
export function animateFW218(root, s, dt, time) {
  const p = root.userData.parts;
  for (const a of p.ailerons) a.rotation.x = -s.aileron * 0.35 * a.userData.side;
  for (const f of p.flaps) f.rotation.x = s.flaps * 0.55;
  p.elevator.rotation.x = -s.elevator * 0.4;
  p.rudder.rotation.y = s.rudder * 0.4;
  for (const d of p.doors) d.rotation.z = -d.userData.side * s.doors * 1.2;
  const spin = s.rpm * 28 * dt;
  p.props.forEach((pr, i) => {
    pr.rotation.z += spin * (i ? -1 : 1);
    pr.visible = s.rpm < 0.55 || s.cockpit;
  });
  p.discs.forEach((d) => {
    d.visible = s.rpm > 0.3;
    d.material.opacity = Math.min(1, (s.rpm - 0.3) * 2.5);
    d.rotation.z += dt * 3;
  });
  const flash = (time % 1.3) < 0.07;
  p.strobes.forEach((st) => (st.visible = flash));
  p.beacon.visible = (time % 1.0) < 0.5;
  p.hull.visible = !s.cockpit;
  p.canopy.visible = !s.cockpit;
}
