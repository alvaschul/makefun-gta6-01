// NEON HARBOR — the gta6-01 entry program (Node 22, standard library only).
// The game itself is this directory's game/ folder: plain static files a
// desktop browser plays offline (game/index.html, its ES modules and the
// vendored three.js build under game/vendor/). This program hands the game
// in: it copies game/ and screenshots/ from beside this file to /output and
// writes /output/dossier.json — the summary the judge reads — with
// buildDossier from the kit's vendor/makefun-game.ts, unchanged.
//
// NEON HARBOR is an original open-world crime game set in Azura Bay: a full
// city on foot and by car, live traffic and pedestrians, cars to steal, a
// five-star wanted level with police who chase, shoot and arrest, a pistol,
// a six-chapter story for Mama Lala against the Coral Kings, side courier
// work, a HUD with a live minimap, a day that turns to night, synthesised
// sound and radio, and a save that survives the visit.
//
// The expansion pass, in brief. Weather (game/src/weather.js): a slow front
// system cycles clear skies into overcast, rain and full storms, with a
// curtain of rain streaks around the camera, thunder flashes, fog that
// closes in, and a wetness value the game reads to darken soaked roads.
// Roadblocks (game/src/police.js): at four wanted stars the precinct seals
// a road ahead of the player with two angled interceptors and posted
// officers, and stands the cordon down when the heat drops. Motorbikes
// (game/src/vehicles.js): a slimmer, quicker vehicle type that leans into
// its turns, weaves through traffic, and can be stolen and ridden like any
// car. And a seventh, finale chapter, "Harbor Lights" (game/src/
// missions.js): a timed run through glowing festival rings across the bay —
// the wash, the beach, the club, the diner — ending at the Palm Court Motel.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
