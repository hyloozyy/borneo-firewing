// GTA-style camera gestures on the free screen area (the 3D view itself; stick, throttle and
// buttons sit above it and keep their own fingers). One finger drags the camera around the plane
// (or the pilot's head in the cockpit), two fingers pinch to zoom, a double tap recentres.
// Deltas are written into the shared `out` object that the camera rig reads every frame.
export class TouchLook {
  constructor(dom, out, onRecentre) {
    this.out = out;
    this.fingers = new Map();
    this.pinchD = 0;
    this.lastTap = 0;
    this.active = false;
    dom.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      e.preventDefault();
      dom.setPointerCapture(e.pointerId);
      this.fingers.set(e.pointerId, { x: e.clientX, y: e.clientY, t0: performance.now(), x0: e.clientX, y0: e.clientY });
      this.active = true;
      if (this.fingers.size === 2) this.pinchD = this.spread();
    });
    dom.addEventListener('pointermove', (e) => {
      const f = this.fingers.get(e.pointerId);
      if (!f) return;
      if (this.fingers.size >= 2) {
        f.x = e.clientX; f.y = e.clientY;
        const d = this.spread();
        if (this.pinchD > 0 && d > 0) out.pinch *= this.pinchD / d;
        this.pinchD = d;
        return;
      }
      // Swipe sensitivity scales with the screen so a full-width swipe is about a half turn.
      const k = 900 / Math.max(500, innerWidth);
      out.dx += (e.clientX - f.x) * 1.6 * k;
      out.dy += (e.clientY - f.y) * 1.3 * k;
      f.x = e.clientX; f.y = e.clientY;
    });
    const end = (e) => {
      const f = this.fingers.get(e.pointerId);
      if (!f) return;
      this.fingers.delete(e.pointerId);
      const now = performance.now();
      const tap = now - f.t0 < 250 && Math.hypot(e.clientX - f.x0, e.clientY - f.y0) < 12;
      if (tap) {
        if (now - this.lastTap < 350) { onRecentre(); this.lastTap = 0; } else this.lastTap = now;
      }
      this.pinchD = this.fingers.size === 2 ? this.spread() : 0;
      this.active = this.fingers.size > 0;
    };
    dom.addEventListener('pointerup', end);
    dom.addEventListener('pointercancel', end);
  }

  spread() {
    const [a, b] = [...this.fingers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
}
