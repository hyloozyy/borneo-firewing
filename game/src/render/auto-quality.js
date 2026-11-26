// Keeps the game smooth on weaker machines without blurring it: watches the frame time while
// flying and, if it stays slow, first drops scene cost (water reflections, lighter forest), and
// only then trims resolution, never below the screen's own pixels (ratio 1).
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
    if (fps < 28 && this.level < 4) this.stepDown();
  }

  stepDown() {
    const g = this.game, q = g.quality;
    this.level++;
    if (this.level === 1) {
      q.reflections = false;
      g.waterSurface.uniforms.useRefl.value = 0;
    } else if (this.level === 2) {
      g.forest.reduceDetail();
    } else if (q.pixelRatio > 1) {
      q.pixelRatio = Math.max(1, q.pixelRatio * 0.85);
      g.renderer.setPixelRatio(q.pixelRatio);
      g.resize();
    }
  }
}
