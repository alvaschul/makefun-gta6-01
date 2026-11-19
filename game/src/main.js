// NEON HARBOR v2 — bootstrap and game loop.
// Builds the city and every system, runs Rio on foot and behind the
// wheel, and wires crimes, missions, police, weather and the HUD into
// one playable whole. Shot mode (?shot=name&seed=n) starts directly in
// a staged scene instead of the title screen.

import * as THREE from "three";
import { CFG, NAMES } from "./config.js";
import { worldRNG, reseedWorldRNG } from "./random.js";
import { createInput } from "./input.js";
import { hasSave, loadSave, storeSave, wipeSave } from "./save.js";
import { AudioEngine } from "./audio.js";
import { buildCity, findLandmark } from "./city.js";
import { VehicleManager } from "./vehicles.js";
import { Person, CrowdManager } from "./people.js";
import { PoliceSystem } from "./police.js";
import { MissionDirector } from "./missions.js";
import { HUD } from "./hud.js";
import { WeatherSystem } from "./weather.js";
import { stageShot } from "./shots.js";

// ---------------------------------------------------------------- setup
const params = new URLSearchParams(window.location.search);
const shotName = params.get("shot");
const shotSeed = Number.parseInt(params.get("seed") ?? "", 10);
if (shotName && Number.isFinite(shotSeed)) reseedWorldRNG(shotSeed);
const rng = worldRNG;

const stage = document.getElementById("nh-stage");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
stage.appendChild(renderer.domElement);
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.1, 3200);
camera.position.set(60, 30, 80);

const city = buildCity(scene, rng);
const vehicles = new VehicleManager(scene, city, rng);
const crowd = new CrowdManager(scene, city, rng, 26);
const police = new PoliceSystem(scene, city, rng);
const audio = new AudioEngine();
const hud = new HUD();
const input = createInput(renderer.domElement);
const weather = new WeatherSystem(scene, rng, { onThunder: () => audio.thunder() });

// checkpoint marker: a soft amber pillar at the objective target
const marker = new THREE.Mesh(
  new THREE.CylinderGeometry(3, 3, 26, 18, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xffc857, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false })
);
marker.visible = false;
scene.add(marker);

// muzzle flash light + tracer line pool
const flashLight = new THREE.PointLight(0xffc37a, 0, 18);
scene.add(flashLight);
const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 });
const tracerGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
const tracer = new THREE.Line(tracerGeo, tracerMat);
tracer.frustumCulled = false;
scene.add(tracer);
let tracerTimer = 0;
let flashTimer = 0;

// ---------------------------------------------------------------- player
const diner = findLandmark(city, "diner");
const player = new Person(scene, {
  x: diner.door.x, z: diner.door.z + 4,
  shirt: 0x1f8a8c, pants: 0x2c3550, skin: 0xc68863,
});
player.health = CFG.player.maxHealth;
player.maxHealth = CFG.player.maxHealth;

const game = {
  mode: "title", // title | playing | paused | wasted | busted | complete
  cash: CFG.player.startCash,
  armour: 0,
  hasPistol: true,
  hour: CFG.day.startHour,
  yaw: Math.PI, pitch: 0.18,
  playerCar: null,
  aiming: false,
  shotCamera: null,
  objectiveOverride: null,
  dialogue: null,
  stats: { earned: 0, carsStolen: 0, busts: 0, wasted: 0, missionsDone: 0, couriersDone: 0 },
  shootCooldown: 0,
  crimeThrottle: 0,
  panicPoint: null,
  panicUntil: 0,
  elapsed: 0,
  saveTimer: 0,
  titleOrbit: 0,
  lastStars: 0,
};

// ---------------------------------------------------------------- missions
function landmarkDoor(id) {
  const lm = findLandmark(city, id);
  return lm ? { x: lm.door.x, z: lm.door.z } : { x: 0, z: 0 };
}

const missions = new MissionDirector({
  setObjective: (text, pos) => { game.objectiveOverride = null; hud.setObjective(text); game.missionTarget = pos; },
  clearObjective: () => { game.missionTarget = null; hud.setObjective("Free roam — visit Mama Lala's Diner for work"); },
  grantCash: (amount, why) => {
    game.cash += amount;
    game.stats.earned += amount;
    if (why === "mission") game.stats.missionsDone += 1;
    if (why === "courier") game.stats.couriersDone += 1;
    audio.blip("cash");
    hud.toast(`+$${amount} — ${why === "mission" ? "job done" : "courier"}`);
    persist();
  },
  addWanted: (n) => police.addPoints(n),
  toast: (msg) => hud.toast(msg),
  playDialogue: (lines, onDone) => startDialogue(lines, onDone),
  spawnGangAt: (pos, n) => crowd.spawnGang(pos.x, pos.z, n),
  landmarkPos: (id) => landmarkDoor(id),
  onStoryComplete: () => {
    game.mode = "complete";
    input.releaseLock();
    hud.showPanel("complete");
    persist();
  },
  blip: () => audio.blip("pickup"),
});
game.missionTarget = null;

// ---------------------------------------------------------------- dialogue
function startDialogue(lines, onDone) {
  game.dialogue = { lines, index: 0, onDone };
  const line = lines[0];
  hud.showDialogue(line.who, line.text);
}
function advanceDialogue() {
  const dlg = game.dialogue;
  if (!dlg) return;
  dlg.index += 1;
  audio.click();
  if (dlg.index >= dlg.lines.length) {
    game.dialogue = null;
    hud.hideDialogue();
    dlg.onDone?.();
  } else {
    const line = dlg.lines[dlg.index];
    hud.showDialogue(line.who, line.text);
  }
}

// ---------------------------------------------------------------- helpers
function playerAnchor() {
  return game.playerCar ? game.playerCar.pos : player.pos;
}
function playerSpeed() {
  return game.playerCar ? game.playerCar.speed : player.speedNow;
}

function setPlayerOnFoot(x, z, angle = 0) {
  if (game.playerCar) exitVehicle(true);
  player.pos.set(x, 0, z);
  player.angle = angle;
  game.yaw = angle;
  player.group.visible = true;
}
function moveVehicle(car, x, z, angle) {
  car.pos.set(x, 0, z);
  car.angle = angle;
  car.mesh.rotation.y = angle;
}
function enterVehicle(car) {
  if (!car || game.playerCar) return;
  const wasParked = car.mode === "parked";
  const wasTraffic = car.mode === "traffic";
  if (wasTraffic) {
    vehicles.traffic = vehicles.traffic.filter((c) => c !== car);
    vehicles.parked.push(car);
  }
  car.mode = "player";
  car.occupied = true;
  game.playerCar = car;
  player.group.visible = false;
  if (wasParked || wasTraffic) {
    if (!car.everStolen) {
      car.everStolen = true;
      game.stats.carsStolen += 1;
      police.addPoints(CFG.wanted.crimePoints.theft);
      missions.notifyTheft();
      hud.toast("Vehicle stolen — heat is on!");
      crowd.scare(car.pos.x, car.pos.z, 14, game.elapsed);
    }
  }
  audio.ensure();
}
function exitVehicle(silent = false) {
  const car = game.playerCar;
  if (!car) return;
  car.mode = "parked";
  car.occupied = false;
  car.speed = 0;
  game.playerCar = null;
  const sideX = car.pos.x + Math.cos(car.angle) * 2.2;
  const sideZ = car.pos.z - Math.sin(car.angle) * 2.2;
  player.pos.set(sideX, 0, sideZ);
  player.angle = car.angle;
  player.group.visible = true;
  audio.setEngine(false, 0);
  if (!silent) audio.click();
}
function givePistol() { game.hasPistol = true; }
function setAiming(on) {
  game.aiming = Boolean(on) && game.hasPistol && !game.playerCar;
  hud.setAiming(game.aiming);
  if (game.aiming) player.aimPose();
}
function setHour(h) { game.hour = ((h % 24) + 24) % 24; }
function setShotCamera(pos, look) { game.shotCamera = { pos, look }; }
function setObjectiveOverride(text, pos) {
  game.objectiveOverride = { text, pos };
  hud.setObjective(text);
}
function startPlaying() {
  game.mode = "playing";
  hud.hidePanels();
  hud.showGame();
}

function persist() {
  storeSave({
    cash: game.cash,
    missionIndex: missions.index,
    storyDone: missions.storyDone,
    playerPos: { x: player.pos.x, z: player.pos.z },
    hour: game.hour,
    stats: game.stats,
  });
}

function resetRun(fromSave) {
  game.cash = fromSave?.cash ?? CFG.player.startCash;
  game.armour = 0;
  player.health = CFG.player.maxHealth;
  player.dead = false;
  player.group.rotation.x = 0;
  player.group.position.y = 0;
  missions.index = fromSave?.missionIndex ?? 0;
  missions.storyDone = Boolean(fromSave?.storyDone);
  missions.active = null;
  missions.courier = null;
  crowd.clearGang();
  police.clearHeat();
  if (game.playerCar) exitVehicle(true);
  const pos = fromSave?.playerPos ?? { x: diner.door.x, z: diner.door.z + 4 };
  setPlayerOnFoot(pos.x, pos.z, Math.PI);
  setHour(fromSave?.hour ?? CFG.day.startHour);
  if (fromSave?.stats) game.stats = { ...game.stats, ...fromSave.stats };
  hud.setObjective(missions.storyDone
    ? "Free roam — courier board at Mama Lala's Diner"
    : "Visit Mama Lala at her diner for work");
  game.missionTarget = null;
}

// expose the surface shots.js stages with
game.city = city;
game.vehicles = vehicles;
game.crowd = crowd;
game.police = police;
game.hud = hud;
game.weather = weather;
game.player = player;
game.missions = missions;
game.setPlayerOnFoot = setPlayerOnFoot;
game.moveVehicle = moveVehicle;
game.enterVehicle = enterVehicle;
game.givePistol = givePistol;
game.setAiming = setAiming;
game.setHour = setHour;
game.setShotCamera = setShotCamera;
game.setObjectiveOverride = setObjectiveOverride;
game.startPlaying = startPlaying;

// ---------------------------------------------------------------- shooting
const raycaster = new THREE.Raycaster();
const tmpDir = new THREE.Vector3();
const tmpOrigin = new THREE.Vector3();

function personFromObject(obj) {
  let node = obj;
  while (node) {
    if (node.userData && node.userData.ownerPerson) return node.userData.ownerPerson;
    node = node.parent;
  }
  return null;
}
for (const ped of crowd.pedestrians) ped.group.userData.ownerPerson = ped;

function firePistol() {
  if (game.shootCooldown > 0 || !game.hasPistol) return;
  game.shootCooldown = CFG.weapons.pistol.cooldown;
  audio.shoot();
  police.addPoints(CFG.wanted.crimePoints.shotFired * 0.4);
  crowd.scare(player.pos.x, player.pos.z, 17, game.elapsed);
  game.panicPoint = { x: player.pos.x, z: player.pos.z };
  game.panicUntil = game.elapsed + 4;

  tmpOrigin.copy(camera.position);
  tmpDir.set(0, 0, -1).applyQuaternion(camera.quaternion);
  tmpDir.x += (rng.next() - 0.5) * CFG.weapons.pistol.spread;
  tmpDir.y += (rng.next() - 0.5) * CFG.weapons.pistol.spread;
  tmpDir.normalize();
  raycaster.set(tmpOrigin, tmpDir);
  raycaster.far = CFG.weapons.pistol.range;

  const targets = [];
  for (const ped of crowd.pedestrians) { ped.group.userData.ownerPerson = ped; targets.push(ped.group); }
  for (const member of crowd.gangMembers) { member.group.userData.ownerPerson = member; targets.push(member.group); }
  for (const officer of police.officers) { officer.group.userData.ownerPerson = officer; targets.push(officer.group); }
  for (const car of [...vehicles.all(), ...police.cars]) targets.push(car.mesh);
  const hits = raycaster.intersectObjects(targets, true);

  let endPoint = tmpOrigin.clone().add(tmpDir.clone().multiplyScalar(CFG.weapons.pistol.range));
  if (hits.length) {
    endPoint = hits[0].point.clone();
    const hitPerson = personFromObject(hits[0].object);
    if (hitPerson && !hitPerson.dead) {
      hitPerson.group.userData.ownerPerson = hitPerson;
      const died = hitPerson.damage(CFG.weapons.pistol.damage);
      if (died) {
        if (hitPerson.gang) police.addPoints(20);
        else police.addPoints(CFG.wanted.crimePoints.killPerson);
        game.panicPoint = { x: hitPerson.pos.x, z: hitPerson.pos.z };
        game.panicUntil = game.elapsed + 5;
      } else if (!hitPerson.gang && !hitPerson.officer) {
        police.addPoints(CFG.wanted.crimePoints.hitPerson * 0.5);
      }
    } else {
      // vehicle hit: find the entity whose mesh contains the object
      let node = hits[0].object;
      while (node) {
        const found = [...vehicles.all(), ...police.cars].find((c) => c.mesh === node);
        if (found) {
          found.damage(9);
          if (police.cars.includes(found)) police.addPoints(CFG.wanted.crimePoints.hitCopCar * 0.4);
          break;
        }
        node = node.parent;
      }
    }
  }
  // tracer + flash at the muzzle (just ahead of the player)
  const muzzle = player.pos.clone();
  muzzle.y = 1.45;
  muzzle.x += Math.sin(game.yaw) * 0.7;
  muzzle.z += Math.cos(game.yaw) * 0.7;
  const positions = tracer.geometry.attributes.position.array;
  positions[0] = muzzle.x; positions[1] = muzzle.y; positions[2] = muzzle.z;
  positions[3] = endPoint.x; positions[4] = endPoint.y; positions[5] = endPoint.z;
  tracer.geometry.attributes.position.needsUpdate = true;
  tracerMat.opacity = 0.9;
  tracerTimer = 0.07;
  flashLight.position.copy(muzzle);
  flashLight.intensity = 26;
  flashTimer = 0.05;
}

// gang return fire + approach behaviour
function updateGang(dt) {
  for (const member of crowd.gangMembers) {
    if (member.dead) continue;
    member.group.userData.ownerPerson = member;
    member.steered = true;
    const d = member.distanceTo(player.pos.x, player.pos.z);
    const anchor = game.playerCar ? game.playerCar.pos : player.pos;
    const distToAnchor = member.distanceTo(anchor.x, anchor.z);
    if (distToAnchor > 15) member.moveToward(dt, anchor.x, anchor.z, 5.2);
    else if (distToAnchor < 6) member.moveToward(dt, member.pos.x * 2 - anchor.x, member.pos.z * 2 - anchor.z, 3);
    else { member.speedNow = 0; member.animate(dt); member.angle = Math.atan2(anchor.x - member.pos.x, anchor.z - member.pos.z); member.group.rotation.y = member.angle; }
    city.resolveCollisions(member.pos, 0.5);
    member.shootCooldown -= dt;
    if (distToAnchor < 34 && member.shootCooldown <= 0 && !game.playerCar) {
      member.shootCooldown = rng.range(0.9, 1.7);
      member.aimPose();
      audio.shoot();
      const hitChance = THREE.MathUtils.clamp(0.42 - distToAnchor * 0.008, 0.08, 0.4);
      if (rng.chance(hitChance)) hurtPlayer(rng.range(5, 11));
      crowd.scare(member.pos.x, member.pos.z, 12, game.elapsed);
    }
    void d;
  }
}

function hurtPlayer(amount) {
  if (game.mode !== "playing" || player.dead) return;
  let remaining = amount;
  if (game.armour > 0) {
    const absorbed = Math.min(game.armour, amount * 0.6);
    game.armour -= absorbed;
    remaining -= absorbed;
  }
  player.health -= remaining;
  if (player.health <= 0) {
    player.health = 0;
    player.damage(9999);
    game.stats.wasted += 1;
    game.mode = "wasted";
    input.releaseLock();
    hud.showPanel("wasted");
    document.getElementById("nh-wasted-note").textContent =
      `Santa Rosa Hospital patched you up. Bill: $${Math.min(CFG.prices.hospitalBill, game.cash)}.`;
  }
}

// ---------------------------------------------------------------- flow buttons
const continueBtn = document.getElementById("nh-btn-continue");
continueBtn.disabled = !hasSave();
document.getElementById("nh-btn-new").addEventListener("click", () => {
  audio.ensure(); audio.click();
  wipeSave();
  resetRun(null);
  startPlaying();
  input.requestLock();
});
continueBtn.addEventListener("click", () => {
  audio.ensure(); audio.click();
  resetRun(loadSave());
  startPlaying();
  input.requestLock();
  hud.toast("Welcome back to Azura Bay, Rio.");
});
document.getElementById("nh-btn-resume").addEventListener("click", () => {
  audio.click();
  startPlaying();
  input.requestLock();
});
document.getElementById("nh-btn-quit-title").addEventListener("click", () => {
  audio.click();
  persist();
  game.mode = "title";
  hud.hideGame();
  hud.showPanel("title");
  continueBtn.disabled = !hasSave();
});
document.getElementById("nh-btn-respawn-hospital").addEventListener("click", () => {
  audio.click();
  game.cash = Math.max(0, game.cash - CFG.prices.hospitalBill);
  player.dead = false;
  player.group.rotation.x = 0;
  player.group.position.y = 0;
  player.health = CFG.player.maxHealth;
  crowd.clearGang();
  if (missions.active?.def.objective.kind === "clearout") missions.failActive("Job blown — Mama Lala will re-offer it.");
  const hospital = findLandmark(city, "hospital");
  setPlayerOnFoot(hospital.door.x, hospital.door.z + 3, 0);
  police.clearHeat();
  startPlaying();
  input.requestLock();
  persist();
});
document.getElementById("nh-btn-respawn-precinct").addEventListener("click", () => {
  audio.click();
  const precinct = findLandmark(city, "precinct");
  setPlayerOnFoot(precinct.door.x, precinct.door.z + 3, 0);
  player.health = Math.max(player.health, 60);
  startPlaying();
  input.requestLock();
  persist();
});
document.getElementById("nh-btn-free-roam").addEventListener("click", () => {
  audio.click();
  startPlaying();
  input.requestLock();
});

// ---------------------------------------------------------------- interactions
function currentInteraction() {
  if (game.dialogue) return { label: "<b>E</b> Continue", action: () => advanceDialogue() };
  const wash = findLandmark(city, "wash");
  const garage = findLandmark(city, "garage");
  if (game.playerCar) {
    const car = game.playerCar;
    if (car.distanceTo(wash.door.x, wash.door.z) < 10 && police.stars > 0) {
      return { label: `<b>E</b> Respray — $${CFG.prices.respray} (clears heat)`, action: doRespray };
    }
    if (car.distanceTo(garage.door.x, garage.door.z) < 10 && car.health < 92) {
      return { label: "<b>E</b> Repair car — $100", action: doRepair };
    }
    return { label: "<b>F</b> Exit vehicle", action: () => exitVehicle() };
  }
  // on foot
  const nearCar = vehicles.nearestParked(player.pos.x, player.pos.z, 3.6);
  if (nearCar) return { label: "<b>E</b> Enter vehicle", action: () => enterVehicle(nearCar) };
  if (player.distanceTo(diner.door.x, diner.door.z) < 5) {
    if (missions.active) return { label: "Mama Lala: finish the job first, nak", action: null };
    if (missions.courier) return { label: "Mama Lala: that parcel won't deliver itself", action: null };
    if (!missions.storyDone) return { label: "<b>E</b> Talk to Mama Lala (next job)", action: () => missions.startNext() };
    return { label: "<b>E</b> Take a courier job", action: () => missions.startCourier(rng, player.pos) };
  }
  const arms = findLandmark(city, "arms");
  if (player.distanceTo(arms.door.x, arms.door.z) < 5 && !game.hasPistol) {
    return { label: "<b>E</b> Pick up the pistol Budi left", action: () => { givePistol(); hud.toast("Pistol acquired."); } };
  }
  return null;
}
function doRespray() {
  if (game.cash < CFG.prices.respray) { hud.toast("Not enough cash for a respray."); return; }
  game.cash -= CFG.prices.respray;
  const car = game.playerCar;
  // a fresh coat: repaint the car body shell a random colour
  const newPaint = rng.pick(CFG.palette.carPaints);
  car.mesh.children[0].material = new THREE.MeshLambertMaterial({ color: newPaint });
  police.clearHeat();
  audio.blip("pickup");
  hud.toast("Fresh paint. The bay never saw you.");
  persist();
}
function doRepair() {
  if (game.cash < 100) { hud.toast("Haris needs $100 up front."); return; }
  game.cash -= 100;
  game.playerCar.health = 100;
  audio.blip("pickup");
  hud.toast("Haris: good as new. Drive nicer, Rio.");
}

// ---------------------------------------------------------------- per-frame updates
function updatePlayerOnFoot(dt) {
  const axes = input.moveAxes();
  const sprinting = input.down("ShiftLeft") || input.down("ShiftRight");
  const aimingNow = (input.state.rightDown || (sprinting && input.state.pointerLocked && game.hasPistol));
  if (!game.dialogue) {
    const delta = input.takeMouseDelta();
    game.yaw -= delta.x * 0.0026;
    game.pitch = THREE.MathUtils.clamp(game.pitch + delta.y * 0.0022, -0.5, 0.9);
  }
  setAiming(aimingNow && axes.z >= 0);
  const speed = game.aiming ? 2.4 : sprinting ? CFG.player.sprintSpeed : CFG.player.walkSpeed;
  if ((axes.x !== 0 || axes.z !== 0) && !game.dialogue) {
    // camera forward on the ground plane is -(sin yaw, cos yaw); the
    // camera's right hand is (cos yaw, -sin yaw). W walks forward.
    const len = Math.hypot(axes.x, axes.z) || 1;
    const fwdX = -Math.sin(game.yaw);
    const fwdZ = -Math.cos(game.yaw);
    const rightX = Math.cos(game.yaw);
    const rightZ = -Math.sin(game.yaw);
    const moveX = (fwdX * -axes.z + rightX * axes.x) / len;
    const moveZ = (fwdZ * -axes.z + rightZ * axes.x) / len;
    player.pos.x += moveX * speed * dt;
    player.pos.z += moveZ * speed * dt;
    player.angle = game.aiming ? game.yaw + Math.PI : Math.atan2(moveX, moveZ);
    player.speedNow = speed;
  } else {
    player.speedNow = 0;
  }
  player.animate(dt);
  player.group.rotation.y = player.angle;
  city.resolveCollisions(player.pos, CFG.player.radius);
  city.clampToWorld(player.pos);
  if (input.state.mouseDown && game.aiming) firePistol();
}

function updateDriving(dt) {
  const car = game.playerCar;
  const axes = input.moveAxes();
  const throttle = -axes.z; // W (z=-1) drives forward
  const steer = axes.x;
  const ratio = car.drive(dt, throttle, steer, weather.wetness);
  audio.setEngine(true, ratio);
  city.clampToWorld(car.pos);
  const hitBuilding = city.resolveCollisions(car.pos, 1.7);
  if (hitBuilding && Math.abs(car.speed) > 7) {
    car.damage(Math.abs(car.speed) * 0.55);
    car.speed *= -0.25;
    if (game.crimeThrottle <= 0) {
      police.addPoints(CFG.wanted.crimePoints.hitCar * 0.5);
      game.crimeThrottle = 1.2;
    }
  }
  // collisions with other vehicles and people
  for (const other of [...vehicles.all(), ...police.cars]) {
    if (other === car) continue;
    const d = car.distanceTo(other.pos.x, other.pos.z);
    if (d < 3.1 && Math.abs(car.speed) > 2) {
      other.damage(Math.abs(car.speed) * 0.8);
      car.damage(Math.abs(car.speed) * 0.35);
      car.speed *= 0.45;
      crowd.scare(car.pos.x, car.pos.z, 13, game.elapsed);
      if (game.crimeThrottle <= 0) {
        police.addPoints(police.cars.includes(other)
          ? CFG.wanted.crimePoints.hitCopCar : CFG.wanted.crimePoints.hitCar);
        game.crimeThrottle = 1.2;
      }
    }
  }
  for (const ped of [...crowd.pedestrians, ...crowd.gangMembers]) {
    if (ped.dead) continue;
    if (ped.distanceTo(car.pos.x, car.pos.z) < 1.9 && Math.abs(car.speed) > 3.5) {
      const died = ped.damage(65);
      police.addPoints(died ? CFG.wanted.crimePoints.killPerson : CFG.wanted.crimePoints.hitPerson);
      crowd.scare(car.pos.x, car.pos.z, 18, game.elapsed);
      car.speed *= 0.7;
      hud.toast(died ? "You ran someone down!" : "You clipped a pedestrian!");
    }
  }
  if (input.pressed("KeyR")) {
    const next = (audio.radioStation + 2) % 4 - 1; // cycles -1,0,1,2
    audio.setRadio(next);
    hud.setRadio(next < 0 ? "" : `♪ ${audio.radioName()}`);
    audio.click();
  }
}

function updateCamera(dt) {
  if (game.shotCamera) {
    camera.position.set(game.shotCamera.pos.x, game.shotCamera.pos.y, game.shotCamera.pos.z);
    camera.lookAt(game.shotCamera.look.x, game.shotCamera.look.y, game.shotCamera.look.z);
    return;
  }
  if (game.mode === "title") {
    game.titleOrbit += dt * 0.05;
    const r = 150;
    camera.position.set(Math.sin(game.titleOrbit) * r, 42, Math.cos(game.titleOrbit) * r);
    camera.lookAt(0, 8, 0);
    return;
  }
  if (game.playerCar) {
    const car = game.playerCar;
    const back = game.aiming ? 6 : 10.5;
    const target = new THREE.Vector3(
      car.pos.x - Math.sin(car.angle) * back,
      4.2,
      car.pos.z - Math.cos(car.angle) * back
    );
    camera.position.lerp(target, Math.min(1, dt * 5));
    camera.lookAt(car.pos.x + Math.sin(car.angle) * 8, 1.4, car.pos.z + Math.cos(car.angle) * 8);
    return;
  }
  const dist = game.aiming ? 3.4 : 6.8; // tightened in playtesting: Rio reads better in frame
  const height = game.aiming ? 1.9 : 3.1;
  const backX = player.pos.x + Math.sin(game.yaw) * dist * Math.cos(game.pitch);
  const backZ = player.pos.z + Math.cos(game.yaw) * dist * Math.cos(game.pitch);
  const backY = height + Math.sin(game.pitch) * dist;
  camera.position.lerp(new THREE.Vector3(backX, backY, backZ), Math.min(1, dt * 14));
  const shoulder = game.aiming ? 0.85 : 0;
  const lookX = player.pos.x - Math.sin(game.yaw) * 12 + Math.cos(game.yaw) * shoulder;
  const lookZ = player.pos.z - Math.cos(game.yaw) * 12 - Math.sin(game.yaw) * shoulder;
  camera.lookAt(lookX, 1.55 - Math.sin(game.pitch) * 6, lookZ);
}

function updateHUD() {
  hud.setCash(game.cash);
  hud.setStars(police.stars);
  hud.setClock(game.hour, weather.label);
  hud.setVitals(player.health, game.armour);
  hud.setTimer(missions.timerValue());
  hud.setBust(police.bust);
  hud.setWeapon(game.playerCar ? "DRIVING" : game.hasPistol ? "PISTOL" : "FISTS");
  const target = game.objectiveOverride?.pos ?? missions.currentTarget() ?? game.missionTarget;
  if (target) {
    marker.visible = true;
    marker.position.set(target.x, 13, target.z);
    marker.rotation.y += 0.01;
  } else marker.visible = false;
  hud.drawMinimap({
    player: { x: playerAnchor().x, z: playerAnchor().z, angle: game.playerCar ? game.playerCar.angle : player.angle },
    pedestrians: crowd.pedestrians.filter((p) => !p.dead).map((p) => ({ x: p.pos.x, z: p.pos.z })),
    copCars: police.cars.map((c) => ({ x: c.pos.x, z: c.pos.z })),
    gang: crowd.livingGang().map((g) => ({ x: g.pos.x, z: g.pos.z })),
    objective: target,
  });
}

// ---------------------------------------------------------------- main loop
const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  game.elapsed += dt;
  game.shootCooldown = Math.max(0, game.shootCooldown - dt);
  game.crimeThrottle = Math.max(0, game.crimeThrottle - dt);
  tracerTimer -= dt;
  if (tracerTimer <= 0) tracerMat.opacity = 0;
  flashTimer -= dt;
  if (flashTimer <= 0) flashLight.intensity = 0;

  // the world always breathes, even behind panels
  game.hour = (game.hour + (CFG.day.minutesPerSecond * dt) / 60) % 24;
  const sunState = city.update(game.hour, dt);
  const weatherState = weather.update(dt, camera.position, sunState.daylight);
  if (weatherState.flash > 0) city.skyMat.color.offsetHSL(0, 0, weatherState.flash * 0.25);
  crowd.update(dt, game.elapsed);
  vehicles.updateTraffic(dt, playerAnchor(), game.elapsed < game.panicUntil ? game.panicPoint : null);

  if (game.mode === "playing") {
    if (game.dialogue) {
      if (input.pressed("KeyE") || input.pressed("KeyF")) advanceDialogue();
    } else if (game.playerCar) {
      updateDriving(dt);
      if (input.pressed("KeyF")) exitVehicle();
      else if (input.pressed("KeyE")) currentInteraction()?.action?.();
    } else {
      updatePlayerOnFoot(dt);
      if (input.pressed("KeyE") || input.pressed("KeyF")) currentInteraction()?.action?.();
    }

    const anchor = playerAnchor();
    const nearestCop = police.update(dt, {
      x: anchor.x, z: anchor.z,
      speed: playerSpeed(), onFoot: !game.playerCar, hidden: false,
    }, {
      onBusted: () => {
        const fine = CFG.prices.bustFineBase + CFG.prices.bustFinePerStar * police.stars;
        game.cash = Math.max(0, game.cash - fine);
        game.stats.busts += 1;
        document.getElementById("nh-busted-note").textContent =
          `The precinct took a $${fine} fine. Your wheels stay impounded.`;
        if (game.playerCar) exitVehicle(true);
        police.clearHeat();
        game.mode = "busted";
        input.releaseLock();
        hud.showPanel("busted");
      },
    });
    audio.setSiren(police.stars > 0 && nearestCop < 60, THREE.MathUtils.clamp(1 - nearestCop / 60, 0, 1));
    audio.update(dt, Boolean(game.playerCar));
    if (!game.playerCar) audio.setEngine(false, 0);

    missions.update(dt, { distanceTo: (x, z) => Math.hypot(anchor.x - x, anchor.z - z) });
    missions.notifyStars(police.stars);
    if (police.stars !== game.lastStars) {
      game.lastStars = police.stars;
      if (!game.objectiveOverride) {
        const text = missions.currentObjectiveText();
        if (text) hud.setObjective(text);
      }
    }
    updateGang(dt);

    // interaction prompt
    const interaction = game.dialogue ? null : currentInteraction();
    hud.setPrompt(game.dialogue ? null : interaction?.label ?? null);

    if (input.pressed("KeyM")) {
      const muted = audio.toggleMute();
      hud.toast(muted ? "Sound off" : "Sound on");
    }
    if (input.pressed("Escape")) {
      game.mode = "paused";
      input.releaseLock();
      hud.showPanel("pause");
      persist();
    }
    game.saveTimer += dt;
    if (game.saveTimer > 15) { game.saveTimer = 0; persist(); }
    updateHUD();
  } else if (game.mode === "title") {
    // gentle attract mode: traffic and crowds keep moving behind the title
    police.bust = 0;
  }

  updateCamera(dt);
  input.endFrame();
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------- entry
resetRun(null);
if (shotName) {
  hud.hidePanels();
  stageShot(game, shotName);
} else {
  hud.showPanel("title");
}
frame();
