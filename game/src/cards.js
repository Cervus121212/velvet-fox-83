// Ember Sigils — card catalogue.
// One table drives every card: element, cost and effect numbers.
// Nothing here touches the DOM; the duel engine in game.js reads it.

export const ELEMENTS = {
  ember: { key: "ember", label: "Ember", glyph: "▲", color: "#e5484d", soft: "#fdeceb" },
  frost: { key: "frost", label: "Frost", glyph: "◆", color: "#3e8fd9", soft: "#e8f2fd" },
  leaf: { key: "leaf", label: "Leaf", glyph: "●", color: "#3d9b4f", soft: "#e9f7ec" },
  storm: { key: "storm", label: "Storm", glyph: "★", color: "#c9930a", soft: "#fdf3d7" },
};

// The wheel: the key beats the value. Attacking a ward whose element
// is beaten by the played card's element adds EDGE_BONUS damage.
export const WHEEL_BEATS = {
  ember: "leaf",
  leaf: "storm",
  storm: "frost",
  frost: "ember",
};

export const EDGE_BONUS = 3;

export function elementBeats(attacker, defender) {
  if (!defender) return false;
  return WHEEL_BEATS[attacker] === defender;
}

// effect: { damage, block, heal, draw, mana } — every field optional.
export const CARD_DEFS = [
  { id: "ember-strike", name: "Ember Strike", element: "ember", cost: 1, effect: { damage: 6 }, blurb: "A searing rune bolt." },
  { id: "frost-shard", name: "Frost Shard", element: "frost", cost: 1, effect: { damage: 5, block: 2 }, blurb: "Sharp ice, and a cold guard." },
  { id: "leaf-mend", name: "Leaf Mend", element: "leaf", cost: 1, effect: { heal: 4 }, blurb: "Moss knits the wound shut." },
  { id: "storm-jolt", name: "Storm Jolt", element: "storm", cost: 2, effect: { damage: 9 }, blurb: "Lightning finds the gap." },
  { id: "stone-ward", name: "Stone Ward", element: "frost", cost: 1, effect: { block: 7 }, blurb: "A wall of packed snow." },
  { id: "wildfire", name: "Wildfire", element: "ember", cost: 2, effect: { damage: 8 }, blurb: "The whole table catches light." },
  { id: "gale-draw", name: "Gale Draw", element: "storm", cost: 1, effect: { draw: 2 }, blurb: "Wind deals two fresh runes." },
  { id: "thorn-trap", name: "Thorn Trap", element: "leaf", cost: 2, effect: { damage: 4, block: 4 }, blurb: "Thorns bite, then guard." },
  { id: "mana-bloom", name: "Mana Bloom", element: "leaf", cost: 0, effect: { mana: 2 }, blurb: "A flower opens; power spills out." },
  { id: "rune-surge", name: "Rune Surge", element: "storm", cost: 3, effect: { damage: 12 }, blurb: "Every sigil fires at once." },
];

export const DECK_SIZE = 20; // two copies of each of the ten kinds
export const HAND_CAP = 7;
export const OPENING_HAND = 5;
export const DRAW_PER_TURN = 2;
export const MAX_HP = 24;

export function manaForRound(round) {
  if (round >= 7) return 5;
  if (round >= 4) return 4;
  return 3;
}

export function cardById(id) {
  return CARD_DEFS.find((d) => d.id === id);
}

export function effectText(def) {
  const fx = def.effect;
  const bits = [];
  if (fx.damage) bits.push(`${fx.damage} damage`);
  if (fx.block) bits.push(`+${fx.block} block`);
  if (fx.heal) bits.push(`heal ${fx.heal}`);
  if (fx.draw) bits.push(`draw ${fx.draw}`);
  if (fx.mana) bits.push(`+${fx.mana} mana`);
  return bits.join(" · ");
}
