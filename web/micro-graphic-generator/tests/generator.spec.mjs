import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { startOwnedTestServer } from "../scripts/owned-test-server.mjs";

const cases = JSON.parse(readFileSync(
  new URL("./fixtures/composition-browser-cases.json", import.meta.url),
  "utf8"
));
const hashVectors = JSON.parse(readFileSync(
  new URL("./fixtures/canonical-hash-vectors.json", import.meta.url),
  "utf8"
));
const calibration = JSON.parse(readFileSync(
  new URL("./fixtures/motif-occupancy-calibration.json", import.meta.url),
  "utf8"
));
const randomIterations = Number(process.env.GENERATOR_RANDOM_ITERATIONS || 100);

function captureErrors(page) {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

function generatorUrl({ seed, query = {} }) {
  const search = new URLSearchParams({
    test: "1",
    seed: String(seed),
    now: cases.generationTimestamp,
    ...query
  });
  return `./?${search}`;
}

async function openGenerator(page, options = {}) {
  const viewport = options.viewport || cases.viewport;
  await page.setViewportSize(viewport);
  await page.goto(generatorUrl({
    seed: options.seed ?? cases.ratios[0].seed,
    query: options.query
  }));
  await page.waitForFunction(() => Boolean(window.__MICRO_GRAPHIC_TEST__));
  return page.evaluate(() => window.__MICRO_GRAPHIC_TEST__.ready);
}

async function acceptedState(page) {
  return page.evaluate(() => {
    const hook = window.__MICRO_GRAPHIC_TEST__;
    const generation = hook.generation();
    const snapshot = hook.snapshot();
    const component = document.querySelector("svg[data-component]");
    const acceptedAttempt = generation.attempts.find(attempt => attempt.status === "accept") || null;
    const tokens = component
      ? [...component.querySelectorAll("[data-message-slot]")].filter(node => node.parentElement?.hasAttribute("data-grid-block"))
      : [];
    return {
      snapshot,
      generationInput: generation.generationInput,
      plannerSelection: generation.plannerResult?.initialSelection || null,
      plannerQueueLength: generation.plannerResult?.searchQueue.length || 0,
      acceptedAttempt,
      component: component ? {
        planId: component.getAttribute("data-plan-id"),
        recipeId: component.getAttribute("data-composition-recipe"),
        generationInputHash: component.getAttribute("data-generation-input-hash"),
        ownerSnapshotRevision: component.getAttribute("data-owner-snapshot-revision"),
        nodeRuntime: component.getAttribute("data-node-conformance-runtime"),
        browserProfile: component.getAttribute("data-browser-conformance-profile"),
        blockCount: component.querySelectorAll("[data-grid-block]").length,
        cells: [...component.querySelectorAll("[data-grid-block]")]
          .flatMap(node => (node.getAttribute("data-grid-cells") || "").split(",").filter(Boolean).map(Number)),
        tokenCount: tokens.length,
        heroCount: tokens.filter(node => node.getAttribute("data-composition-role") === "hero").length,
        primaryCount: tokens.filter(node => node.getAttribute("data-visual-prominence") === "primary").length,
        graphicPrimaryCount: tokens.filter(node =>
          node.getAttribute("data-token-source-kind") === "motif"
          && node.getAttribute("data-visual-prominence") === "primary"
        ).length,
        scaleTransforms: component.querySelectorAll('[transform*="scale("]').length,
        distortedText: component.querySelectorAll("text[textLength], text[lengthAdjust]").length,
        metadata: tokens.map(node => ({
          slotInstanceId: node.getAttribute("data-message-slot"),
          sourceKind: node.getAttribute("data-token-source-kind"),
          prominence: node.getAttribute("data-visual-prominence"),
          mountedOccupancyScore: node.getAttribute("data-mounted-occupancy-score"),
          motifId: node.getAttribute("data-motif-id"),
          lexicalUseId: node.getAttribute("data-lexical-use"),
          occupancySafetyFactor: node.getAttribute("data-occupancy-safety-factor"),
          occupancyCalibrationRevision: node.getAttribute("data-occupancy-calibration-revision")
        }))
      } : null
    };
  });
}

function round6(value) {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function expectAcceptedComposition(state, expectedRatio) {
  expect(state.snapshot.violations).toBe(0);
  expect(state.snapshot.terminalReason).toBeNull();
  expect(state.snapshot.displayedPlanId).toMatch(/^plan:sha256:[0-9a-f]{64}$/);
  expect(state.snapshot.exportPlanId).toBe(state.snapshot.displayedPlanId);
  expect(state.generationInput.ratio).toBe(expectedRatio);
  expect(state.component).not.toBeNull();
  expect(state.component.planId).toBe(state.snapshot.displayedPlanId);
  expect(state.component.recipeId).toBe(state.snapshot.fingerprint.recipeId);
  expect(state.component.ownerSnapshotRevision).toBe(state.generationInput.ownerSnapshotRevision);
  expect(state.component.nodeRuntime).toBe("v22.12.0");
  expect(state.component.browserProfile).toBe("playwright-1.61.1/chromium-http");
  expect(state.component.blockCount).toBeGreaterThanOrEqual(2);
  expect(state.component.blockCount).toBeLessThanOrEqual(5);
  expect(state.component.tokenCount).toBe(state.component.blockCount);
  expect([...state.component.cells].sort((left, right) => left - right)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  expect(state.component.heroCount).toBe(1);
  expect(state.component.primaryCount).toBe(1);
  expect(state.component.graphicPrimaryCount).toBe(0);
  expect(state.component.scaleTransforms).toBe(0);
  expect(state.component.distortedText).toBe(0);
  expect(state.acceptedAttempt).not.toBeNull();
  expect(state.acceptedAttempt.status).toBe("accept");
  expect(state.acceptedAttempt.finalizationReport.status).toBe("accept");

  const safeBox = state.generationInput.safeBox;
  for (const report of state.acceptedAttempt.finalizationReport.blocks) {
    const normalizedArea = round6(
      (report.renderedBounds.width / safeBox.width)
      * (report.renderedBounds.height / safeBox.height)
    );
    expect(report.mountedOccupancyScore).toBe(round6(normalizedArea * report.occupancySafetyFactor));
    expect(report.fits).toBe(true);
    const metadata = state.component.metadata.find(item => item.slotInstanceId === report.slotInstanceId);
    expect(metadata.mountedOccupancyScore).toBe(String(report.mountedOccupancyScore));
    expect(["primary", "secondary", "tertiary"]).toContain(metadata.prominence);
    if (report.sourceKind === "motif") {
      expect(metadata.motifId).toMatch(/^motif\./);
      expect(metadata.lexicalUseId).toBeNull();
      expect(metadata.occupancySafetyFactor).toBe(String(report.occupancySafetyFactor));
      expect(metadata.occupancyCalibrationRevision).toBe(report.occupancyCalibrationRevision);
    } else {
      expect(metadata.lexicalUseId).not.toBeNull();
      expect(metadata.motifId).toBeNull();
      expect(metadata.occupancySafetyFactor).toBeNull();
      expect(metadata.occupancyCalibrationRevision).toBeNull();
    }
  }

  const heroSlot = state.snapshot.fingerprint.blocks.find(block => block.compositionRole === "hero");
  const heroReport = state.acceptedAttempt.finalizationReport.blocks.find(
    block => block.slotInstanceId === heroSlot.slotInstanceId
  );
  for (const motifReport of state.acceptedAttempt.finalizationReport.blocks.filter(block => block.sourceKind === "motif")) {
    expect(heroReport.mountedOccupancyScore).toBeGreaterThan(motifReport.mountedOccupancyScore);
  }
}

test("canonical hashing and conformance are identical in the actual browser", async ({ page }) => {
  const errors = captureErrors(page);
  await openGenerator(page, { seed: cases.ratios[0].seed });
  const result = await page.evaluate(async vectors => {
    const { canonicalJson, hashCanonical, sha256Hex, utf8Bytes } = await import("./src/canonical-hash.js");
    const outputs = vectors.map(vector => ({
      id: vector.id,
      canonical: canonicalJson(vector.input),
      utf8Hex: [...utf8Bytes(canonicalJson(vector.input))]
        .map(value => value.toString(16).padStart(2, "0"))
        .join(""),
      digest: hashCanonical(vector.input),
      rawDigest: sha256Hex(utf8Bytes(canonicalJson(vector.input)))
    }));
    const rejects = [];
    const values = [new Date(), "\ud800", [, 1]];
    const cycle = {};
    cycle.self = cycle;
    values.push(cycle);
    for (const value of values) {
      try {
        canonicalJson(value);
        rejects.push(false);
      } catch {
        rejects.push(true);
      }
    }
    return {
      outputs,
      rejects,
      conformance: window.__MICRO_GRAPHIC_TEST__.conformance
    };
  }, hashVectors.vectors);

  for (const output of result.outputs) {
    const fixture = hashVectors.vectors.find(vector => vector.id === output.id);
    expect(output.canonical).toBe(fixture.canonical);
    expect(output.utf8Hex).toBe(fixture.utf8Hex);
    expect(output.digest).toBe(`sha256:${fixture.sha256}`);
    expect(output.rawDigest).toBe(fixture.sha256);
  }
  expect(result.rejects).toEqual([true, true, true, true]);
  expect(result.conformance).toEqual({
    nodeRuntime: "v22.12.0",
    browserProfile: "playwright-1.61.1/chromium-http"
  });
  expect(errors).toEqual([]);
});

test("font load failure blocks every generation entrypoint", async ({ page }) => {
  const errors = captureErrors(page);
  await page.setViewportSize(cases.viewport);
  await page.goto(generatorUrl({
    seed: cases.ratios[0].seed,
    query: { fontFailure: "forced" }
  }));
  await page.waitForFunction(() => Boolean(window.__MICRO_GRAPHIC_TEST__));
  const result = await page.evaluate(async nextSeed => {
    const hook = window.__MICRO_GRAPHIC_TEST__;
    let readyError = null;
    try {
      await hook.ready;
    } catch (error) {
      readyError = error.message;
    }
    const before = hook.snapshot();
    document.querySelector("#random").click();
    document.querySelector("#mode").click();
    document.querySelector("#art").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    window.dispatchEvent(new Event("resize"));
    hook.renderSeed(nextSeed);
    return {
      readyError,
      font: hook.fontState(),
      before,
      after: hook.snapshot(),
      generation: hook.generation(),
      componentCount: document.querySelectorAll("svg[data-component]").length,
      failureAttribute: document.body.getAttribute("data-font-load-failure"),
      disabled: Object.fromEntries(["random", "mode", "png", "svg"].map(id => [
        id,
        document.querySelector(`#${id}`).disabled
      ]))
    };
  }, cases.ratios[1].seed);
  expect(result.readyError).toBe("Forced approved font load failure");
  expect(result.font).toEqual({ state: "failed", failure: "Forced approved font load failure" });
  expect(result.failureAttribute).toBe("Forced approved font load failure");
  expect(result.before.renderVersion).toBe(0);
  expect(result.after.renderVersion).toBe(0);
  expect(result.after.seed).toBe(result.before.seed);
  expect(result.generation).toBeNull();
  expect(result.componentCount).toBe(0);
  expect(result.disabled).toEqual({ random: true, mode: true, png: true, svg: true });
  expect(errors).toEqual([]);
});

test("every supported ratio mounts one exact typography-first Component", async ({ page }) => {
  const errors = captureErrors(page);
  for (const fixture of cases.ratios) {
    await openGenerator(page, { seed: fixture.seed });
    expectAcceptedComposition(await acceptedState(page), fixture.ratio);
  }
  expect(errors).toEqual([]);
});

test("fixed command and status seeds preserve recipe identity", async ({ page }) => {
  const errors = captureErrors(page);
  for (const fixture of cases.recipes) {
    await openGenerator(page, { seed: fixture.seed });
    const state = await acceptedState(page);
    expectAcceptedComposition(state, fixture.ratio);
    expect(state.snapshot.fingerprint.recipeId).toBe(fixture.recipeId);
    expect(state.plannerSelection.selectedRecipeId).toBe(fixture.recipeId);
  }
  expect(errors).toEqual([]);
});

test("all active motif variants render live with exact calibration metadata", async ({ page }) => {
  const errors = captureErrors(page);
  for (const fixture of cases.motifs) {
    await openGenerator(page, { seed: fixture.seed });
    const state = await acceptedState(page);
    expectAcceptedComposition(state, fixture.ratio);
    expect(state.component.blockCount).toBe(5);
    const motifBlocks = state.snapshot.fingerprint.blocks.filter(block => block.sourceKind === "motif");
    expect(motifBlocks).toHaveLength(1);
    expect(motifBlocks[0].motifId).toBe(fixture.motifId);
    const family = calibration.families.find(item => item.motifId === fixture.motifId);
    const motifReport = state.acceptedAttempt.finalizationReport.blocks.find(block => block.sourceKind === "motif");
    expect(motifReport.occupancySafetyFactor).toBe(family.occupancySafetyFactor);
    expect(motifReport.occupancyCalibrationRevision).toBe(family.occupancyCalibrationRevision);
    const telemetry = await page.evaluate(() => {
      const motif = document.querySelector('[data-message-slot][data-token-source-kind="motif"]');
      return {
        primitiveCount: Number(motif.getAttribute("data-motif-primitive-count")),
        density: Number(motif.getAttribute("data-motif-density")),
        barcodeCaptionSizes: [...motif.querySelectorAll('[data-token-role="barcode-caption"]')]
          .map(node => ({ size: node.getAttribute("data-token-size"), weight: node.getAttribute("font-weight") }))
      };
    });
    expect(telemetry.primitiveCount).toBeGreaterThan(0);
    expect(telemetry.density).toBeGreaterThan(0);
    expect(telemetry.density).toBeLessThanOrEqual(1);
    if (fixture.motifId === "motif.barcode") {
      expect(telemetry.barcodeCaptionSizes.length).toBeGreaterThan(0);
      expect(telemetry.barcodeCaptionSizes.every(item => item.size === "small" && item.weight === "400")).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});

test("mounted occupancy accepts the strict control and rejects geometric takeover", async ({ page }) => {
  const errors = captureErrors(page);
  const fixture = cases.motifs.find(item => item.motifId === "motif.barcode");
  await openGenerator(page, { seed: fixture.seed });
  const before = await acceptedState(page);
  expectAcceptedComposition(before, fixture.ratio);

  const result = await page.evaluate(() => {
    const component = document.querySelector("svg[data-component]");
    const hero = component.querySelector('[data-message-slot][data-composition-role="hero"]');
    const heroBlock = hero.parentElement;
    const heroCenterX = Number(heroBlock.getAttribute("data-grid-content-x"))
      + Number(heroBlock.getAttribute("data-grid-content-width")) / 2;
    const heroCenterY = Number(heroBlock.getAttribute("data-grid-content-y"))
      + Number(heroBlock.getAttribute("data-grid-content-height")) / 2;
    heroBlock.setAttribute("data-grid-content-x", String(heroCenterX - 32));
    heroBlock.setAttribute("data-grid-content-y", String(heroCenterY - 10));
    heroBlock.setAttribute("data-grid-content-width", "64");
    heroBlock.setAttribute("data-grid-content-height", "20");
    const motif = component.querySelector('[data-message-slot][data-token-source-kind="motif"]');
    const block = motif.parentElement;
    const matrix = motif.transform.baseVal.consolidate().matrix;
    const rectangle = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rectangle.setAttribute("x", String(Number(block.getAttribute("data-grid-content-x")) - matrix.e));
    rectangle.setAttribute("y", String(Number(block.getAttribute("data-grid-content-y")) - matrix.f));
    rectangle.setAttribute("width", block.getAttribute("data-grid-content-width"));
    rectangle.setAttribute("height", block.getAttribute("data-grid-content-height"));
    rectangle.setAttribute("fill", "currentColor");
    rectangle.setAttribute("opacity", "0");
    motif.appendChild(rectangle);
    const report = window.__MICRO_GRAPHIC_TEST__.refinalizeActive();
    return {
      report,
      heroScore: report.blocks.find(item => {
        const token = component.querySelector(`[data-message-slot="${item.slotInstanceId}"]`);
        return token?.getAttribute("data-composition-role") === "hero";
      })?.mountedOccupancyScore,
      motifScore: report.blocks.find(item => item.sourceKind === "motif")?.mountedOccupancyScore
    };
  });

  expect(result.report.status).toBe("reject");
  expect(result.report.blocks.find(block => block.slotInstanceId === "hero-1").fallbackTier).toBeGreaterThan(0);
  expect(result.motifScore).toBeGreaterThanOrEqual(result.heroScore);
  expect(result.report.rejectionReasons).toContain(
    `hierarchy.motif-occupancy-not-below-hero:${result.report.blocks.find(block => block.sourceKind === "motif").slotInstanceId}`
  );
  expect(errors).toEqual([]);
});

test("eight ranked rejects transition once to the reserved known-good plan", async ({ page }) => {
  const errors = captureErrors(page);
  await openGenerator(page, { seed: cases.retry.seed, query: { reject: "ranked" } });
  const result = await page.evaluate(() => {
    const hook = window.__MICRO_GRAPHIC_TEST__;
    const generation = hook.generation();
    return {
      snapshot: hook.snapshot(),
      queueLength: generation.plannerResult.searchQueue.length,
      attempts: generation.attempts,
      knownGoodPlanIds: generation.knownGoodPlanIds,
      frozen: [
        generation,
        generation.plannerResult,
        generation.plannerResult.searchQueue,
        generation.plannerResult.searchQueue[0].plan
      ].every(Object.isFrozen)
    };
  });

  expect(result.queueLength).toBeGreaterThan(8);
  expect(result.attempts).toHaveLength(9);
  expect(result.attempts.slice(0, 8).every((attempt, index) =>
    attempt.envelope.candidateSource === "ranked"
    && attempt.envelope.candidateCursor === index
    && attempt.status === "reject"
    && attempt.rejectionReasons.includes("validation:test.forced-reject")
  )).toBe(true);
  const fallback = result.attempts[8];
  expect(fallback.envelope).toMatchObject({
    attempt: 9,
    candidateSource: "known-good",
    candidateCursor: 8,
    searchTier: "known-good",
    fallbackTrigger: "attempt-budget-exhausted"
  });
  expect(fallback.status).toBe("accept");
  expect(result.knownGoodPlanIds).toContain(fallback.envelope.planId);
  expect(result.snapshot.displayedPlanId).toBe(fallback.envelope.planId);
  expect(result.snapshot.attemptCount).toBe(9);
  expect(result.snapshot.violations).toBe(0);
  expect(result.frozen).toBe(true);
  expect(errors).toEqual([]);
});

test("no-candidate and terminal paths fail closed without inventing a plan", async ({ page }) => {
  const errors = captureErrors(page);
  await openGenerator(page, {
    seed: cases.retry.seed,
    query: { rankedCandidates: "none" }
  });
  const fallback = await page.evaluate(() => {
    const generation = window.__MICRO_GRAPHIC_TEST__.generation();
    return { generation, snapshot: window.__MICRO_GRAPHIC_TEST__.snapshot() };
  });
  expect(fallback.generation.plannerResult.initialSelection.status).toBe("no-candidate");
  expect(fallback.generation.plannerResult.searchQueue).toEqual([]);
  expect(fallback.generation.attempts).toHaveLength(1);
  expect(fallback.generation.attempts[0].envelope).toMatchObject({
    attempt: 1,
    candidateSource: "known-good",
    candidateCursor: 0,
    fallbackTrigger: "no-candidate"
  });
  expect(fallback.generation.attempts[0].status).toBe("accept");
  expect(fallback.snapshot.displayedPlanId).toBe(fallback.generation.attempts[0].envelope.planId);

  await openGenerator(page, {
    seed: cases.retry.seed,
    query: { rankedCandidates: "none", knownGood: "none" }
  });
  const terminal = await page.evaluate(() => {
    const hook = window.__MICRO_GRAPHIC_TEST__;
    let exportError = null;
    try {
      hook.svgArtifact();
    } catch (error) {
      exportError = error.message;
    }
    return {
      generation: hook.generation(),
      snapshot: hook.snapshot(),
      componentCount: document.querySelectorAll("svg[data-component]").length,
      exportError
    };
  });
  expect(terminal.generation.plannerResult.initialSelection.status).toBe("no-candidate");
  expect(terminal.generation.attempts).toEqual([]);
  expect(terminal.generation.terminalResult).toMatchObject({
    terminalReason: "no-candidate-no-known-good",
    rankedStopReason: "no-candidate",
    displayedPlanId: null,
    preservedPrevious: false,
    exportEligible: false,
    lastAttemptResult: null
  });
  expect(terminal.snapshot.displayedPlanId).toBeNull();
  expect(terminal.snapshot.exportPlanId).toBeNull();
  expect(terminal.componentCount).toBe(0);
  expect(terminal.exportError).toBe("No accepted composition is available for export");
  await expect(page.locator("#png")).toBeDisabled();
  await expect(page.locator("#svg")).toBeDisabled();
  await page.locator("#png").evaluate(button => button.click());
  await page.locator("#svg").evaluate(button => button.click());
  await expect(page.locator("body")).not.toHaveAttribute("data-export-failure");
  expect(errors).toEqual([]);
});

test("terminal failure preserves the previous display and export identity", async ({ page }) => {
  const errors = captureErrors(page);
  await openGenerator(page, { seed: cases.recipes[0].seed });
  const before = await page.evaluate(() => ({
    snapshot: window.__MICRO_GRAPHIC_TEST__.snapshot(),
    artifact: window.__MICRO_GRAPHIC_TEST__.svgArtifact(),
    seedLabel: document.querySelector("#seedLabel").textContent
  }));
  const after = await page.evaluate(nextSeed => {
    const hook = window.__MICRO_GRAPHIC_TEST__;
    hook.setRejectionMode("all");
    hook.renderSeed(nextSeed);
    return {
      snapshot: hook.snapshot(),
      generation: hook.generation(),
      artifact: hook.svgArtifact(),
      seedLabel: document.querySelector("#seedLabel").textContent
    };
  }, cases.recipes[1].seed);

  expect(after.generation.terminalResult).toMatchObject({
    terminalReason: "known-good-rejected",
    preservedPrevious: true,
    displayedPlanId: before.snapshot.displayedPlanId,
    displayedStructuralFingerprint: before.snapshot.svgStructuralFingerprint,
    exportEligible: true
  });
  expect(after.snapshot.displayedPlanId).toBe(before.snapshot.displayedPlanId);
  expect(after.snapshot.exportPlanId).toBe(before.snapshot.exportPlanId);
  expect(after.snapshot.seed).toBe(before.snapshot.seed);
  expect(after.snapshot.seedHex).toBe(before.snapshot.seedHex);
  expect(after.snapshot.svgStructuralFingerprint).toBe(before.snapshot.svgStructuralFingerprint);
  expect(after.snapshot.fingerprint.componentRatio).toBe(before.snapshot.fingerprint.componentRatio);
  expect(after.seedLabel).toBe(before.seedLabel);
  expect(after.artifact.filename).toBe(before.artifact.filename);
  expect(after.artifact.structuralFingerprint).toBe(before.artifact.structuralFingerprint);
  expect(after.artifact.byteDigest).toBe(before.artifact.byteDigest);
  expect(errors).toEqual([]);
});

test("context construction failure preserves the accepted display and attempted input", async ({ page }) => {
  const errors = captureErrors(page);
  await openGenerator(page, { seed: cases.recipes[0].seed });
  const result = await page.evaluate(nextSeed => {
    const hook = window.__MICRO_GRAPHIC_TEST__;
    const before = {
      snapshot: hook.snapshot(),
      artifact: hook.svgArtifact(),
      seedLabel: document.querySelector("#seedLabel").textContent
    };
    hook.setContextFailureMode("construction");
    hook.renderSeed(nextSeed);
    return {
      before,
      generation: hook.generation(),
      snapshot: hook.snapshot(),
      artifact: hook.svgArtifact(),
      seedLabel: document.querySelector("#seedLabel").textContent,
      failure: document.body.getAttribute("data-generation-failure")
    };
  }, cases.recipes[1].seed);

  expect(result.generation).toMatchObject({
    plannerResult: null,
    attempts: [],
    planningFailure: "context-construction:test",
    displayedPlanId: result.before.snapshot.displayedPlanId,
    exportPlanId: result.before.snapshot.exportPlanId
  });
  expect(result.generation.generationInput.seed).toBe(cases.recipes[1].seed);
  expect(result.snapshot.seed).toBe(result.before.snapshot.seed);
  expect(result.snapshot.displayedPlanId).toBe(result.before.snapshot.displayedPlanId);
  expect(result.snapshot.svgStructuralFingerprint).toBe(result.before.snapshot.svgStructuralFingerprint);
  expect(result.artifact.filename).toBe(result.before.artifact.filename);
  expect(result.artifact.byteDigest).toBe(result.before.artifact.byteDigest);
  expect(result.seedLabel).toBe(result.before.seedLabel);
  expect(result.failure).toBe("context-construction:test");
  expect(errors).toEqual([]);
});

test("catalog return preserves the accepted component when every replacement is rejected", async ({ page }) => {
  const errors = captureErrors(page);
  await openGenerator(page, { seed: cases.recipes[0].seed });
  const before = await page.evaluate(() => ({
    snapshot: window.__MICRO_GRAPHIC_TEST__.snapshot(),
    artifact: window.__MICRO_GRAPHIC_TEST__.svgArtifact()
  }));
  await page.locator("#mode").click();
  await page.evaluate(() => window.__MICRO_GRAPHIC_TEST__.setRejectionMode("all"));
  await page.locator("#mode").click();
  const after = await page.evaluate(() => ({
    snapshot: window.__MICRO_GRAPHIC_TEST__.snapshot(),
    generation: window.__MICRO_GRAPHIC_TEST__.generation(),
    artifact: window.__MICRO_GRAPHIC_TEST__.svgArtifact(),
    componentCount: document.querySelectorAll("svg[data-component]").length
  }));
  expect(after.generation.terminalResult).toMatchObject({
    terminalReason: "known-good-rejected",
    preservedPrevious: true,
    displayedPlanId: before.snapshot.displayedPlanId,
    exportEligible: true
  });
  expect(after.componentCount).toBe(1);
  expect(after.snapshot.displayedPlanId).toBe(before.snapshot.displayedPlanId);
  expect(after.snapshot.exportPlanId).toBe(before.snapshot.exportPlanId);
  expect(after.artifact.planId).toBe(before.artifact.planId);
  expect(after.artifact.byteDigest).toBe(before.artifact.byteDigest);
  expect(errors).toEqual([]);
});

test("planning complexity failure mounts no partial plan and preserves the previous component", async ({ page }) => {
  const errors = captureErrors(page);
  await openGenerator(page, {
    seed: cases.recipes[0].seed,
    query: { planningFailure: "complexity" }
  });
  const emptyFailure = await page.evaluate(() => {
    const hook = window.__MICRO_GRAPHIC_TEST__;
    return {
      generation: hook.generation(),
      snapshot: hook.snapshot(),
      componentCount: document.querySelectorAll("svg[data-component]").length,
      telemetry: hook.telemetry()
    };
  });
  expect(emptyFailure.generation).toMatchObject({
    plannerResult: null,
    plannerResultFingerprint: null,
    attempts: [],
    rankedAttemptLimit: 0,
    planningFailure: "planning-complexity:test:rankedPlans",
    displayedPlanId: null,
    exportPlanId: null
  });
  expect(emptyFailure.componentCount).toBe(0);
  expect(emptyFailure.telemetry).toEqual([]);

  await openGenerator(page, { seed: cases.recipes[0].seed });
  const preserved = await page.evaluate(nextSeed => {
    const hook = window.__MICRO_GRAPHIC_TEST__;
    const before = {
      snapshot: hook.snapshot(),
      artifact: hook.svgArtifact()
    };
    hook.setPlanningFailureMode("complexity");
    hook.renderSeed(nextSeed);
    return {
      before,
      generation: hook.generation(),
      snapshot: hook.snapshot(),
      artifact: hook.svgArtifact(),
      componentCount: document.querySelectorAll("svg[data-component]").length,
      telemetry: hook.telemetry()
    };
  }, cases.recipes[1].seed);
  expect(preserved.generation).toMatchObject({
    plannerResult: null,
    attempts: [],
    planningFailure: "planning-complexity:test:rankedPlans",
    displayedPlanId: preserved.before.snapshot.displayedPlanId,
    displayedStructuralFingerprint: preserved.before.snapshot.svgStructuralFingerprint,
    exportPlanId: preserved.before.snapshot.exportPlanId
  });
  expect(preserved.componentCount).toBe(1);
  expect(preserved.snapshot.displayedPlanId).toBe(preserved.before.snapshot.displayedPlanId);
  expect(preserved.snapshot.svgStructuralFingerprint).toBe(preserved.before.snapshot.svgStructuralFingerprint);
  expect(preserved.artifact.byteDigest).toBe(preserved.before.artifact.byteDigest);
  expect(preserved.telemetry).toEqual([]);
  expect(errors).toEqual([]);
});

test("validation and structural projection are read-only, canonical, and mutation-sensitive", async ({ page }) => {
  const errors = captureErrors(page);
  await openGenerator(page, { seed: cases.recipes[0].seed });
  const result = await page.evaluate(async () => {
    const hook = window.__MICRO_GRAPHIC_TEST__;
    const { artifactByteDigest, svgStructuralFingerprint } = await import("./src/svg.js");
    const before = hook.snapshot();
    const token = document.querySelector("svg[data-component] [data-message-slot]");
    const originalTransform = token.getAttribute("transform");
    token.setAttribute("transform", `${originalTransform} scale(0.75)`);
    const invalid = hook.validate();
    token.setAttribute("transform", originalTransform);
    const restored = hook.validate();

    const parser = new DOMParser();
    const left = parser.parseFromString(
      '<svg xmlns="http://www.w3.org/2000/svg" data-z="2" data-a="1"><g><rect width="10" height="5"/></g><text x="0">SIGNAL</text></svg>',
      "image/svg+xml"
    ).documentElement;
    const right = parser.parseFromString(
      '<svg xmlns="http://www.w3.org/2000/svg" data-a="1" data-z="2">\n  <g>\n    <rect height="5" width="10"/>\n  </g>\n  <text x="0">SIGNAL</text>\n</svg>',
      "image/svg+xml"
    ).documentElement;
    const sameLeft = svgStructuralFingerprint(left);
    const sameRight = svgStructuralFingerprint(right);
    right.querySelector("text").textContent = "STATUS";
    const changedText = svgStructuralFingerprint(right);
    const artifact = hook.svgArtifact();
    return {
      before,
      after: hook.snapshot(),
      invalid,
      restored,
      sameLeft,
      sameRight,
      changedText,
      artifact,
      recomputedDigest: artifactByteDigest(artifact.text)
    };
  });

  expect(result.invalid.violations).toEqual([
    "geometry.no-scale",
    "composition.physical-block-geometry"
  ]);
  expect(result.restored.valid).toBe(true);
  expect(result.before.prng).toEqual(result.after.prng);
  expect(result.before.displayedPlanId).toBe(result.after.displayedPlanId);
  expect(result.sameLeft).toBe(result.sameRight);
  expect(result.changedText).not.toBe(result.sameRight);
  expect(result.artifact.byteDigest).toBe(result.recomputedDigest);
  expect(createHash("sha256").update(result.artifact.text).digest("hex"))
    .toBe(result.artifact.byteDigest.replace("sha256:", ""));
  expect(errors).toEqual([]);
});

test("rendered validation rejects semantic identity, duplicate-root, and physical-position drift", async ({ page }) => {
  const errors = captureErrors(page);
  await openGenerator(page, { seed: cases.recipes[0].seed });
  const result = await page.evaluate(() => {
    const hook = window.__MICRO_GRAPHIC_TEST__;
    const component = document.querySelector("svg[data-component]");
    const lexical = component.querySelector('[data-message-slot][data-token-source-kind="lexical"][data-translation-set]');
    const text = lexical.querySelector(':scope > text[data-token-form="typography"]');
    const translationSet = lexical.getAttribute("data-translation-set");
    lexical.setAttribute("data-translation-set", "translation-set:wrong");
    const wrongTranslationSet = hook.validate();
    lexical.setAttribute("data-translation-set", translationSet);

    const visibleText = text.textContent;
    text.textContent = `${visibleText} MUTATED`;
    const wrongVisibleText = hook.validate();
    text.textContent = visibleText;

    const duplicate = component.cloneNode(true);
    component.parentElement.appendChild(duplicate);
    const duplicateComponent = hook.validate();
    duplicate.remove();

    const token = [...component.querySelector("[data-grid-block]").children]
      .find(child => child.hasAttribute("data-message-slot"));
    const tokenTransform = token.getAttribute("transform");
    token.setAttribute("transform", `${tokenTransform || ""} translate(500 0)`.trim());
    const shiftedToken = hook.validate();
    if (tokenTransform === null) token.removeAttribute("transform");
    else token.setAttribute("transform", tokenTransform);

    const block = component.querySelector("[data-grid-block]");
    block.setAttribute("transform", "translate(1 0)");
    const shiftedBlock = hook.validate();
    block.removeAttribute("transform");
    const restored = hook.validate();
    return { wrongTranslationSet, wrongVisibleText, duplicateComponent, shiftedToken, shiftedBlock, restored };
  });
  expect(result.wrongTranslationSet.violations).toContain("composition.conditional-identity");
  expect(result.wrongVisibleText.violations).toContain("composition.conditional-identity");
  expect(result.duplicateComponent.violations).toContain("composition.single-component");
  expect(result.shiftedToken.violations).toContain("composition.physical-block-geometry");
  expect(result.shiftedBlock.violations).toContain("composition.physical-block-geometry");
  expect(result.restored.valid).toBe(true);
  expect(errors).toEqual([]);
});

test("Grid, Tone, Compose, SVG, and PNG preserve plan and random state", async ({ page }) => {
  const errors = captureErrors(page);
  await openGenerator(page, { seed: cases.recipes[0].seed });
  const initial = await page.evaluate(() => ({
    snapshot: window.__MICRO_GRAPHIC_TEST__.snapshot(),
    artifact: window.__MICRO_GRAPHIC_TEST__.svgArtifact()
  }));

  await page.locator("#grid").click();
  const gridOff = await page.evaluate(() => ({
    snapshot: window.__MICRO_GRAPHIC_TEST__.snapshot(),
    artifact: window.__MICRO_GRAPHIC_TEST__.svgArtifact()
  }));
  expect(gridOff.snapshot.displayedPlanId).toBe(initial.snapshot.displayedPlanId);
  expect(gridOff.snapshot.svgStructuralFingerprint).toBe(initial.snapshot.svgStructuralFingerprint);
  expect(gridOff.snapshot.prng).toEqual(initial.snapshot.prng);
  expect(gridOff.artifact.structuralFingerprint).toBe(initial.artifact.structuralFingerprint);
  expect(gridOff.artifact.byteDigest).not.toBe(initial.artifact.byteDigest);

  await page.locator("#tone").click();
  const dark = await page.evaluate(() => ({
    snapshot: window.__MICRO_GRAPHIC_TEST__.snapshot(),
    artifact: window.__MICRO_GRAPHIC_TEST__.svgArtifact(),
    background: getComputedStyle(document.body).getPropertyValue("--bg").trim(),
    ink: getComputedStyle(document.body).getPropertyValue("--ink").trim()
  }));
  expect(dark.snapshot.displayedPlanId).toBe(initial.snapshot.displayedPlanId);
  expect(dark.snapshot.svgStructuralFingerprint).toBe(initial.snapshot.svgStructuralFingerprint);
  expect(dark.snapshot.prng).toEqual(initial.snapshot.prng);
  expect(dark.artifact.byteDigest).not.toBe(gridOff.artifact.byteDigest);
  const exportedRootStyle = await page.evaluate(svgText => {
    const root = new DOMParser().parseFromString(svgText, "image/svg+xml").documentElement;
    return {
      background: root.style.getPropertyValue("--bg").trim(),
      ink: root.style.getPropertyValue("--ink").trim()
    };
  }, dark.artifact.text);
  expect(exportedRootStyle).toEqual({ background: dark.background, ink: dark.ink });

  await page.locator("#mode").click();
  const compose = await page.evaluate(() => ({
    snapshot: window.__MICRO_GRAPHIC_TEST__.snapshot(),
    validation: window.__MICRO_GRAPHIC_TEST__.validate()
  }));
  expect(compose.snapshot.fingerprint.mode).toBe("composable-tokens");
  expect(compose.validation.valid).toBe(true);
  await page.locator("#mode").click();
  const returned = await page.evaluate(() => window.__MICRO_GRAPHIC_TEST__.snapshot());
  expect(returned.displayedPlanId).toBe(initial.snapshot.displayedPlanId);
  expect(returned.svgStructuralFingerprint).toBe(initial.snapshot.svgStructuralFingerprint);
  expect(returned.prng).toEqual(initial.snapshot.prng);

  const svgDownloadPromise = page.waitForEvent("download");
  await page.locator("#svg").click();
  const svgDownload = await svgDownloadPromise;
  const svgBytes = await readFile(await svgDownload.path());
  expect(svgDownload.suggestedFilename()).toBe(`micro-graphic-${cases.recipes[0].seed.toString(16)}.svg`);
  expect(svgBytes.toString("utf8")).toContain(`data-plan-id="${initial.snapshot.displayedPlanId}"`);
  expect(initial.artifact.mimeType).toBe("image/svg+xml;charset=utf-8");

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#png").click();
  const download = await downloadPromise;
  const bytes = await readFile(await download.path());
  expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
  expect(bytes.readUInt32BE(16)).toBe(cases.viewport.width * 2);
  expect(bytes.readUInt32BE(20)).toBe(cases.viewport.height * 2);
  expect(download.suggestedFilename()).toBe(`micro-graphic-${cases.recipes[0].seed.toString(16)}.png`);
  const pngCorner = await page.evaluate(async ({ base64, expectedBackground }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const actual = [...context.getImageData(0, 0, 1, 1).data];
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = expectedBackground;
    context.fillRect(0, 0, 1, 1);
    const expected = [...context.getImageData(0, 0, 1, 1).data];
    return { actual, expected };
  }, { base64: bytes.toString("base64"), expectedBackground: dark.background });
  expect(pngCorner.actual).toEqual(pngCorner.expected);
  const afterExport = await page.evaluate(() => window.__MICRO_GRAPHIC_TEST__.snapshot());
  expect(afterExport.displayedPlanId).toBe(initial.snapshot.displayedPlanId);
  expect(afterExport.prng).toEqual(initial.snapshot.prng);
  expect(errors).toEqual([]);
});

test("PNG export freezes plan, filename, and bytes across an asynchronous rerender", async ({ page }) => {
  const errors = captureErrors(page);
  const sourceSeed = cases.recipes[0].seed;
  const nextSeed = cases.recipes[1].seed;
  await openGenerator(page, { seed: sourceSeed });
  const before = await page.evaluate(() => window.__MICRO_GRAPHIC_TEST__.snapshot());

  const isolatedDownloadPromise = page.waitForEvent("download");
  const isolatedResultPromise = page.evaluate(() => window.__MICRO_GRAPHIC_TEST__.exportPng());
  const isolatedDownload = await isolatedDownloadPromise;
  const isolatedResult = await isolatedResultPromise;
  const isolatedBytes = await readFile(await isolatedDownload.path());

  const racedDownloadPromise = page.waitForEvent("download");
  const racedResultPromise = page.evaluate(async seed => {
    const hook = window.__MICRO_GRAPHIC_TEST__;
    const originalDecode = Image.prototype.decode;
    let release;
    let entered;
    const decodeEntered = new Promise(resolve => { entered = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    Image.prototype.decode = async function delayedDecode() {
      entered();
      await gate;
      return originalDecode.call(this);
    };
    try {
      const exportPromise = hook.exportPng();
      await decodeEntered;
      hook.renderSeed(seed);
      release();
      const exportResult = await exportPromise;
      return { exportResult, after: hook.snapshot() };
    } finally {
      release?.();
      Image.prototype.decode = originalDecode;
    }
  }, nextSeed);
  const racedDownload = await racedDownloadPromise;
  const raced = await racedResultPromise;
  const racedBytes = await readFile(await racedDownload.path());

  expect(isolatedResult.mimeType).toBe("image/png");
  expect(raced.exportResult.mimeType).toBe("image/png");
  expect(raced.exportResult.planId).toBe(before.displayedPlanId);
  expect(raced.exportResult.filename).toBe(`micro-graphic-${sourceSeed.toString(16)}.png`);
  expect(racedDownload.suggestedFilename()).toBe(raced.exportResult.filename);
  expect(raced.exportResult.byteDigest).toBe(isolatedResult.byteDigest);
  expect(createHash("sha256").update(racedBytes).digest("hex"))
    .toBe(createHash("sha256").update(isolatedBytes).digest("hex"));
  expect(raced.after.displayedPlanId).not.toBe(before.displayedPlanId);
  expect(errors).toEqual([]);
});

test("glyph-stack SVG export preserves its central baseline", async ({ page }) => {
  const errors = captureErrors(page);
  await openGenerator(page, { seed: cases.retry.seed });
  const result = await page.evaluate(() => {
    const hook = window.__MICRO_GRAPHIC_TEST__;
    for (let seed = 0; seed < 2_000; seed += 1) {
      hook.renderSeed(seed);
      if (document.querySelector('[data-token-orientation="glyph-sideways-stack"]')) {
        return { seed, artifact: hook.svgArtifact() };
      }
    }
    return null;
  });
  expect(result).not.toBeNull();
  expect(result.artifact.text).toContain('dominant-baseline="central"');
  expect(result.artifact.text).not.toContain("text { dominant-baseline:auto; }");
  expect(errors).toEqual([]);
});

test(`deterministic generation keeps ${randomIterations} seeds structurally valid`, async ({ page }) => {
  test.setTimeout(randomIterations >= 1000 ? 600_000 : 120_000);
  const errors = captureErrors(page);
  await openGenerator(page, { seed: cases.retry.seed });
  const result = await page.evaluate(iterations => {
    const hook = window.__MICRO_GRAPHIC_TEST__;
    for (let index = 0; index < iterations; index += 1) {
      const seed = (0x9e3779b9 * (index + 1)) >>> 0;
      const snapshot = hook.renderSeed(seed);
      const generation = hook.generation();
      const accepted = generation.attempts.find(attempt => attempt.status === "accept") || null;
      const rankedAttempts = generation.attempts.filter(attempt => attempt.envelope.candidateSource === "ranked");
      const knownGoodAttempts = generation.attempts.filter(attempt => attempt.envelope.candidateSource === "known-good");
      const blocks = snapshot.fingerprint.blocks;
      const cells = blocks.flatMap(block => block.cells).sort((left, right) => left - right);
      const uniqueMotifViolation = ["motif.barcode", "motif.pseudo-qr"].some(motifId =>
        blocks.filter(block => block.motifId === motifId).length > 1
      );
      const groups = new Map();
      for (const block of blocks.filter(block => block.sourceKind === "lexical")) {
        const key = `${block.footprint}:${block.requestedSize}`;
        if (!groups.has(key)) groups.set(key, new Set());
        groups.get(key).add(block.actualSize);
      }
      const syncViolation = [...groups.values()].some(sizes => sizes.size > 1);
      const failure = snapshot.violations !== 0
        || generation.terminalResult !== null
        || !accepted
        || accepted.envelope.planId !== snapshot.displayedPlanId
        || accepted.status !== "accept"
        || rankedAttempts.length > 8
        || knownGoodAttempts.length !== 0
        || blocks.length < 2
        || blocks.length > 5
        || blocks.filter(block => block.compositionRole === "hero").length !== 1
        || blocks.filter(block => block.prominence === "primary").length !== 1
        || blocks.some(block => !block.fit || !block.value)
        || JSON.stringify(cells) !== JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9])
        || uniqueMotifViolation
        || syncViolation;
      if (failure) {
        return {
          failure: {
            index,
            seed,
            snapshot,
            attempts: generation.attempts,
            uniqueMotifViolation,
            syncViolation
          }
        };
      }
    }
    return { failure: null, iterations };
  }, randomIterations);

  expect(result.failure, JSON.stringify(result.failure, null, 2)).toBeNull();
  expect(result.iterations).toBe(randomIterations);
  expect(errors).toEqual([]);
});

test("predicted motif occupancy avoids normal known-good fallback", async ({ page }) => {
  const errors = captureErrors(page);
  await openGenerator(page, { seed: cases.retry.seed });
  const result = await page.evaluate(() => {
    const hook = window.__MICRO_GRAPHIC_TEST__;
    const snapshot = hook.renderSeed(2296984526);
    const generation = hook.generation();
    return {
      snapshot,
      terminalResult: generation.terminalResult,
      knownGoodAttempts: generation.attempts.filter(attempt =>
        attempt.envelope.candidateSource === "known-good"
      ),
      accepted: generation.attempts.find(attempt => attempt.status === "accept") || null
    };
  });
  expect(result.snapshot.violations).toBe(0);
  expect(result.terminalResult).toBeNull();
  expect(result.knownGoodAttempts).toEqual([]);
  expect(result.accepted?.envelope.candidateSource).toBe("ranked");
  expect(errors).toEqual([]);
});

test("mobile Compose controls stay inside the viewport", async ({ page }) => {
  const errors = captureErrors(page);
  const viewport = { width: 390, height: 844 };
  await openGenerator(page, { seed: cases.visual.mobileComposeSeed, viewport });
  await page.locator("#mode").click();
  const geometry = await page.evaluate(() => ({
    viewport: { width: window.innerWidth, height: window.innerHeight },
    controls: [...document.querySelectorAll(".controls button")].map(element => {
      const box = element.getBoundingClientRect();
      return {
        left: box.left,
        top: box.top,
        right: box.right,
        bottom: box.bottom,
        textFits: element.scrollWidth <= element.clientWidth
      };
    })
  }));
  expect(geometry.controls).toHaveLength(6);
  for (const control of geometry.controls) {
    expect(control.left).toBeGreaterThanOrEqual(0);
    expect(control.top).toBeGreaterThanOrEqual(0);
    expect(control.right).toBeLessThanOrEqual(geometry.viewport.width);
    expect(control.bottom).toBeLessThanOrEqual(geometry.viewport.height);
    expect(control.textFits).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("blind review keeps source identity hidden and fits desktop and mobile", async ({ page }) => {
  const blindServer = await startOwnedTestServer({
    serverPath: fileURLToPath(new URL("./blind-review-server.mjs", import.meta.url)),
    repoRoot: fileURLToPath(new URL("../../..", import.meta.url))
  });
  const errors = captureErrors(page);
  try {
    await blindServer.assertOwner();
    for (const deniedPath of [
      "/web/micro-graphic-generator/tests/fixtures/blind-evaluation-corpus.v1.json",
      "/web/micro-graphic-generator/tests/fixtures/blind-review-results.v1.json",
      "/web/micro-graphic-generator/tests/fixtures/blind-evaluation-report.v1.json",
      "/web/micro-graphic-generator/src/app.js"
    ]) {
      expect((await fetch(blindServer.url(deniedPath))).status).toBe(404);
    }
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto(blindServer.url("/web/micro-graphic-generator/tests/blind-review/"));
      await expect(page.locator("#reviewSurface")).toBeVisible();
      await expect(page.locator("#reviewer option")).toHaveText("No qualified reviewer");
      await expect(page.locator("#submit")).toBeDisabled();
      await page.waitForFunction(() => [...document.querySelectorAll("object")].every(object =>
        object.contentDocument?.documentElement?.tagName.toLowerCase() === "svg"
      ));
      const state = await page.evaluate(async () => {
        const display = await fetch("../fixtures/blind-evaluation-display.v1.json").then(response => response.json());
        const sourceTerms = /(candidate|baseline|recipeId|motifId|heroFinalizationClass|requested|downshifted)/i;
        const objects = [...document.querySelectorAll("object")];
        const sides = [...document.querySelectorAll(".side")].map(element => {
          const box = element.getBoundingClientRect();
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
        });
        const horizontalBounds = [...document.querySelectorAll(".toolbar > *, .rating-row, .pair-rating > *")]
          .filter(element => !element.hidden)
          .map(element => {
            const box = element.getBoundingClientRect();
            return { left: box.left, right: box.right };
          });
        return {
          status: document.querySelector("#status").textContent,
          manifestLeaks: sourceTerms.test(JSON.stringify(display)),
          pageLeaks: sourceTerms.test(document.body.textContent),
          objectData: objects.map(object => object.getAttribute("data")),
          objectRoots: objects.map(object => object.contentDocument.documentElement.tagName.toLowerCase()),
          horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
          horizontalBounds,
          sides,
          fixtureCount: display.fixtures.length
        };
      });
      expect(state.fixtureCount).toBeGreaterThanOrEqual(60);
      expect(state.status).toMatch(/^blind-\d{3,} \/ /);
      expect(state.manifestLeaks).toBe(false);
      expect(state.pageLeaks).toBe(false);
      expect(state.objectData.every(value => value.startsWith("blob:"))).toBe(true);
      expect(state.objectRoots).toEqual(["svg", "svg"]);
      expect(state.horizontalOverflow).toBe(false);
      state.horizontalBounds.forEach(box => {
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(viewport.width);
      });
      if (viewport.width > 900) {
        expect(state.sides[0].right).toBeLessThanOrEqual(state.sides[1].left);
      } else {
        expect(state.sides[0].bottom).toBeLessThanOrEqual(state.sides[1].top);
      }
    }
    expect(errors).toEqual([]);
  } finally {
    await blindServer.stop();
  }
});

test("blind review excludes future-dated reviewer qualifications", async ({ page }) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "blind-future-qualification-"));
  const qualificationPath = join(temporaryRoot, "reviewer-qualifications.json");
  const verifiedAt = "2099-01-01T00:00:00Z";
  const qualificationSet = {
    schemaVersion: 1,
    qualificationSetId: "reviewer-qualifications:future-test-v1",
    verifiedAt,
    reviewers: [{
      reviewerId: "future-reviewer",
      qualifications: ["en", "ko", "zh"].map(language => ({
        language,
        basis: "professional",
        verifiedBy: "evaluation-owner-01",
        verifiedAt
      }))
    }]
  };
  await writeFile(qualificationPath, `${JSON.stringify(qualificationSet)}\n`);
  const blindServer = await startOwnedTestServer({
    serverPath: fileURLToPath(new URL("./blind-review-server.mjs", import.meta.url)),
    repoRoot: fileURLToPath(new URL("../../..", import.meta.url)),
    env: { BLIND_REVIEW_QUALIFICATION_PATH: qualificationPath }
  });
  const errors = captureErrors(page);
  try {
    await page.goto(blindServer.url("/web/micro-graphic-generator/tests/blind-review/"));
    await expect(page.locator("#reviewSurface")).toBeVisible();
    await expect(page.locator("#status")).toContainText("blind-");
    await expect(page.locator("#reviewer option")).toHaveText("No qualified reviewer");
    await expect(page.locator('#reviewer option[value="future-reviewer"]')).toHaveCount(0);
    await expect(page.locator("#submit")).toBeDisabled();
    expect(errors).toEqual([]);
  } finally {
    await blindServer.stop();
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

const visualCases = [
  { name: "composition-desktop-command.png", seedKey: "desktopCommandSeed", viewport: { width: 1440, height: 900 } },
  { name: "composition-portrait-motif.png", seedKey: "portraitMotifSeed", viewport: { width: 900, height: 1200 } },
  { name: "composition-mobile-compose.png", seedKey: "mobileComposeSeed", viewport: { width: 390, height: 844 }, compose: true }
];

for (const visualCase of visualCases) {
  test(`visual reference: ${visualCase.name}`, async ({ page }) => {
    const errors = captureErrors(page);
    await openGenerator(page, {
      seed: cases.visual[visualCase.seedKey],
      viewport: visualCase.viewport
    });
    if (visualCase.compose) await page.locator("#mode").click();
    expect(errors).toEqual([]);
    await expect(page).toHaveScreenshot(visualCase.name, {
      animations: "disabled",
      caret: "hide",
      scale: "css"
    });
  });
}
