import { readFile, realpath } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256Hex } from "../src/canonical-hash.js";
import {
  validateBlindCorpus,
  validateBlindDisplayManifest,
  validateReviewerQualificationSet
} from "../scripts/evaluation-model.mjs";

const defaultRepoRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const repoRoot = resolve(process.env.GENERATOR_TEST_ROOT || defaultRepoRoot);
const port = Number(process.env.GENERATOR_TEST_PORT || 0);
const ownerToken = process.env.GENERATOR_TEST_OWNER_TOKEN || `standalone-${process.pid}`;
const corpusPath = resolve(
  process.env.BLIND_REVIEW_CORPUS_PATH
  || fileURLToPath(new URL("./fixtures/blind-evaluation-corpus.v1.json", import.meta.url))
);
const displayPath = resolve(
  process.env.BLIND_REVIEW_DISPLAY_PATH
  || fileURLToPath(new URL("./fixtures/blind-evaluation-display.v1.json", import.meta.url))
);
const qualificationPath = resolve(
  process.env.BLIND_REVIEW_QUALIFICATION_PATH
  || fileURLToPath(new URL("./fixtures/reviewer-qualifications.v1.json", import.meta.url))
);
const displayRoute = "/web/micro-graphic-generator/tests/fixtures/blind-evaluation-display.v1.json";
const qualificationRoute = "/web/micro-graphic-generator/tests/fixtures/reviewer-qualifications.v1.json";
const artifactPrefix = "web/micro-graphic-generator/tests/artifacts/blind/v1/";
const mimeTypes = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2"
});
const securityHeaders = Object.freeze({
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; img-src 'self' blob: data:; object-src blob:; frame-src blob:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
});

function send(response, status, body, contentType = "text/plain; charset=utf-8", extraHeaders = {}) {
  const bytes = typeof body === "string" ? Buffer.from(body) : body;
  response.writeHead(status, {
    ...securityHeaders,
    "Content-Length": bytes.byteLength,
    "Content-Type": contentType,
    ...extraHeaders
  });
  response.end(bytes);
}

function absoluteRepoPath(relativePath) {
  const absolutePath = resolve(repoRoot, relativePath);
  if (absolutePath !== repoRoot && !absolutePath.startsWith(`${repoRoot}${sep}`)) {
    throw new Error(`blind allowlist path escapes repository root: ${relativePath}`);
  }
  return absolutePath;
}

async function assertRealPathInRoot(path) {
  const [rootRealPath, fileRealPath] = await Promise.all([realpath(repoRoot), realpath(path)]);
  if (fileRealPath !== rootRealPath && !fileRealPath.startsWith(`${rootRealPath}${sep}`)) {
    throw new Error(`blind allowlist real path escapes repository root: ${path}`);
  }
}

async function frozenFile(relativePath) {
  const absolutePath = absoluteRepoPath(relativePath);
  await assertRealPathInRoot(absolutePath);
  return Object.freeze({
    bytes: await readFile(absolutePath),
    contentType: mimeTypes[extname(absolutePath).toLowerCase()] || "application/octet-stream"
  });
}

function referencedFontFiles(cssText) {
  const files = [];
  const pattern = /url\(["']?\.\/([^"')]+)["']?\)/g;
  for (const match of cssText.matchAll(pattern)) files.push(match[1]);
  return [...new Set(files)].sort();
}

function assertArtifactDescriptor(descriptor) {
  if (!descriptor.path.startsWith(artifactPrefix)) {
    throw new Error(`blind artifact is outside the frozen artifact root: ${descriptor.path}`);
  }
  return descriptor;
}

async function verifiedArtifactBytes(descriptor) {
  assertArtifactDescriptor(descriptor);
  const absolutePath = absoluteRepoPath(descriptor.path);
  await assertRealPathInRoot(absolutePath);
  const bytes = await readFile(absolutePath);
  if (bytes.byteLength !== descriptor.byteLength) throw new Error(`artifact byte length mismatch: ${descriptor.path}`);
  if (`sha256:${sha256Hex(bytes)}` !== descriptor.sha256) throw new Error(`artifact digest mismatch: ${descriptor.path}`);
  return bytes;
}

async function loadState() {
  const [corpusBytes, displayBytes, qualificationBytes] = await Promise.all([
    readFile(corpusPath),
    readFile(displayPath),
    readFile(qualificationPath)
  ]);
  const corpus = JSON.parse(corpusBytes.toString("utf8"));
  const display = JSON.parse(displayBytes.toString("utf8"));
  const qualificationSet = JSON.parse(qualificationBytes.toString("utf8"));
  validateBlindCorpus(corpus);
  validateBlindDisplayManifest(display, { corpus });
  validateReviewerQualificationSet(qualificationSet);

  const staticRoutes = new Map();
  const add = async (route, relativePath) => {
    if (staticRoutes.has(route)) throw new Error(`duplicate blind review route ${route}`);
    staticRoutes.set(route, await frozenFile(relativePath));
  };
  await Promise.all([
    add("/web/micro-graphic-generator/tests/blind-review/index.html", "web/micro-graphic-generator/tests/blind-review/index.html"),
    add("/web/micro-graphic-generator/tests/blind-review/styles.css", "web/micro-graphic-generator/tests/blind-review/styles.css"),
    add("/web/micro-graphic-generator/tests/blind-review/review.js", "web/micro-graphic-generator/tests/blind-review/review.js"),
    add("/web/micro-graphic-generator/src/canonical-hash.js", "web/micro-graphic-generator/src/canonical-hash.js"),
    add("/web/micro-graphic-generator/src/svg-structural.js", "web/micro-graphic-generator/src/svg-structural.js"),
    add("/web/micro-graphic-generator/src/vendor/sha256.js", "web/micro-graphic-generator/src/vendor/sha256.js"),
    add("/web/micro-graphic-generator/fonts/fonts.css", "web/micro-graphic-generator/fonts/fonts.css")
  ]);
  staticRoutes.set(displayRoute, Object.freeze({
    bytes: displayBytes,
    contentType: mimeTypes[".json"]
  }));
  staticRoutes.set(qualificationRoute, Object.freeze({
    bytes: qualificationBytes,
    contentType: mimeTypes[".json"]
  }));
  const fontCss = staticRoutes.get("/web/micro-graphic-generator/fonts/fonts.css").bytes.toString("utf8");
  await Promise.all(referencedFontFiles(fontCss).map(fileName => add(
    `/web/micro-graphic-generator/fonts/${fileName}`,
    `web/micro-graphic-generator/fonts/${fileName}`
  )));

  const artifactByRoute = new Map();
  for (const fixture of display.fixtures) {
    for (const side of ["left", "right"]) {
      for (const format of ["svg", "png"]) {
        const descriptor = assertArtifactDescriptor(fixture[side][format]);
        const route = `/${descriptor.path}`;
        if (artifactByRoute.has(route)) throw new Error(`duplicate blind artifact route ${route}`);
        await verifiedArtifactBytes(descriptor);
        artifactByRoute.set(route, descriptor);
      }
    }
  }
  return Object.freeze({ staticRoutes, artifactByRoute });
}

const state = await loadState();
const server = createServer(async (request, response) => {
  try {
    if (request.method !== "GET" && request.method !== "HEAD") {
      send(response, 405, "Method not allowed");
      return;
    }
    const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`).pathname);
    if (pathname === "/.well-known/generator-test-owner") {
      const body = `${JSON.stringify({ ownerToken, pid: process.pid })}\n`;
      send(response, 200, request.method === "HEAD" ? Buffer.alloc(0) : body, "application/json; charset=utf-8", {
        "X-Generator-Test-Owner": ownerToken
      });
      return;
    }
    if (
      pathname === "/web/micro-graphic-generator/tests/blind-review"
      || pathname === "/web/micro-graphic-generator/tests/blind-review/"
    ) {
      response.writeHead(302, { ...securityHeaders, Location: "/web/micro-graphic-generator/tests/blind-review/index.html" });
      response.end();
      return;
    }
    const staticRecord = state.staticRoutes.get(pathname);
    if (staticRecord) {
      send(
        response,
        200,
        request.method === "HEAD" ? Buffer.alloc(0) : staticRecord.bytes,
        staticRecord.contentType
      );
      return;
    }
    const artifact = state.artifactByRoute.get(pathname);
    if (artifact) {
      const bytes = await verifiedArtifactBytes(artifact);
      send(
        response,
        200,
        request.method === "HEAD" ? Buffer.alloc(0) : bytes,
        mimeTypes[extname(artifact.path).toLowerCase()] || "application/octet-stream"
      );
      return;
    }
    send(response, 404, "Not found");
  } catch (error) {
    send(response, 500, `Frozen artifact verification failed: ${error.message}`);
  }
});

server.listen(port, "127.0.0.1", () => {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("blind review server has no TCP address");
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
