// HUD look: phosphor-green aviation symbology with a soft glow, amber/red for cautions and
// warnings, dark glass panels with bright corner brackets. Shared drawing helpers.
import { FONTS } from '../ui/fonts.js';

export const C = {
  green: '#a6ffbf',
  greenDim: 'rgba(166,255,191,0.6)',
  greenFaint: 'rgba(166,255,191,0.22)',
  amber: '#ffc861',
  red: '#ff4d3d',
  white: '#f4fbf6',
  blue: '#5cc8ff',
  fire: '#ff7a3d',
  gold: '#ffd27a',
  panel: 'rgba(3,10,8,0.58)',
  edge: 'rgba(166,255,191,0.24)',
};

export function font(g, weight, size, family = 'hud') {
  g.font = `${weight} ${size}px ${FONTS[family]}`;
}

// Text with a glow in its own colour (the look of a collimated HUD).
export function glow(g, text, x, y, color, blur = 6) {
  g.save();
  g.shadowColor = color;
  g.shadowBlur = blur;
  g.fillStyle = color;
  g.fillText(text, x, y);
  g.restore();
}

// Glass panel with corner brackets; `accent` adds a coloured spine on the left.
export function panel(g, x, y, w, h, u, { accent = null, bracket = C.green, alpha = 1 } = {}) {
  g.save();
  g.globalAlpha *= alpha;
  g.shadowBlur = 0;
  const grad = g.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, 'rgba(6,18,14,0.66)');
  grad.addColorStop(1, 'rgba(2,8,6,0.52)');
  g.fillStyle = grad;
  g.strokeStyle = C.edge;
  g.lineWidth = 1;
  g.beginPath();
  g.roundRect(x, y, w, h, 5 * u);
  g.fill();
  g.stroke();
  // Corner brackets
  const b = Math.min(10 * u, w / 4, h / 4);
  g.strokeStyle = bracket;
  g.globalAlpha *= 0.85;
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(x, y + b); g.lineTo(x, y); g.lineTo(x + b, y);
  g.moveTo(x + w - b, y); g.lineTo(x + w, y); g.lineTo(x + w, y + b);
  g.moveTo(x + w, y + h - b); g.lineTo(x + w, y + h); g.lineTo(x + w - b, y + h);
  g.moveTo(x + b, y + h); g.lineTo(x, y + h); g.lineTo(x, y + h - b);
  g.stroke();
  if (accent) {
    g.globalAlpha = alpha;
    g.fillStyle = accent;
    g.fillRect(x, y + 4 * u, 3 * u, h - 8 * u);
  }
  g.restore();
}

// Small label + value pair (label dim, value bright, right-aligned).
export function labelValue(g, x, y, w, label, value, u, color = C.green) {
  g.textAlign = 'left';
  g.fillStyle = C.greenDim;
  font(g, 700, 9.5 * u);
  g.fillText(label, x, y);
  g.textAlign = 'right';
  font(g, 700, 12.5 * u, 'mono');
  glow(g, value, x + w, y, color, 4);
}

// Horizontal bar gauge with optional limit marker.
export function bar(g, x, y, w, h, frac, color, u, limit = null) {
  g.save();
  g.shadowBlur = 0;
  g.fillStyle = 'rgba(255,255,255,0.1)';
  g.beginPath(); g.roundRect(x, y, w, h, h / 2); g.fill();
  const f = Math.max(0, Math.min(1, frac));
  if (f > 0) {
    const grad = g.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, color);
    grad.addColorStop(1, color + 'cc');
    g.fillStyle = grad;
    g.shadowColor = color;
    g.shadowBlur = 5;
    g.beginPath(); g.roundRect(x, y, Math.max(h, w * f), h, h / 2); g.fill();
  }
  if (limit != null) {
    g.shadowBlur = 0;
    g.fillStyle = C.red;
    g.fillRect(x + w * limit - 1, y - 2 * u, 2, h + 4 * u);
  }
  g.restore();
}

export function wrapLines(g, text, maxW) {
  const out = [];
  let line = '';
  for (const w of text.split(' ')) {
    const t = line ? line + ' ' + w : w;
    if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
  }
  out.push(line);
  return out;
}
