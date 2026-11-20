// shots.js — screenshot staging for NEON HARBOR.
// When the page URL carries ?shot=<name>, the game boots straight into a
// composed, frozen frame for that scene, hides the HUD, and sets
// window.__shotReady once the frame has rendered. Capture tooling waits
// for that flag, so screenshots are deterministic.

import * as THREE from "three";
import { createVehicle } from "./vehicles.js";
import { buildFigure } from "./people.js";
import { setWeather } from "./weather.js";

export function shotNameFromUrl() {
  try {
    return new URLSearchParams(window.location.search).get("shot");
  } catch (err) {
    return null;
  }
}

function placeCar(ctx, colorHex, kind, x, z, heading) {
  const mesh = createVehicle(colorHex, kind);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  ctx.scene.add(mesh);
  return mesh;
}

function placePerson(ctx, x, z, heading, shirt = 0xff5a7a) {
  const mesh = buildFigure(shirt);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  ctx.scene.add(mesh);
  return mesh;
}

function aimCamera(ctx, pos, look) {
  ctx.camera.position.set(pos.x, pos.y, pos.z);
  ctx.camera.lookAt(look.x, look.y, look.z);
  ctx.camera.updateProjectionMatrix();
}

export function initShots(ctx) {
  const name = shotNameFromUrl();
  if (!name) return false;
  setWeather("clear");
  document.body.classList.add("nh-shot-mode");
  const hudEl = document.querySelector(".nh-hud");
  if (hudEl) hudEl.style.display = "none";
  const titleEl = document.getElementById("nh-title");
  if (titleEl) titleEl.style.display = "none";

  const heroColor = 0xd94f6a;
  if (name === "title") {
    // Hero car angled on the harbour road, skyline behind it.
    placeCar(ctx, heroColor, "car", 236, -6, 0.7);
    placePerson(ctx, 233.4, -3.4, 2.2, 0x2ee6e6);
    aimCamera(ctx, { x: 228, y: 3.2, z: 6 }, { x: 238, y: 1.2, z: -10 });
    // Park the live player far away so nothing wanders into frame.
    ctx.parkPlayer?.(0, -300);
  } else if (name === "street") {
    placeCar(ctx, 0x3f7ad9, "car", -56, -80, 0);
    placeCar(ctx, 0xf2b134, "car", -62, -60, Math.PI);
    placePerson(ctx, -52.5, -70, -1.4, 0xf2b134);
    placePerson(ctx, -67, -66, 1.2, 0x7ad95a);
    ctx.parkPlayer?.(-60, -300);
    aimCamera(ctx, { x: -48, y: 2.1, z: -52 }, { x: -60, y: 1.4, z: -84 });
  } else if (name === "chase") {
    placeCar(ctx, heroColor, "car", 120, 30, 0.5);
    placeCar(ctx, 0xe8ecf2, "cop", 112, 16, 0.5);
    placeCar(ctx, 0xe8ecf2, "cop", 128, 14, 0.35);
    ctx.parkPlayer?.(0, -300);
    aimCamera(ctx, { x: 104, y: 4.5, z: 48 }, { x: 122, y: 1, z: 24 });
  } else if (name === "wash") {
    // Inside the Splash & Go respray bay: fresh paint, cyan arch glow.
    const wash = ctx.city.respray;
    placeCar(ctx, 0x2ee6e6, "car", wash.x, wash.z, 0);
    placePerson(ctx, wash.x + 4.5, wash.z + 3, -0.8, 0xe8e4da);
    ctx.parkPlayer?.(0, -300);
    aimCamera(
      ctx,
      { x: wash.x - 9, y: 3.4, z: wash.z + 11 },
      { x: wash.x, y: 1, z: wash.z }
    );
  } else {
    return false;
  }

  // Render a few frames so shadows and lights settle, then signal ready.
  let frames = 0;
  const settle = () => {
    ctx.renderer.render(ctx.scene, ctx.camera);
    frames++;
    if (frames < 6) requestAnimationFrame(settle);
    else window.__shotReady = true;
  };
  requestAnimationFrame(settle);
  return true;
}
