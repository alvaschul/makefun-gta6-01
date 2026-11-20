// weather.js — Azura Bay weather: dry dusk spells broken by tropical rain.
// Wetness is exported because driving grip reads it every physics step.

import * as THREE from "three";

export const weather = {
  kind: "clear",
  wetness: 0,
  timer: 45,
};

let sceneRef = null;
let rainPoints = null;
let rainVelocities = null;
let sunLight = null;
let hemiLight = null;
const RAIN_COUNT = 900;

export function initWeather(scene) {
  sceneRef = scene;
  scene.traverse((obj) => {
    if (obj.isDirectionalLight && !sunLight) sunLight = obj;
    if (obj.isHemisphereLight && !hemiLight) hemiLight = obj;
  });
  // Rain is a cloud of points recycled around the camera area (city centre
  // is fine for this game's scale); invisible while the sky is clear.
  const positions = new Float32Array(RAIN_COUNT * 3);
  rainVelocities = new Float32Array(RAIN_COUNT);
  for (let i = 0; i < RAIN_COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 220;
    positions[i * 3 + 1] = Math.random() * 60;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 220;
    rainVelocities[i] = 38 + Math.random() * 18;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0x9fc4e8,
    size: 0.55,
    transparent: true,
    opacity: 0,
  });
  rainPoints = new THREE.Points(geo, mat);
  rainPoints.frustumCulled = false;
  scene.add(rainPoints);
}

function applyAtmosphere() {
  if (!sceneRef) return;
  const wet = weather.wetness;
  if (sceneRef.fog) {
    sceneRef.fog.near = 260 - wet * 150;
    sceneRef.fog.far = 620 - wet * 300;
  }
  if (sunLight) sunLight.intensity = 1.15 - wet * 0.55;
  if (hemiLight) hemiLight.intensity = 0.55 - wet * 0.18;
  if (rainPoints) rainPoints.material.opacity = wet * 0.75;
}

export function updateWeather(dt) {
  weather.timer -= dt;
  if (weather.timer <= 0) {
    if (weather.kind === "clear") {
      weather.kind = "rain";
      weather.timer = 40 + Math.random() * 35;
    } else {
      weather.kind = "clear";
      weather.timer = 55 + Math.random() * 50;
    }
  }
  const target = weather.kind === "rain" ? 1 : 0;
  const rate = weather.kind === "rain" ? 0.25 : 0.12;
  if (weather.wetness < target) {
    weather.wetness = Math.min(target, weather.wetness + rate * dt);
  } else if (weather.wetness > target) {
    weather.wetness = Math.max(target, weather.wetness - rate * dt);
  }
  applyAtmosphere();
  // Animate rainfall only while there is any wetness in the air.
  if (rainPoints && weather.wetness > 0.02) {
    const pos = rainPoints.geometry.attributes.position;
    for (let i = 0; i < RAIN_COUNT; i++) {
      let y = pos.getY(i) - rainVelocities[i] * dt;
      if (y < 0) y = 55 + Math.random() * 8;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  }
}

// Force a state (used by screenshot staging for a dry, clear frame).
export function setWeather(kind) {
  weather.kind = kind;
  weather.wetness = kind === "rain" ? 1 : 0;
  weather.timer = 9999;
  applyAtmosphere();
}
