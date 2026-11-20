# NEON HARBOR

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/alvaschul/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/alvaschul/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**NEON HARBOR** is a small open-world crime story built with three.js for
the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). It runs
entirely from static files — no build step, no assets to download, no
network needed once you have the folder.

## The story

Azura Bay is a sunset harbour town of neon motels, diners and one long
beach road. **Rio Santoso** grew up working his family's food stall by the
ferry pier, and the rent on that stall is due in a way it has never been
due before. **Mama Lala**, who runs the diner on the avenue and quietly
arranges half the favours in town, starts feeding Rio driving jobs: a
guest who must not be followed, a crate that must not be opened, a singer
who must not be late.

Every job pulls Rio closer to the **Coral Kings**, the crew run by
**Bima "Reef" Prasetyo**, who have decided the pier, the car wash and
eventually the whole shoreline belong to them. Across seven jobs Rio has
to decide how much of himself he is willing to trade for the stall — and
on the last night, standing between Reef and the harbour his family has
fed for thirty years, he stops trading.

## Quick start

```sh
node serve.ts            # serves game/ on http://localhost:8080
# or: node serve.ts --port 8123
```

Open the printed address in a browser, pick **New Game**, and head for
the gold ring on the minimap. To hand the entry in the way the bounty
expects:

```sh
MAKEFUN_OUTPUT_DIR=/output node main.ts
```

That copies `game/` and `screenshots/` into the output folder and writes
a `dossier.json` describing the bundle.

## What's in the world

- **Azura Bay** — a procedural grid city: towers with lit windows and
  neon trim, shopfronts, palms, street lamps, a beach and an animated
  bay along the east edge, plus harbour crates and barriers.
- **Eight landmarks** you navigate by: Pelangi Motel, Mama Lala's Diner,
  Club Sirena, Haris Auto Repair, Toko Senjata Budi, Splash & Go Car
  Wash & Respray, Santa Rosa Hospital and the Azura Bay Police Precinct.
- **Driving** — arcade vehicle physics with throttle, braking, steering,
  handbrake drifts, collision damage that costs top speed, and grip that
  falls away when the rain makes the roads wet.
- **Traffic** — cars and bikes that follow the road grid, turn at
  intersections, brake for you and panic-stop near gunfire.
- **Pedestrians** — sidewalk wanderers and chatting pairs who flee or
  cower when shots are fired or a crash lands near them.
- **Wanted & police** — crimes add heat; stars bring patrol cars,
  officers on foot and, at four stars, roadblocks. A bust meter fills
  when an officer corners a slow Rio. Heat decays while you stay unseen,
  and a respray at Splash & Go wipes it instantly.
- **Combat** — a hitscan pistol with muzzle flash, tracer, recoil feel
  and reactions from gang members and police alike.
- **Missions** — seven story jobs (fares, pickups, a delivery, a chase,
  an escape and the pier stand) with dialogue, payouts and a minimap
  marker for every objective.
- **Weather** — clear dusk spells broken by tropical rain: fog closes
  in, lights dim, rain falls, and the roads get slippery.
- **Audio** — fully procedural WebAudio: engine hum, sirens, shots,
  impacts, pickups and payout chimes. No audio files.
- **Save** — progress persists in localStorage; Continue picks the story
  back up.

## Controls

| Keys | Action |
| --- | --- |
| W A S D / arrow keys | Walk and drive |
| Shift | Run |
| E | Enter / exit a vehicle, advance dialogue |
| Space | Handbrake |
| Mouse | Click the canvas to lock the pointer; click to fire |
| P | Pause |

## Screenshots

| File | Scene |
| --- | --- |
| `screenshots/1-chase.jpg` | Two Azura Bay patrol cars close in on Rio during a harbour-front pursuit. |
| `screenshots/2-street.jpg` | Street level on the main avenue: traffic, pedestrians and neon at dusk. |
| `screenshots/3-wash.jpg` | Inside the Splash & Go bay, where a respray quietly clears Rio's wanted level. |
| `screenshots/4-title.jpg` | NEON HARBOR title framing: the hero car against the Azura Bay skyline. |

The captures are staged deterministically: open the game with
`?shot=chase`, `?shot=street`, `?shot=wash` or `?shot=title` and the
scene composes itself, hides the HUD and raises `window.__shotReady`
when the frame is ready.

## Layout

- `game/index.html` — page, title screen, HUD styling, import map
- `game/src/` — the game modules (city, vehicles, people, police,
  missions, weather, audio, HUD, input, save, shots, main loop)
- `game/vendor/three/` — the vendored three.js build (third-party)
- `serve.ts` — tiny static server (Node standard library only)
- `main.ts` — the hand-in program that stages the bundle and dossier
- `shots.json` — the screenshot manifest

## License

The game code is released under the MIT license (see `LICENSE`).
three.js, vendored under `game/vendor/three/`, remains under its own
MIT license.
