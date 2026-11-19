// NEON HARBOR v2 — people: low-poly figures for Rio, pedestrians and
// gang members, with sidewalk wandering, panic, and a health model.

import * as THREE from "three";
import { CFG } from "./config.js";
import { blockCenter } from "./city.js";

const SKIN_TONES = [0xf2c89b, 0xc68863, 0x8d5524, 0xffdbac];
const SHIRTS = [0x3f7fbf, 0xd64550, 0xf2b134, 0x4caf7d, 0xe8e6df, 0x8e44ad, 0xef7f45];
const PANTS = [0x2c3550, 0x4a3b2a, 0x22262e, 0x5a6b7a];

export class Person {
  constructor(scene, { x = 0, z = 0, shirt, pants, skin, gang = false, officer = false } = {}) {
    this.group = new THREE.Group();
    const shirtColor = officer ? 0x24457e : gang ? CFG.palette.gangShirt : shirt ?? 0x3f7fbf;
    const legColor = officer ? 0x1c2f4e : pants ?? 0x2c3550;
    const skinColor = skin ?? 0xd9a066;
    const mat = (c) => new THREE.MeshLambertMaterial({ color: c });

    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.34), mat(shirtColor));
    this.torso.position.y = 1.12;
    this.group.add(this.torso);
    this.head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.44, 0.4), mat(skinColor));
    this.head.position.y = 1.76;
    this.group.add(this.head);
    if (officer) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.46), mat(0x16294f));
      cap.position.y = 2.02;
      this.group.add(cap);
    }
    if (gang) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.1, 0.44), mat(0xff5722));
      band.position.y = 1.94;
      this.group.add(band);
    }
    const limb = (w, h, c) => new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat(c));
    this.armL = limb(0.16, 0.68, shirtColor); this.armL.position.set(-0.4, 1.14, 0);
    this.armR = limb(0.16, 0.68, shirtColor); this.armR.position.set(0.4, 1.14, 0);
    this.legL = limb(0.2, 0.78, legColor); this.legL.position.set(-0.16, 0.39, 0);
    this.legR = limb(0.2, 0.78, legColor); this.legR.position.set(0.16, 0.39, 0);
    // pivot limbs at their tops so swing looks like walking
    for (const part of [this.armL, this.armR]) part.geometry.translate(0, -0.3, 0);
    for (const part of [this.legL, this.legR]) part.geometry.translate(0, -0.34, 0);
    this.armL.position.y = 1.44; this.armR.position.y = 1.44;
    this.legL.position.y = 0.76; this.legR.position.y = 0.76;
    this.group.add(this.armL, this.armR, this.legL, this.legR);
    for (const part of [this.torso, this.head, this.armL, this.armR, this.legL, this.legR]) {
      part.castShadow = true;
    }

    this.group.position.set(x, 0, z);
    scene.add(this.group);
    this.pos = this.group.position;
    this.angle = 0;
    this.health = gang ? 70 : 50;
    this.maxHealth = this.health;
    this.dead = false;
    this.walkPhase = Math.random() * Math.PI * 2;
    this.gang = gang;
    this.officer = officer;
    this.speedNow = 0;
  }

  /** Walk toward a point; swing limbs in proportion to speed. */
  moveToward(dt, tx, tz, speed) {
    const dx = tx - this.pos.x;
    const dz = tz - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.15) { this.speedNow = 0; this.animate(dt); return true; }
    const targetAngle = Math.atan2(dx, dz);
    let diff = targetAngle - this.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.angle += THREE.MathUtils.clamp(diff, -7 * dt, 7 * dt);
    const step = Math.min(speed * dt, dist);
    this.pos.x += Math.sin(this.angle) * step;
    this.pos.z += Math.cos(this.angle) * step;
    this.speedNow = speed;
    this.animate(dt);
    return false;
  }

  animate(dt) {
    this.group.rotation.y = this.angle;
    if (this.dead) return;
    this.walkPhase += dt * (2 + this.speedNow * 1.7);
    const swing = Math.sin(this.walkPhase) * Math.min(0.65, this.speedNow * 0.13);
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.8;
    this.armR.rotation.x = swing * 0.8;
  }

  /** Point the gun arm at a target while aiming (player / gang). */
  aimPose() {
    this.armR.rotation.x = -Math.PI / 2 + 0.12;
    this.armL.rotation.x = -Math.PI / 2 + 0.3;
  }

  damage(amount) {
    if (this.dead) return true;
    this.health -= amount;
    if (this.health <= 0) {
      this.dead = true;
      this.group.rotation.x = Math.PI / 2;
      this.group.position.y = 0.25;
      return true;
    }
    return false;
  }

  distanceTo(x, z) {
    return Math.hypot(this.pos.x - x, this.pos.z - z);
  }
}

export class CrowdManager {
  constructor(scene, city, rng, count = 26) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.pedestrians = [];
    this.gangMembers = [];
    for (let i = 0; i < count; i++) {
      const ped = new Person(scene, {
        x: 0, z: 0,
        shirt: rng.pick(SHIRTS), pants: rng.pick(PANTS), skin: rng.pick(SKIN_TONES),
      });
      this.placeOnSidewalk(ped);
      ped.brain = { target: null, wait: 0, panicUntil: 0, cower: false };
      this.pedestrians.push(ped);
    }
  }

  placeOnSidewalk(person) {
    const W = CFG.world;
    const bx = this.rng.int(0, W.blocksPerSide - 1);
    const bz = this.rng.int(0, W.blocksPerSide - 1);
    const edge = W.blockSize / 2 + 2.6;
    person.pos.x = blockCenter(bx) + this.rng.range(-edge, edge);
    person.pos.z = blockCenter(bz) + (this.rng.chance(0.5) ? edge : -edge);
  }

  sidewalkTarget(fromPos) {
    const W = CFG.world;
    const bx = this.rng.int(0, W.blocksPerSide - 1);
    const bz = this.rng.int(0, W.blocksPerSide - 1);
    const edge = W.blockSize / 2 + 2.6;
    return {
      x: blockCenter(bx) + this.rng.range(-edge, edge),
      z: blockCenter(bz) + this.rng.range(-edge, edge),
    };
  }

  /** Panic spreads from a point: nearby peds flee, a few cower. */
  scare(x, z, radius, nowSeconds) {
    for (const ped of this.pedestrians) {
      if (ped.dead) continue;
      if (ped.distanceTo(x, z) < radius) {
        ped.brain.panicUntil = nowSeconds + this.rng.range(2.5, 5);
        ped.brain.cower = this.rng.chance(0.3);
        ped.brain.target = null;
        ped.brain.scareX = x;
        ped.brain.scareZ = z;
      }
    }
  }

  update(dt, nowSeconds) {
    for (const ped of this.pedestrians) {
      if (ped.dead) continue;
      const brain = ped.brain;
      if (nowSeconds < brain.panicUntil) {
        if (brain.cower) {
          ped.speedNow = 0;
          ped.group.scale.y = 0.72; // crouched down
          ped.animate(dt);
          continue;
        }
        ped.group.scale.y = 1;
        // run directly away from the last scare origin stored on the brain
        const awayX = ped.pos.x + (ped.pos.x - (brain.scareX ?? ped.pos.x - 1)) * 2;
        const awayZ = ped.pos.z + (ped.pos.z - (brain.scareZ ?? ped.pos.z)) * 2;
        ped.moveToward(dt, awayX, awayZ, 7.5);
        this.city.resolveCollisions(ped.pos, 0.5);
        continue;
      }
      ped.group.scale.y = 1;
      if (brain.wait > 0) {
        brain.wait -= dt;
        ped.speedNow = 0;
        ped.animate(dt);
        continue;
      }
      if (!brain.target) brain.target = this.sidewalkTarget(ped.pos);
      const arrived = ped.moveToward(dt, brain.target.x, brain.target.z, 2.1);
      this.city.resolveCollisions(ped.pos, 0.5);
      if (arrived) {
        brain.target = null;
        brain.wait = this.rng.range(0.5, 4);
      }
    }
    // gang members are updated by missions/main combat code, but keep
    // their idle animation ticking here when nobody is steering them
    for (const member of this.gangMembers) {
      if (!member.dead && !member.steered) member.animate(dt);
      member.steered = false;
    }
  }

  spawnGang(x, z, count) {
    const spawned = [];
    for (let i = 0; i < count; i++) {
      const member = new Person(this.scene, {
        x: x + this.rng.range(-6, 6),
        z: z + this.rng.range(-6, 6),
        gang: true,
        skin: this.rng.pick(SKIN_TONES),
      });
      member.shootCooldown = this.rng.range(0.4, 1.4);
      this.gangMembers.push(member);
      spawned.push(member);
    }
    return spawned;
  }

  clearGang() {
    for (const member of this.gangMembers) this.scene.remove(member.group);
    this.gangMembers = [];
  }

  livingGang() {
    return this.gangMembers.filter((m) => !m.dead);
  }
}
