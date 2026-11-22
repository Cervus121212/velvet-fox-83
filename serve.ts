// Ember Sigils — tiny static server for local play-testing.
// Serves game/ at http://localhost:8080 (Node 22, standard library only).

import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "game");
const PORT = Number(process.env.PORT || 8080);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};

const server = createServer((req, res) => {
  try {
    const raw = decodeURIComponent(new URL(req.url || "/", "http://x").pathname);
    const rel = normalize(raw).replace(/^[/\\]+/, "");
    const file = rel === "" ? join(root, "index.html") : join(root, rel);
    if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found\n");
      return;
    }
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(readFileSync(file));
  } catch {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end("server error\n");
  }
});

server.listen(PORT, () => {
  console.log(`Ember Sigils at http://localhost:${PORT}`);
});
