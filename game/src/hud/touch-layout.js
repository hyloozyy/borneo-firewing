// Phone HUD layout (touch screens in landscape, any size): reads where the touch controls really
// are (stick, its label, throttle, every action button, the CAM/TILT/HUD/pause bar - safe-area
// padding included) and places every HUD panel in the space they leave, so no panel ever sits
// under a control. Each placed panel's rectangle is kept in hud.rects for the overlap test.

const SEL = ['.stick-base', '.zone-label', '.throttle', '.actions button', '.topbar'];

// The touch controls' rectangles (CSS px), refreshed twice a second while they are shown.
export function touchObstacles(hud, time) {
  if (hud.obstacleTime !== undefined && time - hud.obstacleTime < 0.5 && hud.obstacles) return hud.obstacles;
  hud.obstacleTime = time;
  const root = document.getElementById('touch');
  if (!root || getComputedStyle(root).display === 'none') { hud.obstacles = null; return null; }
  const list = [];
  for (const sel of SEL) for (const el of root.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) list.push({ name: sel, x: r.left, y: r.top, w: r.width, h: r.height });
  }
  hud.obstacles = list.length ? list : null;
  return hud.obstacles;
}

const overlapsX = (o, x0, x1) => o.x < x1 && o.x + o.w > x0;

// Free vertical band [top, bottom] across the x-range: below everything that hangs from the top
// half of the screen, above everything that stands in the bottom half.
export function freeBand(rects, x0, x1, H, top0 = 0, bottom0 = H) {
  let top = top0, bottom = bottom0;
  for (const o of rects) {
    if (!overlapsX(o, x0, x1)) continue;
    if (o.y + o.h / 2 < H * 0.5) top = Math.max(top, o.y + o.h);
    else bottom = Math.min(bottom, o.y);
  }
  return { top, bottom };
}

// Free horizontal gap along the bottom edge between the left and right clusters.
export function bottomGap(rects, W, H, y0) {
  let left = 0, right = W;
  for (const o of rects) {
    if (o.y + o.h < y0) continue;
    if (o.x + o.w / 2 < W / 2) left = Math.max(left, o.x + o.w);
    else right = Math.min(right, o.x);
  }
  return { left, right };
}
