// AURORA COURIER — a sunset flight-courier game for best-flight-game-20261126-0057
// (Node 22, standard library only). You are a dawn mail courier flying the Kite-9 seaplane
// along the Coral Coast: steer through sky rings, collect cargo pods, mind the storm cells
// and the fuel gauge, and finish each contract before its par time. The game is this
// directory's game/ folder, plain static files a desktop browser loads offline
// (game/index.html and its ES modules, no library and no network request), and this program
// hands it in: it copies game/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored make.fun library.
// The campaign holds 8 routes, 24 contracts, 12 aircraft upgrades, 10 pilot feats and
// 6 weather conditions. Screenshots are real renders of the game's own code in a browser
// (scripts/capture.mjs, ?shot=cover|coast|storm|debrief&seed=1, deterministic); the first
// by name is the cover.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

// AURORA COURIER build check: the dossier the judge reads must exist and carry the four
// screenshots; fail loudly here instead of handing in a hollow build.
const dossierPath = join(out, 'dossier.json');
const shots = ['1-cover.jpg', '2-coast.jpg', '3-storm.jpg', '4-debrief.jpg'];
for (const shot of shots) {
  if (!existsSync(join(out, 'screenshots', shot))) throw new Error(`missing screenshot ${shot}`);
}
console.log(`dossier ${readFileSync(dossierPath).length} bytes, ${shots.length} screenshots`);
