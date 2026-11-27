// Windsock: a red-and-white banded steel mast on a braced base, a swivel with a hoop frame, and a
// five-band orange/white fabric sock that turns into the wind, fills with wind speed and flutters.
import * as THREE from 'three';

export function buildWindsock(palette) {
  const g = new THREE.Group();
  const mast = 9;
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, mast / 6, 10), i % 2 ? palette.steelWhite : palette.steelRed);
    m.position.y = (i + 0.5) * (mast / 6);
    m.castShadow = true;
    g.add(m);
  }
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.4, 12), palette.concrete);
  base.position.y = 0.2;
  g.add(base);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2, 6), palette.steel);
    brace.position.set(Math.cos(a) * 0.7, 1.5, Math.sin(a) * 0.7);
    brace.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
    g.add(brace);
  }
  const swivel = new THREE.Group();
  swivel.position.y = mast;
  g.add(swivel);
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.035, 6, 20), palette.steel);
  hoop.rotation.y = Math.PI / 2;
  hoop.position.x = 0.25;
  swivel.add(hoop);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6), palette.steel);
  arm.rotation.z = Math.PI / 2;
  arm.position.x = 0.1;
  swivel.add(arm);
  swivel.add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), palette.lampRed));
  // Sock: chained bands, each hinged at the end of the one before.
  const bands = [];
  let parent = swivel, x = 0.25;
  for (let i = 0; i < 5; i++) {
    const r0 = 0.55 - i * 0.07, r1 = 0.55 - (i + 1) * 0.07, len = 0.9;
    const geo = new THREE.CylinderGeometry(r1, r0, len, 16, 1, true);
    geo.rotateZ(Math.PI / 2);
    geo.translate(len / 2, 0, 0);
    const m = new THREE.Mesh(geo, i % 2 ? palette.fabricWhite : palette.fabricOrange);
    m.castShadow = true;
    const hinge = new THREE.Group();
    hinge.position.x = x;
    hinge.add(m);
    parent.add(hinge);
    bands.push(hinge);
    parent = hinge;
    x = len;
  }
  return {
    group: g,
    update(t, wind) {
      const speed = Math.hypot(wind.x, wind.z);
      swivel.rotation.y = Math.atan2(-wind.z, wind.x) + Math.sin(t * 0.7) * 0.06; // sock points downwind
      const droop = Math.max(0, 0.55 - speed * 0.12);
      bands.forEach((h, i) => {
        h.rotation.z = -droop * (i ? 0.35 : 1) + Math.sin(t * 6 + i * 1.3) * 0.05 * (i + 1) * 0.4;
        h.rotation.y = Math.sin(t * 4.3 + i * 0.9) * 0.05 * (i + 1) * 0.5;
      });
    },
  };
}
