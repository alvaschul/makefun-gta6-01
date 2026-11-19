// NEON HARBOR v2 — seeded random generator.
// A mulberry32 core keeps the whole city reproducible from one seed, which
// is what shot mode relies on: same seed, same city, same staged frame.

export class RNG {
  constructor(seed = 1234) {
    this.state = (seed >>> 0) || 1;
  }

  /** Next float in [0, 1). */
  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Float in [min, max). */
  range(min, max) {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max] inclusive. */
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  /** Random element of an array. */
  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }

  /** True with probability p. */
  chance(p) {
    return this.next() < p;
  }

  /** Random sign, -1 or +1. */
  sign() {
    return this.next() < 0.5 ? -1 : 1;
  }
}

export function createRNG(seed) {
  return new RNG(seed);
}

/** The shared world generator; main.js reseeds it in shot mode. */
export const worldRNG = new RNG(20261119);

export function reseedWorldRNG(seed) {
  worldRNG.state = (seed >>> 0) || 1;
  return worldRNG;
}
