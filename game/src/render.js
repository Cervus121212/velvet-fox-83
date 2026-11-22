// Ember Sigils — DOM renderer. Reads duel.snapshot() and paints the
// table: rival panel, intent, log, player panel and hand of cards.
// No game rules live here; this file only turns state into HTML.

import { ELEMENTS, MAX_HP, effectText, manaForRound } from "./cards.js";

const IDS = [
  "score", "round", "turn-banner",
  "rival-hp-num", "rival-hp-fill", "rival-mana", "rival-block",
  "rival-ward", "rival-hand", "rival-intent",
  "you-hp-num", "you-hp-fill", "you-mana", "you-block", "you-ward",
  "hand", "hand-count", "log",
  "title-screen", "end-screen", "end-title", "end-sub", "end-stats",
  "mute-btn", "end-turn",
];

function esc(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function manaPips(mana) {
  let out = "";
  for (let i = 0; i < 5; i++) out += i < mana ? "●" : "○";
  return out;
}

function wardLabel(ward) {
  if (!ward) return "— none —";
  const el = ELEMENTS[ward];
  return `${el.glyph} ${el.label}`;
}

export class Renderer {
  constructor(duel, sfx) {
    this.duel = duel;
    this.sfx = sfx;
    this.el = {};
    for (const id of IDS) this.el[id] = document.getElementById(id);
  }

  cardHtml(card, playable) {
    const el = ELEMENTS[card.element];
    const cls = playable ? "card playable" : "card dimmed";
    return (
      `<button type="button" class="${cls} el-${card.element}" data-uid="${esc(card.uid)}">` +
      `<span class="cost" style="--el:${el.color}">${card.cost}</span>` +
      `<span class="glyph" style="color:${el.color}">${el.glyph}</span>` +
      `<span class="cname">${esc(card.name)}</span>` +
      `<span class="ceffect">${esc(effectText(card))}</span>` +
      `<span class="celement">${el.glyph} ${el.label}</span>` +
      `</button>`
    );
  }

  render() {
    const s = this.duel.snapshot();
    const el = this.el;

    el.score.textContent = String(s.score);
    el.round.textContent = String(s.round);
    el["turn-banner"].textContent =
      s.phase === "won"
        ? "Victory — the Sigilist shatters!"
        : s.phase === "lost"
          ? "Defeat — your sigils gutter out."
          : s.turn === "you"
            ? `Round ${s.round} — your turn: play cards, then End Turn`
            : "The Hollow Sigilist is scheming…";

    // Rival panel.
    el["rival-hp-num"].textContent = `${s.rival.hp} / ${s.rival.maxHp}`;
    el["rival-hp-fill"].style.width = `${(s.rival.hp / s.rival.maxHp) * 100}%`;
    el["rival-mana"].textContent = manaPips(Math.min(5, s.rival.mana));
    el["rival-block"].textContent = s.rival.block > 0 ? `🛡 ${s.rival.block} block` : "";
    el["rival-ward"].textContent = wardLabel(s.rival.ward);
    el["rival-hand"].innerHTML = Array.from(
      { length: s.rival.handCount },
      () => `<span class="back" title="rival card">?</span>`,
    ).join("");
    el["rival-intent"].textContent =
      s.phase === "play" && s.intent.length
        ? "Rival plans: " + s.intent.map((c) => `${ELEMENTS[c.element].glyph} ${c.name} (${c.cost})`).join(" · ")
        : s.phase === "play"
          ? "Rival plans: (nothing — it holds back)"
          : "";

    // Player panel.
    el["you-hp-num"].textContent = `${s.you.hp} / ${s.you.maxHp}`;
    el["you-hp-fill"].style.width = `${(s.you.hp / s.you.maxHp) * 100}%`;
    el["you-mana"].textContent = manaPips(Math.min(5, s.you.mana));
    el["you-block"].textContent = s.you.block > 0 ? `🛡 ${s.you.block} block` : "";
    el["you-ward"].textContent = wardLabel(s.you.ward);
    el["hand-count"].textContent = `${s.you.hand.length} cards · ${s.you.mana} mana (max ${manaForRound(s.round)})`;

    el.hand.innerHTML = s.you.hand
      .map((card) => {
        const playable =
          s.phase === "play" && s.turn === "you" && card.cost <= s.you.mana;
        return this.cardHtml(card, playable);
      })
      .join("");

    el.log.innerHTML = s.log.map((line) => `<div>${esc(line)}</div>`).join("");
    el.log.scrollTop = el.log.scrollHeight;

    el["end-turn"].disabled = !(s.phase === "play" && s.turn === "you");
    el["mute-btn"].textContent = this.sfx.muted ? "Sound: off (M)" : "Sound: on (M)";

    // Overlays.
    el["title-screen"].hidden = s.phase !== "title";
    const over = s.phase === "won" || s.phase === "lost";
    el["end-screen"].hidden = !over;
    if (over) {
      const won = s.phase === "won";
      el["end-title"].textContent = won ? "★ VICTORY ★" : "☠ DEFEAT ☠";
      el["end-title"].className = won ? "win" : "lose";
      el["end-sub"].textContent = won
        ? "The Hollow Sigilist shatters into embers."
        : "Your sigils gutter out in the dark.";
      el["end-stats"].innerHTML =
        `<div><b>${s.damageDealt}</b><span>damage dealt</span></div>` +
        `<div><b>${s.you.hp}</b><span>HP left</span></div>` +
        `<div><b>${s.round}</b><span>rounds</span></div>` +
        `<div><b>${s.score}</b><span>final score</span></div>`;
    }
  }
}

export { MAX_HP };
