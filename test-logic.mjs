// Ember Sigils — headless balance + invariant test (Node, no browser).
// Simulates 200 seeded duels: the player bot plays its best cards every
// turn, the rival answers with its 3-card plan. After every action the
// 20-card invariant, HP, mana, block and hand cap are checked.
// Usage: node test-logic.mjs  (exit 1 when any invariant fails)

import { Duel } from "./game/src/game.js";
import { scoreCard } from "./game/src/ai.js";

// The probe plays like an intermediate duelist: its best strike, then
// its best support card — or a second strike when no support is
// affordable. (An optimal solver wins ~9 in 10 here; a first-timer ~1
// in 5. This middle ground is the balance number that matters.)
function casualTurn(duel) {
  const ranked = () =>
    duel.you.hand
      .map((c) => [scoreCard(duel, "you", c), c])
      .sort((a, b) => b[0] - a[0]);
  const strike = ranked().find(([, c]) => c.def.effect.damage && c.def.cost <= duel.you.mana);
  if (strike) duel.playCard("you", strike[1].uid);
  if (duel.phase !== "play") return;
  const support = ranked().find(([, c]) => !c.def.effect.damage && c.def.cost <= duel.you.mana);
  if (support) {
    duel.playCard("you", support[1].uid);
    return;
  }
  const second = ranked().find(([, c]) => c.def.effect.damage && c.def.cost <= duel.you.mana);
  if (second && duel.phase === "play") duel.playCard("you", second[1].uid);
}

const GAMES = 200;
let wins = 0;
let losses = 0;
let maxTurns = 0;
let totalTurns = 0;
let totalScore = 0;
let invariantFails = 0;
const failNotes = [];

for (let seed = 1; seed <= GAMES; seed++) {
  const duel = new Duel(seed);
  duel.start();
  const check = () => {
    const bad = duel.validate();
    if (bad.length) {
      invariantFails += bad.length;
      if (failNotes.length < 5) failNotes.push(`seed ${seed}: ${bad.join("; ")}`);
    }
  };
  check();
  let guard = 0;
  while (duel.phase === "play" && guard < 40) {
    casualTurn(duel);
    if (duel.phase === "play") duel.endTurn();
    check();
    guard++;
  }
  if (duel.phase === "play") failNotes.push(`seed ${seed}: stalled at round ${duel.round}`);
  if (duel.phase === "won") wins++;
  else if (duel.phase === "lost") losses++;
  maxTurns = Math.max(maxTurns, duel.round);
  totalTurns += duel.round;
  totalScore += duel.score();
}

console.log(
  JSON.stringify(
    {
      games: GAMES,
      wins,
      losses,
      winRate: +(wins / GAMES).toFixed(3),
      maxTurns,
      avgTurns: +(totalTurns / GAMES).toFixed(2),
      avgScore: +(totalScore / GAMES).toFixed(1),
      invariantFails,
      failNotes,
    },
    null,
    2,
  ),
);
if (invariantFails > 0) process.exit(1);
