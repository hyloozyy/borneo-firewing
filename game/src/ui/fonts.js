// Bundled typefaces (SIL Open Font License, files and licences in game/fonts/): Saira Condensed
// for titles and banners, Saira Stencil One for the logo, B612 (designed for cockpit displays)
// for the HUD and instruments, Barlow for menus, briefing and radio text. Loaded before the
// first frame so canvas text (HUD, cockpit dials, livery) uses them from the start.
export const FONTS = {
  display: '"Saira Condensed", "Arial Narrow", sans-serif',
  logo: '"Saira Stencil One", "Saira Condensed", sans-serif',
  hud: '"B612", "Segoe UI", sans-serif',
  mono: '"B612 Mono", "Consolas", monospace',
  ui: '"Barlow", "Segoe UI", sans-serif',
};

const FACES = [
  ['Saira Condensed', 'SairaCondensed-Bold.ttf', 700],
  ['Saira Condensed', 'SairaCondensed-Black.ttf', 900],
  ['Saira Stencil One', 'SairaStencilOne-Regular.ttf', 400],
  ['B612', 'B612-Regular.ttf', 400],
  ['B612', 'B612-Bold.ttf', 700],
  ['B612 Mono', 'B612Mono-Bold.ttf', 700],
  ['Barlow', 'Barlow-Regular.ttf', 400],
  ['Barlow', 'Barlow-SemiBold.ttf', 600],
  ['Barlow', 'Barlow-Bold.ttf', 700],
];

export async function loadFonts() {
  const base = new URL('../../fonts/', import.meta.url);
  await Promise.all(FACES.map(async ([family, file, weight]) => {
    try {
      const face = new FontFace(family, `url(${new URL(file, base)})`, { weight: String(weight) });
      document.fonts.add(await face.load());
    } catch (e) {
      console.warn('font', file, e.message);
    }
  }));
}
