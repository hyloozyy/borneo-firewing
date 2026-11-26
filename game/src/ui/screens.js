// Title, briefing, pause and mission result screens (DOM overlays).
import { landingRating } from '../mission/mission-director.js';

const $ = (id) => document.getElementById(id);

export function showScreen(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
}

export function hideScreens() {
  for (const s of document.querySelectorAll('.screen')) s.hidden = true;
}

export function bindScreens(game) {
  $('btn-start').onclick = () => { game.audio.unlock(); showScreen('briefing'); };
  $('btn-brief-go').onclick = () => { game.audio.unlock(); game.startMission(0); };
  $('btn-resume').onclick = () => game.setPaused(false);
  $('btn-restart').onclick = () => game.startMission(0);
  $('btn-again').onclick = () => game.startMission(0);
  $('btn-retry-stage').onclick = () => game.startMission(game.mission.index);
  $('btn-menu').onclick = () => location.reload();
  for (const b of document.querySelectorAll('[data-stage]')) b.onclick = () => { game.audio.unlock(); game.startMission(Number(b.dataset.stage)); };
}

export function showResult(game, passed) {
  const m = game.mission;
  $('result-title').textContent = passed ? 'MISI BERHASIL · API PADAM' : 'MISI GAGAL';
  $('result-title').className = passed ? 'ok' : 'bad';
  $('result-reason').textContent = passed
    ? `Hutan Kalimantan terselamatkan. Pendaratan: ${landingRating(game.flight.lastTouchdown)}`
    : m.failReason;
  const rows = m.stageScores.map((s) => `<tr><td>${s.title}</td><td>${s.skipped ? '—' : s.score}</td><td class="stars">${'★'.repeat(s.stars)}${'☆'.repeat(3 - s.stars)}</td></tr>`).join('');
  $('result-table').innerHTML = rows + `<tr class="total"><td>TOTAL</td><td>${m.total()}</td><td></td></tr>`;
  $('btn-retry-stage').hidden = passed;
  showScreen('result');
}
