import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { FONT_ASSET_REVISION } from "../src/composition-owner-snapshot.js";
import { BROWSER_CONFORMANCE_PROFILE } from "../src/config.js";
import { MOTIF_REGISTRY_VERSION, motifRegistry } from "../src/motifs.js";
import { assertRuntimeConformance } from "../tests/runtime-conformance.mjs";
import { startOwnedTestServer } from "./owned-test-server.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const fixturePath = fileURLToPath(new URL("../tests/fixtures/motif-occupancy-calibration.json", import.meta.url));
let baseUrl;
const write = process.argv.includes("--write");

assertRuntimeConformance({ playwrightProject: "chromium-http" });

function round9(value) {
  const rounded = Math.round(value * 1_000_000_000) / 1_000_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

async function measureVariants(page) {
  return page.evaluate(async () => {
    const [{ materializeMotifCandidates }, { renderCompositionMotif, motifRenderTelemetry }, { make }] = await Promise.all([
      import("./src/motifs.js"),
      import("./src/graphics.js"),
      import("./src/svg.js")
    ]);
    const round9 = value => {
      const rounded = Math.round(value * 1_000_000_000) / 1_000_000_000;
      return Object.is(rounded, -0) ? 0 : rounded;
    };
    const fontUrl = new URL("./fonts/NotoSansMono-Regular.ttf", window.location.href).href;
    const fontDescriptor = '400 80px "Noto Sans Mono"';
    const loadedFonts = await document.fonts.load(fontDescriptor);
    await document.fonts.ready;
    if (loadedFonts.length === 0 || !document.fonts.check(fontDescriptor)) {
      throw new Error("Approved calibration font failed to load");
    }
    const variants = [];
    for (const candidate of materializeMotifCandidates()) {
      const svg = make("svg", {
        xmlns: "http://www.w3.org/2000/svg",
        width: 512,
        height: 512,
        viewBox: `0 0 ${candidate.intrinsicBounds.width} ${candidate.intrinsicBounds.height}`,
        color: "#000"
      });
      const group = make("g");
      const style = make("style");
      style.textContent = `
        @font-face {
          font-family: "Noto Sans Mono";
          src: url("${fontUrl}") format("truetype");
          font-style: normal;
          font-weight: 400;
        }
      `;
      svg.appendChild(style);
      svg.appendChild(group);
      renderCompositionMotif(group, candidate.intrinsicBounds, candidate.renderParams);
      const markup = new XMLSerializer().serializeToString(svg);
      const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.clearRect(0, 0, 512, 512);
      context.drawImage(image, 0, 0, 512, 512);
      URL.revokeObjectURL(url);
      const pixels = context.getImageData(0, 0, 512, 512).data;
      let opacityWeightedPixels = 0;
      let paintedPixelCount = 0;
      for (let index = 3; index < pixels.length; index += 4) {
        opacityWeightedPixels += pixels[index] / 255;
        if (pixels[index] > 0) paintedPixelCount += 1;
      }
      const telemetry = motifRenderTelemetry(candidate.renderParams);
      variants.push({
        candidateId: candidate.candidateId,
        motifId: candidate.motifId,
        size: candidate.renderParams.size,
        renderParamsHash: candidate.renderParamsHash,
        opacityWeightedCoverage: round9(opacityWeightedPixels / (512 * 512)),
        paintedPixelCoverage: round9(paintedPixelCount / (512 * 512)),
        primitiveCount: telemetry.primitiveCount,
        density: round9(telemetry.density)
      });
    }
    return variants;
  });
}

const server = await startOwnedTestServer({ repoRoot });
baseUrl = server.url("/web/micro-graphic-generator/");

let browser;
try {
  await server.assertOwner();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(baseUrl);
  const variants = await measureVariants(page);
  const families = motifRegistry.map(record => {
    const coverages = variants
      .filter(variant => variant.motifId === record.id)
      .map(variant => variant.opacityWeightedCoverage)
      .sort((left, right) => left - right);
    const p95Index = Math.max(0, Math.ceil(coverages.length * 0.95) - 1);
    const measuredP95Coverage = round9(coverages[p95Index]);
    if (measuredP95Coverage !== record.p95Coverage) {
      throw new Error(`${record.id} p95 drift: ${measuredP95Coverage} !== ${record.p95Coverage}`);
    }
    return {
      motifId: record.id,
      declaredVariantCount: record.declaredVariantCount,
      p95Coverage: measuredP95Coverage,
      occupancySafetyFactor: record.occupancySafetyFactor,
      occupancyCalibrationRevision: record.occupancyCalibrationRevision,
      reviewerIds: [...record.calibrationReviewerIds]
    };
  });
  const fixture = {
    schemaVersion: 1,
    browserProfile: BROWSER_CONFORMANCE_PROFILE,
    browserRevision: browser.version(),
    canvas: { width: 512, height: 512, background: "transparent" },
    font: {
      family: "Noto Sans Mono",
      weight: 400,
      assetRevision: FONT_ASSET_REVISION
    },
    motifVersion: MOTIF_REGISTRY_VERSION,
    variants,
    families
  };
  const serialized = `${JSON.stringify(fixture, null, 2)}\n`;
  if (write) {
    await writeFile(fixturePath, serialized);
  } else {
    const existing = await readFile(fixturePath, "utf8");
    if (existing !== serialized) throw new Error("motif calibration fixture is stale; run with --write");
  }
  process.stdout.write(`${write ? "wrote" : "verified"} ${fixturePath}\n`);
} finally {
  await browser?.close();
  await server.stop();
}

if (server.stderr()) process.stderr.write(server.stderr());
