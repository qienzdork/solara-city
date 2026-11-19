// People on foot: Leo, the player, and Solara City's pedestrians.
// Pedestrians stroll the sidewalks and run from danger; Leo walks, sprints,
// punches, and gets in and out of cars.

import { PLAYER, CITY } from './config.js';
import { clampToBounds, collideCircle, nearestStreetCoord } from './city.js';
import { forwardOf } from './vehicles.js';

const THREE = window.THREE;

const SKINS = [0xc9a06a, 0x8a5a3a, 0xe8b98a, 0x6a4a2a, 0xd9a066];
const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0xecf0f1, 0x1abc9c];

function makePersonMesh(skin, shirt, pants) {
  const group = new THREE.Group();
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.8, 0.24), pantsMat);
  legs.position.y = 0.4;
  group.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.62, 0.3), shirtMat);
  torso.position.y = 1.1;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skinMat);
  head.position.y = 1.62;
  head.castShadow = true;
  group.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  hair.position.y = 1.66;
  group.add(hair);
  const armGeo = new THREE.BoxGeometry(0.13, 0.55, 0.13);
  const armL = new THREE.Mesh(armGeo, shirtMat);
  armL.position.set(-0.35, 1.1, 0);
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, shirtMat);
  armR.position.set(0.35, 1.1, 0);
  group.add(armR);
  return { group, armL, armR, torso, legs };
}

export function createPlayer(scene, x, z) {
  const { group, armL, armR } = makePersonMesh(0xc9a06a, 0xffd166, 0x2c3e50);
  // Leo wears a yellow crew jacket: add a bright vest box over the torso
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.5, 0.34), new THREE.MeshLambertMaterial({ color: 0xffd166 }));
  vest.position.y = 1.12;
  group.add(vest);
  group.position.set(x, 0, z);
  scene.add(group);
  return {
    group, armL, armR,
    pos: group.position,
    heading: 0,
    speed: 0,
    health: PLAYER.health,
    inCar: false,
    car: null,
    walkPhase: 0,
    punchTimer: 0,
    shootTimer: 0,
    invulnTimer: 0,
    down: false,
  };
}

export function createPedestrian(scene, rng, city) {
  const streets = city.streets;
  const axis = rng.chance(0.5) ? 'x' : 'z';
  const coord = streets[Math.floor(rng.next() * streets.length)];
  const along = rng.float(-170, 170);
  const side = rng.chance(0.5) ? 9.5 : -9.5;
  const x = axis === 'z' ? coord + side : along;
  const z = axis === 'z' ? along : coord + side;
  const { group, armL, armR } = makePersonMesh(
    SKINS[Math.floor(rng.next() * SKINS.length)],
    SHIRTS[Math.floor(rng.next() * SHIRTS.length)],
    0x2c3e50,
  );
  group.position.set(x, 0, z);
  scene.add(group);
  return {
    group, armL, armR,
    pos: group.position,
    heading: rng.angle(),
    speed: rng.float(1.1, 1.9),
    axis,
    streetCoord: coord,
    dir: rng.chance(0.5) ? 1 : -1,
    walkPhase: rng.float(0, 6),
    fleeing: false,
    fleeTimer: 0,
    down: false,
    downTimer: 0,
  };
}

// Walk / sprint the player on foot, relative to the camera yaw.
export function updatePlayerOnFoot(player, dt, input, G) {
  const move = input.moveAxis();
  const camYaw = G.cameraYaw;
  if (player.punchTimer > 0) player.punchTimer -= dt;
  if (player.shootTimer > 0) player.shootTimer -= dt;
  if (player.invulnTimer > 0) player.invulnTimer -= dt;
  const moving = move.x !== 0 || move.y !== 0;
  const targetSpeed = moving ? (input.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed) : 0;
  player.speed += (targetSpeed - player.speed) * Math.min(1, dt * 10);
  if (moving) {
    // forward is the camera's facing on the ground plane
    const fx = Math.sin(camYaw);
    const fz = Math.cos(camYaw);
    const rx = fz;
    const rz = -fx;
    let dx = fx * move.y + rx * move.x;
    let dz = fz * move.y + rz * move.x;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    player.pos.x += dx * player.speed * dt;
    player.pos.z += dz * player.speed * dt;
    player.heading = Math.atan2(dx, dz);
    player.walkPhase += dt * player.speed * 1.6;
    if (Math.random() < dt * player.speed * 0.12) {
      G.effects.dust(player.pos.x, 0.15, player.pos.z);
    }
  }
  collideCircle(player.pos, PLAYER.radius, G.city.colliders);
  clampToBounds(player.pos);
  player.group.position.copy(player.pos);
  player.group.rotation.y = player.heading;
  // walk swing
  const swing = moving ? Math.sin(player.walkPhase) * 0.5 : 0;
  player.armL.rotation.x = swing;
  player.armR.rotation.x = -swing;
  player.group.position.y = moving ? Math.abs(Math.sin(player.walkPhase)) * 0.06 : 0;
}

// Pedestrians stroll sidewalks; they flee from a speeding car or a gunshot.
export function updatePedestrians(peds, dt, G) {
  const streets = G.city.streets;
  for (const ped of peds) {
    if (ped.down) {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.down = false;
        ped.group.visible = true;
        ped.group.rotation.x = 0;
        ped.fleeing = true;
        ped.fleeTimer = 3;
      }
      continue;
    }
    if (ped.fleeTimer > 0) ped.fleeTimer -= dt;
    if (ped.fleeTimer <= 0) ped.fleeing = false;
    // danger check: fast car or player nearby
    if (!ped.fleeing) {
      for (const car of G.cars) {
        if (car.destroyed || Math.abs(car.speed) < 5) continue;
        const d = Math.hypot(car.pos.x - ped.pos.x, car.pos.z - ped.pos.z);
        if (d < 9) {
          ped.fleeing = true;
          ped.fleeTimer = 2.5;
          break;
        }
      }
    }
    const speed = ped.fleeing ? 5.2 : ped.speed;
    const f = forwardOf(ped.heading);
    ped.pos.x += f.x * speed * dt;
    ped.pos.z += f.z * speed * dt;
    ped.walkPhase += dt * speed * 2.2;
    // at an intersection, maybe turn; at the map edge, turn around
    const along = ped.axis === 'z' ? ped.pos.z : ped.pos.x;
    const cross = nearestStreetCoord(along, streets);
    if (Math.abs(along - cross) < 1 && Math.random() < dt * 0.4) {
      ped.axis = ped.axis === 'z' ? 'x' : 'z';
      ped.streetCoord = cross;
      ped.dir = Math.random() < 0.5 ? 1 : -1;
      ped.heading = ped.axis === 'z' ? (ped.dir > 0 ? 0 : Math.PI) : (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    }
    if (Math.abs(ped.pos.x) > 180 || Math.abs(ped.pos.z) > 180) {
      ped.heading += Math.PI;
      ped.dir *= -1;
    }
    // stay on the sidewalk line
    const side = ped.axis === 'z'
      ? { x: ped.streetCoord + (ped.pos.x > ped.streetCoord ? 9.5 : -9.5), z: ped.pos.z }
      : { x: ped.pos.x, z: ped.streetCoord + (ped.pos.z > ped.streetCoord ? 9.5 : -9.5) };
    ped.pos.x += (side.x - ped.pos.x) * Math.min(1, dt * 2);
    ped.pos.z += (side.z - ped.pos.z) * Math.min(1, dt * 2);
    collideCircle(ped.pos, 0.5, G.city.colliders);
    ped.group.position.copy(ped.pos);
    ped.group.rotation.y = ped.heading;
    const swing = Math.sin(ped.walkPhase) * 0.45;
    ped.armL.rotation.x = swing;
    ped.armR.rotation.x = -swing;
  }
}

// Nearest enterable car within range, if any.
export function nearestCarToPlayer(G, maxDist = 4.2) {
  let best = null;
  let bestD = maxDist;
  for (const car of G.cars) {
    if (car.destroyed || car.kind === 'police') continue;
    if (car === G.player.car) continue;
    const d = Math.hypot(car.pos.x - G.player.pos.x, car.pos.z - G.player.pos.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function knockDownPed(ped) {
  ped.down = true;
  ped.downTimer = 4;
  ped.group.rotation.x = -Math.PI / 2;
  ped.group.position.y = 0.3;
}
