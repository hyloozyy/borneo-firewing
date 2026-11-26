// Graphics level: full detail on desktop, a lighter level auto-selected on phones (or ?quality=low).
export function pickQuality() {
  const q = new URLSearchParams(location.search).get('quality');
  const phone = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const low = q === 'low' || (phone && q !== 'high');
  return low
    ? { name: 'low', trees: 7000, hiTrees: 260, hiTreeRadius: 220, treeShadows: false, msaa: 0, grass: 12000, reflections: false, groundTexture: 256, shadowSize: 1024, shadowBox: 90, terrainSegments: 160, flameParticles: 1800, smokeParticles: 900, waterParticles: 1200, pixelRatio: 1, shadows: false, clouds: 16, birds: 2 }
    : { name: 'high', trees: 22000, hiTrees: 1500, hiTreeRadius: 430, treeShadows: true, msaa: 4, grass: 60000, reflections: true, groundTexture: 512, shadowSize: 4096, shadowBox: 170, terrainSegments: 360, flameParticles: 4500, smokeParticles: 2200, waterParticles: 3000, pixelRatio: Math.min(devicePixelRatio, 1.75), shadows: true, clouds: 30, birds: 5 };
}
