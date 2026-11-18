// The Azura Bay police: a wanted level that answers what Rio actually did,
// and officers who arrive as cars first and boots second. Crime points pool
// toward stars; stars decide how many units respond, how hard they chase and
// whether they shoot. Heat cools only while nobody in uniform can see Rio —
// break line of sight, swap cars, or pay Suds & Shine for a respray.
//
// At four stars the precinct stops chasing and starts sealing: roadblocks —
// two interceptors angled across a road ahead of Rio, officers posted beside
// them with guns up — appear on his line of travel and hold until the heat
// drops, he smashes through, or he simply outruns the cordon. A roadblock is
// a wall with a price: through it, around it, or back the way you came.

import { Person } from './people.js';
import { Car } from './vehicles.js';
import { CITY, WANTED } from './config.js';
import { roadLines } from './city.js';
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
    this.roadblock = null; // {cars, cops, x, z} while a cordon is standing
    this.roadblockTimer = 6; // grace before the first block at four stars
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
    this.clearRoadblock();
    for (const car of this.copCars) this.game.removeCar(car);
    for (const cop of this.copFeet) this.game.removePerson(cop);
    this.copCars = [];
    this.copFeet = [];
    if (reason) this.game.hud.toast(reason);
  }

  /** Does any live officer currently have Rio in sight range? */
  anySeeing() {
    const p = this.game.player;
    const units = [...this.copCars, ...this.copFeet];
    if (this.roadblock) units.push(...this.roadblock.cars);
    for (const cop of units) {
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
    return cop;
  }

  /**
   * Seal the road Rio is travelling, ~55 metres ahead of him: two
   * interceptors angled nose-to-tail across the carriageway on the nearest
   * road line to his line of travel, an officer posted beside each. The
   * cars are parked scenery with teeth — they are not driven, they are hit.
   */
  spawnRoadblock() {
    const game = this.game;
    const player = game.player;
    const aheadX = player.x + Math.sin(player.heading) * 55;
    const aheadZ = player.z + Math.cos(player.heading) * 55;
    const lines = roadLines();
    const nearest = (v) => lines.reduce((best, l) => (Math.abs(l - v) < Math.abs(best - v) ? l : best), lines[0]);
    const cars = [];
    const cops = [];
    // Travelling mostly along X seals a horizontal road (and vice versa):
    // the block sits across the lanes on that road's centre line.
    const alongX = Math.abs(Math.sin(player.heading)) >= Math.abs(Math.cos(player.heading));
    const place = (carX, carZ, heading) => {
      const car = new Car(game.scene, game.random, {
        x: clamp(carX, -CITY.extent - 20, CITY.extent + 20),
        z: clamp(carZ, -CITY.extent - 20, CITY.extent + 20),
        heading, paint: 0x1c2733, cop: true, parked: true,
      });
      car.roadblock = true;
      game.cars.push(car);
      cars.push(car);
      const cop = this.spawnCopFoot(car);
      cop.guard = { x: car.x + (alongX ? 0 : 3.4), z: car.z + (alongX ? 3.4 : 0) };
      cop.x = cop.guard.x;
      cop.z = cop.guard.z;
      cops.push(cop);
    };
    if (alongX) {
      const line = nearest(aheadZ);
      place(aheadX - 3.1, line + 0.6, Math.PI / 2 + 0.55);
      place(aheadX + 3.1, line - 0.6, -Math.PI / 2 - 0.55);
      this.roadblock = { cars, cops, x: aheadX, z: line };
    } else {
      const line = nearest(aheadX);
      place(line + 0.6, aheadZ - 3.1, 0.55);
      place(line - 0.6, aheadZ + 3.1, Math.PI - 0.55);
      this.roadblock = { cars, cops, x: line, z: aheadZ };
    }
    game.hud.toast('Roadblock ahead — the precinct is sealing the road');
  }

  /** Stand a cordon down: cars towed, officers stood off, no ceremony. */
  clearRoadblock() {
    if (!this.roadblock) return;
    for (const car of this.roadblock.cars) this.game.removeCar(car);
    for (const cop of this.roadblock.cops) {
      this.game.removePerson(cop);
      this.copFeet = this.copFeet.filter((c) => c !== cop);
    }
    this.roadblock = null;
  }

  /** The cordon's own housekeeping: when it stands, when it folds. */
  updateRoadblock(dt) {
    if (this.stars < 4) {
      // The heat dropped: the cordon packs up and the road breathes again.
      if (this.roadblock) {
        this.clearRoadblock();
        this.game.hud.toast('The roadblock stands down — heat is dropping');
      }
      this.roadblockTimer = 6;
      return;
    }
    if (!this.roadblock) {
      this.roadblockTimer -= dt;
      if (this.roadblockTimer <= 0) {
        this.spawnRoadblock();
        this.roadblockTimer = 16;
      }
      return;
    }
    const block = this.roadblock;
    const player = this.game.player;
    const dist = Math.hypot(player.x - block.x, player.z - block.z);
    const smashedThrough = block.cars.every((c) => c.wrecked);
    if (smashedThrough) {
      // Through the wall: keep the wreckage out of the road and count it.
      this.clearRoadblock();
      this.roadblockTimer = 20;
      this.game.hud.toast('Through the roadblock — they felt that at the precinct');
    } else if (dist > 140) {
      // Rio left the cordon's world entirely; it folds and may re-form.
      this.clearRoadblock();
      this.roadblockTimer = 12;
    }
  }

  update(dt) {
    const game = this.game;
    const player = game.player;
    if (this.stars === 0) {
      this.points = Math.max(0, this.points - WANTED.decayPerSecond * 2 * dt);
      if (this.roadblock) this.clearRoadblock();
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
    this.updateRoadblock(dt);
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
    // Roadblock officers hold their post until Rio is nearly on top of it —
    // a cordon that wanders off is just two parked cars and a story.
    let arresting = false;
    for (const cop of this.copFeet) {
      if (cop.dead) continue;
      const dist = Math.hypot(player.x - cop.x, player.z - cop.z);
      if (cop.guard && dist > 24) {
        const postDist = Math.hypot(cop.guard.x - cop.x, cop.guard.z - cop.z);
        if (postDist > 1.2) cop.moveToward(dt, cop.guard.x, cop.guard.z, 4.6, game.colliders);
        else {
          cop.state = 'aim';
          cop.heading = Math.atan2(player.x - cop.x, player.z - cop.z);
          cop.speed = 0;
          if (this.stars >= 3) game.combat.copShoot(dt, cop, player);
        }
        cop.syncMesh(dt);
        continue;
      }
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
