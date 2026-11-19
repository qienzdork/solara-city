// Solara City — boot, game loop, screens, save, and the glue between
// systems. Leo Marín, driver for the Solara Crew, in a sun-soaked coastal
// city of our own. All original names, art and sound.

import { createRandom } from './random.js';
import { buildCity } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createEffects } from './effects.js';
import { createCameraRig } from './camera.js';
import {
  createCar, updatePlayerCar, updateTrafficCar, collideCars,
  spawnTrafficCars, spawnParkedCars,
} from './vehicles.js';
import {
  createPlayer, createPedestrian, updatePlayerOnFoot, updatePedestrians,
  nearestCarToPlayer, knockDownPed,
} from './people.js';
import { createPoliceSystem, addWanted, updatePolice } from './police.js';
import { createMissions, startMission, updateMissions } from './missions.js';
import { createCombat, punch, shoot, updateCombat, tagRoots } from './combat.js';
import { createHud } from './hud.js';
import { stageShot, updateShotCamera } from './shots.js';
import { makeSkyTexture } from './textures.js';

const THREE = window.THREE;
const SAVE_KEY = 'solara-city-save-v1';
const params = new URLSearchParams(window.location.search);
const SHOT = params.get('shot');

const $ = (id) => document.getElementById(id);
const canvas = $('game-canvas');

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5d9);
scene.fog = new THREE.Fog(0xa8c8e0, 140, 420);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 10, 24);

// sky dome: gradient canvas texture on a big inverted sphere
const skyGeo = new THREE.SphereGeometry(430, 24, 12);
const skyMat = new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false });
const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);

// sun + sky light come from buildCity (city.sun) — the sky dome above is
// only a gradient backdrop, so no second light is created here.

// drifting clouds
const clouds = [];
{
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false });
  const rngC = createRandom(99);
  for (let i = 0; i < 10; i++) {
    const puff = new THREE.Group();
    const n = 3 + Math.floor(rngC.next() * 3);
    for (let j = 0; j < n; j++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(rngC.float(4, 9), 8, 6), cloudMat);
      s.position.set(j * rngC.float(4, 7) - n * 3, rngC.float(-1, 1.5), rngC.float(-3, 3));
      s.scale.y = 0.45;
      puff.add(s);
    }
    puff.position.set(rngC.float(-220, 220), rngC.float(95, 125), rngC.float(-220, 220));
    scene.add(puff);
    clouds.push(puff);
  }
}

// ---------- world ----------
const rng = createRandom(20261119);
const city = buildCity(scene, rng);
const effects = createEffects(scene);
const audio = createAudio();
const input = createInput(canvas);
const cameraRig = createCameraRig(camera);
const hud = createHud(document);

// cars
const cars = [];
const traffic = spawnTrafficCars(scene, rng, city, 20);
cars.push(...traffic);
const parked = spawnParkedCars(scene, rng, city, 10);
cars.push(...parked);
// the red Comet GT waiting at the dealership (mission 2 target)
const targetCar = createCar(scene, {
  x: -87, z: -19, heading: Math.PI / 2,
  color: 0xd40000, kind: 'parked', name: 'Comet GT', maxSpeed: 38,
});
targetCar.isTargetCar = true;
targetCar.parked = true;
targetCar.hasDriver = false;
cars.push(targetCar);
// Leo's starter car near spawn
const starterCar = createCar(scene, {
  x: 6, z: 112, heading: Math.PI,
  color: 0xf1c40f, kind: 'parked', name: 'Vento', maxSpeed: 30,
});
starterCar.parked = true;
starterCar.hasDriver = false;
cars.push(starterCar);

// people
const player = createPlayer(scene, city.places.spawn.x, city.places.spawn.z);
const peds = [];
for (let i = 0; i < 30; i++) peds.push(createPedestrian(scene, rng, city));

// systems
const police = createPoliceSystem(scene);
const missions = createMissions(scene, city, rng);
const combat = createCombat(scene);

const G = {
  scene,
  camera,
  canvas,
  renderer,
  city,
  cars,
  peds,
  player,
  police,
  missions,
  combat,
  hud,
  audio,
  effects,
  input,
  cameraRig,
  rng,
  time: 0,
  clockMin: 600, // 10:00
  cameraYaw: 0,
  nearestPoliceDist: null,
  mode: 'menu',
  shotMode: false,
  overTitle: '',
  overSub: '',
};

function spawnPoliceAt(x, z, heading) {
  const car = createCar(G.scene, {
    x, z, heading,
    color: 0x1a1a1a, kind: 'police', name: 'Interceptor',
    maxSpeed: 42, isPolice: true,
  });
  car.hasDriver = false;
  G.cars.push(car);
  G.police.cars.push(car);
  return car;
}
G.spawnPoliceAt = spawnPoliceAt;

G.events = {
  addWanted(stars, reason) {
    addWanted(G, stars, reason);
  },
  carDestroyed(car) {
    if (car.destroyed) return;
    car.destroyed = true;
    effects.explosion(car.pos.x, 1, car.pos.z);
    audio.crash(1);
    scene.remove(car.group);
    const i = cars.indexOf(car);
    if (i >= 0) cars.splice(i, 1);
    if (car.kind === 'police') {
      const j = police.cars.indexOf(car);
      if (j >= 0) police.cars.splice(j, 1);
      addWanted(G, 1, 'A police car went up in flames');
    }
    if (player.inCar && player.car === car) {
      player.inCar = false;
      player.car = null;
      player.group.visible = true;
      player.pos.copy(car.pos);
      player.pos.x += 3;
      player.health -= 20;
      player.invulnTimer = 1.5;
      hud.banner('CAR DESTROYED', 'Leo bailed out — on foot now');
      if (player.health <= 0) G.events.playerDown();
    }
  },
  playerDown() {
    if (G.mode !== 'play') return;
    G.mode = 'over';
    G.overTitle = 'LEO IS DOWN';
    G.overSub = 'The crew will pick up the pieces. Solara never forgets.';
    showOver();
  },
  playerCaught() {
    if (G.mode !== 'play') return;
    G.mode = 'over';
    G.overTitle = 'BUSTED';
    G.overSub = 'The Solara PD finally got their man. Time served, then back on the streets.';
    police.wanted = 0;
    showOver();
  },
};
tagRoots(G);

// ---------- save ----------
function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: missions.cash,
      completed: missions.completed,
      index: missions.index,
    }));
  } catch { /* storage unavailable: play on without saving */ }
}
G.save = saveGame;

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ---------- screens ----------
const startScreen = $('start-screen');
const pauseScreen = $('pause-screen');
const overScreen = $('over-screen');
const continueBtn = $('continue-btn');
const saved = loadSave();
if (saved && saved.cash > 0) {
  continueBtn.style.display = 'inline-block';
  continueBtn.textContent = `CONTINUE — $${saved.cash} • ${saved.completed} job${saved.completed === 1 ? '' : 's'} done`;
}

function hideScreens() {
  startScreen.classList.add('hidden');
  pauseScreen.classList.add('hidden');
  overScreen.classList.add('hidden');
}

function showOver() {
  $('over-title').textContent = G.overTitle;
  $('over-sub').textContent = G.overSub;
  $('over-stats').textContent = `Cash $${missions.cash.toLocaleString('en-US')}  •  ${missions.completed} job${missions.completed === 1 ? '' : 's'} done  •  Rank: ${missions.rank}`;
  overScreen.classList.remove('hidden');
}

function startGame(fromSave) {
  hideScreens();
  audio.ensure();
  G.mode = 'play';
  if (fromSave && saved) {
    missions.cash = saved.cash || 0;
    missions.completed = saved.completed || 0;
    missions.index = saved.index || 0;
  }
  hud.setCash(missions.cash);
  hud.setRank(missions.rank);
  cameraRig.resetBehind(player.pos, player.heading);
  if (!G.shotMode) startMission(missions, G);
}

$('start-btn').addEventListener('click', () => startGame(false));
continueBtn.addEventListener('click', () => startGame(true));
$('resume-btn').addEventListener('click', () => {
  hideScreens();
  G.mode = 'play';
});
$('restart-btn').addEventListener('click', () => location.reload());
$('over-restart-btn').addEventListener('click', () => location.reload());
window.addEventListener('error', (e) => {
  const el = $('start-error');
  if (el) el.textContent = `Something failed to load: ${e.message}`;
});

// ---------- enter / exit car ----------
function tryEnterCar() {
  const car = nearestCarToPlayer(G);
  if (!car) return;
  if (car.hasDriver) {
    // the driver bails and runs
    const driver = createPedestrian(scene, rng, city);
    driver.pos.set(car.pos.x + 2, 0, car.pos.z + 2);
    driver.fleeing = true;
    driver.fleeTimer = 4;
    peds.push(driver);
    car.hasDriver = false;
    tagRoots(G);
  }
  if (car.isTargetCar && !car.stolen) {
    car.stolen = true;
    addWanted(G, 2, 'Grand theft auto — the Comet GT is hot');
    hud.banner('STOLEN', 'The red Comet GT is yours. The PD knows it.');
  }
  car.parked = false;
  player.inCar = true;
  player.car = car;
  player.group.visible = false;
  audio.click();
  cameraRig.resetBehind(car.pos, car.heading);
}

function exitCar() {
  const car = player.car;
  if (!car) return;
  player.inCar = false;
  player.car = null;
  player.group.visible = true;
  player.pos.set(car.pos.x + 2.4, 0, car.pos.z + 1.2);
  player.heading = car.heading;
  player.group.position.copy(player.pos);
  player.group.rotation.y = player.heading;
  cameraRig.resetBehind(player.pos, player.heading);
}

// ---------- per-frame update ----------
let last = performance.now();

function update(dt) {
  G.time += dt;
  G.clockMin = (600 + G.time * 0.5) % 1440;

  // pause
  if (input.pressed('KeyP') || input.pressed('Escape')) {
    if (!G.shotMode) {
      G.mode = 'pause';
      pauseScreen.classList.remove('hidden');
    }
  }

  // enter / exit car
  if (input.pressed('KeyE')) {
    if (player.inCar) exitCar();
    else tryEnterCar();
  }
  // punch / shoot on foot
  if (!player.inCar) {
    if (input.pressed('KeyF')) punch(G, dt);
    if (input.mouseDown && player.shootTimer <= 0) shoot(G);
  }

  // player
  let speed01 = 0;
  let skid = 0;
  if (player.inCar && player.car) {
    const res = updatePlayerCar(player.car, dt, input, G);
    speed01 = res.speed01;
    skid = res.skid;
    if (player.car.health <= 0) G.events.carDestroyed(player.car);
    player.pos.copy(player.car.pos);
    player.heading = player.car.heading;
  } else {
    updatePlayerOnFoot(player, dt, input, G);
    speed01 = player.speed / 10.5;
  }

  // traffic + parked (parked cars with speed coast to a stop)
  for (const car of cars) {
    if (car.destroyed) continue;
    if (car.kind === 'traffic') updateTrafficCar(car, dt, G);
    else if (car.kind === 'parked' && Math.abs(car.speed) > 0.1) {
      car.speed *= Math.max(0, 1 - 1.2 * dt);
      car.pos.x += Math.sin(car.heading) * car.speed * dt;
      car.pos.z += Math.cos(car.heading) * car.speed * dt;
    }
  }
  collideCars(cars, G);

  // player car vs pedestrians
  if (player.inCar && player.car && Math.abs(player.car.speed) > 3) {
    for (const ped of peds) {
      if (ped.down) continue;
      const d = Math.hypot(ped.pos.x - player.car.pos.x, ped.pos.z - player.car.pos.z);
      if (d < 1.9) {
        knockDownPed(ped);
        player.car.speed *= 0.75;
        effects.sparks(ped.pos.x, 1, ped.pos.z, 6);
        audio.crash(0.5);
        if (G.nearestPoliceDist !== null && G.nearestPoliceDist < 60) {
          addWanted(G, 1, 'Hit and run, witnessed');
        }
      }
    }
  }

  updatePedestrians(peds, dt, G);
  updatePolice(G, dt);
  updateMissions(missions, dt, G);
  updateCombat(G, dt);
  effects.update(dt);

  // camera
  const targetPos = player.inCar && player.car ? player.car.pos : player.pos;
  const targetHeading = player.inCar && player.car ? player.car.heading : player.heading;
  const targetSpeed = player.inCar && player.car ? Math.abs(player.car.speed) : player.speed;
  if (G.shotCamera) {
    updateShotCamera(G, dt);
  } else {
    cameraRig.update(dt, targetPos, targetHeading, targetSpeed, input, player.inCar);
  }
  G.cameraYaw = cameraRig.yaw;

  // audio
  audio.update(dt, speed01, input.throttle, skid, G.nearestPoliceDist);

  // clouds drift
  for (const c of clouds) {
    c.position.x += dt * 1.2;
    if (c.position.x > 260) c.position.x = -260;
  }

  // HUD
  hud.setCash(missions.cash);
  hud.setHealth(player.health);
  hud.setWanted(police.wanted);
  hud.setSpeed(player.inCar && player.car ? Math.abs(player.car.speed) * 3.6 : player.speed * 3.6);
  hud.setTime(G.clockMin);
  hud.setRank(missions.rank);
  hud.drawMinimap(G);
  if (!player.inCar) {
    const near = nearestCarToPlayer(G);
    if (near) {
      hud.setPrompt(near.isTargetCar && !near.stolen ? `Press E to steal the ${near.name}` : `Press E to get in the ${near.name}`);
    } else {
      hud.setPrompt('WASD move • F punch • Click shoot • E enter car');
    }
  } else {
    hud.setPrompt('WASD drive • SPACE handbrake • E exit car');
  }

  input.endFrame();
}

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;
  if (G.mode === 'play') update(dt);
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- staged screenshot mode ----------
if (SHOT) {
  G.shotMode = true;
  hideScreens();
  audio.ensure();
  G.mode = 'play';
  stageShot(G, SHOT);
  cameraRig.resetBehind(player.pos, player.heading);
  hud.setCash(missions.cash);
  hud.setRank(missions.rank);
}

requestAnimationFrame(animate);
