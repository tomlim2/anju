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
    vertical: window.__MICRO_GRAPHIC_TEST__.uniformTypographyGroupKey("1x3", "xxlarge"),
    horizontal: window.__MICRO_GRAPHIC_TEST__.uniformTypographyGroupKey("3x1", "xxlarge")
  }));
  expect(keys.vertical).toBe("1x3:xxlarge");
  expect(keys.horizontal).toBe("3x1:xxlarge");
  expect(keys.vertical).not.toBe(keys.horizontal);
});

test("rendered overflow uses the prepared fallback without new random draws", async ({ page }) => {
  const fixture = baseline.fixtures.find(item => item.name === "vertical-whole-rotate");
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
    return {
      prngBefore,
      prngAfter: hook.snapshot().prng,
      violations: validation.violations,
      invalidResults: validation.results.filter(item => !item.valid),
      metadataCount: document.querySelector("#art").getAttribute("data-rule-violations"),
      metadataList: document.querySelector("#art").getAttribute("data-rule-violation-list")
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
      if (failure) return { index, snapshot, duplicateUniqueRole };
    }
    return { iterations, uniqueSeeds: seeds.size };
  }, randomIterations);

  expect(errors).toEqual([]);
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
  const afterSvg = await currentSnapshot(page);
  expect(afterSvg.prng).toEqual(initial.prng);
  expect(afterSvg.structuralFingerprint).toBe(initial.structuralFingerprint);

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
  const lightGridOff = await pngDownloadSummary(page);

  await page.locator("#tone").click();
  const darkGridOff = await pngDownloadSummary(page);
  await page.locator("#grid").click();
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
    fixtureName: "vertical-whole-rotate",
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
