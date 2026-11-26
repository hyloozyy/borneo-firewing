// What to call a control in on-screen hints: keyboard keys on a computer, button names on a phone.
const KEYS = { throttle: 'R throttle', flaps: 'V', pull: 'S', drop: 'SPACE', brake: 'B brakes', bottle: 'X', camera: 'C' };
const TOUCH = { throttle: 'THR slider', flaps: 'FLAPS', pull: 'stick back', drop: 'hold DROP', brake: 'BRAKE', bottle: 'FIRE BOTTLE', camera: 'CAM' };

export function keyName(game, action) {
  return (game.controls && game.controls.isTouch ? TOUCH : KEYS)[action];
}
