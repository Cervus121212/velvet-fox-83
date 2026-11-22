// Ember Sigils — deterministic screenshot fixtures, driven by ?shot=.
//   ?shot=start  title screen
//   ?shot=play   two scripted rounds (attack + block each round), seed 1
//   ?shot=win    full duel, strong play, until the rival falls
//   ?shot=loss   full duel, passive play, until the player falls
// Every fixture replays the same seed the same way, and sets
// window.__shotReady once the table has settled.

import { planPlays } from "./ai.js";

// Two honest rounds: one attack card, then one block card, each round.
function scriptedRounds(duel, rounds) {
  for (let r = 0; r < rounds && duel.phase === "play"; r++) {
    const atk = duel.you.hand.find(
      (c) => c.def.effect.damage && c.def.cost <= duel.you.mana,
    );
    if (atk) duel.playCard("you", atk.uid);
    const blk = duel.you.hand.find(
      (c) => c.def.effect.block && c.def.cost <= duel.you.mana,
    );
    if (blk) duel.playCard("you", blk.uid);
    duel.endTurn();
  }
}

// Greedy attacker: play the best cards the mana allows.
function strongBot(duel) {
  const plan = planPlays(duel, "you", 99);
  for (const c of plan) {
    if (duel.phase !== "play") break;
    duel.playCard("you", c.uid);
  }
}

// Passive defender: guard and mend only, never strike — loses on purpose.
function meekBot(duel) {
  const safe = duel.you.hand.filter(
    (c) => !c.def.effect.damage && c.def.cost <= duel.you.mana,
  );
  for (const c of safe) {
    if (duel.phase !== "play") break;
    duel.playCard("you", c.uid);
  }
}

function autoDuel(duel, bot) {
  let guard = 0;
  while (duel.phase === "play" && guard < 30) {
    bot(duel);
    if (duel.phase === "play") duel.endTurn();
    guard++;
  }
}

export function runShotMode(duel, view) {
  const q = new URLSearchParams(location.search);
  const shot = q.get("shot") || "start";
  document.body.classList.add("shot"); // freeze CSS motion: stable shots
  if (shot === "play") {
    duel.start();
    scriptedRounds(duel, 2);
  } else if (shot === "win") {
    duel.start();
    autoDuel(duel, strongBot);
  } else if (shot === "loss") {
    duel.start();
    autoDuel(duel, meekBot);
  }
  // Title shot: leave the duel on its title screen.
  view.render();
  requestAnimationFrame(() => {
    setTimeout(() => {
      window.__shotReady = true;
    }, 250);
  });
}
