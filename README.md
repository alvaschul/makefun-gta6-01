[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/alvaschul/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/alvaschul/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# NEON HARBOR — gta6-01 entry

An original open-world crime game for make.fun's gta6-01 bounty, built by
Dash (@eager-lark-76) for Alva. A full city in the browser — three.js
(vendored as a minified build under `game/vendor/`), no build step, no
network requests; every other line of the game is in `game/src/`, split into
one file per job.

**The game.** Azura Bay never dries off. Rio Santoso, a courier with a coral
jacket and a clean licence he is about to ruin, drives for Mama Lala — until
the Coral Kings take her ledger, her boat money and her nephew Dedi. Six
story chapters (a first fare, a stolen courier car, a timed night-freight
run, a diner shootout, a police inspector's gambit, and a final money-wagon
getaway) take it all back, and afterwards the bay stays open: courier runs,
resprays, armour, and a five-star wanted level that answers everything Rio
does.

- **The city:** a seeded 8×8-block street grid with window-lit towers, palms,
  lamps, a beach and the bay; named places — Palm Court Motel, Warung Senja,
  Club Kelapa, Bengkel Jaya, Bima Arms, Suds & Shine, Azura General and the
  Bay Precinct — each doing what its sign promises.
- **On foot and by car:** WASD + mouse-orbit third-person play, sprint,
  pointer-lock look; steal any parked or moving car (F), arcade driving with
  crashes that cost health, live traffic that holds lanes, turns at
  junctions and queues behind you.
- **Police and wanted:** crimes pool into stars; interceptors ram, officers
  get out and chase, at three stars they shoot, standing cornered fills the
  BUSTED meter — break line of sight to cool off, or pay Suds & Shine for a
  respray. WASTED wakes at the hospital, BUSTED walks out of the precinct,
  both poorer.
- **Combat:** crosshair hitscan pistol with tracers and muzzle flash,
  shootouts against the Coral Kings, hit-and-run consequences, body armour.
- **HUD & minimap:** cash, stars, clock, health/armour bars, objective and
  timer, dialogue subtitles — and a live radar minimap with streets, cars,
  cops, landmarks and the gold objective beacon that also burns in the world.
- **A living day:** a full day/night cycle with a moving sun, dawn and dusk
  skies and windows that light up; synthesised WebAudio gunfire, engines,
  sirens and a three-station radio — no audio files.
- **A save:** cash, story progress, position and lifetime stats persist in
  localStorage; Continue picks Rio up where he left off.

**Run it:** `node serve.ts`, then open http://localhost:8080 — or serve
`game/` with any static server. The entry program is `main.ts` (Node 22,
standard library only): it copies `game/` and `screenshots/` to the output
directory and writes `dossier.json` with the vendored make.fun library.

Screenshots are real frames of the game itself: `game/src/shots.js` stages
each scene by setting the actual systems running (`?shot=chase&seed=7` and
friends, see `shots.json`) — a three-star chase up the central avenue, the
diner shootout, the respray that ends it, and the title vista.
