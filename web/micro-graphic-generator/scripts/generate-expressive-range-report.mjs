import { readFile, writeFile } from "node:fs/promises";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { canonicalJson, hashCanonical, sha256Hex, utf8Bytes } from "../src/canonical-hash.js";
import { OWNER_SNAPSHOT_REVISION } from "../src/composition-owner-snapshot.js";
import { assertRuntimeConformance } from "../tests/runtime-conformance.mjs";
import { startOwnedTestServer } from "./owned-test-server.mjs";
import {
  EVALUATION_SCHEMA_VERSION,
  buildExpressiveRangeReport,
  validateExpressiveRangeInputFixture
} from "./evaluation-model.mjs";
import { buildEvaluationToolingEvidence } from "./evaluation-tooling-evidence.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const fixturePath = fileURLToPath(new URL("../tests/fixtures/expressive-range-inputs.v2.json", import.meta.url));
const eventsPath = fileURLToPath(new URL("../tests/fixtures/expressive-range-events.v2.jsonl", import.meta.url));
const reportPath = fileURLToPath(new URL("../tests/fixtures/expressive-range-report.v2.json", import.meta.url));
const curationReviewerDirectoryPath = fileURLToPath(new URL(
  "../tests/fixtures/curation-reviewer-directory.v1.json",
  import.meta.url
));
const successorReportSetPath = fileURLToPath(new URL(
  "../tests/fixtures/expressive-range-successor-reports.v1.json",
  import.meta.url
));
let baseUrl;
const generationTimestamp = "2026-07-14T12:00:00+09:00";
const viewport = Object.freeze({ width: 1440, height: 900 });
const write = process.argv.includes("--write");
const replayCheck = process.argv.includes("--replay-check");
const requireAcceptance = process.argv.includes("--require-acceptance");
const sampleCountArgument = process.argv.find(argument => argument.startsWith("--sample-count="));
const sampleCount = sampleCountArgument ? Number(sampleCountArgument.split("=")[1]) : 10_000;
const workerCount = Math.max(1, Math.min(
  sampleCount,
  Number(process.env.EXPRESSIVE_RANGE_WORKERS || Math.min(8, availableParallelism()))
));

assertRuntimeConformance({ playwrightProject: "chromium-http" });
if (!Number.isInteger(sampleCount) || sampleCount < 1) throw new Error("sample count must be a positive integer");
if ((write || replayCheck || !sampleCountArgument) && sampleCount !== 10_000) {
  throw new Error("official expressive-range artifacts require exactly 10,000 inputs");
}
if (write && replayCheck) throw new Error("--write and --replay-check are mutually exclusive");

async function openWorkerPage(browser, firstSeed) {
  const page = await browser.newPage({ viewport });
  page.setDefaultTimeout(0);
  const search = new URLSearchParams({
    test: "1",
    seed: String(firstSeed),
    now: generationTimestamp
  });
  await page.goto(`${baseUrl}?${search}`);
  await page.waitForFunction(() => Boolean(window.__MICRO_GRAPHIC_TEST__));
  await page.evaluate(() => window.__MICRO_GRAPHIC_TEST__.ready);
  const ownerSnapshotRevision = await page.evaluate(() =>
    window.__MICRO_GRAPHIC_TEST__.generation().generationInput.ownerSnapshotRevision
  );
  if (ownerSnapshotRevision !== OWNER_SNAPSHOT_REVISION) {
    throw new Error("expressive-range page loaded an unexpected owner snapshot");
  }
  return page;
}

async function runWorker(browser, seeds) {
  const page = await openWorkerPage(browser, seeds[0]);
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") pageErrors.push(message.text());
  });
  const records = [];
  for (let offset = 0; offset < seeds.length; offset += 50) {
    const batch = seeds.slice(offset, offset + 50);
    const batchRecords = await page.evaluate(batchSeeds => batchSeeds.map(seed => {
      const hook = window.__MICRO_GRAPHIC_TEST__;
      hook.renderSeed(seed);
      const generation = hook.generation();
      if (!generation || generation.planningFailure) {
        throw new Error(`planning failure for seed ${seed}: ${generation?.planningFailure || "missing snapshot"}`);
      }
      return {
        seed,
        generationInput: generation.generationInput,
        telemetryEvents: hook.telemetry()
      };
    }), batch);
    records.push(...batchRecords);
  }
  await page.close();
  if (pageErrors.length) throw new Error(`browser telemetry errors: ${pageErrors.join(" | ")}`);
  return records;
}

async function readReviewOverrides() {
  try {
    const current = JSON.parse(await readFile(reportPath, "utf8"));
    return Array.isArray(current.concentrationReviews) ? current.concentrationReviews : [];
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function readResolutionEvidence() {
  const [curationReviewerDirectory, successorReportSet] = await Promise.all([
    readFile(curationReviewerDirectoryPath, "utf8").then(text => JSON.parse(text)),
    readFile(successorReportSetPath, "utf8").then(text => JSON.parse(text))
  ]);
  return { curationReviewerDirectory, successorReportSet };
}

function eventArtifact(text, recordCount) {
  return {
    path: "web/micro-graphic-generator/tests/fixtures/expressive-range-events.v2.jsonl",
    sha256: `sha256:${sha256Hex(utf8Bytes(text))}`,
    recordCount
  };
}

async function verifyStoredReport() {
  const [inputFixture, eventsText, report, resolutionEvidence] = await Promise.all([
    readFile(fixturePath, "utf8").then(text => JSON.parse(text)),
    readFile(eventsPath, "utf8"),
    readFile(reportPath, "utf8").then(text => JSON.parse(text)),
    readResolutionEvidence()
  ]);
  validateExpressiveRangeInputFixture(inputFixture, { expectedCount: 10_000 });
  const lines = eventsText.endsWith("\n")
    ? eventsText.slice(0, -1).split("\n")
    : eventsText.split("\n");
  const events = lines.filter(Boolean).map((line, index) => {
    const event = JSON.parse(line);
    if (canonicalJson(event) !== line) throw new Error(`event line ${index + 1} is not canonical JSON`);
    return event;
  });
  const expected = buildExpressiveRangeReport({
    inputFixture,
    events,
    eventArtifact: eventArtifact(eventsText, events.length),
    evaluationTooling: buildEvaluationToolingEvidence(repoRoot, "expressive-range-v2"),
    reviewOverrides: report.concentrationReviews,
    ...resolutionEvidence
  });
  if (canonicalJson(expected) !== canonicalJson(report)) throw new Error("expressive-range report is stale");
  if (hashCanonical(inputFixture) !== report.inputFixtureSha256) throw new Error("input fixture digest mismatch");
  if (requireAcceptance && !report.acceptance.pass) {
    throw new Error("expressive-range human acceptance gate is pending");
  }
  process.stdout.write(
    `verified expressive-range series ${inputFixture.sampleSeriesId}; `
    + `acceptance ${report.acceptance.pass ? "pass" : "pending"}\n`
  );
}

async function generateReport() {
  const server = await startOwnedTestServer({ repoRoot });
  baseUrl = server.url("/web/micro-graphic-generator/");
  let browser;
  try {
    await server.assertOwner();
    browser = await chromium.launch({ headless: true });
    const assignments = Array.from({ length: workerCount }, () => []);
    for (let seed = 0; seed < sampleCount; seed += 1) assignments[seed % workerCount].push(seed);
    const records = (await Promise.all(assignments.map(seeds => runWorker(browser, seeds))))
      .flat()
      .sort((left, right) => left.seed - right.seed);
    const ownerSnapshotRevisions = new Set(records.map(record => record.generationInput.ownerSnapshotRevision));
    if (ownerSnapshotRevisions.size !== 1) throw new Error("expressive-range run crossed owner snapshots");
    const ownerSnapshotRevision = [...ownerSnapshotRevisions][0];
    const inputFixture = {
      schemaVersion: EVALUATION_SCHEMA_VERSION,
      sampleSeriesId: `expressive-range:v2:${ownerSnapshotRevision.slice("sha256:".length, "sha256:".length + 12)}`,
      generationInputCount: records.length,
      generationInputs: records.map(record => record.generationInput)
    };
    validateExpressiveRangeInputFixture(inputFixture, { expectedCount: sampleCount });
    const events = records.flatMap(record => record.telemetryEvents);
    const eventsText = `${events.map(event => canonicalJson(event)).join("\n")}\n`;
    const existingOverrides = await readReviewOverrides();
    const resolutionEvidence = await readResolutionEvidence();
    const reviewOverrides = existingOverrides.filter(review =>
      review.reportSeriesId === inputFixture.sampleSeriesId
      && review.ownerSnapshotRevision === ownerSnapshotRevision
    );
    const report = buildExpressiveRangeReport({
      inputFixture,
      events,
      eventArtifact: eventArtifact(eventsText, events.length),
      evaluationTooling: buildEvaluationToolingEvidence(repoRoot, "expressive-range-v2"),
      reviewOverrides,
      ...resolutionEvidence
    });

    if (sampleCountArgument && !write) {
      process.stdout.write(`${JSON.stringify({
        sampleCount,
        workerCount,
        populationCounts: report.populationCounts,
        implementationFailures: report.implementationDistribution.failures,
        concentrationTriggers: report.concentrationReviews.map(review => ({
          heroLexicalUseId: review.heroLexicalUseId,
          trigger: review.trigger
        }))
      }, null, 2)}\n`);
    } else {
      const fixtureText = `${JSON.stringify(inputFixture, null, 2)}\n`;
      const reportText = `${JSON.stringify(report, null, 2)}\n`;
      if (write) {
        await Promise.all([
          writeFile(fixturePath, fixtureText),
          writeFile(eventsPath, eventsText),
          writeFile(reportPath, reportText)
        ]);
      } else {
        const [existingFixture, existingEvents, existingReport] = await Promise.all([
          readFile(fixturePath, "utf8"),
          readFile(eventsPath, "utf8"),
          readFile(reportPath, "utf8")
        ]);
        if (existingFixture !== fixtureText) throw new Error("expressive-range input fixture is stale");
        if (existingEvents !== eventsText) throw new Error("expressive-range event artifact is stale");
        if (existingReport !== reportText) throw new Error("expressive-range report is stale");
      }
      process.stdout.write(`${write ? "wrote" : "replayed"} expressive-range series ${inputFixture.sampleSeriesId}\n`);
    }
    if (hashCanonical(inputFixture) !== report.inputFixtureSha256) throw new Error("input fixture digest mismatch");
    if (requireAcceptance && !report.acceptance.pass) {
      throw new Error("expressive-range human acceptance gate is pending");
    }
  } finally {
    await browser?.close();
    await server.stop();
  }
  if (server.stderr()) process.stderr.write(server.stderr());
}

if (write || replayCheck || sampleCountArgument) await generateReport();
else await verifyStoredReport();
