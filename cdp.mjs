// Shared headless-Chrome driver over CDP (Node 24 built-in WebSocket,
// no npm packages). Used by shot-card.mjs and check-play.mjs.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, readFileSync } from "node:fs";

export const CHROME = "/opt/meta-chromium/chrome";
export const CDP_PORT = 9222;
// Load the game straight from disk: this VM's Chromium 157 blocks
// navigation to localhost (Local Network Access checks), so http://
// never loads here. file:// needs --allow-file-access-from-files
// (added in launchChrome) for the game's ES modules to import.
export const GAME_BASE = new URL("./game/", import.meta.url).href.replace(/\/$/, "");

// This VM's Chromium refuses to start without its Hatch WebGL domain
// policy: a file switch plus the file's SHA-256. /tmp is wiped on every
// VM restart, so recreate the policy file from the backup when needed.
export function webglPolicyArgs() {
  const tmp = "/tmp/webgl-policy.txt";
  const backup = `${process.env.HOME}/workspace/makefun/webgl-policy.txt`;
  if (!existsSync(tmp) && existsSync(backup)) copyFileSync(backup, tmp);
  const bytes = readFileSync(tmp);
  const sha = createHash("sha256").update(bytes).digest("hex");
  return [
    `--hatch-webgl-allowed-domains-file=${tmp}`,
    `--hatch-webgl-allowed-domains-sha256=${sha}`,
  ];
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function waitFor(fn, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    try {
      last = await fn();
      if (last) return last;
    } catch (e) {
      last = e;
    }
    await sleep(200);
  }
  throw new Error(`timeout waiting for ${label}: ${String(last && last.message ? last.message : last)}`);
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// Minimal CDP session over one WebSocket.
export class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.consoleErrors = [];
    this.failedRequests = [];
    this.ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method === "Runtime.exceptionThrown") {
        const d = msg.params.exceptionDetails;
        this.consoleErrors.push(`exception: ${d.text} ${d.exception ? d.exception.description || "" : ""}`);
      } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
        this.consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? "").join(" "));
      } else if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
        this.consoleErrors.push(`log: ${msg.params.entry.text} ${msg.params.entry.url || ""}`);
      } else if (msg.method === "Network.loadingFailed") {
        this.failedRequests.push(msg.params.errorText);
      }
    };
  }

  ready() {
    return new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = () => reject(new Error("CDP websocket failed"));
    });
  }

  send(method, params) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 30000);
    });
  }

  async eval(expression) {
    const r = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) {
      throw new Error(`page eval failed: ${JSON.stringify(r.exceptionDetails).slice(0, 300)}`);
    }
    return r.result ? r.result.value : undefined;
  }

  // A real mouse click at the centre of the element matching selector.
  async realClick(selector) {
    const pt = await this.eval(
      `(() => { const el = document.querySelector(${JSON.stringify(selector)}); ` +
        `if (!el) return null; const r = el.getBoundingClientRect(); ` +
        `return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`,
    );
    if (!pt) throw new Error(`realClick: no element ${selector}`);
    await this.send("Input.dispatchMouseEvent", { type: "mousePressed", x: pt.x, y: pt.y, button: "left", clickCount: 1 });
    await this.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: pt.x, y: pt.y, button: "left", clickCount: 1 });
    await sleep(300);
  }

  close() {
    try {
      this.ws.close();
    } catch {
      // ignore
    }
  }
}

export function launchChrome() {
  const child = spawn(CHROME, [
    "--headless=new",
    `--remote-debugging-port=${CDP_PORT}`,
    "--window-size=1280,720",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--no-sandbox",
    "--disable-gpu",
    "--allow-file-access-from-files",
    "--user-data-dir=/tmp/ember-chrome-profile",
    ...webglPolicyArgs(),
    "about:blank",
  ], { stdio: "ignore" });
  return child;
}

export function launchServer(cwd) {
  const child = spawn("node", ["serve.ts"], { cwd, stdio: "ignore" });
  return child;
}

export async function waitForServer() {
  // With a file:// GAME_BASE there is no server to wait for.
  if (GAME_BASE.startsWith("file:")) return;
  await waitFor(async () => {
    const res = await fetch(`${GAME_BASE}/index.html`);
    return res.ok ? true : null;
  }, 15000, "game server");
}

export async function waitForChrome() {
  return waitFor(async () => {
    try {
      const list = await fetchJson(`http://localhost:${CDP_PORT}/json/list`);
      return list.length ? list : null;
    } catch {
      return null;
    }
  }, 20000, "chrome CDP");
}

// Open a fresh tab at url and return an attached, enabled Cdp session.
export async function openTab(url) {
  const target = await fetchJson(
    `http://localhost:${CDP_PORT}/json/new?${encodeURIComponent(url)}`,
    { method: "PUT" },
  );
  const cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.ready();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Log.enable");
  await cdp.send("Network.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1280, height: 720, deviceScaleFactor: 1, mobile: false,
  });
  return { cdp, target };
}

export async function closeTab(targetId) {
  try {
    await fetch(`http://localhost:${CDP_PORT}/json/close/${targetId}`);
  } catch {
    // ignore
  }
}

export function kill(child) {
  try {
    child.kill("SIGKILL");
  } catch {
    // ignore
  }
}

// JPEG dimensions from the SOF marker, without any dependency.
export function jpegSize(buf) {
  let off = 2;
  while (off < buf.length - 1) {
    if (buf[off] !== 0xff) { off++; continue; }
    const marker = buf[off + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: buf.readUInt16BE(off + 7), height: buf.readUInt16BE(off + 5) };
    }
    const len = buf.readUInt16BE(off + 2);
    off += 2 + len;
  }
  return null;
}
