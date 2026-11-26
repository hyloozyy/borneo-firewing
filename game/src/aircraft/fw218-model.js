// FW-218 "Enggang": twin-turboprop amphibious water bomber, modelled in code.
// Boat hull with rounded nose, high straight wing, red nacelles with chrome spinners and 4-blade props,
// wingtip floats, tall fin with mid stabiliser, moving controls, lights, belly water doors, landing gear.
// Local axes: nose toward -Z, right wing +X, up +Y. Metres.
import * as THREE from 'three';
import { buildLiveryTexture, buildFinTexture, buildHullDetailMaps } from './livery-texture.js';
import { glowTexture } from '../core/canvas-textures.js';
import { planarUV } from '../core/geometry-utils.js';
import { latheZ, profileOf, bladeGeometry, strutGeometry, plateYZ } from './fw218-parts.js';

const RED = 0xc8102e;
const WHITE = 0xf2f2ee;
export const NOSE_Z = -10.2, TAIL_Z = 10.2;

// Hull cross-section at station t (0 nose .. 1 tail): half width, top and keel heights.
export function hullSection(t) {
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
  const pylon = new THREE.Mesh(latheZ(profileOf(-4.1, 1.2, 16, (t) => Math.pow(Math.sin(Math.PI * Math.pow(t, 0.75)), 0.7)), { sx: 0.7, sy: 0.62 }), white);
  pylon.position.set(0, 1.62, 0);
  model.add(pylon);
  // Spray rails along the lower nose (the chine that throws the bow wave sideways).
  for (const side of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = 0.03 + (i / 12) * 0.47;
      const { w, top, bot } = hullSection(t);
      const waist = bot + (top - bot) * 0.48;
      pts.push(new THREE.Vector3(side * (w * 0.99 + 0.02), waist - 0.12, NOSE_Z + (TAIL_Z - NOSE_Z) * t));
    }
    const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.045, 5), paint(0x9e0c22, { roughness: 0.5 }));
    model.add(rail);
  }

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

  // Flap-track fairings under the trailing edge.
  for (const side of [-1, 1]) {
    for (const x of [1.9, 7.4, 9.6, 12.6]) {
      const ft = new THREE.Mesh(latheZ(profileOf(-0.9, 1.0, 8, (t) => Math.sin(Math.PI * Math.pow(t, 0.6)) * 0.13), { segments: 10, sy: 1.3 }), grey);
      ft.position.set(side * x, wingY - 0.12, te - 0.2);
      model.add(ft);
    }
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
  const bladeGeo = bladeGeometry(0.3, 2.2, { chord: 0.36 }), tipGeo = bladeGeometry(0.3, 2.2, { chord: 0.36, thick: 0.058, from: 0.9 });
  const bladeMat = std(0x2b2d30, { roughness: 0.5, metalness: 0.3 }), tipMat = std(0xf0c419, { roughness: 0.45 });
  for (const side of [-1, 1]) {
    const nac = new THREE.Group();
    nac.position.set(side * nacX, wingY + 0.12, 0);
    model.add(nac);
    // Cowling: intake lip behind the spinner, full cowl, long tail cone past the trailing edge.
    const cowl = (t) => t < 0.1 ? 0.45 + 0.37 * Math.sin((t / 0.1) * Math.PI / 2) : t < 0.55 ? 0.82 + 0.05 * Math.sin(((t - 0.1) / 0.45) * Math.PI) : Math.max(0.12, 0.82 * Math.pow(Math.cos(((t - 0.55) / 0.45) * Math.PI / 2), 0.8));
    const body = new THREE.Mesh(latheZ(profileOf(-5.15, 2.6, 30, cowl), { segments: 28, sy: 1.14 }), red);
    body.castShadow = true;
    nac.add(body);
    // Cowl panel seams and the dark chin intake under the spinner.
    for (const z of [-4.2, -2.6]) {
      const seam = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.012, 4, 40), dark);
      seam.scale.set(1, 1.14, 1);
      seam.position.z = z;
      nac.add(seam);
    }
    const intake = new THREE.Mesh(latheZ(profileOf(-4.9, -3.1, 10, (t) => Math.sin(Math.PI * Math.pow(t, 0.5)) * 0.34), { segments: 14, sy: 0.55 }), dark);
    intake.position.set(0, -0.74, 0);
    nac.add(intake);
    const intakeMouth = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), new THREE.MeshBasicMaterial({ color: 0x050505 }));
    intakeMouth.scale.set(1, 0.5, 1);
    intakeMouth.position.set(0, -0.74, -4.82);
    intakeMouth.rotation.y = Math.PI;
    nac.add(intakeMouth);
    // Exhaust stub on the outboard side, angled back, with soot behind it.
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.8, 12, 1, true), dark);
    exhaust.rotation.set(Math.PI / 2 - 0.5, 0, side * 0.5);
    exhaust.position.set(side * 0.78, 0.12, -2.2);
    nac.add(exhaust);
    const soot = new THREE.Mesh(latheZ(profileOf(-2.0, 0.6, 8, (t) => Math.sin(Math.PI * Math.pow(t, 0.4)) * 0.16), { segments: 10, sx: 0.4 }), std(0x2a2522, { roughness: 0.9 }));
    soot.position.set(side * 0.8, 0.12, 0);
    nac.add(soot);
    const badge = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), white);
    badge.position.set(side * 0.64, 0.25, -3.4);
    badge.rotation.y = side * Math.PI / 2;
    nac.add(badge);
    const spinner = new THREE.Mesh(latheZ(profileOf(-6.25, -5.12, 14, (t) => 0.45 * Math.pow(Math.sin((t * Math.PI) / 2), 0.55)), { segments: 28 }), chrome);
    nac.add(spinner);
    const prop = new THREE.Group();
    prop.position.z = -5.4;
    for (let b = 0; b < 4; b++) {
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      const tipM = new THREE.Mesh(tipGeo, tipMat);
      const arm = new THREE.Group();
      arm.add(blade, tipM);
      arm.rotation.z = (b * Math.PI) / 2 + 0.4;
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
    // Float hull: pointed bow, flat run, tapering stern; red with a white top band.
    const fl = (t) => t < 0.3 ? Math.pow(Math.sin((t / 0.3) * Math.PI / 2), 0.65) : t < 0.6 ? 1 : Math.max(0.1, Math.cos(((t - 0.6) / 0.4) * Math.PI / 2));
    const lower = new THREE.Mesh(latheZ(profileOf(-2.3, 2.2, 22, fl), { segments: 22, sx: 0.56, sy: 0.46 }), red);
    floatBody.add(lower);
    const upper = new THREE.Mesh(latheZ(profileOf(-2.3, 2.2, 22, (t) => fl(t) * 1.012), { segments: 14, sx: 0.56, sy: 0.46, phiStart: Math.PI - 1.15, phiLength: 2.3 }), white);
    floatBody.add(upper);
    const strut = new THREE.Mesh(strutGeometry(1.6, 0.16, 2.35, 0.82), red);
    strut.position.set(fx, wingY - 2.35, wingLE + 0.85);
    strut.rotation.z = side * 0.06;
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
  const rudder = new THREE.Mesh(plateYZ([[0, 0.1], [1.05, 0.1], [0.82, 5.2], [0, 5.42]], 0.14, 0.04), red);
  rudderH.add(rudder);
  // Dorsal fillet blending the fin into the hull top.
  const fillet = new THREE.Mesh(plateYZ([[3.0, 1.5], [6.0, 1.5], [6.0, 2.7]], 0.16, 0.05), white);
  model.add(fillet);
  // Tail cone with the white tail light.
  const tailLight = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  tailLight.position.set(0, 1.55, TAIL_Z + 0.05);
  model.add(tailLight);
  parts.rudder = rudderH;
  const stabY = 4.6;
  const stab = new THREE.Mesh(wingPanel(2.0, 0.12, 10), white);
  stab.position.set(-5, stabY, 7.6);
  model.add(stab);
  for (const side of [-1, 1]) {
    const cap = new THREE.Mesh(latheZ(profileOf(-0.05, 2.0, 10, (t) => Math.sin(Math.PI * Math.pow(t, 0.5)) * 0.14), { segments: 10, sy: 0.7 }), red);
    cap.position.set(side * 5.02, stabY + 0.05, 7.6);
    model.add(cap);
  }
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

  // Retractable landing gear: a nose leg folding forward into the bow and two main legs folding
  // up into the hull sides (an amphibian lands on the runway on wheels, on water on its hull).
  parts.gear = [];
  const tyre = new THREE.TorusGeometry(0.3, 0.13, 8, 18);
  tyre.rotateY(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.2, 14);
  hubGeo.rotateZ(Math.PI / 2);
  const rubber = std(0x1a1a1c, { roughness: 0.9 });
  const wheel = (x, y, z) => {
    const w = new THREE.Group();
    w.add(new THREE.Mesh(tyre, rubber), new THREE.Mesh(hubGeo, grey));
    w.position.set(x, y, z);
    return w;
  };
  const leg = (len) => {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, len, 8), grey);
    l.position.y = -len / 2;
    return l;
  };
  const noseH = hinge(model, 0, -1.0, -7.3);
  noseH.add(leg(0.6), wheel(0.17, -0.62, 0), wheel(-0.17, -0.62, 0));
  noseH.userData = { axis: 'x', sign: -1 };
  parts.gear.push(noseH);
  for (const side of [-1, 1]) {
    const mh = hinge(model, side * 1.3, -0.62, 0.9);
    const l = leg(1.05);
    l.rotation.z = side * 0.25;
    l.position.x = side * 0.13;
    mh.add(l, wheel(side * 0.3, -1.05, 0));
    const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 6), grey);
    brace.position.set(side * 0.05, -0.45, -0.38);
    brace.rotation.x = -0.75;
    mh.add(brace);
    mh.userData = { axis: 'z', sign: side };
    parts.gear.push(mh);
  }
  parts.gearExt = null;

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

  // Pitot tubes, blade antennas, whip antenna and static wicks.
  for (const side of [-1, 1]) {
    const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.7, 6), chrome);
    pitot.rotation.x = Math.PI / 2;
    pitot.position.set(side * 0.95, 0.75, -8.6);
    model.add(pitot);
  }
  for (const [z, h] of [[-4.6, 0.55], [3.2, 0.45]]) {
    const ant = new THREE.Mesh(plateYZ([[0, 0], [0.42, 0], [0.32, h], [0.22, h]], 0.04, 0.012), dark);
    ant.position.set(0, hullSection((z - NOSE_Z) / (TAIL_Z - NOSE_Z)).top - 0.04, z);
    model.add(ant);
  }
  const whip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.9, 5), dark);
  whip.position.set(0.3, -1.1, 3.2);
  whip.rotation.x = 0.5;
  model.add(whip);
  const wick = new THREE.CylinderGeometry(0.008, 0.008, 0.32, 4);
  wick.rotateX(Math.PI / 2 - 0.2);
  for (const side of [-1, 1]) {
    for (const x of [11.5, 12.8, 13.8]) {
      const w = new THREE.Mesh(wick, dark);
      w.position.set(side * x, wingY - 0.02, te + chord * 0.22 + 0.12);
      model.add(w);
    }
    const w2 = new THREE.Mesh(wick, dark);
    w2.position.set(side * 4.4, stabY, 9.6 + 0.75 + 0.12);
    model.add(w2);
  }

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
  // Each propeller follows its own engine: a failed engine's prop winds down and stops.
  p.props.forEach((pr, i) => {
    const rpm = s.engRpm ? s.engRpm[i] : s.rpm;
    pr.rotation.z += rpm * 28 * dt * (i ? -1 : 1);
    pr.visible = rpm < 0.55 || s.cockpit;
    const d = p.discs[i];
    d.visible = rpm > 0.3;
    d.material.opacity = Math.min(1, (rpm - 0.3) * 2.5);
    d.rotation.z += dt * 3;
  });
  // Gear comes down on the runway, on final with full flaps, or when slow; up on the water.
  const gearDown = !s.onWater && (s.onGround || (s.flapTarget >= 1 && s.agl < 220) || s.airspeed < 28);
  if (p.gearExt === null || s.onGround) p.gearExt = gearDown ? 1 : 0;
  else p.gearExt += ((gearDown ? 1 : 0) - p.gearExt) * Math.min(1, dt * 0.8);
  const up = 1 - p.gearExt;
  for (const g of p.gear) {
    if (g.userData.axis === 'x') g.rotation.x = g.userData.sign * up * 1.75;
    else g.rotation.z = g.userData.sign * up * 1.55;
    g.visible = p.gearExt > 0.02 || s.cockpit;
  }
  const flash = (time % 1.3) < 0.07;
  p.strobes.forEach((st) => (st.visible = flash));
  p.beacon.visible = (time % 1.0) < 0.5;
  p.hull.visible = !s.cockpit;
  p.canopy.visible = !s.cockpit;
}
