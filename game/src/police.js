// The Azura Bay police: a wanted level that answers what Rio actually did,
// and officers who arrive as cars first and boots second. Crime points pool
// toward stars; stars decide how many units respond, how hard they chase and
// whether they shoot. Heat cools only while nobody in uniform can see Rio —
// break line of sight, swap cars, or pay Suds & Shine for a respray.

import { Person } from './people.js';
import { Car } from './vehicles.js';
import { CITY, WANTED } from './config.js';
import { angleDelta, clamp, rngHelpers } from './random.js';

export class WantedSystem {
  constructor(game) {
    this.game = game;
    this.points = 0;
    this.stars = 0;
    this.seenTimer = 0;    // seconds since a cop last had eyes on Rio
    this.copCars = [];
    this.copFeet = [];
    this.spawnTimer = 0;
    this.bustMeter = 0;    // fills while an officer stands over a cornered Rio
  }

  get heat() { return this.points; }

  commitCrime(kind, witnessed = true) {
    const value = WANTED[kind] ?? 10;
    this.game.save.stats.crimes += 1;
    if (!witnessed && this.stars === 0) {
      // An unseen first crime is a rumour, not a manhunt: half heat, no star yet.
      this.points += value * 0.5;
    } else {
      this.points += value;
    }
    const next = this.starCount();
    if (next > this.stars) {
      this.stars = next;
      this.game.audio.wantedUp();
      this.game.hud.toast(`Wanted level ${'★'.repeat(next)} — ${this.stars >= 3 ? 'they are authorised to shoot' : 'the Bay Precinct is rolling'}`);
    } else {
      this.stars = next;
    }
  }

  starCount() {
    return clamp(Math.floor(this.points / 100), 0, 5);
  }

  clearAll(reason) {
    this.points = 0;
    this.stars = 0;
    this.bustMeter = 0;
    for (const car of this.copCars) this.game.removeCar(car);
    for (const cop of this.copFeet) this.game.removePerson(cop);
    this.copCars = [];
    this.copFeet = [];
    if (reason) this.game.hud.toast(reason);
  }

  /** Does any live officer currently have Rio in sight range? */
  anySeeing() {
    const p = this.game.player;
    for (const cop of [...this.copCars, ...this.copFeet]) {
      if (cop.dead || cop.wrecked) continue;
      const d = Math.hypot(cop.x - p.x, cop.z - p.z);
      if (d < 55) return true;
    }
    return false;
  }

  desiredUnits() {
    // Stars buy pressure: cars first, then foot officers near the action.
    return {
      cars: [0, 1, 2, 3, 4, 6][this.stars],
      feet: [0, 0, 1, 2, 3, 4][this.stars],
    };
  }

  spawnCopCar() {
    const game = this.game;
    const rng = rngHelpers(game.random);
    const angle = rng.range(0, Math.PI * 2);
    const dist = 68;
    const x = clamp(game.player.x + Math.sin(angle) * dist, -CITY.extent, CITY.extent);
    const z = clamp(game.player.z + Math.cos(angle) * dist, -CITY.extent, CITY.extent);
    const car = new Car(game.scene, game.random, { x, z, heading: angle + Math.PI, paint: 0x1c2733, cop: true });
    car.driver = 'cop';
    game.cars.push(car);
    this.copCars.push(car);
  }

  spawnCopFoot(nearCar = null) {
    const game = this.game;
    const rng = rngHelpers(game.random);
    const base = nearCar || game.player;
    const cop = new Person(game.scene, game.random, {
      x: base.x + rng.range(-4, 4),
      z: base.z + rng.range(-4, 4),
      cop: true,
      name: 'Officer',
    });
    cop.state = 'chase';
    game.people.push(cop);
    this.copFeet.push(cop);
  }

  update(dt) {
    const game = this.game;
    const player = game.player;
    if (this.stars === 0) {
      this.points = Math.max(0, this.points - WANTED.decayPerSecond * 2 * dt);
      return;
    }
    // Heat only cools in hiding.
    if (this.anySeeing()) this.seenTimer = 0;
    else {
      this.seenTimer += dt;
      this.points = Math.max(0, this.points - WANTED.decayPerSecond * dt);
      const next = this.starCount();
      if (next < this.stars) {
        this.stars = next;
        if (next === 0) this.clearAll('You lost them. The bay breathes again.');
      }
    }
    // Reinforce toward the desired pressure, a few seconds apart.
    this.spawnTimer -= dt;
    const want = this.desiredUnits();
    this.copCars = this.copCars.filter((c) => !c.wrecked || c.health > -40);
    const liveCars = this.copCars.filter((c) => !c.wrecked).length;
    const liveFeet = this.copFeet.filter((c) => !c.dead).length;
    if (this.spawnTimer <= 0) {
      if (liveCars < want.cars) { this.spawnCopCar(); this.spawnTimer = 2.5; }
      else if (liveFeet < want.feet) { this.spawnCopFoot(this.copCars[0]); this.spawnTimer = 3; }
    }
    // Drive the interceptors: aim at where Rio will be, ram to stop him.
    for (const car of this.copCars) {
      if (car.wrecked || car.driver === 'player') continue;
      const lead = player.car ? 0.7 : 0.25;
      const tx = player.x + Math.sin(player.heading) * (player.speed || 0) * lead;
      const tz = player.z + Math.cos(player.heading) * (player.speed || 0) * lead;
      const wantHeading = Math.atan2(tx - car.x, tz - car.z);
      const steer = clamp(angleDelta(car.heading, wantHeading) * 1.8, -1, 1);
      const dist = Math.hypot(tx - car.x, tz - car.z);
      const throttle = dist > 7 ? 1 : 0.25;
      const impact = car.drive(dt, throttle, steer, game.colliders, dist < 6);
      if (impact > 9 && player.car) game.damagePlayer(4, 'ram');
      // Close enough and Rio is on foot: the officer gets out and gives chase.
      if (!player.car && dist < 10 && Math.abs(car.speed) < 2 && this.copFeet.filter((c) => !c.dead).length < want.feet + 1) {
        car.parked = true;
        car.driver = null;
        this.spawnCopFoot(car);
      }
    }
    // Foot officers: run Rio down, shoot at three stars and up, arrest close.
    let arresting = false;
    for (const cop of this.copFeet) {
      if (cop.dead) continue;
      const dist = Math.hypot(player.x - cop.x, player.z - cop.z);
      if (player.car) {
        cop.moveToward(dt, player.x, player.z, 5.6, game.colliders);
      } else if (dist > 9) {
        cop.state = 'chase';
        cop.moveToward(dt, player.x, player.z, 5.9, game.colliders);
      } else {
        cop.state = 'aim';
        cop.heading = Math.atan2(player.x - cop.x, player.z - cop.z);
        cop.speed = 0;
        if (this.stars >= 3) game.combat.copShoot(dt, cop, player);
        if (dist < 2.2 && Math.abs(player.speed || 0) < 1.5) arresting = true;
      }
      cop.syncMesh(dt);
    }
    // The bust meter: stand still next to an officer and the cuffs come out.
    if (arresting && !player.car) {
      this.bustMeter += dt / 2.4;
      if (this.bustMeter >= 1) game.onBusted();
    } else {
      this.bustMeter = Math.max(0, this.bustMeter - dt * 0.7);
    }
  }
}
