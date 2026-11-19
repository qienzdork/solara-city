// One pooled particle system (THREE.Points) for every transient effect:
// exhaust puffs, skid smoke, muzzle sparks, impact sparks, explosions.
// Particles are cheap points with a soft glow texture, recycled in place.

import { makeGlowTexture } from './textures.js';

const THREE = window.THREE;
const MAX = 420;

export function createEffects(scene) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(MAX * 3);
  const colors = new Float32Array(MAX * 3);
  const sizes = new Float32Array(MAX);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const material = new THREE.PointsMaterial({
    size: 1,
    map: makeGlowTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);
  const parts = [];
  for (let i = 0; i < MAX; i++) {
    parts.push({ alive: false, x: 0, y: -100, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, r: 1, g: 1, b: 1, size: 1, grow: 0, fade: 1 });
  }
  let cursor = 0;

  function spawn(x, y, z, vx, vy, vz, life, r, g, b, size, grow = 0) {
    const p = parts[cursor];
    cursor = (cursor + 1) % MAX;
    p.alive = true;
    p.x = x; p.y = y; p.z = z;
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.life = life;
    p.maxLife = life;
    p.r = r; p.g = g; p.b = b;
    p.size = size;
    p.grow = grow;
    p.fade = 1;
  }

  function burst(x, y, z, count, opts) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = opts.speed * (0.4 + Math.random() * 0.8);
      spawn(
        x, y, z,
        Math.cos(a) * sp, opts.up * (0.5 + Math.random()), Math.sin(a) * sp,
        opts.life * (0.6 + Math.random() * 0.7),
        opts.r, opts.g, opts.b,
        opts.size * (0.7 + Math.random() * 0.6),
        opts.grow ?? 0,
      );
    }
  }

  return {
    // grey exhaust / tyre smoke, drifting up and growing
    smoke(x, y, z, strength = 1) {
      burst(x, y, z, Math.max(1, Math.round(2 * strength)), { speed: 0.8, up: 1.2, life: 0.9, r: 0.55, g: 0.55, b: 0.55, size: 1.6, grow: 2.2 });
    },
    // bright orange sparks for impacts and gunfire
    sparks(x, y, z, count = 8) {
      burst(x, y, z, count, { speed: 7, up: 3, life: 0.35, r: 1, g: 0.75, b: 0.25, size: 0.9, grow: -0.5 });
    },
    // muzzle flash: a few hot white-yellow points at the barrel
    muzzle(x, y, z) {
      burst(x, y, z, 5, { speed: 3, up: 0.5, life: 0.09, r: 1, g: 0.9, b: 0.5, size: 1.4, grow: 0 });
    },
    // big explosion: fireball plus smoke
    explosion(x, y, z) {
      burst(x, y + 0.5, z, 26, { speed: 6, up: 5, life: 0.7, r: 1, g: 0.55, b: 0.15, size: 2.2, grow: 1.5 });
      burst(x, y + 1, z, 14, { speed: 2, up: 3.5, life: 1.4, r: 0.25, g: 0.25, b: 0.25, size: 2.6, grow: 3 });
    },
    // small dust puff for running footsteps
    dust(x, y, z) {
      burst(x, y, z, 2, { speed: 0.6, up: 0.6, life: 0.5, r: 0.7, g: 0.65, b: 0.55, size: 1.1, grow: 1.5 });
    },
    update(dt) {
      for (let i = 0; i < MAX; i++) {
        const p = parts[i];
        if (!p.alive) {
          positions[i * 3 + 1] = -100;
          sizes[i] = 0;
          continue;
        }
        p.life -= dt;
        if (p.life <= 0) {
          p.alive = false;
          positions[i * 3 + 1] = -100;
          sizes[i] = 0;
          continue;
        }
        p.vy -= 2.5 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        if (p.y < 0.05) p.y = 0.05;
        const t = p.life / p.maxLife;
        p.fade = t;
        positions[i * 3] = p.x;
        positions[i * 3 + 1] = p.y;
        positions[i * 3 + 2] = p.z;
        colors[i * 3] = p.r * t;
        colors[i * 3 + 1] = p.g * t;
        colors[i * 3 + 2] = p.b * t;
        sizes[i] = p.size * (1 + (1 - t) * p.grow);
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      geometry.attributes.size.needsUpdate = true;
    },
  };
}
