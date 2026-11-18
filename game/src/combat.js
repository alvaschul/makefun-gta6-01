// Combat: Rio's pistol, the officers' return fire, and what a bullet does to
// a person, a car or a pane of Azura Bay glass. Shooting is hitscan from the
// camera through the crosshair — where you point is where it lands — with a
// tracer flash and a muzzle pop so a shot reads instantly. Every act of
// violence is also a police matter: combat reports crimes to the wanted
// system with whether anyone was in a position to witness them.
// The numbers live here too: one pistol round costs a person 34 health and
// a car 16, while officer return fire is a dice roll that worsens with
// distance and improves for Rio the faster he is moving when it lands.

import * as THREE from 'three';
import { WANTED } from './config.js';

export class Combat {
  constructor(game) {
    this.game = game;
    this.cooldown = 0;
    this.ammo = Infinity;      // the pistol is Rio's licence to keep playing
    this.tracers = [];
    this.muzzle = null;
  }

  /** A witness is any pedestrian or officer within earshot of the act. */
  witnessed(x, z, radius = 42) {
    const game = this.game;
    for (const person of game.people) {
      if (person.dead || person.hero) continue;
      if (Math.hypot(person.x - x, person.z - z) < radius) return true;
    }
    return game.wanted.stars > 0;
  }

  playerShoot(dt) {
    const game = this.game;
    this.cooldown -= dt;
    if (!game.input.firing() || game.player.car || game.player.dead) return;
    if (this.cooldown > 0) return;
    this.cooldown = 0.24;
    game.audio.shot();
    game.save.stats.shotsFired += 1;
    game.wanted.commitCrime('shooting', this.witnessed(game.player.x, game.player.z));
    // The shot goes where the camera looks, levelled at chest height.
    const origin = new THREE.Vector3(game.player.x, 1.45, game.player.z);
    const dir = new THREE.Vector3();
    game.camera.getWorldDirection(dir);
    dir.y = 0;
    if (dir.lengthSq() < 0.001) dir.set(Math.sin(game.player.heading), 0, Math.cos(game.player.heading));
    dir.normalize();
    this.flashTracer(origin, dir);
    // Nearest living target within a narrow cone and 70 metres takes the hit.
    let best = null;
    let bestDist = 70;
    const consider = (obj, radius, kind) => {
      const dx = obj.x - origin.x;
      const dz = obj.z - origin.z;
      const along = dx * dir.x + dz * dir.z;
      if (along < 1 || along > bestDist) return;
      const side = Math.abs(dx * dir.z - dz * dir.x);
      if (side > radius) return;
      best = { obj, kind, along };
      bestDist = along;
    };
    for (const person of game.people) {
      if (person.dead || person.hero) continue;
      consider(person, 0.85, 'person');
    }
    for (const car of game.cars) {
      if (car.wrecked) continue;
      consider(car, 1.9, 'car');
    }
    if (!best) return;
    game.audio.hit();
    if (best.kind === 'person') {
      const wasCop = best.obj.cop;
      best.obj.hurt(34, game);
      if (best.obj.dead) {
        game.wanted.commitCrime(wasCop ? 'copKill' : 'assault', true);
        if (wasCop) game.hud.toast('Officer down — the whole precinct is coming');
      } else {
        game.wanted.commitCrime('assault', true);
      }
      game.spawnHitPuff(best.obj.x, 1.2, best.obj.z, wasCop ? 0x22364a : 0xd64545);
    } else {
      best.obj.health -= 16;
      game.spawnHitPuff(best.obj.x, 0.8, best.obj.z, 0xffb454);
      if (best.obj.health <= 0 && !best.obj.wrecked) {
        best.obj.wrecked = true;
        game.wanted.commitCrime('propertyDamage', this.witnessed(best.obj.x, best.obj.z));
        game.hud.toast('Vehicle wrecked');
      }
    }
  }

  copShoot(dt, cop, player) {
    cop.shootCooldown -= dt;
    if (cop.shootCooldown > 0) return;
    cop.shootCooldown = 0.9 + Math.random() * 0.7;
    const game = this.game;
    game.audio.shot();
    const origin = new THREE.Vector3(cop.x, 1.45, cop.z);
    const dir = new THREE.Vector3(player.x - cop.x, 0, player.z - cop.z).normalize();
    this.flashTracer(origin, dir, 0xff9040);
    const dist = Math.hypot(player.x - cop.x, player.z - cop.z);
    // Accuracy falls with distance and with Rio's movement: keep moving.
    const moving = Math.abs(player.speed || 0) > 3 || (player.car && Math.abs(player.car.speed) > 6);
    const hitChance = Math.max(0.08, 0.52 - dist * 0.008 - (moving ? 0.18 : 0));
    if (Math.random() < hitChance) game.damagePlayer(player.car ? 3 : 7, 'shot');
  }

  flashTracer(origin, dir, color = 0xffe14d) {
    const game = this.game;
    const end = origin.clone().add(dir.clone().multiplyScalar(46));
    end.y = 1.35;
    const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    game.scene.add(line);
    this.tracers.push({ line, life: 0.07 });
    // Muzzle flash: a brief point of light at the barrel.
    if (!this.muzzle) {
      this.muzzle = new THREE.PointLight(0xffc46b, 0, 12);
      game.scene.add(this.muzzle);
    }
    this.muzzle.position.copy(origin).add(dir.clone().multiplyScalar(0.7));
    this.muzzle.intensity = 14;
  }

  update(dt) {
    for (const tracer of this.tracers) {
      tracer.life -= dt;
      tracer.line.material.opacity = Math.max(0, tracer.life / 0.07) * 0.9;
    }
    this.tracers = this.tracers.filter((t) => {
      if (t.life > 0) return true;
      this.game.scene.remove(t.line);
      t.line.geometry.dispose();
      t.line.material.dispose();
      return false;
    });
    if (this.muzzle) this.muzzle.intensity = Math.max(0, this.muzzle.intensity - dt * 160);
  }
}

export const CRIME_FOR = { ...WANTED };
