// NEON HARBOR v2 — wanted level and police response.
// Crimes add points; points map to stars; stars decide how many units
// respond. Cop cars pursue by road, officers chase on foot at 3+ stars,
// roadblocks park across avenues at 4+ stars, and a bust meter fills
// when an officer is close while the player is slow or on foot.

import * as THREE from "three";
import { CFG } from "./config.js";
import { VehicleEntity } from "./vehicles.js";
import { Person } from "./people.js";
import { roadCenter } from "./city.js";

const WP = CFG.wanted;

export class PoliceSystem {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.points = 0;
    this.cars = [];       // VehicleEntity with mode "police"
    this.officers = [];   // Person with officer=true
    this.blockers = [];   // parked VehicleEntity forming a roadblock
    this.bust = 0;        // 0..1
    this.seenTimer = 0;   // seconds since a unit last had eyes on player
    this.blockadeForStars = 0;
  }

  get stars() {
    let s = 0;
    for (let i = 0; i < WP.thresholds.length; i++) {
      if (this.points >= WP.thresholds[i]) s = i;
    }
    return s;
  }

  addPoints(amount) {
    this.points = Math.min(WP.thresholds[WP.thresholds.length - 1] + 160, this.points + amount);
  }

  /** Full heat clear (respray). Removes response units over a second. */
  clearHeat() {
    this.points = 0;
    this.bust = 0;
    for (const car of this.cars) { this.scene.remove(car.mesh); }
    for (const cop of this.officers) { this.scene.remove(cop.group); }
    for (const car of this.blockers) { this.scene.remove(car.mesh); }
    this.cars = [];
    this.officers = [];
    this.blockers = [];
    this.blockadeForStars = 0;
  }

  spawnCopCar(nearPos) {
    const angle = this.rng.range(0, Math.PI * 2);
    const dist = this.rng.range(55, 80);
    const x = THREE.MathUtils.clamp(nearPos.x + Math.sin(angle) * dist, -CFG.world.half + 10, CFG.world.half - 10);
    const z = THREE.MathUtils.clamp(nearPos.z + Math.cos(angle) * dist, -CFG.world.half + 10, CFG.world.half - 10);
    const car = new VehicleEntity(this.scene, {
      kind: "car", color: CFG.palette.copPaint, x, z,
      angle: Math.atan2(nearPos.x - x, nearPos.z - z), mode: "police",
    });
    // navy doors stripe so players can read it as police at a glance
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(1.94, 0.22, 4.34),
      new THREE.MeshLambertMaterial({ color: CFG.palette.copTrim })
    );
    stripe.position.y = 0.82;
    car.mesh.add(stripe);
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.16, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff4040 })
    );
    bar.position.set(0, 1.55, -0.25);
    car.mesh.add(bar);
    car.lightBar = bar;
    this.cars.push(car);
    return car;
  }

  spawnOfficer(nearPos) {
    const officer = new Person(this.scene, {
      x: nearPos.x + this.rng.range(-14, 14),
      z: nearPos.z + this.rng.range(-14, 14),
      officer: true,
    });
    officer.health = 60;
    this.officers.push(officer);
    return officer;
  }

  buildRoadblock(playerPos) {
    // park two cars across the avenue nearest to the player
    let bestK = 0;
    let bestD = Infinity;
    for (let k = 0; k <= CFG.world.blocksPerSide; k++) {
      const d = Math.abs(roadCenter(k) - playerPos.x);
      if (d < bestD) { bestD = d; bestK = k; }
    }
    const avenueX = roadCenter(bestK);
    const z = playerPos.z + (playerPos.z >= 0 ? -46 : 46);
    for (const offset of [-4.5, 4.5]) {
      const car = new VehicleEntity(this.scene, {
        kind: "car", color: CFG.palette.copPaint,
        x: avenueX + offset, z, angle: Math.PI / 2, mode: "parked",
      });
      this.blockers.push(car);
    }
    this.blockadeForStars = this.stars;
  }

  /**
   * Per-frame update. playerState: {x, z, speed, onFoot, hidden}
   * events: { onBusted(), onCrimeSpotted() } — returns nearest cop distance.
   */
  update(dt, playerState, events) {
    const stars = this.stars;
    let nearest = Infinity;

    if (stars === 0) {
      // lingering units give up and leave once heat is gone
      for (const car of this.cars) car.cruise(dt, 10, car.angle, 1.2);
      this.bust = Math.max(0, this.bust - WP.bustDrainPerSecond * dt);
      return nearest;
    }

    // maintain the response size for the current star count
    const wantedCars = WP.copCarsPerStar[stars];
    while (this.cars.filter((c) => c.mode === "police").length < wantedCars) {
      this.spawnCopCar(playerState);
    }
    if (stars >= WP.footOfficersAtStars) {
      while (this.officers.filter((o) => !o.dead).length < stars - 1) {
        this.spawnOfficer(playerState);
      }
    }
    if (stars >= WP.roadblockAtStars && this.blockadeForStars !== stars && this.blockers.length === 0) {
      this.buildRoadblock(playerState);
    }

    let anySeeing = false;
    for (const car of this.cars) {
      if (car.mode !== "police") continue;
      const d = car.distanceTo(playerState.x, playerState.z);
      nearest = Math.min(nearest, d);
      if (d < 70) anySeeing = true;
      if (car.lightBar) {
        car.lightBar.material.color.setHex(Math.floor(performance.now() / 280) % 2 ? 0xff4040 : 0x4080ff);
      }
      if (d > 190) {
        // teleport-recycle far units back into the chase
        const angle = this.rng.range(0, Math.PI * 2);
        car.pos.x = playerState.x + Math.sin(angle) * 70;
        car.pos.z = playerState.z + Math.cos(angle) * 70;
        this.city.clampToWorld(car.pos);
      }
      const targetAngle = Math.atan2(playerState.x - car.pos.x, playerState.z - car.pos.z);
      // aim slightly ahead of a moving player so chases feel driven
      const lead = Math.min(d * 0.02, 0.35);
      const leadAngle = targetAngle + lead * Math.sign(Math.sin(targetAngle - car.angle) || 1);
      const speed = d > 26 ? car.topSpeed : d > 9 ? car.topSpeed * 0.55 : 2;
      car.cruise(dt, speed, leadAngle, 2.4);
      this.city.resolveCollisions(car.pos, 1.6);
    }

    for (const officer of this.officers) {
      if (officer.dead) continue;
      const d = officer.distanceTo(playerState.x, playerState.z);
      nearest = Math.min(nearest, d);
      if (d < 55) anySeeing = true;
      if (d > 150) {
        officer.pos.x = playerState.x + this.rng.range(-20, 20);
        officer.pos.z = playerState.z + this.rng.range(-20, 20);
      }
      officer.moveToward(dt, playerState.x, playerState.z, d > 12 ? 6.4 : 3.4);
      this.city.resolveCollisions(officer.pos, 0.5);
    }

    // sight and decay bookkeeping
    if (anySeeing && !playerState.hidden) this.seenTimer = 0;
    else this.seenTimer += dt;
    if (this.seenTimer > WP.unseenAfterSeconds) {
      this.points = Math.max(0, this.points - WP.decayPerSecond * dt);
    }

    // bust meter: an officer (or stopped cop car) close to a slow player
    const slowOrFoot = playerState.onFoot || Math.abs(playerState.speed) < 3.2;
    let bustPressure = false;
    if (slowOrFoot) {
      for (const officer of this.officers) {
        if (!officer.dead && officer.distanceTo(playerState.x, playerState.z) < WP.bustRange) bustPressure = true;
      }
      for (const car of this.cars) {
        if (car.mode === "police" && car.distanceTo(playerState.x, playerState.z) < WP.bustRange + 1.6
          && Math.abs(car.speed) < 4) bustPressure = true;
      }
    }
    if (bustPressure) {
      this.bust += WP.bustFillPerSecond * dt;
      if (this.bust >= 1) {
        this.bust = 0;
        events.onBusted?.();
      }
    } else {
      this.bust = Math.max(0, this.bust - WP.bustDrainPerSecond * dt);
    }
    return nearest;
  }
}
