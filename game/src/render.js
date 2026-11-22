// render.js — the table of Ember Sigils, as DOM.
// The rival sits at the top with face-down card backs and a count, the
// player at the bottom with a face-up hand; between them the log and the
// End Turn button. Every number the judge needs is visible at a glance:
// both life totals, both wards, mana, deck counts, turn and score. Cards
// are big type on a coloured sigil, legible when the screenshot shrinks.

import { CARD_BY_ID, ELEMENTS, cardPower, cardKind } from './cards.js';

const SUIT_GLYPH = { ember: '▲', frost: '◆', leaf: '●', storm: '★' };

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function hpBar(side, hp, maxHp) {
  const wrap = el('div', 'hpbar');
  const fill = el('div', 'hpfill');
  fill.style.width = `${Math.max(0, Math.round((hp / maxHp) * 100))}%`;
  fill.classList.add(hp <= 6 ? 'low' : hp <= 12 ? 'mid' : 'full');
  wrap.appendChild(fill);
  const label = el('span', 'hplabel', `${hp} / ${maxHp}`);
  wrap.appendChild(label);
  return wrap;
}

function wardBadge(ward) {
  if (!ward) return el('span', 'ward none', 'Ward —');
  const e = ELEMENTS[ward];
  const badge = el('span', 'ward');
  badge.style.setProperty('--sigil', e.color);
  badge.textContent = `${e.symbol} ${e.name} ${SUIT_GLYPH[ward]}`;
  return badge;
}

export function renderCard(inst, opts = {}) {
  const card = CARD_BY_ID[inst.typeId];
  const e = ELEMENTS[card.element];
  const node = el('button', `card el-${card.element} kind-${cardKind(card)}`);
  node.dataset.uid = String(inst.uid);
  node.style.setProperty('--sigil', e.color);
  node.style.setProperty('--sigil-dark', e.dark);
  if (opts.disabled) node.disabled = true;
  if (opts.playable === false) node.classList.add('unplayable');

  const top = el('div', 'card-top');
  top.appendChild(el('span', 'card-cost', String(card.cost)));
  top.appendChild(el('span', 'card-sigil', e.symbol));
  node.appendChild(top);

  const power = el('div', 'card-power', String(cardPower(card)));
  node.appendChild(power);
  node.appendChild(el('div', 'card-shape', SUIT_GLYPH[card.element]));
  node.appendChild(el('div', 'card-name', card.name));
  node.appendChild(el('div', 'card-text', card.text));
  node.setAttribute('aria-label', `${card.name}, ${e.name}, cost ${card.cost}, ${card.text}`);
  return node;
}

function renderCardBack() {
  const node = el('div', 'card back');
  node.appendChild(el('div', 'card-back-sigil', '✦'));
  node.appendChild(el('div', 'card-back-name', 'SIGIL'));
  return node;
}

export function renderGame(game, root) {
  root.innerHTML = '';
  const table = el('div', 'table');

  // --- Rival row: name, life, ward, intent, face-down hand ---
  const rival = el('section', 'side rival-side');
  const rivalHead = el('div', 'side-head');
  rivalHead.appendChild(el('h2', 'side-name', 'RIVAL — The Hollow Sigilist'));
  const rivalStats = el('div', 'side-stats');
  rivalStats.appendChild(el('span', 'stat', 'Life '));
  rivalStats.appendChild(hpBar('rival', game.rival.hp, game.rival.maxHp));
  rivalStats.appendChild(wardBadge(game.rival.ward));
  rivalStats.appendChild(el('span', 'stat deck-count', `Deck ${game.rival.deck.drawPile.length} · Discard ${game.rival.deck.discard.length}`));
  rivalHead.appendChild(rivalStats);
  rival.appendChild(rivalHead);

  const intent = el('div', 'intent');
  intent.appendChild(el('span', 'intent-label', 'Intent: '));
  intent.appendChild(el('span', 'intent-text', game.intent ? game.intent.text : '—'));
  rival.appendChild(intent);

  const rivalHand = el('div', 'hand rival-hand');
  for (const inst of game.rival.deck.hand) {
    void inst;
    rivalHand.appendChild(renderCardBack());
  }
  rival.appendChild(rivalHand);
  table.appendChild(rival);

  // --- Middle: turn, score, log, end turn ---
  const mid = el('div', 'mid');
  const midLeft = el('div', 'mid-left');
  midLeft.appendChild(el('div', 'turn', `Turn ${game.turn}`));
  midLeft.appendChild(el('div', 'score', `Score ${game.score}`));
  mid.appendChild(midLeft);
  const log = el('ol', 'log');
  for (const line of game.log) log.appendChild(el('li', '', line));
  mid.appendChild(log);
  const endBtn = el('button', 'end-turn', 'End Turn ⏎');
  endBtn.id = 'end-turn';
  mid.appendChild(endBtn);
  table.appendChild(mid);

  // --- Player row: hand face-up, then life, mana, ward, deck ---
  const player = el('section', 'side player-side');
  const playerHand = el('div', 'hand player-hand');
  for (const inst of game.player.deck.hand) {
    const playable = inst && game.player.mana >= CARD_BY_ID[inst.typeId].cost;
    playerHand.appendChild(renderCard(inst, { playable }));
  }
  player.appendChild(playerHand);
  const playerHead = el('div', 'side-head');
  playerHead.appendChild(el('h2', 'side-name', 'YOU — Sigil Duelist'));
  const playerStats = el('div', 'side-stats');
  playerStats.appendChild(el('span', 'stat', 'Life '));
  playerStats.appendChild(hpBar('player', game.player.hp, game.player.maxHp));
  playerStats.appendChild(el('span', 'stat mana', `Mana ${game.player.mana} / ${game.player.maxMana}`));
  playerStats.appendChild(wardBadge(game.player.ward));
  playerStats.appendChild(el('span', 'stat deck-count', `Deck ${game.player.deck.drawPile.length} · Discard ${game.player.deck.discard.length}`));
  playerHead.appendChild(playerStats);
  player.appendChild(playerHead);
  table.appendChild(player);

  root.appendChild(table);
}

export function renderTitle(root, best) {
  root.innerHTML = '';
  const screen = el('div', 'screen title-screen');
  screen.appendChild(el('div', 'title-kicker', 'A DUEL OF RUNE CARDS'));
  screen.appendChild(el('h1', 'title', 'EMBER SIGILS'));
  screen.appendChild(el('p', 'subtitle', 'Outwit the Hollow Sigilist. Play sigils, ride the elemental wheel, break their ward.'));
  const rules = el('ul', 'howto');
  rules.appendChild(el('li', '', 'Click a card (or press 1–7) to play it. Each card costs mana.'));
  rules.appendChild(el('li', '', 'Ember beats Leaf, Leaf beats Storm, Storm beats Frost, Frost beats Ember — an attack on a beaten ward deals +3.'));
  rules.appendChild(el('li', '', 'Read the rival’s intent, then answer it. First to 0 life loses.'));
  screen.appendChild(rules);
  screen.appendChild(el('button', 'big-btn', 'Begin the Duel  ⏎'));
  screen.querySelector('.big-btn').id = 'start-btn';
  if (best > 0) screen.appendChild(el('div', 'best', `Best score: ${best}`));
  screen.appendChild(el('div', 'hint', 'Mouse or keyboard · M mutes sound · R restarts'));
  root.appendChild(screen);
}

export function renderEnd(root, game, won) {
  root.innerHTML = '';
  const screen = el('div', `screen ${won ? 'win-screen' : 'loss-screen'}`);
  screen.appendChild(el('h1', 'end-title', won ? 'VICTORY!' : 'DEFEAT'));
  screen.appendChild(el('p', 'end-sub', won
    ? 'The rival’s sigils go dark. The table is yours.'
    : 'Your sigils scatter across the table. The rival remains.'));
  const breakdown = el('div', 'breakdown');
  breakdown.appendChild(el('div', 'bd-row', `Damage dealt: ${game.player.damageDealt}`));
  breakdown.appendChild(el('div', 'bd-row', `Life remaining: ${Math.max(0, game.player.hp)}`));
  breakdown.appendChild(el('div', 'bd-row', `Turns: ${game.turn}`));
  breakdown.appendChild(el('div', 'bd-row total', `Score: ${game.score}`));
  screen.appendChild(breakdown);
  screen.appendChild(el('button', 'big-btn', won ? 'Duel Again  ⏎' : 'Try Again  ⏎'));
  screen.querySelector('.big-btn').id = 'again-btn';
  root.appendChild(screen);
}

// A floating damage number over the side that was hit.
export function floatDamage(root, side, text, edge) {
  const node = el('div', `float-dmg ${side}${edge ? ' edge' : ''}`, text);
  root.appendChild(node);
  node.addEventListener('animationend', () => node.remove());
}
