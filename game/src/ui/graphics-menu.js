// GRAPHICS setting on the title screen and in the pause menu: four modes (a mode change rebuilds
// the world, so the page reloads into the same stage) and a live render-scale slider.
import { MODES, saveSettings, ratioFor } from '../core/quality.js';

const LABEL = { performance: 'PERFORMANCE', balanced: 'BALANCED', sharp: 'SHARP', ultra: 'ULTRA' };

export function bindGraphicsMenu(game) {
  const q = game.quality;
  for (const slot of document.querySelectorAll('.gfx-slot')) {
    slot.innerHTML = `<p class="label">GRAPHICS</p>
      <div class="gfx-modes">${MODES.map((m) => `<button data-gfx="${m}">${LABEL[m]}</button>`).join('')}</div>
      <label class="gfx-scale"><span>RENDER SCALE</span><input type="range" min="60" max="100" step="5"><b></b></label>
      <p class="gfx-now"></p>`;
    const range = slot.querySelector('input');
    for (const b of slot.querySelectorAll('[data-gfx]')) {
      b.onclick = () => {
        if (b.dataset.gfx === q.mode) return;
        saveSettings({ mode: b.dataset.gfx, scale: q.scale });
        const p = new URLSearchParams(location.search);
        p.delete('quality');
        if (game.mission && game.mission.state === 'running') { p.set('play', '1'); p.set('stage', String(game.mission.index)); }
        location.search = p.toString();
      };
    }
    range.oninput = () => {
      q.scale = Number(range.value) / 100;
      q.pixelRatio = ratioFor(q.mode, q.scale);
      saveSettings({ mode: q.mode, scale: q.scale });
      game.renderer.setPixelRatio(q.pixelRatio);
      game.resize();
      refresh();
    };
  }
  function refresh() {
    for (const slot of document.querySelectorAll('.gfx-slot')) {
      for (const b of slot.querySelectorAll('[data-gfx]')) b.classList.toggle('on', b.dataset.gfx === q.mode);
      slot.querySelector('input').value = Math.round(q.scale * 100);
      slot.querySelector('b').textContent = `${Math.round(q.scale * 100)}%`;
      const w = Math.round(innerWidth * q.pixelRatio), h = Math.round(innerHeight * q.pixelRatio);
      slot.querySelector('.gfx-now').textContent = `${LABEL[q.mode]} · ${w}×${h} · ${q.msaa ? `MSAA ${q.msaa}×` : 'FXAA'} + SHARPEN`;
    }
  }
  game.refreshGraphicsMenu = refresh;
  refresh();
}
