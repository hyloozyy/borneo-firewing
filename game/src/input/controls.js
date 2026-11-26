// Keyboard + mouse controls, plus on-screen touch controls (stick, throttle, buttons, optional tilt).
export class Controls {
  constructor(dom) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { dragging: false, dx: 0, dy: 0, wheel: 0 };
    this.touch = { active: false, x: 0, y: 0, throttle: null, drop: false, tilt: false, tiltX: 0, tiltY: 0 };
    addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    dom.addEventListener('mousedown', (e) => { this.mouse.dragging = true; this.mouse.lx = e.clientX; this.mouse.ly = e.clientY; });
    addEventListener('mouseup', () => { this.mouse.dragging = false; });
    addEventListener('mousemove', (e) => {
      if (!this.mouse.dragging) return;
      this.mouse.dx += e.clientX - this.mouse.lx; this.mouse.dy += e.clientY - this.mouse.ly;
      this.mouse.lx = e.clientX; this.mouse.ly = e.clientY;
    });
    dom.addEventListener('wheel', (e) => { this.mouse.wheel += e.deltaY; e.preventDefault(); }, { passive: false });
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    if (this.isTouch) this.buildTouch();
  }

  down(...codes) { return codes.some((c) => this.keys.has(c)); }
  hit(code) { const h = this.pressed.has(code); return h; }
  endFrame() { this.pressed.clear(); this.mouse.dx = this.mouse.dy = this.mouse.wheel = 0; }

  // Flight axes in -1..1
  read() {
    const t = this.touch;
    let pitch = (this.down('KeyS', 'ArrowDown') ? 1 : 0) - (this.down('KeyW', 'ArrowUp') ? 1 : 0);
    let roll = (this.down('KeyD', 'ArrowRight') ? 1 : 0) - (this.down('KeyA', 'ArrowLeft') ? 1 : 0);
    const yaw = (this.down('KeyE') ? 1 : 0) - (this.down('KeyQ') ? 1 : 0);
    let throttleDelta = (this.down('KeyR', 'ShiftLeft', 'ShiftRight', 'Equal') ? 1 : 0) - (this.down('KeyF', 'Minus') ? 1 : 0);
    if (t.active) { pitch += t.y; roll += t.x; }
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

  // Keep the on-screen throttle knob in step with the aircraft's throttle.
  syncThrottle(v) {
    if (!this.thrKnob || this.touch.throttle != null) return;
    this.thrKnob.style.bottom = `${v * 100}%`;
  }

  buildTouch() {
    const root = document.getElementById('touch');
    root.hidden = false;
    const stick = root.querySelector('.stick'), knob = root.querySelector('.knob');
    const thr = root.querySelector('.throttle'), thrKnob = root.querySelector('.throttle i');
    this.thrKnob = thrKnob;
    let stickId = null;
    stick.addEventListener('touchstart', (e) => { stickId = e.changedTouches[0].identifier; this.touch.active = true; e.preventDefault(); }, { passive: false });
    const move = (e) => {
      for (const tt of e.changedTouches) {
        if (tt.identifier === stickId) {
          const r = stick.getBoundingClientRect();
          const x = Math.max(-1, Math.min(1, ((tt.clientX - r.left) / r.width) * 2 - 1));
          const y = Math.max(-1, Math.min(1, ((tt.clientY - r.top) / r.height) * 2 - 1));
          this.touch.x = x; this.touch.y = y;
          knob.style.transform = `translate(${x * 40}px, ${y * 40}px)`;
        }
        if (tt.target.closest && tt.target.closest('.throttle')) {
          const r = thr.getBoundingClientRect();
          const v = 1 - Math.max(0, Math.min(1, (tt.clientY - r.top) / r.height));
          this.touch.throttle = v;
          thrKnob.style.bottom = `${v * 100}%`;
        }
      }
      e.preventDefault();
    };
    root.addEventListener('touchmove', move, { passive: false });
    thr.addEventListener('touchstart', move, { passive: false });
    stick.addEventListener('touchend', () => { stickId = null; this.touch.active = false; this.touch.x = this.touch.y = 0; knob.style.transform = ''; });
    const btn = (sel, code) => {
      const b = root.querySelector(sel);
      b.addEventListener('touchstart', (e) => { this.pressed.add(code); this.keys.add(code); e.preventDefault(); }, { passive: false });
      b.addEventListener('touchend', () => this.keys.delete(code));
    };
    btn('.b-drop', 'Space');
    btn('.b-flaps', 'KeyV');
    btn('.b-cam', 'KeyC');
    btn('.b-pause', 'KeyP');
    btn('.b-brake', 'KeyB');
    root.querySelector('.b-tilt').addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.touch.tilt = !this.touch.tilt;
      e.target.classList.toggle('on', this.touch.tilt);
      if (this.touch.tilt && typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) DeviceOrientationEvent.requestPermission().catch(() => {});
    }, { passive: false });
    addEventListener('deviceorientation', (e) => {
      if (!this.touch.tilt || e.beta == null) return;
      // Landscape: gamma is pitch, beta is roll.
      this.touch.tiltX = Math.max(-1, Math.min(1, (e.beta || 0) / 25));
      this.touch.tiltY = Math.max(-1, Math.min(1, ((e.gamma || 0) + 45) / 25)) * (screen.orientation && screen.orientation.angle === 270 ? 1 : -1);
    });
  }
}
