import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BROWSER_CONFORMANCE_PROFILE,
  NODE_CONFORMANCE_RUNTIME
} from "../src/config.js";

const repoRoot = new URL("../../../", import.meta.url);
const packageManifest = JSON.parse(readFileSync(new URL("package.json", repoRoot), "utf8"));
const installedPlaywrightManifest = JSON.parse(readFileSync(
  new URL("node_modules/@playwright/test/package.json", repoRoot),
  "utf8"
));
const nodeVersionFile = readFileSync(new URL(".node-version", repoRoot), "utf8").trim();
const playwrightProfileMatch = BROWSER_CONFORMANCE_PROFILE.match(/^playwright-(\d+\.\d+\.\d+)\//);
if (!playwrightProfileMatch) throw new Error("Browser conformance profile has no frozen Playwright version");
const expectedPlaywrightVersion = playwrightProfileMatch[1];

export const RUNTIME_CONFORMANCE = Object.freeze({
  nodeRuntime: NODE_CONFORMANCE_RUNTIME,
  nodeVersion: NODE_CONFORMANCE_RUNTIME.slice(1),
  browserProfile: BROWSER_CONFORMANCE_PROFILE,
  playwrightVersion: expectedPlaywrightVersion,
  playwrightProject: BROWSER_CONFORMANCE_PROFILE.split("/")[1]
});

export function assertRuntimeConformance({
  processVersion = process.version,
  packageNode = packageManifest.engines.node,
  nodeVersion = nodeVersionFile,
  playwrightVersion = installedPlaywrightManifest.version,
  playwrightProject = RUNTIME_CONFORMANCE.playwrightProject
} = {}) {
  assert.equal(processVersion, RUNTIME_CONFORMANCE.nodeRuntime, "Node runtime mismatch");
  assert.equal(packageNode, RUNTIME_CONFORMANCE.nodeVersion, "package engine mismatch");
  assert.equal(nodeVersion, RUNTIME_CONFORMANCE.nodeVersion, ".node-version mismatch");
  assert.equal(
    packageManifest.devDependencies["@playwright/test"],
    RUNTIME_CONFORMANCE.playwrightVersion,
    "Playwright manifest version mismatch"
  );
  assert.equal(playwrightVersion, RUNTIME_CONFORMANCE.playwrightVersion, "Playwright package mismatch");
  assert.equal(playwrightProject, RUNTIME_CONFORMANCE.playwrightProject, "Playwright project mismatch");
  return RUNTIME_CONFORMANCE;
}
