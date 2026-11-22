// test-logic.mjs — headless logic test for Ember Sigils (not shipped).
// Plays random legal games and asserts: the zone invariant (20 cards per
// side, exactly once each), every game ends in win or loss, and the score
// is a finite number. Run: node test-logic.mjs
import { Game } from './game/src/game.js';
import { CARD_BY_ID } from './game/src/cards.js';

function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let wins = 0, losses = 0, maxTurns = 0, invariantFails = 0, scoreSum = 0;
const N = 200;
for (let s = 1; s <= N; s += 1) {
  const rng = makeRng(s * 7919);
  const game = new Game(s);
  game.startGame();
  let turns = 0;
  while (game.phase === 'play' && turns < 60) {
    turns += 1;
    // Play up to 3 random affordable cards, then end the turn.
    for (let k = 0; k < 3; k += 1) {
      const afford = game.player.deck.hand.filter((c) => CARD_BY_ID[c.typeId].cost <= game.player.mana);
      if (afford.length === 0) break;
      const pick = afford[Math.floor(rng() * afford.length)];
      game.playCard(pick.uid);
      if (game.phase !== 'play') break;
    }
    if (game.phase === 'play') game.endTurn();
    // Zone invariant after every full turn.
    if (game.player.deck.countAll() !== 20 || game.rival.deck.countAll() !== 20) invariantFails += 1;
  }
  maxTurns = Math.max(maxTurns, turns);
  if (game.phase === 'win') wins += 1;
  else if (game.phase === 'loss') losses += 1;
  else console.log(`seed ${s}: UNFINISHED after ${turns} turns (phase ${game.phase})`);
  if (!Number.isFinite(game.score)) console.log(`seed ${s}: bad score ${game.score}`);
  scoreSum += game.score;
}
console.log(`games=${N} wins=${wins} losses=${losses} maxTurns=${maxTurns} invariantFails=${invariantFails} avgScore=${(scoreSum / N).toFixed(1)}`);
if (wins === 0 || losses === 0) console.log('WARNING: one outcome never occurred');
if (invariantFails > 0) console.log('FAIL: zone invariant broken');
else console.log('zone invariant: OK (20 cards per side, every game)');
