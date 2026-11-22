// main.js — the bootstrap of Ember Sigils.
// Wires the game, the renderer, the input and the sound together, then
// either opens the title screen or jumps straight to a screenshot state
// when the URL carries ?shot=. One render function per phase, re-run after
// every action, so the screen is always the state, never a stale copy.

import { Game } from './game.js';
import { renderGame, renderTitle, renderEnd } from './render.js';
import { bindInput } from './input.js';
import { Sound } from './audio.js';
import { parseShot, buildPlayState, buildWinState, buildLossState, markReady } from './shots.js';

const root = document.getElementById('app');
const status = document.getElementById('status');
const audio = new Sound();
let best = 0;
try { best = Number(window.localStorage.getItem('ember-sigils-best') || '0') || 0; } catch { best = 0; }

function saveBest(score) {
  if (score > best) {
    best = score;
    try { window.localStorage.setItem('ember-sigils-best', String(best)); } catch { /* storage is a nicety */ }
  }
}

function paint(game) {
  if (game.phase === 'title') {
    renderTitle(root, best);
    status.textContent = 'Ember Sigils. Press Enter or click Begin the Duel.';
  } else if (game.phase === 'play') {
    renderGame(game, root);
    status.textContent = `Turn ${game.turn}. Your life ${game.player.hp}, rival ${game.rival.hp}. Mana ${game.player.mana}.`;
  } else {
    renderEnd(root, game, game.phase === 'win');
    saveBest(game.score);
    status.textContent = game.phase === 'win'
      ? `Victory! Score ${game.score}.`
      : `Defeat. Score ${game.score}.`;
    if (game.phase === 'win') audio.win();
    else audio.lose();
  }
}

const { shot, seed } = parseShot();
if (shot) document.body.classList.add('shot');
let game;
if (shot === 'play') {
  game = buildPlayState(seed);
} else if (shot === 'win') {
  game = buildWinState(seed);
} else if (shot === 'loss') {
  game = buildLossState(seed);
} else {
  game = new Game(seed);
}

bindInput(root, game, audio, () => paint(game));
paint(game);

// A screenshot state is ready as soon as it is painted; the interactive
// game never sets the flag, so a capture always waits for a real state.
if (shot === 'play' || shot === 'win' || shot === 'loss' || shot === 'start') {
  requestAnimationFrame(() => requestAnimationFrame(markReady));
}
