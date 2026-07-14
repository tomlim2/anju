import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(
  process.env.GENERATOR_TEST_ROOT || fileURLToPath(new URL("../../..", import.meta.url))
);
const port = Number(process.env.GENERATOR_TEST_PORT || 4191);
const ownerToken = process.env.GENERATOR_TEST_OWNER_TOKEN || `standalone-${process.pid}`;
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2"
};

const blockedBlindPrefixes = Object.freeze([
  "/web/micro-graphic-generator/tests/blind-review",
  "/web/micro-graphic-generator/tests/artifacts/blind/"
]);
const blockedBlindFixture = /^\/web\/micro-graphic-generator\/tests\/fixtures\/(?:blind-|reviewer-qualifications)/;

function send(response, status, body) {
  response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(body);
}

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
    if (pathname === "/.well-known/generator-test-owner") {
      const body = `${JSON.stringify({ ownerToken, pid: process.pid })}\n`;
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Length": Buffer.byteLength(body),
        "Content-Type": "application/json; charset=utf-8",
        "X-Generator-Test-Owner": ownerToken
      });
      response.end(body);
      return;
    }
    if (blockedBlindPrefixes.some(prefix => pathname.startsWith(prefix)) || blockedBlindFixture.test(pathname)) {
      send(response, 404, "Not found");
      return;
    }
    let filePath = resolve(repoRoot, `.${pathname}`);
    if (filePath !== repoRoot && !filePath.startsWith(`${repoRoot}${sep}`)) {
      send(response, 403, "Forbidden");
      return;
    }

    let fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      filePath = resolve(filePath, "index.html");
      fileStat = await stat(filePath);
    }
    if (!fileStat.isFile()) {
      send(response, 404, "Not found");
      return;
    }

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Length": fileStat.size,
      "Content-Type": mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream"
    });
    createReadStream(filePath).pipe(response);
  } catch (error) {
    send(response, error?.code === "ENOENT" ? 404 : 500, error?.code === "ENOENT" ? "Not found" : "Server error");
  }
});

server.listen(port, "127.0.0.1", () => {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server has no TCP address");
  process.stdout.write(`${JSON.stringify({
    event: "generator-test-server-ready",
    origin: `http://127.0.0.1:${address.port}`,
    ownerToken,
    pid: process.pid
  })}\n`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.closeAllConnections?.();
    server.close();
    process.exit(0);
  });
}
