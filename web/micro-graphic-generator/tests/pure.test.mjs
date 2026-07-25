import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  canonicalJson,
  hashCanonical,
  sha256Hex,
  utf8Bytes
} from "../src/canonical-hash.js";
import {
  createLexicalUseToTranslationSetIndex,
  deepFreeze,
  validateAttemptResult,
  validateFinalizationReport,
  validateLexicalUse,
  validateRecipeRegistry,
  validateTerminalGenerationResult,
  validateVocabularyRegistry
} from "../src/composition-model.js";
import {
  createKnownGoodRegistry,
  instantiateKnownGoodPlanMap,
  knownGoodTemplates,
  validateKnownGoodTemplateShape
} from "../src/composition-known-good.js";
import {
  COMPOSITION_ENGINE_VERSION,
  OWNER_SNAPSHOT_MANIFEST,
  OWNER_SNAPSHOT_REVISION
} from "../src/composition-owner-snapshot.js";
import {
  COMPOSITION_POLICY_VERSION,
  DESIGN_TOKEN_SIZE_ORDER,
  GRID_BLOCK_FOOTPRINTS,
  GRID_BLOCK_POLICIES,
  GRID_BLOCK_POLICY_BY_FOOTPRINT,
  MAX_CANONICAL_PREFIX_VISITS_PER_RECIPE,
  MAX_LAYOUT_DECISION_EXPANSIONS_PER_RECIPE,
  MAX_RANKED_PLANS_PER_RECIPE,
  MAX_RETAINED_VIABLE_DECISIONS_PER_TUPLE,
  deriveTypographyTokenVariant
} from "../src/config.js";
import {
  activeRecipeIds,
  compositionRecipes,
  pilotCandidateTranslationSetGroups,
  relationEdges,
  reviewedCommandTargetRelations
} from "../src/composition-recipes.js";
import {
  deriveCanonicalCardinalityShapes,
  deriveCanonicalSearchQueue,
  deriveCanonicalSlotDomains,
  deriveRankedPlanUniverse,
  enumerateCanonicalSemanticTuples,
  planningCountersForUniverse,
  validateCompositionPlan,
  validatePlannerResult,
  validateTupleCompatibility
} from "../src/composition-plan-validator.js";
import { planComposition } from "../src/composition-planner.js";
import { deriveMountedOccupancy } from "../src/grid-finalizer.js";
import { upcPattern } from "../src/graphics.js";
import {
  buildGridBlockLayout,
  enumerateCanonicalLayouts,
  gridBlockCells,
  uniformTypographyGroupKey
} from "../src/grid-layout.js";
import { paddedBox } from "../src/layout.js";
import {
  materializeMotifCandidates,
  motifCalibration,
  motifRegistry,
  validateMotifRenderParams
} from "../src/motifs.js";
import { projectCompositionPlan } from "../src/grid-selection.js";
import {
  createRandomSource,
  deriveSeed,
  keyedValue
} from "../src/random.js";
import {
  fontWeightValueForToken,
  tokenTaxonomyAttrs,
  typographySizeFallbacks,
  typographyToken,
  typographyWordKey
} from "../src/token-model.js";
import { orientationModesForTypography } from "../src/typography.js";
import {
  FONT_METRICS_VERSION,
  measureTypography
} from "../src/typography-metrics.js";
import {
  VOCABULARY_VERSION,
  actionCommandTranslationSetIds,
  actionModifierTranslationSetIds,
  actionTranslationAudit,
  compositionExamples,
  lexicalFamilies,
  lexicalUses,
  translationErrorLedger,
  translationSets,
  visibleTokenInventory
} from "../src/vocabulary.js";
import {
  RUNTIME_CONFORMANCE,
  assertRuntimeConformance
} from "./runtime-conformance.mjs";
import { createCompositionTestContext } from "./composition-test-context.mjs";
import {
  buildOwnerSnapshotManifest,
  deriveRuntimeResourceClosure,
  deriveToolingSourceHashes,
  deriveToolingTrustClosureHashes,
  renderOwnerSnapshotModule
} from "../scripts/composition-owner-manifest-lib.mjs";
import {
  runVerificationStages,
  verifyLedgerTransition,
  verifyOwnerVersionTransition
} from "../scripts/bootstrap-verify-composition-owner-snapshot.mjs";
import { buildCompositionPlanBaseline } from "../scripts/composition-plan-baseline-lib.mjs";
import {
  buildActivePlanningRelease,
  DEFAULT_PLANNING_OWNER_RECORDS
} from "../scripts/planning-release-snapshot-lib.mjs";
import {
  assignCounterbalancedSides,
  blindPresentationRunSummary,
  interleaveBlindPresentation,
  selectCompleteBlindCorpus
} from "../scripts/blind-evaluation-corpus-lib.mjs";
import {
  emptyBlindReviewCollection,
  rebaseEmptyBlindReviewCollection
} from "../scripts/blind-review-collection-transition.mjs";
import {
  EVALUATION_SCHEMA_VERSION,
  blindCorpusPairIdentityRoot,
  blindNodeFingerprint,
  blindPairIdentityRevision,
  buildBlindEvaluationReport,
  summarizeEditorialConcentration,
  summarizeMountedOutcomes,
  validateBlindCorpus,
  validateBlindDisplayManifest,
  validateBlindReviewCollection,
  validateBlindReviewResult,
  validateConcentrationReviewEvidence,
  validateReviewerQualificationSet
} from "../scripts/evaluation-model.mjs";
import {
  buildEvaluationToolingEvidence,
  deriveEvaluationToolingClosure
} from "../scripts/evaluation-tooling-evidence.mjs";
import {
  validateOwnerSnapshotLedger
} from "../scripts/verify-composition-owner-snapshot.mjs";
import {
  acquireReviewIngestionLock,
  ingestBlindReviewResult
} from "../scripts/record-blind-review-result.mjs";
import {
  closedFormCartesianCounters,
  derivePlanningCertificatePayloads,
  evaluateActivePlanningSnapshot,
  runProductionPlanningObserver,
  verifyPlanningComplexityCertificate,
  verifyPlanningFixture,
  verifyPlanningFixtureIndependent,
  walkSyntheticCartesianCounters
} from "../scripts/verify-planning-complexity.mjs";

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
  const nodeVersion = (await readFile(new URL(".node-version", repoRoot), "utf8")).trim();
  const workflow = await readFile(
    new URL(".github/workflows/micro-graphic-generator.yml", repoRoot),
    "utf8"
  );
  assert.equal(manifest.engines.node, "22.12.0");
  assert.equal(nodeVersion, "22.12.0");
  assert.equal(manifest.devDependencies["@playwright/test"], "1.61.1");
  const trustStep = workflow.indexOf("name: Verify composition owner trust root");
  const dependencyInstall = workflow.indexOf("run: npm ci");
  assert.ok(trustStep >= 0 && dependencyInstall > trustStep);
  assert.doesNotMatch(workflow.slice(0, trustStep), /\brun:\s+(?:npm|node)\b/);
  assert.match(workflow, /actions\/setup-node@v6/);
  assert.match(workflow, /node-version-file: \.node-version/);
  assert.equal(manifest.scripts["test:generator:install"], "playwright install chromium");
  assert.ok(manifest.scripts["test:generator"]);
  assert.ok(manifest.scripts["test:generator:soak"]);
  assert.ok(manifest.scripts["test:generator:expressive"]);
  assert.ok(manifest.scripts["test:generator:blind"]);
});

test("workflow-style trust bootstrap extraction includes its executable closure", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "owner-workflow-bootstrap-"));
  const candidateRoot = fileURLToPath(repoRoot);
  const paths = [
    "web/micro-graphic-generator/scripts/bootstrap-verify-composition-owner-snapshot.mjs",
    "web/micro-graphic-generator/scripts/static-module-specifiers.mjs"
  ];
  try {
    for (const path of paths) {
      const target = join(temporaryRoot, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, await readFile(new URL(path, repoRoot)));
    }
    const result = spawnSync(process.execPath, [
      join(temporaryRoot, paths[0]),
      "--repo-root",
      candidateRoot,
      "--candidate-root",
      candidateRoot,
      "--base-ref",
      "HEAD"
    ], { cwd: temporaryRoot, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /composition owner bootstrap verified \(base-ref\)/);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("runtime conformance fails before fixtures on every version mismatch", () => {
  assert.deepEqual(assertRuntimeConformance(), RUNTIME_CONFORMANCE);
  assert.throws(
    () => assertRuntimeConformance({ processVersion: "v22.11.0" }),
    /Node runtime mismatch/
  );
  assert.throws(
    () => assertRuntimeConformance({ nodeVersion: "22.11.0" }),
    /\.node-version mismatch/
  );
  assert.throws(
    () => assertRuntimeConformance({ playwrightVersion: "1.60.0" }),
    /Playwright package mismatch/
  );
  assert.throws(
    () => assertRuntimeConformance({ playwrightProject: "chromium" }),
    /Playwright project mismatch/
  );
});

test("canonical hash vectors match fixture and independent Node crypto", async () => {
  const fixture = await readJson(
    "web/micro-graphic-generator/tests/fixtures/canonical-hash-vectors.json"
  );
  assert.equal(fixture.schemaVersion, 1);
  for (const vector of fixture.vectors) {
    const canonical = canonicalJson(vector.input);
    const bytes = utf8Bytes(canonical);
    const byteHex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
    assert.equal(canonical, vector.canonical, vector.id);
    assert.equal(byteHex, vector.utf8Hex, vector.id);
    assert.equal(sha256Hex(bytes), vector.sha256, vector.id);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), vector.sha256, vector.id);
    assert.equal(hashCanonical(vector.input), `sha256:${vector.sha256}`, vector.id);
  }
  assert.equal(canonicalJson(-0), "0");
});

test("canonical hash rejects values outside the composition identity domain", () => {
  const sparse = [];
  sparse.length = 1;
  const cycle = {};
  cycle.self = cycle;
  const accessor = {};
  Object.defineProperty(accessor, "value", { enumerable: true, get: () => 1 });
  const custom = Object.create({ inherited: true });
  custom.value = 1;
  const withToJson = { value: 1, toJSON() { return 1; } };
  const forbidden = [
    undefined,
    1n,
    Symbol("x"),
    () => {},
    Number.NaN,
    Infinity,
    sparse,
    cycle,
    accessor,
    custom,
    withToJson,
    new Date(0),
    new Map(),
    new Set(),
    new Uint8Array()
  ];
  forbidden.forEach(value => assert.throws(() => canonicalJson(value)));
  assert.throws(() => canonicalJson("\ud800"), /unpaired surrogate/);
  assert.throws(() => canonicalJson({ "\udc00": true }), /unpaired surrogate/);
});

test("vocabulary registry matches its reviewed inventory fixture", async () => {
  const fixture = await readJson(
    "web/micro-graphic-generator/tests/fixtures/composition-vocabulary.json"
  );
  const registry = validateVocabularyRegistry({
    lexicalUses,
    translationSets,
    translationErrorLedger
  });
  const counts = {
    lexicalUses: lexicalUses.length,
    translationSets: translationSets.length,
    actionAudits: actionTranslationAudit.length,
    translationLedger: translationErrorLedger.length,
    goodExamples: compositionExamples.filter(example => example.verdict === "good").length,
    badExamples: compositionExamples.filter(example => example.verdict === "bad").length,
    lexicalFamilies: lexicalFamilies.length,
    visibleTokenInventory: visibleTokenInventory.length
  };
  const digest = hashCanonical({
    vocabularyVersion: VOCABULARY_VERSION,
    lexicalUses,
    translationSets,
    translationErrorLedger,
    lexicalFamilies,
    compositionExamples
  });
  assert.equal(VOCABULARY_VERSION, fixture.vocabularyVersion);
  assert.deepEqual(counts, fixture.counts);
  assert.equal(digest, fixture.registryDigest);
  fixture.requiredUseIds.forEach(id => assert.ok(registry.lexicalUseById.has(id), id));
  assert.equal(actionTranslationAudit.length, 62);
  assert.ok(actionTranslationAudit.every(audit => audit.reviewStatus === "approved"));
  assert.equal(translationErrorLedger.filter(record => record.status === "open").length, 0);
});

test("translation membership and lexical review boundaries fail closed", () => {
  assert.throws(() => createLexicalUseToTranslationSetIndex([
    { id: "one", members: [{ lexicalUseId: "shared.use" }] },
    { id: "two", members: [{ lexicalUseId: "shared.use" }] }
  ]), /multiple translation sets/);

  const approved = lexicalUses.find(use => use.id === "upgrade.command.en");
  assert.throws(
    () => validateLexicalUse({ ...approved, reviewStatus: "pending" }),
    /unsupported value pending/
  );
  assert.throws(
    () => validateLexicalUse({ ...approved, marker: "mention" }),
    /mention must use @/
  );
  assert.equal(
    lexicalUses.find(use => use.id === "quick.modifier.en").tags.includes("action"),
    false
  );
});

test("HTTP status and generic codes remain separate lexical families", () => {
  const httpFamily = lexicalFamilies.find(family => family.id === "family.http-status");
  const genericFamily = lexicalFamilies.find(family => family.id === "family.generic-code");
  assert.ok(httpFamily);
  assert.ok(genericFamily);
  assert.ok(httpFamily.lexicalUseIds.every(id => id.startsWith("http-status.reference.")));
  assert.ok(genericFamily.lexicalUseIds.every(id => id.startsWith("generic-code.reference.")));
  assert.equal(
    new Set([...httpFamily.lexicalUseIds, ...genericFamily.lexicalUseIds]).size,
    httpFamily.lexicalUseIds.length + genericFamily.lexicalUseIds.length
  );
});

test("owner snapshot bootstrap enforces append-only tooling upgrades", () => {
  const ownerRevision = `sha256:${"0".repeat(64)}`;
  const baseHashes = [{ path: "tool-a.mjs", sha256Hex: "1".repeat(64) }];
  const upgradedHashes = [{ path: "tool-a.mjs", sha256Hex: "2".repeat(64) }];
  const baseRow = {
    schemaVersion: 1,
    versionTuple: {
      vocabularyVersion: 1,
      recipeVersion: 1,
      motifVersion: 1,
      configVersion: 1,
      compositionEngineVersion: 1,
      fontMetricsVersion: 1,
      fontAssetRevision: `sha256:${"3".repeat(64)}`
    },
    ownerSnapshotRevision: ownerRevision,
    toolingSourceHashes: baseHashes,
    toolingUpgrade: null
  };
  const upgradedRow = {
    ...baseRow,
    versionTuple: { ...baseRow.versionTuple, compositionEngineVersion: 2 },
    ownerSnapshotRevision: `sha256:${"4".repeat(64)}`,
    toolingSourceHashes: upgradedHashes,
    toolingUpgrade: {
      fromCompositionEngineVersion: 1,
      toCompositionEngineVersion: 2,
      reason: "Reviewed verifier upgrade."
    }
  };
  const baseLedger = { schemaVersion: 1, rows: [baseRow] };
  const unchangedLedger = { schemaVersion: 1, rows: [baseRow] };
  const upgradedLedger = { schemaVersion: 1, rows: [baseRow, upgradedRow] };

  assert.doesNotThrow(() => verifyLedgerTransition({
    baseLedger,
    candidateLedger: unchangedLedger,
    candidateHashes: baseHashes
  }));
  assert.doesNotThrow(() => verifyLedgerTransition({
    baseLedger,
    candidateLedger: upgradedLedger,
    candidateHashes: upgradedHashes
  }));
  assert.doesNotThrow(() => verifyLedgerTransition({
    baseLedger: upgradedLedger,
    candidateLedger: upgradedLedger,
    candidateHashes: upgradedHashes
  }));
  assert.throws(() => verifyLedgerTransition({
    baseLedger,
    candidateLedger: unchangedLedger,
    candidateHashes: upgradedHashes
  }), /hash mismatch/);
  assert.throws(() => verifyLedgerTransition({
    baseLedger,
    candidateLedger: {
      schemaVersion: 1,
      rows: [{ ...baseRow, ownerSnapshotRevision: `sha256:${"9".repeat(64)}` }]
    },
    candidateHashes: baseHashes
  }), /rewrote base row/);
});

test("owner bootstrap executes candidate code only after base authority succeeds", () => {
  const rejectedStages = [];
  assert.throws(() => runVerificationStages({
    hasBaseRef: true,
    allowGenesis: false,
    verifyBase: () => {
      rejectedStages.push("base");
      throw new Error("poison base rejection");
    },
    verifyTrustedProduction: () => rejectedStages.push("trusted-production"),
    verifyCandidate: () => rejectedStages.push("candidate")
  }), /poison base rejection/);
  assert.deepEqual(rejectedStages, ["base"]);

  const rejectedOwnerStages = [];
  assert.throws(() => runVerificationStages({
    hasBaseRef: true,
    allowGenesis: false,
    verifyBase: () => rejectedOwnerStages.push("base"),
    verifyTrustedProduction: () => {
      rejectedOwnerStages.push("trusted-production");
      throw new Error("poison owner-domain rejection");
    },
    verifyCandidate: () => rejectedOwnerStages.push("candidate")
  }), /poison owner-domain rejection/);
  assert.deepEqual(rejectedOwnerStages, ["base", "trusted-production"]);

  const acceptedStages = [];
  assert.deepEqual(runVerificationStages({
    hasBaseRef: true,
    allowGenesis: false,
    verifyBase: () => acceptedStages.push("base"),
    verifyTrustedProduction: () => acceptedStages.push("trusted-production"),
    verifyCandidate: () => acceptedStages.push("candidate")
  }), ["base-authority", "trusted-production-activation", "candidate-activation"]);
  assert.deepEqual(acceptedStages, ["base", "trusted-production", "candidate"]);
});

test("owner bootstrap requires the corresponding owner version to increase", () => {
  const manifest = (vocabularyVersion, recipeVersion, vocabularyRevision, recipeRevision) => ({
    schemaVersion: 1,
    versionTuple: { vocabularyVersion, recipeVersion },
    entries: [
      {
        ownerId: "recipes",
        versionField: "recipeVersion",
        versionValue: recipeVersion,
        contentRevision: recipeRevision
      },
      {
        ownerId: "vocabulary",
        versionField: "vocabularyVersion",
        versionValue: vocabularyVersion,
        contentRevision: vocabularyRevision
      }
    ]
  });
  const base = manifest(1, 1, "vocabulary-a", "recipes-a");
  assert.throws(() => verifyOwnerVersionTransition({
    baseManifest: base,
    candidateManifest: manifest(1, 2, "vocabulary-b", "recipes-b")
  }), /vocabulary changed content without changing vocabularyVersion/);
  assert.deepEqual(verifyOwnerVersionTransition({
    baseManifest: base,
    candidateManifest: manifest(2, 1, "vocabulary-b", "recipes-a")
  }).changedOwnerIds, ["vocabulary"]);
  assert.throws(() => verifyOwnerVersionTransition({
    baseManifest: base,
    candidateManifest: manifest(0, 1, "vocabulary-b", "recipes-a")
  }), /did not increase vocabularyVersion/);
});

test("owner ledger rejects version tuple reuse and unordered tooling closure", () => {
  const fixtureRow = {
    schemaVersion: 1,
    versionTuple: {
      vocabularyVersion: 1,
      recipeVersion: 1,
      motifVersion: 1,
      configVersion: 1,
      compositionEngineVersion: 1,
      fontMetricsVersion: 1,
      fontAssetRevision: `sha256:${"1".repeat(64)}`
    },
    ownerSnapshotRevision: `sha256:${"2".repeat(64)}`,
    toolingSourceHashes: [
      { path: "a.mjs", sha256Hex: "3".repeat(64) },
      { path: "b.mjs", sha256Hex: "4".repeat(64) }
    ],
    toolingUpgrade: null
  };
  assert.equal(
    validateOwnerSnapshotLedger({ schemaVersion: 1, rows: [fixtureRow] }).rowCount,
    1
  );
  assert.throws(() => validateOwnerSnapshotLedger({
    schemaVersion: 1,
    rows: [fixtureRow, { ...fixtureRow }]
  }), /reuses a full version tuple|must increase/);
  assert.throws(() => validateOwnerSnapshotLedger({
    schemaVersion: 1,
    rows: [{
      ...fixtureRow,
      toolingSourceHashes: [...fixtureRow.toolingSourceHashes].reverse()
    }]
  }), /ascending paths/);
});

test("runtime owner closure follows local HTML/CSS/modules and rejects network escape paths", async t => {
  const root = await mkdtemp(join(tmpdir(), "composition-runtime-closure-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, "web/micro-graphic-generator");
  await mkdir(directory, { recursive: true });
  const paths = Object.fromEntries([
    "index.html", "main.js", "dep.js", "styles.css", "nested.css", "asset.png"
  ].map(name => [name, join(directory, name)]));
  const validHtml = [
    '<link rel="stylesheet" href="./styles.css">',
    '<link rel="stylesheet" href="./nested.css">',
    '<img src="./asset.png">',
    '<script type="module" src="./main.js"></script>'
  ].join("\n");
  await Promise.all([
    writeFile(paths["index.html"], validHtml),
    writeFile(paths["main.js"], 'import/*comment*/"./dep.js";\n'),
    writeFile(paths["dep.js"], "export const ready = true;\n"),
    writeFile(paths["styles.css"], '.x{background:url("./asset.png")}\n'),
    writeFile(paths["nested.css"], ".x{color:black}\n"),
    writeFile(paths["asset.png"], new Uint8Array([1, 2, 3]))
  ]);
  const closure = deriveRuntimeResourceClosure(root);
  assert.deepEqual(closure.moduleFiles, [
    "web/micro-graphic-generator/dep.js",
    "web/micro-graphic-generator/main.js"
  ]);
  assert.deepEqual(closure.styleFiles, [
    "web/micro-graphic-generator/nested.css",
    "web/micro-graphic-generator/styles.css"
  ]);
  assert.deepEqual(closure.assetFiles, ["web/micro-graphic-generator/asset.png"]);

  await writeFile(paths["main.js"], 'import/*comment*/("./dep.js");\n');
  assert.throws(() => deriveRuntimeResourceClosure(root), /dynamic import is forbidden/);
  await writeFile(paths["main.js"], 'import "https://example.invalid/runtime.js";\n');
  assert.throws(() => deriveRuntimeResourceClosure(root), /non-local runtime import/);
  await writeFile(paths["main.js"], 'import "unreviewed-package";\n');
  assert.throws(() => deriveRuntimeResourceClosure(root), /non-local runtime import/);
  await writeFile(paths["main.js"], 'import "./dep.js";\n');
  await writeFile(paths["styles.css"], '@import "https://example.invalid/runtime.css";\n');
  assert.throws(() => deriveRuntimeResourceClosure(root), /CSS imports are forbidden/);
  await writeFile(paths["styles.css"], '.x{background:u\\72l("https://example.invalid/a.png")}\n');
  assert.throws(() => deriveRuntimeResourceClosure(root), /CSS escapes are forbidden/);
  await writeFile(paths["styles.css"], '.x{background:url("./asset.png")}\n');
  await writeFile(paths["index.html"], validHtml.replace("./asset.png", "https://example.invalid/a.png"));
  assert.throws(() => deriveRuntimeResourceClosure(root), /network HTML resource is forbidden/);
  await writeFile(paths["index.html"], validHtml.replace('src="./asset.png"', "src=https://example.invalid/a.png"));
  assert.throws(() => deriveRuntimeResourceClosure(root), /network HTML resource is forbidden/);
  await writeFile(paths["index.html"], `${validHtml}\n<style>@import url("https://example.invalid/a.css")</style>`);
  assert.throws(() => deriveRuntimeResourceClosure(root), /inline style elements are forbidden/);
  await writeFile(paths["index.html"], `${validHtml}\n<script>window.bad = true</script>`);
  assert.throws(() => deriveRuntimeResourceClosure(root), /inline runtime scripts are forbidden/);
});

test("generated owner manifest exactly partitions the active source and data closure", async () => {
  const fixture = await readJson(
    "web/micro-graphic-generator/tests/fixtures/planning-complexity.json"
  );
  const planningComplexity = evaluateActivePlanningSnapshot(fixture.activeSnapshot);
  const manifest = buildOwnerSnapshotManifest({
    repoRoot: fileURLToPath(repoRoot),
    compositionEngineVersion: COMPOSITION_ENGINE_VERSION,
    planningComplexity
  });
  assert.deepEqual(manifest, OWNER_SNAPSHOT_MANIFEST);
  assert.equal(manifest.ownerSnapshotRevision, OWNER_SNAPSHOT_REVISION);
  assert.deepEqual(
    manifest.entries.map(entry => entry.ownerId),
    [...manifest.entries.map(entry => entry.ownerId)].sort()
  );
  assert.equal(manifest.entries.length, 13);
  const paths = manifest.entries.flatMap(entry => [
    ...entry.sourceFiles,
    ...entry.dataFiles,
    ...entry.assetFiles
  ]);
  assert.equal(new Set(paths).size, paths.length);
  assert.ok(paths.includes("web/micro-graphic-generator/src/composition-known-good.js"));
  assert.ok(paths.includes("web/micro-graphic-generator/src/export.js"));
  assert.ok(!paths.includes("web/micro-graphic-generator/scripts/evaluation-model.mjs"));
  assert.ok(!paths.includes("web/micro-graphic-generator/tests/blind-review/review.js"));
  const generatedSource = await readFile(
    new URL("web/micro-graphic-generator/src/composition-owner-snapshot.js", repoRoot),
    "utf8"
  );
  assert.equal(generatedSource, renderOwnerSnapshotModule(manifest));
  const toolingHashes = deriveToolingSourceHashes(fileURLToPath(repoRoot));
  assert.ok(toolingHashes.length >= 5);
  assert.ok(toolingHashes.every(entry => entry.path.startsWith("web/micro-graphic-generator/scripts/")));
  assert.ok(toolingHashes.some(entry => entry.path.endsWith("observe-planning-production.mjs")));
  assert.ok(toolingHashes.some(entry => entry.path.endsWith("planning-release-snapshot-lib.mjs")));
  assert.deepEqual(
    toolingHashes.map(entry => entry.path),
    [...toolingHashes.map(entry => entry.path)].sort()
  );
  const trustClosureHashes = deriveToolingTrustClosureHashes(fileURLToPath(repoRoot));
  assert.deepEqual(trustClosureHashes, toolingHashes);
  assert.ok(trustClosureHashes.every(entry =>
    entry.path.startsWith("web/micro-graphic-generator/scripts/")
  ));
  assert.ok(!trustClosureHashes.some(entry => entry.path.includes("/src/")));
});

test("independent planning oracle fixes all four counter positions", async () => {
  const fixture = await readJson(
    "web/micro-graphic-generator/tests/fixtures/planning-complexity.json"
  );
  const fixturePath = fileURLToPath(new URL(
    "web/micro-graphic-generator/tests/fixtures/planning-complexity.json",
    repoRoot
  ));
  const result = verifyPlanningFixture(fixture, {
    productionObservation: runProductionPlanningObserver(fixturePath)
  });
  const independent = verifyPlanningFixtureIndependent(fixture);
  assert.equal(independent.productionParity, null);
  assert.deepEqual(independent.active.certificates, result.active.certificates);
  assert.throws(() => verifyPlanningFixture(fixture), /production planning observation is required/);
  assert.equal(result.results.length, 2);
  assert.deepEqual(
    result.productionParity.map(record => record.recipeId),
    ["command", "status"]
  );
  assert.equal(result.active.snapshotInputRevision, runProductionPlanningObserver(fixturePath).snapshotInputRevision);
  const tampered = structuredClone(fixture);
  tampered.activeSnapshot.candidates[0].visibleText += " TAMPERED";
  assert.throws(
    () => verifyPlanningFixture(tampered, {
      productionObservation: runProductionPlanningObserver(fixturePath)
    }),
    /certificate mismatch|snapshot revision mismatch/
  );
  const reducedOwnerRecords = structuredClone(DEFAULT_PLANNING_OWNER_RECORDS);
  reducedOwnerRecords.activeRecipeIds = ["command"];
  const reducedSnapshotInput = buildActivePlanningRelease(reducedOwnerRecords).snapshotInput;
  const reducedFixture = structuredClone(fixture);
  reducedFixture.activeSnapshot = {
    ...reducedSnapshotInput,
    expectedCertificates: derivePlanningCertificatePayloads(reducedSnapshotInput)
  };
  assert.equal(verifyPlanningFixtureIndependent(reducedFixture).active.observations.length, 1);
  const poisonRoot = await mkdtemp(join(tmpdir(), "planning-owner-poison-"));
  try {
    const poisonFixturePath = join(poisonRoot, "planning-complexity.json");
    await writeFile(poisonFixturePath, `${JSON.stringify(reducedFixture)}\n`);
    assert.throws(
      () => runProductionPlanningObserver(poisonFixturePath, {
        ownerRoot: fileURLToPath(repoRoot)
      }),
      /committed planning snapshot differs from active owner records/
    );
  } finally {
    await rm(poisonRoot, { recursive: true, force: true });
  }
  const subjectCoveragePoison = structuredClone(DEFAULT_PLANNING_OWNER_RECORDS);
  subjectCoveragePoison.relationEdges = subjectCoveragePoison.relationEdges.filter(edge => !(
    edge.from?.translationSetId === "access-denied.status"
    && edge.relation === "stateOf"
    && edge.to?.translationSetId === "network.topic"
  ));
  assert.throws(
    () => buildActivePlanningRelease(subjectCoveragePoison),
    /status representative does not maximize subject relations/
  );
  assert.deepEqual(closedFormCartesianCounters([2, 2, 2], 4), {
    canonicalPrefixVisits: 15,
    completeTuples: 8,
    layoutDecisionExpansions: 32,
    retainedViableDecisions: 4,
    rankedPlans: 32
  });
  assert.deepEqual(walkSyntheticCartesianCounters([2, 2, 2], 4), {
    canonicalPrefixVisits: 15,
    completeTuples: 8,
    layoutDecisionExpansions: 32,
    retainedViableDecisions: 4,
    rankedPlans: 32
  });
  assert.deepEqual(
    result.faultRejections,
    [
      "skip-prefix-increment",
      "omit-candidate-branch",
      "omit-layout-alternative",
      "omit-retained-peak"
    ].map(faultMode => ({ faultMode, rejected: true }))
  );
  const limits = {
    maxCanonicalPrefixVisits: 50_000,
    maxLayoutDecisionExpansions: 200_000,
    maxRetainedViableDecisions: 1_024,
    maxRankedPlans: 4_096
  };
  const certificate = {
    maxCanonicalPrefixVisits: 15,
    maxLayoutDecisionExpansions: 32,
    maxRetainedViableDecisionsPerTuple: 4,
    maxRankedPlans: 32,
    oracleRevision: result.fixtureRevision,
    fixtureRevision: result.fixtureRevision
  };
  assert.equal(verifyPlanningComplexityCertificate(certificate, limits), true);
  for (const field of [
    "maxCanonicalPrefixVisits",
    "maxLayoutDecisionExpansions",
    "maxRetainedViableDecisionsPerTuple",
    "maxRankedPlans"
  ]) {
    const limitField = field === "maxRetainedViableDecisionsPerTuple"
      ? "maxRetainedViableDecisions"
      : field;
    const limit = limits[limitField];
    assert.equal(verifyPlanningComplexityCertificate({
      ...certificate,
      [field]: limit - 1
    }, limits), true);
    assert.equal(verifyPlanningComplexityCertificate({
      ...certificate,
      [field]: limit
    }, limits), true);
    assert.throws(() => verifyPlanningComplexityCertificate({
      ...certificate,
      [field]: limit + 1
    }, limits), /exceeds/);
  }
});

test("editorial concentration compares heroes only within recipe and language strata", () => {
  const balanced = [
    ...Array.from({ length: 100 }, (_, index) => ({
      recipeId: "command",
      heroLanguage: "en",
      heroLexicalUseId: `command-${index}.command.en`
    })),
    ...Array.from({ length: 50 }, () => ({
      recipeId: "status",
      heroLanguage: "en",
      heroLexicalUseId: "running.status.en"
    })),
    ...Array.from({ length: 50 }, () => ({
      recipeId: "status",
      heroLanguage: "en",
      heroLexicalUseId: "locked.status.en"
    }))
  ];
  const summary = summarizeEditorialConcentration(balanced);
  assert.deepEqual(summary.strata.map(stratum => stratum.id), ["command/en", "status/en"]);
  assert.ok(summary.heroes.every(hero => hero.concentrationTriggered === false));
  assert.equal(summary.strata.find(stratum => stratum.id === "command/en").nonZeroMedianCount, 1);
  assert.equal(summary.strata.find(stratum => stratum.id === "status/en").nonZeroMedianCount, 50);

  const genuineSkew = summarizeEditorialConcentration([
    ...Array.from({ length: 3 }, () => ({
      recipeId: "command",
      heroLanguage: "ko",
      heroLexicalUseId: "upgrade.command.ko"
    })),
    { recipeId: "command", heroLanguage: "ko", heroLexicalUseId: "update.command.ko" },
    { recipeId: "command", heroLanguage: "ko", heroLexicalUseId: "scan.command.ko" }
  ]);
  assert.equal(
    genuineSkew.heroes.find(hero => hero.heroLexicalUseId === "upgrade.command.ko").concentrationTriggered,
    true
  );
});

test("concentration resolutions require qualified roles or a non-triggering versioned successor", () => {
  const versionTuple = {
    ...OWNER_SNAPSHOT_MANIFEST.versionTuple,
    ownerSnapshotRevision: OWNER_SNAPSHOT_REVISION
  };
  const baseReview = {
    schemaVersion: 1,
    id: "concentration:series-v1:hero",
    reportSeriesId: "series-v1",
    ...versionTuple,
    heroLexicalUseId: "upgrade.command.en",
    trigger: { observedRate: 0.5, nonZeroMedianRate: 0.1, multiple: 5 },
    status: "resolved",
    disposition: "approved-curation",
    reviewerIds: ["product-01", "typography-01"],
    evidence: "Intentional launch-command emphasis.",
    successorReportSeriesId: null
  };
  const directory = {
    schemaVersion: 1,
    directoryId: "curation-reviewers:test-v1",
    verifiedAt: "2026-07-14T00:00:00+09:00",
    reviewers: [
      { reviewerId: "product-01", role: "product", verifiedBy: "owner-01", verifiedAt: "2026-07-14T00:00:00+09:00" },
      { reviewerId: "typography-01", role: "typography", verifiedBy: "owner-01", verifiedAt: "2026-07-14T00:00:00+09:00" }
    ]
  };
  const emptySuccessors = {
    schemaVersion: 1,
    reportSetId: "successors:test-empty",
    reports: []
  };
  assert.equal(validateConcentrationReviewEvidence({
    review: baseReview,
    successorReportSet: emptySuccessors,
    curationReviewerDirectory: directory
  }), true);
  const wrongRoles = structuredClone(directory);
  wrongRoles.reviewers[1].role = "product";
  assert.throws(() => validateConcentrationReviewEvidence({
    review: baseReview,
    successorReportSet: emptySuccessors,
    curationReviewerDirectory: wrongRoles
  }), /product and typography roles/);

  const fixedReview = {
    ...baseReview,
    disposition: "vocabulary-fix",
    reviewerIds: [],
    evidence: "Vocabulary weighting corrected.",
    successorReportSeriesId: "series-v2"
  };
  const successorTooling = buildEvaluationToolingEvidence(
    fileURLToPath(repoRoot),
    "expressive-range-v2"
  );
  const successor = {
    schemaVersion: EVALUATION_SCHEMA_VERSION,
    reportSeriesId: "series-v2",
    inputFixtureSha256: hashCanonical({ inputs: "successor-v2" }),
    inputCount: 10_000,
    versionTuple: {
      ...versionTuple,
      vocabularyVersion: versionTuple.vocabularyVersion + 1,
      ownerSnapshotRevision: `sha256:${"f".repeat(64)}`
    },
    eventArtifact: {
      path: "web/micro-graphic-generator/tests/artifacts/expressive/successor-v2.jsonl",
      sha256: hashCanonical({ events: "successor-v2" }),
      recordCount: 30_000
    },
    evaluationTooling: successorTooling,
    curationReviewerDirectoryRevision: hashCanonical(directory),
    successorReportSetRevision: hashCanonical({ successors: "successor-v2" }),
    populationCounts: {
      "initial-selection": 10_000,
      attempt: 10_000,
      "accepted-output": 10_000,
      "terminal-failure": 0
    },
    implementationDistribution: {
      selectedInputCount: 10_000,
      noCandidateInputCount: 0,
      heroes: [],
      failures: []
    },
    mountedOutcomeDistribution: {
      attemptCount: 10_000,
      acceptedCount: 10_000,
      rejectedCount: 0,
      acceptanceRate: 1,
      rejectionRate: 0,
      inputCounts: {
        withMountedAttempt: 10_000,
        withMountedRejection: 0,
        withKnownGoodAttempt: 0
      },
      ranked: {
        attemptCount: 10_000,
        acceptedCount: 10_000,
        rejectedCount: 0,
        acceptanceRate: 1,
        rejectionRate: 0
      },
      knownGood: {
        attemptCount: 0,
        acceptedCount: 0,
        rejectedCount: 0,
        acceptanceRate: 0,
        rejectionRate: 0,
        fallbackTriggers: []
      },
      rejectionReasons: [],
      denominatorsPass: true
    },
    editorialConcentration: {
      acceptedOutputCount: 10_000,
      strata: [{
        id: "command/en",
        recipeId: "command",
        language: "en",
        acceptedOutputCount: 10_000,
        nonZeroMedianCount: 5_000,
        nonZeroMedianRate: 0.5,
        topShare: 0.5,
        hhi: 0.5
      }],
      heroes: [
        {
          stratumId: "command/en",
          heroLexicalUseId: fixedReview.heroLexicalUseId,
          observedCount: 5_000,
          observedRate: 0.5,
          medianMultiple: 1,
          concentrationTriggered: false
        },
        {
          stratumId: "command/en",
          heroLexicalUseId: "update.command.en",
          observedCount: 5_000,
          observedRate: 0.5,
          medianMultiple: 1,
          concentrationTriggered: false
        }
      ]
    },
    concentrationReviews: [],
    acceptance: { pass: true }
  };
  const successorSet = {
    schemaVersion: 1,
    reportSetId: "successors:test-v2",
    reports: [successor]
  };
  assert.equal(validateConcentrationReviewEvidence({
    review: fixedReview,
    successorReportSet: successorSet,
    curationReviewerDirectory: directory
  }), true);
  const incompleteSuccessor = structuredClone(successorSet);
  delete incompleteSuccessor.reports[0].eventArtifact;
  assert.throws(() => validateConcentrationReviewEvidence({
    review: fixedReview,
    successorReportSet: incompleteSuccessor,
    curationReviewerDirectory: directory
  }), /missing field eventArtifact/);
  const missingAffectedHero = structuredClone(successorSet);
  missingAffectedHero.reports[0].editorialConcentration.heroes[0].heroLexicalUseId = "other.command.en";
  assert.throws(() => validateConcentrationReviewEvidence({
    review: fixedReview,
    successorReportSet: missingAffectedHero,
    curationReviewerDirectory: directory
  }), /exact affected hero/);
  const staleSuccessor = structuredClone(successorSet);
  staleSuccessor.reports[0].versionTuple.vocabularyVersion = versionTuple.vocabularyVersion;
  assert.throws(() => validateConcentrationReviewEvidence({
    review: fixedReview,
    successorReportSet: staleSuccessor,
    curationReviewerDirectory: directory
  }), /version did not increase/);
  const retriggered = structuredClone(successorSet);
  Object.assign(retriggered.reports[0].editorialConcentration.strata[0], {
    nonZeroMedianCount: 1_000,
    nonZeroMedianRate: 0.1,
    topShare: 0.8,
    hhi: 0.66
  });
  Object.assign(retriggered.reports[0].editorialConcentration.heroes[0], {
    observedCount: 8_000,
    observedRate: 0.8,
    medianMultiple: 8,
    concentrationTriggered: true
  });
  Object.assign(retriggered.reports[0].editorialConcentration.heroes[1], {
    observedCount: 1_000,
    observedRate: 0.1,
    medianMultiple: 1
  });
  retriggered.reports[0].editorialConcentration.heroes.push({
    stratumId: "command/en",
    heroLexicalUseId: "retry.command.en",
    observedCount: 1_000,
    observedRate: 0.1,
    medianMultiple: 1,
    concentrationTriggered: false
  });
  assert.throws(() => validateConcentrationReviewEvidence({
    review: fixedReview,
    successorReportSet: retriggered,
    curationReviewerDirectory: directory
  }), /still triggers/);
});

test("mounted outcome telemetry exposes rejection and known-good denominators", () => {
  const attempt = (inputId, candidateSource, status, rejectionReasons, fallbackTrigger = null) => ({
    inputId,
    attemptResult: {
      status,
      rejectionReasons,
      envelope: { candidateSource, fallbackTrigger }
    }
  });
  const summary = summarizeMountedOutcomes([
    attempt("input-a", "ranked", "reject", ["fit.overflow", "geometry.bounds"]),
    attempt("input-a", "known-good", "accept", [], "queue-exhausted"),
    attempt("input-b", "ranked", "accept", [])
  ], { acceptedOutputCount: 2, populationAttemptCount: 3 });
  assert.equal(summary.denominatorsPass, true);
  assert.deepEqual(summary.inputCounts, {
    withMountedAttempt: 2,
    withMountedRejection: 1,
    withKnownGoodAttempt: 1
  });
  assert.deepEqual(summary.knownGood.fallbackTriggers, [
    { fallbackTrigger: "queue-exhausted", attemptCount: 1 }
  ]);
  assert.deepEqual(summary.rejectionReasons, [
    { reason: "fit.overflow", occurrenceCount: 1 },
    { reason: "geometry.bounds", occurrenceCount: 1 }
  ]);
});

test("command and status recipe registries enforce naming and endpoint boundaries", () => {
  const { vocabulary } = createCompositionTestContext();
  assert.deepEqual(activeRecipeIds, ["command", "status"]);
  assert.equal(compositionRecipes.filter(recipe => recipe.id === "command").length, 1);
  assert.equal(compositionRecipes.filter(recipe => recipe.id === "status").length, 1);
  assert.ok(relationEdges.every(edge => edge.directed && edge.reviewStatus === "approved"));
  assert.deepEqual(
    compositionRecipes.find(recipe => recipe.id === "status").pairRules.prefer.map(rule => rule.id),
    ["status.recovery-affinity"]
  );
  assert.ok(relationEdges.some(edge => edge.relation === "recoveryFor"));

  const commandRecipe = compositionRecipes.find(recipe => recipe.id === "command");
  assert.deepEqual(commandRecipe.slots.find(slot => slot.id === "hero").acceptsAnyTag, ["action"]);
  assert.deepEqual(commandRecipe.slots.find(slot => slot.id === "modifier").acceptsAnyTag, ["modifier"]);
  assert.ok(commandRecipe.requiredRelations.some(clause =>
    clause.fromSlot === "modifier"
    && clause.toSlot === "hero"
    && clause.whenSlotPresent === "modifier"
    && clause.relations.includes("modifies")
  ));
  const commandGroup = pilotCandidateTranslationSetGroups.find(group => group.id === "command");
  const modifierGroup = pilotCandidateTranslationSetGroups.find(group => group.id === "modifier");
  assert.deepEqual(commandGroup.ids, actionCommandTranslationSetIds);
  assert.equal(commandGroup.maxActive, 1);
  assert.deepEqual(actionModifierTranslationSetIds, ["quick.modifier"]);
  assert.deepEqual(modifierGroup, {
    id: "modifier",
    ids: ["quick.modifier"],
    maxActive: 1
  });
  assert.deepEqual(
    reviewedCommandTargetRelations.map(record => record.commandSetId),
    actionCommandTranslationSetIds
  );
  reviewedCommandTargetRelations.forEach(({ commandSetId, subjectSetIds }) => {
    assert.ok(subjectSetIds.length >= 1, commandSetId);
    subjectSetIds.forEach(subjectSetId => {
      assert.ok(relationEdges.some(edge =>
        edge.relation === "actsOn"
        && edge.from.translationSetId === commandSetId
        && edge.to.translationSetId === subjectSetId
      ), `${commandSetId}/${subjectSetId}`);
    });
  });
  assert.ok(!relationEdges.some(edge =>
    edge.relation === "actsOn" && edge.from.translationSetId === "quick.modifier"
  ));
  assert.ok(relationEdges.some(edge =>
    edge.relation === "modifies"
    && edge.from.translationSetId === "quick.modifier"
    && edge.to.tag === "action"
  ));

  const invalidEndpointRecipes = structuredClone(compositionRecipes);
  invalidEndpointRecipes[0].slots[0].cardinality.max = 2;
  assert.throws(() => validateRecipeRegistry({
    recipes: invalidEndpointRecipes,
    activeRecipeIds,
    relationEdges,
    lexicalUseById: vocabulary.lexicalUseById,
    translationSetById: vocabulary.translationSetById
  }), /max cardinality 1|exactly one hero/);

  const invalidPreferenceRecipes = structuredClone(compositionRecipes);
  invalidPreferenceRecipes[0].layoutPreferences.metadata = ["edge"];
  assert.throws(() => validateRecipeRegistry({
    recipes: invalidPreferenceRecipes,
    activeRecipeIds,
    relationEdges,
    lexicalUseById: vocabulary.lexicalUseById,
    translationSetById: vocabulary.translationSetById
  }), /unknown layout preference slot metadata/);

  assert.throws(() => validateRecipeRegistry({
    recipes: compositionRecipes,
    activeRecipeIds,
    relationEdges: [...relationEdges, relationEdges[0]],
    lexicalUseById: vocabulary.lexicalUseById,
    translationSetById: vocabulary.translationSetById
  }), /duplicate id/);
});

test("QUICK is optional command support and can never occupy the hero slot", () => {
  const commandRecipe = compositionRecipes.find(recipe => recipe.id === "command");
  const modifierDefinition = commandRecipe.slots.find(slot => slot.id === "modifier");
  assert.equal(modifierDefinition.optionalPresenceRate, 0.25);

  const { context, vocabulary } = createCompositionTestContext({ seed: 510 });
  const tuples = enumerateCanonicalSemanticTuples("command", context);
  let modifierTupleCount = 0;
  for (const tuple of tuples) {
    const heroSlot = tuple.slots.find(slot => slot.slotDefinitionId === "hero");
    const hero = context.candidateById.get(heroSlot.candidateId);
    assert.ok(hero.tags.includes("action"));
    assert.ok(!hero.tags.includes("modifier"));
    const modifierSlot = tuple.slots.find(slot => slot.slotDefinitionId === "modifier");
    if (!modifierSlot) continue;
    modifierTupleCount += 1;
    const modifier = context.candidateById.get(modifierSlot.candidateId);
    assert.equal(modifier.translationSetId, "quick.modifier");
    assert.ok(relationEdges.some(edge =>
      edge.relation === "modifies"
      && edge.from.translationSetId === modifier.translationSetId
      && edge.to.tag === "action"
    ));
  }
  assert.ok(modifierTupleCount > 0);

  for (const invalidRate of [0, 1, Number.NaN]) {
    const invalidRecipes = structuredClone(compositionRecipes);
    invalidRecipes[0].slots.find(slot => slot.id === "modifier").optionalPresenceRate = invalidRate;
    assert.throws(() => validateRecipeRegistry({
      recipes: invalidRecipes,
      activeRecipeIds,
      relationEdges,
      lexicalUseById: vocabulary.lexicalUseById,
      translationSetById: vocabulary.translationSetById
    }), /optionalPresenceRate/);
  }

  const requiredPresenceRecipes = structuredClone(compositionRecipes);
  requiredPresenceRecipes[0].slots.find(slot => slot.id === "hero").optionalPresenceRate = 0.25;
  assert.throws(() => validateRecipeRegistry({
    recipes: requiredPresenceRecipes,
    activeRecipeIds,
    relationEdges,
    lexicalUseById: vocabulary.lexicalUseById,
    translationSetById: vocabulary.translationSetById
  }), /optionalPresenceRate/);
});

test("cardinality shapes use total-first order and cover every 2-5 block recipe form", () => {
  const { context } = createCompositionTestContext();
  const commandShapes = deriveCanonicalCardinalityShapes("command", context);
  const statusShapes = deriveCanonicalCardinalityShapes("status", context);
  assert.equal(commandShapes.length, 11);
  assert.equal(statusShapes.length, 8);
  assert.deepEqual(
    commandShapes.map(shape => shape.totalInstanceCount),
    [2, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5]
  );
  assert.deepEqual(statusShapes.map(shape => shape.totalInstanceCount), [2, 3, 3, 3, 4, 4, 4, 5]);
  for (const shapes of [commandShapes, statusShapes]) {
    shapes.forEach((shape, index) => {
      assert.deepEqual(shape.shapeKey, [shape.totalInstanceCount, ...shape.counts]);
      if (index > 0) {
        assert.ok(
          shape.totalInstanceCount > shapes[index - 1].totalInstanceCount
          || shape.shapeKey.join(",") > shapes[index - 1].shapeKey.join(",")
        );
      }
    });
  }
  const domainBundles = deriveCanonicalSlotDomains("command", context);
  assert.equal(domainBundles.length, commandShapes.length);
  assert.ok(domainBundles.every(bundle =>
    bundle.domains.every(domain =>
      domain.candidateIds.every((id, index) => index === 0 || domain.candidateIds[index - 1] < id)
    )
  ));
});

test("canonical composition layouts preserve rectangular complete 3x3 coverage", () => {
  const expectedCounts = new Map([[2, 8], [3, 6], [4, 16], [5, 20]]);
  for (let count = 2; count <= 5; count += 1) {
    const slotIds = Array.from({ length: count }, (_, index) => `slot-${index + 1}`);
    const layouts = enumerateCanonicalLayouts(slotIds);
    assert.equal(layouts.length, expectedCounts.get(count));
    assert.equal(new Set(layouts.map(layout => layout.layoutKey)).size, layouts.length);
    for (const layout of layouts) {
      const cells = layout.blocks.flatMap(block => block.cells);
      assert.deepEqual([...cells].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
      assert.equal(new Set(cells).size, 9);
      assert.deepEqual(
        [...layout.blocks.map(block => block.slotInstanceId)].sort(),
        [...slotIds].sort()
      );
      layout.blocks.forEach(block => {
        const [width, height] = block.footprint.split("x").map(Number);
        assert.equal(width * height, block.cells.length);
      });
    }
  }
});

function tuple(recipeId, slots, context = null) {
  return {
    recipeId,
    slots: slots.map(([id, slotDefinitionId, lexicalUseId]) => ({
      id,
      slotDefinitionId,
      sourceKind: "lexical",
      candidateId: context
        ? [...context.candidateById.values()].find(candidate =>
            candidate.sourceKind === "lexical" && candidate.lexicalUseId === lexicalUseId
          )?.candidateId
        : `lexical:${lexicalUseId}`
    }))
  };
}

test("tuple compatibility shares directed relation, avoid, duplicate, and recovery gates", () => {
  const { context } = createCompositionTestContext();
  const command = tuple("command", [
    ["hero-1", "hero", "upgrade.command.en"],
    ["subject-1", "subject", "system.topic.en"]
  ], context);
  const positive = validateTupleCompatibility(command, context);
  assert.equal(positive.valid, true);
  assert.match(positive.tupleFingerprint, /^sha256:[0-9a-f]{64}$/);

  const forest = validateTupleCompatibility(tuple("command", [
    ["hero-1", "hero", "upgrade.command.en"],
    ["subject-1", "subject", "forest.topic.en"]
  ], context), context);
  assert.equal(forest.valid, false);
  assert.match(forest.rejectionReasons[0], /^avoid:command\.forest-avoid:/);
  assert.ok(forest.rejectionReasons.some(reason => reason.startsWith("relation:")));

  const statusWithRecovery = validateTupleCompatibility(tuple("status", [
    ["hero-1", "hero", "access-denied.status.en"],
    ["subject-1", "subject", "system.topic.en"],
    ["recovery-1", "recovery", "retry.command.en"]
  ], context), context);
  assert.equal(statusWithRecovery.valid, true);
  const statusWithoutRecovery = validateTupleCompatibility(tuple("status", [
    ["hero-1", "hero", "access-denied.status.en"],
    ["subject-1", "subject", "system.topic.en"]
  ], context), context);
  assert.equal(statusWithoutRecovery.valid, true);
  const invalidRecovery = validateTupleCompatibility(tuple("status", [
    ["hero-1", "hero", "access-denied.status.en"],
    ["subject-1", "subject", "system.topic.en"],
    ["recovery-1", "recovery", "upgrade.command.en"]
  ], context), context);
  assert.equal(invalidRecovery.valid, false);
  assert.ok(invalidRecovery.rejectionReasons.includes("relation:recovery:recoveryFor:hero"));

  const repeatedMetadata = validateTupleCompatibility(tuple("command", [
    ["hero-1", "hero", "upgrade.command.en"],
    ["subject-1", "subject", "system.topic.en"],
    ["meta-1", "meta", "generic-code.reference.1.en"],
    ["meta-2", "meta", "generic-code.reference.1.en"]
  ], context), context);
  assert.equal(repeatedMetadata.valid, false);
  assert.ok(repeatedMetadata.rejectionReasons.includes("tuple.noncanonical-repeated-slot:meta"));
  assert.ok(repeatedMetadata.rejectionReasons.some(reason => reason.startsWith("duplicate-text:")));
});

test("candidate materialization is keyed, inventory-local, and multilingual over seeds", () => {
  const first = createCompositionTestContext({ seed: 77 });
  const again = createCompositionTestContext({ seed: 77 });
  const other = createCompositionTestContext({ seed: 78 });
  assert.deepEqual(first.inventory.rankedCandidateIds, again.inventory.rankedCandidateIds);
  assert.notDeepEqual(first.inventory.rankedCandidateIds, other.inventory.rankedCandidateIds);
  assert.equal(first.inventory.candidateById.size, 244);
  assert.equal(first.inventory.rankedCandidateIds.length, 9);

  const languages = new Set();
  for (let seed = 0; seed < 60; seed += 1) {
    const { inventory } = createCompositionTestContext({ seed });
    const selectedCandidates = inventory.rankedCandidateIds
      .map(id => inventory.candidateById.get(id))
      .filter(candidate => candidate.sourceKind === "lexical");
    const actionCandidates = selectedCandidates.filter(candidate => candidate.tags.includes("action"));
    const modifierCandidates = selectedCandidates.filter(candidate => candidate.tags.includes("modifier"));
    assert.equal(actionCandidates.length, 2);
    assert.equal(actionCandidates.filter(candidate => candidate.translationSetId !== "retry.command").length, 1);
    assert.deepEqual(modifierCandidates.map(candidate => candidate.translationSetId), ["quick.modifier"]);
    actionCandidates.forEach(candidate => languages.add(candidate.language));
  }
  assert.deepEqual([...languages].sort(), ["en", "ko", "zh"]);

  const selectedCommandSets = new Set();
  const technologicSetIds = new Set([
    ...actionCommandTranslationSetIds,
    ...actionModifierTranslationSetIds
  ]);
  for (let seed = 0; seed < 512; seed += 1) {
    const { inventory } = createCompositionTestContext({ seed });
    inventory.rankedCandidateIds
      .map(id => inventory.candidateById.get(id))
      .filter(candidate => candidate.sourceKind === "lexical" && technologicSetIds.has(candidate.translationSetId))
      .forEach(candidate => selectedCommandSets.add(candidate.translationSetId));
  }
  assert.deepEqual([...selectedCommandSets].sort(), [...technologicSetIds].sort());
  const seed = deriveSeed({ seed: 10 }, "selection");
  assert.equal(keyedValue(seed, "tie"), keyedValue(seed, "tie"));
  assert.notEqual(keyedValue(seed, "tie"), keyedValue(seed, "materialization"));
});

test("stored expressive evidence covers every action hero with balanced language exposure", async () => {
  const report = await readJson(
    "web/micro-graphic-generator/tests/fixtures/expressive-range-report.v2.json"
  );
  assert.equal(report.schemaVersion, EVALUATION_SCHEMA_VERSION);
  assert.equal(report.acceptance.pass, true);
  assert.deepEqual(report.concentrationReviews, []);
  assert.deepEqual(
    report.editorialConcentration.strata.map(stratum => stratum.id),
    ["command/en", "command/ko", "command/zh", "status/en", "status/ko", "status/zh"]
  );

  const actionHeroIds = new Set(translationSets
    .filter(set => actionCommandTranslationSetIds.includes(set.id))
    .flatMap(set => set.members.map(member => member.lexicalUseId)));
  const actionHeroes = report.editorialConcentration.heroes.filter(hero =>
    actionHeroIds.has(hero.heroLexicalUseId)
  );
  assert.equal(actionHeroIds.size, 183);
  assert.deepEqual(
    actionHeroes.map(hero => hero.heroLexicalUseId).sort(),
    [...actionHeroIds].sort()
  );
  assert.ok(Math.min(...actionHeroes.map(hero => hero.observedCount)) >= 5);
  assert.ok(!report.editorialConcentration.heroes.some(hero =>
    hero.heroLexicalUseId.startsWith("quick.modifier.")
  ));

  const commandByLanguage = Object.fromEntries(["en", "ko", "zh"].map(language => [
    language,
    actionHeroes
      .filter(hero => hero.heroLexicalUseId.endsWith(`.${language}`))
      .reduce((sum, hero) => sum + hero.observedCount, 0)
  ]));
  const languageCounts = Object.values(commandByLanguage);
  assert.ok(Math.max(...languageCounts) / Math.min(...languageCounts) <= 1.2, commandByLanguage);

  const recipeCounts = Object.fromEntries(["command", "status"].map(recipeId => [
    recipeId,
    report.editorialConcentration.strata
      .filter(stratum => stratum.recipeId === recipeId)
      .reduce((sum, stratum) => sum + stratum.acceptedOutputCount, 0)
  ]));
  assert.ok(Math.max(...Object.values(recipeCounts)) / Math.min(...Object.values(recipeCounts)) <= 1.1, recipeCounts);
});

test("typography metric fixture and block weight variants are exact", async () => {
  const fixture = await readJson(
    "web/micro-graphic-generator/tests/fixtures/typography-metrics.json"
  );
  assert.equal(fixture.fontMetricsVersion, FONT_METRICS_VERSION);
  fixture.cases.forEach(testCase => {
    assert.deepEqual(measureTypography(testCase.input), testCase.expected, testCase.id);
  });
  const { inventory } = createCompositionTestContext();
  const candidate = inventory.candidateById.get("lexical:upgrade.command.en");
  assert.deepEqual(deriveTypographyTokenVariant(candidate, {
    requestedSize: "xlarge",
    footprint: "3x1",
    compositionRole: "hero"
  }), {
    tokenId: "type:upgrade.command.en:xlarge:900",
    requestedSize: "xlarge",
    requestedWeight: "bold",
    requestedFontWeight: 900
  });
  assert.equal(deriveTypographyTokenVariant(candidate, {
    requestedSize: "large",
    footprint: "1x1",
    compositionRole: "hero"
  }).requestedFontWeight, 700);
});

test("motif descriptors preserve non-factual identity and reviewed occupancy calibration", () => {
  const candidates = materializeMotifCandidates();
  assert.equal(motifRegistry.length, 4);
  assert.equal(candidates.length, 8);
  assert.ok(motifRegistry.every(record =>
    record.factual === false
    && record.maxProminence === "secondary"
    && Number.isFinite(record.occupancySafetyFactor)
    && record.occupancySafetyFactor > 0
  ));
  candidates.forEach(candidate => assert.equal(validateMotifRenderParams(candidate), true));
  assert.throws(() => validateMotifRenderParams({
    ...candidates[0],
    occupancySafetyFactor: candidates[0].occupancySafetyFactor + 0.1
  }), /factor mismatch/);
});

test("Chromium motif calibration fixes every variant and monotone family factor", async () => {
  const fixture = await readJson(
    "web/micro-graphic-generator/tests/fixtures/motif-occupancy-calibration.json"
  );
  const candidates = materializeMotifCandidates();
  assert.equal(fixture.schemaVersion, 1);
  assert.equal(fixture.browserProfile, RUNTIME_CONFORMANCE.browserProfile);
  assert.deepEqual(fixture.canvas, { width: 512, height: 512, background: "transparent" });
  assert.equal(fixture.variants.length, candidates.length);
  assert.equal(fixture.families.length, motifRegistry.length);
  assert.deepEqual(
    fixture.variants.map(variant => variant.candidateId),
    candidates.map(candidate => candidate.candidateId)
  );
  for (const record of motifRegistry) {
    const family = fixture.families.find(item => item.motifId === record.id);
    assert.ok(family, record.id);
    assert.equal(family.declaredVariantCount, record.declaredVariantCount);
    assert.equal(family.p95Coverage, record.p95Coverage);
    assert.equal(family.p95Coverage, motifCalibration[record.id].p95Coverage);
    assert.equal(family.occupancySafetyFactor, record.occupancySafetyFactor);
    assert.equal(family.occupancyCalibrationRevision, record.occupancyCalibrationRevision);
    assert.deepEqual(family.reviewerIds, [...record.calibrationReviewerIds]);
    assert.equal(
      fixture.variants.filter(variant => variant.motifId === record.id).length,
      record.declaredVariantCount
    );
  }
  for (const left of fixture.families) {
    for (const right of fixture.families) {
      if (left.p95Coverage > right.p95Coverage) {
        assert.ok(
          left.occupancySafetyFactor >= right.occupancySafetyFactor,
          `${left.motifId} factor must be at least ${right.motifId}`
        );
      }
    }
  }
});

test("composition plan baseline deep-equals current command/status 2-5 block planning", async () => {
  const fixture = await readJson(
    "web/micro-graphic-generator/tests/fixtures/composition-plan-baseline.json"
  );
  assert.deepEqual(fixture, buildCompositionPlanBaseline());
  assert.equal(fixture.ownerSnapshotRevision, OWNER_SNAPSHOT_REVISION);
  assert.deepEqual(fixture.cases.map(item => item.id), ["command-pilot", "status-pilot"]);
  fixture.cases.forEach(item => {
    assert.deepEqual(item.representativePlans.map(record => record.blockCount), [2, 3, 4, 5]);
    item.representativePlans.forEach(record => {
      assert.equal(record.plan.blocks.length, record.blockCount);
      assert.match(record.plan.planId, /^plan:sha256:[0-9a-f]{64}$/);
    });
  });
});

test("ranked universe and planner queue are complete, same-recipe, and deterministic", () => {
  const { context, generationInput } = createCompositionTestContext();
  const universe = deriveRankedPlanUniverse(context);
  const countersByRecipe = planningCountersForUniverse(universe);
  assert.ok(universe.rankedPlans.length > 0);
  assert.ok(universe.rankedPlans.every(record => record.recipeId === universe.selectedRecipeId));
  assert.equal(new Set(universe.rankedPlans.map(record => record.planId)).size, universe.rankedPlans.length);
  const twoByTwoLexicalRequests = universe.rankedPlans.flatMap(({ plan }) => {
    const lexicalSlotIds = new Set(plan.slots
      .filter(slot => slot.sourceKind === "lexical")
      .map(slot => slot.id));
    return plan.blocks
      .filter(block => lexicalSlotIds.has(block.slotInstanceId) && block.footprint === "2x2")
      .map(block => block.requestedSize);
  });
  assert.ok(twoByTwoLexicalRequests.length > 0);
  assert.deepEqual([...new Set(twoByTwoLexicalRequests)].sort(), ["xxlarge", "xxxlarge"]);
  for (const counters of Object.values(countersByRecipe)) {
    assert.ok(counters.canonicalPrefixVisits <= MAX_CANONICAL_PREFIX_VISITS_PER_RECIPE);
    assert.ok(counters.layoutDecisionExpansions <= MAX_LAYOUT_DECISION_EXPANSIONS_PER_RECIPE);
    assert.ok(counters.retainedViableDecisions <= MAX_RETAINED_VIABLE_DECISIONS_PER_TUPLE);
    assert.ok(counters.rankedPlans <= MAX_RANKED_PLANS_PER_RECIPE);
  }

  let drawCount = 0;
  const result = planComposition({
    generationInput,
    validationContext: context,
    selectionRandomSource: () => {
      drawCount += 1;
      return 0.5;
    }
  });
  assert.equal(drawCount, 1);
  assert.equal(result.searchQueue.length, universe.rankedPlans.length);
  assert.deepEqual(result.searchQueue.map(entry => entry.candidateCursor), result.searchQueue.map((_, index) => index));
  assert.equal(new Set(result.searchQueue.map(entry => entry.planId)).size, result.searchQueue.length);
  assert.ok(result.searchQueue.every(entry =>
    entry.candidateSource === "ranked"
    && entry.plan.recipeId === result.initialSelection.selectedRecipeId
  ));
  assert.equal(result.searchQueue[0].planId, result.initialSelection.selectedPlanId);
  const selectedSlotIds = result.searchQueue[0].plan.slots.map(slot => slot.id).sort();
  const approvedAlternates = result.searchQueue.filter(entry => entry.searchTier === "approved-alternate");
  approvedAlternates.forEach(entry => {
    assert.deepEqual(entry.plan.slots.map(slot => slot.id).sort(), selectedSlotIds);
    const selectedMotifs = result.searchQueue[0].plan.slots
      .filter(slot => slot.sourceKind === "motif")
      .map(slot => [slot.id, slot.motifId, slot.candidateId]);
    const alternateMotifs = entry.plan.slots
      .filter(slot => slot.sourceKind === "motif")
      .map(slot => [slot.id, slot.motifId, slot.candidateId]);
    assert.deepEqual(alternateMotifs, selectedMotifs);
  });

  const plan = result.searchQueue[0].plan;
  assert.match(plan.planId, /^plan:sha256:[0-9a-f]{64}$/);
  assert.equal(plan.schemaVersion, 3);
  assert.equal(plan.slots.filter(slot => slot.compositionRole === "hero").length, 1);
  assert.equal(plan.slots.filter(slot => slot.prominence === "primary").length, 1);
  assert.equal(plan.slots.find(slot => slot.compositionRole === "hero").sourceKind, "lexical");
  assert.deepEqual(plan.blocks.flatMap(block => block.cells).sort((a, b) => a - b), [1,2,3,4,5,6,7,8,9]);
  assert.equal(validateCompositionPlan(plan, context), plan);

  const same = planComposition({
    generationInput,
    validationContext: context,
    selectionRandomSource: () => 0.5
  });
  assert.deepEqual(same, result);
  const queue = deriveCanonicalSearchQueue(universe, result.initialSelection.selectedPlanId, context);
  assert.deepEqual(queue, result.searchQueue);

  const tampered = structuredClone(result);
  tampered.searchQueue.pop();
  assert.throws(() => validatePlannerResult(tampered, context), /search queue mismatch/);
});

test("approved alternates preserve the exact slot and motif identity set", () => {
  const selectedPlan = {
    recipeId: "command",
    slots: [
      {
        id: "hero-1",
        slotDefinitionId: "hero",
        sourceKind: "lexical",
        lexicalUseId: "source.use",
        candidateId: "lexical:source.use"
      },
      {
        id: "motif-1",
        slotDefinitionId: "motif",
        sourceKind: "motif",
        motifId: "barcode",
        candidateId: "motif.barcode:medium"
      }
    ]
  };
  const exactAlternate = {
    ...selectedPlan,
    slots: [
      { ...selectedPlan.slots[0], lexicalUseId: "alternate.use", candidateId: "lexical:alternate.use" },
      { ...selectedPlan.slots[1] }
    ]
  };
  const droppedSlotAlternate = {
    ...exactAlternate,
    slots: [exactAlternate.slots[0]]
  };
  const rankedPlans = [
    { planId: "selected", tupleFingerprint: "tuple:selected", rankKey: [3], plan: selectedPlan },
    { planId: "exact", tupleFingerprint: "tuple:exact", rankKey: [2], plan: exactAlternate },
    { planId: "dropped", tupleFingerprint: "tuple:dropped", rankKey: [1], plan: droppedSlotAlternate }
  ];
  const queue = deriveCanonicalSearchQueue({
    selectedRecipeId: "command",
    rankedPlans
  }, "selected", {
    relationEdges: [{
      relation: "alternateOf",
      from: { lexicalUseId: "alternate.use" },
      to: { lexicalUseId: "source.use" },
      priority: 1
    }]
  });
  assert.equal(queue.find(entry => entry.planId === "exact").searchTier, "approved-alternate");
  assert.equal(queue.find(entry => entry.planId === "dropped").searchTier, "other-replan");
});

test("planner emits a true no-candidate result without consuming selection random", () => {
  const initial = createCompositionTestContext();
  const metadataOnly = [initial.inventory.candidateIdByLexicalUseId.get("generic-code.reference.1.en")];
  const { context, generationInput } = createCompositionTestContext({
    rankedCandidateIds: metadataOnly
  });
  let drawCount = 0;
  const result = planComposition({
    generationInput,
    validationContext: context,
    selectionRandomSource: () => {
      drawCount += 1;
      return 0;
    }
  });
  assert.equal(result.initialSelection.status, "no-candidate");
  assert.equal(result.searchQueue.length, 0);
  assert.equal(drawCount, 0);
  assert.equal(validatePlannerResult(result, context), result);
});

test("known-good registry resolves every pilot recipe and supported ratio through the complete validator", () => {
  assert.equal(knownGoodTemplates.length, 14);
  knownGoodTemplates.forEach(template => assert.equal(validateKnownGoodTemplateShape(template), template));
  const registry = createKnownGoodRegistry();
  assert.deepEqual(registry.diagnostics, []);
  const ratios = ["1:1", "2:3", "2:5", "3:2", "5:2", "4:3", "3:4"];
  for (const ratio of ratios) {
    const [widthRatio, heightRatio] = ratio.split(":").map(Number);
    const component = widthRatio >= heightRatio
      ? { width: 960, height: 960 * heightRatio / widthRatio }
      : { width: 960 * widthRatio / heightRatio, height: 960 };
    const padded = paddedBox(0, 0, component.width, component.height, "large");
    const safeBox = { x: padded.x, y: padded.y, width: padded.width, height: padded.height };
    const { generationInput, context } = createCompositionTestContext({ seed: 0, ratio, safeBox });
    const result = instantiateKnownGoodPlanMap(registry, generationInput, context);
    assert.deepEqual(result.diagnostics, [], ratio);
    assert.deepEqual([...result.plans.keys()], ["command", "status"], ratio);
    for (const [recipeId, plan] of result.plans) {
      assert.equal(plan.recipeId, recipeId);
      assert.equal(validateCompositionPlan(plan, context), plan);
    }
    assert.throws(() => result.plans.set("command", result.plans.get("command")), /immutable/);
  }

  const invalid = structuredClone(knownGoodTemplates[0]);
  invalid.key.ownerSnapshotRevision = OWNER_SNAPSHOT_REVISION;
  assert.throws(() => validateKnownGoodTemplateShape(invalid), /ownerSnapshotRevision is forbidden/);
  const duplicateRegistry = createKnownGoodRegistry([knownGoodTemplates[0], knownGoodTemplates[0]]);
  assert.equal(duplicateRegistry.templates.length, 1);
  assert.equal(duplicateRegistry.diagnostics[0].code, "known-good.invalid-template");
});

test("grid selection is an exact validated plan projection without alternates", () => {
  const { context, generationInput } = createCompositionTestContext();
  const result = planComposition({
    generationInput,
    validationContext: context,
    selectionRandomSource: () => 0.25
  });
  const plan = result.searchQueue[0].plan;
  const projection = projectCompositionPlan(plan, context);
  assert.equal(projection.planId, plan.planId);
  assert.deepEqual(
    projection.blocks.map(record => record.block),
    plan.blocks
  );
  projection.blocks.forEach(record => {
    assert.equal(record.slot.id, record.block.slotInstanceId);
    assert.equal(record.candidate.candidateId, record.slot.candidateId);
    assert.equal(record.geometry.alignment, record.block.alignment);
    assert.equal(record.geometry.verticalAlignment, record.block.verticalAlignment);
  });
});

test("mounted occupancy and definitive attempt schemas fail closed", () => {
  assert.deepEqual(deriveMountedOccupancy({
    sourceKind: "motif",
    renderedBounds: { width: 100, height: 50 },
    safeBox: { width: 500, height: 400 },
    occupancySafetyFactor: 1.2
  }), {
    normalizedArea: 0.025,
    mountedOccupancyScore: 0.03
  });
  assert.throws(() => deriveMountedOccupancy({
    sourceKind: "lexical",
    renderedBounds: { width: 100, height: 50 },
    safeBox: { width: 500, height: 400 },
    occupancySafetyFactor: 1.2
  }), /factor must be 1/);

  const [template] = knownGoodTemplates.filter(item => item.key.ratio === "3:4" && item.key.recipeId === "command");
  const padded = paddedBox(0, 0, 720, 960, "large");
  const safeBox = { x: padded.x, y: padded.y, width: padded.width, height: padded.height };
  const { generationInput, context } = createCompositionTestContext({ ratio: "3:4", safeBox });
  const plan = instantiateKnownGoodPlanMap(
    createKnownGoodRegistry([template]),
    generationInput,
    context
  ).plans.get("command");
  const envelope = deepFreeze({
    attempt: 1,
    candidateSource: "known-good",
    candidateCursor: 0,
    searchTier: "known-good",
    fallbackTrigger: "no-candidate",
    planId: plan.planId
  });
  const finalizationReport = deepFreeze({
    schemaVersion: 1,
    planId: plan.planId,
    attempt: 1,
    candidateSource: "known-good",
    candidateCursor: 0,
    searchTier: "known-good",
    fallbackTrigger: "no-candidate",
    status: "accept",
    failedSlotInstanceIds: [],
    rejectionReasons: [],
    blocks: plan.blocks.map(block => ({
      blockId: block.id,
      slotInstanceId: block.slotInstanceId,
      sourceKind: "lexical",
      requestedSize: block.requestedSize,
      requestedWeight: block.requestedWeight,
      requestedFontWeight: block.requestedFontWeight,
      actualSize: block.requestedSize,
      actualWeight: block.requestedWeight,
      actualFontWeight: block.requestedFontWeight,
      fallbackTier: 0,
      renderedBounds: { width: 120, height: 40 },
      occupancySafetyFactor: 1,
      occupancyCalibrationRevision: null,
      mountedOccupancyScore: 0.01,
      fits: true
    }))
  });
  assert.equal(validateFinalizationReport(finalizationReport), finalizationReport);
  const attempt = deepFreeze({
    schemaVersion: 1,
    envelope,
    finalizationReport,
    validation: {
      status: "pass",
      skipReason: null,
      results: [{ rule: "composition.fixture", valid: true, nodes: [], detail: "" }]
    },
    status: "accept",
    rejectionReasons: []
  });
  assert.equal(validateAttemptResult(attempt), attempt);
  assert.throws(() => validateAttemptResult({
    ...attempt,
    envelope: { ...envelope, candidateCursor: 8, attempt: 9 },
    finalizationReport: { ...finalizationReport, candidateCursor: 8, attempt: 9 }
  }), /no-candidate fallback must start at cursor 0/);
  assert.throws(() => validateAttemptResult({
    ...attempt,
    envelope: { ...envelope, fallbackTrigger: "attempt-budget-exhausted" },
    finalizationReport: { ...finalizationReport, fallbackTrigger: "attempt-budget-exhausted" }
  }), /attempt-budget-exhausted fallback must follow the full ranked budget/);
  assert.throws(() => validateFinalizationReport({
    ...finalizationReport,
    blocks: finalizationReport.blocks.map((block, index) => index === 0
      ? { ...block, fallbackTier: 1 }
      : block)
  }), /requested-to-actual size distance/);
  assert.throws(() => validateFinalizationReport({
    ...finalizationReport,
    blocks: finalizationReport.blocks.map((block, index) => index === 0
      ? { ...block, requestedSize: "small", actualSize: "medium", fallbackTier: 0 }
      : block)
  }), /lexical size cannot be upshifted/);
  assert.throws(() => validateFinalizationReport({
    ...finalizationReport,
    status: "reject",
    failedSlotInstanceIds: ["missing-slot"],
    rejectionReasons: ["fit.synthetic"]
  }), /unknown slot missing-slot/);
  assert.throws(() => validateFinalizationReport({
    ...finalizationReport,
    failedSlotInstanceIds: [finalizationReport.blocks[0].slotInstanceId]
  }), /accepted report cannot contain failed slots/);
  assert.throws(() => validateFinalizationReport({
    ...finalizationReport,
    blocks: finalizationReport.blocks.map((block, index) => index === 0
      ? { ...block, fits: false }
      : block)
  }), /missing non-fitting slot/);
  assert.throws(() => validateFinalizationReport({
    ...finalizationReport,
    status: "reject",
    rejectionReasons: ["hierarchy.synthetic"]
  }), /rejected report requires at least one failed slot/);
  assert.throws(() => validateAttemptResult({
    ...attempt,
    envelope: {
      ...envelope,
      candidateCursor: 1,
      attempt: 2,
      fallbackTrigger: "queue-exhausted"
    }
  }), /envelope mismatch/);
  assert.throws(() => validateAttemptResult({
    ...attempt,
    envelope: {
      ...envelope,
      candidateSource: "ranked",
      searchTier: "same-tuple-layout",
      fallbackTrigger: null,
      candidateCursor: 999,
      attempt: 1000
    },
    finalizationReport: {
      ...finalizationReport,
      candidateSource: "ranked",
      searchTier: "same-tuple-layout",
      fallbackTrigger: null,
      candidateCursor: 999,
      attempt: 1000
    }
  }), /candidateCursor/);
  assert.throws(() => validateAttemptResult({
    ...attempt,
    status: "reject",
    rejectionReasons: ["validation:fabricated"]
  }), /does not match finalization and validation evidence/);
  const terminal = deepFreeze({
    schemaVersion: 1,
    status: "terminal-failure",
    attemptedGenerationInputHash: context.generationInputHash,
    terminalReason: "no-candidate-no-known-good",
    rankedStopReason: "no-candidate",
    displayedPlanId: null,
    displayedStructuralFingerprint: null,
    preservedPrevious: false,
    exportEligible: false,
    lastAttemptResult: null
  });
  assert.equal(validateTerminalGenerationResult(terminal), terminal);
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
  const input = { schemaVersion: 1, seed: 99 };
  const labels = ["app-layout", "recipe-choice", "materialization", "selection"];
  const streams = labels.map(label => deriveSeed(input, label));
  assert.equal(new Set(streams).size, labels.length);
  assert.deepEqual(streams, labels.map(label => deriveSeed(input, label)));
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

test("pure composition modules do not reference browser globals", async () => {
  for (const path of [
    "src/random.js",
    "src/layout.js",
    "src/grid-layout.js",
    "src/token-model.js",
    "src/composition-model.js",
    "src/composition-recipes.js",
    "src/composition-plan-validator.js",
    "src/composition-planner.js",
    "src/composition-known-good.js",
    "src/grid-selection.js"
  ]) {
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

test("composition identity owners use only the shared canonical hash implementation", async () => {
  const runtimePaths = [
    "src/app.js",
    "src/composition-model.js",
    "src/composition-known-good.js",
    "src/composition-plan-validator.js",
    "src/composition-planner.js",
    "src/export.js",
    "src/grid-finalizer.js",
    "src/grid-renderer.js",
    "src/grid-selection.js",
    "src/motifs.js",
    "src/svg.js",
    "src/token-library.js"
  ];
  const toolingPaths = [
    "scripts/composition-owner-manifest-lib.mjs",
    "scripts/emit-composition-owner-snapshot.mjs",
    "scripts/verify-composition-owner-snapshot.mjs",
    "scripts/verify-planning-complexity.mjs"
  ];
  for (const path of [...runtimePaths, ...toolingPaths]) {
    const source = await readFile(new URL(`web/micro-graphic-generator/${path}`, repoRoot), "utf8");
    assert.doesNotMatch(source, /from ["']node:crypto["']|\bcreateHash\s*\(|crypto\.subtle/, path);
  }
  for (const path of toolingPaths) {
    const source = await readFile(new URL(`web/micro-graphic-generator/${path}`, repoRoot), "utf8");
    assert.doesNotMatch(source, /JSON\.stringify\s*\(/, path);
  }
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
  assert.match(sources.get("grid-selection.js"), /validateCompositionPlan/);
  assert.doesNotMatch(
    sources.get("grid-selection.js"),
    /randomSource|cell-index|alternate|fallback|\.random\s*\(|\bshuffle(?:d)?\s*\(/
  );
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

test("blind regeneration rebases only a structurally valid empty review collection", () => {
  const corpus = {
    corpusId: "blind-evaluation:v1:new",
    translationErrorLedgerRevision: `sha256:${"b".repeat(64)}`
  };
  const expected = emptyBlindReviewCollection(corpus);
  assert.deepEqual(expected, {
    schemaVersion: 1,
    corpusId: corpus.corpusId,
    translationErrorLedgerRevision: corpus.translationErrorLedgerRevision,
    results: []
  });
  const previous = {
    schemaVersion: 1,
    corpusId: "blind-evaluation:v1:old",
    translationErrorLedgerRevision: `sha256:${"a".repeat(64)}`,
    results: []
  };
  assert.deepEqual(rebaseEmptyBlindReviewCollection(previous, corpus), expected);
  assert.throws(() => rebaseEmptyBlindReviewCollection({
    ...previous,
    results: [{ reviewerId: "human-review-must-not-be-dropped" }]
  }, corpus), /only an empty result set/);
  assert.throws(() => rebaseEmptyBlindReviewCollection({
    ...previous,
    unexpected: true
  }, corpus), /unexpected fields/);
});

test("blind corpus selection covers every cell and counterbalances all overlapping groups", () => {
  const languages = [
    { language: "en", script: "latin" },
    { language: "ko", script: "hangul" },
    { language: "zh", script: "han" }
  ];
  const stratumIds = activeRecipeIds.flatMap(recipeId => languages.map(item =>
    `${recipeId}/${item.language}/${item.script}`
  ));
  const visualCellIds = motifRegistry.flatMap(motif =>
    ["requested", "downshifted"].map(finalizationClass => `${motif.id}/${finalizationClass}`)
  );
  const ratios = ["1:1", "2:3", "3:2", "3:4", "4:3"];
  const eligible = [];
  let seed = 0;
  for (const cell of visualCellIds) {
    for (let index = 0; index < 36; index += 1) {
      eligible.push({
        seed: seed += 1,
        visualCellId: cell,
        stratumId: stratumIds[3 + index % 3],
        ratio: ratios[index % ratios.length]
      });
    }
  }
  for (const stratumId of stratumIds) {
    for (let index = 0; index < 20; index += 1) {
      eligible.push({
        seed: seed += 1,
        visualCellId: null,
        stratumId,
        ratio: ratios[(index + stratumIds.indexOf(stratumId)) % ratios.length]
      });
    }
  }
  const selected = selectCompleteBlindCorpus(eligible, { stratumIds, visualCellIds });
  assert.equal(selected.length, 110);
  assert.equal(selected.filter(row => row.candidateSide === "left").length, 55);
  visualCellIds.forEach(cellId => {
    const rows = selected.filter(row => row.visualCellId === cellId);
    assert.equal(rows.length, 10, cellId);
    assert.equal(rows.filter(row => row.candidateSide === "left").length, 5, cellId);
  });
  for (const groupRows of [
    ...stratumIds.map(id => selected.filter(row => row.stratumId === id)),
    ...ratios.map(ratio => selected.filter(row => row.ratio === ratio))
  ]) {
    const left = groupRows.filter(row => row.candidateSide === "left").length;
    assert.ok(Math.abs(left - (groupRows.length - left)) <= 1);
  }
  assert.throws(() => assignCounterbalancedSides(
    selected.map(row => ({ ...row, sideBalanceCellId: "one-cell" })),
    { stratumIds, balanceCellIds: ["one-cell"] }
  ), /1-10 pairs/);
});

test("blind presentation interleave resolves the structured greedy dead end", () => {
  let state = 1;
  const next = () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state;
  };
  const rows = [];
  let seed = 0;
  const statusLanguages = ["en/latin", "ko/hangul", "zh/han"];
  for (let group = 0; group < 8; group += 1) {
    for (let index = 0; index < 10; index += 1) {
      rows.push({
        seed: seed += 1,
        visualCellId: `visual-${group}`,
        stratumId: `status/${statusLanguages[next() % statusLanguages.length]}`
      });
    }
  }
  statusLanguages.forEach((language, group) => {
    for (let index = 0; index < 10; index += 1) {
      rows.push({
        seed: seed += 1,
        visualCellId: null,
        stratumId: `command/${language}`,
        group
      });
    }
  });
  const ordered = interleaveBlindPresentation(rows);
  assert.equal(ordered.length, rows.length);
  assert.equal(new Set(ordered.map(row => row.seed)).size, rows.length);
  assert.deepEqual(blindPresentationRunSummary(ordered), {
    maximumGroupRun: 2,
    maximumStratumRun: 2
  });
  assert.deepEqual(interleaveBlindPresentation(rows), ordered);
});

test("blind display manifest exposes only opaque IDs and randomized display sides", () => {
  const digest = `sha256:${"a".repeat(64)}`;
  const manifest = {
    schemaVersion: 1,
    corpusId: "blind-evaluation:v1:test",
    corpusSha256: digest,
    translationErrorLedgerRevision: digest,
    frozenAt: "2026-07-14T12:00:00+09:00",
    fixtures: [{
      fixtureId: "blind-001",
      evaluatedLanguages: ["en", "ko"],
      left: {
        fingerprint: digest,
        svg: { path: "web/micro-graphic-generator/tests/artifacts/blind/v1/blind-001.left.svg", sha256: digest, byteLength: 1 },
        png: { path: "web/micro-graphic-generator/tests/artifacts/blind/v1/blind-001.left.png", sha256: digest, byteLength: 1 }
      },
      right: {
        fingerprint: digest,
        svg: { path: "web/micro-graphic-generator/tests/artifacts/blind/v1/blind-001.right.svg", sha256: digest, byteLength: 1 },
        png: { path: "web/micro-graphic-generator/tests/artifacts/blind/v1/blind-001.right.png", sha256: digest, byteLength: 1 }
      }
    }]
  };
  assert.equal(validateBlindDisplayManifest(manifest), manifest);
  assert.throws(() => validateBlindDisplayManifest({
    ...manifest,
    fixtures: [{
      ...manifest.fixtures[0],
      fixtureId: "blind-001-command-en"
    }]
  }), /opaque blind ID/);
  assert.throws(() => validateBlindDisplayManifest({
    ...manifest,
    fixtures: [{
      ...manifest.fixtures[0],
      left: {
        ...manifest.fixtures[0].left,
        svg: {
          ...manifest.fixtures[0].left.svg,
          path: "web/micro-graphic-generator/tests/artifacts/blind/v1/blind-001.candidate.svg"
        }
      }
    }]
  }), /opaque fixture ID|source or stratum metadata/);
});

test("blind artifact adaptation contains no direct baseline source labels", async () => {
  const source = await readFile(
    new URL("web/micro-graphic-generator/scripts/generate-blind-evaluation-corpus.mjs", repoRoot),
    "utf8"
  );
  assert.doesNotMatch(source, /data-baseline-language/);
  assert.doesNotMatch(source, /baseline-lexical-/);
  assert.doesNotMatch(source, /`baseline\.\$\{record\.language\}/);
  const writeWithShortScan = spawnSync(process.execPath, [
    fileURLToPath(new URL(
      "web/micro-graphic-generator/scripts/generate-blind-evaluation-corpus.mjs",
      repoRoot
    )),
    "--write",
    "--scan-limit=80"
  ], { encoding: "utf8" });
  assert.notEqual(writeWithShortScan.status, 0);
  assert.match(writeWithShortScan.stderr, /official blind corpus writes require exactly 60000 scanned seeds/);
});

test("blind evaluation enforces frozen identity, qualifications, unblinding, and every acceptance cell", async t => {
  const languages = [
    { language: "en", script: "latin" },
    { language: "ko", script: "hangul" },
    { language: "zh", script: "han" }
  ];
  const stratumIds = activeRecipeIds.flatMap(recipeId => languages.map(item =>
    `${recipeId}/${item.language}/${item.script}`
  ));
  const visualCellIds = motifRegistry.flatMap(motif =>
    ["requested", "downshifted"].map(finalizationClass => `${motif.id}/${finalizationClass}`)
  );
  const ratios = ["1:1", "2:3", "3:2", "3:4", "4:3"];
  const eligible = [];
  let nextSeed = 10_000;
  for (const cell of visualCellIds) {
    for (let index = 0; index < 36; index += 1) {
      eligible.push({
        seed: nextSeed += 1,
        visualCellId: cell,
        stratumId: stratumIds[3 + index % 3],
        ratio: ratios[index % ratios.length]
      });
    }
  }
  for (const stratumId of stratumIds) {
    for (let index = 0; index < 20; index += 1) {
      eligible.push({
        seed: nextSeed += 1,
        visualCellId: null,
        stratumId,
        ratio: ratios[(index + stratumIds.indexOf(stratumId)) % ratios.length]
      });
    }
  }
  const selected = selectCompleteBlindCorpus(eligible, { stratumIds, visualCellIds });
  const baseInput = createCompositionTestContext().generationInput;
  const pairs = selected.map((row, index) => {
    const [recipeId, heroLanguage, heroScript] = row.stratumId.split("/");
    const input = {
      ...baseInput,
      seed: row.seed,
      ratio: row.ratio
    };
    const candidateSvgSha = hashCanonical({ source: "candidate", seed: row.seed });
    const baselineSvgSha = hashCanonical({ source: "baseline", seed: row.seed });
    const node = (source, artifactSha256) => {
      const slotInstanceId = `${source}-hero-1`;
      const lexicalUseId = `${source}.hero.${heroLanguage}`;
      const rootToNodeOrdinalPath = "0.1.0.0";
      return {
        slotInstanceId,
        lexicalUseId,
        language: heroLanguage,
        script: heroScript,
        nodeFingerprint: blindNodeFingerprint({
          artifactSha256,
          rootToNodeOrdinalPath,
          slotInstanceId,
          lexicalUseId
        }),
        rootToNodeOrdinalPath,
        visibleText: "SAME VISIBLE TEXT"
      };
    };
    const artifact = (source, sha256) => ({
      path: `web/micro-graphic-generator/tests/artifacts/blind/test-${index}.${source}.svg`,
      sha256,
      byteLength: 1
    });
    const side = (source, revision, svgSha) => ({
      revision,
      evaluatedLanguages: [heroLanguage],
      ...(source === "candidate" ? {
        generationInput: input,
        viewportSafeBoxBasis: "captured-in-generation-input"
      } : {
        replayInput: {
          schemaVersion: 1,
          seed: input.seed,
          generationTimestamp: input.generationTimestamp,
          ratio: input.ratio,
          borderMode: input.borderMode,
          viewport: input.viewport,
          safeBox: input.safeBox,
          baselineCommit: "0123456789abcdef0123456789abcdef01234567",
          adapterContractVersion: 1,
          adapterRevision: hashCanonical({ adapter: "synthetic-v1" })
        },
        viewportSafeBoxBasis: "captured-from-baseline-runtime"
      }),
      fingerprint: hashCanonical({ structural: source, seed: row.seed }),
      expectedHeroNode: node(source, svgSha),
      svg: artifact(source, svgSha),
      png: artifact(source, hashCanonical({ png: source, seed: row.seed }))
    });
    let visualHierarchyCell = null;
    if (row.visualCellId) {
      const separator = row.visualCellId.lastIndexOf("/");
      visualHierarchyCell = {
        motifId: row.visualCellId.slice(0, separator),
        heroFinalizationClass: row.visualCellId.slice(separator + 1)
      };
    }
    const pair = {
      schemaVersion: 1,
      fixtureId: `synthetic-blind-${String(index + 1).padStart(3, "0")}`,
      stratum: { recipeId, heroLanguage, heroScript },
      visualHierarchyCell,
      candidateSide: row.candidateSide,
      baseline: side("baseline", "git:baseline", baselineSvgSha),
      candidate: side("candidate", "owner:candidate", candidateSvgSha)
    };
    return { ...pair, identityRevision: blindPairIdentityRevision(pair) };
  });
  const pairIdentityRoot = blindCorpusPairIdentityRoot(pairs);
  const corpus = {
    schemaVersion: 1,
    corpusId: `blind-evaluation:v1:${pairIdentityRoot.slice("sha256:".length, 25)}`,
    frozenAt: "2026-07-14T12:00:00+09:00",
    baselineRevision: "git:baseline",
    candidateRevision: "owner:candidate",
    translationErrorLedgerRevision: hashCanonical(translationErrorLedger),
    scanEvidence: {
      path: "web/micro-graphic-generator/tests/fixtures/blind-evaluation-scan.synthetic.json",
      sha256: hashCanonical({ scan: "synthetic-bytes" }),
      byteLength: 1,
      revision: hashCanonical({ scan: "synthetic-content" })
    },
    pairIdentityRoot,
    pairs
  };
  const corpusState = validateBlindCorpus(corpus, {
    activeRecipeIds,
    activeMotifIds: motifRegistry.map(record => record.id)
  });
  assert.equal(corpusState.coverage.pairCount, 110);
  assert.equal(corpusState.counterbalance.pass, true);

  const verifiedAt = "2026-07-14T12:00:00+09:00";
  const qualification = language => ({
    language,
    basis: "professional",
    verifiedBy: "evaluation-owner-01",
    verifiedAt
  });
  const reviewer = (reviewerId, reviewerLanguages) => ({
    reviewerId,
    qualifications: reviewerLanguages.map(qualification)
  });
  const qualificationSet = {
    schemaVersion: 1,
    qualificationSetId: "reviewer-qualifications:synthetic-v1",
    verifiedAt,
    reviewers: [
      reviewer("evaluation-reviewer-a", ["en", "ko", "zh"]),
      reviewer("evaluation-reviewer-b", ["en", "ko", "zh"]),
      reviewer("reviewer-ko-01", ["ko"]),
      reviewer("reviewer-ko-02", ["ko"]),
      reviewer("reviewer-zh-01", ["zh"]),
      reviewer("reviewer-zh-02", ["zh"])
    ]
  };
  validateReviewerQualificationSet(qualificationSet);
  const rating = (score, languagesForPair) => ({
    heroClarity: score,
    semanticPlausibility: score,
    legibility: score,
    visualInterest: score,
    lexicalNaturalnessByLanguage: Object.fromEntries(languagesForPair.map(language => [language, score]))
  });
  const resultFor = (pair, reviewerId) => {
    const candidateSide = pair.candidateSide;
    const baselineSide = candidateSide === "left" ? "right" : "left";
    const sourceBySide = { [candidateSide]: pair.candidate, [baselineSide]: pair.baseline };
    const ratingsBySide = {
      [candidateSide]: rating(4, pair.candidate.evaluatedLanguages),
      [baselineSide]: rating(3, pair.candidate.evaluatedLanguages)
    };
    const firstReadBySide = {
      [candidateSide]: {
        slotInstanceId: pair.candidate.expectedHeroNode.slotInstanceId,
        lexicalUseId: pair.candidate.expectedHeroNode.lexicalUseId,
        nodeFingerprint: pair.candidate.expectedHeroNode.nodeFingerprint,
        visibleText: "COLLIDING DISPLAY TEXT"
      },
      [baselineSide]: {
        slotInstanceId: pair.baseline.expectedHeroNode.slotInstanceId,
        lexicalUseId: pair.baseline.expectedHeroNode.lexicalUseId,
        nodeFingerprint: pair.baseline.expectedHeroNode.nodeFingerprint,
        visibleText: "COLLIDING DISPLAY TEXT"
      }
    };
    const directoryReviewer = qualificationSet.reviewers.find(item => item.reviewerId === reviewerId);
    return {
      schemaVersion: 1,
      fixtureId: pair.fixtureId,
      reviewerId,
      translationErrorLedgerRevision: corpus.translationErrorLedgerRevision,
      qualificationSnapshot: directoryReviewer.qualifications.filter(item =>
        pair.candidate.evaluatedLanguages.includes(item.language)
      ),
      artifactHashes: {
        left: sourceBySide.left.svg.sha256,
        right: sourceBySide.right.svg.sha256
      },
      ratingsBySide,
      firstReadBySide,
      firstAttentionSide: candidateSide,
      preferenceSide: candidateSide,
      submittedAt: verifiedAt,
      notes: null
    };
  };
  const results = pairs.flatMap(pair => [
    resultFor(pair, "evaluation-reviewer-a"),
    resultFor(pair, "evaluation-reviewer-b")
  ]);
  const collection = {
    schemaVersion: 1,
    corpusId: corpus.corpusId,
    translationErrorLedgerRevision: corpus.translationErrorLedgerRevision,
    results
  };
  validateBlindReviewCollection(collection, corpus, { qualificationSet });
  const evaluationTooling = buildEvaluationToolingEvidence(
    fileURLToPath(repoRoot),
    "blind-evaluation-v1"
  );
  const evaluationClosure = deriveEvaluationToolingClosure(
    fileURLToPath(repoRoot),
    "blind-evaluation-v1"
  );
  assert.deepEqual(
    evaluationTooling.sourceByteHashes.map(row => row.path),
    evaluationClosure
  );
  assert.ok(evaluationClosure.includes("web/micro-graphic-generator/src/svg.js"));
  assert.ok(evaluationClosure.includes("web/micro-graphic-generator/tests/blind-review/review.js"));
  assert.ok(evaluationClosure.includes("web/micro-graphic-generator/fonts/SUIT-Regular.woff2"));
  const report = buildBlindEvaluationReport({
    corpus,
    reviewResults: results,
    translationErrorLedger,
    evaluationTooling,
    lexicalUses,
    reviewerQualificationSet: qualificationSet,
    activeRecipeIds,
    activeMotifIds: motifRegistry.map(record => record.id)
  });
  assert.equal(report.acceptance.pass, true);
  assert.equal(report.preference.candidateSelectionRate, 1);
  assert.ok(report.stratumFirstRead.every(row => row.heroFirstReadMatchRate === 1));
  assert.ok(report.visualCellFirstRead.every(row => row.heroFirstReadMatchRate === 1));
  assert.equal(report.acceptance.translationLedgerQualificationPass, true);

  const visibleTextOnlyMutation = structuredClone(results[0]);
  visibleTextOnlyMutation.firstReadBySide.left.visibleText = "AUDIT TEXT CHANGED";
  assert.doesNotThrow(() => validateBlindReviewResult(
    visibleTextOnlyMutation,
    pairs[0],
    { qualificationSet }
  ));
  const badLanguageMap = structuredClone(results[0]);
  badLanguageMap.ratingsBySide.left.lexicalNaturalnessByLanguage = {};
  assert.throws(() => validateBlindReviewResult(badLanguageMap, pairs[0], { qualificationSet }), /language keys differ/);
  const retroactiveQualification = structuredClone(results[0]);
  retroactiveQualification.qualificationSnapshot[0].verifiedAt = "2026-07-15T12:00:00+09:00";
  assert.throws(
    () => validateBlindReviewResult(retroactiveQualification, pairs[0], { qualificationSet }),
    /verified before review submission/
  );
  const incomplete = buildBlindEvaluationReport({
    corpus,
    reviewResults: [],
    translationErrorLedger,
    evaluationTooling,
    lexicalUses,
    reviewerQualificationSet: qualificationSet,
    activeRecipeIds,
    activeMotifIds: motifRegistry.map(record => record.id)
  });
  assert.equal(incomplete.acceptance.pass, false);
  assert.equal(incomplete.acceptance.reviewerCoveragePass, false);
  const tamperedTooling = structuredClone(evaluationTooling);
  tamperedTooling.sourceByteHashes[0].sha256Hex = "0".repeat(64);
  assert.throws(() => buildBlindEvaluationReport({
    corpus,
    reviewResults: results,
    translationErrorLedger,
    evaluationTooling: tamperedTooling,
    lexicalUses,
    reviewerQualificationSet: qualificationSet,
    activeRecipeIds,
    activeMotifIds: motifRegistry.map(record => record.id)
  }), /content digest mismatch/);

  const ingestionRoot = await mkdtemp(join(tmpdir(), "blind-review-ingestion-"));
  t.after(() => rm(ingestionRoot, { recursive: true, force: true }));
  const ingestionPaths = {
    corpus: join(ingestionRoot, "corpus.json"),
    reviews: join(ingestionRoot, "reviews.json"),
    qualifications: join(ingestionRoot, "qualifications.json"),
    report: join(ingestionRoot, "report.json")
  };
  const ingestionInput = join(ingestionRoot, "result.json");
  await Promise.all([
    writeFile(ingestionPaths.corpus, `${canonicalJson(corpus)}\n`),
    writeFile(ingestionPaths.reviews, `${canonicalJson({
      schemaVersion: 1,
      corpusId: corpus.corpusId,
      translationErrorLedgerRevision: corpus.translationErrorLedgerRevision,
      results: []
    })}\n`),
    writeFile(ingestionPaths.qualifications, `${canonicalJson(qualificationSet)}\n`),
    writeFile(ingestionPaths.report, "{}\n"),
    writeFile(ingestionInput, `${canonicalJson(results[0])}\n`)
  ]);
  await assert.rejects(
    ingestBlindReviewResult({
      inputPath: ingestionInput,
      paths: ingestionPaths,
      evaluationTooling,
      faultAfter: "collection"
    }),
    /blind-ingestion-test-fault:collection/
  );
  assert.ok((await readFile(`${ingestionPaths.reviews}.journal`, "utf8")).includes(results[0].fixtureId));
  const recovered = await ingestBlindReviewResult({
    inputPath: ingestionInput,
    paths: ingestionPaths,
    evaluationTooling
  });
  assert.equal(recovered.recovered, true);
  assert.equal(JSON.parse(await readFile(ingestionPaths.reviews, "utf8")).results.length, 1);
  await assert.rejects(readFile(`${ingestionPaths.reviews}.journal`, "utf8"), { code: "ENOENT" });

  const staleLockPath = join(ingestionRoot, "stale.lock");
  await writeFile(staleLockPath, `${canonicalJson({
    schemaVersion: 1,
    pid: 999_999,
    createdAt: "2000-01-01T00:00:00.000Z",
    transactionId: "abandoned"
  })}\n`);
  const acquired = await acquireReviewIngestionLock(staleLockPath, {
    attempts: 2,
    retryDelayMs: 0,
    transactionId: "replacement"
  });
  assert.equal(acquired.transactionId, "replacement");
  assert.equal(JSON.parse(await readFile(staleLockPath, "utf8")).transactionId, "replacement");
  await rm(staleLockPath, { force: true });
});
