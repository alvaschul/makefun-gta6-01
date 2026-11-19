// NEON HARBOR v2 — vehicles: meshes, driving physics, traffic, parked cars.
// One VehicleEntity type serves player cars, traffic, police and parked
// cars; a mode flag decides who is steering it each frame.

import * as THREE from "three";
import { CFG } from "./config.js";
import { roadCenter, isOnRoad } from "./city.js";

const V = CFG.vehicles;

export function createCarMesh(color, kind = "car") {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a1d24 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd4e8, emissive: 0x1c3038 });

  if (kind === "bike") {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 2.1), paint);
    frame.position.y = 0.62;
    group.add(frame);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.16, 0.9), dark);
    seat.position.set(0, 0.92, -0.25);
    group.add(seat);
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.14, 10);
    for (const z of [0.85, -0.85]) {
      const wheel = new THREE.Mesh(wheelGeo, dark);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(0, 0.36, z);
      group.add(wheel);
    }
    group.userData.wheels = [];
    return group;
  }

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 4.3), paint);
  body.position.y = 0.62;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.55, 2.1), glass);
  cabin.position.set(0, 1.18, -0.25);
  group.add(cabin);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.3, 0.7), paint);
  nose.position.set(0, 0.5, 2.3);
  group.add(nose);

  const wheelGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.28, 10);
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.37, z);
    group.add(wheel);
    wheels.push(wheel);
  }
  group.userData.wheels = wheels;

  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff3b0 });
  for (const x of [-0.62, 0.62]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), lampMat);
    lamp.position.set(x, 0.66, 2.66);
    group.add(lamp);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06),
      new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
    tail.position.set(x, 0.68, -2.16);
    group.add(tail);
  }
  return group;
}

export class VehicleEntity {
  constructor(scene, { kind = "car", color = 0xcccccc, x = 0, z = 0, angle = 0, mode = "parked" }) {
    this.kind = kind;
    this.mesh = createCarMesh(color, kind);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = angle;
    scene.add(this.mesh);
    this.pos = this.mesh.position;
    this.angle = angle;
    this.speed = 0;
    this.mode = mode; // parked | traffic | player | police | wreck
    this.health = 100;
    this.steerVisual = 0;
    this.traffic = null; // lane-following state when mode === traffic/police-ai
    this.occupied = false;
    this.id = Math.random().toString(36).slice(2, 8);
  }

  get topSpeed() {
    if (this.mode === "police") return V.copTopSpeed;
    return this.kind === "bike" ? V.bikeTopSpeed : V.carTopSpeed;
  }

  /** Player driving. input: {throttle -1..1, steer -1..1}. Returns speed ratio. */
  drive(dt, throttle, steer, wetness) {
    const accel = this.kind === "bike" ? V.bikeAccel : V.carAccel;
    const grip = THREE.MathUtils.lerp(V.gripDry, V.gripWet, wetness);
    if (throttle > 0) this.speed += accel * throttle * dt * (1 - Math.max(this.speed, 0) / (this.topSpeed + 12));
    else if (throttle < 0) {
      if (this.speed > 0.6) this.speed -= V.carBrake * dt;
      else this.speed = Math.max(this.speed - accel * 0.55 * dt, -V.carReverse * 2.2);
    } else {
      this.speed -= this.speed * 0.55 * dt; // engine drag
      if (Math.abs(this.speed) < 0.04) this.speed = 0;
    }
    const healthFactor = this.health <= 25 ? 0.45 : this.health <= 55 ? 0.75 : 1;
    const steerAuthority = THREE.MathUtils.clamp(Math.abs(this.speed) / 6, 0, 1)
      * (this.speed < 0 ? -1 : 1);
    this.angle -= steer * V.turnRate * steerAuthority * dt * (grip / V.gripDry + 0.35);
    // lateral slide in the wet: heading and velocity disagree briefly
    this.pos.x += Math.sin(this.angle) * this.speed * dt;
    this.pos.z += Math.cos(this.angle) * this.speed * dt;
    this.syncMesh(dt);
    return Math.abs(this.speed) / this.topSpeed;
  }

  /** Simple kinematic move used by AI drivers after they pick a heading. */
  cruise(dt, targetSpeed, targetAngle, turnSharpness = 2.2) {
    let diff = targetAngle - this.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.angle += THREE.MathUtils.clamp(diff, -turnSharpness * dt, turnSharpness * dt);
    const accel = 9;
    if (this.speed < targetSpeed) this.speed = Math.min(this.speed + accel * dt, targetSpeed);
    else this.speed = Math.max(this.speed - accel * 1.6 * dt, targetSpeed);
    this.pos.x += Math.sin(this.angle) * this.speed * dt;
    this.pos.z += Math.cos(this.angle) * this.speed * dt;
    this.syncMesh(dt);
  }

  syncMesh(dt) {
    this.mesh.rotation.y = this.angle;
    const spin = this.speed * dt * 2.6;
    for (const wheel of this.mesh.userData.wheels || []) wheel.rotation.x += spin;
    // a wrecked car smokes via a slight body tilt; cheap but readable
    this.mesh.rotation.z = this.health <= 25 ? 0.03 : 0;
  }

  damage(amount) {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0 && this.mode !== "wreck") {
      this.mode = "wreck";
      this.speed = 0;
    }
  }

  distanceTo(x, z) {
    return Math.hypot(this.pos.x - x, this.pos.z - z);
  }
}

/** Pick a lane-following route state: drive along one road, turn at junctions. */
function newTrafficBrain(rng) {
  const axis = rng.chance(0.5) ? "x" : "z"; // travelling along x or along z
  const roadIndex = rng.int(0, CFG.world.blocksPerSide);
  const dir = rng.sign();
  const laneOffset = dir > 0 ? 3.4 : -3.4;
  return { axis, roadIndex, dir, laneOffset };
}

export class VehicleManager {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.traffic = [];
    this.parked = [];
    const W = CFG.world;

    for (let i = 0; i < V.trafficCount; i++) {
      const brain = newTrafficBrain(rng);
      const along = rng.range(-W.half + 20, W.half - 20);
      const centre = roadCenter(brain.roadIndex);
      const x = brain.axis === "x" ? along : centre + brain.laneOffset;
      const z = brain.axis === "x" ? centre + brain.laneOffset : along;
      const angle = brain.axis === "x" ? (brain.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (brain.dir > 0 ? 0 : Math.PI);
      const car = new VehicleEntity(scene, {
        kind: rng.chance(0.14) ? "bike" : "car",
        color: rng.pick(CFG.palette.carPaints),
        x, z, angle, mode: "traffic",
      });
      car.traffic = brain;
      car.speed = rng.range(6, V.trafficTopSpeed);
      this.traffic.push(car);
    }

    // parked cars hug block edges so the player can always find wheels
    for (let i = 0; i < V.parkedCount; i++) {
      const bx = rng.int(0, W.blocksPerSide - 1);
      const bz = rng.int(0, W.blocksPerSide - 1);
      const cx = (bx === 0 ? -W.half + W.roadWidth + W.blockSize / 2 + bx * W.pitch : 0);
      const blockX = -W.half + W.roadWidth + W.blockSize / 2 + bx * W.pitch;
      const blockZ = -W.half + W.roadWidth + W.blockSize / 2 + bz * W.pitch;
      void cx;
      const side = rng.int(0, 3);
      const off = W.blockSize / 2 + 3.2;
      const jitter = rng.range(-14, 14);
      const spots = [
        { x: blockX + jitter, z: blockZ - off, a: Math.PI / 2 },
        { x: blockX + jitter, z: blockZ + off, a: Math.PI / 2 },
        { x: blockX - off, z: blockZ + jitter, a: 0 },
        { x: blockX + off, z: blockZ + jitter, a: 0 },
      ];
      const spot = spots[side];
      const car = new VehicleEntity(scene, {
        kind: rng.chance(0.2) ? "bike" : "car",
        color: rng.pick(CFG.palette.carPaints),
        x: spot.x, z: spot.z, angle: spot.a, mode: "parked",
      });
      this.parked.push(car);
    }
  }

  all() {
    return [...this.traffic, ...this.parked];
  }

  nearestParked(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.parked) {
      if (car.mode !== "parked") continue;
      const d = car.distanceTo(x, z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  /** Traffic update: follow lanes, turn at junctions, brake for trouble. */
  updateTraffic(dt, playerPos, panicAt) {
    const W = CFG.world;
    for (const car of this.traffic) {
      if (car.mode !== "traffic") continue;
      const brain = car.traffic;
      let targetSpeed = V.trafficTopSpeed;
      // brake for the player standing/driving ahead, and for panic spots
      const aheadX = car.pos.x + Math.sin(car.angle) * 7;
      const aheadZ = car.pos.z + Math.cos(car.angle) * 7;
      if (Math.hypot(aheadX - playerPos.x, aheadZ - playerPos.z) < 5.5) targetSpeed = 0;
      if (panicAt && Math.hypot(car.pos.x - panicAt.x, car.pos.z - panicAt.z) < 16) targetSpeed = 0;
      for (const other of this.traffic) {
        if (other === car) continue;
        if (Math.hypot(aheadX - other.pos.x, aheadZ - other.pos.z) < 4.5) targetSpeed = Math.min(targetSpeed, other.speed);
      }

      // at a junction, sometimes turn onto the crossing road
      const nearJunction = isOnRoad(car.pos.x, car.pos.z)
        && Math.abs(((car.pos.x + W.half) % W.pitch)) < W.roadWidth
        && Math.abs(((car.pos.z + W.half) % W.pitch)) < W.roadWidth;
      if (nearJunction && Math.abs(car.speed) > 2 && this.rng.chance(0.006)) {
        brain.axis = brain.axis === "x" ? "z" : "x";
        brain.dir = this.rng.sign();
        brain.laneOffset = brain.dir > 0 ? 3.4 : -3.4;
        // snap to the crossing road centre line
        for (let k = 0; k <= W.blocksPerSide; k++) {
          const c = roadCenter(k);
          if (brain.axis === "x" && Math.abs(car.pos.z - c) < W.roadWidth) brain.roadIndex = k;
          if (brain.axis === "z" && Math.abs(car.pos.x - c) < W.roadWidth) brain.roadIndex = k;
        }
      }
      // reached the city edge: turn around
      if (Math.abs(car.pos.x) > W.half - 8 || Math.abs(car.pos.z) > W.half - 8) {
        brain.dir *= -1;
        brain.laneOffset *= -1;
      }
      const centre = roadCenter(brain.roadIndex);
      let targetAngle;
      if (brain.axis === "x") {
        targetAngle = brain.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        car.pos.z += (centre + brain.laneOffset - car.pos.z) * Math.min(1, dt * 1.6);
      } else {
        targetAngle = brain.dir > 0 ? 0 : Math.PI;
        car.pos.x += (centre + brain.laneOffset - car.pos.x) * Math.min(1, dt * 1.6);
      }
      car.cruise(dt, targetSpeed, targetAngle, 1.8);
      this.city.clampToWorld(car.pos);
    }
  }
}
