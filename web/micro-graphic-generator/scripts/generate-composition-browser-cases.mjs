import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { motifRegistry } from "../src/motifs.js";
import { OWNER_SNAPSHOT_REVISION } from "../src/composition-owner-snapshot.js";
import { assertRuntimeConformance } from "../tests/runtime-conformance.mjs";
import { startOwnedTestServer } from "./owned-test-server.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const fixturePath = fileURLToPath(new URL("../tests/fixtures/composition-browser-cases.json", import.meta.url));
let baseUrl;
const generationTimestamp = "2026-07-14T12:00:00+09:00";
const viewport = Object.freeze({ width: 1440, height: 900 });
const supportedRatios = Object.freeze(["1:1", "2:3", "2:5", "3:2", "5:2", "4:3", "3:4"]);
const write = process.argv.includes("--write");

assertRuntimeConformance({ playwrightProject: "chromium-http" });

async function openHarness(browser, targetViewport) {
  const page = await browser.newPage({ viewport: targetViewport });
  const search = new URLSearchParams({ test: "1", seed: "0", now: generationTimestamp });
  await page.goto(`${baseUrl}?${search}`);
  await page.waitForFunction(() => Boolean(window.__MICRO_GRAPHIC_TEST__));
  await page.evaluate(() => window.__MICRO_GRAPHIC_TEST__.ready);
  const ownerSnapshotRevision = await page.evaluate(() =>
    window.__MICRO_GRAPHIC_TEST__.generation().generationInput.ownerSnapshotRevision
  );
  if (ownerSnapshotRevision !== OWNER_SNAPSHOT_REVISION) {
    throw new Error("composition fixture page loaded an unexpected owner snapshot");
  }
  return page;
}

async function inspectSeed(page, seed) {
  return page.evaluate(nextSeed => {
    const hook = window.__MICRO_GRAPHIC_TEST__;
    const snapshot = hook.renderSeed(nextSeed);
    const generation = hook.generation();
    const accepted = hook.telemetry().find(event => event.population === "accepted-output") || null;
    return {
      seed: nextSeed,
      ownerSnapshotRevision: generation.generationInput.ownerSnapshotRevision,
      ratio: generation.generationInput.ratio,
      recipeId: snapshot.fingerprint.recipeId,
      motifId: accepted?.motifId || null,
      heroFinalizationClass: accepted?.heroFinalizationClass || null,
      blockCount: snapshot.fingerprint.blocks.length,
      queueLength: generation.plannerResult?.searchQueue.length || 0,
      accepted: Boolean(accepted),
      violations: snapshot.violations,
      terminalReason: snapshot.terminalReason
    };
  }, seed);
}

async function scanDefaultCases(page) {
  const ratios = new Map();
  const recipes = new Map();
  const motifs = new Map();
  let retry = null;
  for (let seed = 0; seed < 5000; seed += 1) {
    const result = await inspectSeed(page, seed);
    if (!result.accepted || result.violations !== 0 || result.terminalReason !== null) continue;
    if (!ratios.has(result.ratio)) ratios.set(result.ratio, result);
    if (!recipes.has(result.recipeId)) recipes.set(result.recipeId, result);
    if (result.motifId && result.blockCount === 5 && !motifs.has(result.motifId)) {
      motifs.set(result.motifId, result);
    }
    if (!retry && result.queueLength > 8) retry = result;
    if (
      ratios.size === supportedRatios.length
      && recipes.size === 2
      && motifs.size === motifRegistry.length
      && retry
    ) break;
  }
  const missing = [
    ...supportedRatios.filter(ratio => !ratios.has(ratio)).map(ratio => `ratio:${ratio}`),
    ...["command", "status"].filter(recipeId => !recipes.has(recipeId)).map(recipeId => `recipe:${recipeId}`),
    ...motifRegistry.filter(record => !motifs.has(record.id)).map(record => `motif:${record.id}`),
    ...(!retry ? ["retry"] : [])
  ];
  if (missing.length) throw new Error(`could not find browser fixtures: ${missing.join(", ")}`);
  return { ratios, recipes, motifs, retry };
}

async function findPortraitMotif(page) {
  for (let seed = 0; seed < 5000; seed += 1) {
    const result = await inspectSeed(page, seed);
    if (
      result.accepted
      && result.violations === 0
      && result.terminalReason === null
      && result.motifId
      && result.blockCount === 5
    ) return result;
  }
  throw new Error("could not find a portrait motif fixture");
}

const server = await startOwnedTestServer({ repoRoot });
baseUrl = server.url("/web/micro-graphic-generator/");

let browser;
try {
  await server.assertOwner();
  browser = await chromium.launch({ headless: true });
  const defaultPage = await openHarness(browser, viewport);
  const found = await scanDefaultCases(defaultPage);
  const portraitPage = await openHarness(browser, { width: 900, height: 1200 });
  const portraitMotif = await findPortraitMotif(portraitPage);
  const ownerSnapshotRevisions = new Set([
    ...found.ratios.values(),
    ...found.recipes.values(),
    ...found.motifs.values(),
    found.retry,
    portraitMotif
  ].map(result => result.ownerSnapshotRevision));
  if (ownerSnapshotRevisions.size !== 1) throw new Error("fixture scan crossed owner snapshots");
  const fixture = {
    schemaVersion: 1,
    ownerSnapshotRevision: [...ownerSnapshotRevisions][0],
    generationTimestamp,
    viewport,
    ratios: supportedRatios.map(ratio => ({ ratio, seed: found.ratios.get(ratio).seed })),
    recipes: ["command", "status"].map(recipeId => {
      const result = found.recipes.get(recipeId);
      return { recipeId, ratio: result.ratio, seed: result.seed };
    }),
    motifs: motifRegistry.map(record => {
      const result = found.motifs.get(record.id);
      return {
        motifId: record.id,
        ratio: result.ratio,
        seed: result.seed,
        heroFinalizationClass: result.heroFinalizationClass
      };
    }),
    retry: { seed: found.retry.seed },
    visual: {
      desktopCommandSeed: found.recipes.get("command").seed,
      portraitMotifSeed: portraitMotif.seed,
      portraitMotifId: portraitMotif.motifId,
      mobileComposeSeed: found.ratios.get("1:1").seed
    }
  };
  const serialized = `${JSON.stringify(fixture, null, 2)}\n`;
  if (write) {
    await writeFile(fixturePath, serialized);
  } else {
    const existing = await readFile(fixturePath, "utf8");
    if (existing !== serialized) throw new Error("composition browser cases are stale; run with --write");
  }
  process.stdout.write(`${write ? "wrote" : "verified"} ${fixturePath}\n`);
} finally {
  await browser?.close();
  await server.stop();
}

if (server.stderr()) process.stderr.write(server.stderr());
