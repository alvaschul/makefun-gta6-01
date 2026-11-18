// A small seeded random number generator (mulberry32) plus the pick/clamp
// helpers the world builders share. The same seed gives the same city, the
// same traffic and the same screenshot scenes, which is what makes the
// staged shots repeatable and the headless checks meaningful.
// The helpers stay small and pure on purpose — range, pick, chance and the
// shared clamp/lerp/angle maths — so any system can use them without
// importing a world it does not need.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Wrap a raw random() with the conveniences the game code actually wants. */
export function rngHelpers(random) {
  return {
    next: random,
    range(min, max) { return min + random() * (max - min); },
    int(min, max) { return Math.floor(min + random() * (max - min + 1)); },
    pick(list) { return list[Math.floor(random() * list.length) % list.length]; },
    chance(p) { return random() < p; },
  };
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) { return a + (b - a) * t; }

/** Shortest signed angular distance from `from` to `to`, in radians. */
export function angleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function distance2d(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.hypot(dx, dz);
}
