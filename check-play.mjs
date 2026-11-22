// Ember Sigils — interactive play-test with real mouse clicks.
// Plays two full games in headless Chrome (seed 7): one aggressive
// (expect a win) and one passive (expect a loss). Reports the final
// phase, score, round and any console errors. Usage: node check-play.mjs

import {
  closeTab,
  kill,
  launchChrome,
  launchServer,
  openTab,
  sleep,
  waitFor,
  waitForChrome,
  waitForServer,
  GAME_BASE,
} from "./cdp.mjs";

async function playGame(cdp, seed, style) {
  const url = `${GAME_BASE}/index.html?seed=${seed}`;
  await cdp.send("Page.navigate", { url });
  await waitFor(() => cdp.eval("window.__duel ? true : null"), 15000, "duel boot");
  await cdp.realClick("#begin-btn");
  let rounds = 0;
  while (rounds < 40) {
    const s = await cdp.eval("window.__snapshot()");
    if (!s || s.phase === "won" || s.phase === "lost") {
      return { ...s, style, seed, errors: cdp.consoleErrors };
    }
    if (s.turn !== "you") {
      await sleep(200);
      continue;
    }
    // Pick a card the way this style plays.
    let pick = null;
    if (style === "bold") {
      const dmg = s.you.hand.filter((c) => c.effect.damage && c.cost <= s.you.mana);
      pick = dmg.sort((a, b) => (b.effect.damage || 0) - (a.effect.damage || 0))[0] || null;
    } else {
      pick = s.you.hand.find((c) => !c.effect.damage && c.cost <= s.you.mana) || null;
    }
    if (pick) {
      await cdp.realClick(`[data-uid="${pick.uid}"]`);
    } else {
      await cdp.realClick("#end-turn");
    }
    rounds++;
    await sleep(150);
  }
  const s = await cdp.eval("window.__snapshot()");
  return { ...s, style, seed, stalled: true, errors: cdp.consoleErrors };
}

const server = launchServer(process.cwd());
const chrome = launchChrome();
const report = [];
try {
  await waitForServer();
  await waitForChrome();
  for (const style of ["bold", "meek"]) {
    const { cdp, target } = await openTab("about:blank");
    try {
      const r = await playGame(cdp, 7, style);
      report.push({
        style: r.style,
        seed: r.seed,
        phase: r.phase,
        round: r.round,
        score: r.score,
        damageDealt: r.damageDealt,
        youHp: r.you ? r.you.hp : null,
        rivalHp: r.rival ? r.rival.hp : null,
        errors: r.errors,
        stalled: !!r.stalled,
      });
      console.log(`${style}: phase=${r.phase} round=${r.round} score=${r.score} dmg=${r.damageDealt} youHp=${r.you?.hp} rivalHp=${r.rival?.hp} errors=${r.errors.length}`);
      if (r.errors.length) console.log("  errors:", r.errors.slice(0, 5));
    } finally {
      cdp.close();
      await closeTab(target.id);
    }
  }
} finally {
  kill(chrome);
  kill(server);
}

const bad = report.filter((r) => r.errors.length > 0 || r.stalled);
if (bad.length) {
  console.log("PLAY-TEST PROBLEMS:", JSON.stringify(bad, null, 2));
  process.exit(1);
}
console.log("play-test done");
