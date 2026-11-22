// Ember Sigils — seeded shuffle and the draw / discard piles.
// Pure logic: no DOM, no network. One Pile per fighter, 20 cards each.

import { CARD_DEFS, DECK_SIZE } from "./cards.js";

// Small deterministic PRNG so a seed replays the same shuffles.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function fisherYates(list, rand) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
  return list;
}

export class Pile {
  constructor(seed, side) {
    this.side = side;
    this.rand = mulberry32(seed);
    this.stock = []; // draw pile; the top card is the last element
    this.grave = []; // discard pile
  }

  // Two copies of each of the ten kinds, shuffled once.
  fill() {
    const instances = [];
    for (const def of CARD_DEFS) {
      for (let copy = 0; copy < 2; copy++) {
        instances.push({ uid: `${this.side}:${def.id}#${copy + 1}`, def });
      }
    }
    fisherYates(instances, this.rand);
    this.stock = instances;
    return this;
  }

  // Take one card, reshuffling the discard pile when the stock runs dry.
  takeOne() {
    if (this.stock.length === 0) {
      if (this.grave.length === 0) return null;
      this.stock = this.grave;
      this.grave = [];
      fisherYates(this.stock, this.rand);
    }
    return this.stock.pop();
  }

  // Draw n cards into a hand. Over the hand cap, the extra card is
  // discarded straight away ("burned") instead of vanishing.
  drawInto(hand, n, cap) {
    let drawn = 0;
    let burned = 0;
    for (let i = 0; i < n; i++) {
      const card = this.takeOne();
      if (!card) break;
      if (hand.length >= cap) {
        this.grave.push(card);
        burned++;
      } else {
        hand.push(card);
        drawn++;
      }
    }
    return { drawn, burned };
  }

  // Cards this pile still owns (stock + discard; the hand is counted
  // by the duel when it validates the 20-card invariant).
  restingCount() {
    return this.stock.length + this.grave.length;
  }
}

export { DECK_SIZE };
