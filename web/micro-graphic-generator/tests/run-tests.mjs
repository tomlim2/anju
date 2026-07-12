import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const playwrightCli = fileURLToPath(new URL("../../../node_modules/@playwright/test/cli.js", import.meta.url));
const soak = process.argv.includes("--soak");

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env,
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(process.execPath, ["--test", "web/micro-graphic-generator/tests/pure.test.mjs"]);
run(process.execPath, [playwrightCli, "test", "--config", "web/micro-graphic-generator/tests/playwright.config.mjs"], {
  ...process.env,
  GENERATOR_RANDOM_ITERATIONS: soak ? "1000" : "100"
});
