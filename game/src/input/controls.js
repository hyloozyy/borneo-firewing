// Keyboard + mouse controls, plus the phone controls: a virtual stick (pitch/roll), a throttle
// slider, buttons (drop, flaps, brake, fire bottle, camera, tilt, pause) and GTA-style camera
// gestures on the free screen area (one finger swipes to look around, two fingers pinch to zoom,
// double tap recentres). Every finger is tracked by its pointer id, so stick, throttle, buttons and
// look all work at the same time.
import { TouchLook } from './touch-look.js';

export class Controls {
  constructor(dom, game) {
    this.game = game;
    this.keys = new Set();
    this.pressed = new Set();
    // look: camera deltas this frame (mouse drag or swipe); active while a finger/button is down.
    this.mouse = { dragging: false, dx: 0, dy: 0, wheel: 0, pinch: 1 };
    this.touch = { active: false, x: 0, y: 0, throttle: null, drop: false, tilt: false, tiltX: 0, tiltY: 0 };
    addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouse.dragging = false; });
    let mouseId = null;
    dom.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      mouseId = e.pointerId; this.mouse.dragging = true; this.mouse.lx = e.clientX; this.mouse.ly = e.clientY;
    });
    addEventListener('pointerup', (e) => { if (e.pointerId === mouseId) { this.mouse.dragging = false; mouseId = null; } });
    addEventListener('pointermove', (e) => {
      if (e.pointerId !== mouseId || !this.mouse.dragging) return;
      this.mouse.dx += e.clientX - this.mouse.lx; this.mouse.dy += e.clientY - this.mouse.ly;
      this.mouse.lx = e.clientX; this.mouse.ly = e.clientY;
    });
    dom.addEventListener('wheel', (e) => { this.mouse.wheel += e.deltaY; e.preventDefault(); }, { passive: false });
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (this.isTouch) {
      document.body.classList.add('touch');
      this.look = new TouchLook(dom, this.mouse, () => this.pressed.add('Recentre'));
      this.buildTouch();
    }
  }

  down(...codes) { return codes.some((c) => this.keys.has(c)); }
  hit(code) { return this.pressed.has(code); }
  get looking() { return this.mouse.dragging || (this.look ? this.look.active : false); }
  endFrame() { this.pressed.clear(); this.mouse.dx = this.mouse.dy = this.mouse.wheel = 0; this.mouse.pinch = 1; }

  // Flight axes in -1..1
  read() {
    const t = this.touch;
    let pitch = (this.down('KeyS', 'ArrowDown') ? 1 : 0) - (this.down('KeyW', 'ArrowUp') ? 1 : 0);
    let roll = (this.down('KeyD', 'ArrowRight') ? 1 : 0) - (this.down('KeyA', 'ArrowLeft') ? 1 : 0);
    const yaw = (this.down('KeyE') ? 1 : 0) - (this.down('KeyQ') ? 1 : 0);
    const throttleDelta = (this.down('KeyR', 'ShiftLeft', 'ShiftRight', 'Equal') ? 1 : 0) - (this.down('KeyF', 'Minus') ? 1 : 0);
    // The stick has a gentle response curve: precise near the centre, full deflection at the edge.
    if (t.active) { pitch += curve(t.y); roll += curve(t.x); }
    if (t.tilt) { pitch += t.tiltY; roll += t.tiltX; }
    return {
      pitch: Math.max(-1, Math.min(1, pitch)),
      roll: Math.max(-1, Math.min(1, roll)),
      yaw,
      throttleDelta,
      throttleSet: t.throttle,
      drop: this.down('Space') || t.drop,
      brakes: this.down('KeyB'),
    };
  }

  // Keep the on-screen throttle knob and the toggle buttons in step with the aircraft.
  syncThrottle(v, s) {
    if (!this.thr) return;
    const top = this.game.hud.touchBarTop;
    if (top && Math.abs(top - (this.barTop || 0)) > 1) { this.barTop = top; this.topbar.style.top = `${Math.round(top)}px`; }
    if (this.thrId == null) { this.thr.knob.style.bottom = `${v * 100}%`; this.touch.throttle = null; }
    this.thr.fill.style.height = `${v * 100}%`;
    this.thr.value.textContent = `${Math.round(v * 100)}`;
    if (s) {
      this.flapsLabel.textContent = ['UP', '1', 'FULL'][Math.round(s.flapTarget * 2)];
      this.dropBtn.classList.toggle('empty', s.water <= 0);
      this.dropBtn.style.setProperty('--fill', `${(s.water / s.waterMax) * 100}%`);
      this.extBtn.classList.toggle('alert', !!(s.damage && s.damage.engines.some((e) => e.fire)));
    }
  }

  buildTouch() {
    const root = document.getElementById('touch');
    root.hidden = false;
    this.topbar = root.querySelector('.topbar');
    const stick = root.querySelector('.stick'), knob = root.querySelector('.knob'), base = root.querySelector('.stick-base');
    // Stick: the base sits where the thumb lands inside the left zone (floating stick).
    let stickId = null, cx = 0, cy = 0;
    const R = () => base.offsetWidth / 2;
    stick.addEventListener('pointerdown', (e) => {
      if (stickId != null) return;
      e.preventDefault();
      stickId = e.pointerId;
      stick.setPointerCapture(e.pointerId);
      const r = stick.getBoundingClientRect();
      const rad = R();
      cx = Math.max(r.left + rad, Math.min(r.right - rad, e.clientX));
      cy = Math.max(r.top + rad, Math.min(r.bottom - rad, e.clientY));
      base.style.left = `${cx - r.left}px`; base.style.top = `${cy - r.top}px`;
      stick.classList.add('held');
      this.touch.active = true;
      moveStick(e);
    });
    const moveStick = (e) => {
      if (e.pointerId !== stickId) return;
      const rad = R();
      let x = (e.clientX - cx) / rad, y = (e.clientY - cy) / rad;
      const l = Math.hypot(x, y);
      if (l > 1) { x /= l; y /= l; }
      this.touch.x = x; this.touch.y = y;
      knob.style.transform = `translate(${x * rad * 0.62}px, ${y * rad * 0.62}px)`;
    };
    stick.addEventListener('pointermove', moveStick);
    const endStick = (e) => {
      if (e.pointerId !== stickId) return;
      stickId = null; this.touch.active = false; this.touch.x = this.touch.y = 0;
      knob.style.transform = ''; base.style.left = base.style.top = '';
      stick.classList.remove('held');
    };
    stick.addEventListener('pointerup', endStick);
    stick.addEventListener('pointercancel', endStick);

    // Throttle: drag the slider; the knob follows the finger, tap a spot to jump there.
    const thr = root.querySelector('.throttle'), track = thr.querySelector('.track');
    this.thr = { knob: thr.querySelector('.knob'), fill: thr.querySelector('.fill'), value: thr.querySelector('.value') };
    this.thrId = null;
    const setThr = (e) => {
      const r = track.getBoundingClientRect();
      const v = 1 - Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
      this.touch.throttle = v < 0.03 ? 0 : v > 0.97 ? 1 : v;
      this.thr.knob.style.bottom = `${this.touch.throttle * 100}%`;
    };
    thr.addEventListener('pointerdown', (e) => { e.preventDefault(); this.thrId = e.pointerId; thr.setPointerCapture(e.pointerId); thr.classList.add('held'); setThr(e); });
    thr.addEventListener('pointermove', (e) => { if (e.pointerId === this.thrId) setThr(e); });
    const endThr = (e) => { if (e.pointerId !== this.thrId) return; this.thrId = null; thr.classList.remove('held'); };
    thr.addEventListener('pointerup', endThr);
    thr.addEventListener('pointercancel', endThr);

    // Buttons: hold-type (drop, brake) keep the key down while pressed; the rest are taps.
    const btn = (sel, code) => {
      const b = root.querySelector(sel);
      let id = null;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        id = e.pointerId; b.setPointerCapture(e.pointerId);
        this.pressed.add(code); this.keys.add(code); b.classList.add('down');
        if (navigator.vibrate) navigator.vibrate(12);
      });
      const up = (e) => { if (e.pointerId !== id) return; id = null; this.keys.delete(code); b.classList.remove('down'); };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      return b;
    };
    this.dropBtn = btn('.b-drop', 'Space');
    btn('.b-flaps', 'KeyV');
    this.flapsLabel = root.querySelector('.b-flaps small');
    btn('.b-cam', 'KeyC');
    btn('.b-pause', 'KeyP');
    btn('.b-brake', 'KeyB');
    this.extBtn = btn('.b-ext', 'KeyX');
    btn('.b-hud', 'KeyH');
    const tiltBtn = root.querySelector('.b-tilt');
    tiltBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.touch.tilt = !this.touch.tilt;
      tiltBtn.classList.toggle('on', this.touch.tilt);
      this.tiltZero = null;
      if (this.touch.tilt && typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) DeviceOrientationEvent.requestPermission().catch(() => {});
    });
    // Tilt steering, relative to how the phone was held when tilt was switched on.
    addEventListener('deviceorientation', (e) => {
      if (!this.touch.tilt || e.beta == null) return;
      const flip = screen.orientation && screen.orientation.angle === 270 ? -1 : 1;
      const rollRaw = (e.beta || 0) * flip, pitchRaw = (e.gamma || 0) * flip;
      if (!this.tiltZero) this.tiltZero = { r: rollRaw, p: pitchRaw };
      this.touch.tiltX = Math.max(-1, Math.min(1, (rollRaw - this.tiltZero.r) / 25));
      this.touch.tiltY = Math.max(-1, Math.min(1, -(pitchRaw - this.tiltZero.p) / 20));
    });
  }
}

function curve(v) { return Math.sign(v) * (0.35 * Math.abs(v) + 0.65 * v * v); }
