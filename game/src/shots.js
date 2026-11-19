// NEON HARBOR v2 — screenshot staging for the four hand-in stills.
// Each scene is posed with the game's own systems (real cars, real
// police, real gang members, real HUD) and only then flags readiness.
// Nothing here draws or fakes a frame; it arranges a playable moment.

import { CFG } from "./config.js";
import { roadCenter } from "./city.js";

function avenueZ() {
  // the central east-west avenue: road index 2 on the z axis
  return roadCenter(2);
}

function poseTitle(game) {
  game.setHour(17.6); // golden dusk over the bay
  game.weather.setFront("clear");
  const avenue = avenueZ();
  // Rio stands on the bay-side road looking back at downtown
  game.setPlayerOnFoot(CFG.world.half - 26, avenue + 3, -Math.PI / 2);
  game.setShotCamera(
    { x: CFG.world.half + 16, y: 9, z: avenue + 16 },
    { x: -40, y: 16, z: avenue - 10 }
  );
  game.hud.showPanel("title");
}

function poseChase(game) {
  game.setHour(17.25); // low sun, long shadows, lightbars lit
  game.weather.setFront("clear");
  game.startPlaying();
  const avenue = avenueZ();
  const car = game.vehicles.nearestParked(game.player.pos.x, game.player.pos.z, 500)
    || game.vehicles.traffic[0];
  game.moveVehicle(car, -70, avenue + 3.4, Math.PI / 2);
  game.enterVehicle(car);
  car.speed = 23;
  game.police.addPoints(CFG.wanted.thresholds[3]); // exactly three stars
  const copA = game.police.spawnCopCar(car.pos);
  game.moveVehicle(copA, -88, avenue - 3.4, Math.PI / 2);
  copA.speed = 21;
  const copB = game.police.spawnCopCar(car.pos);
  game.moveVehicle(copB, -97, avenue + 4.2, Math.PI / 2);
  copB.speed = 20;
  // Fixed camera ahead of the action, looking back west down the
  // avenue: the player car bears down on it with both cop cars in
  // frame behind. (The follow camera never shows the pursuers, and
  // its lerp from the title orbit has not settled in time.)
  game.setShotCamera(
    { x: -52, y: 5.5, z: avenue + 9 },
    { x: -78, y: 1.2, z: avenue + 1 }
  );
  const diner = game.city.landmarks.get("diner");
  game.setObjectiveOverride("Deliver the takings to Mama Lala's Diner", { x: diner.door.x, z: diner.door.z });
  game.hud.setWeapon("PISTOL");
  game.hud.setRadio("♪ Harbour FM");
}

function poseStreet(game) {
  game.setHour(17.7); // deep dusk: windows and lamps carry the street fight
  game.weather.setFront("clear");
  game.startPlaying();
  const diner = game.city.landmarks.get("diner");
  game.setPlayerOnFoot(diner.door.x - 3, diner.door.z + 6, Math.PI);
  game.givePistol();
  game.setAiming(true);
  const gang = game.crowd.spawnGang(diner.door.x + 4, diner.door.z + 13, 3);
  if (gang[0]) gang[0].damage(999); // one King already down
  for (const member of gang) {
    if (!member.dead) {
      member.angle = Math.atan2(game.player.pos.x - member.pos.x, game.player.pos.z - member.pos.z);
      member.aimPose();
    }
  }
  game.setObjectiveOverride("Clear the Coral Kings out of Toko Senjata Budi",
    game.city.landmarks.get("arms").door);
  game.hud.setWeapon("PISTOL");
}

function poseWash(game) {
  game.setHour(17.55); // dusk: neon and windows on at the wash
  game.weather.setFront("clear");
  game.startPlaying();
  const wash = game.city.landmarks.get("wash");
  const car = game.vehicles.nearestParked(wash.door.x, wash.door.z, 500)
    || game.vehicles.traffic[0];
  game.moveVehicle(car, wash.door.x, wash.door.z + 2, Math.PI);
  game.enterVehicle(car);
  car.speed = 0;
  game.police.addPoints(CFG.wanted.thresholds[2]); // exactly two stars
  game.setObjectiveOverride("Respray at Splash & Go to lose the heat", { x: wash.door.x, z: wash.door.z });
  game.hud.setPrompt(`<b>E</b> Respray — $${CFG.prices.respray} (clears wanted level)`);
}

const SCENES = { title: poseTitle, chase: poseChase, street: poseStreet, wash: poseWash };

export function stageShot(game, sceneName) {
  const pose = SCENES[sceneName] || SCENES.title;
  pose(game);
  // a couple of frames of simulation settle physics and HUD before capture
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.__shotReady = true;
    });
  });
}
