# NEON HARBOR v2

An original open-world crime game for the browser, built with three.js.
You are Rio Santoso, a harbour driver in the fictional city of Azura Bay.
Fixer Mama Lala feeds you work — deliveries, pickups, scores to settle —
while the Coral Kings try to run you off their turf and the Azura Bay
police count every crime on a five-star wanted scale.

## Story

Rio Santoso came back to Azura Bay with a borrowed car, an empty wallet
and a promise to his late father that the family stall by the ferry pier
would never be sold. Mama Lala, who runs half the harbour's quiet business
from the back room of her diner, offers him a way to earn: seven jobs,
each dirtier than the last, that climb from a simple package run to a
harbour-wide showdown with Bima "Reef" Prasetyo and his Coral Kings. Every
job pays, every crime is remembered by the police, and the respray bay at
Splash & Go is the only place in the city that can make a hot car — and a
hot driver — look clean again.

## Systems

- **City** — a procedurally built grid city (Azura Bay) with varied
  buildings, emissive windows, palm trees, street lamps, a beach and bay
  water along the east edge, and eight named landmarks: Pelangi Motel,
  Mama Lala's Diner, Club Sirena, Haris Auto Repair, Toko Senjata Budi
  (arms shop), Splash & Go Car Wash & Respray, Santa Rosa Hospital and
  the Azura Bay Police Precinct.
- **Driving** — acceleration, braking, steering and grip that loosens as
  the roads get wet; cars and a motorbike variant; damage slows you down.
- **Traffic** — AI cars follow the road grid in lanes, brake for the
  player, and panic-stop when shots are fired nearby.
- **Pedestrians** — harbour folk wander the sidewalks, chat in pairs, and
  flee or cower when there is gunfire or a crash close by.
- **Wanted / police** — crimes add wanted points; stars rise to five.
  Police cars pursue on road and officers chase on foot, roadblocks
  appear at four stars, a bust meter fills when an officer catches a slow
  or on-foot player, and heat decays out of sight or vanishes at the
  respray shop.
- **Combat** — a hitscan pistol with muzzle flash, tracer, recoil and a
  small ammo-free heat model; gang members shoot back.
- **Missions** — a seven-mission story chain with dialogue, checkpoints,
  payouts and escalating heat, plus a repeatable courier side job that is
  generated on demand after the story opens up.
- **Weather** — fronts cycle clear, overcast, rain and storm, with rain
  particles, fog shifts, lightning, thunder and a wetness value that
  feeds driving grip.
- **Radio / audio** — fully synthesised WebAudio: engine hum, sirens,
  gunshots, pickups, UI clicks, thunder, and a three-station radio
  (Harbour FM, Sirena Nights, Bay Talk) playing generated note patterns.
  No audio files are used.
- **Save** — cash, story progress, player position and lifetime stats are
  kept in localStorage under a versioned key; Continue resumes a run.

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

then open <http://localhost:8080>. Any static file server pointed at the
`game/` folder works just as well. The game needs no build step and no
network access: three.js is vendored under `game/vendor/three/`.

## How the hand-in program works

`main.ts` (repo root) is the competition hand-in program. It resolves its
own folder, takes the output folder from `MAKEFUN_OUTPUT_DIR` (default
`/output`), copies `game/` and `screenshots/` into it, then calls the kit
helper `buildDossier()` with the competition size limits and writes the
returned text to `dossier.json` in the output folder. A missing
`screenshots/` folder is tolerated because screenshots are staged after
the code build.

## Screenshots

The four screenshots listed in `shots.json` are real frames of the
running game, staged by the game's own shot mode (`game/src/shots.js`):
open the game with a query such as `?shot=chase&seed=7` and the game
seeds its random generator, starts directly in the posed scene and flags
`window.__shotReady` once the frame is composed. Nothing is mocked up.

## Originality

Every name, character, place, line of dialogue and asset in NEON HARBOR
v2 is original to this project: Rio Santoso, Mama Lala, the Coral Kings,
Azura Bay and all of its businesses were invented for this entry. All
code was written for this entry; the only third-party code shipped is
three.js, vendored under its own licence in `game/vendor/three/`.
