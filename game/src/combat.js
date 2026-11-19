// Combat: Leo's fists and his pistol. Fists knock a pedestrian down and
// earn a star if a cop sees it; gunfire earns two stars immediately.
// Shooting is a hitscan ray from the camera centre with a muzzle flash
// and a short tracer.

import { PLAYER, WANTED } from './config.js';
import { forwardOf } from './vehicles.js';
import { knockDownPed } from './people.js';

const THREE = window.THREE;

export function createCombat(scene) {
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
  const tracerGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const tracer = new THREE.Line(tracerGeo, tracerMat);
  tracer.visible = false;
  scene.add(tracer);
  return { tracer, tracerTimer: 0 };
}

export function punch(G, dt) {
  const player = G.player;
  if (player.punchTimer > 0) return;
  player.punchTimer = PLAYER.punchCooldown;
  G.audio.punch();
  player.armR.rotation.x = -1.6; // swing arm forward
  const f = forwardOf(player.heading);
  const reach = 2.2;
  let hit = false;
  for (const ped of G.peds) {
    if (ped.down) continue;
    const dx = ped.pos.x - player.pos.x;
    const dz = ped.pos.z - player.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < reach && dx * f.x + dz * f.z > 0) {
      knockDownPed(ped);
      G.effects.sparks(ped.pos.x, 1.2, ped.pos.z, 6);
      hit = true;
      break;
    }
  }
  if (hit) {
    G.audio.crash(0.4);
    // a cop nearby sees the assault
    if (G.nearestPoliceDist !== null && G.nearestPoliceDist < 45) {
      G.events.addWanted(1, 'Assault witnessed');
    }
  }
}

export function shoot(G) {
  const player = G.player;
  if (player.shootTimer > 0) return;
  player.shootTimer = PLAYER.shootCooldown;
  player.armR.rotation.x = -1.2;
  G.audio.gunshot();
  const camera = G.camera;
  // muzzle at Leo's right hand
  const f = forwardOf(player.heading);
  const muzzlePos = new THREE.Vector3(
    player.pos.x + f.x * 0.7 + f.z * 0.4,
    1.5,
    player.pos.z + f.z * 0.7 - f.x * 0.4,
  );
  G.effects.muzzle(muzzlePos.x, muzzlePos.y, muzzlePos.z);
  // hitscan along the camera forward
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const ray = new THREE.Raycaster(camera.position, dir, 0, 60);
  const targets = [];
  for (const ped of G.peds) if (!ped.down) targets.push(ped.group);
  for (const car of G.cars) if (!car.destroyed) targets.push(car.group);
  const hits = ray.intersectObjects(targets, true);
  let end = new THREE.Vector3().copy(camera.position).addScaledVector(dir, 40);
  if (hits.length > 0) {
    const hit = hits[0];
    end = hit.point.clone();
    // walk up to the car/ped root
    let obj = hit.object;
    while (obj && obj.parent && !obj.userData.root) obj = obj.parent;
    const ped = G.peds.find((p) => p.group === obj);
    if (ped) {
      knockDownPed(ped);
      G.effects.sparks(end.x, end.y, end.z, 10);
    } else {
      const car = G.cars.find((c) => c.group === obj);
      if (car) {
        car.health -= PLAYER.gunDamage;
        G.effects.sparks(end.x, end.y, end.z, 10);
        if (car.health <= 0) G.events.carDestroyed(car);
      }
    }
  }
  // tracer line from muzzle to impact
  const geo = G.combat.tracer.geometry;
  geo.setFromPoints([muzzlePos, end]);
  G.combat.tracer.visible = true;
  G.combat.tracerTimer = 0.07;
  // gunfire draws the heat
  G.events.addWanted(2, 'Shots fired');
  // pedestrians nearby run
  for (const ped of G.peds) {
    const d = Math.hypot(ped.pos.x - player.pos.x, ped.pos.z - player.pos.z);
    if (d < 25 && !ped.down) {
      ped.fleeing = true;
      ped.fleeTimer = 3;
    }
  }
}

export function updateCombat(G, dt) {
  if (G.combat.tracerTimer > 0) {
    G.combat.tracerTimer -= dt;
    if (G.combat.tracerTimer <= 0) G.combat.tracer.visible = false;
  }
}

// Tag scene-graph roots so shoot() can map a hit mesh back to its owner.
export function tagRoots(G) {
  for (const ped of G.peds) ped.group.userData.root = true;
  for (const car of G.cars) car.group.userData.root = true;
}
