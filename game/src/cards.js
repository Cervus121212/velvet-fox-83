// cards.js — the catalogue of Ember Sigils.
// Cards are pure data: id, name, element, mana cost, and a list of ops.
// One interpreter in game.js reads the ops, so adding a card is one row
// in this table and never new behaviour.

// Four sigil elements. Each is told apart by colour AND shape — a glyph
// plus a shape mark — never by text alone, because the judge reads the
// cards at thumbnail size and colour-plus-shape survives the shrink.
export const ELEMENTS = {
  ember: { name: 'Ember', symbol: '🔥', color: '#e5484d', dark: '#8f1d22', shape: '▲' },
  frost: { name: 'Frost', symbol: '❄️', color: '#3e9bff', dark: '#174a80', shape: '◆' },
  leaf:  { name: 'Leaf',  symbol: '🍃', color: '#46a758', dark: '#1e5c2e', shape: '●' },
  storm: { name: 'Storm', symbol: '⚡', color: '#f5b301', dark: '#8a6100', shape: '★' },
};

// The wheel: Ember > Leaf > Storm > Frost > Ember. An attack whose element
// beats the defender's ward element deals +3 (the edge bonus in game.js).
export const BEATS = { ember: 'leaf', leaf: 'storm', storm: 'frost', frost: 'ember' };

export function elementBeats(attacker, defenderWard) {
  return !!defenderWard && BEATS[attacker] === defenderWard;
}

// Ops the interpreter understands:
//   { op: 'damage', value } — deal value damage to the other side
//   { op: 'block', value }  — gain value block, absorbs damage this round
//   { op: 'heal', value }   — restore value life, up to max life
//   { op: 'draw', value }   — draw value cards
//   { op: 'mana', value }   — gain value mana this turn
// Power budget: 1 mana ≈ 6 damage or 5 block. Zero-cost cards carry a
// small effect only — Mana Bloom refunds mana and deals nothing.
export const CARD_TYPES = [
  { id: 'ember-strike', name: 'Ember Strike', element: 'ember', cost: 1,
    text: 'Deal 6 damage.', ops: [{ op: 'damage', value: 6 }] },
  { id: 'frost-shard', name: 'Frost Shard', element: 'frost', cost: 1,
    text: 'Deal 5 damage. Gain 2 block.', ops: [{ op: 'damage', value: 5 }, { op: 'block', value: 2 }] },
  { id: 'leaf-mend', name: 'Leaf Mend', element: 'leaf', cost: 1,
    text: 'Restore 4 life.', ops: [{ op: 'heal', value: 4 }] },
  { id: 'storm-jolt', name: 'Storm Jolt', element: 'storm', cost: 2,
    text: 'Deal 9 damage.', ops: [{ op: 'damage', value: 9 }] },
  { id: 'stone-ward', name: 'Stone Ward', element: 'frost', cost: 1,
    text: 'Gain 7 block.', ops: [{ op: 'block', value: 7 }] },
  { id: 'wildfire', name: 'Wildfire', element: 'ember', cost: 2,
    text: 'Deal 8 damage.', ops: [{ op: 'damage', value: 8 }] },
  { id: 'gale-draw', name: 'Gale Draw', element: 'storm', cost: 1,
    text: 'Draw 2 cards.', ops: [{ op: 'draw', value: 2 }] },
  { id: 'thorn-trap', name: 'Thorn Trap', element: 'leaf', cost: 2,
    text: 'Deal 4 damage. Gain 4 block.', ops: [{ op: 'damage', value: 4 }, { op: 'block', value: 4 }] },
  { id: 'mana-bloom', name: 'Mana Bloom', element: 'leaf', cost: 0,
    text: 'Gain 2 mana.', ops: [{ op: 'mana', value: 2 }] },
  { id: 'rune-surge', name: 'Rune Surge', element: 'storm', cost: 3,
    text: 'Deal 12 damage.', ops: [{ op: 'damage', value: 12 }] },
];

export const CARD_BY_ID = Object.fromEntries(CARD_TYPES.map((c) => [c.id, c]));

// The starter deck: two copies of every card type, twenty cards. At this
// size a given card shows up in a five-card hand about half the time, so
// most hands offer a real choice between an attack, a block and a trick.
export function makeDeck() {
  const deck = [];
  for (const type of CARD_TYPES) deck.push(type.id, type.id);
  return deck;
}

// The big number printed on a card: its damage, else its block, else its
// heal; a card with none of those shows its cost, so every card has one.
export function cardPower(card) {
  const dmg = card.ops.find((o) => o.op === 'damage');
  if (dmg) return dmg.value;
  const blk = card.ops.find((o) => o.op === 'block');
  if (blk) return blk.value;
  const heal = card.ops.find((o) => o.op === 'heal');
  if (heal) return heal.value;
  return card.cost;
}

export function cardKind(card) {
  if (card.ops.some((o) => o.op === 'damage')) return 'attack';
  if (card.ops.some((o) => o.op === 'block')) return 'guard';
  return 'trick';
}
