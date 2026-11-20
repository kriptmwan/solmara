// Solmara's entrypoint for make.fun gta6-01 (Node 22, standard library only).
//
// The game is this repository's game/ folder: plain static files that a desktop browser loads
// offline (game/index.html and its ES modules, no libraries, no network requests). This program
// hands the entry in: it copies game/ and screenshots/ from beside this file into the output
// directory and writes dossier.json there with the vendored make.fun library, so the judge can
// read the game's source and see its screenshots.
//
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The gate's caps, from the kit: at most 4 screenshots of 256 KiB each, at most 993 files and
// 48 MiB under game/, no game/ path longer than 1000 bytes, and the dossier text capped at
// 160 KiB. buildDossier refuses an entry that would break any of them.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
