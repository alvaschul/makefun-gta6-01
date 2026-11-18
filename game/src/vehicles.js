// Cars: how they look, how they drive, and how the city's traffic thinks.
// One Car class serves parked cars, flowing traffic, the police interceptors
// (police.js dresses and drives its own) and whatever Rio is driving — the
// difference is only who is feeding it throttle and steering each step.
// Traffic follows the road grid honestly: a car holds a lane on a road line,
// and at each intersection it may turn onto the crossing road, so the city
// streams with believable flow instead of cars wandering the pavements.

import * as THREE from 'three';
import { CAR, CITY, PALETTE } from './config.js';
import { onRoad, resolveCollisions, roadLines } from './city.js';
import { angleDelta, clamp, rngHelpers } from './random.js';

const bodyGeo = new THREE.BoxGeometry(1.9, 0.62, 4.3);
const cabinGeo = new THREE.BoxGeometry(1.66, 0.55, 2.1);
const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14171b });
const glassMat = new THREE.MeshPhongMaterial({ color: 0x9fd8ef, shininess: 90 });
const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff4040 });

export function buildCarMesh(paint, { cop = false } = {}) {
  const group = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({ color: paint, shininess: 70 });
  const body = new THREE.Mesh(bodyGeo, mat);
  body.position.y = 0.55;
  body.castShadow = true;
  const cabin = new THREE.Mesh(cabinGeo, glassMat);
  cabin.position.set(0, 1.1, -0.25);
  cabin.castShadow = true;
  group.add(body, cabin);
  if (cop) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.2, 4.34), new THREE.MeshBasicMaterial({ color: PALETTE.copStripe }));
    stripe.position.y = 0.62;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.16, 0.4), new THREE.MeshBasicMaterial({ color: 0xff3040 }));
    bar.position.set(0, 1.48, -0.25);
    bar.name = 'lightbar';
    group.add(stripe, bar);
  }
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  for (const side of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), lightMat);
    head.position.set(side * 0.6, 0.62, 2.16);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), tailMat);
    tail.position.set(side * 0.6, 0.66, -2.16);
    group.add(head, tail);
  }
  group.userData.wheels = wheels;
  return group;
}

let nextCarId = 1;

export class Car {
  constructor(scene, random, { x, z, heading = 0, paint = null, cop = false, parked = false }) {
    const rng = rngHelpers(random);
    this.id = nextCarId++;
    this.paint = paint ?? rng.pick(PALETTE.carPaint);
    this.mesh = buildCarMesh(this.paint, { cop });
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.x = x;
    this.z = z;
    this.heading = heading;   // radians; 0 faces +Z, like the mesh
    this.speed = 0;
    this.steer = 0;
    this.health = 100;
    this.parked = parked;
    this.driver = null;       // a Person, or 'player', or null when empty
    this.cop = cop;
    this.wrecked = false;
    this.honkCooldown = 0;
    // Traffic route state: the road line and direction the car is following.
    this.route = null;
    this.cruiseSpeed = rng.range(8, 13);
    this.waitAt = 0;
  }

  get pos() { return this.mesh.position; }

  syncMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const spin = this.speed * 0.12;
    for (const wheel of this.mesh.userData.wheels) wheel.rotation.x += spin;
  }

  /**
   * Arcade drive physics: throttle/brake in -1..1, steer in -1..1. Buildings
   * push the car out and scrub speed; a hard enough meeting with a wall is a
   * crash the caller hears about through the returned impact strength.
   */
  drive(dt, throttle, steer, colliders, handbrake = false) {
    if (this.wrecked) { this.speed = 0; this.syncMesh(); return 0; }
    const before = Math.abs(this.speed);
    if (throttle > 0) this.speed += CAR.accel * throttle * dt * (1 - Math.max(0, this.speed) / 34);
    else if (throttle < 0) {
      if (this.speed > 0.5) this.speed -= CAR.brake * dt;
      else this.speed = Math.max(-CAR.reverseMax, this.speed + CAR.accel * throttle * dt);
    }
    this.speed -= this.speed * CAR.drag * dt * 0.35;
    if (handbrake) this.speed -= this.speed * 1.6 * dt;
    this.steer = steer;
    const turnRate = CAR.gripTurn * steer * clamp(this.speed / 9, -1, 1) * (handbrake ? 1.5 : 1);
    this.heading += turnRate * dt;
    const nx = this.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.z + Math.cos(this.heading) * this.speed * dt;
    const resolved = resolveCollisions(colliders, nx, nz, CAR.radius);
    let impact = 0;
    if (Math.abs(resolved.x - nx) > 0.01 || Math.abs(resolved.z - nz) > 0.01) {
      impact = before;
      this.speed *= 0.35;
      this.health -= impact * 1.6;
      if (this.health <= 0) this.wrecked = true;
    }
    this.x = resolved.x;
    this.z = resolved.z;
    this.syncMesh();
    return impact;
  }

  /** Traffic step: follow the route, mind the car ahead, turn at junctions. */
  trafficStep(dt, world) {
    if (this.parked || this.wrecked || this.driver === 'player') return;
    if (!this.route) this.pickRoute(world.random);
    const r = this.route;
    // Target point: far along the current road, offset to the driving lane.
    const lane = 3.6;
    let tx;
    let tz;
    if (r.axis === 'z') { tx = r.line + lane * r.laneSide; tz = this.z + r.dir * 30; }
    else { tz = r.line + lane * r.laneSide; tx = this.x + r.dir * 30; }
    // Slow for whatever is ahead: another car, or Rio himself in the road.
    let target = this.cruiseSpeed;
    for (const other of world.cars) {
      if (other === this) continue;
      const gap = (other.x - this.x) * Math.sin(this.heading) + (other.z - this.z) * Math.cos(this.heading);
      const side = Math.abs((other.x - this.x) * Math.cos(this.heading) - (other.z - this.z) * Math.sin(this.heading));
      if (gap > 0 && gap < 9 && side < 2.2) target = Math.min(target, Math.max(0, (gap - 5) * 1.4));
    }
    const playerGap = world.player
      ? (world.player.x - this.x) * Math.sin(this.heading) + (world.player.z - this.z) * Math.cos(this.heading)
      : -1;
    if (playerGap > 0 && playerGap < 8 && !world.player.car) target = Math.min(target, 2);
    const wantHeading = Math.atan2(tx - this.x, tz - this.z);
    const steer = clamp(angleDelta(this.heading, wantHeading) * 1.6, -1, 1);
    const throttle = this.speed < target ? 0.75 : -0.4;
    this.drive(dt, target <= 0.1 && this.speed < 0.4 ? 0 : throttle, steer, world.colliders);
    // At an intersection, maybe turn: re-aim along the crossing road.
    const nearLine = roadLines().find((l) => Math.abs((r.axis === 'z' ? this.z : this.x) - l) < 2.2);
    if (nearLine !== undefined && world.random() < 0.011) {
      const turnDir = world.random() < 0.5 ? 1 : -1;
      if (r.axis === 'z') this.route = { axis: 'x', line: nearLine, dir: turnDir, laneSide: turnDir > 0 ? -1 : 1 };
      else this.route = { axis: 'z', line: nearLine, dir: turnDir, laneSide: turnDir > 0 ? 1 : -1 };
    }
    // A car that somehow left the road network picks a fresh route home.
    if (!onRoad(this.x, this.z) && Math.abs(this.x) < CITY.extent && Math.abs(this.z) < CITY.extent) {
      this.route = null;
    }
  }

  pickRoute(random) {
    const rng = rngHelpers(random);
    const lines = roadLines();
    const vertical = rng.chance(0.5);
    const line = rng.pick(lines);
    const dir = rng.chance(0.5) ? 1 : -1;
    if (vertical) {
      this.route = { axis: 'z', line, dir, laneSide: dir > 0 ? 1 : -1 };
      this.x = line + 3.6 * this.route.laneSide;
      this.heading = dir > 0 ? 0 : Math.PI;
    } else {
      this.route = { axis: 'x', line, dir, laneSide: dir > 0 ? -1 : 1 };
      this.z = line + 3.6 * this.route.laneSide;
      this.heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    this.syncMesh();
  }
}

/** Scatter the city's parked cars on block edges and start the traffic set. */
export function seedCars(scene, random, count = { parked: 26, traffic: 13 }) {
  const rng = rngHelpers(random);
  const cars = [];
  const lines = roadLines();
  for (let i = 0; i < count.parked; i += 1) {
    const vertical = rng.chance(0.5);
    const line = rng.pick(lines);
    const along = rng.range(-CITY.extent + 16, CITY.extent - 16);
    const side = rng.chance(0.5) ? -1 : 1;
    const off = side * (CITY.roadHalf - 1.9);
    const x = vertical ? line + off : along;
    const z = vertical ? along : line + off;
    if (cars.some((c) => Math.hypot(c.x - x, c.z - z) < 8)) continue;
    const heading = vertical ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2);
    cars.push(new Car(scene, random, { x, z, heading, parked: true }));
  }
  for (let i = 0; i < count.traffic; i += 1) {
    const car = new Car(scene, random, { x: 0, z: 0, parked: false });
    car.pickRoute(random);
    car.z = rng.range(-CITY.extent + 20, CITY.extent - 20);
    car.x = car.route.axis === 'z' ? car.route.line + 3.6 * car.route.laneSide : rng.range(-CITY.extent + 20, CITY.extent - 20);
    if (car.route.axis === 'x') car.z = car.route.line + 3.6 * car.route.laneSide;
    car.driver = 'traffic';
    cars.push(car);
  }
  return cars;
}
