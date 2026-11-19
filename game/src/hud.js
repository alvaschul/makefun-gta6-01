// NEON HARBOR v2 — HUD: DOM readouts and the live minimap.
// This class is the only place that touches HUD element ids; the ids use
// the nh- scheme defined in index.html.

import { CFG } from "./config.js";

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.root = $("nh-hud");
    this.cashEl = $("nh-cash");
    this.starsEl = $("nh-stars");
    this.clockEl = $("nh-clock");
    this.weatherEl = $("nh-weather-tag");
    this.hpFill = $("nh-hp-fill");
    this.arFill = $("nh-ar-fill");
    this.objText = $("nh-objective-text");
    this.timerEl = $("nh-timer");
    this.toastEl = $("nh-toast");
    this.radioEl = $("nh-radio");
    this.weaponEl = $("nh-weapon");
    this.crossEl = $("nh-cross");
    this.bustWrap = $("nh-bust-wrap");
    this.bustFill = $("nh-bust-fill");
    this.promptEl = $("nh-prompt");
    this.dlgWrap = $("nh-dialogue");
    this.dlgName = $("nh-dlg-name");
    this.dlgText = $("nh-dlg-text");
    this.mapCanvas = $("nh-map");
    this.mapCtx = this.mapCanvas.getContext("2d");
    this.damageEl = $("nh-damage");
    this.speedNumEl = $("nh-speed-num");
    this.lastStars = 0;
    this.lastHealth = CFG.player.maxHealth;
    this.toastTimer = null;
    this.panels = {
      title: $("nh-panel-title"),
      pause: $("nh-panel-pause"),
      wasted: $("nh-panel-wasted"),
      busted: $("nh-panel-busted"),
      complete: $("nh-panel-complete"),
    };
  }

  showGame() { this.root.classList.remove("nh-hidden"); }
  hideGame() { this.root.classList.add("nh-hidden"); }

  showPanel(name) {
    for (const [key, el] of Object.entries(this.panels)) {
      el.classList.toggle("nh-open", key === name);
    }
  }
  hidePanels() { this.showPanel("__none__"); }

  setCash(amount) {
    this.cashEl.textContent = `$${Math.max(0, Math.round(amount)).toLocaleString("en-US")}`;
  }

  setStars(stars) {
    let html = "";
    for (let i = 0; i < 5; i++) {
      html += i < stars ? '<span class="nh-lit">&#9733;</span>' : "&#9733;";
    }
    this.starsEl.innerHTML = html;
    if (stars > this.lastStars && stars > 0) {
      // heat just went up: flare the row so the player feels it
      this.starsEl.classList.remove("nh-pulse");
      void this.starsEl.offsetWidth;
      this.starsEl.classList.add("nh-pulse");
    }
    this.lastStars = stars;
  }

  setClock(hour, weatherName) {
    const h = Math.floor(hour);
    const m = Math.floor((hour - h) * 60);
    this.clockEl.textContent = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    if (weatherName) this.weatherEl.textContent = weatherName;
  }

  setVitals(health, armour) {
    this.hpFill.style.width = `${Math.max(0, Math.min(100, health))}%`;
    this.arFill.style.width = `${Math.max(0, Math.min(100, armour))}%`;
    if (health < this.lastHealth - 1) {
      // a hit just landed: flash the red damage vignette
      this.damageEl.classList.remove("nh-flash");
      void this.damageEl.offsetWidth;
      this.damageEl.classList.add("nh-flash");
    }
    this.damageEl.classList.toggle("nh-low", health > 0 && health <= 30);
    this.lastHealth = health;
  }

  /** Speed readout beside the minimap, in km/h. */
  setSpeed(kmh) {
    if (this.speedNumEl) this.speedNumEl.textContent = `${Math.max(0, Math.round(kmh))}`;
  }

  setObjective(text) {
    if (text) this.objText.textContent = text;
  }

  setTimer(seconds) {
    if (seconds == null) {
      this.timerEl.textContent = "";
      this.timerEl.classList.remove("nh-urgent");
      return;
    }
    const s = Math.max(0, Math.ceil(seconds));
    this.timerEl.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    this.timerEl.classList.toggle("nh-urgent", s <= 15);
  }

  toast(message, holdMs = 2600) {
    this.toastEl.textContent = message;
    this.toastEl.classList.add("nh-show");
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove("nh-show"), holdMs);
  }

  setRadio(text) { this.radioEl.textContent = text; }
  setWeapon(text) { this.weaponEl.textContent = text; }
  setAiming(on) { this.crossEl.classList.toggle("nh-on", Boolean(on)); }

  setBust(fraction) {
    this.bustWrap.classList.toggle("nh-on", fraction > 0.02);
    this.bustFill.style.width = `${Math.round(fraction * 100)}%`;
  }

  setPrompt(html) {
    if (!html) {
      this.promptEl.classList.remove("nh-on");
      this.promptEl.innerHTML = "";
      return;
    }
    this.promptEl.innerHTML = html;
    this.promptEl.classList.add("nh-on");
  }

  showDialogue(speaker, text) {
    this.dlgName.textContent = speaker;
    this.dlgText.textContent = text;
    this.dlgWrap.classList.add("nh-on");
  }
  hideDialogue() { this.dlgWrap.classList.remove("nh-on"); }
  get dialogueOpen() { return this.dlgWrap.classList.contains("nh-on"); }

  /**
   * Minimap: north-up, player-centred. state carries positions in world
   * metres; the map spans viewRadius metres across.
   */
  drawMinimap(state) {
    const ctx = this.mapCtx;
    const size = this.mapCanvas.width;
    const viewRadius = 120;
    const scale = (size / 2) / viewRadius;
    const toMap = (x, z) => [
      size / 2 + (x - state.player.x) * scale,
      size / 2 + (z - state.player.z) * scale,
    ];
    ctx.fillStyle = "#0a1622";
    ctx.fillRect(0, 0, size, size);

    // roads: verticals and horizontals from the city grid
    ctx.strokeStyle = "#3d4c5c";
    ctx.lineWidth = Math.max(2, CFG.world.roadWidth * scale * 0.8);
    ctx.beginPath();
    for (let k = 0; k <= CFG.world.blocksPerSide; k++) {
      const c = -CFG.world.half + CFG.world.roadWidth / 2 + k * CFG.world.pitch;
      const [vx] = toMap(c, state.player.z);
      ctx.moveTo(vx, 0); ctx.lineTo(vx, size);
      const [, hz] = toMap(state.player.x, c);
      ctx.moveTo(0, hz); ctx.lineTo(size, hz);
    }
    ctx.stroke();

    const dot = (x, z, r, color) => {
      const [mx, my] = toMap(x, z);
      if (mx < -6 || my < -6 || mx > size + 6 || my > size + 6) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const p of state.pedestrians || []) dot(p.x, p.z, 1.6, "#cfd8dc");
    for (const c of state.copCars || []) {
      // flashing police blips
      dot(c.x, c.z, 3.4, Math.floor(performance.now() / 300) % 2 ? "#ff5252" : "#6db3ff");
    }
    for (const g of state.gang || []) dot(g.x, g.z, 3, "#ff7f45");
    if (state.objective) {
      const [ox, oy] = toMap(state.objective.x, state.objective.z);
      const clampedX = Math.max(10, Math.min(size - 10, ox));
      const clampedY = Math.max(10, Math.min(size - 10, oy));
      ctx.fillStyle = "#ffc857";
      ctx.beginPath();
      ctx.arc(clampedX, clampedY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#0b1020";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // player arrow
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(state.player.angle);
    ctx.fillStyle = "#37e0d8";
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5.5, 6);
    ctx.lineTo(-5.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // neon rim + north marker (the map is north-up, player rotates)
    ctx.strokeStyle = "rgba(55,224,216,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#ff4d8d";
    ctx.beginPath();
    ctx.moveTo(size / 2, 5);
    ctx.lineTo(size / 2 + 4.5, 13);
    ctx.lineTo(size / 2 - 4.5, 13);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f4f1e8";
    ctx.font = "bold 10px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("N", size / 2, 24);
  }
}
