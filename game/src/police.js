// The wanted system: stars rise with crimes and fall when the heat dies
// down. Police cars spawn on the roads, chase Leo along the streets, ram
// his car, and bust him on foot if they corner him.

import { WANTED, CAR, CITY } from './config.js';
import { createCar, forwardOf, integrateCarMotion } from './vehicles.js';
import { collideCircle, nearestStreetCoord } from './city.js';

const THREE = window.THREE;

export function createPoliceSystem(scene) {
  return {
    wanted: 0,
    cars: [],
    unseenTimer: 0,
    decayTimer: 0,
    bustTimer: 0,
    scene,
  };
}

export function addWanted(G, stars, reason) {
  const police = G.police;
  const before = police.wanted;
  police.wanted = Math.max(0, Math.min(WANTED.maxStars, police.wanted + stars));
  if (police.wanted > before) {
    G.hud.banner(`${police.wanted}-STAR WANTED`, reason || 'The Solara PD is on you');
    G.audio.wantedUp();
  }
  police.unseenTimer = 0;
}

function spawnPoliceCar(G) {
  const streets = G.city.streets;
  const player = G.player.inCar ? G.player.car : G.player;
  const axis = Math.random() < 0.5 ? 'x' : 'z';
  const coord = nearestStreetCoord(axis === 'z' ? player.pos.x : player.pos.z, streets);
  // spawn on a street a good distance away, on the far side of the player
  const dir = Math.random() < 0.5 ? 1 : -1;
  const along = (axis === 'z' ? player.pos.z : player.pos.x) + dir * WANTED.spawnDistance;
  const x = axis === 'z' ? coord + 3.5 : along;
  const z = axis === 'z' ? along : coord - 3.5;
  const heading = axis === 'z' ? (dir > 0 ? Math.PI : 0) : (dir > 0 ? -Math.PI / 2 : Math.PI / 2);
  const car = createCar(G.scene, {
    x, z, heading,
    color: 0x1a1a1a,
    kind: 'police',
    name: 'Interceptor',
    maxSpeed: CAR.maxSpeedPolice,
    isPolice: true,
  });
  car.axis = axis;
  car.streetCoord = coord;
  car.dir = dir;
  car.hasDriver = false;
  G.cars.push(car);
  G.police.cars.push(car);
  return car;
}

function removePoliceCar(G, car) {
  car.destroyed = true;
  G.scene.remove(car.group);
  G.cars.splice(G.cars.indexOf(car), 1);
  G.police.cars.splice(G.police.cars.indexOf(car), 1);
}

// Road-following pursuit: pick the axis that closes distance fastest,
// drive that street, turn at intersections toward the player.
function updatePoliceCar(car, dt, G) {
  const target = G.player.inCar ? G.player.car.pos : G.player.pos;
  const dx = target.x - car.pos.x;
  const dz = target.z - car.pos.z;
  const dist = Math.hypot(dx, dz);
  // desired heading: chase along roads when far, straight at the player close
  let desired;
  if (dist < 14) {
    desired = Math.atan2(dx, dz);
  } else if (Math.abs(dx) > Math.abs(dz)) {
    desired = dx > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    desired = dz > 0 ? 0 : Math.PI;
  }
  let diff = desired - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
  const aggression = 0.65 + G.police.wanted * 0.09;
  const targetSpeed = Math.min(car.maxSpeed, dist * 0.55 + 12) * aggression;
  car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.2);
  const hitWall = integrateCarMotion(car, dt, G.city.colliders);
  if (hitWall) car.speed *= 0.7;
  car.group.rotation.y = car.heading;
  // flashing light bar
  car.flashTimer += dt;
  const phase = Math.floor(car.flashTimer * 6) % 2 === 0;
  if (car.lightLeft && car.lightRight) {
    car.lightLeft.material.emissiveIntensity = phase ? 2.4 : 0.25;
    car.lightRight.material.emissiveIntensity = phase ? 0.25 : 2.4;
  }
  // ram the player
  if (dist < CAR.radius + 1.6) {
    const playerCar = G.player.inCar ? G.player.car : null;
    if (playerCar && playerCar !== car) {
      const push = 6;
      playerCar.speed -= push * 0.4;
      playerCar.health -= 6;
      car.speed *= 0.5;
      G.audio.crash(0.7);
      G.effects.sparks(target.x, 0.9, target.z, 8);
      if (playerCar.health <= 0) {
        G.events.carDestroyed(playerCar);
      }
    } else if (!G.player.inCar && G.player.invulnTimer <= 0) {
      G.player.health -= WANTED.ramDamage;
      G.player.invulnTimer = WANTED.ramCooldown;
      G.audio.crash(0.8);
      G.effects.sparks(G.player.pos.x, 1, G.player.pos.z, 8);
      if (G.player.health <= 0) G.events.playerDown();
    }
  }
  return dist;
}

export function updatePolice(G, dt) {
  const police = G.police;
  const wantedCount = WANTED.carsPerStar[police.wanted];
  // spawn up to the wanted count
  if (police.cars.length < wantedCount) {
    spawnPoliceCar(G);
  }
  let nearestDist = null;
  let nearestCar = null;
  for (let i = police.cars.length - 1; i >= 0; i--) {
    const car = police.cars[i];
    const dist = updatePoliceCar(car, dt, G);
    if (nearestDist === null || dist < nearestDist) {
      nearestDist = dist;
      nearestCar = car;
    }
    // too far away: despawn (the heat sends a fresh unit)
    if (dist > WANTED.despawnDistance) {
      removePoliceCar(G, car);
    }
  }
  // wanted decay: no police can see Leo for a while
  if (police.wanted > 0) {
    if (nearestDist === null || nearestDist > 60) {
      police.unseenTimer += dt;
      if (police.unseenTimer > WANTED.decayDelay) {
        police.decayTimer += dt;
        if (police.decayTimer > WANTED.decayInterval) {
          police.decayTimer = 0;
          police.wanted -= 1;
          if (police.wanted === 0) {
            G.hud.banner('HEAT LOST', 'The Solara PD gave up — for now');
          }
        }
      }
    } else {
      police.unseenTimer = 0;
      police.decayTimer = 0;
    }
  }
  // bust: on foot, a police car sits on Leo
  if (!G.player.inCar && police.wanted > 0 && nearestCar) {
    const d = Math.hypot(nearestCar.pos.x - G.player.pos.x, nearestCar.pos.z - G.player.pos.z);
    const playerSpeed = G.player.speed;
    if (d < WANTED.bustDistance && playerSpeed < 2) {
      police.bustTimer += dt;
      if (police.bustTimer > WANTED.bustTime) {
        police.bustTimer = 0;
        G.events.playerCaught();
      }
    } else {
      police.bustTimer = 0;
    }
  } else {
    police.bustTimer = 0;
  }
  G.nearestPoliceDist = nearestDist;
}
