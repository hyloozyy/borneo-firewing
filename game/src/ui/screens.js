// Title, briefing, pause and mission report screens (DOM overlays).
import { withHowTo } from './phone.js';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

export function showScreen(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
}

export function hideScreens() {
  for (const s of document.querySelectorAll('.screen')) s.hidden = true;
}

const visible = (id) => !$(id).hidden;

export function bindScreens(game) {
  $('btn-start').onclick = () => { game.audio.unlock(); showScreen('briefing'); };
  $('btn-brief-go').onclick = () => { game.audio.unlock(); withHowTo(game, () => game.startMission(0)); };
  $('btn-resume').onclick = () => game.setPaused(false);
  $('btn-restart').onclick = () => game.startMission(0);
  $('btn-again').onclick = () => game.startMission(0);
  $('btn-retry-stage').onclick = () => game.startMission(game.mission.index);
  $('btn-menu').onclick = () => location.reload();
  for (const b of document.querySelectorAll('[data-stage]')) b.onclick = () => { game.audio.unlock(); withHowTo(game, () => game.startMission(Number(b.dataset.stage))); };
  addEventListener('keydown', (e) => {
    if (e.code !== 'Enter') return;
    if (visible('title')) $('btn-start').click();
    else if (visible('briefing')) $('btn-brief-go').click();
    else if (visible('result')) (game.mission.state === 'passed' ? $('btn-again') : $('btn-retry-stage')).click();
  });
}

export function showResult(game, passed) {
  const m = game.mission, r = game.report;
  $('result-kicker').textContent = r.kind === 'crash' ? 'CRASH REPORT · FW-218 ENGGANG' : r.kind === 'landing' ? 'MISSION REPORT · LANDING DEBRIEF' : 'MISSION REPORT';
  $('result-title').textContent = r.headline;
  $('result-title').className = passed ? 'ok' : 'bad';
  $('result-reason').textContent = passed
    ? 'The Kalimantan forest is safe tonight and the village stands. Posko Damkar thanks the crew of Enggang 218.'
    : r.cause;
  $('result-flight').innerHTML = r.items.map((i) => `<div><dt>${esc(i.label)}</dt><dd class="${i.tone}">${esc(i.value)}</dd></div>`).join('');
  const rows = m.stageScores.map((s) => `<tr><td>${esc(s.title)}</td><td>${s.skipped ? '-' : s.score}</td><td class="stars">${'★'.repeat(s.stars)}${'☆'.repeat(3 - s.stars)}</td></tr>`).join('');
  $('result-table').innerHTML = rows + `<tr class="total"><td>TOTAL</td><td>${m.total()}</td><td></td></tr>`;
  const dmg = r.damage.length ? r.damage.map((t) => `<li>${esc(t)}</li>`).join('') : '<li class="ok">NO DAMAGE · AIRFRAME CLEAN</li>';
  $('result-damage').innerHTML = dmg + r.timeline.map((t) => `<li class="event">${esc(t)}</li>`).join('');
  $('btn-retry-stage').hidden = passed;
  showScreen('result');
}
