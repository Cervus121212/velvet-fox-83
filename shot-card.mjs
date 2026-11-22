// Ember Sigils — screenshot runner. Reads shots.json, opens each URL
// in headless Chrome, waits for window.__shotReady, and saves a JPEG
// into screenshots/. Usage: node shot-card.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CDP_PORT,
  GAME_BASE,
  closeTab,
  jpegSize,
  kill,
  launchChrome,
  launchServer,
  openTab,
  sleep,
  waitFor,
  waitForChrome,
  waitForServer,
} from "./cdp.mjs";

const root = process.cwd();
const manifest = JSON.parse(readFileSync(join(root, "shots.json"), "utf8"));

const server = launchServer(root);
const chrome = launchChrome();
const results = [];
try {
  await waitForServer();
  await waitForChrome();
  for (const shot of manifest) {
    const url = GAME_BASE + shot.url;
    const { cdp, target } = await openTab(url);
    try {
      await cdp.send("Page.navigate", { url });
      await waitFor(
        () => cdp.eval("window.__shotReady === true ? true : null"),
        20000,
        `__shotReady for ${shot.file}`,
      );
      await sleep(300);
      const snap = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 82 });
      const buf = Buffer.from(snap.data, "base64");
      const outPath = join(root, "screenshots", shot.file);
      writeFileSync(outPath, buf);
      const size = jpegSize(buf);
      const state = await cdp.eval("window.__snapshot ? window.__snapshot().phase : 'n/a'");
      results.push({ file: shot.file, bytes: buf.length, size, phase: state, errors: cdp.consoleErrors });
      console.log(`${shot.file}: ${buf.length} bytes ${size ? `${size.width}x${size.height}` : "?"} phase=${state} errors=${cdp.consoleErrors.length}`);
      if (cdp.consoleErrors.length) console.log("  errors:", cdp.consoleErrors.slice(0, 3));
    } finally {
      cdp.close();
      await closeTab(target.id);
    }
  }
} finally {
  kill(chrome);
  kill(server);
}

const over = results.filter((r) => r.bytes > 256 * 1024);
if (over.length) {
  console.log("OVERSIZE:", over.map((r) => r.file).join(", "));
  process.exit(1);
}
console.log(`done: ${results.length} screenshots`);
