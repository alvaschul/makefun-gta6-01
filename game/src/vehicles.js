// vehicles.js — vehicle models, traffic AI and player driving physics.
// Models are assembled from boxes and cylinders: a body, a cabin, four
// wheels, headlights and tail lights. Cop cars get a light bar.

import * as THREE from "three";
import { CONFIG, PALETTE } from "./config.js";
import { pick, range } from "./random.js";
import { resolveCollisions } from "./city.js";

const traffic = [];

function paintMaterial(colorHex) {
  return new THREE.MeshStandardMaterial({
    color: colorHex, roughness: 0.35, metalness: 0.55,
  });
}

function buildWheels(group, w, l, kind) {
  const geo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  const mat = new THREE.MeshStandardMaterial({ color: 0x14141a, roughness: 0.9 });
  const wheels = [];
  const positions = kind === "bike"
    ? [[0, -l / 2 + 0.4], [0, l / 2 - 0.4]]
    : [[-w / 2, -l / 2 + 0.7], [w / 2, -l / 2 + 0.7], [-w / 2, l / 2 - 0.7], [w / 2, l / 2 - 0.7]];
  for (const [x, z] of positions) {
    const wheel = new THREE.Mesh(geo, mat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.36, z);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }
  return wheels;
}

export function createVehicle(colorHex, kind = "car") {
  const group = new THREE.Group();
  const isBike = kind === "bike";
  const isCop = kind === "cop";
  const w = isBike ? 0.7 : 1.9;
  const l = isBike ? 2.2 : 4.3;
  const paint = paintMaterial(isCop ? 0xe8ecf2 : colorHex);

  if (isBike) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 1.7), paint);
    frame.position.y = 0.65;
    frame.castShadow = true;
    group.add(frame);
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.16, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x181820 })
    );
    seat.position.set(0, 0.95, -0.3);
    group.add(seat);
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, 0.62, l), paint);
    body.position.y = 0.62;
    body.castShadow = true;
    group.add(body);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 0.34, 0.7), paint);
    nose.position.set(0, 0.5, l / 2 + 0.2);
    group.add(nose);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.8, 0.55, l * 0.45),
      new THREE.MeshStandardMaterial({ color: 0x18222e, roughness: 0.15, metalness: 0.7 })
    );
    cabin.position.set(0, 1.18, -0.2);
    cabin.castShadow = true;
    group.add(cabin);
    if (isCop) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.04, 0.3, l * 0.96),
        new THREE.MeshStandardMaterial({ color: 0x2e4a7a, roughness: 0.4 })
      );
      stripe.position.y = 0.66;
      group.add(stripe);
      const barBase = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.12, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x111118 })
      );
      barBase.position.set(0, 1.52, -0.2);
      group.add(barBase);
      const redLamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.16, 0.34),
        new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2222, emissiveIntensity: 2.5 })
      );
      redLamp.position.set(-0.28, 1.62, -0.2);
      group.add(redLamp);
      const blueLamp = redLamp.clone();
      blueLamp.material = new THREE.MeshStandardMaterial({
        color: 0x000033, emissive: 0x2266ff, emissiveIntensity: 2.5,
      });
      blueLamp.position.x = 0.28;
      group.add(blueLamp);
      group.userData.lightBar = [redLamp, blueLamp];
    }
  }

  // Headlights (front, +z) and tail lights.
  const headMat = new THREE.MeshStandardMaterial({
    color: 0x444422, emissive: 0xffe9a8, emissiveIntensity: 2.2,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0x330000, emissive: 0xff2a2a, emissiveIntensity: 1.6,
  });
  for (const sx of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), headMat);
    head.position.set(sx * w * 0.32, 0.66, l / 2 + (isBike ? 0.2 : 0.52));
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), tailMat);
    tail.position.set(sx * w * 0.32, 0.7, -l / 2 - 0.03);
    group.add(tail);
  }
  const wheels = buildWheels(group, w, l, kind);
  group.userData.wheels = wheels;
  group.userData.kind = kind;
  group.userData.length = l;
  group.userData.width = w;
  return group;
}

// --- Traffic -------------------------------------------------------------
// Cars follow the road grid: they drive along one axis until an intersection,
// then may turn. Each keeps a simple state record beside its mesh.

export function spawnTraffic(city, count) {
  const made = [];
  const lines = city.roads.vertical;
  for (let i = 0; i < count; i++) {
    const kind = Math.random() < 0.18 ? "bike" : "car";
    const mesh = createVehicle(pick(PALETTE.carPaint), kind);
    const vertical = Math.random() < 0.5;
    const line = pick(lines);
    const along = range(-CONFIG.worldSize / 2 + 20, CONFIG.worldSize / 2 - 20);
    const laneOffset = 3.4;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const state = {
      mesh, kind, vertical, dir,
      speed: 0,
      maxSpeed: CONFIG.trafficMaxSpeed * range(0.75, 1.05),
      panic: 0,
      heading: 0,
    };
    if (vertical) {
      mesh.position.set(line + laneOffset * dir, 0, along);
      state.heading = dir > 0 ? 0 : Math.PI;
    } else {
      mesh.position.set(along, 0, line + laneOffset * (dir > 0 ? -1 : 1));
      state.heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    mesh.rotation.y = state.heading;
    traffic.push(state);
    made.push(state);
  }
  return made;
}

export function getTraffic() {
  return traffic;
}

function nearestIntersection(value, lines) {
  let best = null;
  let bestDist = Infinity;
  for (const l of lines) {
    const d = Math.abs(l - value);
    if (d < bestDist) { bestDist = d; best = l; }
  }
  return { line: best, dist: bestDist };
}

export function updateTraffic(dt, ctx) {
  const lines = ctx.city.roads.vertical;
  for (const car of traffic) {
    // Panic: gunfire nearby freezes traffic for a couple of seconds.
    if (ctx.lastShotAt && ctx.time - ctx.lastShotAt < 2.2) {
      const dx = car.mesh.position.x - (ctx.shotPos?.x ?? 9999);
      const dz = car.mesh.position.z - (ctx.shotPos?.z ?? 9999);
      if (dx * dx + dz * dz < 30 * 30) car.panic = 1.6;
    }
    if (car.panic > 0) car.panic -= dt;

    // Brake when the player is just ahead.
    let target = car.panic > 0 ? 0 : car.maxSpeed;
    const px = ctx.playerPos.x - car.mesh.position.x;
    const pz = ctx.playerPos.z - car.mesh.position.z;
    const aheadX = Math.sin(car.heading);
    const aheadZ = Math.cos(car.heading);
    const forward = px * aheadX + pz * aheadZ;
    const lateral = Math.abs(px * aheadZ - pz * aheadX);
    if (forward > 0 && forward < 9 && lateral < 2.4) target = 0;

    car.speed += Math.sign(target - car.speed) * Math.min(Math.abs(target - car.speed), 14 * dt);
    const step = car.speed * dt;
    car.mesh.position.x += Math.sin(car.heading) * step;
    car.mesh.position.z += Math.cos(car.heading) * step;

    // Turn at intersections with some probability, staying on the grid.
    const crossAxis = car.vertical ? car.mesh.position.z : car.mesh.position.x;
    const near = nearestIntersection(crossAxis, lines);
    if (near.dist < 1.2 && Math.random() < 0.35) {
      const turn = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      car.heading += turn;
      car.vertical = !car.vertical;
      // Snap onto the intersection centre line for the new axis.
      if (car.vertical) car.mesh.position.x = near.line + 3.4 * Math.sign(Math.cos(car.heading)) * 1;
      else car.mesh.position.z = near.line - 3.4 * Math.sign(Math.sin(car.heading)) * 1;
    }
    // Wrap around the map edge instead of leaving the world.
    const half = CONFIG.worldSize / 2 - 6;
    if (Math.abs(car.mesh.position.x) > half || Math.abs(car.mesh.position.z) > half) {
      car.mesh.position.x *= -0.98;
      car.mesh.position.z *= -0.98;
    }
    car.mesh.rotation.y = car.heading;
    for (const wheel of car.mesh.userData.wheels) {
      wheel.rotation.x += (car.speed * dt) / 0.36;
    }
  }
}

// --- Player driving physics ----------------------------------------------
// state: { pos: Vector3-like {x,z}, heading, speed, damage 0..1 }
// input: { throttle -1..1, steer -1..1, handbrake bool }

export function stepVehiclePhysics(state, input, dt, wetness) {
  const damageFactor = 1 - (state.damage || 0) * 0.55;
  const maxF = (state.maxSpeed || CONFIG.carMaxSpeed) * damageFactor;
  const maxR = CONFIG.carMaxReverse;

  if (input.throttle > 0) {
    state.speed += CONFIG.carAccel * input.throttle * dt;
  } else if (input.throttle < 0) {
    if (state.speed > 0.5) state.speed -= CONFIG.carBrake * dt;
    else state.speed += CONFIG.carReverseAccel * input.throttle * dt;
  } else {
    // Engine braking / rolling drag.
    state.speed -= Math.sign(state.speed) * Math.min(Math.abs(state.speed), 4.5 * dt);
  }
  if (input.handbrake) {
    state.speed -= Math.sign(state.speed) * Math.min(Math.abs(state.speed), CONFIG.carBrake * 0.8 * dt);
  }
  state.speed = Math.max(-maxR, Math.min(maxF, state.speed));

  // Steering authority grows with speed but fades at very high speed.
  const speed01 = Math.min(1, Math.abs(state.speed) / 18);
  const steerAuthority = CONFIG.steerRate * speed01 * (1 - speed01 * 0.25);
  const grip = input.handbrake
    ? CONFIG.driftGrip
    : CONFIG.gripDry + (CONFIG.gripWet - CONFIG.gripDry) * (wetness || 0);
  const turn = input.steer * steerAuthority * Math.sign(state.speed || 1);
  state.heading += turn * dt * Math.min(1, grip / CONFIG.gripDry + 0.35);

  // Lateral slide: when grip is low the velocity direction lags the heading.
  if (state.slideDir === undefined) state.slideDir = state.heading;
  let diff = state.heading - state.slideDir;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  state.slideDir += diff * Math.min(1, grip * dt);
  state.sliding = Math.abs(diff) > 0.22 && Math.abs(state.speed) > 8;

  state.pos.x += Math.sin(state.slideDir) * state.speed * dt;
  state.pos.z += Math.cos(state.slideDir) * state.speed * dt;
  return state;
}

// Damage helper used by collision code in main.
export function damageVehicle(state, amount) {
  state.damage = Math.min(1, (state.damage || 0) + amount);
  return state.damage;
}
