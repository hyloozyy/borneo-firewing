// Runs the five stages in order: banners, radio calls, per-stage score and stars, fail states.
import { STAGES } from './mission-stages.js';

export const MISSION_TIME_LIMIT = 25 * 60;

export class MissionDirector {
  constructor(game) {
    this.game = game;
    this.index = -1;
    this.stageScores = [];
    this.stageStart = 0;
    this.state = 'idle'; // idle | running | passed | failed
    this.failReason = '';
    this.elapsed = 0;
  }

  get stage() { return STAGES[this.index]; }

  start(fromIndex = 0) {
    this.state = 'running';
    this.elapsed = 0;
    this.stageScores = [];
    for (let i = 0; i < fromIndex; i++) this.stageScores.push({ title: STAGES[i].title, score: 0, stars: 0, skipped: true });
    this.enter(fromIndex);
  }

  enter(i) {
    const g = this.game;
    this.index = i;
    g.stageData = {};
    this.stageStart = this.elapsed;
    this.stagePoints = 0;
    this.stage.enter(g);
    g.hud.banner(this.stage.title, this.stage.subtitle);
    this.stage.radio.forEach((line, k) => g.hud.radio(line, k * 6));
    g.audio.radioBeep();
  }

  addPoints(n) { this.stagePoints += n; }

  update(dt) {
    if (this.state !== 'running') return;
    const g = this.game;
    this.elapsed += dt;
    const s = g.flight;
    if (s.crashed) return this.fail(s.crashed);
    if (this.elapsed > MISSION_TIME_LIMIT) return this.fail('Waktu misi habis.');
    if (s.fuel <= 0 && s.onGround && !s.onWater && this.stage.id !== 'land') return this.fail('Kehabisan bahan bakar.');
    if (s.fuel <= 0 && s.onWater) return this.fail('Kehabisan bahan bakar di atas air.');
    const r = this.stage.update(g, dt);
    if (r === 'pass') this.passStage();
    else if (r && r.startsWith('fail:')) this.fail(r.slice(5));
  }

  passStage() {
    const g = this.game;
    const took = this.elapsed - this.stageStart;
    const bonus = stageBonus(this.stage.id, g, took);
    const score = Math.round(this.stagePoints + bonus);
    const par = [900, 600, 1400, 1200, 1200][this.index];
    const stars = score > par * 0.85 ? 3 : score > par * 0.5 ? 2 : 1;
    this.stageScores.push({ title: this.stage.title, score, stars, time: took });
    this.stage.exit?.(g);
    g.audio.success();
    if (this.index + 1 < STAGES.length) this.enter(this.index + 1);
    else {
      this.state = 'passed';
      g.onMissionEnd(true);
    }
  }

  fail(reason) {
    if (this.state !== 'running') return;
    this.state = 'failed';
    this.failReason = reason;
    this.game.onMissionEnd(false);
  }

  total() {
    return this.stageScores.reduce((a, s) => a + s.score, 0);
  }
}

function stageBonus(id, g, took) {
  const s = g.flight;
  switch (id) {
    case 'takeoff': return Math.max(0, 450 - took * 3);
    case 'scoop': return Math.max(0, 600 - took * 3);
    case 'attack': return Math.round(g.water.hits / Math.max(1, g.water.landed) * 900) + Math.max(0, 500 - took);
    case 'village': return Math.max(0, g.stageData.timer * 4) + 400;
    case 'land': {
      const td = s.lastTouchdown || { vs: -3 };
      const soft = Math.max(0, 1 - Math.abs(td.vs) / 3);
      const centre = Math.max(0, 1 - Math.abs((td.x ?? 0)) / 15);
      return Math.round(soft * 700 + centre * 300 + (s.fuel / s.fuelMax) * 200);
    }
    default: return 0;
  }
}

export function landingRating(td) {
  if (!td) return '-';
  const v = Math.abs(td.vs);
  return v < 1 ? 'BUTTER' : v < 2 ? 'SMOOTH' : v < 3 ? 'FIRM' : 'HARD';
}
