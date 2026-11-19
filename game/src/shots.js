// Staged screenshot scenes for ?shot=<name>. Each one sets up a scripted
// moment — positions, wanted level, police, mission state — and leaves the
// camera following the action so the frame stays alive while the game runs.

const THREE = window.THREE;

function placePlayerInCar(G, x, z, heading, speed) {
  const player = G.player;
  let car = player.car;
  if (!car) {
    // take the nearest parked car and put it here
    car = G.cars.find((c) => c.kind === 'parked' && !c.destroyed);
    if (!car) return null;
  }
  car.pos.set(x, 0, z);
  car.heading = heading;
  car.speed = speed;
  car.parked = false;
  car.hasDriver = false;
  player.inCar = true;
  player.car = car;
  player.group.visible = false;
  car.group.rotation.y = heading;
  return car;
}

function followCamera(G, lx, ly, lz, lookAhead) {
  G.shotCamera = {
    offset: new THREE.Vector3(lx, ly, lz),
    lookAhead,
  };
}

export function stageShot(G, name) {
  const player = G.player;
  // clear any existing police first
  for (const car of [...G.police.cars]) {
    car.destroyed = true;
    G.scene.remove(car.group);
    G.cars.splice(G.cars.indexOf(car), 1);
  }
  G.police.cars = [];
  G.police.wanted = 0;

  if (name === 'chase') {
    // Leo tearing down the avenue with three stars and the PD on his tail.
    // The camera sits ahead and to the side, looking back down the street,
    // so the player's car is centre-frame with the pursuit behind it.
    const car = placePlayerInCar(G, -40, 0, Math.PI / 2, 20);
    if (!car) return;
    G.police.wanted = 3;
    // spawn three police cars close behind him, matching his speed
    const spots = [[-58, 3.5], [-66, -3.5], [-54, -7]];
    for (const [x, z] of spots) {
      const pc = G.spawnPoliceAt(x, z, Math.PI / 2);
      pc.speed = 22;
    }
    G.missions.current = {
      id: 'heat',
      title: 'LOSE THE HEAT',
      text: 'Three stars and every cop in Solara on you. Lose them, then reach the Hideout.',
      reward: 500,
    };
    G.missions.phase = 'survive';
    G.missions.surviveTimer = 30;
    G.hud.setObjective('LOSE THE HEAT', 'Three stars and every cop in Solara on you. Lose them, then reach the Hideout.', 128);
    followCamera(G, 9, 5, 15, -6);
  } else if (name === 'drive') {
    // a clean cruise down the coastal avenue, beach and ocean on the left
    const car = placePlayerInCar(G, 174, 60, Math.PI, 20);
    if (!car) return;
    G.missions.current = {
      id: 'fare',
      title: 'FIRST FARE',
      text: 'Get in a car and drive the package to the Marina pier.',
      reward: 150,
    };
    G.missions.phase = 'toTarget';
    G.missions.targetPos = { x: 251, z: -60 };
    G.hud.setObjective('FIRST FARE', 'Drive the package to the Marina pier.', 122);
    // camera on the west side of the avenue: the east side has the
    // streetlight poles, which fill the frame from the other side
    followCamera(G, 8, 5, -17, 26);
  } else if (name === 'mission') {
    // on foot at the marina, the golden beacon marking the drop-off
    player.inCar = false;
    player.car = null;
    player.group.visible = true;
    player.pos.set(238, 0, -60);
    player.heading = Math.PI / 2;
    player.group.position.copy(player.pos);
    player.group.rotation.y = player.heading;
    G.missions.current = {
      id: 'fare',
      title: 'FIRST FARE',
      text: 'Get in a car and drive the package to the Marina pier.',
      reward: 150,
    };
    G.missions.phase = 'toTarget';
    G.missions.targetPos = { x: 251, z: -60 };
    G.missions.beacon.position.set(251, 15, -60);
    G.missions.beacon.visible = true;
    G.missions.diamond.position.set(251, 6.5, -60);
    G.missions.diamond.visible = true;
    G.hud.setObjective('FIRST FARE', 'Drive the package to the Marina pier.', 13);
    followCamera(G, 5, 4.5, -11, 14);
  } else if (name === 'city') {
    // wide establishing shot: Leo's car parked on the avenue, the whole
    // city and the coast behind it
    const car = placePlayerInCar(G, 8, 42, Math.PI / 2, 0);
    if (!car) return;
    player.inCar = false;
    player.car = null;
    player.group.visible = true;
    player.pos.set(8, 0, 38);
    player.heading = Math.PI / 2;
    player.group.position.copy(player.pos);
    player.group.rotation.y = player.heading;
    car.pos.set(8, 0, 46);
    G.missions.current = {
      id: 'fare',
      title: 'FIRST FARE',
      text: 'Get in a car and drive the package to the Marina pier.',
      reward: 150,
    };
    G.missions.phase = 'toTarget';
    G.missions.targetPos = { x: 251, z: -60 };
    G.hud.setObjective('FIRST FARE', 'Drive the package to the Marina pier.', 240);
    // high oblique from the south-west, looking north-east across the grid
    // toward the coast, so the avenue, the towers and the ocean read at once
    G.cameraRig.snapTo(new THREE.Vector3(-50, 80, 160), new THREE.Vector3(110, 0, -70));
    G.shotCamera = null;
  }
}

// Per-frame camera for staged shots: follows the player with a fixed
// local offset so the chase stays in frame while the world moves. The
// camera snaps exactly each frame (no lerp): at the low frame rates of a
// headless capture a lerped camera falls behind a moving car.
export function updateShotCamera(G, dt) {
  const sc = G.shotCamera;
  if (!sc) return;
  const target = G.player.inCar && G.player.car ? G.player.car : G.player;
  const h = target.heading;
  const f = { x: Math.sin(h), z: Math.cos(h) };
  const r = { x: f.z, z: -f.x };
  const desired = new THREE.Vector3(
    target.pos.x + r.x * sc.offset.x + f.x * sc.offset.z,
    sc.offset.y,
    target.pos.z + r.z * sc.offset.x + f.z * sc.offset.z,
  );
  const look = new THREE.Vector3(
    target.pos.x + f.x * sc.lookAhead,
    1.6,
    target.pos.z + f.z * sc.lookAhead,
  );
  G.camera.position.copy(desired);
  G.camera.lookAt(look);
}
