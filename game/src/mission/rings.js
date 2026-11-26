// Glowing target rings: navigation gates and the drop ring hung over the fire front.
import * as THREE from 'three';

export function makeRing(radius, color) {
  const g = new THREE.Group();
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(radius, radius * 0.06, 8, 48),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, fog: false }),
  );
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(radius, radius * 0.16, 6, 48),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
  );
  g.add(torus, halo);
  // Chevron ticks around the ring
  for (let i = 0; i < 8; i++) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.08, radius * 0.22, radius * 0.04), torus.material);
    const a = (i / 8) * Math.PI * 2;
    t.position.set(Math.cos(a) * radius * 0.86, Math.sin(a) * radius * 0.86, 0);
    t.rotation.z = a + Math.PI / 2;
    g.add(t);
  }
  g.userData = { radius, torus, halo };
  return g;
}

// Place a ring at pos, facing along the given horizontal direction of travel.
export function orientRing(ring, pos, dirX, dirZ) {
  ring.position.copy(pos);
  ring.rotation.set(0, Math.atan2(dirX, dirZ), 0);
}

// Did the segment from a to b pass through the ring's disc?
export function passedRing(ring, a, b) {
  const n = new THREE.Vector3(0, 0, 1).applyQuaternion(ring.quaternion);
  const da = a.clone().sub(ring.position).dot(n);
  const db = b.clone().sub(ring.position).dot(n);
  if (Math.sign(da) === Math.sign(db)) return false;
  const t = da / (da - db);
  const hit = a.clone().lerp(b, t);
  return hit.distanceTo(ring.position) < ring.userData.radius;
}

export function pulseRing(ring, time, active) {
  const s = 1 + Math.sin(time * 4) * 0.04;
  ring.userData.halo.scale.setScalar(s);
  ring.userData.halo.material.opacity = active ? 0.25 + Math.sin(time * 4) * 0.1 : 0.08;
  ring.userData.torus.material.opacity = active ? 0.95 : 0.35;
}
