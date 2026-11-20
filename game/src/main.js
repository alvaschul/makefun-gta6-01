// main.js — NEON HARBOR game boot and main loop.
// Wires every system together: renderer and sunset lighting, the city,
// Rio on foot and in vehicles, traffic, pedestrians, police, missions,
// weather, procedural audio, the HUD and saving.

import * as THREE from "three";
import { CONFIG, LANDMARKS } from "./config.js";
import { initInput, isDown, wasPressed, mouse, mouseDelta, endFrame } from "./input.js";
import { initAudio, playShot, playHit, playCash, setEngine, stopEngine } from "./audio.js";
import { saveGame, loadGame, clearSave } from "./save.js";
import { buildCity, resolveCollisions } from "./city.js";
import {
  createVehicle, spawnTraffic, updateTraffic, stepVehiclePhysics,
  damageVehicle, getTraffic,
} from "./vehicles.js";
import {
  spawnPedestrians, updatePeople, getPeople, hurtPerson, buildFigure,
} from "./people.js";
import {
  wanted, addHeat, updatePolice, initPolice, clearHeatAtRespray,
  getCopCars, getOfficers,
} from "./police.js";
import {
  initMissions, startNextMission, updateMissions, currentObjectiveText,
  currentTarget, advanceDialogue,
} from "./missions.js";
import { initWeather, updateWeather, weather } from "./weather.js";
import * as hud from "./hud.js";
import { initShots } from "./shots.js";

// ---------------------------------------------------------------- setup
const canvasHost = document.getElementById("nh-game") || document.body;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
canvasHost.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.skyHorizon);
scene.fog = new THREE.Fog(CONFIG.fogColor, 260, 620);

const camera = new THREE.PerspectiveCamera(
  62, window.innerWidth / window.innerHeight, 0.1, 1200
);
camera.position.set(-60, 4, -60);

const hemi = new THREE.HemisphereLight(0xffd9b0, 0x2a2140, 0.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight(CONFIG.sunColor, 1.15);
sun.position.set(-180, 150, -240);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -160;
sun.shadow.camera.right = 160;
sun.shadow.camera.top = 160;
sun.shadow.camera.bottom = -160;
sun.shadow.camera.far = 700;
scene.add(sun);
scene.add(sun.target);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------- world
const city = buildCity(scene);
initWeather(scene);
const trafficState = spawnTraffic(city, CONFIG.trafficCount);
for (const t of trafficState) scene.add(t.mesh);
const pedState = spawnPedestrians(city, CONFIG.pedestrianCount);
for (const p of pedState) scene.add(p.mesh);
initPolice(scene, city);

// Player character (Rio): teal shirt so he reads against the street.
const rio = buildFigure(0x14b8a6);
rio.position.set(-60, 0, -70);
scene.add(rio);

// Rio's own car, parked by the diner at the start.
const heroCarMesh = createVehicle(0xd94f6a, "car");
heroCarMesh.position.set(-66, 0, -78);
heroCarMesh.rotation.y = 0.4;
scene.add(heroCarMesh);

// ---------------------------------------------------------------- state
const state = {
  mode: "title", // title | play | paused | over
  cash: CONFIG.startingCash,
  health: CONFIG.playerHealth,
  time: 0,
  inVehicle: false,
  vehicle: null, // { mesh, state }
  playerHeading: 0,
  playerSpeed: 0,
  lastShotAt: -99,
  shotPos: null,
  lastCrashAt: -99,
  crashPos: null,
  shotMode: false,
  overTimer: 0,
};
const heroVehicle = {
  mesh: heroCarMesh,
  state: {
    pos: { x: heroCarMesh.position.x, z: heroCarMesh.position.z },
    heading: 0.4, speed: 0, damage: 0, maxSpeed: CONFIG.carMaxSpeed,
  },
};
const vehiclesByMesh = new Map();
vehiclesByMesh.set(heroCarMesh, heroVehicle);
for (const t of trafficState) {
  vehiclesByMesh.set(t.mesh, {
    mesh: t.mesh,
    state: { pos: { x: t.mesh.position.x, z: t.mesh.position.z }, heading: t.heading, speed: 0, damage: 0, maxSpeed: CONFIG.carMaxSpeed },
    traffic: t,
  });
}

const playerPos = () => (state.inVehicle ? state.vehicle.mesh.position : rio.position);

function ctx() {
  return {
    scene, camera, renderer, city,
    time: state.time,
    playerPos: playerPos(),
    playerHeading: state.playerHeading,
    playerSpeed: state.playerSpeed,
    inVehicle: state.inVehicle,
    wetness: weather.wetness,
    lastShotAt: state.lastShotAt,
    shotPos: state.shotPos,
    lastCrashAt: state.lastCrashAt,
    crashPos: state.crashPos,
    wantedNow: wanted.stars,
    hud,
    addCash(n) { state.cash += n; },
    saveProgress: saveProgress,
    requestRespray: doRespray,
    onBusted: onBusted,
    parkPlayer(x, z) { rio.position.set(x, 0, z); },
  };
}

function saveProgress() {
  saveGame({
    cash: state.cash,
    missionIndex: undefined,
    health: state.health,
    x: rio.position.x,
    z: rio.position.z,
  });
}

function doRespray() {
  if (state.cash < CONFIG.resprayCost) {
    hud.showToast("Respray costs Rp " + CONFIG.resprayCost);
    return;
  }
  state.cash -= CONFIG.resprayCost;
  clearHeatAtRespray();
  if (state.vehicle) {
    state.vehicle.state.damage = 0;
    const fresh = new THREE.Color().setHSL(Math.random(), 0.65, 0.55);
    state.vehicle.mesh.children.forEach((c) => {
      if (c.material && c.geometry?.parameters?.height === 0.62) c.material = c.material.clone();
    });
    state.vehicle.mesh.traverse((o) => {
      if (o.isMesh && o.material && o.material.metalness === 0.55) o.material.color.copy(fresh);
    });
  }
  playCash();
  hud.showToast("Fresh paint. Nobody recognises this car now.");
}

// ---------------------------------------------------------------- input
initInput(renderer.domElement);
initAudio();
hud.createHud(document.body);

const raycaster = new THREE.Raycaster();
const muzzle = new THREE.Mesh(
  new THREE.SphereGeometry(0.16, 8, 8),
  new THREE.MeshBasicMaterial({ color: 0xffd98a })
);
muzzle.visible = false;
scene.add(muzzle);
const tracerGeo = new THREE.BufferGeometry().setFromPoints(
  [new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]
);
const tracer = new THREE.Line(
  tracerGeo, new THREE.LineBasicMaterial({ color: 0xffe9a8 })
);
tracer.visible = false;
scene.add(tracer);
let muzzleTimer = 0;
let shotCooldown = 0;

function firePistol() {
  if (shotCooldown > 0 || state.inVehicle) return;
  shotCooldown = CONFIG.pistolCooldown;
  playShot();
  state.lastShotAt = state.time;
  state.shotPos = { x: rio.position.x, z: rio.position.z };
  addHeat(CONFIG.heatShotFired, ctx());
  const origin = rio.position.clone().add(new THREE.Vector3(0, 1.45, 0));
  const dir = new THREE.Vector3(
    Math.sin(state.playerHeading), 0, Math.cos(state.playerHeading)
  );
  // Slight spread so shots feel human.
  dir.x += (Math.random() - 0.5) * 0.03;
  dir.z += (Math.random() - 0.5) * 0.03;
  dir.normalize();
  raycaster.set(origin, dir, 0, CONFIG.pistolRange);
  muzzle.position.copy(origin).addScaledVector(dir, 0.7);
  muzzle.visible = true;
  muzzleTimer = CONFIG.muzzleLife;
  const end = origin.clone().addScaledVector(dir, CONFIG.pistolRange);
  // Nearest person hit?
  let best = null;
  let bestDist = Infinity;
  for (const person of getPeople()) {
    if (!person.alive) continue;
    const p = person.mesh.position;
    const to = new THREE.Vector3(p.x - origin.x, 1.1 - origin.y, p.z - origin.z);
    const along = to.dot(dir);
    if (along < 0 || along > CONFIG.pistolRange) continue;
    const closest = origin.clone().addScaledVector(dir, along);
    const d = Math.hypot(p.x - closest.x, p.z - closest.z);
    if (d < 0.6 && along < bestDist) { best = person; bestDist = along; }
  }
  if (best) {
    const died = hurtPerson(best, CONFIG.pistolDamage);
    playHit();
    const p = best.mesh.position;
    tracer.geometry.setFromPoints([origin, new THREE.Vector3(p.x, 1.1, p.z)]);
    addHeat(best.kind === "gang" ? CONFIG.heatHitCop : CONFIG.heatHitPed, ctx());
    void died;
  } else {
    tracer.geometry.setFromPoints([origin, end]);
  }
  tracer.visible = true;
}

// ---------------------------------------------------------------- vehicles
function nearestVehicle() {
  let best = null;
  let bestDist = 3.6;
  for (const [mesh, record] of vehiclesByMesh) {
    const d = rio.position.distanceTo(mesh.position);
    if (d < bestDist) { bestDist = d; best = record; }
  }
  return best;
}

function enterVehicle(record) {
  state.inVehicle = true;
  state.vehicle = record;
  record.state.pos = { x: record.mesh.position.x, z: record.mesh.position.z };
  record.state.heading = record.mesh.rotation.y;
  rio.visible = false;
  if (record.traffic) {
    addHeat(CONFIG.heatVehicleTheft, ctx());
    hud.showToast("Vehicle taken — the owner is calling it in.");
  }
}

function exitVehicle() {
  const record = state.vehicle;
  state.inVehicle = false;
  state.vehicle = null;
  stopEngine();
  const side = new THREE.Vector3(
    Math.cos(record.state.heading), 0, -Math.sin(record.state.heading)
  );
  rio.position.copy(record.mesh.position).addScaledVector(side, 2.2);
  rio.position.y = 0;
  rio.visible = true;
}

function drivePlayer(dt) {
  const record = state.vehicle;
  const s = record.state;
  const input = {
    throttle: (isDown("KeyW") || isDown("ArrowUp") ? 1 : 0)
      + (isDown("KeyS") || isDown("ArrowDown") ? -1 : 0),
    steer: (isDown("KeyA") || isDown("ArrowLeft") ? 1 : 0)
      + (isDown("KeyD") || isDown("ArrowRight") ? -1 : 0),
    handbrake: isDown("Space"),
  };
  const beforeX = record.mesh.position.x;
  const beforeZ = record.mesh.position.z;
  s.pos = { x: beforeX, z: beforeZ };
  const prevSpeed = s.speed;
  stepVehiclePhysics(s, input, dt, weather.wetness);
  record.mesh.position.x = s.pos.x + Math.sin(s.slideDir ?? s.heading) * 0;
  // stepVehiclePhysics already advanced s.pos along the slide direction.
  record.mesh.position.x = s.pos.x;
  record.mesh.position.z = s.pos.z;
  record.mesh.rotation.y = s.heading;
  const hitWall = resolveCollisions(city.colliders, record.mesh.position, 1.35);
  s.pos = { x: record.mesh.position.x, z: record.mesh.position.z };
  if (hitWall && Math.abs(prevSpeed) > 9) {
    damageVehicle(s, 0.08);
    state.lastCrashAt = state.time;
    state.crashPos = { x: record.mesh.position.x, z: record.mesh.position.z };
    playHit();
    s.speed *= 0.35;
  }
  state.playerSpeed = s.speed;
  state.playerHeading = s.heading;
  for (const wheel of record.mesh.userData.wheels || []) {
    wheel.rotation.x += (s.speed * dt) / 0.36;
  }
  setEngine(Math.abs(s.speed) / CONFIG.carMaxSpeed + (input.throttle !== 0 ? 0.25 : 0));
  // Respray bay: driving in with cash triggers the service.
  const dx = record.mesh.position.x - city.respray.x;
  const dz = record.mesh.position.z - city.respray.z;
  if (Math.hypot(dx, dz) < city.respray.radius && Math.abs(s.speed) < 1.5) {
    if (wanted.stars > 0 || s.damage > 0.05) {
      resprayCooldown -= dt;
      if (resprayCooldown <= 0) {
        doRespray();
        resprayCooldown = 4;
      }
    }
  }
}
let resprayCooldown = 0;

// ---------------------------------------------------------------- on foot
let walkPhase = 0;
function movePlayer(dt) {
  let mx = 0, mz = 0;
  // Camera-relative movement on the ground plane.
  const fwd = new THREE.Vector3(Math.sin(state.playerHeading), 0, Math.cos(state.playerHeading));
  const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
  if (isDown("KeyW") || isDown("ArrowUp")) { mx += fwd.x; mz += fwd.z; }
  if (isDown("KeyS") || isDown("ArrowDown")) { mx -= fwd.x; mz -= fwd.z; }
  if (isDown("KeyA") || isDown("ArrowLeft")) { mx -= right.x; mz -= right.z; }
  if (isDown("KeyD") || isDown("ArrowRight")) { mx += right.x; mz += right.z; }
  const len = Math.hypot(mx, mz);
  const running = isDown("ShiftLeft") || isDown("ShiftRight");
  const speed = running ? CONFIG.runSpeed : CONFIG.walkSpeed;
  if (len > 0) {
    mx /= len; mz /= len;
    rio.position.x += mx * speed * dt;
    rio.position.z += mz * speed * dt;
    walkPhase += dt * (running ? 12 : 8);
    const legs = rio.userData.legs;
    if (legs) {
      legs[0].rotation.x = Math.sin(walkPhase) * 0.55;
      legs[1].rotation.x = -Math.sin(walkPhase) * 0.55;
    }
    state.playerSpeed = speed;
  } else {
    state.playerSpeed = 0;
  }
  // Mouse turns Rio while pointer is locked; arrows also turn.
  state.playerHeading -= mouseDelta.x * 0.0032;
  if (isDown("KeyQ")) state.playerHeading += 1.8 * dt;
  if (isDown("KeyE") && false) { /* handled below as edge press */ }
  rio.rotation.y = state.playerHeading;
  resolveCollisions(city.colliders, rio.position, CONFIG.playerRadius);
  const half = CONFIG.worldSize / 2 - 3;
  rio.position.x = Math.max(-half, Math.min(CONFIG.beachX + 24, rio.position.x));
  rio.position.z = Math.max(-half, Math.min(half, rio.position.z));
  if (mouse.clicked) firePistol();
}

// ---------------------------------------------------------------- endings
function onBusted() {
  state.mode = "over";
  state.overTimer = 3.4;
  state.cash = Math.max(0, state.cash - 120);
  hud.showBusted();
  if (state.inVehicle) exitVehicle();
  rio.position.set(60, 0, -18);
}

function onWasted() {
  state.mode = "over";
  state.overTimer = 3.4;
  state.cash = Math.max(0, state.cash - CONFIG.hospitalCost);
  state.health = CONFIG.playerHealth;
  hud.showWasted();
  if (state.inVehicle) exitVehicle();
  rio.position.set(-96, 0, 168);
}

// ---------------------------------------------------------------- title
function startGame(fresh) {
  if (fresh) {
    clearSave();
    state.cash = CONFIG.startingCash;
    state.health = CONFIG.playerHealth;
  } else {
    const saved = loadGame();
    if (saved) {
      state.cash = saved.cash ?? state.cash;
      state.health = saved.health ?? state.health;
      if (typeof saved.x === "number") rio.position.set(saved.x, 0, saved.z);
    }
  }
  hud.hideTitle();
  hud.hideOverlay();
  state.mode = "play";
}

document.getElementById("nh-new")?.addEventListener("click", () => startGame(true));
document.getElementById("nh-continue")?.addEventListener("click", () => startGame(false));

// ---------------------------------------------------------------- loop
initMissions(ctx());
state.shotMode = initShots(ctx());
if (state.shotMode) state.mode = "play";

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.mode === "paused") { endFrame(); return; }
  state.time += dt;
  shotCooldown = Math.max(0, shotCooldown - dt);
  if (muzzleTimer > 0) {
    muzzleTimer -= dt;
    if (muzzleTimer <= 0) { muzzle.visible = false; tracer.visible = false; }
  }

  if (state.mode === "play" && !state.shotMode) {
    if (wasPressed("KeyP") || wasPressed("Escape")) {
      state.mode = "paused";
      hud.showToast("Paused — press P to resume");
      endFrame();
      return;
    }
    if (state.inVehicle) {
      drivePlayer(dt);
      if (wasPressed("KeyE")) exitVehicle();
    } else {
      movePlayer(dt);
      if (wasPressed("KeyE")) {
        const near = nearestVehicle();
        if (near) enterVehicle(near);
        else advanceDialogue();
      }
      if (wasPressed("Enter")) advanceDialogue();
    }
    updateTraffic(dt, ctx());
    updatePeople(dt, ctx());
    updatePolice(dt, ctx());
    updateMissions(dt, ctx());
    updateWeather(dt);
    city.update?.(dt, state.time);
    // Sun shadow follows the player so shadows stay crisp.
    const p = playerPos();
    sun.position.set(p.x - 180, 150, p.z - 240);
    sun.target.position.set(p.x, 0, p.z);
    // Health regen, slowly, out of trouble.
    if (wanted.stars === 0 && state.health < CONFIG.playerHealth) {
      state.health = Math.min(CONFIG.playerHealth, state.health + dt * 2.5);
    }
    if (state.health <= 0) onWasted();
  } else if (state.mode === "paused") {
    if (wasPressed("KeyP")) state.mode = "play";
  } else if (state.mode === "over") {
    state.overTimer -= dt;
    if (state.overTimer <= 0) {
      hud.hideOverlay();
      state.mode = "play";
    }
  }

  // Camera: chase cam in a vehicle, close third person on foot.
  if (!state.shotMode) {
    const p = playerPos();
    if (state.inVehicle) {
      const back = new THREE.Vector3(
        Math.sin(state.playerHeading), 0, Math.cos(state.playerHeading)
      );
      const desired = p.clone().addScaledVector(back, -9.5).add(new THREE.Vector3(0, 4.2, 0));
      camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
      camera.lookAt(p.x + back.x * 6, 1.4, p.z + back.z * 6);
    } else {
      const back = new THREE.Vector3(
        Math.sin(state.playerHeading), 0, Math.cos(state.playerHeading)
      );
      const desired = p.clone().addScaledVector(back, -6.4).add(new THREE.Vector3(0, 3.1, 0));
      camera.position.lerp(desired, 1 - Math.pow(0.0005, dt));
      camera.lookAt(p.x + back.x * 5, 1.5, p.z + back.z * 5);
    }
  }

  // HUD + minimap.
  const police = [];
  for (const c of getCopCars()) if (c.active) police.push(c.mesh.position);
  for (const o of getOfficers()) if (o.active) police.push(o.mesh.position);
  hud.updateHud({
    cash: state.cash,
    health: state.health,
    stars: wanted.stars,
    objective: state.mode === "play" ? currentObjectiveText() : "",
    bust01: wanted.bust01,
    dt,
  });
  if (!state.shotMode) {
    hud.drawMinimap(null, {
      playerPos: playerPos(),
      playerHeading: state.playerHeading,
      landmarks: LANDMARKS,
      target: currentTarget(),
      police,
      traffic: getTraffic().map((t) => t.mesh.position),
      time: state.time,
      worldSize: CONFIG.worldSize,
      roadSpacing: CONFIG.roadSpacing,
      waterX: CONFIG.waterX,
    });
  }
  renderer.render(scene, camera);
  endFrame();
}
requestAnimationFrame(frame);
