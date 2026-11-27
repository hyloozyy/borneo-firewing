// Every sound synthesised with Web Audio: twin turboprop drone, wind, scoop roar, water drop,
// fire crackle, radio beeps, success chime and crash.
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.build();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  noiseBuffer() {
    const len = this.ctx.sampleRate * 2;
    const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = last * 0.97 + (Math.random() * 2 - 1) * 0.3; d[i] = last; }
    return b;
  }

  loopNoise(filterType, freq, q) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(this.master);
    src.start();
    return { f, g };
  }

  build() {
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(c.destination);
    this.noise = this.noiseBuffer();
    // Turboprop: two detuned buzzing oscillators through a low-pass, plus a turbine whine.
    this.engine = [];
    for (const det of [0, 3.5]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      const f = c.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 400;
      const g = c.createGain(); g.gain.value = 0;
      o.connect(f).connect(g).connect(this.master);
      o.start();
      this.engine.push({ o, f, g, det });
    }
    this.whine = c.createOscillator();
    this.whine.type = 'sine';
    this.whineGain = c.createGain(); this.whineGain.gain.value = 0;
    this.whine.connect(this.whineGain).connect(this.master);
    this.whine.start();
    this.wind = this.loopNoise('bandpass', 800, 0.6);
    this.scoop = this.loopNoise('lowpass', 1200, 0.5);
    this.drop = this.loopNoise('bandpass', 500, 0.4);
    this.fire = this.loopNoise('highpass', 2500, 0.7);
    this.rain = this.loopNoise('highpass', 1800, 0.4);
  }

  // Thunder: a low rumbling noise burst that rolls on for a few seconds.
  thunder(vol = 1) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(420, t); f.frequency.exponentialRampToValueAtTime(70, t + 4);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.9 * Math.max(0.3, vol), t + 0.08);
    g.gain.setTargetAtTime(0.35 * vol, t + 0.4, 0.3);
    g.gain.setTargetAtTime(0, t + 1.6, 1.1);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 6);
  }

  update(s, fireNear, time) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const rpm = s.rpm;
    // One voice per engine: a failed engine falls silent, a damaged one runs rough.
    this.engine.forEach((e, i) => {
      const r = s.engRpm ? s.engRpm[i] : rpm;
      const eng = s.damage?.engines[i];
      const rough = eng ? (1 - eng.health) * Math.sin(time * 17 + i) * 6 : 0;
      e.o.frequency.setTargetAtTime(38 + r * 62 + e.det + rough, t, 0.1);
      e.f.frequency.setTargetAtTime(220 + r * 900, t, 0.1);
      e.g.gain.setTargetAtTime(r > 0.02 ? 0.05 + r * 0.09 : 0, t, 0.2);
    });
    this.whine.frequency.setTargetAtTime(1800 + rpm * 2600, t, 0.2);
    this.whineGain.gain.setTargetAtTime(rpm * 0.012, t, 0.2);
    const v = s.airspeed;
    this.wind.g.gain.setTargetAtTime(Math.min(0.5, v / 160), t, 0.2);
    this.wind.f.frequency.setTargetAtTime(400 + v * 12, t, 0.2);
    this.scoop.g.gain.setTargetAtTime(s.scooping ? 0.9 : s.onWater ? 0.25 : 0, t, 0.08);
    this.drop.g.gain.setTargetAtTime(s.doors > 0.3 && s.water > 0 ? 0.8 : 0, t, 0.1);
    const crackle = fireNear * (Math.random() < 0.3 ? 1 : 0.2);
    this.fire.g.gain.setTargetAtTime(crackle * 0.5, t, 0.02);
    this.rain.g.gain.setTargetAtTime((s.rain || 0) * 0.22, t, 0.5);
  }

  beep(freq, dur, when = 0, type = 'square', vol = 0.08) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  radioBeep() { this.beep(1200, 0.08); this.beep(1600, 0.1, 0.1); }
  ringChime() { this.beep(880, 0.15, 0, 'triangle', 0.15); this.beep(1320, 0.25, 0.08, 'triangle', 0.12); }
  success() { [523, 659, 784, 1046].forEach((f, i) => this.beep(f, 0.35, i * 0.12, 'triangle', 0.13)); }
  // Master caution chime (single) or master warning (triple, harsher) for damage events.
  caution(level) {
    if (level === 'warning') [0, 0.22, 0.44].forEach((w) => this.beep(740, 0.16, w, 'square', 0.07));
    else { this.beep(1046, 0.18, 0, 'sine', 0.12); this.beep(784, 0.3, 0.16, 'sine', 0.1); }
  }
  // Fire bottle discharge: a short hiss.
  extinguisher() {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3000;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    src.connect(f).connect(g).connect(this.master);
    src.start(); src.stop(t + 1.5);
  }
  stallWarn() { this.beep(420, 0.12, 0, 'square', 0.06); }
  crash() {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(1.2, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 2.5);
    src.connect(g).connect(this.master);
    src.start();
    src.stop(this.ctx.currentTime + 2.6);
  }

  silence() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const e of this.engine) e.g.gain.setTargetAtTime(0, t, 0.1);
    for (const n of [this.wind, this.scoop, this.drop, this.fire, this.rain]) n.g.gain.setTargetAtTime(0, t, 0.1);
    this.whineGain.gain.setTargetAtTime(0, t, 0.1);
  }
}
