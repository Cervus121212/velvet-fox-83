// Ember Sigils — the duel engine. Pure state machine, no DOM.
// Two fighters, 24 HP each. The player moves first; the rival answers
// with the plan it showed as its intent, then the next round begins.

import {
  DECK_SIZE,
  DRAW_PER_TURN,
  EDGE_BONUS,
  HAND_CAP,
  MAX_HP,
  OPENING_HAND,
  elementBeats,
  manaForRound,
} from "./cards.js";
import { Pile } from "./deck.js";
import { otherSide, planPlays } from "./ai.js";

const RIVAL_SEED_JUMP = 7919;

function fighterName(side) {
  return side === "you" ? "You" : "The Hollow Sigilist";
}

export class Duel {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.round = 1;
    this.phase = "title"; // title | play | won | lost
    this.turn = "you";
    this.logLines = [];
    this.damageDealt = 0; // HP damage you dealt (drives the score)
    this.damageTaken = 0;
    this.you = this.freshFighter("you");
    this.rival = this.freshFighter("rival");
    this.rivalIntent = []; // uids the rival committed to play next turn
  }

  freshFighter(side) {
    const pile = new Pile(
      this.seed + (side === "rival" ? RIVAL_SEED_JUMP : 0),
      side,
    );
    pile.fill();
    const fighter = {
      side,
      hp: MAX_HP,
      block: 0,
      mana: manaForRound(1),
      hand: [],
      pile,
      ward: null, // element of the last card this side played
    };
    pile.drawInto(fighter.hand, OPENING_HAND, HAND_CAP);
    return fighter;
  }

  fighter(side) {
    return side === "you" ? this.you : this.rival;
  }

  say(text) {
    this.logLines.push(text);
    if (this.logLines.length > 48) this.logLines.splice(0, this.logLines.length - 48);
  }

  start() {
    if (this.phase !== "title") return;
    this.phase = "play";
    this.say("Embers rise. The Hollow Sigilist raises a hollow rune.");
    this.say("Your move — play cards, then End Turn.");
    const plan = planPlays(this, "rival", 3, manaForRound(1));
    this.rivalIntent = plan.map((c) => c.uid);
  }

  reset(seed) {
    const fresh = new Duel(seed === undefined ? (Math.random() * 1e9) | 0 : seed);
    Object.assign(this, fresh);
    this.start();
  }

  // Resolve one card's effect. The card is already out of the hand
  // (limbo) while this runs, so a draw effect can never reshuffle the
  // card being played back into the deck.
  resolve(inst, me, foe) {
    const fx = inst.def.effect;
    if (fx.damage) {
      let dmg = fx.damage;
      const edge = elementBeats(inst.def.element, foe.ward);
      if (edge) dmg += EDGE_BONUS;
      const soaked = Math.min(foe.block, dmg);
      foe.block -= soaked;
      const hurt = dmg - soaked;
      foe.hp = Math.max(0, foe.hp - hurt);
      if (me.side === "you") this.damageDealt += hurt;
      else this.damageTaken += hurt;
      this.say(
        `${fighterName(me.side)} play${me.side === "you" ? "" : "s"} ${inst.def.name} — ${hurt} damage` +
          (edge ? " (Edge +3!)" : "") +
          (soaked ? `, ${soaked} soaked by block` : "") +
          ".",
      );
    }
    if (fx.block) {
      me.block += fx.block;
      this.say(`${fighterName(me.side)} gain${me.side === "you" ? "" : "s"} ${fx.block} block.`);
    }
    if (fx.heal) {
      const healed = Math.min(MAX_HP - me.hp, fx.heal);
      me.hp += healed;
      this.say(`${fighterName(me.side)} mend${me.side === "you" ? "" : "s"} ${healed} HP.`);
    }
    if (fx.draw) {
      const r = me.pile.drawInto(me.hand, fx.draw, HAND_CAP);
      this.say(`${fighterName(me.side)} draw${me.side === "you" ? "" : "s"} ${r.drawn} card${r.drawn === 1 ? "" : "s"}.`);
    }
    if (fx.mana) {
      me.mana += fx.mana;
      this.say(`${fighterName(me.side)} bloom${me.side === "you" ? "" : "s"} +${fx.mana} mana.`);
    }
  }

  playCard(side, uid) {
    if (this.phase !== "play") return { ok: false, why: "not-playing" };
    if (side === "you" && this.turn !== "you") return { ok: false, why: "not-your-turn" };
    const me = this.fighter(side);
    const foe = this.fighter(otherSide(side));
    const at = me.hand.findIndex((c) => c.uid === uid);
    if (at < 0) return { ok: false, why: "not-in-hand" };
    const inst = me.hand[at];
    if (inst.def.cost > me.mana) return { ok: false, why: "no-mana" };
    me.mana -= inst.def.cost;
    me.hand.splice(at, 1);
    this.resolve(inst, me, foe);
    me.pile.grave.push(inst);
    me.ward = inst.def.element;
    this.checkEnd();
    return { ok: true, card: inst };
  }

  endTurn() {
    if (this.phase !== "play" || this.turn !== "you") return false;
    this.turn = "rival";
    this.rivalTurn();
    if (this.phase !== "play") return true;
    this.round += 1;
    this.turn = "you";
    this.beginPlayerTurn();
    return true;
  }

  rivalTurn() {
    const foe = this.rival;
    foe.block = 0; // block expires at the start of its owner's turn
    foe.mana = manaForRound(this.round);
    let plan = this.rivalIntent.filter((uid) => foe.hand.some((c) => c.uid === uid));
    if (plan.length === 0) plan = planPlays(this, "rival", 3).map((c) => c.uid);
    for (const uid of plan) {
      if (this.phase !== "play") break;
      this.playCard("rival", uid);
    }
    if (this.phase !== "play") return;
    foe.pile.drawInto(foe.hand, DRAW_PER_TURN, HAND_CAP);
    this.say("The Hollow Sigilist draws and schemes.");
  }

  beginPlayerTurn() {
    const me = this.you;
    me.block = 0;
    me.mana = manaForRound(this.round);
    const r = me.pile.drawInto(me.hand, DRAW_PER_TURN, HAND_CAP);
    this.say(`— Round ${this.round} — you draw ${r.drawn}.`);
    const plan = planPlays(this, "rival", 3, manaForRound(this.round));
    this.rivalIntent = plan.map((c) => c.uid);
  }

  checkEnd() {
    if (this.phase !== "play") return;
    if (this.rival.hp <= 0) {
      this.phase = "won";
      this.say(`The Hollow Sigilist shatters into embers. Victory! Score ${this.score()}.`);
    } else if (this.you.hp <= 0) {
      this.phase = "lost";
      this.say(`Your sigils gutter out. Defeat. Score ${this.score()}.`);
    }
  }

  score() {
    return (
      this.damageDealt +
      this.you.hp * 2 +
      Math.max(0, 10 - this.round) * 5
    );
  }

  // Every card instance must live in exactly one zone; HP, mana, block
  // and hand size must stay inside their bounds. Returns a list of
  // problems (empty = healthy). Call it between actions, never mid-resolve.
  validate() {
    const bad = [];
    for (const side of ["you", "rival"]) {
      const f = this.fighter(side);
      const total = f.hand.length + f.pile.restingCount();
      if (total !== DECK_SIZE) bad.push(`${side}: ${total} cards, want ${DECK_SIZE}`);
      const uids = [...f.hand, ...f.pile.stock, ...f.pile.grave].map((c) => c.uid);
      if (new Set(uids).size !== uids.length) bad.push(`${side}: duplicate card uid`);
      if (f.hp < 0 || f.hp > MAX_HP) bad.push(`${side}: hp ${f.hp}`);
      if (f.mana < 0) bad.push(`${side}: mana ${f.mana}`);
      if (f.block < 0) bad.push(`${side}: block ${f.block}`);
      if (f.hand.length > HAND_CAP) bad.push(`${side}: hand ${f.hand.length}`);
    }
    if (this.round < 1) bad.push(`round ${this.round}`);
    return bad;
  }

  // Plain data for the renderer and for scripted test drivers.
  snapshot() {
    const slim = (f) => ({
      hp: f.hp,
      maxHp: MAX_HP,
      block: f.block,
      mana: f.mana,
      ward: f.ward,
      hand: f.hand.map((c) => ({
        uid: c.uid,
        id: c.def.id,
        name: c.def.name,
        element: c.def.element,
        cost: c.def.cost,
        effect: c.def.effect,
      })),
    });
    const you = slim(this.you);
    const rival = slim(this.rival);
    const intent = this.rivalIntent
      .map((uid) => this.rival.hand.find((c) => c.uid === uid))
      .filter(Boolean)
      .map((c) => ({ name: c.def.name, element: c.def.element, cost: c.def.cost }));
    return {
      seed: this.seed,
      phase: this.phase,
      turn: this.turn,
      round: this.round,
      score: this.score(),
      damageDealt: this.damageDealt,
      damageTaken: this.damageTaken,
      you,
      rival: { ...rival, handCount: this.rival.hand.length },
      intent,
      log: this.logLines.slice(-8),
    };
  }
}
