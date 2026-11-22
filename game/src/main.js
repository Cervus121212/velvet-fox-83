// Ember Sigils — bootstrap. Builds one duel from the ?seed= query
// (or a random seed), wires the renderer and the controls, and either
// runs a screenshot fixture (?shot=) or shows the title screen.

import { Duel } from "./game.js";
import { Renderer } from "./render.js";
import { bindControls } from "./input.js";
import { Sfx } from "./audio.js";
import { runShotMode } from "./shots.js";

const params = new URLSearchParams(location.search);
const seedParam = Number(params.get("seed"));
const seed = Number.isFinite(seedParam) && seedParam > 0 ? seedParam : (Math.random() * 1e9) | 0;

const duel = new Duel(seed);
const sfx = new Sfx();
const view = new Renderer(duel, sfx);

// Hooks for scripted drivers and play-testers (read-only state).
window.__duel = duel;
window.__snapshot = () => duel.snapshot();
window.__shotReady = false;

bindControls(duel, view, sfx);

if (params.get("shot")) {
  runShotMode(duel, view);
} else {
  view.render();
}
