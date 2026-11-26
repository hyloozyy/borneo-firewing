// Seeded random numbers so staged screenshots and worlds are deterministic.
let state = 1;

export function seedRandom(seed) {
  state = (seed >>> 0) || 1;
}

export function rand() {
  // mulberry-style integer hash stepping
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randRange(a, b) {
  return a + (b - a) * rand();
}

export function pick(list) {
  return list[Math.floor(rand() * list.length)];
}
