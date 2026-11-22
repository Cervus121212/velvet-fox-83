// Ember Sigils — hand-in program (Node 22, standard library only).
// Copies game/ and screenshots/ into the output directory and writes
// dossier.json with buildDossier from the kit's vendor/makefun-game.ts.
// Never deletes anything: /output is a bind mount in the grader.

import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildDossier } from "./vendor/makefun-game.ts";

const root = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";

const caps = {
  text_max_bytes: 163840,
  screenshots_max: 4,
  screenshot_max_bytes: 262144,
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

mkdirSync(join(outDir, "game"), { recursive: true });
mkdirSync(join(outDir, "screenshots"), { recursive: true });
cpSync(join(root, "game"), join(outDir, "game"), { recursive: true });
cpSync(join(root, "screenshots"), join(outDir, "screenshots"), { recursive: true });

const dossier = await buildDossier(outDir, caps);
writeFileSync(join(outDir, "dossier.json"), dossier);
console.log(`Ember Sigils: wrote ${outDir} (dossier ${dossier.length} bytes)`);
