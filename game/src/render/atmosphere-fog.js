// Aerial perspective for every material: replaces three.js's linear fog with height-dependent haze
// (thick in the valleys, thin aloft) whose colour brightens and warms toward the sun.
// Uses the scene's THREE.Fog: color = haze colour, near = density per metre at sea level,
// far = haze scale height (metres).
import * as THREE from 'three';
import { SUN_DIR } from '../world/sky.js';

export function installAtmosphereFog() {
  const s = SUN_DIR;
  THREE.ShaderChunk.fog_pars_vertex = `
#ifdef USE_FOG
  varying vec3 vFogRel;
#endif`;
  THREE.ShaderChunk.fog_vertex = `
#ifdef USE_FOG
  vFogRel = transpose(mat3(viewMatrix)) * mvPosition.xyz;
#endif`;
  THREE.ShaderChunk.fog_pars_fragment = `
#ifdef USE_FOG
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  varying vec3 vFogRel;
#endif`;
  THREE.ShaderChunk.fog_fragment = `
#ifdef USE_FOG
  {
    vec3 rel = vFogRel;
    float dist = length(rel);
    vec3 dir = rel / max(dist, 1e-3);
    float y0 = cameraPosition.y;
    float y1 = y0 + rel.y;
    float H = fogFar;
    float k = fogNear;
    float dy = y1 - y0;
    float e0 = exp(-max(y0, -50.0) / H);
    float optical = abs(dy) > 0.5 ? k * dist * (e0 - exp(-max(y1, -50.0) / H)) * H / dy : k * dist * e0;
    optical += dist * 0.000018;
    float amount = 1.0 - exp(-max(optical, 0.0));
    float sunAmt = pow(max(dot(dir, vec3(${s.x.toFixed(4)}, ${s.y.toFixed(4)}, ${s.z.toFixed(4)})), 0.0), 6.0);
    vec3 haze = fogColor * (1.0 + 0.35 * dir.y) + vec3(1.0, 0.55, 0.22) * sunAmt * 1.4;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, haze, amount);
  }
#endif`;
}
