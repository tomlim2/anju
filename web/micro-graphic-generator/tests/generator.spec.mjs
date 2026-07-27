import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const cases = JSON.parse(readFileSync(
  new URL("./fixtures/composition-browser-cases.json", import.meta.url),
  "utf8"
));

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
      (report.occupancyBounds.width / safeBox.width)
      * (report.occupancyBounds.height / safeBox.height)
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

test("every supported ratio mounts one exact typography-first Component", async ({ page }) => {
  const errors = captureErrors(page);
  for (const fixture of cases.ratios) {
    await openGenerator(page, { seed: fixture.seed });
    expectAcceptedComposition(await acceptedState(page), fixture.ratio);
  }
  expect(errors).toEqual([]);
});
