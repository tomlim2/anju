import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertRuntimeConformance } from "./runtime-conformance.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const playwrightCli = fileURLToPath(new URL("../../../node_modules/@playwright/test/cli.js", import.meta.url));
const soak = process.argv.includes("--soak");
const requireAcceptance = process.argv.includes("--require-acceptance");
const extended = soak || requireAcceptance;

const smokePureTest = "canonical composition layouts preserve rectangular complete 3x3 coverage";
const smokeBrowserTest = "every supported ratio mounts one exact typography-first Component";

assertRuntimeConformance();

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env,
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(process.execPath, [
  "--test",
  ...(!extended ? [`--test-name-pattern=${smokePureTest}`] : []),
  "web/micro-graphic-generator/tests/pure.test.mjs"
]);

if (extended) {
  run(process.execPath, [
    "web/micro-graphic-generator/scripts/generate-composition-browser-cases.mjs"
  ]);
  run(process.execPath, [
    "web/micro-graphic-generator/scripts/generate-expressive-range-report.mjs",
    ...(requireAcceptance ? ["--require-acceptance"] : [])
  ]);
  run(process.execPath, [
    "web/micro-graphic-generator/scripts/generate-blind-evaluation-corpus.mjs",
    ...(requireAcceptance ? ["--require-acceptance"] : [])
  ]);
  if (requireAcceptance) {
    run(process.execPath, ["web/micro-graphic-generator/scripts/generate-motif-calibration.mjs"]);
  }
}

run(process.execPath, [
  playwrightCli,
  "test",
  "--config",
  "web/micro-graphic-generator/tests/playwright.config.mjs",
  ...(!extended ? ["--grep", smokeBrowserTest] : [])
], {
  ...process.env,
  GENERATOR_RANDOM_ITERATIONS: extended ? "1000" : "1"
});
