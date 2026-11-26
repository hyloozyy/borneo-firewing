// Keeps the game smooth on weaker machines: watches the frame time while flying and, if it stays
// slow, steps down render resolution first, then water reflections, then resolution again.
export class AutoQuality {
  constructor(game) {
    this.game = game;
    this.acc = 0;
    this.frames = 0;
    this.level = 0;
    this.enabled = !new URLSearchParams(location.search).has('shot');
  }

  sample(dt) {
    if (!this.enabled || this.game.state !== 'playing' || dt > 0.5) return;
    this.acc += dt;
    this.frames++;
    if (this.acc < 4) return;
    const fps = this.frames / this.acc;
    this.acc = 0;
    this.frames = 0;
    if (fps < 28 && this.level < 3) this.stepDown();
  }

  stepDown() {
    const g = this.game, q = g.quality;
    this.level++;
    if (this.level === 1 || this.level === 3) {
      q.pixelRatio = Math.max(0.6, q.pixelRatio * 0.75);
      g.renderer.setPixelRatio(q.pixelRatio);
      g.resize();
    } else if (this.level === 2) {
      q.reflections = false;
      g.waterSurface.uniforms.useRefl.value = 0;
      g.forest.reduceDetail();
    }
  }
}
