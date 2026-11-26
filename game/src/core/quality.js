// Graphics level: full detail on desktop, a lighter level auto-selected on phones (or ?quality=low).
export function pickQuality() {
  const q = new URLSearchParams(location.search).get('quality');
  const phone = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const low = q === 'low' || (phone && q !== 'high');
  const pr = Number(new URLSearchParams(location.search).get('pr')); // ?pr=0.5 render-scale override (testing)
  const out = low
    ? { name: 'low', phone, // phones: no MSAA, no shadows or reflections, fewer trees, particles and clouds
       treeSpacing: 26, shrubChance: 0.2, hiTreeRadius: 150, loTreeRadius: 520, shrubRadius: 110, impostorCell: 128, treeShadows: false, msaa: 0, grass: 12000, reflections: false, groundTexture: 256, shadowSize: 1024, shadowBox: 90, terrainSegments: 140, flameParticles: 1500, smokeParticles: 800, waterParticles: 1000, pixelRatio: Math.min(devicePixelRatio, phone ? 1.25 : 1), shadows: false, clouds: 14, birds: 3 }
    : { name: 'high', phone: false, treeSpacing: 16, shrubChance: 0.3, hiTreeRadius: 230, loTreeRadius: 600, shrubRadius: 170, impostorCell: 256, treeShadows: true, msaa: 4, grass: 60000, reflections: true, groundTexture: 512, shadowSize: 4096, shadowBox: 170, terrainSegments: 360, flameParticles: 4500, smokeParticles: 2200, waterParticles: 3000, pixelRatio: Math.min(devicePixelRatio, 1.75), shadows: true, clouds: 30, birds: 5 };
  if (pr > 0) out.pixelRatio = pr;
  return out;
}
