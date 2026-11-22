// game.js — the state machine of Ember Sigils.
// One Game owns both sides, the turn order, and the win/loss. Phases:
//   'title' -> 'play' -> 'win' | 'loss'
// A turn: the player draws to five, spends mana on cards, ends the turn;
// the rival then plays its plan, and the next turn begins. Block only
// lasts until its owner's next turn starts. A side's ward is the element
// of the last card it played, and it is what the edge bonus reads.

import { CARD_BY_ID, elementBeats, makeDeck } from './cards.js';
import { Deck, makeRng } from './deck.js';
import { planRivalTurn, rivalIntent } from './ai.js';

export const MAX_HP = 24;
export const HAND_SIZE = 5;
export const HAND_CAP = 7;

function maxManaForTurn(turn) {
  if (turn >= 7) return 5;
  if (turn >= 4) return 4;
  return 3;
}

function newSide(seed) {
  return {
    hp: MAX_HP, maxHp: MAX_HP, block: 0, ward: null,
    mana: 0, maxMana: 3, deck: new Deck(makeDeck(), makeRng(seed)),
    damageDealt: 0,
  };
}

export class Game {
  constructor(seed = 1) {
    this.seed = seed >>> 0;
    this.rng = makeRng(this.seed);
    this.phase = 'title';
    this.turn = 0;
    this.player = newSide(this.seed ^ 0x9e3779b9);
    this.rival = newSide(this.seed ^ 0x51ed2703);
    this.log = [];
    this.score = 0;
    this.winner = null;
    this.lastPlay = null; // { by, card, edge, damage } for the float text
    this.listeners = new Set();
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(this); }

  say(text) {
    this.log.unshift(text);
    if (this.log.length > 6) this.log.length = 6;
  }

  startGame() {
    this.phase = 'play';
    this.turn = 1;
    this.player.mana = this.player.maxMana = maxManaForTurn(1);
    this.rival.mana = this.rival.maxMana = maxManaForTurn(1);
    this.player.deck.draw(HAND_SIZE, HAND_CAP);
    this.rival.deck.draw(HAND_SIZE, HAND_CAP);
    this.say('The duel begins. Your sigils answer your call.');
    this.refreshIntent();
    this.emit();
  }

  // The rival's intent, refreshed whenever the player can act on it.
  refreshIntent() {
    this.intent = rivalIntent(
      this.rival.deck.hand.map((c) => CARD_BY_ID[c.typeId]),
      this.rival.maxMana, this.rival, this.player,
    );
  }

  manaFor(turn) { return maxManaForTurn(turn); }

  // Resolve one card's ops. Damage reads the edge bonus: an attack whose
  // element beats the defender's ward deals +3. Block absorbs first.
  // Returns the damage actually dealt to life (for score and floats).
  applyOps(by, card, target) {
    const attacker = by === 'player' ? this.player : this.rival;
    const defender = target === 'player' ? this.player : this.rival;
    let dealt = 0;
    for (const op of card.ops) {
      if (op.op === 'damage') {
        let value = op.value;
        const edge = elementBeats(card.element, defender.ward);
        if (edge) value += 3;
        const absorbed = Math.min(defender.block, value);
        defender.block -= absorbed;
        const toLife = value - absorbed;
        defender.hp = Math.max(0, defender.hp - toLife);
        dealt += toLife;
        attacker.damageDealt += toLife;
        this.lastPlay = { by, card, edge, damage: toLife, absorbed };
      } else if (op.op === 'block') {
        attacker.block += op.value;
      } else if (op.op === 'heal') {
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + op.value);
      } else if (op.op === 'draw') {
        attacker.deck.draw(op.value, HAND_CAP);
      } else if (op.op === 'mana') {
        attacker.mana += op.value;
      }
    }
    // Playing a card sets the player's ward to its element.
    attacker.ward = card.element;
    return dealt;
  }

  // Play a card from the player's hand by uid. Validates cost first, then
  // commits: nothing changes on an illegal play.
  playCard(uid) {
    if (this.phase !== 'play') return false;
    const inst = this.player.deck.hand.find((c) => c.uid === uid);
    if (!inst) return false;
    const card = CARD_BY_ID[inst.typeId];
    if (this.player.mana < card.cost) {
      this.say(`Not enough mana for ${card.name}.`);
      this.emit();
      return false;
    }
    this.player.mana -= card.cost;
    this.player.deck.toLimbo(uid);
    const dealt = this.applyOps('player', card, 'rival');
    this.player.deck.limboToDiscard(uid);
    const edge = this.lastPlay && this.lastPlay.edge ? ' Edge! +3.' : '';
    this.say(`You play ${card.name}.${edge}${dealt ? ` It deals ${dealt}.` : ''}`);
    this.updateScore();
    if (this.checkEnd()) { this.emit(); return true; }
    this.emit();
    return true;
  }

  endTurn() {
    if (this.phase !== 'play') return;
    this.say('You end your turn.');
    this.rivalTurn();
    if (this.phase !== 'play') { this.emit(); return; }
    this.turn += 1;
    this.player.block = 0;
    this.player.mana = this.player.maxMana = maxManaForTurn(this.turn);
    this.player.deck.draw(2, HAND_CAP);
    while (this.player.deck.hand.length < HAND_SIZE) {
      if (this.player.deck.draw(1, HAND_CAP).length === 0) break;
    }
    this.refreshIntent();
    this.say(`Turn ${this.turn}. Mana refilled to ${this.player.mana}.`);
    this.emit();
  }

  rivalTurn() {
    this.rival.block = 0;
    this.rival.mana = this.rival.maxMana = maxManaForTurn(this.turn);
    this.rival.deck.draw(2, HAND_CAP);
    const hand = this.rival.deck.hand.map((c) => CARD_BY_ID[c.typeId]);
    const plan = planRivalTurn(hand, this.rival.mana, this.rival, this.player);
    for (const card of plan) {
      if (this.phase !== 'play') break;
      const inst = this.rival.deck.hand.find((c) => c.typeId === card.id);
      if (!inst) continue;
      this.rival.mana -= card.cost;
      this.rival.deck.toLimbo(inst.uid);
      const dealt = this.applyOps('rival', card, 'player');
      this.rival.deck.limboToDiscard(inst.uid);
      const edge = this.lastPlay && this.lastPlay.edge ? ' Edge! +3.' : '';
      this.say(`Rival plays ${card.name}.${edge}${dealt ? ` It deals ${dealt}.` : ''}`);
      if (this.checkEnd()) return;
    }
    if (plan.length === 0) this.say('The rival holds its cards.');
    this.updateScore();
  }

  updateScore() {
    const turnsBonus = Math.max(0, 10 - this.turn) * 5;
    this.score = this.player.damageDealt + Math.max(0, this.player.hp) * 2 + turnsBonus;
  }

  checkEnd() {
    if (this.rival.hp <= 0) {
      this.phase = 'win';
      this.winner = 'player';
      this.updateScore();
      this.say(`Victory! The rival's sigils go dark. Score ${this.score}.`);
      return true;
    }
    if (this.player.hp <= 0) {
      this.phase = 'loss';
      this.winner = 'rival';
      this.updateScore();
      this.say(`Defeat. Your sigils scatter. Score ${this.score}.`);
      return true;
    }
    return false;
  }

  restart(seed) {
    const fresh = new Game(seed === undefined ? (this.seed + 1) >>> 0 : seed >>> 0);
    this.seed = fresh.seed;
    this.rng = fresh.rng;
    this.phase = fresh.phase;
    this.turn = fresh.turn;
    this.player = fresh.player;
    this.rival = fresh.rival;
    this.log = fresh.log;
    this.score = 0;
    this.winner = null;
    this.lastPlay = null;
    this.intent = null;
    this.startGame();
  }
}
