// Loading screen with a progress bar (the world is built in steps), and recovery when the browser
// drops the WebGL context (phones do this under memory pressure): reload in the light graphics
// level and put the player back into the stage they were flying.
const $ = (id) => document.getElementById(id);

const nextPaint = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

export async function loadingProgress(label, frac) {
  const el = $('loading');
  if (!el) return;
  $('load-bar').style.transform = `scaleX(${frac})`;
  $('load-step').textContent = label;
  $('load-pct').textContent = `${Math.round(frac * 100)}%`;
  await nextPaint();
}

export function hideLoading() {
  const el = $('loading');
  if (!el) return;
  el.classList.add('done');
  setTimeout(() => { el.hidden = true; }, 600);
}

export function watchContext(canvas, game) {
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    const box = $('ctxlost');
    box.hidden = false;
    const stage = game.mission && game.mission.state === 'running' ? game.mission.index : null;
    const q = new URLSearchParams(location.search);
    q.set('quality', 'low');
    if (stage != null) { q.set('play', '1'); q.set('stage', String(stage)); }
    const go = () => { location.search = q.toString(); };
    box.querySelector('button').onclick = go;
  });
  canvas.addEventListener('webglcontextrestored', () => { $('ctxlost').querySelector('button').click(); });
}
