// HDR post-processing: the scene renders into a multisampled half-float target, then a bloom chain
// (bright-pass + blurred mip pyramid), sun glare ghosts, ACES filmic tone mapping, colour grading,
// vignette and fine grain are composited to the screen.
import * as THREE from 'three';

const fullVert = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const brightFrag = `
uniform sampler2D src;
uniform float threshold;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(src, vUv).rgb;
  float l = max(max(c.r, c.g), c.b);
  float k = max(l - threshold, 0.0) / max(l, 1e-4);
  gl_FragColor = vec4(min(c * k, vec3(60.0)), 1.0);
}`;

// 9-tap separable gaussian (linear-sampled offsets).
const blurFrag = `
uniform sampler2D src;
uniform vec2 dir;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(src, vUv).rgb * 0.2270270270;
  c += texture2D(src, vUv + dir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(src, vUv - dir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(src, vUv + dir * 3.2307692308).rgb * 0.0702702703;
  c += texture2D(src, vUv - dir * 3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}`;

const compositeFrag = `
uniform sampler2D scene;
uniform sampler2D bloom0;
uniform sampler2D bloom1;
uniform sampler2D bloom2;
uniform sampler2D bloom3;
uniform float exposure;
uniform float bloomStrength;
uniform vec2 sunUv;
uniform float sunVisible;
uniform float time;
uniform float aspect;
varying vec2 vUv;

vec3 acesFitted(vec3 v) {
  const mat3 inM = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
  const mat3 outM = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
  v = inM * v;
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return clamp(outM * (a / b), 0.0, 1.0);
}

vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + time) * 43758.5453); }

void main() {
  vec3 c = texture2D(scene, vUv).rgb;
  vec3 b = texture2D(bloom0, vUv).rgb * 0.5 + texture2D(bloom1, vUv).rgb * 0.7 + texture2D(bloom2, vUv).rgb * 0.9 + texture2D(bloom3, vUv).rgb * 1.1;
  c += b * bloomStrength;
  // Sun glare: soft ghosts mirrored through the screen centre, and a warm veil when facing the sun.
  if (sunVisible > 0.0) {
    vec2 toC = vec2(0.5) - sunUv;
    vec3 ghosts = vec3(0.0);
    for (int i = 1; i <= 4; i++) {
      vec2 gp = sunUv + toC * (float(i) * 0.48);
      float d = length((vUv - gp) * vec2(aspect, 1.0));
      float r = 0.02 + 0.025 * float(i);
      ghosts += vec3(1.0, 0.7, 0.4) * smoothstep(r, r * 0.5, d) * 0.035 / float(i);
    }
    float veil = exp(-length((vUv - sunUv) * vec2(aspect, 1.0)) * 3.5);
    float streak = exp(-abs(vUv.y - sunUv.y) * 90.0) * exp(-abs(vUv.x - sunUv.x) * 2.2);
    c += (ghosts + vec3(1.0, 0.6, 0.3) * (veil * 0.12 + streak * 0.25)) * sunVisible;
  }
  c *= exposure;
  c = acesFitted(c);
  // Grade: gentle contrast S-curve, warm highlights, slightly teal shadows, a touch more saturation.
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, 1.1);
  c = mix(c, c * vec3(0.93, 1.0, 1.04), (1.0 - smoothstep(0.0, 0.45, l)) * 0.5);
  c = mix(c, c * vec3(1.04, 1.0, 0.95), smoothstep(0.5, 1.0, l) * 0.5);
  c = clamp(c, 0.0, 1.0);
  c = c * c * (3.0 - 2.0 * c) * 0.18 + c * 0.82;
  vec2 q = vUv - 0.5;
  c *= 1.0 - dot(q * vec2(aspect * 0.55, 1.0), q * vec2(aspect * 0.55, 1.0)) * 0.55;
  c = toSRGB(c);
  c += (hash(vUv * 731.0) - 0.5) * 0.012;
  gl_FragColor = vec4(c, 1.0);
}`;

function pass(frag, uniforms) {
  return new THREE.ShaderMaterial({ vertexShader: fullVert, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
}

export class PostPipeline {
  constructor(renderer, quality) {
    this.renderer = renderer;
    this.enabled = true;
    const type = THREE.HalfFloatType;
    this.sceneRT = new THREE.WebGLRenderTarget(1, 1, { type, samples: quality.msaa, depthBuffer: true });
    this.levels = [];
    for (let i = 0; i < 4; i++) {
      this.levels.push({
        a: new THREE.WebGLRenderTarget(1, 1, { type, depthBuffer: false }),
        b: new THREE.WebGLRenderTarget(1, 1, { type, depthBuffer: false }),
      });
    }
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quad);
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.bright = pass(brightFrag, { src: { value: null }, threshold: { value: 1.6 } });
    this.blur = pass(blurFrag, { src: { value: null }, dir: { value: new THREE.Vector2() } });
    this.composite = pass(compositeFrag, {
      scene: { value: this.sceneRT.texture },
      bloom0: { value: this.levels[0].a.texture },
      bloom1: { value: this.levels[1].a.texture },
      bloom2: { value: this.levels[2].a.texture },
      bloom3: { value: this.levels[3].a.texture },
      exposure: { value: 0.8 },
      bloomStrength: { value: 0.16 },
      sunUv: { value: new THREE.Vector2() },
      sunVisible: { value: 0 },
      time: { value: 0 },
      aspect: { value: 1 },
    });
    this.sunWorld = new THREE.Vector3();
  }

  setSize(w, h, pr) {
    const W = Math.floor(w * pr), H = Math.floor(h * pr);
    this.sceneRT.setSize(W, H);
    let lw = Math.max(1, W >> 1), lh = Math.max(1, H >> 1);
    for (const l of this.levels) {
      l.a.setSize(lw, lh); l.b.setSize(lw, lh);
      l.w = lw; l.h = lh;
      lw = Math.max(1, lw >> 1); lh = Math.max(1, lh >> 1);
    }
    this.composite.uniforms.aspect.value = w / h;
  }

  draw(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  render(scene, camera, sunDir, time) {
    const r = this.renderer;
    if (!this.enabled) { r.setRenderTarget(null); r.render(scene, camera); return; }
    r.setRenderTarget(this.sceneRT);
    r.render(scene, camera);
    // Bloom pyramid: bright-pass into level 0, then downsample + blur each level.
    let src = this.sceneRT.texture;
    this.levels.forEach((l, i) => {
      if (i === 0) { this.bright.uniforms.src.value = src; this.draw(this.bright, l.b); }
      else { this.blur.uniforms.src.value = this.levels[i - 1].a.texture; this.blur.uniforms.dir.value.set(0, 0); this.draw(this.blur, l.b); }
      this.blur.uniforms.src.value = l.b.texture; this.blur.uniforms.dir.value.set(1 / l.w, 0); this.draw(this.blur, l.a);
      this.blur.uniforms.src.value = l.a.texture; this.blur.uniforms.dir.value.set(0, 1 / l.h); this.draw(this.blur, l.b);
      this.blur.uniforms.src.value = l.b.texture; this.blur.uniforms.dir.value.set(1.6 / l.w, 1.6 / l.h); this.draw(this.blur, l.a);
    });
    // Where the sun is on screen (for glare), fading out as it leaves the view.
    const u = this.composite.uniforms;
    this.sunWorld.copy(camera.position).addScaledVector(sunDir, 5000).project(camera);
    const facing = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).dot(sunDir);
    u.sunUv.value.set(this.sunWorld.x * 0.5 + 0.5, this.sunWorld.y * 0.5 + 0.5);
    const edge = Math.max(Math.abs(this.sunWorld.x), Math.abs(this.sunWorld.y));
    u.sunVisible.value = facing > 0 ? Math.max(0, 1 - Math.max(0, edge - 0.9) * 2.5) * Math.min(1, facing * 3) : 0;
    u.time.value = time % 100;
    this.draw(this.composite, null);
  }
}
