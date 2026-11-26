// Visible engine trouble: a burning nacelle trails flames and black smoke, a damaged or shut-down
// engine trails grey smoke, an overheating one puffs heat haze. Uses the fire system's particle pools.
import * as THREE from 'three';

const NACELLE = [new THREE.Vector3(-4.6, 2.2, 2.2), new THREE.Vector3(4.6, 2.2, 2.2)];
const _p = new THREE.Vector3();

export class EngineEffects {
  constructor(fire) {
    this.fire = fire;
    this.acc = [0, 0];
  }

  update(plane, s, dt) {
    const d = s.damage;
    if (!d) return;
    d.engines.forEach((e, i) => {
      const smoking = e.fire || e.failed || e.health < 0.6 || e.itt > 820;
      if (!smoking) return;
      this.acc[i] += dt * (e.fire ? 40 : 14);
      _p.copy(NACELLE[i]).applyQuaternion(plane.quaternion).add(plane.position);
      const v = s.velocity;
      while (this.acc[i] >= 1) {
        this.acc[i] -= 1;
        const j = () => (Math.random() - 0.5) * 0.8;
        if (e.fire) {
          this.fire.flames.spawn(_p.x + j(), _p.y + j(), _p.z + j(), v.x * 0.55 + j() * 4, v.y * 0.55 + 1.5, v.z * 0.55 + j() * 4,
            0.35 + Math.random() * 0.3, 2.4, 0.6, [1, 0.8, 0.35, 1], [0.9, 0.2, 0.02, 0], 0.6, 1);
        }
        const dark = e.fire ? 0.08 : e.failed ? 0.32 : 0.5;
        this.fire.smoke.spawn(_p.x + j(), _p.y + j(), _p.z + j(), v.x * 0.35, v.y * 0.35 + 1, v.z * 0.35,
          e.fire ? 5 : 3.5, 2, e.fire ? 18 : 11, [dark, dark, dark, e.fire ? 0.75 : 0.45], [dark + 0.3, dark + 0.3, dark + 0.3, 0], 0.5, 0.4);
      }
    });
  }
}
