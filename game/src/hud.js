// The HUD and every screen that is not the 3D world: wanted stars, cash,
// health and armour, the weapon readout, the objective line and its timer,
// dialogue subtitles, toasts, and the title / pause / wasted / busted /
// story-complete panels. Plus the minimap — a small canvas radar in the
// corner of the screen that draws the street grid, every car and person
// that matters, and the gold beacon of the current objective, north-up and
// centred on Rio, the way the genre taught a generation to read a city.

import { CITY, NAMES } from './config.js';
import { roadLines } from './city.js';

const el = (id) => document.getElementById(id);

export class Hud {
  constructor(game) {
    this.game = game;
    this.root = el('hud');
    this.cashEl = el('cash');
    this.starsEl = el('stars');
    this.healthFill = el('health-fill');
    this.armorFill = el('armor-fill');
    this.weaponEl = el('weapon');
    this.objectiveEl = el('objective');
    this.timerEl = el('timer');
    this.dialogueEl = el('dialogue');
    this.dialogueName = el('dialogue-name');
    this.dialogueText = el('dialogue-text');
    this.toastEl = el('toast');
    this.radioEl = el('radio');
    this.bustEl = el('bust-wrap');
    this.bustFill = el('bust-fill');
    this.minimap = el('minimap').getContext('2d');
    this.toastTimer = 0;
    this.dialogueQueue = [];
    this.dialogueDone = null;
    this.objective = '';
    this.timer = null;
  }

  show() { this.root.classList.remove('hidden'); }
  hide() { this.root.classList.add('hidden'); }

  setObjective(text) {
    if (text === this.objective) return;
    this.objective = text;
    this.objectiveEl.textContent = text;
    this.objectiveEl.classList.toggle('hidden', !text);
  }

  setTimer(seconds) {
    this.timer = seconds;
    if (seconds === null || seconds === undefined) {
      this.timerEl.classList.add('hidden');
      return;
    }
    const s = Math.max(0, Math.ceil(seconds));
    this.timerEl.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    this.timerEl.classList.toggle('urgent', seconds < 15);
    this.timerEl.classList.remove('hidden');
  }

  toast(text, seconds = 3.6) {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove('hidden');
    this.toastTimer = seconds;
  }

  showDialogue(lines, done) {
    this.dialogueQueue = [...lines];
    this.dialogueDone = done || null;
    this.nextDialogue();
  }

  nextDialogue() {
    const line = this.dialogueQueue.shift();
    if (!line) {
      this.dialogueEl.classList.add('hidden');
      if (this.dialogueDone) { const cb = this.dialogueDone; this.dialogueDone = null; cb(); }
      return;
    }
    const [name, text] = line;
    this.dialogueName.textContent = name;
    this.dialogueName.style.color = name === NAMES.fixer ? '#ffb454' : name === NAMES.hero ? '#35c4b5' : '#f2f2f2';
    this.dialogueText.textContent = text;
    this.dialogueEl.classList.remove('hidden');
  }

  dialogueOpen() { return !this.dialogueEl.classList.contains('hidden'); }

  update(dt, game) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.classList.add('hidden');
    }
    const player = game.player;
    this.cashEl.textContent = `$${Math.floor(game.save.cash).toLocaleString('en-US')}`;
    const stars = game.wanted.stars;
    this.starsEl.textContent = '★★★★★'.slice(0, stars) + '☆☆☆☆☆'.slice(0, 5 - stars);
    this.starsEl.classList.toggle('hot', stars > 0);
    this.healthFill.style.width = `${Math.max(0, player.health)}%`;
    this.healthFill.style.background = player.health < 30 ? '#ff4040' : '#7ed957';
    this.armorFill.style.width = `${Math.max(0, player.armor)}%`;
    if (player.car) {
      const speed = Math.round(Math.abs(player.car.speed) * 3.6);
      this.weaponEl.textContent = `${speed} km/h · ${player.car.wrecked ? 'WRECKED' : '—'}`;
      this.radioEl.textContent = `♪ ${game.audio.station().name}`;
      this.radioEl.classList.remove('hidden');
    } else {
      this.weaponEl.textContent = 'PISTOL · ∞';
      this.radioEl.classList.add('hidden');
    }
    const bust = game.wanted.bustMeter;
    this.bustEl.classList.toggle('hidden', bust <= 0.02);
    this.bustFill.style.width = `${Math.min(100, bust * 100)}%`;
    this.drawMinimap(game);
  }

  drawMinimap(game) {
    const ctx = this.minimap;
    const size = 172;
    const range = 95;               // metres shown across the map
    const scale = size / (range * 2);
    const px = game.player.x;
    const pz = game.player.z;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#20303c';
    ctx.fillRect(0, 0, size, size);
    // Streets.
    ctx.strokeStyle = '#4a5a68';
    ctx.lineWidth = Math.max(2, CITY.roadHalf * 2 * scale * 0.6);
    ctx.beginPath();
    for (const line of roadLines()) {
      const gx = size / 2 + (line - px) * scale;
      const gz = size / 2 + (line - pz) * scale;
      if (gx > -10 && gx < size + 10) { ctx.moveTo(gx, 0); ctx.lineTo(gx, size); }
      if (gz > -10 && gz < size + 10) { ctx.moveTo(0, gz); ctx.lineTo(size, gz); }
    }
    ctx.stroke();
    const dot = (x, z, color, r = 3) => {
      const gx = size / 2 + (x - px) * scale;
      const gz = size / 2 + (z - pz) * scale;
      if (gx < -4 || gx > size + 4 || gz < -4 || gz > size + 4) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(gx, gz, r, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const mark of game.city.landmarks) dot(mark.x, mark.z, '#9fd8ef', 2.5);
    for (const car of game.cars) {
      if (car === game.player.car) continue;
      dot(car.x, car.z, car.cop ? '#3f7fd1' : '#c0c6cc', 2.5);
    }
    for (const cop of game.wanted.copFeet) if (!cop.dead) dot(cop.x, cop.z, '#3f7fd1', 2.5);
    const target = game.missions.active ? game.missions.stageTarget() : game.missions.startLandmark();
    if (target) {
      // The objective beacon, clamped to the map edge so it always points the way.
      const gx = Math.max(8, Math.min(size - 8, size / 2 + (target.x - px) * scale));
      const gz = Math.max(8, Math.min(size - 8, size / 2 + (target.z - pz) * scale));
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath();
      ctx.arc(gx, gz, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#10333a';
      ctx.stroke();
    }
    // Rio: a white arrow that turns with him (or with his car).
    const heading = game.player.heading;
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(Math.atan2(Math.sin(heading), -Math.cos(heading)) + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // North tick.
    ctx.fillStyle = '#f2f2f2';
    ctx.font = 'bold 11px system-ui';
    ctx.fillText('N', size - 14, 14);
  }
}

/** Full-screen panels: title, pause, wasted, busted, story complete. */
export function showPanel(id) {
  for (const panel of document.querySelectorAll('.panel')) panel.classList.add('hidden');
  if (id) el(id).classList.remove('hidden');
}

export function fillTitle(game) {
  const hasSave = !!game.existingSave;
  el('continue-btn').classList.toggle('hidden', !hasSave);
  if (hasSave) {
    const idx = game.existingSave.missionIndex;
    el('continue-note').textContent = game.existingSave.storyDone
      ? 'Story complete — free roam Azura Bay'
      : `Continue — ${idx} of 6 chapters done · $${Math.floor(game.existingSave.cash)}`;
  }
}
