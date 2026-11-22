// check-play.mjs — interactive play-test for Ember Sigils (not shipped).
// Drives the real game in headless Chromium: starts a duel, clicks cards
// and End Turn until the game ends, and reports win/loss plus the state
// after every action. Run: node check-play.mjs [--seed N] [--mode win|lose]
//   --mode win plays the best damage each turn; --mode lose never plays.
// A win run and a lose run together prove both end screens are reachable
// by play, not only by the scripted shot states.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
const seed = Number(args.get('--seed') ?? '7');
const mode = args.get('--mode') ?? 'win';
const chrome = '/opt/meta-chromium/chrome';
const port = 9338;
const profile = `/tmp/check-play-profile-${port}-${Date.now()}`;
const policyFile = '/tmp/webgl-policy.txt';
const policySha = createHash('sha256').update(readFileSync(policyFile)).digest('hex');
const pageUrl = `file:///home/hatch/workspace/makefun/best-card-game-20261122-1826-r2/game/index.html?seed=${seed}`;

const proc = spawn(chrome, [
  '--headless=new', `--remote-debugging-port=${port}`, '--no-sandbox', '--disable-gpu',
  '--allow-file-access-from-files',
  `--hatch-webgl-allowed-domains-file=${policyFile}`,
  `--hatch-webgl-allowed-domains-sha256=${policySha}`,
  '--window-size=1280,857', '--hide-scrollbars', `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });

async function getPageTarget() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page');
      if (page) return page;
    } catch { /* not up yet */ }
    await sleep(500);
  }
  throw new Error('no page target');
}
const target = await getPageTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let nextId = 1;
const pending = new Map();
const errors = [];
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id !== undefined && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    errors.push(msg.params.exceptionDetails?.text ?? 'exception');
  } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    errors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
  }
};
function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evalJs(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description ?? ''));
  return r.result?.value;
}
await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url: pageUrl });
await sleep(1500);

// Start the duel.
await evalJs(`document.querySelector('#start-btn')?.click(); 'started'`);
await sleep(400);

let outcome = 'unfinished';
for (let turn = 1; turn <= 15; turn += 1) {
  const state = await evalJs(`(() => {
    const end = document.querySelector('.win-screen, .loss-screen');
    if (end) return { phase: end.classList.contains('win-screen') ? 'win' : 'loss',
      score: document.querySelector('.bd-row.total')?.textContent ?? '' };
    const hp = [...document.querySelectorAll('.hplabel')].map((e) => e.textContent);
    const turnEl = document.querySelector('.turn')?.textContent ?? '';
    const mana = document.querySelector('.mana')?.textContent ?? '';
    const playable = [...document.querySelectorAll('.player-hand .card:not(.unplayable):not(:disabled)')].length;
    return { phase: 'play', hp, turnEl, mana, playable };
  })()`);
  console.log(`turn ${turn}:`, JSON.stringify(state));
  if (state.phase === 'win' || state.phase === 'loss') { outcome = state.phase; break; }
  if (mode === 'win') {
    // Play the highest-power affordable card, up to 3, then end turn.
    for (let k = 0; k < 3; k += 1) {
      const played = await evalJs(`(() => {
        const cards = [...document.querySelectorAll('.player-hand .card:not(.unplayable):not(:disabled)')];
        if (!cards.length) return false;
        cards.sort((a, b) => Number(b.querySelector('.card-power')?.textContent || 0) - Number(a.querySelector('.card-power')?.textContent || 0));
        cards[0].click();
        return true;
      })()`);
      await sleep(150);
      if (!played) break;
    }
  }
  await evalJs(`document.querySelector('#end-turn')?.click(); 'ended'`);
  await sleep(400);
}
console.log(`OUTCOME mode=${mode} seed=${seed}: ${outcome}`);
console.log('console errors:', errors.length ? errors.join(' | ') : 'none');
if (outcome !== 'unfinished') {
  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
  writeFileSync(`/tmp/check-play-${mode}-seed${seed}.jpg`, Buffer.from(shot.data, 'base64'));
  console.log(`end screenshot: /tmp/check-play-${mode}-seed${seed}.jpg`);
}
ws.close();
proc.kill();
