import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import {
  DESIGN_TOKEN_SIZE_ORDER,
  GRID_BLOCK_FOOTPRINTS,
  GRID_BLOCK_POLICIES,
  GRID_BLOCK_POLICY_BY_FOOTPRINT
} from "../src/config.js";
import { upcPattern } from "../src/graphics.js";
import {
  buildGridBlockLayout,
  gridBlockCells,
  uniformTypographyGroupKey
} from "../src/grid-layout.js";
import { createGridSelectionEngine } from "../src/grid-selection.js";
import { createRandomSource } from "../src/random.js";
import {
  fontWeightValueForToken,
  tokenTaxonomyAttrs,
  typographySizeFallbacks,
  typographyToken,
  typographyWordKey
} from "../src/token-model.js";
import {
  createTypographyMeasurer,
  orientationModesForTypography
} from "../src/typography.js";

const repoRoot = new URL("../../../", import.meta.url);

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, repoRoot), "utf8"));
}

test("launch contract selects localhost as the required source of truth", async () => {
  const contract = await readJson("web/micro-graphic-generator/tests/launch-contract.json");
  assert.equal(contract.schemaVersion, 1);
  assert.equal(contract.mode, "localhost-only");
  assert.equal(contract.http.required, true);
  assert.equal(contract.directFile.required, false);
});

test("root manifest pins the generator browser harness", async () => {
  const manifest = await readJson("package.json");
  assert.equal(manifest.engines.node, ">=18");
  assert.match(manifest.devDependencies["@playwright/test"], /^\d+\.\d+\.\d+$/);
  assert.equal(manifest.scripts["test:generator:install"], "playwright install chromium");
  assert.ok(manifest.scripts["test:generator"]);
  assert.ok(manifest.scripts["test:generator:soak"]);
});

test("uniform typography grouping remains footprint-specific", () => {
  const verticalScope = GRID_BLOCK_POLICY_BY_FOOTPRINT.get("1x3").sizeSyncScope;
  const horizontalScope = GRID_BLOCK_POLICY_BY_FOOTPRINT.get("3x1").sizeSyncScope;
  assert.notEqual(verticalScope, horizontalScope);
  assert.equal(uniformTypographyGroupKey(verticalScope, "xxlarge"), "footprint:1x3:xxlarge");
  assert.equal(uniformTypographyGroupKey(horizontalScope, "xxlarge"), "footprint:3x1:xxlarge");
});

test("ordered block policies remain the seed-sensitive source of truth", () => {
  const expectedOrder = ["1x1", "2x2", "1x2", "1x3", "2x3", "2x1", "3x1", "3x2"];
  assert.deepEqual(GRID_BLOCK_POLICIES.map(policy => policy.footprint), expectedOrder);
  assert.deepEqual(
    GRID_BLOCK_FOOTPRINTS.map(({ width, height }) => `${width}x${height}`),
    expectedOrder
  );
  const verticalPolicy = GRID_BLOCK_POLICY_BY_FOOTPRINT.get("1x3");
  assert.equal(verticalPolicy.rotation, 90);
  assert.deepEqual(orientationModesForTypography(verticalPolicy, "채우기"), ["glyph-sideways-stack"]);
  assert.deepEqual(orientationModesForTypography(verticalPolicy, "升级"), ["glyph-sideways-stack"]);
  assert.deepEqual(orientationModesForTypography(verticalPolicy, "UPDATE"), ["whole-rotate"]);
  assert.ok(!verticalPolicy.cjkOrientationModes.includes("whole-rotate"));
  assert.equal(GRID_BLOCK_POLICY_BY_FOOTPRINT.get("3x1").sizeSyncScope, "footprint:3x1");
});

test("random source reset reproduces values and draw state", () => {
  const source = createRandomSource(0x12345678);
  const first = [source.random(), source.random(), source.random()];
  const firstSnapshot = source.snapshot();
  source.reset(0x12345678);
  assert.deepEqual([source.random(), source.random(), source.random()], first);
  assert.deepEqual(source.snapshot(), firstSnapshot);
});

test("grid packing covers every cell without overlap across 1,000 seeds", () => {
  for (let seed = 0; seed < 1000; seed += 1) {
    const targetCount = 2 + seed % 4;
    const blocks = buildGridBlockLayout(targetCount, GRID_BLOCK_FOOTPRINTS, createRandomSource(seed));
    assert.equal(blocks.length, targetCount, `seed ${seed} block count`);
    const cells = blocks.flatMap(gridBlockCells);
    assert.equal(cells.length, 9, `seed ${seed} coverage`);
    assert.equal(new Set(cells).size, 9, `seed ${seed} overlap`);
    assert.ok(cells.every(cell => cell >= 1 && cell <= 9), `seed ${seed} bounds`);
  }
});

test("each block policy owns its deterministic cell-index fallback", () => {
  const randomSource = createRandomSource(123);
  const engine = createGridSelectionEngine({
    randomSource,
    typographyMeasurer: createTypographyMeasurer(null)
  });
  const availableBox = { x: 0, y: 0, width: 300, height: 500 };
  const before = randomSource.snapshot();

  for (const policy of GRID_BLOCK_POLICIES) {
    const block = { width: policy.width, height: policy.height, cells: [1] };
    const position = {
      x: 150,
      y: 250,
      align: policy.align === "center" ? "center" : "left",
      verticalAlign: policy.verticalAlign === "middle" ? "middle" : "top",
      rotation: policy.rotation
    };
    const plan = engine.createFallbackTokenPlan(block, position, availableBox);

    assert.equal(plan.tokenPlan.value, "1", policy.footprint);
    assert.equal(plan.tokenPlan.role, "cell-index", policy.footprint);
    assert.equal(plan.requestedSize, policy.requestedSizes?.[0] || "small", policy.footprint);
    assert.ok(DESIGN_TOKEN_SIZE_ORDER.includes(plan.actualSize), policy.footprint);
    assert.equal(plan.orientationMode, policy.rotation ? "whole-rotate" : "none", policy.footprint);
    assert.equal(plan.forceHeavyXlarge, policy.xlargeWeight === 900, policy.footprint);
    assert.equal(plan.resolvedTypographyStyle.orientationMode, plan.orientationMode, policy.footprint);
    assert.equal(plan.resolvedTypographyStyle.rotation, policy.rotation, policy.footprint);
  }

  assert.deepEqual(randomSource.snapshot(), before);
});

test("token model owns taxonomy, weight, fallback, and duplicate keys", () => {
  const token = typographyToken(" Update ", {
    typeface: "english",
    size: "xlarge",
    function: "content",
    role: "action-keyword"
  });
  assert.equal(token.weight, "bold");
  assert.equal(token.intrinsic.fontSize, 64);
  assert.equal(fontWeightValueForToken("xlarge", "content"), 700);
  assert.deepEqual(typographySizeFallbacks("large"), ["large", "medium", "small"]);
  assert.equal(typographyWordKey(token), "UPDATE");
  assert.deepEqual(tokenTaxonomyAttrs({
    form: "typography",
    tokenFunction: "content",
    role: "action-keyword",
    typeface: "english"
  }), {
    "data-token-form": "typography",
    "data-token-function": "content",
    "data-token-role": "action-keyword",
    "data-token-context": "component",
    "data-token-typeface": "english"
  });
  assert.throws(() => tokenTaxonomyAttrs({
    form: "typography",
    tokenFunction: "content",
    role: "broken"
  }), /known typeface/);
});

test("UPC primitive keeps checksum and 95-module pattern", () => {
  const result = upcPattern("03600029145");
  assert.equal(result.value, "036000291452");
  assert.equal(result.pattern.length, 95);
  assert.ok(/^[01]+$/.test(result.pattern));
});

test("pure core modules do not reference browser globals", async () => {
  for (const path of ["src/random.js", "src/layout.js", "src/grid-layout.js", "src/token-model.js"]) {
    const source = await readFile(new URL(`web/micro-graphic-generator/${path}`, repoRoot), "utf8");
    assert.doesNotMatch(source, /\b(?:document|window)\b/, path);
  }
});

test("validation module is read-only and random-free", async () => {
  const source = await readFile(
    new URL("web/micro-graphic-generator/src/validation.js", repoRoot),
    "utf8"
  );
  assert.doesNotMatch(source, /\.setAttribute\s*\(/);
  assert.doesNotMatch(source, /\bconsole\s*\./);
  assert.doesNotMatch(source, /\b(?:random|chance|pick|shuffled)\s*\(/);
});

test("module boundaries remain acyclic and single-owner", async () => {
  const generatorRoot = new URL("web/micro-graphic-generator/", repoRoot);
  const srcRoot = new URL("src/", generatorRoot);
  const indexSource = await readFile(new URL("index.html", generatorRoot), "utf8");
  const sourceNames = (await readdir(srcRoot)).filter(name => name.endsWith(".js"));
  const sources = new Map(await Promise.all(sourceNames.map(async name => [
    name,
    await readFile(new URL(name, srcRoot), "utf8")
  ])));

  assert.match(indexSource, /<script type="module" src="\.\/src\/app\.js"><\/script>/);
  assert.doesNotMatch(indexSource, /<script type="module">/);
  assert.doesNotMatch(sources.get("app.js"), /\bcontentPanel\b|\bcontentZones\b/);
  assert.doesNotMatch(sources.get("grid-finalizer.js"), /token-model|vocabulary|randomSource|visualTokens/);
  assert.match(sources.get("grid-selection.js"), /GRID_BLOCK_POLICY_BY_FOOTPRINT/);
  assert.match(sources.get("grid-finalizer.js"), /GRID_BLOCK_POLICY_BY_FOOTPRINT/);
  assert.doesNotMatch(sources.get("grid-finalizer.js"), /UNIFORM_TYPOGRAPHY_SIZE_FOOTPRINTS/);
  assert.doesNotMatch(sources.get("grid-renderer.js"), /getBBox|document\.|window\./);
  assert.doesNotMatch(sources.get("export.js"), /randomSource|\.random\s*\(/);

  const validationWriters = [...sources.entries()].filter(([, source]) =>
    source.includes('setAttribute("data-rule-violations"')
  );
  assert.deepEqual(validationWriters.map(([name]) => name), ["app.js"]);

  const dependencyGraph = new Map(sourceNames.map(name => {
    const dependencies = [...sources.get(name).matchAll(/from "\.\/(.+?\.js)"/g)]
      .map(match => match[1])
      .filter(dependency => sources.has(dependency));
    return [name, dependencies];
  }));
  const visiting = new Set();
  const visited = new Set();
  function visit(name, trail = []) {
    assert.ok(!visiting.has(name), `module cycle: ${[...trail, name].join(" -> ")}`);
    if (visited.has(name)) return;
    visiting.add(name);
    dependencyGraph.get(name).forEach(dependency => visit(dependency, [...trail, name]));
    visiting.delete(name);
    visited.add(name);
  }
  sourceNames.forEach(name => visit(name));
});

test("baseline fixtures use the current schema and fixed viewport", async () => {
  const baseline = await readJson("web/micro-graphic-generator/tests/fixtures/baseline.json");
  const exportBaseline = await readJson("web/micro-graphic-generator/tests/fixtures/export-baseline.json");
  const primitiveBaseline = await readJson("web/micro-graphic-generator/tests/fixtures/primitive-baseline.json");
  assert.equal(baseline.schemaVersion, 1);
  assert.ok(baseline.fixtures.length >= 5);
  assert.ok(baseline.fixtures.every(fixture => fixture.schemaVersion === 1));
  assert.deepEqual(exportBaseline.viewport, { width: 1440, height: 900 });
  assert.equal(Object.keys(exportBaseline.states).length, 4);
  assert.equal(Object.keys(primitiveBaseline.primitives).length, 5);
});
