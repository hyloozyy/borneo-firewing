// Chase camera (smooth lag, mouse-drag orbit, wheel zoom, speed-based pull-back) and cockpit camera.
import * as THREE from 'three';
import { EYE } from '../cockpit/cockpit-view.js';
import { terrainHeight } from '../world/terrain.js';

const _target = new THREE.Vector3(), _off = new THREE.Vector3(), _look = new THREE.Vector3();

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'chase';
    this.yaw = 0; this.pitch = 0.12; this.dist = 34;
    this.smoothPos = new THREE.Vector3();
    this.smoothQuat = new THREE.Quaternion();
    this.first = true;
    this.shake = 0;
  }

  orbit(dx, dy) {
    this.yaw -= dx * 0.005;
    this.pitch = Math.max(-0.4, Math.min(1.2, this.pitch + dy * 0.004));
  }

  zoom(d) { this.dist = Math.max(18, Math.min(120, this.dist * (1 + d * 0.001))); }

  update(s, dt, lookAround) {
    const cam = this.camera;
    if (!lookAround && !this.hold) { this.yaw *= 1 - Math.min(1, dt * 1.5); }
    // Follow only the heading and a softened bank, so the camera never fights the pilot.
    const e = new THREE.Euler().setFromQuaternion(s.quaternion, 'YXZ');
    const followQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(e.x * 0.35, e.y, e.z * 0.25, 'YXZ'));
    if (this.first) { this.smoothQuat.copy(followQ); }
    this.smoothQuat.slerp(followQ, Math.min(1, dt * 3));
    if (this.mode === 'cockpit') {
      cam.position.copy(EYE).applyQuaternion(s.quaternion).add(s.position);
      const look = new THREE.Quaternion().setFromEuler(new THREE.Euler((this.pitch - 0.1) * 0.5 - 0.1, this.yaw, 0, 'YXZ'));
      cam.quaternion.copy(s.quaternion).multiply(look);
      if (this.shake > 0) cam.position.y += (Math.random() - 0.5) * this.shake * 0.08;
      cam.near = 0.05;
      cam.updateProjectionMatrix();
      this.first = false;
      return;
    }
    cam.near = 1.0;
    cam.updateProjectionMatrix();
    const speedPull = Math.min(1, s.airspeed / 90) * 8;
    _off.set(0, 0, this.dist + speedPull);
    _off.applyEuler(new THREE.Euler(-this.pitch, this.yaw, 0, 'YXZ'));
    _off.applyQuaternion(this.smoothQuat);
    _target.copy(s.position).add(_off);
    const gh = Math.max(0, terrainHeight(_target.x, _target.z)) + 3;
    if (_target.y < gh) _target.y = gh;
    if (this.first) this.smoothPos.copy(_target);
    this.smoothPos.lerp(_target, Math.min(1, dt * 6));
    cam.position.copy(this.smoothPos);
    if (this.shake > 0) cam.position.addScalar((Math.random() - 0.5) * this.shake);
    _look.set(0, 2.5, -14).applyQuaternion(s.quaternion).add(s.position);
    cam.up.set(0, 1, 0).applyQuaternion(this.smoothQuat);
    cam.lookAt(_look);
    this.first = false;
  }
}
