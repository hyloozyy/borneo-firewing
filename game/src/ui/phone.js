// Phone flow: a "turn your phone sideways" screen in portrait (with full screen + landscape lock
// where the browser allows it), the how-to-play card before the first flight, and the body
// classes that show the touch controls only while flying.
const $ = (id) => document.getElementById(id);

export function enterFullscreen() {
  const el = document.documentElement;
  if (document.fullscreenElement || !el.requestFullscreen) return Promise.resolve();
  return el.requestFullscreen({ navigationUI: 'hide' })
    .then(() => screen.orientation && screen.orientation.lock ? screen.orientation.lock('landscape').catch(() => {}) : null)
    .catch(() => {});
}

export function setupPhone(game) {
  const touch = game.controls.isTouch;
  if (!touch) return;
  let skipped = sessionStorage.getItem('fw-portrait') === '1';
  const rotate = $('rotate');
  const check = () => {
    const portrait = innerHeight > innerWidth;
    document.body.classList.toggle('portrait', portrait);
    rotate.hidden = !(portrait && !skipped);
  };
  $('btn-rotate-fs').onclick = () => { enterFullscreen().then(check); };
  $('btn-rotate-skip').onclick = () => { skipped = true; sessionStorage.setItem('fw-portrait', '1'); check(); };
  addEventListener('resize', check);
  if (screen.orientation) screen.orientation.addEventListener('change', check);
  check();
}

// Before the first flight on a phone show the how-to-play card once, then start.
export function withHowTo(game, start) {
  if (!game.controls.isTouch) return start();
  enterFullscreen();
  if (localStorage.getItem('fw-howto') === '1') return start();
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== 'howto';
  $('btn-howto-go').onclick = () => { localStorage.setItem('fw-howto', '1'); start(); };
}

// Mirror the game state on <body> so CSS can show the touch controls only in flight.
export function syncBodyState(game) {
  if (game.state === game.shownState) return;
  game.shownState = game.state;
  document.body.dataset.state = game.state;
}
