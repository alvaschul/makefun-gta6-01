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

/** Soft radial glow texture shared by lamp heads, signs and light sprites. */
export function makeGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.45)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

/** Puff texture for exhaust and tyre smoke sprites. */
export function makeSmokeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, "rgba(255,255,255,0.85)");
  grad.addColorStop(0.55, "rgba(255,255,255,0.38)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

/** Sprites must never intercept the shooting raycast in main.js. */
export function makeGlowSprite(texture, color, scale, opacity) {
  const mat = new THREE.SpriteMaterial({
    map: texture, color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scale, scale, 1);
  sprite.raycast = () => {};
  return sprite;
}

/**
 * One building facade variant: a day map (painted frontage with glass
 * windows) plus an emissive map holding only the windows that light up
 * after dark, so dusk turns whole streets on at once.
 */
function makeWindowVariant(rng, toneHex) {
  const W2 = 128, H2 = 256, cols = 7, rows = 15;
  const tone = new THREE.Color(toneHex);
  const mapCanvas = document.createElement("canvas");
  mapCanvas.width = W2; mapCanvas.height = H2;
  const mctx = mapCanvas.getContext("2d");
  const grad = mctx.createLinearGradient(0, 0, 0, H2);
  grad.addColorStop(0, `#${tone.clone().multiplyScalar(1.06).getHexString()}`);
  grad.addColorStop(1, `#${tone.clone().multiplyScalar(0.82).getHexString()}`);
  mctx.fillStyle = grad;
  mctx.fillRect(0, 0, W2, H2);
  const emCanvas = document.createElement("canvas");
  emCanvas.width = W2; emCanvas.height = H2;
  const ectx = emCanvas.getContext("2d");
  ectx.fillStyle = "#000000";
  ectx.fillRect(0, 0, W2, H2);
  const cw = W2 / cols, ch = H2 / rows;
  const warm = ["#ffd9a0", "#ffc06a", "#ffab4a", "#ffe3b3"];
  for (let cx = 0; cx < cols; cx++) {
    for (let cy = 0; cy < rows; cy++) {
      const x = cx * cw + cw * 0.22, y = cy * ch + ch * 0.24;
      const w = cw * 0.56, h = ch * 0.5;
      const shade = 0.75 + rng.next() * 0.5;
      const glass = new THREE.Color(0x2a3d4d).multiplyScalar(shade);
      if (rng.chance(0.12)) glass.set(0x51748c).multiplyScalar(shade);
      mctx.fillStyle = `#${glass.getHexString()}`;
      mctx.fillRect(x, y, w, h);
      const roll = rng.next();
      if (roll < 0.34) {
        ectx.fillStyle = warm[Math.floor(rng.next() * warm.length)];
        ectx.fillRect(x, y, w, h);
      } else if (roll < 0.44) {
        ectx.fillStyle = "#cfe8ff";
        ectx.fillRect(x, y, w, h);
      }
    }
  }
  const map = new THREE.CanvasTexture(mapCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const emissiveMap = new THREE.CanvasTexture(emCanvas);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.anisotropy = 4;
  const mat = new THREE.MeshLambertMaterial({
    map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 0,
  });
  const roofMat = new THREE.MeshLambertMaterial({
    color: tone.clone().multiplyScalar(0.62).getHex(),
  });
  return { mat, roofMat };
}

const NEON_WORDS = [
  ["HOTEL", "#ff4d8d"], ["BAR", "#37e0d8"], ["RAMEN", "#ffc857"],
  ["24H MART", "#7dff9a"], ["DISCO", "#b45cff"], ["KARAOKE", "#ff4d8d"],
  ["TATTOO", "#37e0d8"], ["CASINO", "#ffc857"], ["SURF SHACK", "#37e0d8"],
  ["NOODLE BAR", "#ff8a3d"], ["PIZZERIA", "#7dff9a"], ["AZURA INN", "#6db3ff"],
];

function makeNeonSignTexture(text, colorCss) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.strokeStyle = colorCss;
  ctx.shadowColor = colorCss;
  ctx.shadowBlur = 18;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(14, 14, 484, 100, 26);
  ctx.stroke();
  ctx.font = "bold 58px Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowBlur = 26;
  ctx.fillStyle = colorCss;
  ctx.fillText(text, 256, 66);
  ctx.shadowBlur = 8;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeTagTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.save();
  ctx.translate(256, 140);
  ctx.rotate(-0.045);
  // crown doodle
  ctx.fillStyle = "#ffc857";
  ctx.shadowColor = "#ff8a3d";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(-58, -58); ctx.lineTo(-58, -96); ctx.lineTo(-28, -74);
  ctx.lineTo(0, -104); ctx.lineTo(28, -74); ctx.lineTo(58, -96);
  ctx.lineTo(58, -58); ctx.closePath(); ctx.fill();
  ctx.font = "900 64px Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#ff7f45";
  ctx.shadowColor = "#ff5722";
  ctx.shadowBlur = 14;
  ctx.fillText("CORAL KINGS", 0, 12);
  ctx.font = "bold 30px Trebuchet MS, sans-serif";
  ctx.fillStyle = "#ffd9a0";
  ctx.shadowBlur = 8;
  ctx.fillText("AZURA TURF", 0, 58);
  ctx.restore();
  // spray splatter, deterministic so every capture matches
  ctx.fillStyle = "rgba(255,127,69,0.75)";
  for (let i = 0; i < 46; i++) {
    const a = Math.sin(i * 127.1) * 43758.5453;
    const b = Math.sin(i * 311.7) * 12543.123;
    const x = 256 + (a - Math.floor(a) - 0.5) * 470;
    const y = 140 + (b - Math.floor(b) - 0.5) * 220;
    ctx.beginPath();
    ctx.arc(x, y, 1.5 + (i % 4), 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeCrosswalkTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const bar = (x, y, w, h, i) => {
    ctx.fillStyle = `rgba(238,238,230,${0.62 + 0.16 * Math.sin(i * 2.3)})`;
    ctx.fillRect(x, y, w, h);
  };
  let i = 0;
  for (let s = 0; s < 5; s++) {
    const x = 22 + s * 46;
    bar(x, 6, 24, 52, i++);       // north zebra
    bar(x, 198, 24, 52, i++);     // south zebra
    bar(6, x, 52, 24, i++);       // west zebra
    bar(198, x, 52, 24, i++);     // east zebra
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Gradient sky keyframes: day / sunset / night, blended by sun elevation. */
const SKY_KEYS = {
  day: {
    top: new THREE.Color(0x2e6cd2), mid: new THREE.Color(0x7fb6e8),
    horizon: new THREE.Color(0xd8f1f2), bottom: new THREE.Color(0x2a5a70),
    sun: new THREE.Color(0xfff3d0), deep: new THREE.Color(0x0d4a63),
  },
  sunset: {
    top: new THREE.Color(0x2a1a5e), mid: new THREE.Color(0xe0447c),
    horizon: new THREE.Color(0xff8a3d), bottom: new THREE.Color(0x16324a),
    sun: new THREE.Color(0xff9448), deep: new THREE.Color(0x14384f),
  },
  night: {
    top: new THREE.Color(0x030612), mid: new THREE.Color(0x0a1434),
    horizon: new THREE.Color(0x16294f), bottom: new THREE.Color(0x050a18),
    sun: new THREE.Color(0x8fa5cc), deep: new THREE.Color(0x04101f),
  },
};

function blendSkyKey(target, e) {
  const toSunset = THREE.MathUtils.smoothstep(e, -0.14, 0.03);
  const toDay = THREE.MathUtils.smoothstep(e, 0.07, 0.4);
  for (const part of ["top", "mid", "horizon", "bottom", "sun", "deep"]) {
    target[part].copy(SKY_KEYS.night[part])
      .lerp(SKY_KEYS.sunset[part], toSunset)
      .lerp(SKY_KEYS.day[part], toDay);
  }
  return target;
}

export function buildCity(scene, rng) {
  const group = new THREE.Group();
  scene.add(group);
  const colliders = [];
  const landmarks = new Map();
  const lampHeads = [];
  const windowMats = [];

  // --- sky, lights -------------------------------------------------------
  // Gradient dome: deep indigo up top, a pink band, then a hot horizon,
  // with the sun's disc and halo drawn in-shader. Colours are keyframed
  // day / sunset / night in update() from the sun's elevation.
  const skyUniforms = {
    topColor: { value: new THREE.Color(0x2e6cd2) },
    midColor: { value: new THREE.Color(0x7fb6e8) },
    horizonColor: { value: new THREE.Color(0xd8f1f2) },
    bottomColor: { value: new THREE.Color(0x2a5a70) },
    sunDir: { value: new THREE.Vector3(0, 1, 0) },
    sunColor: { value: new THREE.Color(0xfff3d0) },
  };
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 topColor; uniform vec3 midColor; uniform vec3 horizonColor;
      uniform vec3 bottomColor; uniform vec3 sunDir; uniform vec3 sunColor;
      varying vec3 vDir;
      void main() {
        vec3 dir = normalize(vDir);
        float h = dir.y;
        vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.22, h));
        col = mix(col, topColor, smoothstep(0.16, 0.62, h));
        if (h < 0.0) col = mix(horizonColor, bottomColor, smoothstep(0.0, -0.25, h));
        float s = max(dot(dir, normalize(sunDir)), 0.0);
        col += sunColor * (pow(s, 350.0) * 1.3 + pow(s, 20.0) * 0.38 + pow(s, 4.0) * 0.10);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1600, 24, 16), skyMat);
  group.add(sky);
  const glowTex = makeGlowTexture();
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x3a4a3a, 0.9);
  scene.add(hemi);
  // a whisper of ambient so sunset building shadows stay readable
  // instead of crushing to black under the tone mapping
  scene.add(new THREE.AmbientLight(0x93a7c4, 0.26));
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
  sun.position.set(120, 220, 60);
  // one cheap shadow map for the whole bay: buildings and cars throw
  // long sunset shadows, everything else just receives them
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -300;
  sun.shadow.camera.right = 300;
  sun.shadow.camera.top = 300;
  sun.shadow.camera.bottom = -300;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 1600;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 1.2;
  scene.add(sun);
  scene.fog = new THREE.Fog(CFG.palette.fogDay, 180, 900);

  // --- ground, roads, beach, water --------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(W.span + 500, W.span + 500),
    new THREE.MeshLambertMaterial({ color: 0x4a5548 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.06;
  ground.receiveShadow = true;
  group.add(ground);

  const asphaltMat = new THREE.MeshLambertMaterial({ color: CFG.palette.asphalt });
  for (let k = 0; k <= W.blocksPerSide; k++) {
    const c = roadCenter(k);
    const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(W.roadWidth, W.span), asphaltMat);
    vRoad.rotation.x = -Math.PI / 2;
    vRoad.position.set(c, 0.01, 0);
    vRoad.receiveShadow = true;
    group.add(vRoad);
    const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(W.span, W.roadWidth), asphaltMat);
    hRoad.rotation.x = -Math.PI / 2;
    hRoad.position.set(0, 0.012, c);
    hRoad.receiveShadow = true;
    group.add(hRoad);
    // dashed centre line (Lambert, so the paint shades with the light
    // instead of glowing flat-yellow after dark)
    const dashMat = new THREE.MeshLambertMaterial({ color: 0x9a8f5c });
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

  // zebra crossings on every junction, one shared worn-paint texture
  const crossMat = new THREE.MeshLambertMaterial({
    map: makeCrosswalkTexture(), transparent: true, depthWrite: false,
  });
  for (let kx = 0; kx <= W.blocksPerSide; kx++) {
    for (let kz = 0; kz <= W.blocksPerSide; kz++) {
      const cross = new THREE.Mesh(new THREE.PlaneGeometry(W.roadWidth + 1, W.roadWidth + 1), crossMat);
      cross.rotation.x = -Math.PI / 2;
      cross.position.set(roadCenter(kx), 0.02, roadCenter(kz));
      cross.receiveShadow = true;
      group.add(cross);
    }
  }

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(W.beachWidth, W.span + 200),
    new THREE.MeshLambertMaterial({ color: CFG.palette.sand })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(W.half + W.beachWidth / 2, 0.005, 0);
  sand.receiveShadow = true;
  group.add(sand);

  // The bay: a shader sheet with travelling waves, a fresnel lift from
  // the sky colour and a glittering sun streak. Fog is mixed manually
  // from the scene fog values, which update() mirrors every frame.
  const waterUniforms = {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(0xfff3d0) },
    uSky: { value: new THREE.Color(0xd8f1f2) },
    uDeep: { value: new THREE.Color(CFG.palette.water) },
    uFogColor: { value: new THREE.Color(CFG.palette.fogDay) },
    uFogNear: { value: 180 },
    uFogFar: { value: 900 },
  };
  const waterMat = new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    transparent: true,
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorld;
      varying float vFogDepth;
      void main() {
        vec3 pos = position;
        pos.z += sin(pos.x * 0.10 + uTime * 1.15) * 0.13
               + cos(pos.y * 0.085 + uTime * 0.8) * 0.11;
        vec4 world = modelMatrix * vec4(pos, 1.0);
        vWorld = world.xyz;
        vec4 mv = viewMatrix * world;
        vFogDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uSunDir; uniform vec3 uSunColor;
      uniform vec3 uSky; uniform vec3 uDeep;
      uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
      varying vec3 vWorld;
      varying float vFogDepth;
      void main() {
        float nx = sin(vWorld.x * 0.32 + uTime * 1.25) * 0.5
                 + sin(vWorld.x * 0.083 - uTime * 0.6) * 0.5;
        float nz = cos(vWorld.z * 0.29 - uTime * 1.05) * 0.5
                 + cos(vWorld.z * 0.071 + uTime * 0.5) * 0.5;
        vec3 n = normalize(vec3(nx * 0.14, 1.0, nz * 0.14));
        vec3 viewDir = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(viewDir, n), 0.0), 2.0);
        vec3 col = mix(uDeep, uSky, 0.22 + fres * 0.5);
        vec3 refl = reflect(-viewDir, n);
        float spec = pow(max(dot(refl, normalize(uSunDir)), 0.0), 110.0);
        float glitter = pow(max(dot(refl, normalize(uSunDir)), 0.0), 9.0);
        col += uSunColor * (spec * 1.5 + glitter * 0.10);
        float fogF = smoothstep(uFogNear, uFogFar, vFogDepth);
        col = mix(col, uFogColor, fogF);
        gl_FragColor = vec4(col, 0.94);
      }`,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(700, W.span + 600, 48, 48), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(W.half + W.beachWidth + 350, W.waterLevel, 0);
  group.add(water);

  // --- blocks: sidewalks, buildings, landmarks ---------------------------
  const landmarkByBlock = new Map(LANDMARK_LAYOUT.map((l) => [`${l.bx},${l.bz}`, l]));
  const sidewalkMat = new THREE.MeshLambertMaterial({ color: CFG.palette.sidewalk });
  // six shared facade variants; their emissive maps are what update()
  // fades up after dark, and windowMats keeps the list it drives
  const winVariants = [];
  for (let v = 0; v < 6; v++) {
    const variant = makeWindowVariant(rng, CFG.palette.buildingTones[v % CFG.palette.buildingTones.length]);
    winVariants.push(variant);
    windowMats.push(variant.mat);
  }
  const tagTex = makeTagTexture();

  for (let bx = 0; bx < W.blocksPerSide; bx++) {
    for (let bz = 0; bz < W.blocksPerSide; bz++) {
      const cx = blockCenter(bx);
      const cz = blockCenter(bz);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(W.blockSize + 4, 0.24, W.blockSize + 4), sidewalkMat);
      slab.position.set(cx, 0.12, cz);
      slab.receiveShadow = true;
      group.add(slab);

      const landmark = landmarkByBlock.get(`${bx},${bz}`);
      if (landmark) {
        const name = NAMES.landmarks[landmark.id];
        const lv = winVariants[(bx + bz * 2) % winVariants.length];
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(W.blockSize - 14, landmark.height, W.blockSize - 18),
          [lv.mat, lv.mat, lv.roofMat, lv.roofMat, lv.mat, lv.mat]
        );
        body.position.set(cx, landmark.height / 2 + 0.2, cz);
        body.castShadow = true;
        body.receiveShadow = true;
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
          const px = cx + qx * (W.blockSize / 4);
          const pz = cz + qz * (W.blockSize / 4);
          const variant = winVariants[rng.int(0, winVariants.length - 1)];
          const tower = new THREE.Mesh(
            new THREE.BoxGeometry(bw, bh, bd),
            [variant.mat, variant.mat, variant.roofMat, variant.roofMat, variant.mat, variant.mat]
          );
          tower.position.set(px, bh / 2 + 0.2, pz);
          tower.castShadow = true;
          tower.receiveShadow = true;
          group.add(tower);
          colliders.push({ minX: px - bw / 2, maxX: px + bw / 2, minZ: pz - bd / 2, maxZ: pz + bd / 2 });

          // street dressing on the outward face: a neon sign for some
          // towers, a Coral Kings turf tag sprayed low on others
          const onXFace = rng.chance(0.5);
          const face = onXFace
            ? { x: px + qx * (bw / 2 + 0.14), z: pz, rotY: qx * Math.PI / 2 }
            : { x: px, z: pz + qz * (bd / 2 + 0.14), rotY: qz > 0 ? 0 : Math.PI };
          if (rng.chance(0.40)) {
            const [word, colorCss] = rng.pick(NEON_WORDS);
            const sw = 3.4 + word.length * 0.92;
            const sign = new THREE.Mesh(
              new THREE.PlaneGeometry(sw, 2.5),
              new THREE.MeshBasicMaterial({ map: makeNeonSignTexture(word, colorCss), transparent: true })
            );
            sign.position.set(face.x, Math.min(bh - 2.4, 8 + rng.range(0, 7)) + 0.2, face.z);
            sign.rotation.y = face.rotY;
            group.add(sign);
            const halo = makeGlowSprite(glowTex, new THREE.Color(colorCss), sw * 1.7, 0.30);
            halo.position.set(
              face.x + Math.sin(face.rotY) * 0.35, sign.position.y,
              face.z + Math.cos(face.rotY) * 0.35
            );
            halo.scale.y = 4.2;
            group.add(halo);
          } else if (rng.chance(0.10)) {
            const tag = new THREE.Mesh(
              new THREE.PlaneGeometry(6.6, 3.3),
              new THREE.MeshBasicMaterial({ map: tagTex, transparent: true })
            );
            tag.position.set(face.x, 2.9, face.z);
            tag.rotation.y = face.rotY;
            group.add(tag);
          }
        }
      }
    }
  }

  // --- palms and lamps -----------------------------------------------------
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5c38 });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2e8b57 });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x39404a });
  // one shared material for every lamp halo: update() fades them all in
  // together as night falls
  const lampGlowMat = new THREE.SpriteMaterial({
    map: glowTex, color: 0xffbe78, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
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
        const halo = new THREE.Sprite(lampGlowMat);
        halo.scale.set(4.6, 4.6, 1);
        halo.position.set(lx, 6.5, lz);
        halo.raycast = () => {};
        group.add(halo);
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

  const skyNow = {
    top: new THREE.Color(), mid: new THREE.Color(), horizon: new THREE.Color(),
    bottom: new THREE.Color(), sun: new THREE.Color(), deep: new THREE.Color(),
  };
  const white = new THREE.Color(0xffffff);
  let skyFlash = 0; // lightning brightness, set via setSkyFlash()

  /** Advance sun, sky, fog and lamp/window glow for the given hour 0..24. */
  function update(hour, dt) {
    const angle = ((hour - 6) / 12) * Math.PI; // sunrise 06:00, sunset 18:00
    const elevation = Math.sin(angle);
    const sunX = Math.cos(angle) * 500;
    sun.position.set(sunX, Math.max(elevation, -0.25) * 480 + 30, 180);
    const daylight = THREE.MathUtils.clamp(elevation * 1.6 + 0.25, 0, 1);
    const night = 1 - daylight;
    sun.intensity = 0.12 + daylight * 1.5;
    sun.castShadow = elevation > -0.05; // no sun shadows once it has set
    hemi.intensity = 0.44 + daylight * 0.7;

    blendSkyKey(skyNow, elevation);
    if (skyFlash > 0) {
      for (const part of ["top", "mid", "horizon", "bottom"]) {
        skyNow[part].lerp(white, skyFlash * 0.3);
      }
    }
    skyUniforms.topColor.value.copy(skyNow.top);
    skyUniforms.midColor.value.copy(skyNow.mid);
    skyUniforms.horizonColor.value.copy(skyNow.horizon);
    skyUniforms.bottomColor.value.copy(skyNow.bottom);
    skyUniforms.sunColor.value.copy(skyNow.sun);
    skyUniforms.sunDir.value.copy(sun.position).normalize();
    sun.color.copy(skyNow.sun);
    hemi.color.copy(skyNow.mid).lerp(white, 0.35);
    hemi.groundColor.setHex(0x4a3428).lerp(skyNow.bottom, 0.4);
    // fog wears the horizon colour so the city melts into the sky,
    // pink-orange at dusk, and the water mirrors the same values
    if (scene.fog) {
      scene.fog.color.copy(skyNow.horizon).lerp(skyNow.mid, 0.15);
      waterUniforms.uFogColor.value.copy(scene.fog.color);
      waterUniforms.uFogNear.value = scene.fog.near;
      waterUniforms.uFogFar.value = scene.fog.far;
    }
    waterUniforms.uTime.value = performance.now() / 1000;
    waterUniforms.uSunDir.value.copy(sun.position).normalize();
    waterUniforms.uSunColor.value.copy(skyNow.sun);
    waterUniforms.uSky.value.copy(skyNow.horizon);
    waterUniforms.uDeep.value.copy(skyNow.deep);

    for (const m of lampHeads) m.color.setHex(night > 0.35 ? 0xffd98a : 0x554f38);
    lampGlowMat.opacity = THREE.MathUtils.clamp((night - 0.3) / 0.7, 0, 1) * 0.55;
    for (const m of windowMats) m.emissiveIntensity = night * 1.25;
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
    /** Lightning hook: main.js feeds the weather flash in each frame. */
    setSkyFlash(v) { skyFlash = v; },
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
