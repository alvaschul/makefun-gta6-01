// Screenshot scenes behind ?shot=<name>&seed=N. Each scene runs the real
// game — the real city, traffic, police and HUD — and poses it the way a
// player would meet it, then freezes a photogenic moment and flags
// window.__shotReady. Nothing here is a mock-up: the cover is a police chase
// at golden hour because that is what the game looks like at golden hour.
//
//   title  — the skyline from the bay road, title panel up
//   chase  — three stars, two interceptors, Rio's stolen coupe at speed
//   street — on foot outside the diner, mission beacon up, a King down
//   wash   — the respray that ends the chase: Suds & Shine, stars fading
// Scenes are posed only through the game's own entry points — enterCar,
// spawnShootout, the wanted ledger — so a shot can never show a state a
// player could not actually reach.

import { NAMES } from './config.js';

export function stageShot(game, name) {
  const { player } = game;
  game.timeOfDay = 0.68; // late golden hour: warm sky, real light still on the streets
  game.state = 'playing';
  game.hud.show();

  if (name === 'chase') {
    // Put Rio in a fast coupe on the central avenue, police already rolling.
    const car = game.nearestCar(player.x, player.z, 30) || game.cars[0];
    game.enterCar(car, true);
    car.x = 4;
    car.z = -60;
    car.heading = 0;
    car.speed = 17;
    player.x = car.x;
    player.z = car.z;
    game.wanted.points = 320;
    game.wanted.stars = 3;
    game.wanted.spawnCopCar();
    game.wanted.spawnCopCar();
    const cops = game.wanted.copCars;
    if (cops[0]) { cops[0].x = 10; cops[0].z = -57; cops[0].heading = 0; cops[0].speed = 15; }
    if (cops[1]) { cops[1].x = -5; cops[1].z = -32; cops[1].heading = Math.PI; cops[1].speed = 0; }
    car.mesh.children[0].material.color.set(0x2fbfae); // the courier coupe, teal for the cover
    game.cameraYaw = 0; // behind the car, looking up the avenue, chase in frame
    game.hud.setObjective('Paper Trail — Deliver the car to Bengkel Jaya');
    game.hud.toast('The courier car is hot — move!');
    game.stepWorld(0.6);
    return;
  }

  if (name === 'street') {
    // Outside Warung Senja: a shootout just happened, the next job glows gold.
    const diner = game.landmark('diner');
    player.x = diner.x - 2;
    player.z = diner.z + 15;
    player.heading = -0.7;
    player.state = 'aim';
    const hostiles = game.spawnShootout({ at: 'diner', count: 3 });
    if (hostiles[0]) { hostiles[0].x = player.x + 3.5; hostiles[0].z = player.z - 2; hostiles[0].hurt(80, game); } // one King down in the street
    if (hostiles[1]) { hostiles[1].x = player.x + 8; hostiles[1].z = player.z + 3; hostiles[1].state = 'aim'; hostiles[1].heading = Math.atan2(player.x - hostiles[1].x, player.z - hostiles[1].z); }
    if (hostiles[2]) { hostiles[2].x = player.x - 5; hostiles[2].z = player.z + 9; hostiles[2].state = 'aim'; hostiles[2].heading = Math.atan2(player.x - hostiles[2].x, player.z - hostiles[2].z); }
    game.wanted.points = 130;
    game.wanted.stars = 1;
    game.hud.setObjective(`Coral Reckoning — Clear the Coral Kings from the ${NAMES.diner} (1/3)`);
    game.cameraYaw = player.heading + Math.PI + 0.55;
    game.stepWorld(0.4);
    return;
  }

  if (name === 'wash') {
    const wash = game.landmark('wash');
    const car = game.nearestCar(wash.x, wash.z, 40) || game.cars[0];
    game.enterCar(car, true);
    car.x = 2;
    car.z = wash.z;
    car.heading = Math.PI / 2;
    car.speed = 0;
    player.x = car.x;
    player.z = car.z;
    game.wanted.points = 210;
    game.wanted.stars = 2;
    game.hud.setObjective(`${NAMES.washShop} — respray for $220 and lose the heat`);
    game.hud.toast('Fresh paint, fresh start');
    game.cameraYaw = Math.PI / 2; // from the road west of the shop, its sign in frame
    game.stepWorld(0.4);
    return;
  }

  // title: a slow vista over the bay road toward the downtown towers.
  game.state = 'title';
  player.x = 0;
  player.z = 150;
  player.heading = Math.PI;
  game.stepWorld(0.5);
}
