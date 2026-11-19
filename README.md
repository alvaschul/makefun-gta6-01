# NEON HARBOR

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/alvaschul/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/alvaschul/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

NEON HARBOR is an original open-world crime game that runs in the
browser, built with three.js. It was built for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01).

You play Rio Santoso, a harbour driver working the fictional city of
Azura Bay. The fixer Mama Lala keeps the work coming — deliveries,
pickups and scores that need settling — while the Coral Kings push
back against anyone earning on their turf, and the Azura Bay police
log every crime Rio commits on a five-star wanted scale.

## Quick start

Start a new game from the title screen to begin Rio's story in Azura
Bay. If you have played before, Continue resumes your save instead.
Either way, head to Mama Lala's Diner — the first mission starts
there, and Mama Lala will talk you through the job.

## Story

Rio Santoso returns to Azura Bay with a borrowed car, an empty wallet,
and a promise made to his late father: the family stall by the ferry
pier will never be sold. Mama Lala, who runs half the harbour's quiet
business out of the back room of her diner, offers him a way to earn
his way out. It is seven jobs, each one dirtier than the last, climbing
from a simple package run to a harbour-wide showdown with Bima "Reef"
Prasetyo and his Coral Kings. Every job pays. Every crime is
remembered by the police. And the respray bay at Splash & Go is the
only place in the city that can make a hot car — and a hot driver —
look clean again.

## Systems

- **City** — Azura Bay is a procedurally built grid city with varied
  buildings, emissive windows, palm trees and street lamps, plus a
  beach and bay water running along its east edge. Eight landmarks are
  named and placed around the map: Pelangi Motel, Mama Lala's Diner,
  Club Sirena, Haris Auto Repair, Toko Senjata Budi (the arms shop),
  Splash & Go Car Wash & Respray, Santa Rosa Hospital, and the Azura
  Bay Police Precinct.
- **Driving** — Cars handle with acceleration, braking and steering,
  and grip loosens as the roads get wet. There is a motorbike variant
  alongside the cars, and damage slows a vehicle down.
- **Traffic** — AI cars follow the road grid in lanes, brake for the
  player, and panic-stop when shots are fired nearby.
- **Pedestrians** — Harbour folk wander the sidewalks and chat in
  pairs. When there is gunfire or a crash close by, they flee or
  cower.
- **Wanted / police** — Crimes add wanted points and the stars climb
  to five. Police cars pursue on the road and officers chase on foot;
  roadblocks appear at four stars. A bust meter fills when an officer
  catches a player who is slow or on foot, and heat decays while out
  of sight — or vanishes altogether at the respray shop.
- **Combat** — A hitscan pistol with muzzle flash, tracer, recoil and
  a small ammo-free heat model. Gang members shoot back.
- **Missions** — A seven-mission story chain with dialogue,
  checkpoints, payouts and escalating heat, plus a repeatable courier
  side job that is generated on demand once the story has opened up.
- **Weather** — Fronts cycle through clear, overcast, rain and storm,
  bringing rain particles, fog shifts, lightning and thunder. A
  wetness value tracks how soaked the city is and feeds driving grip.
- **Radio / audio** — Everything is synthesised with WebAudio — engine
  hum, sirens, gunshots, pickups, UI clicks and thunder — and a
  three-station radio (Harbour FM, Sirena Nights and Bay Talk) plays
  generated note patterns. No audio files are used.
- **Save** — Cash, story progress, player position and lifetime stats
  are kept in localStorage under a versioned key, and Continue resumes
  a saved run.

## Controls

| Input | Action |
| --- | --- |
| W / A / S / D | Move on foot / drive |
| Mouse | Look / aim |
| Shift | Sprint on foot / hold to aim on foot |
| Left mouse | Shoot (while aiming) |
| E or F | Enter / exit vehicle, interact, advance dialogue |
| R | Switch radio station (in a vehicle) |
| Esc | Pause |
| M | Mute / unmute |

## Running the game

```
node serve.ts
```

Then open <http://localhost:8080>. Any static file server pointed at
the `game/` folder works just as well. The game needs no build step
and no network access: three.js is vendored under
`game/vendor/three/`.

## How the hand-in program works

`main.ts`, at the repo root, is the hand-in program. It resolves its
own folder, takes the output folder from `MAKEFUN_OUTPUT_DIR`
(default `/output`), and copies `game/` and `screenshots/` into it.
It then calls the helper `buildDossier()` with the size limits and
writes the returned text to `dossier.json` in the output folder. A
missing `screenshots/` folder is tolerated, because screenshots are
staged after the code build.

## Screenshots

The four screenshots listed in `shots.json` are real frames of the
running game, staged by the game's own shot mode
(`game/src/shots.js`): open the game with a query such as
`?shot=chase&seed=7` and the game seeds its random generator, starts
directly in the posed scene, and flags `window.__shotReady` once the
frame is composed. Nothing is mocked up.

| File | What it shows |
| --- | --- |
| `1-chase.jpg` | A police chase at three wanted stars, with the minimap up |
| `2-street.jpg` | On foot, pistol drawn, against the Coral Kings |
| `3-wash.jpg` | A car in the respray zone at Splash & Go, with two stars |
| `4-title.jpg` | The title screen over the city at dusk |

## Originality

Every name, character, place, line of dialogue and asset in NEON
HARBOR is original to this project: Rio Santoso, Mama Lala, the Coral
Kings, Azura Bay and all of its businesses were invented for this
entry. All code was written for this entry; the only third-party code
shipped is three.js, vendored under its own licence in
`game/vendor/three/`.
