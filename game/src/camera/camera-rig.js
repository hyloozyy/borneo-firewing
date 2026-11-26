// Chase camera (smooth lag, mouse-drag or swipe orbit with inertia that recentres after a moment,
// wheel or pinch zoom, speed-based pull-back) and cockpit camera (free head look, pinch to zoom).
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
    this.vel = { yaw: 0, pitch: 0 };
    this.idle = 0;
    this.recentreDelay = 0.6; // seconds after the last look input (longer on phones)
    this.fovZoom = 1;
  }

  orbit(dx, dy, dt = 1 / 60) {
    const dyaw = -dx * 0.005, dpitch = dy * 0.004;
    this.yaw += dyaw;
    this.pitch = Math.max(-0.4, Math.min(1.2, this.pitch + dpitch));
    // Remember the swipe speed so the camera keeps gliding after the finger lifts.
    const k = Math.min(1, dt * 18);
    this.vel.yaw += (dyaw / Math.max(dt, 1 / 120) - this.vel.yaw) * k;
    this.vel.pitch += (dpitch / Math.max(dt, 1 / 120) - this.vel.pitch) * k;
    this.idle = 0;
  }

  zoom(d) { this.dist = Math.max(18, Math.min(120, this.dist * (1 + d * 0.001))); }

  // Pinch: ratio > 1 pulls the chase camera back; in the cockpit it narrows/widens the view.
  pinch(ratio) {
    if (this.mode === 'cockpit') this.fovZoom = Math.max(0.6, Math.min(1.15, this.fovZoom * ratio));
    else this.dist = Math.max(16, Math.min(120, this.dist * ratio));
    this.idle = 0;
  }

  recentre() { this.vel.yaw = this.vel.pitch = 0; this.idle = 99; this.snap = true; }

  update(s, dt, lookAround) {
    const cam = this.camera;
    if (lookAround) {
      this.idle = 0;
      if (dt > 0) { this.vel.yaw *= Math.exp(-dt * 10); this.vel.pitch *= Math.exp(-dt * 10); }
    } else if (!this.hold) {
      // Inertia, then an easy glide back behind the tail once the player stops looking around.
      this.yaw += this.vel.yaw * dt;
      this.pitch = Math.max(-0.4, Math.min(1.2, this.pitch + this.vel.pitch * dt));
      const damp = Math.exp(-dt * 3.2);
      this.vel.yaw *= damp; this.vel.pitch *= damp;
      this.idle += dt;
      if (this.idle > this.recentreDelay) {
        const k = Math.min(1, dt * (this.snap ? 5 : 1.5));
        this.yaw = wrap(this.yaw) * (1 - k);
        this.pitch += (0.12 - this.pitch) * k;
        if (Math.abs(this.yaw) < 0.01) this.snap = false;
      }
    }
    // Follow only the heading and a softened bank, so the camera never fights the pilot.
    const e = new THREE.Euler().setFromQuaternion(s.quaternion, 'YXZ');
    const followQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(e.x * 0.35, e.y, e.z * 0.25, 'YXZ'));
    if (this.first) { this.smoothQuat.copy(followQ); }
    this.smoothQuat.slerp(followQ, Math.min(1, dt * 3));
    if (this.mode === 'cockpit') {
      cam.position.copy(EYE).applyQuaternion(s.quaternion).add(s.position);
      const look = new THREE.Quaternion().setFromEuler(new THREE.Euler((this.pitch - 0.12) * 0.5 - 0.17, this.yaw, 0, 'YXZ'));
      cam.quaternion.copy(s.quaternion).multiply(look);
      if (this.shake > 0) cam.position.y += (Math.random() - 0.5) * this.shake * 0.08;
      cam.near = 0.05;
      if (!this.hold) cam.fov = 62 * this.fovZoom;
      cam.updateProjectionMatrix();
      this.first = false;
      return;
    }
    cam.near = 1.0;
    if (!this.hold) cam.fov = 62;
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

function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
