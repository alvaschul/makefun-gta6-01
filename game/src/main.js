// NEON HARBOR — boot, the Game that owns every system, and the one loop.
// The world is Azura Bay: a seeded three.js city (city.js) with traffic —
// cars and motorbikes (vehicles.js), pedestrians and a hero (people.js), a
// wanted system and its police, roadblocks and all (police.js), hitscan
// combat (combat.js), a seven-chapter story (missions.js), weather that
// rolls in off the sea (weather.js), a DOM HUD with a live minimap (hud.js),
// synthesised sound (audio.js) and a localStorage save (save.js). This file
// wires them together, runs the camera, the day, and the moments between
// systems: stealing a car, getting wasted, getting busted, paying for a
// respray. Weather is applied here, over the painted sky: thunder lifts the
// hemisphere light for a frame, cloud eats the sun, and the roads darken
// as they soak — main.js owns the materials, weather owns the mood.
//
// ?seed=N fixes the city. ?shot=<name>&seed=N stages a screenshot scene
// (shots.js) instead of the title screen.

import * as THREE from 'three';
import { CITY, CONTROLS_HELP, DAY_LENGTH_SECONDS, NAMES, PALETTE, PLAYER } from './config.js';
import { createRandom, rngHelpers, clamp, lerp, angleDelta } from './random.js';
import { buildCity } from './city.js';
import { Car, seedCars } from './vehicles.js';
import { Person, seedPedestrians, stepPedestrian } from './people.js';
import { WantedSystem } from './police.js';
import { Combat } from './combat.js';
import { MissionEngine, SIDE_JOB } from './missions.js';
import { Hud, showPanel, fillTitle } from './hud.js';
import { createAudio } from './audio.js';
import { createWeather } from './weather.js';
import { createInput, ACT_INTERACT, ACT_VEHICLE, ACT_PAUSE, ACT_RADIO, ACT_MUTE, ACT_CONFIRM } from './input.js';
import { defaultSave, loadSave, storeSave, clearSave } from './save.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261117;
const shotName = params.get('shot');

class Game {
  constructor() {
    this.random = createRandom(seed);
    this.rng = rngHelpers(this.random);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    document.getElementById('game').appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.sky.day);
    this.scene.fog = new THREE.Fog(PALETTE.sky.day, 120, 420);
    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 900);
    this.cameraYaw = Math.PI;
    this.cameraPitch = 0.32;
    this.timeOfDay = 0.36;
    this.state = 'title';
    this.elapsed = 0;
    this.autosaveTimer = 0;
    this.completeShown = false;
    this.sideJob = null;
    this.carHitCooldown = 0;

    // Lights: a hemisphere wash and one shadow-casting sun that follows Rio.
    this.hemi = new THREE.HemisphereLight(0xcfe8ff, 0x3a4a3a, 0.75);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(PALETTE.sun, 1.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -90;
    this.sun.shadow.camera.right = 90;
    this.sun.shadow.camera.top = 90;
    this.sun.shadow.camera.bottom = -90;
    this.sun.shadow.camera.far = 320;
    this.scene.add(this.sun, this.sun.target);

    const city = buildCity(this.scene, this.random);
    this.city = city;
    this.colliders = city.colliders;

    // Weather over the bay, and the road surface it soaks: every road mesh
    // shares one material, so finding it once lets a storm darken the whole
    // grid as the wetness climbs (and lets it dry back in the sun).
    this.weather = createWeather(this.scene, this.camera, this.random);
    this.roadDry = new THREE.Color(PALETTE.road);
    this.roadWet = new THREE.Color(0x16181d);
    this.roadMaterial = null;
    city.group.traverse((obj) => {
      if (this.roadMaterial || !obj.isMesh) return;
      const mat = obj.material;
      if (mat && mat.color && !mat.map && mat.color.getHex() === PALETTE.road) this.roadMaterial = mat;
    });

    this.existingSave = loadSave();
    this.save = defaultSave();
    this.audio = createAudio();
    this.input = createInput(this.renderer.domElement);
    this.hud = new Hud(this);
    this.combat = new Combat(this);
    this.wanted = new WantedSystem(this);
    this.missions = new MissionEngine(this);

    // The hero, standing at the Palm Court Motel door.
    const motel = this.landmark('safehouse');
    this.player = new Person(this.scene, this.random, {
      x: motel.x, z: motel.z + 4, hero: true, name: NAMES.heroFull,
    });
    this.player.health = PLAYER.maxHealth;
    this.player.armor = 0;
    this.player.car = null;
    this.people = [this.player, ...seedPedestrians(this.scene, this.random, 22)];
    this.cars = seedCars(this.scene, this.random);

    // The objective beacon: a column of gold light over whatever matters now.
    this.beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 2.6, 30, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.beacon.position.y = 15;
    this.scene.add(this.beacon);

    // Hit puffs: a tiny pool of sprites that burst where a bullet lands.
    this.puffs = [];
    this.puffGeo = new THREE.SphereGeometry(0.16, 6, 5);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  landmark(kind) {
    return this.city.landmarks.find((l) => l.kind === kind) || this.city.landmarks[0];
  }

  // ---------- money, save, life and death ----------

  addCash(amount) {
    this.save.cash += amount;
    if (amount > 0) {
      this.save.stats.earned += amount;
      this.audio.cash();
    }
  }

  persistSave() {
    this.save.position = { x: this.player.x, z: this.player.z, heading: this.player.heading };
    storeSave(this.save);
    this.existingSave = this.save;
  }

  damagePlayer(amount, cause) {
    const player = this.player;
    if (this.state !== 'playing' || player.dead) return;
    const absorbed = Math.min(player.armor, amount * 0.6);
    player.armor -= absorbed;
    player.health -= (amount - absorbed);
    this.audio.hit();
    if (player.health <= 0) {
      player.health = 0;
      player.dead = true;
      this.save.stats.timesWasted += 1;
      this.state = 'wasted';
      if (player.car) { player.car.driver = null; player.car = null; }
      showPanel('wasted-panel');
      document.getElementById('wasted-note').textContent =
        cause === 'shot' ? 'The bay is loud, then quiet. Azura General patches Rio up — for a price.'
          : 'Azura General patches Rio up — for a price.';
      this.persistSave();
    }
  }

  respawnAt(kind, fine) {
    const place = this.landmark(kind);
    const player = this.player;
    player.dead = false;
    player.health = PLAYER.maxHealth;
    player.armor = 0;
    player.x = place.x;
    player.z = place.z + 3;
    player.state = 'walk';
    this.save.cash = Math.max(0, this.save.cash - fine);
    this.wanted.clearAll();
    this.missions.active = null;
    this.sideJob = null;
    this.hud.setObjective('');
    showPanel(null);
    this.hud.show();
    this.state = 'playing';
    this.persistSave();
  }

  onBusted() {
    if (this.state !== 'playing') return;
    this.save.stats.timesBusted += 1;
    this.state = 'busted';
    if (this.player.car) { this.player.car.driver = null; this.player.car = null; }
    showPanel('busted-panel');
    this.persistSave();
  }

  onPersonDown(person) {
    // A death in the street panics the street.
    for (const other of this.people) {
      if (other === person || other.dead || other.hero || other.cop) continue;
      if (Math.hypot(other.x - person.x, other.z - person.z) < 16) {
        other.state = 'flee';
        other.fleeFrom = person;
        other.fleeTimer = 3.5;
      }
    }
  }

  // ---------- cars ----------

  nearestCar(x, z, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const car of this.cars) {
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestDist) { best = car; bestDist = d; }
    }
    return best;
  }

  enterCar(car, silent = false) {
    const player = this.player;
    if (!car || player.car || car.wrecked) return;
    const wasTraffic = car.driver === 'traffic';
    if (!silent) {
      this.audio.door();
      if (wasTraffic || car.parked) {
        this.save.stats.carsStolen += 1;
        this.wanted.commitCrime('theft', this.combat.witnessed(car.x, car.z, 34));
      }
      if (wasTraffic) {
        // The owner is thrown out onto the asphalt and has opinions about it.
        const owner = new Person(this.scene, this.random, { x: car.x + 2, z: car.z + 1 });
        owner.state = 'flee';
        owner.fleeFrom = player;
        owner.fleeTimer = 5;
        this.people.push(owner);
        this.hud.toast('Car jacked — the owner is calling it in');
      }
    }
    car.driver = 'player';
    car.parked = false;
    player.car = car;
    player.state = 'seated';
  }

  exitCar() {
    const player = this.player;
    const car = player.car;
    if (!car) return;
    this.audio.door();
    car.driver = null;
    if (Math.abs(car.speed) < 0.5) car.parked = true;
    player.car = null;
    player.state = 'walk';
    player.x = car.x + Math.cos(car.heading) * 2.1;
    player.z = car.z - Math.sin(car.heading) * 2.1;
    player.heading = car.heading;
  }

  removeCar(car) {
    this.scene.remove(car.mesh);
    this.cars = this.cars.filter((c) => c !== car);
    if (this.player.car === car) this.player.car = null;
  }

  removePerson(person) {
    this.scene.remove(person.mesh);
    this.people = this.people.filter((p) => p !== person);
  }

  spawnMissionCar(stage) {
    const mark = this.landmark(stage.at);
    const car = new Car(this.scene, this.random, {
      x: mark.x + 5, z: mark.z - 6, heading: Math.PI / 2, paint: 0xc0c6cc, parked: true,
    });
    car.missionCar = true;
    this.cars.push(car);
    return car;
  }

  spawnShootout(stage) {
    const mark = this.landmark(stage.at);
    const hostiles = [];
    for (let i = 0; i < (stage.count || 4); i += 1) {
      const hostile = new Person(this.scene, this.random, {
        x: mark.x + this.rng.range(-11, 11),
        z: mark.z + this.rng.range(-11, 11),
        name: 'Coral King',
      });
      hostile.health = 55;
      hostile.state = 'hostile';
      hostile.shootCooldown = this.rng.range(0.4, 1.4);
      this.people.push(hostile);
      hostiles.push(hostile);
    }
    return hostiles;
  }

  spawnHitPuff(x, y, z, color) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
    for (let i = 0; i < 5; i += 1) {
      const puff = new THREE.Mesh(this.puffGeo, mat);
      puff.position.set(x + this.rng.range(-0.3, 0.3), y + this.rng.range(-0.2, 0.4), z + this.rng.range(-0.3, 0.3));
      puff.userData.vel = { x: this.rng.range(-1.6, 1.6), y: this.rng.range(0.6, 2.4), z: this.rng.range(-1.6, 1.6) };
      this.scene.add(puff);
      this.puffs.push({ mesh: puff, life: 0.45 });
    }
  }

  // ---------- interaction ----------

  currentPrompt() {
    const player = this.player;
    if (this.hud.dialogueOpen()) return 'E — next';
    if (player.car) {
      const wash = this.landmark('wash');
      if (Math.hypot(player.x - wash.x, player.z - wash.z) < 9 && this.wanted.stars > 0) {
        return `E — respray at ${NAMES.washShop} for $${this.wanted.stars * 110}`;
      }
      return 'F — get out';
    }
    const near = this.nearestCar(player.x, player.z, 4.4);
    if (near && !near.wrecked) return near.bike ? 'F — steal this bike' : 'F — steal this car';
    const start = this.missions.startLandmark();
    if (start && !this.missions.active && this.missions.nextMission()
      && Math.hypot(player.x - start.x, player.z - start.z) < 5.5) {
      return `E — start “${this.missions.nextMission().title}”`;
    }
    for (const mark of this.city.landmarks) {
      if (Math.hypot(player.x - mark.x, player.z - mark.z) > 5) continue;
      if (mark.kind === 'gunstore') return `E — body armour at ${NAMES.gunStore} ($150)`;
      if (mark.kind === 'hospital') return `E — treatment at ${NAMES.hospital} ($60)`;
      if (mark.kind === 'diner') return `E — eat at ${NAMES.diner} ($15, +health)`;
      if (mark.kind === 'safehouse') return this.save.storyDone ? 'E — take a courier run / rest' : 'E — rest and save';
    }
    return '';
  }

  interact() {
    const player = this.player;
    const game = this;
    if (this.hud.dialogueOpen()) { this.hud.nextDialogue(); return; }
    if (player.car) {
      const wash = this.landmark('wash');
      if (Math.hypot(player.x - wash.x, player.z - wash.z) < 9 && this.wanted.stars > 0) {
        const cost = this.wanted.stars * 110;
        if (this.save.cash >= cost) {
          this.save.cash -= cost;
          this.wanted.clearAll(`Fresh paint from ${NAMES.washShop} — the precinct loses the thread.`);
          this.persistSave();
        } else {
          this.hud.toast(`Respray costs $${cost} — you are short`);
        }
      }
      return;
    }
    const start = this.missions.startLandmark();
    if (start && !this.missions.active && this.missions.nextMission()
      && Math.hypot(player.x - start.x, player.z - start.z) < 5.5) {
      this.missions.begin();
      return;
    }
    for (const mark of this.city.landmarks) {
      if (Math.hypot(player.x - mark.x, player.z - mark.z) > 5) continue;
      if (mark.kind === 'gunstore') {
        if (this.save.cash >= 150 && player.armor < 100) {
          this.save.cash -= 150;
          player.armor = PLAYER.maxArmor;
          this.hud.toast('Armour fitted — Bima sends his regards');
          this.audio.cash();
        } else this.hud.toast(player.armor >= 100 ? 'Armour already full' : 'Armour costs $150');
        return;
      }
      if (mark.kind === 'hospital') {
        if (player.health < 100 && this.save.cash >= 60) {
          this.save.cash -= 60;
          player.health = 100;
          this.hud.toast('Patched up at Azura General');
        } else this.hud.toast(player.health >= 100 ? 'You are in rude health' : 'Treatment costs $60');
        return;
      }
      if (mark.kind === 'diner') {
        if (this.save.cash >= 15) {
          this.save.cash -= 15;
          player.health = Math.min(100, player.health + 30);
          this.hud.toast('Nasi campur and strong tea: +30 health');
          this.audio.cash();
        }
        return;
      }
      if (mark.kind === 'safehouse') {
        player.health = Math.min(100, player.health + 20);
        this.persistSave();
        if (this.save.storyDone && !this.sideJob) this.startSideJob();
        else this.hud.toast('Rested at the Palm Court — game saved');
        return;
      }
    }
  }

  startSideJob() {
    const targets = this.city.landmarks.filter((l) => l.kind !== 'safehouse');
    const target = this.rng.pick(targets);
    const dist = Math.hypot(target.x - this.player.x, target.z - this.player.z);
    const seconds = clamp(Math.round(dist * SIDE_JOB.secondsPerMetre), SIDE_JOB.minSeconds, 130);
    const pay = Math.round(dist * SIDE_JOB.payPerMetre);
    this.sideJob = { target, timer: seconds, pay };
    this.hud.setObjective(`${SIDE_JOB.title} — reach ${target.name} for $${pay}`);
    this.hud.toast('Courier run started — follow the gold beacon');
  }

  updateSideJob(dt) {
    const job = this.sideJob;
    if (!job) return;
    job.timer -= dt;
    this.hud.setTimer(job.timer);
    if (job.timer <= 0) {
      this.hud.toast('Courier run failed — too slow');
      this.hud.setTimer(null);
      this.sideJob = null;
      return;
    }
    const dist = Math.hypot(this.player.x - job.target.x, this.player.z - job.target.z);
    if (dist < 8) {
      this.addCash(job.pay);
      this.hud.toast(`Delivered — +$${job.pay}`);
      this.hud.setObjective('Story complete — courier runs at the motel pay cash');
      this.hud.setTimer(null);
      this.sideJob = null;
      this.persistSave();
    }
  }

  // ---------- the simulation ----------

  stepWorld(seconds) {
    const steps = Math.max(1, Math.round(seconds / (1 / 30)));
    for (let i = 0; i < steps; i += 1) this.update(1 / 30, true);
  }

  update(dt, ambientOnly = false) {
    this.elapsed += dt;
    this.timeOfDay = (this.timeOfDay + dt / DAY_LENGTH_SECONDS) % 1;
    this.updateSky();
    // Weather rides over the sky the clock just painted: fronts grey it,
    // thunder flashes through the hemisphere light, cloud thins the sun,
    // and soaked roads darken toward wet asphalt.
    this.weather.update(dt, this.state === 'title' ? { x: 0, z: 0 } : this.player);
    this.hemi.intensity = clamp(this.hemi.intensity + this.weather.flash * 1.5 - this.weather.cloudiness * 0.2, 0.06, 2.4);
    this.sun.intensity *= 1 - this.weather.cloudiness * 0.45;
    if (this.roadMaterial) {
      this.roadMaterial.color.copy(this.roadDry).lerp(this.roadWet, this.weather.wetness * 0.85);
    }
    // Traffic and street life always move; the story only moves in play.
    for (const car of this.cars) {
      if (car.driver === 'traffic') car.trafficStep(dt, this);
      else if (car !== this.player.car) car.syncMesh();
    }
    for (const person of this.people) {
      if (person === this.player || person.cop) continue;
      if (person.state === 'hostile') this.updateHostile(person, dt);
      else stepPedestrian(person, dt, this);
    }
    this.updateCarImpacts(dt);
    if (!ambientOnly && this.state === 'playing') {
      this.updatePlayer(dt);
      this.wanted.update(dt);
      this.combat.playerShoot(dt);
      this.missions.update(dt);
      this.updateSideJob(dt);
      this.autosaveTimer += dt;
      if (this.autosaveTimer > 12) { this.autosaveTimer = 0; this.persistSave(); }
      if (this.save.storyDone && !this.completeShown && !this.missions.active) {
        this.completeShown = true;
        this.state = 'complete';
        showPanel('complete-panel');
      }
    }
    this.combat.update(dt);
    for (const puff of this.puffs) {
      puff.life -= dt;
      puff.mesh.position.x += puff.mesh.userData.vel.x * dt;
      puff.mesh.position.y += puff.mesh.userData.vel.y * dt;
      puff.mesh.position.z += puff.mesh.userData.vel.z * dt;
      puff.mesh.material.opacity = Math.max(0, puff.life / 0.45);
    }
    this.puffs = this.puffs.filter((p) => {
      if (p.life > 0) return true;
      this.scene.remove(p.mesh);
      return false;
    });
    this.updateBeacon();
    this.updateCamera(dt);
    if (this.state === 'playing' || this.state === 'title') {
      this.hud.update(dt, this);
      const sirenNear = this.wanted.copCars.some((c) => !c.wrecked && Math.hypot(c.x - this.player.x, c.z - this.player.z) < 45);
      this.audio.update(dt, {
        driving: !!this.player.car,
        speed: this.player.car ? this.player.car.speed : 0,
        sirenNear: this.state === 'playing' && sirenNear,
        inCar: !!this.player.car,
      });
    }
  }

  updateHostile(hostile, dt) {
    if (hostile.dead) { hostile.syncMesh(dt); return; }
    const player = this.player;
    const dist = Math.hypot(player.x - hostile.x, player.z - hostile.z);
    if (dist > 15) {
      hostile.state = 'hostile';
      hostile.moveToward(dt, player.x, player.z, 4.8, this.colliders);
    } else {
      hostile.state = 'aim';
      hostile.heading = Math.atan2(player.x - hostile.x, player.z - hostile.z);
      hostile.speed = 0;
      this.combat.copShoot(dt, hostile, player);
    }
    hostile.syncMesh(dt);
  }

  updateCarImpacts(dt) {
    this.carHitCooldown -= dt;
    // Cars versus people: a fast car is a weapon, whoever is driving it.
    for (const car of this.cars) {
      if (Math.abs(car.speed) < 4.5) continue;
      for (const person of this.people) {
        if (person.dead || person === this.player || person.car) continue;
        if (person.knockTimer > 0) continue;
        // A bike's killing zone is narrower than a car's — it threads gaps.
        if (Math.hypot(person.x - car.x, person.z - car.z) < (car.bike ? 1.25 : 1.8)) {
          person.knockTimer = 1.2;
          person.hurt(58, this);
          car.speed *= 0.55;
          this.audio.crash(0.6);
          if (car === this.player.car) {
            this.wanted.commitCrime('hitAndRun', true);
            this.hud.toast('Hit and run — that was seen');
          }
        }
      }
    }
    for (const person of this.people) if (person.knockTimer > 0) person.knockTimer -= dt;
    // Cars versus cars: a nudge, a scrape of paint, sometimes worse.
    for (let i = 0; i < this.cars.length; i += 1) {
      for (let j = i + 1; j < this.cars.length; j += 1) {
        const a = this.cars[i];
        const b = this.cars[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.hypot(dx, dz);
        const minDist = (a.bike || b.bike) ? 2.3 : 3.4;
        if (dist < minDist && dist > 0.01) {
          const push = (minDist - dist) / 2;
          const nx = dx / dist;
          const nz = dz / dist;
          if (a !== this.player.car) { a.x -= nx * push; a.z -= nz * push; }
          if (b !== this.player.car) { b.x += nx * push; b.z += nz * push; }
          const closing = Math.abs(a.speed - b.speed);
          a.speed *= 0.8;
          b.speed *= 0.8;
          if (closing > 6 && this.carHitCooldown <= 0 && (a === this.player.car || b === this.player.car)) {
            this.carHitCooldown = 2;
            this.audio.crash(0.8);
            this.damagePlayer(3, 'crash');
          }
          a.syncMesh();
          b.syncMesh();
        }
      }
    }
  }

  updatePlayer(dt) {
    const player = this.player;
    const input = this.input;
    const actions = input.takeActions();
    if (actions & ACT_PAUSE) { this.pause(); return; }
    if (actions & ACT_MUTE) this.hud.toast(this.audio.setMuted(!this.audio.isMuted()) ? 'Sound off' : 'Sound on');
    if (actions & ACT_VEHICLE) {
      if (player.car) this.exitCar();
      else {
        const near = this.nearestCar(player.x, player.z, 4.4);
        if (near) this.enterCar(near);
      }
    }
    if (actions & ACT_INTERACT) this.interact();
    if ((actions & ACT_RADIO) && player.car) {
      this.hud.toast(`♪ ${this.audio.nextStation().name}`);
    }
    const mouse = input.takeMouse();
    this.cameraYaw -= mouse.dx * 0.0032;
    this.cameraPitch = clamp(this.cameraPitch + mouse.dy * 0.0022, 0.08, 1.1);

    if (player.car) {
      const car = player.car;
      const axes = input.moveAxes();
      const steer = -axes.s;
      const impact = car.drive(dt, axes.f, steer, this.colliders, input.sprint());
      if (impact > 9) {
        this.audio.crash(clamp(impact / 16, 0.3, 1));
        this.damagePlayer(clamp(impact * 0.22, 0, 9), 'crash');
      }
      player.x = car.x;
      player.z = car.z;
      player.heading = car.heading;
      player.speed = car.speed;
      // The camera swings in behind a moving car, genre-style.
      if (Math.abs(car.speed) > 3) {
        this.cameraYaw += angleDelta(this.cameraYaw, car.heading) * Math.min(1, dt * 2.2);
      }
      player.syncMesh(dt);
    } else {
      const axes = input.moveAxes();
      const lookX = Math.sin(this.cameraYaw);
      const lookZ = Math.cos(this.cameraYaw);
      const dirX = lookX * axes.f + (-lookZ) * axes.s;
      const dirZ = lookZ * axes.f + (lookX) * axes.s;
      const moving = Math.hypot(dirX, dirZ) > 0.05;
      if (moving) {
        const speed = input.sprint() ? 8.6 : PLAYER.walkSpeed;
        player.state = input.firing() ? 'aim' : 'walk';
        player.moveToward(dt, player.x + dirX * 8, player.z + dirZ * 8, speed, this.colliders);
      } else {
        player.speed = 0;
        player.state = input.firing() ? 'aim' : 'walk';
      }
      if (input.firing()) player.heading = this.cameraYaw;
      player.syncMesh(dt);
    }
    // The context prompt, refreshed for the HUD.
    const prompt = document.getElementById('prompt');
    const text = this.currentPrompt();
    prompt.textContent = text;
    prompt.classList.toggle('hidden', !text);
  }

  updateBeacon() {
    let target = null;
    if (this.state === 'playing') {
      if (this.missions.active) target = this.missions.stageTarget();
      else if (this.sideJob) target = this.sideJob.target;
      else if (this.missions.nextMission()) target = this.missions.startLandmark();
    }
    this.beacon.visible = !!target;
    if (target) {
      this.beacon.position.x = target.x;
      this.beacon.position.z = target.z;
      this.beacon.material.opacity = 0.26 + Math.sin(this.elapsed * 3) * 0.1;
    }
  }

  updateSky() {
    const t = this.timeOfDay;
    const angle = (t - 0.25) * Math.PI * 2;
    const sunY = Math.sin(angle);
    const sunX = Math.cos(angle);
    const focus = this.state === 'title' ? { x: 0, z: 0 } : this.player;
    this.sun.position.set(focus.x + sunX * 120, Math.max(12, sunY * 130), focus.z + 40);
    this.sun.target.position.set(focus.x, 0, focus.z);
    this.sun.intensity = clamp(sunY * 2.1, 0.06, 1.7);
    this.hemi.intensity = clamp(0.32 + sunY * 0.5, 0.3, 0.85);
    // Sky colour walks night → dawn → day → dusk → night.
    const stops = [
      [0.0, PALETTE.sky.night], [0.21, PALETTE.sky.night], [0.29, PALETTE.sky.dawn],
      [0.42, PALETTE.sky.day], [0.66, PALETTE.sky.day], [0.76, PALETTE.sky.dusk],
      [0.86, PALETTE.sky.night], [1.0, PALETTE.sky.night],
    ];
    let from = stops[0];
    let to = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i += 1) {
      if (t >= stops[i][0] && t <= stops[i + 1][0]) { from = stops[i]; to = stops[i + 1]; break; }
    }
    const span = Math.max(0.0001, to[0] - from[0]);
    const color = new THREE.Color(from[1]).lerp(new THREE.Color(to[1]), (t - from[0]) / span);
    this.scene.background.copy(color);
    this.scene.fog.color.copy(color);
    const hour = Math.floor(t * 24);
    const minute = Math.floor((t * 24 - hour) * 60);
    const clock = document.getElementById('clock');
    if (clock) clock.textContent = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  updateCamera(dt) {
    if (this.state === 'title') {
      const a = this.elapsed * 0.05;
      this.camera.position.set(Math.sin(a) * 130, 44, Math.cos(a) * 130);
      this.camera.lookAt(0, 12, 0);
      return;
    }
    const player = this.player;
    const inCar = !!player.car;
    const dist = inCar ? 11 : 7.6;
    const height = inCar ? 3.6 : 2.6;
    const lookX = Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch);
    const lookZ = Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch);
    const lookY = Math.sin(this.cameraPitch);
    const tx = player.x - lookX * dist;
    const tz = player.z - lookZ * dist;
    const ty = height + lookY * dist * 0.7;
    const blend = 1 - Math.pow(0.0001, dt); // frame-rate independent ease
    this.camera.position.x = lerp(this.camera.position.x || tx, tx, blend);
    this.camera.position.y = lerp(this.camera.position.y || ty, ty, blend);
    this.camera.position.z = lerp(this.camera.position.z || tz, tz, blend);
    if (this.camera.position.y < 1.1) this.camera.position.y = 1.1;
    this.camera.lookAt(player.x, 1.6, player.z);
    void dt;
  }

  // ---------- screens ----------

  startNewGame() {
    clearSave();
    this.save = defaultSave();
    this.completeShown = false;
    this.beginPlay();
    this.hud.setObjective(`Go to the ${NAMES.safehouse} — ${NAMES.fixer} has work`);
    this.hud.toast(`${NAMES.heroFull}, back in ${NAMES.city}`);
  }

  startContinue() {
    if (this.existingSave) {
      this.save = this.existingSave;
      this.completeShown = this.save.storyDone;
      if (this.save.position) {
        this.player.x = this.save.position.x;
        this.player.z = this.save.position.z;
        this.player.heading = this.save.position.heading || 0;
      }
    }
    this.beginPlay();
    this.hud.setObjective(this.save.storyDone
      ? 'Story complete — courier runs at the motel pay cash'
      : `Return to the ${NAMES.safehouse} for the next job`);
  }

  beginPlay() {
    showPanel(null);
    this.hud.show();
    this.state = 'playing';
    this.audio.unlock();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.persistSave();
    showPanel('pause-panel');
  }

  resume() {
    showPanel(null);
    this.state = 'playing';
  }

  toTitle() {
    showPanel('title-panel');
    fillTitle(this);
    this.hud.hide();
    this.state = 'title';
  }
}

// ---------- wiring ----------

const game = new Game();
window.__game = game;

for (const listId of ['controls-list', 'controls-list-2']) {
  const list = document.getElementById(listId);
  if (list) {
    list.innerHTML = CONTROLS_HELP.map(([key, what]) => `<b>${key}</b><span>${what}</span>`).join('');
  }
}
fillTitle(game);
document.getElementById('new-btn').addEventListener('click', () => game.startNewGame());
document.getElementById('continue-btn').addEventListener('click', () => game.startContinue());
document.getElementById('resume-btn').addEventListener('click', () => game.resume());
document.getElementById('quit-btn').addEventListener('click', () => game.toTitle());
document.getElementById('wasted-btn').addEventListener('click', () => game.respawnAt('hospital', Math.min(200, Math.floor(game.save.cash * 0.1))));
document.getElementById('busted-btn').addEventListener('click', () => game.respawnAt('precinct', Math.min(150, game.save.cash)));
document.getElementById('complete-btn').addEventListener('click', () => { showPanel(null); game.state = 'playing'; });
document.getElementById('status').textContent = 'NEON HARBOR. An open-world crime game in Azura Bay.';

if (shotName) {
  // Screenshot mode: stage the scene, paint a handful of frames so shaders,
  // shadows and the minimap settle, then tell the camera outside.
  showPanel(null);
  game.hud.hide();
  stageShot(game, shotName);
  if (shotName !== 'title') { game.state = 'playing'; game.hud.show(); }
  else { game.hud.hide(); showPanel('title-panel'); }
  let painted = 0;
  const paint = () => {
    game.update(1 / 30, shotName === 'title');
    game.renderer.render(game.scene, game.camera);
    painted += 1;
    if (painted < 14) requestAnimationFrame(paint);
    else window.__shotReady = true;
  };
  requestAnimationFrame(paint);
} else {
  let last = performance.now();
  const frame = (now) => {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (game.state !== 'paused' && game.state !== 'wasted' && game.state !== 'busted' && game.state !== 'complete') {
      game.update(dt, game.state === 'title');
    } else if (game.state === 'complete') {
      game.update(dt, true);
    }
    game.renderer.render(game.scene, game.camera);
  };
  requestAnimationFrame(frame);
  // Esc from pointer lock also pauses, as players expect.
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && game.state === 'playing' && game.elapsed > 2) {
      // Only when the player had actually locked and played a while; the
      // title-to-game click must not instantly pause. elapsed is game time.
    }
  });
}

export { game };
