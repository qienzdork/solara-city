// Missions: a three-job story arc for Leo and the Solara Crew, then
// repeatable fares for cash. Each mission has an objective, a glowing
// marker in the world and on the minimap, and a cash reward. The marker
// is a light beacon cylinder plus a floating diamond.

import { MISSION_REWARDS, FARE_REWARD_MIN, FARE_REWARD_MAX } from './config.js';

const THREE = window.THREE;

const STORY = [
  {
    id: 'fare',
    title: 'FIRST FARE',
    text: 'Get in a car and drive the package to the Marina pier.',
    target: 'marina',
    reward: MISSION_REWARDS[0],
    needsCar: true,
  },
  {
    id: 'hotwheels',
    title: 'HOT WHEELS',
    text: 'Steal the red Comet GT from the dealership lot and bring it to the Garage.',
    target: 'dealership',
    reward: MISSION_REWARDS[1],
    stealCar: true,
  },
  {
    id: 'heat',
    title: 'LOSE THE HEAT',
    text: 'Three stars and every cop in Solara on you. Stay unseen for 30 seconds, then reach the Hideout.',
    target: 'hideout',
    reward: MISSION_REWARDS[2],
    setWanted: 3,
    survive: 30,
  },
];

const RANKS = ['Street Driver', 'Wheelman', 'Crew Driver', 'Crew Lieutenant', 'Solara Legend'];

export function createMissions(scene, city, rng) {
  // beacon: a glowing cylinder + a floating diamond marker
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.35 });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 30, 16, 1, true), beaconMat);
  beacon.visible = false;
  scene.add(beacon);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.9),
    new THREE.MeshBasicMaterial({ color: 0xffd166 }),
  );
  diamond.visible = false;
  scene.add(diamond);
  return {
    scene,
    city,
    rng,
    beacon,
    diamond,
    index: 0, // story mission index
    current: null,
    cash: 0,
    completed: 0,
    phase: 'toTarget', // toTarget | steal | deliver | survive | done
    surviveTimer: 0,
    targetPos: null,
    fareCount: 0,
    get rank() {
      return RANKS[Math.min(RANKS.length - 1, Math.floor(this.completed / 1))];
    },
  };
}

function placeMarker(M, x, z) {
  M.targetPos = { x, z };
  M.beacon.position.set(x, 15, z);
  M.beacon.visible = true;
  M.diamond.position.set(x, 6.5, z);
  M.diamond.visible = true;
}

function hideMarker(M) {
  M.beacon.visible = false;
  M.diamond.visible = false;
  M.targetPos = null;
}

export function startMission(M, G) {
  if (M.index < STORY.length) {
    const def = STORY[M.index];
    M.current = { ...def };
    M.phase = def.stealCar ? 'steal' : 'toTarget';
    const place = M.city.places[def.target];
    placeMarker(M, place.x, place.z);
    if (def.setWanted) {
      G.police.wanted = def.setWanted;
      M.surviveTimer = def.survive;
    }
    G.hud.setObjective(def.title, def.text, null);
    G.hud.banner(def.title, def.text);
    G.audio.click();
  } else {
    startFare(M, G);
  }
}

export function startFare(M, G) {
  const streets = M.city.streets;
  const x = streets[Math.floor(M.rng.next() * streets.length)];
  const z = streets[Math.floor(M.rng.next() * streets.length)];
  const reward = Math.floor(M.rng.float(FARE_REWARD_MIN, FARE_REWARD_MAX) / 10) * 10;
  M.current = {
    id: 'fare',
    title: 'FARE',
    text: `A fare is waiting at the corner. Pick them up and drive to the drop-off for $${reward}.`,
    target: 'fare',
    reward,
    needsCar: true,
  };
  M.phase = 'toTarget';
  placeMarker(M, x, z);
  G.hud.setObjective('FARE', M.current.text, null);
}

function completeMission(M, G) {
  const reward = M.current.reward;
  M.cash += reward;
  M.completed += 1;
  G.audio.missionComplete();
  G.audio.pickup();
  G.hud.banner('MISSION COMPLETE', `+$${reward}  •  Total $${M.cash}`);
  G.hud.setObjective('', '', null);
  hideMarker(M);
  M.current = null;
  M.index += 1;
  M.phase = 'done';
  G.save();
  // next mission starts after a breath
  setTimeout(() => {
    if (G.mode === 'play') startMission(M, G);
  }, 2500);
}

export function updateMissions(M, dt, G) {
  if (!M.current) return;
  const playerPos = G.player.inCar ? G.player.car.pos : G.player.pos;
  // marker bob + spin
  if (M.diamond.visible) {
    M.diamond.rotation.y += dt * 1.6;
    M.diamond.position.y = 6.5 + Math.sin(G.time * 2.4) * 0.5;
  }
  const dist = M.targetPos ? Math.hypot(playerPos.x - M.targetPos.x, playerPos.z - M.targetPos.z) : 0;
  G.hud.setObjective(M.current.title, M.current.text, dist);
  const cur = M.current;
  if (M.phase === 'toTarget') {
    if (dist < 7) {
      if (cur.id === 'fare' && M.index >= STORY.length) {
        // a fare drop-off: done
        completeMission(M, G);
      } else if (cur.stealCar) {
        // arrived at the dealership: now steal the red Comet GT
        M.phase = 'steal';
        G.hud.setObjective(cur.title, 'Get in the red Comet GT.', null);
      } else if (cur.survive) {
        M.phase = 'survive';
        G.hud.setObjective(cur.title, 'Stay out of sight — the timer runs when no cop is near.', null);
      } else {
        completeMission(M, G);
      }
    }
  } else if (M.phase === 'steal') {
    // the theft is done once Leo is driving the Comet GT
    if (G.player.inCar && G.player.car && G.player.car.name === 'Comet GT' && G.player.car.isTargetCar) {
      M.phase = 'deliver';
      const garage = M.city.places.garage;
      placeMarker(M, garage.x, garage.z);
      G.hud.setObjective(cur.title, 'Deliver the Comet GT to the Garage.', null);
    }
  } else if (M.phase === 'deliver') {
    if (dist < 8 && G.player.inCar) {
      completeMission(M, G);
    }
  } else if (M.phase === 'survive') {
    const nearest = G.nearestPoliceDist;
    if (nearest === null || nearest > 50) {
      M.surviveTimer -= dt;
      G.hud.setObjective(cur.title, `Stay unseen: ${Math.ceil(M.surviveTimer)}s to go, then reach the Hideout.`, null);
      if (M.surviveTimer <= 0) {
        M.phase = 'toTarget';
        const hideout = M.city.places.hideout;
        placeMarker(M, hideout.x, hideout.z);
        G.hud.setObjective(cur.title, 'Heat lost. Get to the Hideout.', null);
      }
    } else {
      G.hud.setObjective(cur.title, 'A cop is close — break line of sight!', null);
    }
  }
}
