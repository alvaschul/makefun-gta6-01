/**
 * NEON HARBOR v2 — tiny static file server for local play.
 *
 * Serves the game/ folder over HTTP so the ES modules and the import map
 * load correctly (browsers refuse module scripts from file:// pages).
 * Standard library only. Usage:
 *
 *   node serve.ts            -> http://localhost:8080
 *   node serve.ts --port 9000
 *
 * The server refuses any request whose resolved path escapes the game
 * folder, answers 404 for missing files, and maps "/" to index.html.
 */

import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));
const gameDir = resolve(join(rootDir, "game"));

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
};

function portFromArgs(argv: string[]): number {
  const flagIndex = argv.indexOf("--port");
  if (flagIndex >= 0 && argv[flagIndex + 1]) {
    const parsed = Number.parseInt(argv[flagIndex + 1], 10);
    if (Number.isFinite(parsed) && parsed > 0 && parsed < 65536) return parsed;
  }
  return 8080;
}

const port = portFromArgs(process.argv.slice(2));

const server = createServer((request, response) => {
  const rawUrl = request.url ?? "/";
  const urlPath = decodeURIComponent(rawUrl.split("?")[0]);
  const wanted = urlPath === "/" ? "/index.html" : urlPath;

  // Resolve inside the game folder and refuse anything that escapes it.
  const filePath = resolve(join(gameDir, normalize(`.${wanted}`)));
  if (!filePath.startsWith(gameDir)) {
    response.writeHead(403, { "content-type": "text/plain" });
    response.end("Forbidden");
    return;
  }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { "content-type": "text/plain" });
    response.end("Not found");
    return;
  }

  const type = MIME_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream";
  response.writeHead(200, { "content-type": type, "cache-control": "no-store" });
  response.end(readFileSync(filePath));
});

server.listen(port, () => {
  console.log(`NEON HARBOR v2 is live at http://localhost:${port}`);
});
