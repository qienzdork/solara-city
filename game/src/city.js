// Solara City itself: a sun-soaked coastal grid city built from boxes,
// planes and cylinders, every texture drawn procedurally. Exports the
// collision boxes, the street lists traffic and police drive on, and the
// named places missions use. `THREE` is the global from three.min.js.

import { CITY, LOOK } from './config.js';
import {
  makeBuildingTexture,
  makeGroundTexture,
  makeRoadTexture,
  makeSandTexture,
  makeSidewalkTexture,
} from './textures.js';

const THREE = window.THREE;

const PALETTE = ['#d9a06b', '#c98d7a', '#b7a58a', '#a8b8c4', '#d4b483', '#c4a4a4', '#8fa8b8', '#e0c090'];

// Push a circle (x, z, radius) out of every building box it overlaps.
// Returns true when anything was pushed.
export function collideCircle(pos, radius, colliders) {
  let hit = false;
  for (let i = 0; i < colliders.length; i++) {
    const b = colliders[i];
    const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      } else {
        // centre inside the box: shove out along the smallest penetration
        const px = Math.min(pos.x - b.minX, b.maxX - pos.x);
        const pz = Math.min(pos.z - b.minZ, b.maxZ - pos.z);
        if (px < pz) pos.x = pos.x - b.minX < b.maxX - pos.x ? b.minX - radius : b.maxX + radius;
        else pos.z = pos.z - b.minZ < b.maxZ - pos.z ? b.minZ - radius : b.maxZ + radius;
      }
    }
  }
  return hit;
}

export function clampToBounds(pos, margin = 4) {
  const b = CITY.bounds;
  pos.x = Math.max(-b + margin, Math.min(b - margin, pos.x));
  pos.z = Math.max(-b + margin, Math.min(b - margin, pos.z));
}

// Nearest street centreline coordinate on the given axis.
export function nearestStreetCoord(value, streets) {
  let best = streets[0];
  let bestD = Math.abs(value - best);
  for (let i = 1; i < streets.length; i++) {
    const d = Math.abs(value - streets[i]);
    if (d < bestD) {
      bestD = d;
      best = streets[i];
    }
  }
  return best;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const streets = [];
  for (let i = -3; i <= 3; i++) streets.push(i * CITY.pitch);
  const group = new THREE.Group();
  group.name = 'solara-city';
  scene.add(group);

  // --- ground, roads, sidewalks -------------------------------------------
  const groundMat = new THREE.MeshLambertMaterial({ map: makeGroundTexture() });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(760, 760), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(40, 0, 0);
  ground.receiveShadow = true;
  group.add(ground);

  const roadMat = new THREE.MeshLambertMaterial({ map: makeRoadTexture() });
  const roadGeoX = new THREE.PlaneGeometry(400, CITY.streetWidth);
  const roadGeoZ = new THREE.PlaneGeometry(CITY.streetWidth, 400);
  for (const s of streets) {
    const rx = new THREE.Mesh(roadGeoX, roadMat);
    rx.rotation.x = -Math.PI / 2;
    rx.position.set(0, 0.02, s);
    rx.receiveShadow = true;
    group.add(rx);
    const rz = new THREE.Mesh(roadGeoZ, roadMat);
    rz.rotation.x = -Math.PI / 2;
    rz.position.set(s, 0.02, 0);
    rz.receiveShadow = true;
    group.add(rz);
  }

  const walkMat = new THREE.MeshLambertMaterial({ map: makeSidewalkTexture() });
  const walkGeo = new THREE.BoxGeometry(CITY.blockSize + 2, 0.14, CITY.blockSize + 2);
  const blockCentres = [];
  for (let i = -3; i < 3; i++) {
    for (let j = -3; j < 3; j++) {
      blockCentres.push([(i + 0.5) * CITY.pitch, (j + 0.5) * CITY.pitch]);
    }
  }
  for (const [bx, bz] of blockCentres) {
    const walk = new THREE.Mesh(walkGeo, walkMat);
    walk.position.set(bx, 0.07, bz);
    walk.receiveShadow = true;
    group.add(walk);
  }

  // --- buildings ------------------------------------------------------------
  const facadeTextures = PALETTE.map((c) => makeBuildingTexture(rng, c));
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a4a50 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const acGeo = new THREE.BoxGeometry(2.2, 1, 2.2);
  const acMat = new THREE.MeshLambertMaterial({ color: 0x8a8f96 });
  for (const [bx, bz] of blockCentres) {
    const distCentre = Math.hypot(bx, bz);
    const maxH = distCentre < 90 ? 46 : distCentre < 150 ? 30 : 20;
    const cells = [
      [-11, -11],
      [11, -11],
      [-11, 11],
      [11, 11],
    ];
    for (const [ox, oz] of cells) {
      if (!rng.chance(0.72)) continue;
      const w = rng.float(11, 17);
      const d = rng.float(11, 17);
      const h = rng.float(9, maxH);
      const tex = facadeTextures[Math.floor(rng.next() * facadeTextures.length)].clone();
      tex.needsUpdate = true;
      tex.repeat.set(Math.max(1, Math.round(w / 11)), Math.max(1, Math.round(h / 11)));
      const facadeMat = new THREE.MeshLambertMaterial({ map: tex });
      const mesh = new THREE.Mesh(boxGeo, [facadeMat, facadeMat, roofMat, roofMat, facadeMat, facadeMat]);
      mesh.position.set(bx + ox, h / 2 + 0.14, bz + oz);
      mesh.scale.set(w, h, d);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      colliders.push({
        minX: bx + ox - w / 2,
        maxX: bx + ox + w / 2,
        minZ: bz + oz - d / 2,
        maxZ: bz + oz + d / 2,
      });
      if (rng.chance(0.5)) {
        const ac = new THREE.Mesh(acGeo, acMat);
        ac.position.set(bx + ox + rng.float(-3, 3), h + 0.6, bz + oz + rng.float(-3, 3));
        group.add(ac);
      }
    }
  }

  // --- streetlights ---------------------------------------------------------
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 7, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  const lampGeo = new THREE.SphereGeometry(0.32, 8, 6);
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffdf8a, emissiveIntensity: 0.7 });
  for (const sx of streets) {
    for (const sz of streets) {
      if ((sx + sz) % 116 !== 0) continue;
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(sx + 8, 3.5, sz + 8);
      group.add(pole);
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(sx + 8, 7, sz + 8);
      group.add(lamp);
    }
  }

  // --- palms along the beach and a few blocks --------------------------------
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.28, 6.5, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const frondGeo = new THREE.BoxGeometry(0.5, 0.08, 3.4);
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3f8a3a });
  function palm(x, z) {
    const p = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 3.25;
    trunk.rotation.z = rng.float(-0.08, 0.08);
    p.add(trunk);
    for (let i = 0; i < 6; i++) {
      const f = new THREE.Mesh(frondGeo, frondMat);
      const a = (i / 6) * Math.PI * 2;
      f.position.set(Math.cos(a) * 1.2, 6.6, Math.sin(a) * 1.2);
      f.rotation.y = -a;
      f.rotation.x = 0.5;
      p.add(f);
    }
    p.position.set(x, 0, z);
    p.traverse((m) => {
      if (m.isMesh) m.castShadow = true;
    });
    group.add(p);
  }
  for (let z = -180; z <= 180; z += 30) {
    palm(CITY.coastX - 12 + rng.float(-4, 4), z + rng.float(-6, 6));
  }
  for (let i = 0; i < 10; i++) {
    palm(rng.float(-160, 160), rng.float(-160, 160));
  }

  // --- beach, water, marina ---------------------------------------------------
  const sandMat = new THREE.MeshLambertMaterial({ map: makeSandTexture() });
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(CITY.beachWidth + 14, 420), sandMat);
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(CITY.coastX + 4, 0.03, 0);
  sand.receiveShadow = true;
  group.add(sand);
  const waterMat = new THREE.MeshLambertMaterial({ color: LOOK.waterColor, transparent: true, opacity: 0.9 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(220, 460), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(CITY.coastX + 120, 0.06, 0);
  group.add(water);
  // pier
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a44 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(46, 0.5, 6), pierMat);
  pier.position.set(CITY.coastX + 26, 0.5, -60);
  pier.castShadow = true;
  group.add(pier);
  // boats
  const hullMat = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });
  const hullMat2 = new THREE.MeshLambertMaterial({ color: 0x3a6ea8 });
  for (const [bx, bz, mat] of [
    [CITY.coastX + 34, -72, hullMat],
    [CITY.coastX + 40, -48, hullMat2],
    [CITY.coastX + 30, -84, hullMat2],
  ]) {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(9, 1.6, 3), mat);
    hull.position.set(bx, 0.4, bz);
    group.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 2.4), new THREE.MeshLambertMaterial({ color: 0xdddddd }));
    cabin.position.set(bx - 1, 1.9, bz);
    group.add(cabin);
  }

  // --- lights -----------------------------------------------------------------
  const sun = new THREE.DirectionalLight(LOOK.sunColor, LOOK.sunIntensity);
  sun.position.set(160, 240, 90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -130;
  sun.shadow.camera.right = 130;
  sun.shadow.camera.top = 130;
  sun.shadow.camera.bottom = -130;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(LOOK.hemiSky, LOOK.hemiGround, LOOK.hemiIntensity);
  scene.add(hemi);

  // --- named places -----------------------------------------------------------
  const places = {
    spawn: { x: 0, z: 116 },
    marina: { x: CITY.coastX + 26, z: -60 },
    garage: { x: 116, z: 145 },
    dealership: { x: -87, z: -29 },
    hideout: { x: -145, z: 145 },
    hospital: { x: 29, z: -145 },
    beach: { x: CITY.coastX - 6, z: 40 },
  };

  return { group, colliders, streets, places, sun };
}
