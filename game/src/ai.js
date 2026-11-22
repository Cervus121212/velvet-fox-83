// Ember Sigils — the rival brain.
// Scores every playable card, then plans up to three plays a turn.
// The same scoring drives the intent line the player sees, so the
// rival's plan is a promise, not a bluff.

import { EDGE_BONUS, MAX_HP, elementBeats } from "./cards.js";

export function otherSide(side) {
  return side === "you" ? "rival" : "you";
}

// How good is this card right now, for this fighter, in this position?
export function scoreCard(duel, side, inst) {
  const me = duel.fighter(side);
  const foe = duel.fighter(otherSide(side));
  const fx = inst.def.effect;
  let score = 0;
  if (fx.damage) {
    let dmg = fx.damage;
    if (elementBeats(inst.def.element, foe.ward)) dmg += EDGE_BONUS;
    const through = Math.max(0, dmg - foe.block);
    score += through * 2 + Math.min(foe.block, dmg) * 0.5;
    if (through >= foe.hp) score += 100; // lethal is worth everything
  }
  if (fx.block) score += fx.block * (me.hp < MAX_HP ? 1.5 : 0.4);
  if (fx.heal) score += fx.heal * (me.hp < MAX_HP ? 2 : 0.2);
  if (fx.draw) score += 3;
  if (fx.mana) score += 2;
  return score;
}

// Greedy plan: repeatedly take the best affordable card until the mana
// runs out or maxPlays is reached. manaOverride lets the caller plan
// with next turn's mana instead of the fighter's current mana.
//
// A zero-cost mana card (Mana Bloom) is worth playing before spending:
// it only ever adds mana, so the planner tries the plan both ways —
// blooms first, and blooms in score order — and keeps whichever plan
// scores higher. That stops the rival wasting a turn on one big card
// when a bloom first would have unlocked two.
export function planPlays(duel, side, maxPlays, manaOverride) {
  const me = duel.fighter(side);
  const mana = manaOverride === undefined ? me.mana : manaOverride;
  const plain = greedyPlan(duel, side, [...me.hand], mana, maxPlays);
  const blooms = me.hand.filter((c) => c.def.cost === 0 && c.def.effect.mana);
  if (!blooms.length) return plain;
  const rest = me.hand.filter((c) => !blooms.includes(c));
  let boostedMana = mana;
  for (const b of blooms) boostedMana += b.def.effect.mana;
  const boosted = [...blooms, ...greedyPlan(duel, side, rest, boostedMana, Math.max(0, maxPlays - blooms.length))];
  const value = (plan) => plan.reduce((sum, c) => sum + scoreCard(duel, side, c), 0);
  return value(boosted) > value(plain) ? boosted : plain;
}

function greedyPlan(duel, side, pool, mana, maxPlays) {
  const plan = [];
  while (plan.length < maxPlays) {
    let best = null;
    let bestScore = 0;
    for (const inst of pool) {
      if (inst.def.cost > mana) continue;
      const s = scoreCard(duel, side, inst);
      if (s > bestScore) {
        bestScore = s;
        best = inst;
      }
    }
    if (!best) break;
    plan.push(best);
    mana -= best.def.cost;
    if (best.def.effect.mana) mana += best.def.effect.mana;
    pool.splice(pool.indexOf(best), 1);
  }
  return plan;
}

// One-line human-readable version of a plan, for the intent display.
export function describePlan(plan) {
  if (!plan.length) return "The rival holds back…";
  return plan.map((c) => `${c.def.name} (${c.def.cost})`).join(" · ");
}
