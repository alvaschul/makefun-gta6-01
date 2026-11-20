// city.js — procedural Azura Bay.
// Builds the whole map into the scene: a road grid with painted lanes,
// sidewalks, blocks of neon-lit towers, palms and lamps, the eight named
// landmarks, a sandy beach and the animated bay along the east edge, plus
// harbour dressing. Returns collision boxes and gameplay anchors.
//
// Layout maths: avenues and streets repeat every CONFIG.roadSpacing units,
// roads are CONFIG.roadWidth wide, and the blocks between them hold the
// buildings. Colliders are axis-aligned boxes {minX, maxX, minZ, maxZ, h}.

import * as THREE from "three";
import { CONFIG, LANDMARKS, PALETTE } from "./config.js";
import { setSeed, range, intRange, pick, chance } from "./random.js";

const BUILDING_COLORS = [
  PALETTE.buildingA, PALETTE.buildingB, PALETTE.buildingC, PALETTE.buildingD,
  0x6a5a8a, 0x7a4a5a, 0x4a6a6a, 0x8a7a4a,
];
const NEON_COLORS = [
  PALETTE.neonPink, PALETTE.neonCyan, PALETTE.neonAmber, PALETTE.neonViolet,
];

function box(w, h, d, color, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0.05,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.castShadow = !!opts.cast;
  mesh.receiveShadow = true;
  return mesh;
}

function addCollider(colliders, cx, cz, w, d, h) {
  colliders.push({
    minX: cx - w / 2, maxX: cx + w / 2,
    minZ: cz - d / 2, maxZ: cz + d / 2,
    h,
  });
}

// One tower: a slab with a grid of window planes, some of them lit, and a
// neon trim strip near the roofline in a random accent colour.
function buildTower(parent, colliders, cx, cz, w, d) {
  const height = range(14, 46);
  const color = pick(BUILDING_COLORS);
  const tower = box(w, height, d, color, { cast: true });
  tower.position.set(cx, height / 2, cz);
  parent.add(tower);
  addCollider(colliders, cx, cz, w, d, height);

  const trim = box(w + 0.3, 0.5, d + 0.3, 0x111111, {
    emissive: pick(NEON_COLORS), emissiveIntensity: 1.6,
  });
  trim.position.set(cx, height - 1.2, cz);
  parent.add(trim);

  const winGeo = new THREE.PlaneGeometry(1.1, 1.4);
  const litMat = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  const warmMat = new THREE.MeshBasicMaterial({ color: 0xffb36b });
  const coolMat = new THREE.MeshBasicMaterial({ color: 0x9fd8ff });
  const darkMat = new THREE.MeshBasicMaterial({ color: 0x1c1c26 });
  const floors = Math.floor(height / 3.2);
  const colsX = Math.max(2, Math.floor(w / 3));
  const colsZ = Math.max(2, Math.floor(d / 3));
  const windowMats = [litMat, warmMat, coolMat, darkMat, darkMat];
  for (let f = 1; f < floors; f++) {
    const y = f * 3.2;
    for (let c = 0; c < colsX; c++) {
      const x = cx - w / 2 + ((c + 0.5) / colsX) * w;
      for (const side of [-1, 1]) {
        const win = new THREE.Mesh(winGeo, pick(windowMats));
        win.position.set(x, y, cz + side * (d / 2 + 0.06));
        if (side < 0) win.rotation.y = Math.PI;
        parent.add(win);
      }
    }
    for (let c = 0; c < colsZ; c++) {
      const z = cz - d / 2 + ((c + 0.5) / colsZ) * d;
      for (const side of [-1, 1]) {
        const win = new THREE.Mesh(winGeo, pick(windowMats));
        win.position.set(cx + side * (w / 2 + 0.06), y, z);
        win.rotation.y = side * (Math.PI / 2);
        parent.add(win);
      }
    }
  }
  return tower;
}

// Low shopfront block used to vary the skyline between towers.
function buildShopBlock(parent, colliders, cx, cz, w, d) {
  const height = range(5, 8);
  const block = box(w, height, d, pick(BUILDING_COLORS), { cast: true });
  block.position.set(cx, height / 2, cz);
  parent.add(block);
  addCollider(colliders, cx, cz, w, d, height);
  const awning = box(w * 0.8, 0.3, 1.6, 0x181818, {
    emissive: pick(NEON_COLORS), emissiveIntensity: 1.2,
  });
  awning.position.set(cx, 3.1, cz + d / 2 + 0.7);
  parent.add(awning);
}

function buildPalm(parent, x, z) {
  const group = new THREE.Group();
  const trunkH = range(5.5, 8);
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.34, trunkH, 6),
    new THREE.MeshStandardMaterial({ color: PALETTE.palmTrunk, roughness: 1 })
  );
  trunk.position.y = trunkH / 2;
  trunk.rotation.z = range(-0.08, 0.08);
  group.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({
    color: PALETTE.palmLeaf, roughness: 0.9, side: THREE.DoubleSide,
  });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.7), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.2, trunkH + 0.25, Math.sin(a) * 1.2);
    leaf.rotation.set(0.5, -a, 0);
    group.add(leaf);
  }
  group.position.set(x, 0, z);
  parent.add(group);
}

function buildLamp(parent, x, z) {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.12, 5.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.6, metalness: 0.5 })
  );
  pole.position.y = 2.7;
  group.add(pole);
  const head = box(0.5, 0.22, 0.5, 0x222222, {
    emissive: 0xffc98a, emissiveIntensity: 2.2,
  });
  head.position.y = 5.5;
  group.add(head);
  const light = new THREE.PointLight(0xffb36b, 12, 17, 1.8);
  light.position.y = 5.3;
  group.add(light);
  group.position.set(x, 0, z);
  parent.add(group);
}

// Distinct looks per landmark so players can navigate by sight.
const LANDMARK_STYLE = {
  "Pelangi Motel": { color: 0xe86a9a, sign: PALETTE.neonPink, h: 9 },
  "Mama Lala's Diner": { color: 0xf2e3c8, sign: PALETTE.neonAmber, h: 6 },
  "Club Sirena": { color: 0x3a2a6a, sign: PALETTE.neonViolet, h: 12 },
  "Haris Auto Repair": { color: 0x7a8288, sign: PALETTE.neonCyan, h: 7 },
  "Toko Senjata Budi": { color: 0x5a4a38, sign: 0xff5a3c, h: 7 },
  "Splash & Go Car Wash & Respray": { color: 0x2e7ad9, sign: PALETTE.neonCyan, h: 6 },
  "Santa Rosa Hospital": { color: 0xe8ecf2, sign: 0xff3c3c, h: 16 },
  "Azura Bay Police Precinct": { color: 0x2e4a7a, sign: 0x3c8aff, h: 11 },
};

function buildLandmark(parent, colliders, lm) {
  const style = LANDMARK_STYLE[lm.name] || { color: 0x888888, sign: 0xffffff, h: 8 };
  const w = 26, d = 20;
  const body = box(w, style.h, d, style.color, { cast: true });
  body.position.set(lm.x, style.h / 2, lm.z);
  parent.add(body);
  addCollider(colliders, lm.x, lm.z, w, d, style.h);
  // Signage slab glowing above the entrance face.
  const sign = box(w * 0.7, 1.6, 0.4, 0x101014, {
    emissive: style.sign, emissiveIntensity: 2.4,
  });
  sign.position.set(lm.x, style.h - 1.4, lm.z + d / 2 + 0.3);
  parent.add(sign);
  // Entrance canopy.
  const canopy = box(8, 0.3, 3, 0x181820, {
    emissive: style.sign, emissiveIntensity: 0.7,
  });
  canopy.position.set(lm.x, 3, lm.z + d / 2 + 1.6);
  parent.add(canopy);
  return { name: lm.name, x: lm.x, z: lm.z, mesh: body };
}

export function buildCity(scene) {
  setSeed(20261120);
  const colliders = [];
  const city = new THREE.Group();
  scene.add(city);
  const half = CONFIG.worldSize / 2;
  const spacing = CONFIG.roadSpacing;
  const roadW = CONFIG.roadWidth;

  // --- Ground base -------------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CONFIG.worldSize + 260, CONFIG.worldSize + 260),
    new THREE.MeshStandardMaterial({ color: 0x3f4a3a, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  scene.add(ground);

  // --- Road grid ---------------------------------------------------------
  const roadMat = new THREE.MeshStandardMaterial({ color: PALETTE.asphalt, roughness: 0.95 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf2e28a });
  const sideMat = new THREE.MeshStandardMaterial({ color: PALETTE.sidewalk, roughness: 1 });
  const lines = [];
  for (let gx = -half; gx <= half; gx += spacing) lines.push(gx);
  for (const gx of lines) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(roadW, CONFIG.worldSize), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(gx, 0.01, 0);
    road.receiveShadow = true;
    city.add(road);
    const walk = new THREE.Mesh(
      new THREE.PlaneGeometry(roadW + CONFIG.sidewalkWidth * 2, CONFIG.worldSize), sideMat);
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(gx, 0.005, 0);
    city.add(walk);
    for (let z = -half; z < half; z += 9) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 3.6), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(gx, 0.03, z);
      city.add(dash);
    }
  }
  for (const gz of lines) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.worldSize, roadW), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.012, gz);
    road.receiveShadow = true;
    city.add(road);
    const walk = new THREE.Mesh(
      new THREE.PlaneGeometry(CONFIG.worldSize, roadW + CONFIG.sidewalkWidth * 2), sideMat);
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(0, 0.006, gz);
    city.add(walk);
    for (let x = -half; x < half; x += 9) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.35), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.032, gz);
      city.add(dash);
    }
  }

  // --- Blocks of buildings ----------------------------------------------
  const landmarkSpots = new Set(LANDMARKS.map((l) => `${Math.round(l.x)},${Math.round(l.z)}`));
  for (let bx = 0; bx < lines.length - 1; bx++) {
    for (let bz = 0; bz < lines.length - 1; bz++) {
      const cx = (lines[bx] + lines[bx + 1]) / 2;
      const cz = (lines[bz] + lines[bz + 1]) / 2;
      if (cx > CONFIG.beachX - 40) continue; // keep the shore clear
      let nearLandmark = false;
      for (const lm of LANDMARKS) {
        if (Math.abs(lm.x - cx) < 42 && Math.abs(lm.z - cz) < 42) nearLandmark = true;
      }
      if (nearLandmark) continue;
      const inner = spacing - roadW - CONFIG.sidewalkWidth * 2 - 6;
      if (chance(0.3)) {
        buildShopBlock(city, colliders, cx, cz, inner * 0.8, inner * 0.8);
      } else if (chance(0.45)) {
        buildTower(city, colliders, cx, cz, inner * 0.72, inner * 0.72);
      } else {
        const q = inner / 4;
        for (const ox of [-q, q]) {
          for (const oz of [-q, q]) {
            if (chance(0.8)) {
              buildTower(city, colliders, cx + ox, cz + oz, inner * 0.36, inner * 0.36);
            }
          }
        }
      }
      // Palms and lamps dress the block corners.
      for (const ox of [-1, 1]) {
        for (const oz of [-1, 1]) {
          const px = cx + ox * (inner / 2 + 4);
          const pz = cz + oz * (inner / 2 + 4);
          if (chance(0.55)) buildPalm(city, px, pz);
          else if (chance(0.5)) buildLamp(city, px, pz);
        }
      }
    }
  }
  void landmarkSpots;

  // --- Landmarks ----------------------------------------------------------
  const landmarks = LANDMARKS.map((lm) => buildLandmark(city, colliders, lm));

  // --- Respray bay at Splash & Go ----------------------------------------
  const wash = LANDMARKS.find((l) => l.name.includes("Splash"));
  const respray = { x: wash.x, z: wash.z + 18, radius: 7 };
  const bayFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 14),
    new THREE.MeshStandardMaterial({ color: 0x2ee6e6, roughness: 0.4, emissive: 0x0a3a3a })
  );
  bayFloor.rotation.x = -Math.PI / 2;
  bayFloor.position.set(respray.x, 0.04, respray.z);
  city.add(bayFloor);
  for (const ox of [-6.5, 6.5]) {
    const post = box(0.6, 4.4, 0.6, 0x2e7ad9, { emissive: PALETTE.neonCyan, emissiveIntensity: 0.8 });
    post.position.set(respray.x + ox, 2.2, respray.z - 6);
    city.add(post);
    const post2 = post.clone();
    post2.position.z = respray.z + 6;
    city.add(post2);
  }
  const arch = box(14, 0.7, 1, 0x2e7ad9, { emissive: PALETTE.neonCyan, emissiveIntensity: 1.4 });
  arch.position.set(respray.x, 4.6, respray.z - 6);
  city.add(arch);

  // --- Beach and bay -------------------------------------------------------
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(70, CONFIG.worldSize + 200),
    new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1 })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(CONFIG.beachX + 30, 0.02, 0);
  sand.receiveShadow = true;
  scene.add(sand);
  for (let i = 0; i < 26; i++) {
    buildPalm(scene, CONFIG.beachX + range(2, 34), range(-half, half));
  }
  const waterMat = new THREE.MeshStandardMaterial({
    color: PALETTE.water, roughness: 0.25, metalness: 0.35,
    transparent: true, opacity: 0.92,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(420, CONFIG.worldSize + 320), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(CONFIG.waterX + 190, 0.35, 0);
  scene.add(water);

  // --- Harbour dressing: crates, barriers, containers ---------------------
  const crateColors = [0xb06a2e, 0x2e7ad9, 0xc23c4e, 0x3c9a6a, 0x8a8a96];
  for (let i = 0; i < 34; i++) {
    const cx = range(CONFIG.beachX - 6, CONFIG.beachX + 22);
    const cz = range(-half, half);
    const s = range(1.6, 3.2);
    const crate = box(s, s, s, pick(crateColors), { cast: true });
    crate.position.set(cx, s / 2, cz);
    crate.rotation.y = range(0, Math.PI);
    scene.add(crate);
    addCollider(colliders, cx, cz, s, s, s);
  }
  for (let i = 0; i < 16; i++) {
    const bx2 = range(-half, half);
    const bz2 = range(-half, half);
    const barrier = box(2.4, 0.9, 0.5, 0xe8e4da, {
      emissive: 0xff8c2e, emissiveIntensity: 0.35,
    });
    barrier.position.set(bx2, 0.45, bz2);
    barrier.rotation.y = range(0, Math.PI);
    scene.add(barrier);
    addCollider(colliders, bx2, bz2, 2.4, 0.5, 0.9);
  }

  // Road network description for traffic AI: the grid line coordinates.
  const roads = { vertical: lines.slice(), horizontal: lines.slice(), width: roadW };

  return {
    colliders,
    landmarks,
    respray,
    roads,
    water,
    // Animate the bay: a gentle swell moving the water plane.
    update(dt, t) {
      water.position.y = 0.35 + Math.sin(t * 0.7) * 0.08;
      waterMat.opacity = 0.9 + Math.sin(t * 1.3) * 0.04;
    },
  };
}

// Collision helper shared by player, vehicles and pedestrians: push a
// circle at (x, z) with radius r out of every AABB it overlaps.
export function resolveCollisions(colliders, pos, radius) {
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        // Centre inside the box: push out along the smallest exit.
        const left = pos.x - c.minX, right = c.maxX - pos.x;
        const top = pos.z - c.minZ, bottom = c.maxZ - pos.z;
        const m = Math.min(left, right, top, bottom);
        if (m === left) pos.x = c.minX - radius;
        else if (m === right) pos.x = c.maxX + radius;
        else if (m === top) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
      }
      return true;
    }
  }
  return false;
}
