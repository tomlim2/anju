// Minimal static server. ES modules need an http origin, so opening
// index.html from the filesystem will not work.
//
//   node serve.mjs [port]

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.argv[2]) || 7200;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const path = join(ROOT, normalize(requested).replace(/^(\.\.[/\\])+/, ""));
  if (!path.startsWith(ROOT)) {
    response.writeHead(403).end("forbidden");
    return;
  }
  try {
    const body = await readFile(path);
    response.writeHead(200, {
      "Content-Type": TYPES[extname(path)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("not found");
  }
}).listen(PORT, () => {
  console.log(`monolith → http://127.0.0.1:${PORT}`);
});
