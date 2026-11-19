// NEON HARBOR v2 — Azura Bay city builder.
// A 5x5 block grid with roads between blocks, procedural buildings with
// lit windows, eight signed landmarks, palms, lamps, a beach and the bay.
// Also owns the day/night cycle: sun, sky and lamp glow follow the clock.

import * as THREE from "three";
import { CFG, NAMES } from "./config.js";

const W = CFG.world;

/** Centre coordinate of road k (0..blocksPerSide) on one axis. */
export function roadCenter(k) {
  return -W.half + W.roadWidth / 2 + k * W.pitch;
}

/** Centre coordinate of block i (0..blocksPerSide-1) on one axis. */
export function blockCenter(i) {
  return -W.half + W.roadWidth + W.blockSize / 2 + i * W.pitch;
}

/** True when (x, z) sits on asphalt rather than on a block. */
export function isOnRoad(x, z) {
  const local = (v) => {
    const shifted = v + W.half;
    const mod = ((shifted % W.pitch) + W.pitch) % W.pitch;
    return mod < W.roadWidth;
  };
  return local(x) || local(z);
}

const LANDMARK_LAYOUT = [
  { id: "motel", bx: 0, bz: 1, color: 0xff8fab, height: 14 },
  { id: "diner", bx: 2, bz: 2, color: 0xffc857, height: 8 },
  { id: "club", bx: 4, bz: 1, color: 0xb45cff, height: 18 },
  { id: "garage", bx: 1, bz: 4, color: 0x7f8c9b, height: 9 },
  { id: "arms", bx: 3, bz: 4, color: 0x5f7052, height: 10 },
  { id: "wash", bx: 4, bz: 3, color: 0x37b8e0, height: 7 },
  { id: "hospital", bx: 0, bz: 3, color: 0xf2f2f2, height: 22 },
  { id: "precinct", bx: 2, bz: 0, color: 0x3a5a9c, height: 16 },
];

function box(w, h, d, color, opts = {}) {
  const mat = new THREE.MeshLambertMaterial({
    color,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.y = opts.y ?? h / 2;
  return mesh;
}

function makeSignTexture(text, colorCss) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#10131c";
  ctx.fillRect(0, 0, 512, 96);
  ctx.font = "bold 44px Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = colorCss;
  ctx.shadowColor = colorCss;
  ctx.shadowBlur = 16;
  ctx.fillText(text.toUpperCase(), 256, 50);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

export function buildCity(scene, rng) {
  const group = new THREE.Group();
  scene.add(group);
  const colliders = [];
  const landmarks = new Map();
  const lampHeads = [];
  const windowMats = [];

  // --- sky, lights -------------------------------------------------------
  const skyMat = new THREE.MeshBasicMaterial({ color: CFG.palette.skyDay, side: THREE.BackSide });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1600, 18, 12), skyMat);
  group.add(sky);
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x3a4a3a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
  sun.position.set(120, 220, 60);
  scene.add(sun);
  scene.fog = new THREE.Fog(CFG.palette.fogDay, 180, 900);

  // --- ground, roads, beach, water --------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(W.span + 500, W.span + 500),
    new THREE.MeshLambertMaterial({ color: 0x4a5548 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.06;
  group.add(ground);

  const asphaltMat = new THREE.MeshLambertMaterial({ color: CFG.palette.asphalt });
  for (let k = 0; k <= W.blocksPerSide; k++) {
    const c = roadCenter(k);
    const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(W.roadWidth, W.span), asphaltMat);
    vRoad.rotation.x = -Math.PI / 2;
    vRoad.position.set(c, 0.01, 0);
    group.add(vRoad);
    const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(W.span, W.roadWidth), asphaltMat);
    hRoad.rotation.x = -Math.PI / 2;
    hRoad.position.set(0, 0.012, c);
    group.add(hRoad);
    // dashed centre line
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8d24a });
    for (let d = -W.half + 8; d < W.half - 4; d += 12) {
      const dashV = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 5), dashMat);
      dashV.rotation.x = -Math.PI / 2;
      dashV.position.set(c, 0.03, d);
      group.add(dashV);
      const dashH = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.5), dashMat);
      dashH.rotation.x = -Math.PI / 2;
      dashH.position.set(d, 0.03, c);
      group.add(dashH);
    }
  }

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(W.beachWidth, W.span + 200),
    new THREE.MeshLambertMaterial({ color: CFG.palette.sand })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(W.half + W.beachWidth / 2, 0.005, 0);
  group.add(sand);

  const waterMat = new THREE.MeshLambertMaterial({
    color: CFG.palette.water, transparent: true, opacity: 0.88,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(700, W.span + 600), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(W.half + W.beachWidth + 350, W.waterLevel, 0);
  group.add(water);

  // --- blocks: sidewalks, buildings, landmarks ---------------------------
  const landmarkByBlock = new Map(LANDMARK_LAYOUT.map((l) => [`${l.bx},${l.bz}`, l]));
  const sidewalkMat = new THREE.MeshLambertMaterial({ color: CFG.palette.sidewalk });

  for (let bx = 0; bx < W.blocksPerSide; bx++) {
    for (let bz = 0; bz < W.blocksPerSide; bz++) {
      const cx = blockCenter(bx);
      const cz = blockCenter(bz);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(W.blockSize + 4, 0.24, W.blockSize + 4), sidewalkMat);
      slab.position.set(cx, 0.12, cz);
      group.add(slab);

      const landmark = landmarkByBlock.get(`${bx},${bz}`);
      if (landmark) {
        const name = NAMES.landmarks[landmark.id];
        const body = box(W.blockSize - 14, landmark.height, W.blockSize - 18,
          landmark.id === "hospital" ? 0xeef1f4 : 0x9aa4b0);
        body.position.set(cx, landmark.height / 2 + 0.2, cz);
        group.add(body);
        colliders.push({ minX: cx - (W.blockSize - 14) / 2, maxX: cx + (W.blockSize - 14) / 2, minZ: cz - (W.blockSize - 18) / 2, maxZ: cz + (W.blockSize - 18) / 2 });
        // coloured roof band + canvas sign facing the south road
        const band = box(W.blockSize - 12, 1.1, W.blockSize - 16, landmark.color,
          { emissive: landmark.color, emissiveIntensity: 0.55 });
        band.position.set(cx, landmark.height + 0.4, cz);
        group.add(band);
        const signTex = makeSignTexture(name, `#${landmark.color.toString(16).padStart(6, "0")}`);
        const sign = new THREE.Mesh(
          new THREE.PlaneGeometry(30, 5.6),
          new THREE.MeshBasicMaterial({ map: signTex })
        );
        sign.position.set(cx, landmark.height - 1.6, cz + (W.blockSize - 18) / 2 + 0.15);
        group.add(sign);
        const door = { x: cx, z: cz + W.blockSize / 2 + 5 };
        landmarks.set(landmark.id, { id: landmark.id, name, x: cx, z: cz, door, color: landmark.color });
        continue;
      }

      // ordinary block: 2x2 towers of varied height with lit windows
      for (let qx = -1; qx <= 1; qx += 2) {
        for (let qz = -1; qz <= 1; qz += 2) {
          if (rng.chance(0.14)) continue; // occasional empty lot
          const bw = rng.range(15, 23);
          const bd = rng.range(15, 23);
          const bh = rng.range(10, 52) * (bx === 2 && bz === 2 ? 1.35 : 1);
          const tone = rng.pick(CFG.palette.buildingTones);
          const px = cx + qx * (W.blockSize / 4);
          const pz = cz + qz * (W.blockSize / 4);
          const tower = box(bw, bh, bd, tone);
          tower.position.set(px, bh / 2 + 0.2, pz);
          group.add(tower);
          colliders.push({ minX: px - bw / 2, maxX: px + bw / 2, minZ: pz - bd / 2, maxZ: pz + bd / 2 });
          const winMat = new THREE.MeshBasicMaterial({ color: 0x2c3844 });
          windowMats.push(winMat);
          const wins = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.15, bh * 0.82, bd + 0.15),
            winMat);
          wins.position.set(px, bh * 0.48 + 0.2, pz);
          wins.scale.set(0.82, 1, 0.82);
          group.add(wins);
        }
      }
    }
  }

  // --- palms and lamps -----------------------------------------------------
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5c38 });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2e8b57 });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x39404a });
  for (let k = 0; k <= W.blocksPerSide; k++) {
    for (let d = -W.half + 26; d < W.half; d += 52) {
      for (const axis of ["x", "z"]) {
        const lx = axis === "x" ? roadCenter(k) + W.roadWidth / 2 + 1.6 : d;
        const lz = axis === "x" ? d : roadCenter(k) + W.roadWidth / 2 + 1.6;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 6.4, 6), lampMat);
        pole.position.set(lx, 3.2, lz);
        group.add(pole);
        const headMat = new THREE.MeshBasicMaterial({ color: 0x554f38 });
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), headMat);
        head.position.set(lx, 6.5, lz);
        group.add(head);
        lampHeads.push(headMat);
      }
      // palms along the beach and scattered on sidewalks
      if (rng.chance(0.75)) {
        const px = W.half + rng.range(6, W.beachWidth - 8);
        const pz = d + rng.range(-8, 8);
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 6.8, 6), trunkMat);
        trunk.position.set(px, 3.4, pz);
        trunk.rotation.z = rng.range(-0.08, 0.08);
        group.add(trunk);
        const crown = new THREE.Mesh(new THREE.SphereGeometry(2.3, 7, 5), frondMat);
        crown.scale.y = 0.45;
        crown.position.set(px, 7.1, pz);
        group.add(crown);
      }
    }
  }

  const daySky = new THREE.Color(CFG.palette.skyDay);
  const nightSky = new THREE.Color(CFG.palette.skyNight);
  const duskSky = new THREE.Color(CFG.palette.skyDusk);
  const tmpColor = new THREE.Color();

  /** Advance sun, sky, fog and lamp/window glow for the given hour 0..24. */
  function update(hour, dt) {
    const angle = ((hour - 6) / 12) * Math.PI; // sunrise 06:00, sunset 18:00
    const elevation = Math.sin(angle);
    const sunX = Math.cos(angle) * 500;
    sun.position.set(sunX, Math.max(elevation, -0.25) * 480 + 30, 180);
    const daylight = THREE.MathUtils.clamp(elevation * 1.6 + 0.25, 0, 1);
    sun.intensity = 0.12 + daylight * 1.5;
    hemi.intensity = 0.25 + daylight * 0.7;
    if (elevation > 0.25) tmpColor.copy(daySky);
    else if (elevation > -0.12) tmpColor.copy(duskSky).lerp(daySky, (elevation + 0.12) / 0.37);
    else tmpColor.copy(nightSky);
    if (elevation <= 0.25 && elevation > -0.12) tmpColor.lerp(duskSky, 0.35);
    skyMat.color.copy(tmpColor);
    if (scene.fog) scene.fog.color.copy(tmpColor).lerp(new THREE.Color(0x888888), 0.25);
    const night = 1 - daylight;
    for (const m of lampHeads) m.color.setHex(night > 0.35 ? 0xffd98a : 0x554f38);
    for (const m of windowMats) m.color.setHex(night > 0.3 ? 0xffca7a : 0x2c3844);
    water.position.y = W.waterLevel + Math.sin(performance.now() * 0.0006) * 0.12;
    return { daylight, night };
  }

  return {
    group,
    colliders,
    landmarks,
    update,
    sun,
    hemi,
    skyMat,
    /** Clamp a position inside the playable city + beach area. */
    clampToWorld(pos) {
      pos.x = THREE.MathUtils.clamp(pos.x, -W.half - 6, W.half + W.beachWidth - 2);
      pos.z = THREE.MathUtils.clamp(pos.z, -W.half - 6, W.half + 6);
      return pos;
    },
    /** Push a circle (x, z, r) out of every building AABB. Returns true if pushed. */
    resolveCollisions(pos, r) {
      let hit = false;
      for (const c of colliders) {
        const nx = THREE.MathUtils.clamp(pos.x, c.minX, c.maxX);
        const nz = THREE.MathUtils.clamp(pos.z, c.minZ, c.maxZ);
        const dx = pos.x - nx;
        const dz = pos.z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          hit = true;
          if (d2 > 0.0001) {
            const d = Math.sqrt(d2);
            pos.x = nx + (dx / d) * r;
            pos.z = nz + (dz / d) * r;
          } else {
            // centre inside the box: exit through the nearest face
            const left = pos.x - c.minX, right = c.maxX - pos.x;
            const top = pos.z - c.minZ, bottom = c.maxZ - pos.z;
            const m = Math.min(left, right, top, bottom);
            if (m === left) pos.x = c.minX - r;
            else if (m === right) pos.x = c.maxX + r;
            else if (m === top) pos.z = c.minZ - r;
            else pos.z = c.maxZ + r;
          }
        }
      }
      return hit;
    },
  };
}

export function findLandmark(city, id) {
  return city.landmarks.get(id) ?? null;
}
