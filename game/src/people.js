// People: Rio, the pedestrians of Azura Bay, and the officers who chase him
// share one low-poly humanoid build and one walk cycle — what differs is the
// clothes, the orders they are following and what happens when they are hit.
// A Person is a small state machine (walk, flee, chase, down) the game's
// systems steer through intents, never by reaching into the mesh directly.

import * as THREE from 'three';
import { CITY, PALETTE, PLAYER } from './config.js';
import { resolveCollisions, roadLines } from './city.js';
import { angleDelta, clamp, rngHelpers } from './random.js';

const skinTones = [0xf2c79b, 0xc68863, 0x8a5a3b, 0x6e4525, 0xffdbac];
const shirtColors = [0xff5d8f, 0x35c4b5, 0xffb454, 0x7a6cff, 0xf2f2f2, 0x8bc34a, 0xd64545, 0x3f7fd1];
const pantsColors = [0x2b2f36, 0x3a4a63, 0x6e4525, 0x555b63, 0x22403a];

export function buildPersonMesh({ shirt, pants, skin, cop = false, hero = false }) {
  const group = new THREE.Group();
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.78, 0.24), new THREE.MeshLambertMaterial({ color: pants }));
  legL.position.set(-0.13, 0.39, 0);
  const legR = legL.clone();
  legR.position.x = 0.13;
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.68, 0.3),
    new THREE.MeshLambertMaterial({ color: cop ? 0x22364a : shirt }),
  );
  torso.position.y = 1.12;
  torso.castShadow = true;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.62, 0.17), torso.material);
  armL.position.set(-0.37, 1.14, 0);
  const armR = armL.clone();
  armR.position.x = 0.37;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.21, 10, 8),
    new THREE.MeshLambertMaterial({ color: skin }),
  );
  head.position.y = 1.66;
  head.castShadow = true;
  group.add(legL, legR, torso, armL, armR, head);
  if (cop) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.25, 0.12, 10), new THREE.MeshLambertMaterial({ color: 0x16222e }));
    cap.position.y = 1.84;
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.02), new THREE.MeshBasicMaterial({ color: 0xffe14d }));
    badge.position.set(0.14, 1.24, 0.17);
    group.add(cap, badge);
  }
  if (hero) {
    // Rio's coral jacket reads at a distance — the player must never lose him.
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.14, 0.32), new THREE.MeshBasicMaterial({ color: 0xffe14d }));
    stripe.position.y = 1.28;
    group.add(stripe);
  }
  group.userData = { legL, legR, armL, armR, torso, head };
  return group;
}

let nextPersonId = 1;

export class Person {
  constructor(scene, random, { x, z, cop = false, hero = false, name = '' }) {
    const rng = rngHelpers(random);
    this.id = nextPersonId++;
    this.name = name;
    this.cop = cop;
    this.hero = hero;
    this.mesh = buildPersonMesh({
      shirt: rng.pick(shirtColors),
      pants: rng.pick(pantsColors),
      skin: rng.pick(skinTones),
      cop,
      hero,
    });
    this.x = x;
    this.z = z;
    this.heading = rng.range(0, Math.PI * 2);
    this.health = cop ? 60 : 40;
    this.state = 'walk';       // walk | flee | chase | aim | down | seated
    this.speed = 0;
    this.walkPhase = rng.range(0, 6);
    this.target = null;        // {x, z} the walker is heading for
    this.fleeFrom = null;
    this.fleeTimer = 0;
    this.shootCooldown = rng.range(0.5, 1.5);
    this.dead = false;
    this.car = null;           // the Car this person is driving, if any
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
  }

  get pos() { return this.mesh.position; }

  syncMesh(dt) {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const parts = this.mesh.userData;
    if (this.dead) {
      this.mesh.rotation.x = -Math.PI / 2;
      this.mesh.position.y = 0.25;
      return;
    }
    this.mesh.rotation.x = 0;
    if (this.state === 'seated') {
      this.mesh.position.y = -0.55;
      parts.legL.rotation.x = -1.4;
      parts.legR.rotation.x = -1.4;
      return;
    }
    const swing = Math.sin(this.walkPhase) * clamp(Math.abs(this.speed) / 5, 0, 1) * 0.6;
    parts.legL.rotation.x = swing;
    parts.legR.rotation.x = -swing;
    if (this.state === 'aim') {
      parts.armR.rotation.x = -1.5;
      parts.armL.rotation.x = -1.2;
    } else {
      parts.armL.rotation.x = -swing * 0.8;
      parts.armR.rotation.x = swing * 0.8;
    }
    void dt;
  }

  /** Move toward a point at a speed, turning smoothly; returns distance left. */
  moveToward(dt, tx, tz, speed, colliders) {
    const dx = tx - this.x;
    const dz = tz - this.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) { this.speed = 0; return 0; }
    const want = Math.atan2(dx, dz);
    this.heading += clamp(angleDelta(this.heading, want), -7 * dt, 7 * dt);
    const step = Math.min(dist, speed * dt);
    const nx = this.x + Math.sin(this.heading) * step;
    const nz = this.z + Math.cos(this.heading) * step;
    const resolved = resolveCollisions(colliders, nx, nz, PLAYER.radius);
    this.x = resolved.x;
    this.z = resolved.z;
    this.speed = speed;
    this.walkPhase += dt * speed * 1.9;
    return dist - step;
  }

  hurt(amount, world) {
    if (this.dead) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.dead = true;
      this.state = 'down';
      if (world) world.onPersonDown(this);
    } else if (!this.cop) {
      this.state = 'flee';
      this.fleeTimer = 4;
    }
  }
}

/** A sidewalk point near a road line: where pedestrians amble. */
function sidewalkTarget(rng) {
  const lines = roadLines();
  const vertical = rng.chance(0.5);
  const line = rng.pick(lines);
  const side = rng.chance(0.5) ? -1 : 1;
  const off = side * (CITY.roadHalf + 1.7);
  const along = rng.range(-CITY.extent + 8, CITY.extent - 8);
  return vertical ? { x: line + off, z: along } : { x: along, z: line + off };
}

export function seedPedestrians(scene, random, count = 22) {
  const people = [];
  const rng = rngHelpers(random);
  for (let i = 0; i < count; i += 1) {
    const at = sidewalkTarget(rng);
    const person = new Person(scene, random, { x: at.x, z: at.z });
    person.target = sidewalkTarget(rng);
    people.push(person);
  }
  return people;
}

/** One pedestrian step: amble the sidewalks, run from danger, cower, recover. */
export function stepPedestrian(person, dt, world) {
  if (person.dead || person.state === 'seated') { person.syncMesh(dt); return; }
  if (person.state === 'flee') {
    person.fleeTimer -= dt;
    const from = person.fleeFrom || world.player;
    if (from) {
      const away = Math.atan2(person.x - from.x, person.z - from.z);
      person.moveToward(dt, person.x + Math.sin(away) * 12, person.z + Math.cos(away) * 12, 6.4, world.colliders);
    }
    if (person.fleeTimer <= 0) person.state = 'walk';
    person.syncMesh(dt);
    return;
  }
  if (!person.target || Math.hypot(person.target.x - person.x, person.target.z - person.z) < 1.2) {
    person.target = sidewalkTarget(world.rng);
  }
  person.moveToward(dt, person.target.x, person.target.z, 1.7, world.colliders);
  person.syncMesh(dt);
}
