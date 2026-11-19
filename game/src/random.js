// Seeded random numbers (mulberry32) so the city, traffic and staged
// screenshots are reproducible from one seed.

// Create a generator from an integer seed. Every call is deterministic.
export function createRandom(seed) {
  let a = seed >>> 0;
  function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    // float in [min, max)
    float(min, max) {
      return min + next() * (max - min);
    },
    // integer in [min, max] inclusive
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    // true with probability p
    chance(p) {
      return next() < p;
    },
    // one element of an array
    pick(array) {
      return array[Math.floor(next() * array.length)];
    },
    // a random angle in radians
    angle() {
      return next() * Math.PI * 2;
    },
  };
}
