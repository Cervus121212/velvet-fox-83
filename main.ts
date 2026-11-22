// main.ts — the hand-in program for Ember Sigils (Node 22, stdlib only).
// It copies the playable game and its screenshots beside this file into
// /output (or MAKEFUN_OUTPUT_DIR outside the grader) and writes the
// dossier the judge reads, built by the vendored make.fun library from
// exactly those files. It never deletes the output directory: on the
// grader /output is a bind mount, and removing it fails the run.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps for this bounty: game/ at most 993 files and 48 MiB,
// screenshots at most 4 files of 256 KiB each, dossier at most 1.5 MiB,
// the whole of /output at most 1000 entries and 64 MiB. buildDossier is
// given the same numbers so a too-large hand-in fails here, loudly,
// instead of silently passing a bad dossier to the judge.
const DOSSIER_OPTIONS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, DOSSIER_OPTIONS));
