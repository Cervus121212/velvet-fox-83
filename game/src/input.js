// Ember Sigils — input: mouse clicks and keyboard shortcuts.
// Click a card to play it; End Turn (or Enter / Space) passes to the
// rival. Keys 1-7 play the matching hand slot, R restarts, M mutes.

export function bindControls(duel, view, sfx) {
  const hand = document.getElementById("hand");
  const endTurnBtn = document.getElementById("end-turn");
  const beginBtn = document.getElementById("begin-btn");
  const againBtn = document.getElementById("again-btn");
  const muteBtn = document.getElementById("mute-btn");

  function afterPlay(result) {
    if (result && result.ok) sfx.play();
    view.render();
  }

  hand.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-uid]");
    if (!btn) return;
    sfx.unlock();
    afterPlay(duel.playCard("you", btn.dataset.uid));
  });

  endTurnBtn.addEventListener("click", () => {
    sfx.unlock();
    if (duel.endTurn()) sfx.endTurn();
    view.render();
  });

  beginBtn.addEventListener("click", () => {
    sfx.unlock();
    duel.start();
    sfx.begin();
    view.render();
  });

  againBtn.addEventListener("click", () => {
    sfx.unlock();
    duel.reset();
    sfx.begin();
    view.render();
  });

  muteBtn.addEventListener("click", () => {
    sfx.muted = !sfx.muted;
    view.render();
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key >= "1" && ev.key <= "7") {
      const idx = Number(ev.key) - 1;
      const card = duel.you.hand[idx];
      if (card && duel.phase === "play" && duel.turn === "you") {
        sfx.unlock();
        afterPlay(duel.playCard("you", card.uid));
      }
      return;
    }
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      if (duel.phase === "title") {
        sfx.unlock();
        duel.start();
        sfx.begin();
      } else if (duel.endTurn()) {
        sfx.endTurn();
      }
      view.render();
      return;
    }
    if (ev.key === "r" || ev.key === "R") {
      if (duel.phase !== "title") {
        duel.reset();
        sfx.begin();
        view.render();
      }
      return;
    }
    if (ev.key === "m" || ev.key === "M") {
      sfx.muted = !sfx.muted;
      view.render();
    }
  });
}
