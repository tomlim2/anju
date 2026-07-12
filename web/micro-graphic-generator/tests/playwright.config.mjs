import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const testDir = fileURLToPath(new URL(".", import.meta.url));
const contract = JSON.parse(readFileSync(new URL("./launch-contract.json", import.meta.url), "utf8"));

export default defineConfig({
  testDir,
  testMatch: "generator.spec.mjs",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: "line",
  use: {
    baseURL: contract.http.url,
    browserName: "chromium",
    headless: true,
    viewport: { width: 1440, height: 900 }
  },
  webServer: contract.http.required
    ? {
        command: "node web/micro-graphic-generator/tests/static-server.mjs",
        cwd: fileURLToPath(new URL("../../..", import.meta.url)),
        url: contract.http.url,
        reuseExistingServer: false,
        timeout: 30_000
      }
    : undefined,
  projects: [{ name: "chromium-http" }]
});
