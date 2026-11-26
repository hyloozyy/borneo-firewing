// Golden-hour sky dome with sun disc, glow and a smoky haze band; also the sun and ambient lights.
import * as THREE from 'three';

export const SUN_DIR = new THREE.Vector3(-0.62, 0.2, 0.76).normalize();

const vert = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const frag = `
uniform vec3 sunDir;
uniform vec3 zenith;
uniform vec3 horizon;
uniform vec3 haze;
uniform float smoke;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.2, 1.0);
  vec3 col = mix(horizon, zenith, pow(max(h, 0.0), 0.55));
  float s = max(dot(d, sunDir), 0.0);
  col += vec3(1.0, 0.62, 0.3) * pow(s, 8.0) * 0.55;
  col += vec3(1.0, 0.8, 0.5) * pow(s, 64.0) * 0.8;
  col = mix(col, vec3(1.0, 0.96, 0.85) * 3.0, smoothstep(0.9993, 0.9996, s));
  float band = exp(-abs(d.y) * 9.0);
  col = mix(col, haze, band * (0.55 + smoke * 0.3));
  if (d.y < 0.0) col = haze;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function buildSky(scene) {
  const uniforms = {
    sunDir: { value: SUN_DIR },
    zenith: { value: new THREE.Color(0x2e4f80) },
    horizon: { value: new THREE.Color(0xf0a868) },
    haze: { value: new THREE.Color(0xc99a78) },
    smoke: { value: 0.4 },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 16),
    new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, side: THREE.BackSide, depthWrite: false }),
  );
  dome.scale.setScalar(20000);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  scene.add(dome);

  scene.fog = new THREE.Fog(0xc39878, 900, 7600);

  const hemi = new THREE.HemisphereLight(0xffd7b0, 0x2a3a1c, 1.25);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffc98f, 2.6);
  sun.position.copy(SUN_DIR).multiplyScalar(400);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera;
  sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 10; sc.far = 900;
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  scene.add(sun.target);

  return {
    dome,
    sun,
    uniforms,
    follow(target) {
      dome.position.copy(target);
      sun.target.position.copy(target);
      sun.position.copy(target).addScaledVector(SUN_DIR, 400);
    },
  };
}
