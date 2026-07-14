import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const defaultRepoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const defaultServerPath = fileURLToPath(new URL("../tests/static-server.mjs", import.meta.url));

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await new Promise(resolve => {
    const timeout = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }, 5_000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

function parseReadyLine(line, ownerToken) {
  let record;
  try {
    record = JSON.parse(line);
  } catch {
    return null;
  }
  if (record?.event !== "generator-test-server-ready") return null;
  if (record.ownerToken !== ownerToken) throw new Error("test server ready token mismatch");
  const origin = new URL(record.origin);
  if (origin.protocol !== "http:" || origin.hostname !== "127.0.0.1" || origin.pathname !== "/") {
    throw new Error("test server reported a non-loopback origin");
  }
  return Object.freeze({ origin: origin.origin, pid: record.pid });
}

async function assertOwner(origin, ownerToken) {
  const response = await fetch(`${origin}/.well-known/generator-test-owner`, { cache: "no-store" });
  if (!response.ok) throw new Error(`test server owner endpoint returned ${response.status}`);
  const record = await response.json();
  if (
    record.ownerToken !== ownerToken
    || response.headers.get("x-generator-test-owner") !== ownerToken
  ) throw new Error("test server owner assertion failed");
}

export async function startOwnedTestServer({
  serverPath = defaultServerPath,
  repoRoot = defaultRepoRoot,
  root = repoRoot,
  env = {},
  timeoutMs = 30_000
} = {}) {
  const ownerToken = randomBytes(24).toString("hex");
  const child = spawn(process.execPath, [serverPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
      GENERATOR_TEST_PORT: "0",
      GENERATOR_TEST_ROOT: root,
      GENERATOR_TEST_OWNER_TOKEN: ownerToken
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  let stdoutBuffer = "";
  child.stderr.setEncoding("utf8");
  child.stdout.setEncoding("utf8");
  child.stderr.on("data", chunk => { stderr += chunk; });

  let timeout;
  let ready;
  try {
    ready = await new Promise((resolve, reject) => {
      const fail = error => {
        clearTimeout(timeout);
        reject(error);
      };
      timeout = setTimeout(() => fail(new Error(
        `owned test server did not become ready within ${timeoutMs}ms${stderr ? `: ${stderr.trim()}` : ""}`
      )), timeoutMs);
      child.once("error", fail);
      child.once("exit", (code, signal) => fail(new Error(
        `owned test server exited before readiness (${code ?? signal})${stderr ? `: ${stderr.trim()}` : ""}`
      )));
      child.stdout.on("data", chunk => {
        stdoutBuffer += chunk;
        let newline;
        while ((newline = stdoutBuffer.indexOf("\n")) >= 0) {
          const line = stdoutBuffer.slice(0, newline);
          stdoutBuffer = stdoutBuffer.slice(newline + 1);
          try {
            const record = parseReadyLine(line, ownerToken);
            if (record) {
              clearTimeout(timeout);
              resolve(record);
              return;
            }
          } catch (error) {
            fail(error);
          }
        }
      });
    });
    await assertOwner(ready.origin, ownerToken);
  } catch (error) {
    await stopChild(child);
    throw error;
  }

  let stopped = false;
  return Object.freeze({
    origin: ready.origin,
    ownerToken,
    pid: ready.pid,
    url(pathname = "/") {
      return new URL(pathname, `${ready.origin}/`).href;
    },
    stderr() {
      return stderr;
    },
    async assertOwner() {
      if (stopped) throw new Error("owned test server is stopped");
      await assertOwner(ready.origin, ownerToken);
    },
    async stop() {
      if (stopped) return;
      stopped = true;
      await stopChild(child);
    }
  });
}
