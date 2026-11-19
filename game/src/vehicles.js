// Cars: a box-built car factory, arcade driving for the player, and
// road-following AI for traffic. Every car is one THREE.Group facing +Z
// at heading 0; forward is (sin(heading), 0, cos(heading)).

import { CAR, CITY } from './config.js';
import { collideCircle, nearestStreetCoord } from './city.js';

const THREE = window.THREE;

const CAR_NAMES = ['Vento', 'Comet GT', 'Brisa', 'Toro', 'Cielo', 'Falcón', 'Duna', 'Lobo'];
const CAR_COLORS = [0xc0392b, 0x2e86c1, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22, 0xecf0f1, 0x1a1a1a, 0x7f8c8d];

function makeCarMesh(color, isPolice) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1a2733 });
  const tyre = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const bodyGeo = new THREE.BoxGeometry(1.9, 0.62, 4.2);
  const body = new THREE.Mesh(bodyGeo, paint);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabinGeo = new THREE.BoxGeometry(1.6, 0.55, 2.1);
  const cabin = new THREE.Mesh(cabinGeo, glass);
  cabin.position.set(0, 1.1, -0.25);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const frontWheels = [];
  for (const [wx, wz] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
    const pivot = new THREE.Group();
    pivot.position.set(wx, 0.36, wz);
    const wheel = new THREE.Mesh(wheelGeo, tyre);
    wheel.rotation.z = Math.PI / 2;
    pivot.add(wheel);
    group.add(pivot);
    if (wz > 0) frontWheels.push(pivot);
  }
  const headMat = new THREE.MeshLambertMaterial({ color: 0xfff6c9, emissive: 0xfff2b0, emissiveIntensity: 0.9 });
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xaa1111, emissive: 0x881111, emissiveIntensity: 0.8 });
  for (const hx of [-0.6, 0.6]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), headMat);
    hl.position.set(hx, 0.62, 2.12);
    group.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), tailMat);
    tl.position.set(hx, 0.62, -2.12);
    group.add(tl);
  }
  let lightBar = null;
  let lightLeft = null;
  let lightRight = null;
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    bar.position.set(0, 1.46, -0.25);
    group.add(bar);
    lightLeft = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.18, 0.42),
      new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 2 }),
    );
    lightLeft.position.set(-0.28, 1.46, -0.25);
    group.add(lightLeft);
    lightRight = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.18, 0.42),
      new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x0033ff, emissiveIntensity: 2 }),
    );
    lightRight.position.set(0.28, 1.46, -0.25);
    group.add(lightRight);
    lightBar = bar;
  }
  return { group, frontWheels, lightBar, lightLeft, lightRight };
}

export function createCar(scene, opts) {
  const {
    x = 0, z = 0, heading = 0, color = 0xc0392b, kind = 'traffic',
    name = 'Vento', maxSpeed = CAR.maxSpeedTraffic, isPolice = false,
  } = opts;
  const { group, frontWheels, lightBar, lightLeft, lightRight } = makeCarMesh(color, isPolice);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  scene.add(group);
  return {
    group,
    frontWheels,
    lightBar,
    lightLeft,
    lightRight,
    kind,
    name,
    color,
    isPolice,
    pos: group.position,
    heading,
    speed: 0,
    steer: 0,
    slide: 0,
    health: CAR.health,
    maxSpeed,
    // traffic AI state
    axis: 'z',
    streetCoord: 0,
    dir: 1,
    laneOffset: 3.5,
    targetSpeed: 11,
    hasDriver: kind === 'traffic',
    parked: kind === 'parked',
    destroyed: false,
    sirenPhase: Math.random() * 10,
    flashTimer: 0,
  };
}

// forward vector of a heading
export function forwardOf(heading) {
  return { x: Math.sin(heading), z: Math.cos(heading) };
}

// Move a car by its heading/speed/slide and push it out of buildings.
export function integrateCarMotion(car, dt, colliders) {
  const f = forwardOf(car.heading);
  const r = { x: f.z, z: -f.x };
  car.pos.x += (f.x * car.speed + r.x * car.slide) * dt;
  car.pos.z += (f.z * car.speed + r.z * car.slide) * dt;
  if (collideCircle(car.pos, CAR.radius, colliders)) {
    car.speed *= 0.55;
    car.slide *= 0.4;
    return true;
  }
  return false;
}

// Arcade driving for the player's car.
export function updatePlayerCar(car, dt, input, G) {
  const steerTarget = input.steer * CAR.steerMax;
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  const speedAbs = Math.abs(car.speed);
  const grip = input.handbrake ? CAR.handbrakeGrip : CAR.grip;
  if (input.throttle > 0) {
    car.speed += CAR.accel * dt * (1 - Math.max(0, car.speed) / car.maxSpeed);
  }
  if (input.brake > 0) {
    if (car.speed > 0.5) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.accel * 0.55 * dt;
  }
  if (input.throttle === 0 && input.brake === 0) car.speed -= car.speed * 0.55 * dt;
  if (car.speed < -CAR.reverseMax) car.speed = -CAR.reverseMax;
  if (car.speed > car.maxSpeed) car.speed = car.maxSpeed;
  // steering follows speed; handbrake lets the tail step out
  const turnRate = car.steer * Math.min(1, speedAbs / 7) * (input.handbrake ? 2.1 : 1.5);
  car.heading += turnRate * Math.sign(car.speed || 1) * dt;
  car.slide += (input.handbrake ? -car.slide * 0.4 : 0) * dt;
  car.slide *= Math.exp(-grip * dt);
  if (input.handbrake && speedAbs > 6) car.slide += car.steer * speedAbs * 0.22 * dt;
  const hitWall = integrateCarMotion(car, dt, G.city.colliders);
  if (hitWall && speedAbs > 9) {
    G.audio.crash(Math.min(1, speedAbs / 25));
    G.effects.sparks(car.pos.x, 0.8, car.pos.z, 6);
    car.health -= Math.min(12, speedAbs * 0.4);
  }
  // skid smoke + sound when sliding hard
  if (Math.abs(car.slide) > 2.2 && speedAbs > 8 && Math.random() < 0.6) {
    const r = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
    G.effects.smoke(car.pos.x - r.x * 1.4, 0.3, car.pos.z - r.z * 1.4, 0.7);
  }
  car.group.rotation.y = car.heading;
  for (const w of car.frontWheels) w.rotation.y = car.steer * 0.55;
  car.group.position.y = Math.sin(G.time * 22) * 0.012 * Math.min(1, speedAbs / 20);
  return { skid: Math.abs(car.slide) > 2.2 ? Math.abs(car.slide) / 6 : 0, speed01: Math.min(1, speedAbs / car.maxSpeed) };
}

// Road-following AI: drive along a street, turn at intersections, brake
// for the car ahead.
export function updateTrafficCar(car, dt, G) {
  const streets = G.city.streets;
  const f = forwardOf(car.heading);
  // car ahead on the same lane?
  let blocked = false;
  for (const other of G.cars) {
    if (other === car || other.destroyed) continue;
    const dx = other.pos.x - car.pos.x;
    const dz = other.pos.z - car.pos.z;
    const ahead = dx * f.x + dz * f.z;
    const side = Math.abs(dx * f.z - dz * f.x);
    if (ahead > 0 && ahead < 13 && side < 2.6) {
      blocked = true;
      break;
    }
  }
  const target = blocked ? 0 : car.targetSpeed;
  car.speed += (target - car.speed) * Math.min(1, dt * 1.4);
  integrateCarMotion(car, dt, G.city.colliders);
  // at an intersection, maybe turn onto the crossing street
  const crossCoord = car.axis === 'z'
    ? nearestStreetCoord(car.pos.z, streets)
    : nearestStreetCoord(car.pos.x, streets);
  const along = car.axis === 'z' ? car.pos.z : car.pos.x;
  if (Math.abs(along - crossCoord) < 1.2 && Math.random() < dt * 0.35) {
    const newAxis = car.axis === 'z' ? 'x' : 'z';
    const newDir = Math.random() < 0.5 ? 1 : -1;
    car.axis = newAxis;
    car.streetCoord = crossCoord;
    car.dir = newDir;
    car.heading = newAxis === 'z' ? (newDir > 0 ? 0 : Math.PI) : (newDir > 0 ? Math.PI / 2 : -Math.PI / 2);
    car.laneOffset = 3.5;
  }
  // keep the car on its lane
  const lanePos = car.axis === 'z'
    ? { x: car.streetCoord + car.dir * car.laneOffset, z: car.pos.z }
    : { x: car.pos.x, z: car.streetCoord - car.dir * car.laneOffset };
  car.pos.x += (lanePos.x - car.pos.x) * Math.min(1, dt * 2);
  car.pos.z += (lanePos.z - car.pos.z) * Math.min(1, dt * 2);
  // end of the road: turn around
  if (Math.abs(car.pos.x) > 182 || Math.abs(car.pos.z) > 182) {
    car.dir *= -1;
    car.heading += Math.PI;
  }
  car.group.rotation.y = car.heading;
}

// Push overlapping cars apart and trade a little speed.
export function collideCars(cars, G) {
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i];
    if (a.destroyed) continue;
    for (let j = i + 1; j < cars.length; j++) {
      const b = cars[j];
      if (b.destroyed) continue;
      const dx = b.pos.x - a.pos.x;
      const dz = b.pos.z - a.pos.z;
      const d2 = dx * dx + dz * dz;
      const min = CAR.radius * 2;
      if (d2 < min * min && d2 > 0.001) {
        const d = Math.sqrt(d2);
        const push = (min - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        a.pos.x -= nx * push;
        a.pos.z -= nz * push;
        b.pos.x += nx * push;
        b.pos.z += nz * push;
        const rel = Math.abs(a.speed - b.speed);
        if (rel > 4) {
          a.health -= rel * 0.25;
          b.health -= rel * 0.25;
          G.audio.crash(Math.min(1, rel / 20));
          G.effects.sparks((a.pos.x + b.pos.x) / 2, 0.8, (a.pos.z + b.pos.z) / 2, 5);
        }
        const tmp = a.speed;
        a.speed = b.speed * 0.6;
        b.speed = tmp * 0.6;
      }
    }
  }
}

export function spawnTrafficCars(scene, rng, city, count) {
  const cars = [];
  const streets = city.streets;
  for (let i = 0; i < count; i++) {
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const coord = streets[Math.floor(rng.next() * streets.length)];
    const dir = rng.chance(0.5) ? 1 : -1;
    const along = rng.float(-170, 170);
    const x = axis === 'z' ? coord + dir * 3.5 : along;
    const z = axis === 'z' ? along : coord - dir * 3.5;
    const heading = axis === 'z' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const car = createCar(scene, {
      x, z, heading,
      color: CAR_COLORS[Math.floor(rng.next() * CAR_COLORS.length)],
      kind: 'traffic',
      name: CAR_NAMES[Math.floor(rng.next() * CAR_NAMES.length)],
      maxSpeed: rng.float(10, 14),
    });
    car.axis = axis;
    car.streetCoord = coord;
    car.dir = dir;
    car.targetSpeed = rng.float(9, 13);
    cars.push(car);
  }
  return cars;
}

export function spawnParkedCars(scene, rng, city, count) {
  const cars = [];
  const streets = city.streets;
  for (let i = 0; i < count; i++) {
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const coord = streets[Math.floor(rng.next() * streets.length)];
    const along = rng.float(-160, 160);
    const side = rng.chance(0.5) ? 6.2 : -6.2;
    const x = axis === 'z' ? coord + side : along;
    const z = axis === 'z' ? along : coord + side;
    const heading = axis === 'z' ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2);
    const car = createCar(scene, {
      x, z, heading,
      color: CAR_COLORS[Math.floor(rng.next() * CAR_COLORS.length)],
      kind: 'parked',
      name: CAR_NAMES[Math.floor(rng.next() * CAR_NAMES.length)],
      maxSpeed: rng.float(24, 34),
    });
    car.parked = true;
    car.hasDriver = false;
    cars.push(car);
  }
  return cars;
}
