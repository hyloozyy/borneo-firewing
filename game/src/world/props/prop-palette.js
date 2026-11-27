// Every material the airfield and village props are built from: PBR texture sets tinted per use
// (bare and painted zinc, weathered and painted planks, ironwood shingles, thatch, concrete, steel),
// reflective glass, lit windows, lamps, rubber and fabric. Created once and shared.
import * as THREE from 'three';
import { propMaterial, signTexture } from './prop-textures.js';

let palette = null;

export function propPalette(size = 512) {
  if (palette) return palette;
  const P = (kind, color, extra) => propMaterial(kind, color, extra, size);
  const painted = { metalness: 0.12 };
  const basic = (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, ...extra });
  palette = {
    zinc: P('corrugated', 0xdcdcd8),
    zincRust: P('corrugated', 0xc4ab92),
    zincWhite: P('corrugatedPainted', 0xf1ede3, painted),
    zincRed: P('corrugatedPainted', 0xb02a1e, painted),
    zincGreen: P('corrugatedPainted', 0x5d7f62, painted),
    concrete: P('concrete', 0xffffff),
    concreteWhite: P('concrete', 0xf6f1e6),
    steel: P('steel', 0x6a6e72),
    steelWhite: P('steel', 0xffffff),
    steelRed: P('steel', 0xc62c1f),
    steelYellow: P('steel', 0xe2ad22),
    steelBlue: P('steel', 0x2f5f9a),
    wood: P('planks', 0xffffff),
    woodDark: P('planks', 0x8a7a6a),
    woodGreen: P('planks', 0xa9c9b1),
    woodBlue: P('planks', 0xa8bfd2),
    woodCream: P('planks', 0xf0e2c6),
    woodOchre: P('planks', 0xd8a86a),
    hullBlue: P('planks', 0x4f86a6, { side: THREE.DoubleSide }),
    hullGreen: P('planks', 0x4f9271, { side: THREE.DoubleSide }),
    hullRed: P('planks', 0xae4a36, { side: THREE.DoubleSide }),
    shingle: P('shingles', 0xffffff),
    thatch: P('thatch', 0xffffff),
    rock: P('rock', 0xffffff),
    glass: std(0x1c2a33, { roughness: 0.05, metalness: 0.7, envMapIntensity: 1.8 }),
    glassLit: std(0x16120e, { roughness: 0.08, metalness: 0.3, emissive: 0xffb15e, emissiveIntensity: 0.9 }),
    glassTower: std(0x2a3a44, { roughness: 0.04, metalness: 0.6, transparent: true, opacity: 0.55, envMapIntensity: 2 }),
    interior: std(0x2b2621, { roughness: 0.95 }),
    interiorLit: std(0x3a3026, { roughness: 0.9, emissive: 0x6e4a26, emissiveIntensity: 0.6 }),
    rubber: std(0x18181a, { roughness: 0.92 }),
    chrome: std(0xd8dde2, { roughness: 0.15, metalness: 1 }),
    lamp: basic(0xffe2b0),
    lampRed: basic(0xff3b2a),
    lampGreen: basic(0x6dff8a),
    lampAmber: basic(0xffa733),
    paintYellow: std(0xd7a321, { roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    paintWhite: std(0xe8e4da, { roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    fabricOrange: std(0xff5a12, { roughness: 0.85, side: THREE.DoubleSide }),
    fabricWhite: std(0xf2efe8, { roughness: 0.85, side: THREE.DoubleSide }),
    clothA: std(0xc23a4a, { roughness: 0.9, side: THREE.DoubleSide }),
    clothB: std(0x3a7bc2, { roughness: 0.9, side: THREE.DoubleSide }),
    clothC: std(0xe8c43a, { roughness: 0.9, side: THREE.DoubleSide }),
    clothD: std(0xf2f0ea, { roughness: 0.9, side: THREE.DoubleSide }),
    drumRed: P('steel', 0xa8261c),
    drumBlue: P('steel', 0x1f4f8a),
    tankPlastic: std(0x2c62b8, { roughness: 0.45 }),
    tankOrange: std(0xe07a1c, { roughness: 0.45 }),
    rope: std(0x8a7656, { roughness: 1 }),
    signBase: new THREE.MeshStandardMaterial({ map: signTexture([{ text: 'POSKO DAMKAR', size: 104 }, { text: 'BORNEO AIR FIRE BASE  ·  FW-218', size: 52 }], { w: 1536, h: 320 }), roughness: 0.6 }),
    signFuel: new THREE.MeshStandardMaterial({ map: signTexture([{ text: 'AVTUR  ·  NO SMOKING', size: 70 }], { w: 1024, h: 160, bg: '#c62c1f', fg: '#ffffff' }), roughness: 0.6 }),
    signTaxi: new THREE.MeshStandardMaterial({ map: signTexture([{ text: 'A  ←  18-36', size: 110 }], { w: 512, h: 160, bg: '#121212', fg: '#f2c02a', font: 'JetBrains Mono', weight: 700 }), roughness: 0.6, emissive: 0x332200, emissiveIntensity: 0.4 }),
  };
  for (const k of ['lamp', 'lampRed', 'lampGreen', 'lampAmber']) palette[k].userData.noShadow = true;
  palette.glassTower.userData.noShadow = true;
  return palette;
}
