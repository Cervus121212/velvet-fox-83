// shot-card.mjs — headless screenshot driver for Ember Sigils.
// Launches the local Chromium, loads the game once per shot in shots.json,
// waits for window.__shotReady, and captures a JPEG. No WebGL, no network:
// the game is plain DOM, so a plain headless run is enough.
// Usage: node shot-card.mjs --chrome /opt/meta-chromium/chrome \
//   --page file:///path/to/game/index.html --shots shots.json --out screenshots
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
const chrome = args.get('--chrome');
const pageBase = args.get('--page');
const shotsFile = args.get('--shots');
const outDir = args.get('--out');
const port = Number(args.get('--port') ?? '9334');
const profile = `/tmp/shot-card-profile-${port}-${Date.now()}`;

mkdirSync(outDir, { recursive: true });
const shots = JSON.parse(readFileSync(shotsFile, 'utf8'));

// This Hatch Chromium build refuses to start without a WebGL domain
// policy file and its sha256. The file holds one line,
// `hatch-webgl-all-origins-v1`; recreate it if a VM restart wiped /tmp.
const policyFile = '/tmp/webgl-policy.txt';
const policySha = createHash('sha256').update(readFileSync(policyFile)).digest('hex');
const proc = spawn(chrome, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  '--no-sandbox',
  '--disable-gpu',
  '--allow-file-access-from-files',
  `--hatch-webgl-allowed-domains-file=${policyFile}`,
  `--hatch-webgl-allowed-domains-sha256=${policySha}`,
  '--window-size=1280,857',
  '--hide-scrollbars',
  `--user-data-dir=${profile}`,
  'about:blank',
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
  throw new Error('no page target from DevTools');
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
    if (msg.error) reject(new Error(msg.error.message));
    else resolve(msg.result);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    errors.push(msg.params.exceptionDetails?.text ?? 'exception');
    errors.push(msg.params.exceptionDetails?.exception?.description ?? '');
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

await send('Runtime.enable');
await send('Page.enable');

for (const shot of shots) {
  errors.length = 0;
  await send('Page.navigate', { url: pageBase + shot.query });
  let ready = false;
  for (let i = 0; i < 120; i += 1) {
    const result = await send('Runtime.evaluate', { expression: 'window.__shotReady === true', returnByValue: true });
    if (result?.result?.value === true) { ready = true; break; }
    await sleep(250);
  }
  if (!ready) throw new Error(`shot ${shot.name}: __shotReady never set`);
  await sleep(300);
  const shotResult = await send('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
  const buffer = Buffer.from(shotResult.data, 'base64');
  writeFileSync(`${outDir}/${shot.name}`, buffer);
  console.log(`${shot.name}: ${buffer.length} bytes${errors.length ? ` ERRORS: ${errors.join(' | ')}` : ''}`);
}

ws.close();
proc.kill();
console.log('done');
