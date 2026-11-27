// AUTO SCOOP setting on the title screen and in the pause menu (ON / OFF, remembered; on by default
// on phones). When on, K or the AUTO SCOOP button near the lake lets the autopilot fly the scoop.
import { saveAutoScoop } from '../flight/scoop-autopilot.js';

export function bindAutoScoopMenu(game) {
  for (const slot of document.querySelectorAll('.gfx-slot')) {
    const box = document.createElement('div');
    box.className = 'wx-slot ap-slot';
    box.innerHTML = `<p class="label">AUTO SCOOP <span class="ap-hint">autopilot flies the lake scoop · K</span></p>
      <div class="gfx-modes ap-modes"><button data-ap="on">ON</button><button data-ap="off">OFF</button></div>`;
    const wx = slot.querySelector('.wx-slot');
    if (wx) wx.after(box); else slot.prepend(box);
    for (const b of box.querySelectorAll('[data-ap]')) {
      b.onclick = () => {
        game.autopilot.enabled = b.dataset.ap === 'on';
        if (!game.autopilot.enabled && game.autopilot.active) game.autopilot.disengage();
        saveAutoScoop(game.autopilot.enabled);
        refresh();
      };
    }
  }
  function refresh() {
    for (const b of document.querySelectorAll('[data-ap]')) b.classList.toggle('on', (b.dataset.ap === 'on') === game.autopilot.enabled);
  }
  refresh();
}
