// Bundled typefaces (SIL Open Font License, files and licences in game/fonts/): a modern, quiet
// type system. Michroma (wide, aerospace-style display face) for the logo and big titles, Manrope
// (variable 200-800, a refined geometric grotesk) for every menu, label and HUD caption, JetBrains
// Mono (variable) for numbers that change: speeds, altitudes, timers, gauges. Saira Condensed Black
// stays only as the sign-writer's lettering painted on the aircraft. Loaded before the first frame
// so canvas text (HUD, cockpit dials, livery) uses them from the start.
export const FONTS = {
  display: '"Manrope", "Segoe UI", sans-serif',
  logo: '"Michroma", "Manrope", sans-serif',
  hud: '"Manrope", "Segoe UI", sans-serif',
  mono: '"JetBrains Mono", "Consolas", monospace',
  ui: '"Manrope", "Segoe UI", sans-serif',
  livery: '"Saira Condensed", "Arial Narrow", sans-serif',
};

const FACES = [
  ['Manrope', 'Manrope-Variable.ttf', '200 800'],
  ['Michroma', 'Michroma-Regular.ttf', '400'],
  ['JetBrains Mono', 'JetBrainsMono-Variable.ttf', '100 800'],
  ['Saira Condensed', 'SairaCondensed-Black.ttf', '900'],
];

export async function loadFonts() {
  const base = new URL('../../fonts/', import.meta.url);
  await Promise.all(FACES.map(async ([family, file, weight]) => {
    try {
      const face = new FontFace(family, `url(${new URL(file, base)})`, { weight });
      document.fonts.add(await face.load());
    } catch (e) {
      console.warn('font', file, e.message);
    }
  }));
}
