// GPU point-sprite particle pool for flames, embers, smoke, spray and the water drop.
// Each pool has a look: 'flame' (licking HDR tongues with a hot core), 'smoke' (billowing noise
// puffs lit by the sun on top and by the fire from below), 'water' (white churning mist).
import * as THREE from 'three';

export const particleUniforms = {
  time: { value: 0 },
  sunView: { value: new THREE.Vector3(0, 1, 0) },
};

const vert = `
attribute float size;
attribute vec4 tint;
attribute float seed;
attribute float age;
varying vec4 vTint;
varying float vSeed;
varying float vAge;
varying float vSize;
uniform float scale;
void main() {
  vTint = tint;
  vSeed = seed;
  vAge = age;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = min(scale * size / -mv.z, 640.0);
  vSize = gl_PointSize;
  gl_Position = projectionMatrix * mv;
}`;

const frag = `
varying vec4 vTint;
varying float vSeed;
varying float vAge;
varying float vSize;
uniform float soft;
uniform float time;
uniform vec3 sunView;
uniform int look;

float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.1 + 3.1; a *= 0.5; } return s; }

void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  p.y = -p.y;
  // Each particle spins slowly and has its own noise offset.
  float ang = vSeed * 6.28 + time * (vSeed - 0.5) * 0.4;
  mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
  vec2 q = rot * p;
  float r = length(p);
  if (look == 1) {
    // Flame: a teardrop of turbulent noise, white-yellow core fading to deep red at the tips.
    vec2 fp = vec2(p.x * 1.5, p.y + 0.35);
    float n = fbm(vec2(fp.x * 2.5 + vSeed * 17.0, fp.y * 2.0 - time * 3.5 - vSeed * 9.0));
    float shape = 1.0 - length(vec2(fp.x * (1.0 + max(fp.y, 0.0) * 1.6), fp.y * 0.75));
    float f = shape + (n - 0.5) * 0.9;
    if (vSize >= 3.0 && f <= 0.02) discard;
    float core = smoothstep(0.15, 0.75, f);
    vec3 col = mix(vec3(1.0, 0.18, 0.02), vec3(1.0, 0.62, 0.18), core);
    col = mix(col, vec3(1.0, 0.92, 0.7), smoothstep(0.55, 0.95, f));
    float a = smoothstep(0.02, 0.3, f) * vTint.a;
    if (vSize < 3.0) { a = vTint.a; col = vec3(1.0, 0.5, 0.1); }
    gl_FragColor = vec4(col * vTint.rgb * 4.0 * a, a);
    return;
  }
  float n = fbm(q * 2.2 + vSeed * 13.0 + vec2(0.0, -time * 0.05));
  float edge = 1.0 - r + (n - 0.5) * 0.9;
  float m = smoothstep(0.0, 0.45, edge);
  if (m <= 0.003) discard;
  // Fake sphere normal, bumped by the noise, for lighting.
  vec3 N = normalize(vec3(p + (vec2(vn(q * 4.0 + vSeed), vn(q * 4.0 - vSeed)) - 0.5) * 0.8, sqrt(max(0.0, 1.0 - r * r)) + 0.2));
  float sun = max(dot(N, sunView), 0.0);
  float through = pow(max(-sunView.z, 0.0), 2.0) * (1.0 - m) * 1.5;
  if (look == 2) {
    // Smoke: dark and fire-lit low down, brown-grey and sun-lit as it rises and thins.
    vec3 base = vTint.rgb;
    vec3 lit = base * (0.35 + 0.15 * N.y) + base * vec3(1.0, 0.78, 0.55) * sun * 1.4 + vec3(0.9, 0.55, 0.3) * through * 0.25;
    float fire = (1.0 - smoothstep(0.0, 0.12, vAge)) * max(0.0, 0.5 - p.y * 0.5); // only the youngest puffs, from below
    lit *= mix(0.62, 1.12, smoothstep(-0.9, 0.8, p.y + N.y * 0.4)); // shaded underside, sun-lit crown
    lit += vec3(2.2, 0.7, 0.15) * fire * 1.2;
    float a = m * vTint.a * (0.55 + n * 0.6);
    gl_FragColor = vec4(lit, a);
    return;
  }
  // Water spray / mist.
  // Churning water: streaky, with shaded hollows between the bright lit lumps.
  float streak = vn(vec2(q.x * 6.0 + vSeed * 9.0, q.y * 1.5 - time * 2.0));
  vec3 lit = vTint.rgb * (0.35 + 0.3 * N.y + 0.75 * sun) * (0.75 + 0.5 * n) * (0.85 + 0.3 * streak);
  float a = m * vTint.a * (0.35 + n * 0.6 + streak * 0.25);
  gl_FragColor = vec4(lit, a);
}`;

const LOOKS = { flame: 1, smoke: 2, water: 3 };

export class ParticlePool {
  constructor(max, { additive = false, soft = 0.1, look = 'water' } = {}) {
    this.max = max;
    this.count = 0;
    this.p = new Float32Array(max * 3);
    this.v = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.age = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.size1 = new Float32Array(max);
    this.c0 = new Float32Array(max * 4);
    this.c1 = new Float32Array(max * 4);
    this.drag = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.kind = new Uint8Array(max);
    this.seedArr = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(new Float32Array(max * 3), 3);
    this.sizeAttr = new THREE.BufferAttribute(new Float32Array(max), 1);
    this.tintAttr = new THREE.BufferAttribute(new Float32Array(max * 4), 4);
    this.ageAttr = new THREE.BufferAttribute(new Float32Array(max), 1);
    this.seedAttr = new THREE.BufferAttribute(new Float32Array(max), 1);
    for (let i = 0; i < max; i++) this.seedArr[i] = (i * 0.618034) % 1;
    g.setAttribute('position', this.posAttr);
    g.setAttribute('size', this.sizeAttr);
    g.setAttribute('tint', this.tintAttr);
    g.setAttribute('seed', this.seedAttr);
    g.setAttribute('age', this.ageAttr);
    for (const a of [this.posAttr, this.sizeAttr, this.tintAttr, this.ageAttr, this.seedAttr]) a.setUsage(THREE.DynamicDrawUsage);
    this.material = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 600 }, soft: { value: soft }, look: { value: LOOKS[look] }, ...particleUniforms },
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    if (additive) {
      // Premultiplied additive so flames add light without washing everything to white.
      this.material.blending = THREE.CustomBlending;
      this.material.blendSrc = THREE.OneFactor;
      this.material.blendDst = THREE.OneMinusSrcAlphaFactor;
    }
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.onLand = null;
    this.nextSeed = 0;
  }

  // spawn(x,y,z, vx,vy,vz, life, size0, size1, rgba0[4], rgba1[4], drag, gravity, kind)
  spawn(x, y, z, vx, vy, vz, life, s0, s1, c0, c1, drag = 0, grav = 0, kind = 0) {
    if (this.count >= this.max) return;
    const i = this.count++;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.life[i] = life; this.age[i] = 0;
    this.size0[i] = s0; this.size1[i] = s1;
    for (let k = 0; k < 4; k++) { this.c0[i * 4 + k] = c0[k]; this.c1[i * 4 + k] = c1[k]; }
    this.drag[i] = drag; this.grav[i] = grav; this.kind[i] = kind;
    this.nextSeed = (this.nextSeed + 0.618034) % 1;
    this.seedArr[i] = this.nextSeed;
  }

  kill(i) {
    const j = --this.count;
    if (i === j) return;
    this.p.copyWithin(i * 3, j * 3, j * 3 + 3);
    this.v.copyWithin(i * 3, j * 3, j * 3 + 3);
    this.c0.copyWithin(i * 4, j * 4, j * 4 + 4);
    this.c1.copyWithin(i * 4, j * 4, j * 4 + 4);
    this.life[i] = this.life[j]; this.age[i] = this.age[j];
    this.size0[i] = this.size0[j]; this.size1[i] = this.size1[j];
    this.drag[i] = this.drag[j]; this.grav[i] = this.grav[j]; this.kind[i] = this.kind[j];
    this.seedArr[i] = this.seedArr[j];
  }

  update(dt, wind, groundAt) {
    const P = this.posAttr.array, S = this.sizeAttr.array, T = this.tintAttr.array, A = this.ageAttr.array, D = this.seedAttr.array;
    for (let i = 0; i < this.count; i++) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) { this.kill(i); i--; continue; }
      const k = i * 3;
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.v[k] = this.v[k] * d + wind.x * this.drag[i] * dt;
      this.v[k + 1] = this.v[k + 1] * d + this.grav[i] * dt;
      this.v[k + 2] = this.v[k + 2] * d + wind.z * this.drag[i] * dt;
      this.p[k] += this.v[k] * dt; this.p[k + 1] += this.v[k + 1] * dt; this.p[k + 2] += this.v[k + 2] * dt;
      if (this.kind[i] === 1 && groundAt) {
        const gh = groundAt(this.p[k], this.p[k + 2]);
        if (this.p[k + 1] <= gh) {
          if (this.onLand) this.onLand(this.p[k], gh, this.p[k + 2]);
          this.kill(i); i--; continue;
        }
      }
    }
    for (let i = 0; i < this.count; i++) {
      const t = this.age[i] / this.life[i];
      P[i * 3] = this.p[i * 3]; P[i * 3 + 1] = this.p[i * 3 + 1]; P[i * 3 + 2] = this.p[i * 3 + 2];
      S[i] = this.size0[i] + (this.size1[i] - this.size0[i]) * Math.sqrt(t);
      A[i] = t;
      D[i] = this.seedArr[i];
      const fadeIn = Math.min(1, this.age[i] * 5);
      for (let c = 0; c < 4; c++) T[i * 4 + c] = this.c0[i * 4 + c] + (this.c1[i * 4 + c] - this.c0[i * 4 + c]) * t;
      T[i * 4 + 3] *= fadeIn;
    }
    this.points.geometry.setDrawRange(0, this.count);
    for (const a of [this.posAttr, this.sizeAttr, this.tintAttr, this.ageAttr, this.seedAttr]) a.needsUpdate = true;
  }

  setViewportHeight(h) {
    this.material.uniforms.scale.value = h * 0.9;
  }
}
