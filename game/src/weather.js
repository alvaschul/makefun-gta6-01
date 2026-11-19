// NEON HARBOR v2 — weather fronts and wetness.
// Fronts drift through clear, overcast, rain and storm. Rain is a field
// of falling line segments around the camera; storms add lightning that
// flashes the sky and asks the audio engine for thunder. Wetness is the
// number vehicles read for grip.

import * as THREE from "three";

const FRONT_ORDER = ["clear", "overcast", "rain", "storm"];
const FRONT_LABEL = { clear: "Clear", overcast: "Overcast", rain: "Rain", storm: "Storm" };
const FRONT_FOG = { clear: [180, 900], overcast: [120, 620], rain: [70, 420], storm: [45, 300] };

export class WeatherSystem {
  constructor(scene, rng, hooks = {}) {
    this.scene = scene;
    this.rng = rng;
    this.hooks = hooks; // { onThunder() }
    this.front = "clear";
    this.frontTimer = rng.range(50, 90);
    this.wetness = 0;
    this.lightningAt = 0;
    this.flash = 0;

    const dropCount = 700;
    const positions = new Float32Array(dropCount * 2 * 3);
    this.dropPositions = positions;
    this.dropCount = dropCount;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.rainMat = new THREE.LineBasicMaterial({ color: 0x9fc8e8, transparent: true, opacity: 0 });
    this.rain = new THREE.LineSegments(geo, this.rainMat);
    this.rain.frustumCulled = false;
    scene.add(this.rain);
    this.drops = [];
    for (let i = 0; i < dropCount; i++) {
      this.drops.push({ x: 0, y: 0, z: 0, speed: rng.range(28, 44) });
    }
  }

  get label() { return FRONT_LABEL[this.front]; }
  get raining() { return this.front === "rain" || this.front === "storm"; }

  /** Force a front (used by shot mode for a dry, readable frame). */
  setFront(name) {
    if (FRONT_ORDER.includes(name)) {
      this.front = name;
      this.frontTimer = 9999;
    }
  }

  update(dt, cameraPos, daylight) {
    this.frontTimer -= dt;
    if (this.frontTimer <= 0) {
      const idx = FRONT_ORDER.indexOf(this.front);
      const step = this.rng.chance(0.6) ? 1 : -1;
      const next = FRONT_ORDER[Math.max(0, Math.min(FRONT_ORDER.length - 1, idx + step))];
      this.front = next;
      this.frontTimer = this.rng.range(45, 100);
    }

    // wetness chases the front: rain soaks, clear skies dry
    const target = this.front === "storm" ? 1 : this.front === "rain" ? 0.75 : this.front === "overcast" ? 0.25 : 0;
    const rate = target > this.wetness ? 0.03 : 0.012;
    this.wetness += THREE.MathUtils.clamp(target - this.wetness, -rate * dt * 10, rate * dt * 10);

    // fog follows the front
    if (this.scene.fog) {
      const [near, far] = FRONT_FOG[this.front];
      this.scene.fog.near += (near - this.scene.fog.near) * Math.min(1, dt);
      this.scene.fog.far += (far - this.scene.fog.far) * Math.min(1, dt);
    }

    // rain lines around the camera
    const intensity = this.front === "storm" ? 1 : this.front === "rain" ? 0.65 : 0;
    this.rainMat.opacity = intensity * 0.55;
    if (intensity > 0) {
      const pos = this.dropPositions;
      for (let i = 0; i < this.dropCount; i++) {
        const drop = this.drops[i];
        if (drop.y <= 0) {
          drop.x = cameraPos.x + this.rng.range(-45, 45);
          drop.z = cameraPos.z + this.rng.range(-45, 45);
          drop.y = this.rng.range(18, 30);
        }
        drop.y -= drop.speed * dt;
        const o = i * 6;
        pos[o] = drop.x; pos[o + 1] = drop.y; pos[o + 2] = drop.z;
        pos[o + 3] = drop.x + 0.4; pos[o + 4] = drop.y - 1.4; pos[o + 5] = drop.z;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }

    // lightning: a brief sky flash plus delayed thunder
    this.flash = Math.max(0, this.flash - dt * 5);
    if (this.front === "storm") {
      this.lightningAt -= dt;
      if (this.lightningAt <= 0) {
        this.lightningAt = this.rng.range(4, 11);
        this.flash = 1;
        const delay = this.rng.range(250, 1100);
        setTimeout(() => this.hooks.onThunder?.(), delay);
      }
    }
    return { flash: this.flash, daylightDim: this.raining ? 0.82 : 1 };
  }
}
