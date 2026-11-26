// GPU point-sprite particle pool used for flames, embers, smoke, spray and the water drop.
import * as THREE from 'three';

const vert = `
attribute float size;
attribute vec4 tint;
attribute float seed;
varying vec4 vTint;
varying float vSeed;
uniform float scale;
void main() {
  vTint = tint;
  vSeed = seed;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = min(scale * size / -mv.z, 420.0);
  gl_Position = projectionMatrix * mv;
}`;

const frag = `
varying vec4 vTint;
varying float vSeed;
uniform float soft;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float a = atan(p.y, p.x);
  float wob = 1.0 + 0.18 * sin(a * 5.0 + vSeed * 6.28) + 0.1 * sin(a * 9.0 - vSeed * 12.0);
  float r = length(p) * wob;
  float m = smoothstep(1.0, soft, r);
  if (m <= 0.002) discard;
  gl_FragColor = vec4(vTint.rgb, vTint.a * m);
}`;

export class ParticlePool {
  constructor(max, { additive = false, soft = 0.1 } = {}) {
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
    const g = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(new Float32Array(max * 3), 3);
    this.sizeAttr = new THREE.BufferAttribute(new Float32Array(max), 1);
    this.tintAttr = new THREE.BufferAttribute(new Float32Array(max * 4), 4);
    const seeds = new Float32Array(max);
    for (let i = 0; i < max; i++) seeds[i] = (i * 0.618) % 1;
    g.setAttribute('position', this.posAttr);
    g.setAttribute('size', this.sizeAttr);
    g.setAttribute('tint', this.tintAttr);
    g.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr.setUsage(THREE.DynamicDrawUsage);
    this.tintAttr.setUsage(THREE.DynamicDrawUsage);
    this.material = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 600 }, soft: { value: soft } },
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.onLand = null;
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
  }

  update(dt, wind, groundAt) {
    const P = this.posAttr.array, S = this.sizeAttr.array, T = this.tintAttr.array;
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
      S[i] = this.size0[i] + (this.size1[i] - this.size0[i]) * t;
      const fadeIn = Math.min(1, this.age[i] * 6);
      for (let c = 0; c < 4; c++) T[i * 4 + c] = this.c0[i * 4 + c] + (this.c1[i * 4 + c] - this.c0[i * 4 + c]) * t;
      T[i * 4 + 3] *= fadeIn;
    }
    this.points.geometry.setDrawRange(0, this.count);
    this.posAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
    this.tintAttr.needsUpdate = true;
  }

  setViewportHeight(h) {
    this.material.uniforms.scale.value = h * 0.9;
  }
}
