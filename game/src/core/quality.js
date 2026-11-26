// Graphics level: full detail on desktop, a lighter level auto-selected on phones (or ?quality=low).
export function pickQuality() {
  const q = new URLSearchParams(location.search).get('quality');
  const phone = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const low = q === 'low' || (phone && q !== 'high');
  return low
    ? { name: 'low', trees: 5000, terrainSegments: 160, flameParticles: 1800, smokeParticles: 900, waterParticles: 1200, pixelRatio: 1, shadows: false, clouds: 14, birds: 2 }
    : { name: 'high', trees: 22000, terrainSegments: 240, flameParticles: 4500, smokeParticles: 2200, waterParticles: 3000, pixelRatio: Math.min(devicePixelRatio, 1.75), shadows: true, clouds: 26, birds: 5 };
}
