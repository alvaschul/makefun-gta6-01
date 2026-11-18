// Azura Bay itself: the street grid, its buildings, palms, lamps and named
// places, built once from the seeded random so every visit — and every
// screenshot — sees the same city. The module owns the collision boxes the
// rest of the game walks and drives against, and the list of landmarks the
// missions and the minimap point at. Rendering is three.js; the layout maths
// is plain and shared with the traffic and pedestrian systems, which follow
// the same road centre lines. Named places are placed by block address, so
// the sign on the street, the doorway effect and the minimap marker are
// three views of one entry in the PLACES table, never three facts to drift.

import * as THREE from 'three';
import { CITY, NAMES, PALETTE } from './config.js';
import { rngHelpers } from './random.js';

/** Road centre-line coordinates on one axis, west to east / south to north. */
export function roadLines() {
  const lines = [];
  for (let i = -CITY.blocks; i <= CITY.blocks; i += 1) lines.push(i * CITY.pitch);
  return lines;
}

/** Is a point on a road (either direction's band)? Traffic and spawning ask. */
export function onRoad(x, z) {
  const half = CITY.roadHalf + 0.4;
  for (const line of roadLines()) {
    if (Math.abs(x - line) <= half || Math.abs(z - line) <= half) return true;
  }
  return false;
}

function windowTexture(rng, baseColor, litRatio) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = baseColor;
  g.fillRect(0, 0, 128, 256);
  const cols = 6;
  const rows = 14;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const lit = rng.next() < litRatio;
      g.fillStyle = lit ? '#ffd98a' : '#33404f';
      g.fillRect(8 + x * 20, 10 + y * 17, 12, 10);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function signTexture(text, bg, fg) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const g = canvas.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 96);
  g.fillStyle = fg;
  g.font = 'bold 52px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 52);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Named places, by block-centre address: [centreX, centreZ, name, colors, kind].
// Kinds drive what standing in their doorway does (heal, armor, respray...).
const PLACES = [
  [-185, -185, NAMES.hospital, '#f5f7fa', '#c0392b', 'hospital'],
  [185, -185, NAMES.precinct, '#22364a', '#f5f7fa', 'precinct'],
  [37, 185, NAMES.washShop, '#35c4b5', '#10333a', 'wash'],
  [-259, 37, NAMES.gunStore, '#2b2f36', '#ffb454', 'gunstore'],
  [259, -37, NAMES.safehouse, '#ff5d8f', '#ffffff', 'safehouse'],
  [111, -37, NAMES.diner, '#ffb454', '#5b3413', 'diner'],
  [-37, 111, NAMES.club, '#7a6cff', '#ffffff', 'club'],
  [185, 185, NAMES.garage, '#8a5a2b', '#ffffff', 'garage'],
];

/** Block centre coordinates: the squares bounded by neighbouring roads. */
export function blockCentres() {
  const centres = [];
  for (const line of roadLines()) centres.push(line - CITY.pitch / 2, line + CITY.pitch / 2);
  return [...new Set(centres)].sort((a, b) => a - b);
}

export function buildCity(scene, random) {
  const rng = rngHelpers(random);
  const colliders = [];   // {minX, maxX, minZ, maxZ, height}
  const landmarks = [];   // {name, kind, x, z}
  const group = new THREE.Group();
  scene.add(group);

  const extent = CITY.extent;
  const worldSize = extent * 2 + 90;

  // Ground: one big island slab — grass inland, a sand rim, water beyond.
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(worldSize, worldSize),
    new THREE.MeshLambertMaterial({ color: PALETTE.grass }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.06;
  grass.receiveShadow = true;
  group.add(grass);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(worldSize * 4, worldSize * 4),
    new THREE.MeshPhongMaterial({ color: PALETTE.water, shininess: 120, specular: 0x99ddff }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -1.4;
  group.add(water);

  // Roads: dark ribbons along every grid line, with dashed centre paint and
  // pale sidewalks. One merged plane per ribbon keeps the draw calls low.
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.road });
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const lineMat = new THREE.MeshBasicMaterial({ color: PALETTE.roadLine });
  const lines = roadLines();
  // A plane rotated flat (rotation.x = -90°) lays its width along X and its
  // height along Z: the "V" geometries serve roads that run along Z, the "H"
  // geometries the same shapes turned a quarter-turn for roads along X.
  const roadGeoV = new THREE.PlaneGeometry(CITY.roadHalf * 2, worldSize * 0.92);
  const roadGeoH = new THREE.PlaneGeometry(worldSize * 0.92, CITY.roadHalf * 2);
  const walkGeoV = new THREE.PlaneGeometry(CITY.sidewalk, worldSize * 0.92);
  const walkGeoH = new THREE.PlaneGeometry(worldSize * 0.92, CITY.sidewalk);
  const dashGeoV = new THREE.PlaneGeometry(0.35, 4.4);
  const dashGeoH = new THREE.PlaneGeometry(4.4, 0.35);
  for (const c of lines) {
    for (const vertical of [true, false]) {
      const road = new THREE.Mesh(vertical ? roadGeoV : roadGeoH, roadMat);
      road.rotation.x = -Math.PI / 2;
      if (vertical) road.position.set(c, 0, 0);
      else road.position.set(0, 0, c);
      road.receiveShadow = true;
      group.add(road);
      for (const side of [-1, 1]) {
        const walk = new THREE.Mesh(vertical ? walkGeoV : walkGeoH, walkMat);
        walk.rotation.x = -Math.PI / 2;
        const off = side * (CITY.roadHalf + CITY.sidewalk / 2);
        if (vertical) walk.position.set(c + off, 0.01, 0);
        else walk.position.set(0, 0.01, c + off);
        group.add(walk);
      }
      // Dashed centre line, skipped across intersections for a cleaner read.
      for (let d = -extent; d < extent; d += 9) {
        if (lines.some((l) => Math.abs(d - l) < CITY.roadHalf + 4)) continue;
        const dash = new THREE.Mesh(vertical ? dashGeoV : dashGeoH, lineMat);
        dash.rotation.x = -Math.PI / 2;
        if (vertical) dash.position.set(c, 0.02, d);
        else dash.position.set(d, 0.02, c);
        group.add(dash);
      }
    }
  }

  // Buildings: each block holds a 2x2 cluster (or one tower downtown), with
  // window-lit facades. The block that hosts a named place gets its sign.
  const placeByBlock = new Map(PLACES.map((p) => [`${p[0]},${p[1]}`, p]));
  const inner = CITY.pitch - CITY.roadHalf * 2 - CITY.sidewalk * 2; // buildable square per block
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (const blockCentreX of blockCentres()) {
    for (const blockCentreZ of blockCentres()) {
      const place = placeByBlock.get(`${blockCentreX},${blockCentreZ}`);
      const downtown = Math.abs(blockCentreX) <= 74 && Math.abs(blockCentreZ) <= 74;
      const slots = downtown
        ? [{ dx: 0, dz: 0, w: inner * 0.72, d: inner * 0.72 }]
        : [
            { dx: -inner / 4, dz: -inner / 4, w: inner * 0.42, d: inner * 0.42 },
            { dx: inner / 4, dz: -inner / 4, w: inner * 0.42, d: inner * 0.42 },
            { dx: -inner / 4, dz: inner / 4, w: inner * 0.42, d: inner * 0.42 },
            { dx: inner / 4, dz: inner / 4, w: inner * 0.42, d: inner * 0.42 },
          ];
      for (const slot of slots) {
        const height = downtown ? rng.range(26, 52) : rng.range(9, 26);
        const base = rng.pick(PALETTE.buildingBase);
        const hex = `#${base.toString(16).padStart(6, '0')}`;
        const tex = windowTexture(rng, hex, downtown ? 0.5 : 0.34);
        const mat = new THREE.MeshLambertMaterial({ map: tex });
        const mesh = new THREE.Mesh(boxGeo, mat);
        mesh.scale.set(slot.w, height, slot.d);
        mesh.position.set(blockCentreX + slot.dx, height / 2, blockCentreZ + slot.dz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        colliders.push({
          minX: mesh.position.x - slot.w / 2, maxX: mesh.position.x + slot.w / 2,
          minZ: mesh.position.z - slot.d / 2, maxZ: mesh.position.z + slot.d / 2,
          height,
        });
        // A neon roof edge downtown sells the skyline at dusk.
        if (downtown) {
          const edge = new THREE.Mesh(
            new THREE.BoxGeometry(slot.w + 0.4, 0.5, slot.d / 2 + 0.4),
            new THREE.MeshBasicMaterial({ color: rng.pick(PALETTE.neon) }),
          );
          edge.position.set(mesh.position.x, height + 0.25, mesh.position.z);
          group.add(edge);
        }
      }
      if (place) {
        const [, , name, bg, fg, kind] = place;
        const sign = new THREE.Mesh(
          new THREE.PlaneGeometry(17, 3.2),
          new THREE.MeshBasicMaterial({ map: signTexture(name, bg, fg) }),
        );
        // Face the sign onto the road west of the block, at head height.
        sign.position.set(blockCentreX - inner / 2 - 0.6, 4.4, blockCentreZ);
        sign.rotation.y = -Math.PI / 2;
        group.add(sign);
        landmarks.push({ name, kind, x: blockCentreX - inner / 2 - 2.5, z: blockCentreZ });
      }
    }
  }

  // Palms along the sidewalks and lamps at the corners: instanced-look
  // dressing from shared geometry, cheap enough to scatter widely.
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 4.6, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a5a2b });
  const frondGeo = new THREE.ConeGeometry(2.6, 1.4, 7);
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2e8b6e });
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.09, 5.4, 5);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a4048 });
  const lampGeo = new THREE.SphereGeometry(0.32, 8, 6);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const lampHeads = [];
  for (const c of lines) {
    for (let d = -extent + 12; d < extent; d += 26) {
      if (rng.chance(0.6)) {
        const palm = new THREE.Group();
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 2.3;
        trunk.castShadow = true;
        const frond = new THREE.Mesh(frondGeo, frondMat);
        frond.position.y = 4.9;
        palm.add(trunk, frond);
        const side = rng.chance(0.5) ? -1 : 1;
        palm.position.set(c + side * (CITY.roadHalf + 1.6), 0, d + rng.range(-3, 3));
        group.add(palm);
        colliders.push({ minX: palm.position.x - 0.3, maxX: palm.position.x + 0.3, minZ: palm.position.z - 0.3, maxZ: palm.position.z + 0.3, height: 4 });
      }
      if (rng.chance(0.5)) {
        const lamp = new THREE.Group();
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 2.7;
        const head = new THREE.Mesh(lampGeo, lampMat);
        head.position.y = 5.5;
        lamp.add(pole, head);
        lamp.position.set(d, 0, c + (CITY.roadHalf + 0.8));
        group.add(lamp);
        lampHeads.push(head);
      }
    }
  }

  // The bay itself on the south edge: a sand beach strip the road grid fades into.
  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(worldSize, 26),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, -0.02, extent + 30);
  group.add(beach);

  return { colliders, landmarks, lampHeads, water, group };
}

/** Push a circle at (x, z) out of every collider box; returns the corrected point. */
export function resolveCollisions(colliders, x, z, radius) {
  let px = x;
  let pz = z;
  for (const box of colliders) {
    const nearX = Math.max(box.minX, Math.min(px, box.maxX));
    const nearZ = Math.max(box.minZ, Math.min(pz, box.maxZ));
    const dx = px - nearX;
    const dz = pz - nearZ;
    const distSq = dx * dx + dz * dz;
    if (distSq >= radius * radius) continue;
    if (distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      px = nearX + (dx / dist) * radius;
      pz = nearZ + (dz / dist) * radius;
    } else {
      // Centre inside the box: leave by the shallowest face.
      const left = px - box.minX;
      const right = box.maxX - px;
      const top = pz - box.minZ;
      const bottom = box.maxZ - pz;
      const min = Math.min(left, right, top, bottom);
      if (min === left) px = box.minX - radius;
      else if (min === right) px = box.maxX + radius;
      else if (min === top) pz = box.minZ - radius;
      else pz = box.maxZ + radius;
    }
  }
  const limit = CITY.extent + 42;
  px = Math.max(-limit, Math.min(limit, px));
  pz = Math.max(-limit, Math.min(limit, pz));
  return { x: px, z: pz };
}
