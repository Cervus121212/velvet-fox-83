// deck.js — zones and shuffling for Ember Sigils.
// Every card instance has a unique uid and lives in exactly one zone:
// draw pile, hand, discard, or limbo (in play while it resolves). A move
// is remove-from-one-list plus append-to-another, never a copy, so a card
// can never sit in two zones or vanish. The deck owns a seeded generator
// of its own, so the same seed with the same inputs replays the same game.

// mulberry32: a small seeded generator with a full 32-bit period.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher-Yates with an inclusive upper bound: each position swaps with a
// uniformly chosen earlier-or-equal one. Never sort by a random
// comparator — that biases the shuffle.
export function shuffleInPlace(list, rng) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

let nextUid = 1;

export class Deck {
  constructor(cardIds, rng) {
    this.rng = rng;
    // Instances, not ids: two copies of one type are distinct cards.
    this.drawPile = cardIds.map((id) => ({ uid: nextUid++, typeId: id }));
    shuffleInPlace(this.drawPile, rng);
    this.hand = [];
    this.discard = [];
    this.limbo = [];
  }

  // Draw n cards into the hand. An empty draw pile reshuffles the discard
  // (shuffled, so the order is new); with neither pile left, drawing
  // simply stops. A hand over the cap burns the extra card to discard.
  draw(n, handCap = 7) {
    const drawn = [];
    for (let i = 0; i < n; i += 1) {
      if (this.drawPile.length === 0) {
        if (this.discard.length === 0) break;
        this.drawPile = shuffleInPlace(this.discard, this.rng);
        this.discard = [];
      }
      const card = this.drawPile.pop();
      if (this.hand.length >= handCap) {
        this.discard.push(card);
      } else {
        this.hand.push(card);
        drawn.push(card);
      }
    }
    return drawn;
  }

  // Move a card out of the hand into limbo while its effects resolve, so
  // a draw effect can never reshuffle the card being played back in.
  toLimbo(uid) {
    const at = this.hand.findIndex((c) => c.uid === uid);
    if (at === -1) return null;
    const [card] = this.hand.splice(at, 1);
    this.limbo.push(card);
    return card;
  }

  // After resolution the card leaves limbo for the discard pile.
  limboToDiscard(uid) {
    const at = this.limbo.findIndex((c) => c.uid === uid);
    if (at === -1) return;
    this.discard.push(this.limbo.splice(at, 1)[0]);
  }

  // Zone invariant, used by tests: every uid appears exactly once.
  countAll() {
    return this.drawPile.length + this.hand.length + this.discard.length + this.limbo.length;
  }

  handIds() {
    return this.hand.map((c) => c.uid);
  }
}
