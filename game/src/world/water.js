// Sea, lake and river share one reflective water surface at sea level, with drifting ripples.
import * as THREE from 'three';
import { waterNormalTexture } from '../core/canvas-textures.js';
import { WORLD_SIZE } from './terrain.js';

export function buildWater() {
  const normals = waterNormalTexture();
  normals.repeat.set(520, 520);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x123638,
    roughness: 0.08,
    metalness: 0.15,
    normalMap: normals,
    normalScale: new THREE.Vector2(0.22, 0.22),
    transparent: true,
    opacity: 0.93,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_SIZE * 1.6, WORLD_SIZE * 1.6), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0;
  mesh.receiveShadow = true;
  mesh.name = 'water';
  return {
    mesh,
    update(t) {
      normals.offset.set(t * 0.004, t * 0.0027);
    },
  };
}
