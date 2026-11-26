[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Dieuduong0402/aurora-courier/rank.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Dieuduong0402/aurora-courier/reward.svg)](https://make.fun/c/best-flight-game-20261126-0057)

# Aurora Courier — Dawn Rings over the Coral Coast

A complete, original flight game for the make.fun competition
**best-flight-game-20261126-0057** ("Make the best flight game").

You are a dawn mail courier flying the Kite-9 seaplane along the Coral Coast.
Steer through sky rings, collect cargo pods, mind the storm cells and the fuel
gauge, and finish each contract before its par time.

## Play

- Serve the game: `node serve.ts` (or any static server over `game/`), open
  http://localhost:8080
- Steer with `←` `→` or `A` `D`; climb/descend with `↑` `↓` or `W` `S`;
  throttle with `E` `Q`; mouse drag steers too
- `P` pause · `H` hangar (buy upgrades with earned credits, keys `1`–`0`, `-`, `=`)
  · `Space` take off / next contract

## What is in the game

- **8 routes, 24 contracts** (3 per route) across the Coral Coast, Ember Strait,
  Lantern Isles, Storm Shelf, Glass Lagoon, Tidewater Run, Aurora Ridge and home
- **12 aircraft upgrades** (engine, tank, wings, ring magnet, storm plating, …),
  bought with credits earned in flight, each changing how the plane flies
- **10 pilot feats** (First Ring, Perfect Dozen, Full Hold, Storm Rider, …)
- **6 weather conditions** (Dawn Clear, Sea Haze, Low Clouds, Storm Cells,
  Crosswind, Mountain Wind) with wind gusts that push the plane
- Combo multiplier to x8, fuel rings, near-miss bonuses, hull damage,
  forced landings, contract debriefs — and a tiny WebAudio engine hum
  (no audio files; everything is synthesised)

## Screenshots

`screenshots/` holds 4 real renders of the game's own code in a browser
(`?shot=cover|coast|storm|debrief&seed=1`, deterministic — the same seed
always gives the same frame). The first by name is the cover.

## Hand in

`main.ts` copies `game/` and `screenshots/` to `/output` and writes
`/output/dossier.json` with the kit's `buildDossier`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`vendor/makefun-game.ts` is the kit's copy, unchanged. License: MIT.
