// random.js — small seeded random number generator.
// A mulberry32 core keeps city generation and traffic placement identical
// between runs for a given seed, which makes screenshots reproducible.

let state = 0x9e3779b9;

export function setSeed(n) {
  state = (Number(n) >>> 0) || 0x9e3779b9;
}

// Next float in [0, 1).
export function random() {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Float in [a, b).
export function range(a, b) {
  return a + random() * (b - a);
}

// Integer in [a, b] inclusive.
export function intRange(a, b) {
  return Math.floor(range(a, b + 1));
}

// Random element of an array (undefined for an empty array).
export function pick(arr) {
  if (!arr || arr.length === 0) return undefined;
  return arr[Math.floor(random() * arr.length)];
}

// True with probability p.
export function chance(p) {
  return random() < p;
}
