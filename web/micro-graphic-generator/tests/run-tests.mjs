import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertRuntimeConformance } from "./runtime-conformance.mjs";

// Experimental workflow: run only the two smoke tests. The heavy determinism
// gates (blind-evaluation corpus, expressive-range, owner-snapshot verify,
// 1000-iteration soak) are intentionally not wired here.
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const playwrightCli = fileURLToPath(new URL("../../../node_modules/@playwright/test/cli.js", import.meta.url));

const smokePureTest = "canonical composition layouts preserve rectangular complete 3x3 coverage";
const smokeBrowserTest = "every supported ratio mounts one exact typography-first Component";

assertRuntimeConformance();

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { cwd: repoRoot, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(process.execPath, [
  "--test",
  `--test-name-pattern=${smokePureTest}`,
  "web/micro-graphic-generator/tests/pure.test.mjs"
]);

run(process.execPath, [
  playwrightCli,
  "test",
  "--config",
  "web/micro-graphic-generator/tests/playwright.config.mjs",
  "--grep",
  smokeBrowserTest
], { ...process.env, GENERATOR_RANDOM_ITERATIONS: "1" });
