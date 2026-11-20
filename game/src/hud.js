// hud.js — DOM heads-up display for NEON HARBOR.
// All HUD elements are created here from JS so index.html stays lean.
// The minimap is a 2D canvas: roads as a grid, landmarks as dots, police
// as flashing blips and the mission target as a gold ring.

let els = null;

function el(tag, cls, parent, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  if (parent) parent.appendChild(node);
  return node;
}

export function createHud(rootEl) {
  const root = rootEl || document.body;
  const hud = el("div", "nh-hud", root);

  const topLeft = el("div", "nh-topleft", hud);
  const money = el("div", "nh-money", topLeft, "Rp 0");
  const healthWrap = el("div", "nh-healthwrap", topLeft);
  const healthBar = el("div", "nh-healthbar", healthWrap);
  const stars = el("div", "nh-stars", topLeft, "");

  const objective = el("div", "nh-objective", hud, "");
  const toast = el("div", "nh-toast", hud, "");
  toast.style.opacity = "0";

  const dialogue = el("div", "nh-dialogue", hud);
  const speaker = el("div", "nh-speaker", dialogue, "");
  const line = el("div", "nh-line", dialogue, "");
  dialogue.style.display = "none";

  const bustWrap = el("div", "nh-bustwrap", hud);
  const bustBar = el("div", "nh-bustbar", bustWrap);
  bustWrap.style.display = "none";

  const overlay = el("div", "nh-overlay", hud, "");
  overlay.style.display = "none";

  const minimap = document.createElement("canvas");
  minimap.width = 176;
  minimap.height = 176;
  minimap.className = "nh-minimap";
  hud.appendChild(minimap);

  els = {
    root: hud, money, healthBar, stars, objective, toast,
    dialogue, speaker, line, bustWrap, bustBar, overlay, minimap,
    toastTimer: 0,
  };
  return els;
}

export function showDialogue(who, text) {
  if (!els) return;
  els.speaker.textContent = who || "";
  els.line.textContent = text || "";
  els.dialogue.style.display = "block";
}

export function hideDialogue() {
  if (els) els.dialogue.style.display = "none";
}

export function showToast(text) {
  if (!els) return;
  els.toast.textContent = text;
  els.toast.style.opacity = "1";
  els.toastTimer = 3.2;
}

export function showOverlay(text, sub) {
  if (!els) return;
  els.overlay.innerHTML = "";
  const big = el("div", "nh-overlay-big", els.overlay, text);
  void big;
  if (sub) el("div", "nh-overlay-sub", els.overlay, sub);
  els.overlay.style.display = "flex";
}

export function hideOverlay() {
  if (els) els.overlay.style.display = "none";
}

export function showBusted() {
  showOverlay("BUSTED", "The Azura Bay police haul Rio in. Cash lost to bail.");
}

export function showWasted() {
  showOverlay("WASTED", "Rio wakes up at Santa Rosa Hospital, lighter in the pocket.");
}

export function showTitle() {
  const t = document.getElementById("nh-title");
  if (t) t.style.display = "flex";
}

export function hideTitle() {
  const t = document.getElementById("nh-title");
  if (t) t.style.display = "none";
}

export function updateHud(state) {
  if (!els) return;
  els.money.textContent = "Rp " + Math.round(state.cash || 0).toLocaleString("id-ID");
  const hp = Math.max(0, Math.min(1, (state.health ?? 100) / 100));
  els.healthBar.style.width = hp * 100 + "%";
  els.healthBar.style.background = hp > 0.35 ? "#53c98a" : "#e84a5a";
  els.stars.textContent = "★".repeat(state.stars || 0) + "☆".repeat(Math.max(0, 5 - (state.stars || 0)));
  els.stars.style.opacity = state.stars > 0 ? "1" : "0.25";
  if (state.objective !== undefined) els.objective.textContent = state.objective;
  if (els.toastTimer > 0) {
    els.toastTimer -= state.dt || 0;
    if (els.toastTimer <= 0) els.toast.style.opacity = "0";
  }
  if (state.bust01 > 0.02) {
    els.bustWrap.style.display = "block";
    els.bustBar.style.width = state.bust01 * 100 + "%";
  } else {
    els.bustWrap.style.display = "none";
  }
}

// World -> minimap coordinates. The map spans CONFIG.worldSize.
function toMap(x, z, size, world) {
  return [
    ((x + world / 2) / world) * size,
    ((z + world / 2) / world) * size,
  ];
}

export function drawMinimap(canvas, state) {
  const cv = canvas || els?.minimap;
  if (!cv) return;
  const g = cv.getContext("2d");
  const size = cv.width;
  const world = state.worldSize || 640;
  g.fillStyle = "#141824";
  g.fillRect(0, 0, size, size);
  // Road grid.
  g.strokeStyle = "#3d465e";
  g.lineWidth = 2;
  const spacing = state.roadSpacing || 78;
  for (let v = -world / 2; v <= world / 2; v += spacing) {
    const [x] = toMap(v, 0, size, world);
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, size); g.stroke();
    const [, y] = toMap(0, v, size, world);
    g.beginPath(); g.moveTo(0, y); g.lineTo(size, y); g.stroke();
  }
  // Water on the east edge.
  const [wx] = toMap(state.waterX || 292, 0, size, world);
  g.fillStyle = "#1d5f7a";
  g.fillRect(wx, 0, size - wx, size);
  // Landmarks.
  g.fillStyle = "#8fa3c8";
  for (const lm of state.landmarks || []) {
    const [x, y] = toMap(lm.x, lm.z, size, world);
    g.fillRect(x - 1.5, y - 1.5, 3, 3);
  }
  // Mission target: gold ring.
  if (state.target) {
    const [x, y] = toMap(state.target.x, state.target.z, size, world);
    g.strokeStyle = "#f2b134";
    g.lineWidth = 2;
    g.beginPath(); g.arc(x, y, 6 + Math.sin((state.time || 0) * 4) * 1.5, 0, Math.PI * 2); g.stroke();
  }
  // Police blips flash blue/red.
  for (const cop of state.police || []) {
    const [x, y] = toMap(cop.x, cop.z, size, world);
    g.fillStyle = Math.sin((state.time || 0) * 8) > 0 ? "#3c8aff" : "#ff3c3c";
    g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
  }
  // Traffic dots.
  g.fillStyle = "#c8ccd8";
  for (const car of state.traffic || []) {
    const [x, y] = toMap(car.x, car.z, size, world);
    g.fillRect(x - 1, y - 1, 2, 2);
  }
  // Player arrow.
  const [px, py] = toMap(state.playerPos.x, state.playerPos.z, size, world);
  g.save();
  g.translate(px, py);
  g.rotate(Math.atan2(Math.sin(state.playerHeading || 0), Math.cos(state.playerHeading || 0)) * 0 + (state.playerHeading || 0));
  g.fillStyle = "#2ee6e6";
  g.beginPath();
  g.moveTo(0, -6);
  g.lineTo(4, 5);
  g.lineTo(0, 2.5);
  g.lineTo(-4, 5);
  g.closePath();
  g.fill();
  g.restore();
}
