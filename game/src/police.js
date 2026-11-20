// police.js — the Azura Bay wanted system and police response.
// Crimes add heat points; stars come from CONFIG thresholds. Cop cars
// pursue, officers chase on foot, roadblocks appear at four stars, and a
// bust meter fills when an officer is close to a slow or on-foot player.

import { CONFIG } from "./config.js";
import { createVehicle, stepVehiclePhysics } from "./vehicles.js";
import { buildFigure } from "./people.js";
import { resolveCollisions } from "./city.js";
import { setSiren, playBusted } from "./audio.js";

export const wanted = {
  points: 0,
  stars: 0,
  bust01: 0,
  seenTimer: 0,
};

const copCars = [];
const officers = [];
let roadblocks = [];
let sceneRef = null;
let bustedFired = false;

export function starsForPoints(points) {
  let stars = 0;
  for (let i = 0; i < CONFIG.wantedThresholds.length; i++) {
    if (points >= CONFIG.wantedThresholds[i]) stars = i;
  }
  return stars;
}

export function addHeat(points, ctx) {
  wanted.points = Math.min(160, wanted.points + points);
  wanted.stars = starsForPoints(wanted.points);
  wanted.seenTimer = 6;
  if (ctx) ctx.heatDirty = true;
}

export function resetWanted() {
  wanted.points = 0;
  wanted.stars = 0;
  wanted.bust01 = 0;
  wanted.seenTimer = 0;
  bustedFired = false;
  setSiren(false);
}

// A fresh respray makes the car unrecognisable: all heat is gone.
export function clearHeatAtRespray() {
  resetWanted();
  for (const car of copCars) car.active = false;
  for (const cop of officers) cop.active = false;
}

export function initPolice(scene, city) {
  sceneRef = scene;
  for (let i = 0; i < CONFIG.copCarCount; i++) {
    const mesh = createVehicle(0xe8ecf2, "cop");
    mesh.visible = false;
    scene.add(mesh);
    copCars.push({
      mesh, active: false,
      state: { pos: { x: 0, z: 0 }, heading: 0, speed: 0, damage: 0, maxSpeed: CONFIG.copMaxSpeed },
    });
  }
  for (let i = 0; i < CONFIG.copFootCount; i++) {
    const mesh = buildFigure(0x2e4a7a);
    mesh.visible = false;
    scene.add(mesh);
    officers.push({ mesh, active: false, speed: 4.4, heading: 0, walkPhase: 0 });
  }
  return { copCars, officers };
}

function spawnNear(entity, playerPos, dist) {
  const a = Math.random() * Math.PI * 2;
  entity.mesh.position.set(
    playerPos.x + Math.sin(a) * dist,
    0,
    playerPos.z + Math.cos(a) * dist
  );
  entity.active = true;
  entity.mesh.visible = true;
}

function ensureRoadblocks(ctx) {
  if (wanted.stars < 4 || roadblocks.length > 0 || !sceneRef) return;
  // Two patrol cars parked across the road ahead of the player.
  for (let i = 0; i < 2; i++) {
    const mesh = createVehicle(0xe8ecf2, "cop");
    const ahead = 55 + i * 10;
    mesh.position.set(
      ctx.playerPos.x + Math.sin(ctx.playerHeading || 0) * ahead + (i - 0.5) * 4,
      0,
      ctx.playerPos.z + Math.cos(ctx.playerHeading || 0) * ahead
    );
    mesh.rotation.y = (ctx.playerHeading || 0) + Math.PI / 2;
    sceneRef.add(mesh);
    roadblocks.push({
      mesh,
      collider: {
        minX: mesh.position.x - 2.4, maxX: mesh.position.x + 2.4,
        minZ: mesh.position.z - 2.4, maxZ: mesh.position.z + 2.4, h: 1.4,
      },
    });
    ctx.city.colliders.push(roadblocks[roadblocks.length - 1].collider);
  }
}

function clearRoadblocks(ctx) {
  for (const rb of roadblocks) {
    sceneRef?.remove(rb.mesh);
    const idx = ctx.city.colliders.indexOf(rb.collider);
    if (idx >= 0) ctx.city.colliders.splice(idx, 1);
  }
  roadblocks = [];
}

export function updatePolice(dt, ctx) {
  const playerPos = ctx.playerPos;
  // Visibility: police "see" the player within 55 units with line of space.
  let anyNear = false;

  if (wanted.stars > 0) {
    wanted.seenTimer -= dt;
    // Activate responders up to a count that scales with the stars.
    const wantCars = Math.min(copCars.length, wanted.stars);
    const wantFoot = Math.min(officers.length, Math.max(0, wanted.stars - 1));
    let activeCars = copCars.filter((c) => c.active).length;
    for (const car of copCars) {
      if (activeCars >= wantCars) break;
      if (!car.active) {
        spawnNear(car, playerPos, 48);
        car.state.pos = { x: car.mesh.position.x, z: car.mesh.position.z };
        car.state.heading = Math.random() * Math.PI * 2;
        car.state.speed = 0;
        activeCars++;
      }
    }
    let activeFoot = officers.filter((o) => o.active).length;
    for (const cop of officers) {
      if (activeFoot >= wantFoot) break;
      if (!cop.active) { spawnNear(cop, playerPos, 30); activeFoot++; }
    }
    ensureRoadblocks(ctx);
  } else {
    for (const car of copCars) { car.active = false; car.mesh.visible = false; }
    for (const cop of officers) { cop.active = false; cop.mesh.visible = false; }
    clearRoadblocks(ctx);
  }

  // Heat decays while no officer is close enough to keep eyes on Rio.
  let nearestOfficer = Infinity;
  for (const car of copCars) {
    if (!car.active) continue;
    const dx = playerPos.x - car.mesh.position.x;
    const dz = playerPos.z - car.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    nearestOfficer = Math.min(nearestOfficer, dist);
    if (dist < 55) { anyNear = true; wanted.seenTimer = 6; }
    if (dist > 130) { car.active = false; car.mesh.visible = false; continue; }
    // Pursuit driving: steer straight at the player, throttle hard.
    const desired = Math.atan2(dx, dz);
    let diff = desired - car.state.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const input = {
      throttle: dist > 6 ? 1 : 0.2,
      steer: Math.max(-1, Math.min(1, diff * 1.6)),
      handbrake: Math.abs(diff) > 2.2,
    };
    stepVehiclePhysics(car.state, input, dt, ctx.wetness || 0);
    car.state.pos = { x: car.mesh.position.x, z: car.mesh.position.z };
    // stepVehiclePhysics works on state.pos; reconcile both ways.
    car.mesh.position.x = car.state.pos.x + Math.sin(car.state.slideDir ?? car.state.heading) * 0;
    car.state.pos.x = car.mesh.position.x;
    car.state.pos.z = car.mesh.position.z;
    // Simpler direct integration toward the target keeps pursuit robust:
    car.mesh.position.x += Math.sin(car.state.heading) * car.state.speed * dt;
    car.mesh.position.z += Math.cos(car.state.heading) * car.state.speed * dt;
    resolveCollisions(ctx.city.colliders, car.mesh.position, 1.3);
    car.mesh.rotation.y = car.state.heading;
    const bar = car.mesh.userData.lightBar;
    if (bar) {
      const blink = Math.sin(ctx.time * 9) > 0;
      bar[0].material.emissiveIntensity = blink ? 3.2 : 0.2;
      bar[1].material.emissiveIntensity = blink ? 0.2 : 3.2;
    }
  }
  for (const cop of officers) {
    if (!cop.active) continue;
    const dx = playerPos.x - cop.mesh.position.x;
    const dz = playerPos.z - cop.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    nearestOfficer = Math.min(nearestOfficer, dist);
    if (dist < 55) { anyNear = true; wanted.seenTimer = 6; }
    if (dist > 120) { cop.active = false; cop.mesh.visible = false; continue; }
    if (dist > 2.2) {
      cop.heading = Math.atan2(dx, dz);
      cop.mesh.position.x += Math.sin(cop.heading) * cop.speed * dt;
      cop.mesh.position.z += Math.cos(cop.heading) * cop.speed * dt;
      cop.mesh.rotation.y = cop.heading;
      cop.walkPhase += dt * 10;
      const legs = cop.mesh.userData.legs;
      if (legs) {
        legs[0].rotation.x = Math.sin(cop.walkPhase) * 0.5;
        legs[1].rotation.x = -Math.sin(cop.walkPhase) * 0.5;
      }
    }
  }

  if (!anyNear && wanted.seenTimer <= 0 && wanted.points > 0) {
    wanted.points = Math.max(0, wanted.points - CONFIG.heatDecayPerSecond * dt * 4);
    wanted.stars = starsForPoints(wanted.points);
    if (wanted.stars === 0) clearRoadblocks(ctx);
  }

  // Bust meter: an officer close to a slow or on-foot player fills it.
  const playerSlow = !ctx.inVehicle || Math.abs(ctx.playerSpeed || 0) < 3;
  if (nearestOfficer < CONFIG.bustRadius && playerSlow && wanted.stars > 0) {
    wanted.bust01 = Math.min(1, wanted.bust01 + CONFIG.bustFillRate * dt);
  } else {
    wanted.bust01 = Math.max(0, wanted.bust01 - CONFIG.bustDrainRate * dt);
  }
  if (wanted.bust01 >= 1 && !bustedFired) {
    bustedFired = true;
    playBusted();
    ctx.onBusted?.();
    resetWanted();
    for (const car of copCars) { car.active = false; car.mesh.visible = false; }
    for (const cop of officers) { cop.active = false; cop.mesh.visible = false; }
    clearRoadblocks(ctx);
  }
  setSiren(wanted.stars > 0 && nearestOfficer < 60);
  return { nearestOfficer };
}

export function getCopCars() { return copCars; }
export function getOfficers() { return officers; }
