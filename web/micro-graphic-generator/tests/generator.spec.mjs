import { createHash } from "node:crypto";
import { readFile, readFileSync } from "node:fs";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";

const readFileAsync = promisify(readFile);
const baseline = JSON.parse(readFileSync(new URL("./fixtures/baseline.json", import.meta.url), "utf8"));
const exportBaseline = JSON.parse(readFileSync(new URL("./fixtures/export-baseline.json", import.meta.url), "utf8"));
const primitiveBaseline = JSON.parse(readFileSync(new URL("./fixtures/primitive-baseline.json", import.meta.url), "utf8"));
const defaultFixture = baseline.fixtures[0];
const randomIterations = Number(process.env.GENERATOR_RANDOM_ITERATIONS || 100);

function fixtureUrl(fixture) {
  const search = new URLSearchParams({
    test: "1",
    seed: String(fixture.seed),
    now: fixture.now
  });
  return `./?${search}`;
}

async function openGenerator(page, fixture = defaultFixture) {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.setViewportSize(fixture.viewport);
  await page.goto(fixtureUrl(fixture));
  await page.waitForFunction(() => Boolean(window.__MICRO_GRAPHIC_TEST__));
  const snapshot = await page.evaluate(() => window.__MICRO_GRAPHIC_TEST__.ready);
  return { errors, snapshot };
}

async function currentSnapshot(page) {
  return page.evaluate(() => window.__MICRO_GRAPHIC_TEST__.snapshot());
}

async function pngDownloadSummary(page) {
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#png").click();
  const download = await downloadPromise;
  const path = await download.path();
  const bytes = await readFileAsync(path);
  expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
  return {
    filename: download.suggestedFilename(),
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    hash: createHash("sha256").update(bytes).digest("hex")
  };
}

async function svgDownloadSummary(page) {
  await page.evaluate(() => {
    const originalCreateObjectURL = URL.createObjectURL;
    window.__SVG_EXPORT_MIME_TYPES__ = [];
    window.__RESTORE_CREATE_OBJECT_URL__ = () => {
      URL.createObjectURL = originalCreateObjectURL;
      delete window.__RESTORE_CREATE_OBJECT_URL__;
    };
    URL.createObjectURL = function captureSvgBlobType(blob) {
      window.__SVG_EXPORT_MIME_TYPES__.push(blob.type);
      return originalCreateObjectURL.call(this, blob);
    };
  });

  try {
    const downloadPromise = page.waitForEvent("download");
    await page.locator("#svg").click();
    const download = await downloadPromise;
    const path = await download.path();
    const content = await readFileAsync(path, "utf8");
    const mimeTypes = await page.evaluate(() => [...window.__SVG_EXPORT_MIME_TYPES__]);
    return { filename: download.suggestedFilename(), mimeTypes, content };
  } finally {
    await page.evaluate(() => {
      window.__RESTORE_CREATE_OBJECT_URL__?.();
      delete window.__SVG_EXPORT_MIME_TYPES__;
    });
  }
}

for (const fixture of baseline.fixtures) {
  test(`baseline fixture: ${fixture.name}`, async ({ page }) => {
    const { errors, snapshot } = await openGenerator(page, fixture);
    expect(errors).toEqual([]);
    expect(snapshot.violations).toBe(0);
    expect(snapshot.fingerprint).toEqual(fixture.expected);
    expect(snapshot.prng).toEqual(fixture.expectedPrng);
  });
}

test("uniform typography groups isolate 1x3 and 3x1", async ({ page }) => {
  await openGenerator(page);
  const keys = await page.evaluate(() => ({
    vertical: window.__MICRO_GRAPHIC_TEST__.uniformTypographyGroupKey("footprint:1x3", "xxlarge"),
    horizontal: window.__MICRO_GRAPHIC_TEST__.uniformTypographyGroupKey("footprint:3x1", "xxlarge")
  }));
  expect(keys.vertical).toBe("footprint:1x3:xxlarge");
  expect(keys.horizontal).toBe("footprint:3x1:xxlarge");
  expect(keys.vertical).not.toBe(keys.horizontal);
});

test("rendered overflow uses the prepared fallback without new random draws", async ({ page }) => {
  const fixture = baseline.fixtures.find(item => item.name === "vertical-cjk-glyph-stack");
  const { errors } = await openGenerator(page, fixture);
  const result = await page.evaluate(() => {
    const hook = window.__MICRO_GRAPHIC_TEST__;
    const component = document.querySelector("svg[data-component]");
    const block = component.querySelector('[data-grid-footprint="1x3"]');
    const target = block.querySelector(":scope > [data-grid-token]");
    const otherTokens = [...component.querySelectorAll("[data-grid-token]")].filter(token => token !== target);
    const otherBefore = otherTokens.map(token => token.outerHTML);
    const positionX = Number(block.getAttribute("data-grid-position-x"));
    const positionY = Number(block.getAttribute("data-grid-position-y"));
    const prngBefore = hook.snapshot().prng;

    block.setAttribute("data-grid-content-x", String(positionX - 7));
    block.setAttribute("data-grid-content-y", String(positionY - 7));
    block.setAttribute("data-grid-content-width", "14");
    block.setAttribute("data-grid-content-height", "14");
    hook.finalizeGrid();

    const text = target.querySelector(':scope > text[data-token-form="typography"]');
    return {
      prngBefore,
      prngAfter: hook.snapshot().prng,
      sameTargetNode: target === block.querySelector(":scope > [data-grid-token]"),
      role: target.getAttribute("data-grid-token"),
      value: text?.textContent,
      orientation: target.getAttribute("data-token-orientation"),
      fit: target.getAttribute("data-token-fit"),
      otherBefore,
      otherAfter: otherTokens.map(token => token.outerHTML)
    };
  });

  expect(result.prngAfter).toEqual(result.prngBefore);
  expect(result.sameTargetNode).toBe(true);
  expect(result.role).toBe("cell-index");
  expect(result.value).toBe("1");
  expect(result.orientation).toBe("whole-rotate");
  expect(result.fit).toBe("true");
  expect(result.otherAfter).toEqual(result.otherBefore);
  expect(errors).toEqual([]);
});

test("validation reports one precise rule without mutating random state", async ({ page }) => {
  const { errors } = await openGenerator(page);
  const result = await page.evaluate(() => {
    const hook = window.__MICRO_GRAPHIC_TEST__;
    const token = document.querySelector("svg[data-component] [data-grid-token]");
    const prngBefore = hook.snapshot().prng;
    token.setAttribute("data-token-scale", "0.75");
    const validation = hook.validate();
    const metadataCount = document.querySelector("#art").getAttribute("data-rule-violations");
    const metadataList = document.querySelector("#art").getAttribute("data-rule-violation-list");
    token.setAttribute("data-token-scale", "1");
    const fixedOrientationToken = document.querySelector('[data-grid-footprint="1x1"] > [data-grid-token]');
    fixedOrientationToken.setAttribute("data-token-orientation", "whole-rotate");
    fixedOrientationToken.setAttribute("data-token-rotation", "90");
    const orientationValidation = hook.validate();
    const orientationMetadataList = document.querySelector("#art").getAttribute("data-rule-violation-list");
    return {
      prngBefore,
      prngAfter: hook.snapshot().prng,
      violations: validation.violations,
      invalidResults: validation.results.filter(item => !item.valid),
      orientationViolations: orientationValidation.violations,
      metadataCount,
      metadataList,
      orientationMetadataList
    };
  });

  expect(result.prngAfter).toEqual(result.prngBefore);
  expect(result.violations).toEqual(["grid.position-only"]);
  expect(result.invalidResults).toHaveLength(1);
  expect(result.invalidResults[0]).toMatchObject({
    rule: "grid.position-only",
    valid: false
  });
  expect(result.invalidResults[0].nodes).toHaveLength(1);
  expect(result.metadataCount).toBe("1");
  expect(result.metadataList).toBe("grid.position-only");
  expect(result.orientationViolations).toEqual(["grid.orientation"]);
  expect(result.orientationMetadataList).toBe("grid.orientation");
  expect(errors).toEqual([]);
});

test("validation requires a Component only in Random mode", async ({ page }) => {
  const { errors } = await openGenerator(page);
  const randomResult = await page.evaluate(() => {
    const hook = window.__MICRO_GRAPHIC_TEST__;
    const before = hook.snapshot().prng;
    const duplicate = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    duplicate.setAttribute("data-component", "duplicate");
    document.querySelector("#art").appendChild(duplicate);
    const duplicateValidation = hook.validate();
    duplicate.remove();
    document.querySelector("svg[data-component]").remove();
    const missingValidation = hook.validate();
    return { before, after: hook.snapshot().prng, duplicateValidation, missingValidation };
  });

  expect(randomResult.after).toEqual(randomResult.before);
  expect(randomResult.duplicateValidation.violations).toEqual(["grid.structure"]);
  expect(randomResult.duplicateValidation.results.find(result => result.rule === "grid.structure")).toMatchObject({
    valid: false,
    detail: "Random mode requires exactly one rendered Component; found 2"
  });
  expect(randomResult.missingValidation.violations).toEqual(["grid.structure"]);
  expect(randomResult.missingValidation.results.find(result => result.rule === "grid.structure")).toMatchObject({
    valid: false,
    detail: "Random mode requires exactly one rendered Component; found 0"
  });

  await page.locator("#mode").click();
  const composeValidation = await page.evaluate(() => window.__MICRO_GRAPHIC_TEST__.validate());
  expect(composeValidation.valid).toBe(true);
  expect(composeValidation.violations).toEqual([]);
  expect(errors).toEqual([]);
});

test("graphic primitive SVG structures match the baseline", async ({ page }) => {
  await page.goto("./");
  const snapshots = await page.evaluate(async seed => {
    const [{ createRandomSource }, { createGraphicPrimitives }, { visualTokens }, { make }] = await Promise.all([
      import("./src/random.js"),
      import("./src/graphics.js"),
      import("./src/vocabulary.js"),
      import("./src/svg.js")
    ]);
    const names = ["barcode", "pseudoQr", "miniTable", "wave", "microBadge"];
    const output = {};
    for (const name of names) {
      const randomSource = createRandomSource(seed);
      const primitives = createGraphicPrimitives({ randomSource, visualTokens });
      const root = make("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 300 140" });
      if (name === "barcode") primitives.barcode(root, 20, 20, 240, 80, { digits: "03600029145", caption: true });
      if (name === "pseudoQr") primitives.pseudoQr(root, 20, 10, 120);
      if (name === "miniTable") primitives.miniTable(root, 20, 10, 240, { maxHeight: 120 });
      if (name === "wave") primitives.wave(root, 20, 20, 240, 80);
      if (name === "microBadge") primitives.microBadge(root, 20, 20, "REV A");
      output[name] = {
        svg: new XMLSerializer().serializeToString(root),
        prng: randomSource.snapshot()
      };
    }
    return output;
  }, primitiveBaseline.seed);

  for (const [name, snapshot] of Object.entries(snapshots)) {
    expect(createHash("sha256").update(snapshot.svg).digest("hex")).toBe(primitiveBaseline.primitives[name].sha256);
    expect(snapshot.prng).toEqual(primitiveBaseline.primitives[name].prng);
  }
});

test(`Random control keeps ${randomIterations} generations valid`, async ({ page }) => {
  await page.addInitScript(() => {
    const nativeGetRandomValues = crypto.getRandomValues.bind(crypto);
    let deterministicSeed = 0x13579bdf;
    crypto.getRandomValues = array => {
      if (array instanceof Uint32Array && array.length === 1) {
        deterministicSeed = (deterministicSeed + 0x9e3779b9) >>> 0;
        array[0] = deterministicSeed;
        return array;
      }
      return nativeGetRandomValues(array);
    };
  });
  const { errors } = await openGenerator(page);
  const result = await page.evaluate(iterations => {
    const seeds = new Set();
    for (let index = 0; index < iterations; index += 1) {
      document.querySelector("#random").click();
      const snapshot = window.__MICRO_GRAPHIC_TEST__.snapshot();
      seeds.add(snapshot.seed);
      const blocks = snapshot.fingerprint.blocks;
      const uniqueRoles = ["barcode", "pseudo-qr"];
      const duplicateUniqueRole = uniqueRoles.find(role => blocks.filter(block => block.role === role).length > 1);
      const failure = snapshot.violations ||
        blocks.length < 2 ||
        blocks.length > 5 ||
        blocks.some(block => !block.role || !block.value || !block.fit) ||
        duplicateUniqueRole;
      if (failure) return { failure: { index, seed: snapshot.seed, snapshot, duplicateUniqueRole } };
    }
    return { failure: null, iterations, uniqueSeeds: seeds.size };
  }, randomIterations);

  expect(errors).toEqual([]);
  expect(result.failure, JSON.stringify(result.failure, null, 2)).toBeNull();
  expect(result.iterations).toBe(randomIterations);
  expect(result.uniqueSeeds).toBeGreaterThan(Math.floor(randomIterations * 0.99));
});

test("tone, grid, compose, fonts, and viewport changes preserve deterministic structure", async ({ page }) => {
  const fixture = baseline.fixtures.find(item => item.name === "vertical-uniform-glyph-stack");
  const { errors, snapshot: initial } = await openGenerator(page, fixture);

  await page.locator("#tone").click();
  const dark = await currentSnapshot(page);
  expect(dark.fingerprint.tone).toBe("dark");
  expect(dark.structuralFingerprint).toBe(initial.structuralFingerprint);
  expect(dark.prng).toEqual(initial.prng);

  await page.locator("#grid").click();
  const gridOff = await currentSnapshot(page);
  expect(gridOff.fingerprint.grid).toBe(false);
  expect(gridOff.structuralFingerprint).toBe(initial.structuralFingerprint);
  expect(gridOff.prng).toEqual(initial.prng);

  await page.locator("#mode").click();
  expect((await currentSnapshot(page)).fingerprint.mode).toBe("composable-tokens");
  await page.locator("#mode").click();
  const returned = await currentSnapshot(page);
  expect(returned.structuralFingerprint).toBe(initial.structuralFingerprint);
  expect(returned.prng).toEqual(initial.prng);

  const beforeFonts = await currentSnapshot(page);
  await page.evaluate(async () => document.fonts && document.fonts.ready);
  const afterFonts = await currentSnapshot(page);
  expect(afterFonts.structuralFingerprint).toBe(beforeFonts.structuralFingerprint);
  expect(afterFonts.prng).toEqual(beforeFonts.prng);

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForFunction(() => window.innerWidth === 1024 && window.innerHeight === 768);
  await page.setViewportSize(fixture.viewport);
  await page.waitForFunction(
    viewport => window.innerWidth === viewport.width && window.innerHeight === viewport.height,
    fixture.viewport
  );
  const resizedBack = await currentSnapshot(page);
  expect(resizedBack.structuralFingerprint).toBe(initial.structuralFingerprint);
  expect(resizedBack.prng).toEqual(initial.prng);
  expect(errors).toEqual([]);
});

test("SVG and PNG exports preserve tone, grid, and 2x dimensions", async ({ page }) => {
  const fixture = baseline.fixtures.find(item => item.name === "maximum-three-by-two");
  const { errors } = await openGenerator(page, fixture);
  const initial = await currentSnapshot(page);

  const svgGridOn = await page.evaluate(() => window.__MICRO_GRAPHIC_TEST__.svgText());
  expect(svgGridOn).toContain("fonts/fonts.css");
  expect(svgGridOn).toContain("data-grid-outlines=\"visible\"");
  expect(svgGridOn).toContain("opacity=\"0.18\"");
  expect(svgGridOn).toContain("background: rgb(244, 244, 239)");
  expect(svgGridOn).toContain("svg { color: #10110f; }");
  expect(svgGridOn).not.toContain("data-app-mode");
  const svgDownload = await svgDownloadSummary(page);
  expect(svgDownload.filename).toBe(`micro-graphic-${fixture.seed.toString(16)}.svg`);
  expect(svgDownload.mimeTypes).toEqual(["image/svg+xml;charset=utf-8"]);
  expect(svgDownload.content).toBe(svgGridOn);
  expect(createHash("sha256").update(svgDownload.content).digest("hex"))
    .toBe(exportBaseline.states.lightGridOn.svgSha256);
  const afterSvgDownload = await currentSnapshot(page);
  expect(afterSvgDownload.prng).toEqual(initial.prng);
  expect(afterSvgDownload.structuralFingerprint).toBe(initial.structuralFingerprint);

  const lightGridOn = await pngDownloadSummary(page);
  expect(lightGridOn).toMatchObject({
    width: exportBaseline.states.lightGridOn.width,
    height: exportBaseline.states.lightGridOn.height,
    hash: exportBaseline.states.lightGridOn.sha256
  });
  const afterFirstPng = await currentSnapshot(page);
  expect(afterFirstPng.prng).toEqual(initial.prng);
  expect(afterFirstPng.structuralFingerprint).toBe(initial.structuralFingerprint);

  await page.locator("#grid").click();
  const svgGridOff = await page.evaluate(() => window.__MICRO_GRAPHIC_TEST__.svgText());
  expect(svgGridOff).toContain("data-grid-outlines=\"hidden\"");
  expect(svgGridOff).toContain("opacity=\"0\"");
  const lightGridOffSvgDownload = await svgDownloadSummary(page);
  expect(lightGridOffSvgDownload).toMatchObject({
    filename: `micro-graphic-${fixture.seed.toString(16)}.svg`,
    mimeTypes: ["image/svg+xml;charset=utf-8"],
    content: svgGridOff
  });
  expect(createHash("sha256").update(lightGridOffSvgDownload.content).digest("hex"))
    .toBe(exportBaseline.states.lightGridOff.svgSha256);
  const lightGridOff = await pngDownloadSummary(page);

  await page.locator("#tone").click();
  const svgDarkGridOff = await page.evaluate(() => window.__MICRO_GRAPHIC_TEST__.svgText());
  expect(svgDarkGridOff).toContain("background: rgb(17, 18, 16)");
  expect(svgDarkGridOff).toContain("svg { color: #f1f1e7; }");
  const darkGridOffSvgDownload = await svgDownloadSummary(page);
  expect(darkGridOffSvgDownload).toMatchObject({
    filename: `micro-graphic-${fixture.seed.toString(16)}.svg`,
    mimeTypes: ["image/svg+xml;charset=utf-8"],
    content: svgDarkGridOff
  });
  expect(createHash("sha256").update(darkGridOffSvgDownload.content).digest("hex"))
    .toBe(exportBaseline.states.darkGridOff.svgSha256);
  const darkGridOff = await pngDownloadSummary(page);
  await page.locator("#grid").click();
  const svgDarkGridOn = await page.evaluate(() => window.__MICRO_GRAPHIC_TEST__.svgText());
  expect(svgDarkGridOn).toContain("data-grid-outlines=\"visible\"");
  expect(svgDarkGridOn).toContain("opacity=\"0.18\"");
  const darkGridOnSvgDownload = await svgDownloadSummary(page);
  expect(darkGridOnSvgDownload).toMatchObject({
    filename: `micro-graphic-${fixture.seed.toString(16)}.svg`,
    mimeTypes: ["image/svg+xml;charset=utf-8"],
    content: svgDarkGridOn
  });
  expect(createHash("sha256").update(darkGridOnSvgDownload.content).digest("hex"))
    .toBe(exportBaseline.states.darkGridOn.svgSha256);
  const darkGridOn = await pngDownloadSummary(page);

  const hashes = [lightGridOn.hash, lightGridOff.hash, darkGridOff.hash, darkGridOn.hash];
  expect(new Set(hashes).size).toBe(hashes.length);
  expect(lightGridOff.hash).toBe(exportBaseline.states.lightGridOff.sha256);
  expect(darkGridOff.hash).toBe(exportBaseline.states.darkGridOff.sha256);
  expect(darkGridOn.hash).toBe(exportBaseline.states.darkGridOn.sha256);
  const afterAllExports = await currentSnapshot(page);
  expect(afterAllExports.prng).toEqual(initial.prng);
  expect(afterAllExports.structuralFingerprint).toBe(initial.structuralFingerprint);
  expect(errors).toEqual([]);
});

test("mobile Compose toolbar keeps every control inside the viewport", async ({ page }) => {
  const sourceFixture = baseline.fixtures.find(item => item.name === "maximum-three-by-two");
  const fixture = { ...sourceFixture, viewport: { width: 390, height: 844 } };
  const { errors } = await openGenerator(page, fixture);
  await page.locator("#mode").click();
  const geometry = await page.evaluate(() => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const describe = element => {
      const box = element.getBoundingClientRect();
      return {
        left: box.left,
        top: box.top,
        right: box.right,
        bottom: box.bottom,
        textFits: element.scrollWidth <= element.clientWidth
      };
    };
    return {
      viewport,
      controls: [...document.querySelectorAll(".controls button")].map(describe),
      seed: describe(document.querySelector("#seedLabel"))
    };
  });

  expect(geometry.controls).toHaveLength(6);
  for (const control of geometry.controls) {
    expect(control.left).toBeGreaterThanOrEqual(0);
    expect(control.top).toBeGreaterThanOrEqual(0);
    expect(control.right).toBeLessThanOrEqual(geometry.viewport.width);
    expect(control.bottom).toBeLessThanOrEqual(geometry.viewport.height);
    expect(control.textFits).toBe(true);
  }
  expect(geometry.seed.left).toBeGreaterThanOrEqual(0);
  expect(geometry.seed.right).toBeLessThanOrEqual(geometry.viewport.width);
  expect(geometry.seed.textFits).toBe(true);
  expect(errors).toEqual([]);
});

const visualCases = [
  {
    name: "desktop-vertical-grid-light.png",
    fixtureName: "vertical-uniform-glyph-stack",
    viewport: { width: 1440, height: 900 }
  },
  {
    name: "portrait-maximum-block-light.png",
    fixtureName: "maximum-two-by-three",
    viewport: { width: 900, height: 1200 }
  },
  {
    name: "mobile-mixed-grid-light.png",
    fixtureName: "vertical-cjk-glyph-stack",
    viewport: { width: 390, height: 844 }
  },
  {
    name: "mobile-compose-light.png",
    fixtureName: "maximum-three-by-two",
    viewport: { width: 390, height: 844 },
    controls: ["#mode"]
  },
  {
    name: "desktop-wide-dark-grid-off.png",
    fixtureName: "maximum-three-by-two",
    viewport: { width: 1440, height: 900 },
    controls: ["#tone", "#grid"]
  }
];

for (const visualCase of visualCases) {
  test(`visual reference: ${visualCase.name}`, async ({ page }) => {
    const sourceFixture = baseline.fixtures.find(item => item.name === visualCase.fixtureName);
    const fixture = { ...sourceFixture, viewport: visualCase.viewport };
    const { errors } = await openGenerator(page, fixture);
    for (const selector of visualCase.controls || []) {
      await page.locator(selector).click();
    }
    expect(errors).toEqual([]);
    await expect(page).toHaveScreenshot(visualCase.name, {
      animations: "disabled",
      caret: "hide",
      scale: "css"
    });
  });
}
