// people.js — the pedestrians of Azura Bay and mission gang members.
// Figures are simple low-poly people: legs, torso, head, in bright tropical
// shirts. They wander sidewalks, chat in pairs, and react to violence.

import * as THREE from "three";
import { CONFIG } from "./config.js";
import { pick, range } from "./random.js";
import { resolveCollisions } from "./city.js";

const SHIRTS = [0xff5a7a, 0x2ee6e6, 0xf2b134, 0x7ad95a, 0xe8e4da, 0x9a5cff, 0xff8c5a];
const SKIN = [0x8a5a3c, 0x6a4230, 0xa8744c, 0x54331f, 0xc49a68];
const people = [];

export function buildFigure(shirtColor, opts = {}) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.9 });
  const skinMat = new THREE.MeshStandardMaterial({ color: pick(SKIN), roughness: 0.8 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2c3040, roughness: 1 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.72, 0.3), mat);
  torso.position.y = 1.12;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.3), skinMat);
  head.position.y = 1.72;
  head.castShadow = true;
  group.add(head);
  const legs = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.78, 0.2), legMat);
    leg.position.set(sx * 0.14, 0.39, 0);
    group.add(leg);
    legs.push(leg);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.62, 0.15), mat);
    arm.position.set(sx * 0.34, 1.14, 0);
    group.add(arm);
  }
  group.userData.legs = legs;
  if (opts.gang) {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.1, 0.34),
      new THREE.MeshStandardMaterial({ color: opts.gang, emissive: opts.gang, emissiveIntensity: 0.5 })
    );
    band.position.y = 1.86;
    group.add(band);
  }
  return group;
}

function sidewalkPoint(city) {
  const lines = city.roads.vertical;
  const line = pick(lines);
  const along = range(-CONFIG.worldSize / 2 + 16, CONFIG.worldSize / 2 - 16);
  const side = Math.random() < 0.5 ? -1 : 1;
  if (Math.random() < 0.5) {
    return { x: line + side * (CONFIG.roadWidth / 2 + 1.6), z: along, vertical: true, line };
  }
  return { x: along, z: line + side * (CONFIG.roadWidth / 2 + 1.6), vertical: false, line };
}

export function spawnPedestrians(city, count) {
  const made = [];
  for (let i = 0; i < count; i++) {
    const mesh = buildFigure(pick(SHIRTS));
    const start = sidewalkPoint(city);
    mesh.position.set(start.x, 0, start.z);
    const ped = {
      mesh, kind: "ped",
      health: 60,
      state: "wander",
      speed: range(1.1, 2.1),
      heading: range(0, Math.PI * 2),
      target: null,
      timer: range(1, 5),
      chatPartner: null,
      walkPhase: range(0, 6),
      alive: true,
    };
    // Pair up some pedestrians as chatters standing face to face.
    if (i % 5 === 4 && made.length > 0) {
      const partner = made[made.length - 1];
      ped.state = "chat";
      partner.state = "chat";
      ped.chatPartner = partner;
      partner.chatPartner = ped;
      mesh.position.set(partner.mesh.position.x + 0.9, 0, partner.mesh.position.z + 0.4);
    }
    people.push(ped);
    made.push(ped);
  }
  return made;
}

export function getPeople() {
  return people;
}

// A Coral Kings member (or other mission character) at a fixed spot.
export function spawnGangMember(pos, color = 0xc23c4e) {
  const mesh = buildFigure(color, { gang: color });
  mesh.position.set(pos.x, 0, pos.z ?? pos.y ?? 0);
  const member = {
    mesh, kind: "gang",
    health: 100,
    state: "stand",
    speed: 3.4,
    heading: 0,
    target: null,
    timer: 0,
    chatPartner: null,
    walkPhase: 0,
    alive: true,
  };
  people.push(member);
  return member;
}

function scareCheck(ped, ctx) {
  if (!ctx) return false;
  const px = ped.mesh.position.x;
  const pz = ped.mesh.position.z;
  let danger = null;
  if (ctx.lastShotAt && ctx.time - ctx.lastShotAt < 1.2 && ctx.shotPos) {
    const dx = px - ctx.shotPos.x, dz = pz - ctx.shotPos.z;
    if (dx * dx + dz * dz < 26 * 26) danger = ctx.shotPos;
  }
  if (ctx.lastCrashAt && ctx.time - ctx.lastCrashAt < 1 && ctx.crashPos) {
    const dx = px - ctx.crashPos.x, dz = pz - ctx.crashPos.z;
    if (dx * dx + dz * dz < 14 * 14) danger = ctx.crashPos;
  }
  if (danger) {
    ped.state = Math.random() < 0.55 ? "flee" : "cower";
    ped.timer = range(2, 4);
    ped.heading = Math.atan2(px - danger.x, pz - danger.z);
    return true;
  }
  return false;
}

export function updatePeople(dt, ctx) {
  for (const ped of people) {
    if (!ped.alive) continue;
    const pos = ped.mesh.position;
    scareCheck(ped, ctx);
    ped.timer -= dt;

    if (ped.state === "chat") {
      if (ped.chatPartner && ped.chatPartner.alive) {
        const p = ped.chatPartner.mesh.position;
        ped.mesh.rotation.y = Math.atan2(p.x - pos.x, p.z - pos.z);
      }
      if (ped.timer <= 0 && Math.random() < 0.3) {
        ped.state = "wander";
        ped.timer = range(2, 6);
        if (ped.chatPartner) ped.chatPartner.state = "wander";
      }
      continue;
    }
    if (ped.state === "cower") {
      ped.mesh.scale.y = 0.62;
      if (ped.timer <= 0) { ped.state = "wander"; ped.mesh.scale.y = 1; }
      continue;
    }
    ped.mesh.scale.y = 1;

    if (ped.state === "flee") {
      pos.x += Math.sin(ped.heading) * 4.6 * dt;
      pos.z += Math.cos(ped.heading) * 4.6 * dt;
      if (ped.timer <= 0) ped.state = "wander";
    } else {
      // Wander: pick short targets and stroll toward them.
      if (!ped.target || ped.timer <= 0) {
        ped.target = {
          x: pos.x + range(-26, 26),
          z: pos.z + range(-26, 26),
        };
        ped.timer = range(3, 7);
      }
      const dx = ped.target.x - pos.x;
      const dz = ped.target.z - pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.6) {
        ped.heading = Math.atan2(dx, dz);
        pos.x += Math.sin(ped.heading) * ped.speed * dt;
        pos.z += Math.cos(ped.heading) * ped.speed * dt;
      }
    }
    // Keep pedestrians inside the city and out of the water.
    const half = CONFIG.worldSize / 2 - 4;
    pos.x = Math.max(-half, Math.min(CONFIG.beachX + 18, pos.x));
    pos.z = Math.max(-half, Math.min(half, pos.z));
    if (ctx?.city) resolveCollisions(ctx.city.colliders, pos, 0.45);
    ped.mesh.rotation.y = ped.heading;
    ped.walkPhase += dt * (ped.state === "flee" ? 13 : 7);
    const swing = Math.sin(ped.walkPhase) * 0.45;
    const legs = ped.mesh.userData.legs;
    if (legs) {
      legs[0].rotation.x = swing;
      legs[1].rotation.x = -swing;
    }
  }
}

// Remove a person from the world (shot, run over). Returns true if it died.
export function hurtPerson(ped, damage) {
  ped.health -= damage;
  if (ped.health <= 0 && ped.alive) {
    ped.alive = false;
    ped.mesh.rotation.x = -Math.PI / 2;
    ped.mesh.position.y = 0.25;
    return true;
  }
  ped.state = "flee";
  ped.timer = 3;
  return false;
}
