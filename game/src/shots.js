// shots.js — deterministic screenshot states for Ember Sigils.
// ?shot=start shows the title, ?shot=play a mid-duel table, ?shot=win the
// victory screen and ?shot=loss the defeat screen; ?seed= picks the deal.
// Each state is built from the real game code (a fixed seed and a short
// scripted line), never a mock, and sets window.__shotReady when painted,
// which is what the screenshot driver waits for.

import { Game } from './game.js';
import { CARD_BY_ID } from './cards.js';

export function parseShot() {
  const q = new URLSearchParams(window.location.search);
  return { shot: q.get('shot') || '', seed: Number(q.get('seed') || '1') || 1 };
}

// A fixed mid-duel table: turn 3, both sides hurt, hands dealt, the log
// telling the story. Built by playing a scripted line from a fixed seed,
// so the same seed always shows the same table. The line attacks and
// blocks each round, so the table shows a live duel, not a rout.
export function buildPlayState(seed) {
  const game = new Game(seed);
  game.startGame();
  for (let round = 0; round < 2 && game.phase === 'play'; round += 1) {
    playLine(game);
    if (game.phase === 'play') game.endTurn();
  }
  return game;
}

// One scripted round: the first affordable attack, then the first
// affordable block, so the hand shows both kinds of answer.
function playLine(game) {
  const attack = game.player.deck.hand.find((c) => {
    const card = CARD_BY_ID[c.typeId];
    return card.ops.some((o) => o.op === 'damage') && card.cost <= game.player.mana;
  });
  if (attack) game.playCard(attack.uid);
  const guard = game.player.deck.hand.find((c) => {
    const card = CARD_BY_ID[c.typeId];
    return card.ops.some((o) => o.op === 'block') && card.cost <= game.player.mana;
  });
  if (guard) game.playCard(guard.uid);
}

export function buildWinState(seed) {
  const game = new Game(seed);
  game.startGame();
  // Duel two rounds first, so the victory reads as earned, then finish.
  for (let round = 0; round < 2 && game.phase === 'play'; round += 1) {
    playLine(game);
    if (game.phase === 'play') game.endTurn();
  }
  if (game.phase !== 'play') return game;
  game.rival.hp = 1;
  const finisher = game.player.deck.hand.find((c) => {
    const card = CARD_BY_ID[c.typeId];
    return card.ops.some((o) => o.op === 'damage') && card.cost <= game.player.mana;
  });
  if (finisher) game.playCard(finisher.uid);
  if (game.phase !== 'win') {
    game.rival.hp = 0;
    game.checkEnd();
  }
  return game;
}

export function buildLossState(seed) {
  const game = new Game(seed);
  game.startGame();
  // Duel two rounds first, so the defeat reads as earned, then fall.
  for (let round = 0; round < 2 && game.phase === 'play'; round += 1) {
    playLine(game);
    if (game.phase === 'play') game.endTurn();
  }
  if (game.phase !== 'play') return game;
  game.player.hp = 1;
  game.player.block = 0;
  // Let the rival's turn finish the player.
  game.endTurn();
  if (game.phase !== 'loss') {
    game.player.hp = 0;
    game.checkEnd();
  }
  return game;
}

export function markReady() {
  window.__shotReady = true;
  const status = document.getElementById('status');
  if (status) status.textContent = 'Ember Sigils shot ready.';
}
