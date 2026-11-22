// input.js — mouse and keyboard for Ember Sigils.
// Click a card to play it; click End Turn (or press Enter/Space) to pass.
// Keys 1–7 play the hand left to right. R restarts, M mutes. Every action
// goes through the same handlers the mouse uses, so the two agree.

export function bindInput(root, game, audio, onAction) {
  function playUid(uid) {
    const ok = game.playCard(uid);
    if (ok) {
      audio.play();
      if (game.lastPlay) {
        const side = game.lastPlay.by === 'player' ? 'rival' : 'player';
        const text = game.lastPlay.damage > 0 ? `-${game.lastPlay.damage}` : '';
        if (text) {
          import('./render.js').then(({ floatDamage }) => {
            floatDamage(root, side, text, game.lastPlay.edge);
          });
        }
        if (game.lastPlay.damage > 0) audio.hit();
      }
    } else {
      audio.deny();
    }
    onAction();
  }

  root.addEventListener('click', (event) => {
    const cardBtn = event.target.closest('.card[data-uid]');
    if (cardBtn) {
      playUid(Number(cardBtn.dataset.uid));
      return;
    }
    if (event.target.closest('#end-turn')) {
      game.endTurn();
      audio.endTurn();
      onAction();
      return;
    }
    if (event.target.closest('#start-btn') || event.target.closest('#again-btn')) {
      game.startGame();
      audio.start();
      onAction();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const key = event.key;
    if (game.phase === 'title' && (key === 'Enter' || key === ' ')) {
      game.startGame();
      audio.start();
      onAction();
      return;
    }
    if ((game.phase === 'win' || game.phase === 'loss') && (key === 'Enter' || key === ' ' || key.toLowerCase() === 'r')) {
      game.restart();
      audio.start();
      onAction();
      return;
    }
    if (game.phase !== 'play') return;
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      game.endTurn();
      audio.endTurn();
      onAction();
      return;
    }
    if (key.toLowerCase() === 'r') {
      game.restart();
      audio.start();
      onAction();
      return;
    }
    if (key.toLowerCase() === 'm') {
      audio.toggleMute();
      onAction();
      return;
    }
    const n = Number(key);
    if (Number.isInteger(n) && n >= 1 && n <= 7) {
      const inst = game.player.deck.hand[n - 1];
      if (inst) playUid(inst.uid);
    }
  });
}
