// WEATHER setting on the title screen and in the pause menu (CLEAR / SMOKE HAZE / STORM): applied
// live to the sky, light, clouds, rain and materials, and remembered.
import { WEATHERS, WEATHER_LABELS, saveWeather } from '../world/weather.js';

export function bindWeatherMenu(game) {
  for (const slot of document.querySelectorAll('.gfx-slot')) {
    const box = document.createElement('div');
    box.className = 'wx-slot';
    box.innerHTML = `<p class="label">WEATHER</p>
      <div class="gfx-modes wx-modes">${WEATHERS.map((w) => `<button data-wx="${w}">${WEATHER_LABELS[w]}</button>`).join('')}</div>`;
    slot.prepend(box);
    for (const b of box.querySelectorAll('[data-wx]')) {
      b.onclick = () => {
        game.weather.set(b.dataset.wx);
        saveWeather(b.dataset.wx);
        refresh();
      };
    }
  }
  function refresh() {
    for (const b of document.querySelectorAll('[data-wx]')) b.classList.toggle('on', b.dataset.wx === game.weather.kind);
  }
  refresh();
}
