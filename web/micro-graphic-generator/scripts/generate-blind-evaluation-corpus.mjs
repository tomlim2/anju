import { execFile as execFileCallback } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { availableParallelism, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { canonicalJson, hashCanonical, sha256Hex, utf8Bytes } from "../src/canonical-hash.js";
import {
  OWNER_SNAPSHOT_REVISION
} from "../src/composition-owner-snapshot.js";
import { activeRecipeIds } from "../src/composition-recipes.js";
import { motifRegistry } from "../src/motifs.js";
import { lexicalUses, translationErrorLedger } from "../src/vocabulary.js";
import { assertRuntimeConformance } from "../tests/runtime-conformance.mjs";
import {
  blindCorpusPairIdentityRoot,
  blindPairIdentityRevision,
  blindNodeFingerprint,
  buildBlindEvaluationReport,
  validateBlindCorpus,
  validateBlindDisplayManifest,
  validateBlindReviewCollection,
  validateReviewerQualificationSet
} from "./evaluation-model.mjs";
import { selectCompleteBlindCorpus } from "./blind-evaluation-corpus-lib.mjs";
import {
  emptyBlindReviewCollection,
  rebaseEmptyBlindReviewCollection
} from "./blind-review-collection-transition.mjs";
import { startOwnedTestServer } from "./owned-test-server.mjs";
import { buildEvaluationToolingEvidence } from "./evaluation-tooling-evidence.mjs";

const execFile = promisify(execFileCallback);
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const corpusPath = fileURLToPath(new URL("../tests/fixtures/blind-evaluation-corpus.v1.json", import.meta.url));
const reviewsPath = fileURLToPath(new URL("../tests/fixtures/blind-review-results.v1.json", import.meta.url));
const qualificationPath = fileURLToPath(new URL("../tests/fixtures/reviewer-qualifications.v1.json", import.meta.url));
const reportPath = fileURLToPath(new URL("../tests/fixtures/blind-evaluation-report.v1.json", import.meta.url));
const displayManifestPath = fileURLToPath(new URL("../tests/fixtures/blind-evaluation-display.v1.json", import.meta.url));
const scanEvidencePath = fileURLToPath(new URL("../tests/fixtures/blind-evaluation-scan.v1.json", import.meta.url));
const scanEvidenceRepositoryPath = "web/micro-graphic-generator/tests/fixtures/blind-evaluation-scan.v1.json";
const artifactRoot = fileURLToPath(new URL("../tests/artifacts/blind/v1", import.meta.url));
const artifactRepositoryRoot = "web/micro-graphic-generator/tests/artifacts/blind/v1";
let candidateUrl;
let baselineUrl;
const generationTimestamp = "2026-07-14T12:00:00+09:00";
const frozenAt = "2026-07-14T12:00:00+09:00";
const viewport = Object.freeze({ width: 1440, height: 1200 });
const baselineRef = "6e65642";
const baselineAdapterContractVersion = 2;
const baselineAdapterMarker = `baseline-evaluation-adapter:v${baselineAdapterContractVersion}`;
const write = process.argv.includes("--write");
const probe = process.argv.includes("--probe");
const refreshReport = process.argv.includes("--refresh-report");
const requireAcceptance = process.argv.includes("--require-acceptance");
const officialScanLimit = 60_000;
const scanLimitArgument = process.argv.find(argument => argument.startsWith("--scan-limit="));
const scanLimit = scanLimitArgument ? Number(scanLimitArgument.split("=")[1]) : officialScanLimit;
const workerCount = Math.max(1, Math.min(
  Number(process.env.BLIND_EVALUATION_WORKERS || Math.min(8, availableParallelism())),
  scanLimit
));
const baselineAdapterTarget = `      const component = pick(componentTemplates);
      const borderMode = pick(componentBorderModes);`;
const baselineAdapterReplacement = `      const evaluationLayout = window.__BASELINE_EVALUATION_LAYOUT__ || null;
      window.__BASELINE_EVALUATION_ADAPTER__ = "${baselineAdapterMarker}";
      const randomlySelectedComponent = pick(componentTemplates);
      const randomlySelectedBorderMode = pick(componentBorderModes);
      const component = evaluationLayout
        ? componentTemplates.find(item => item.label === \`component \${evaluationLayout.ratio}\`)
        : randomlySelectedComponent;
      if (!component) throw new Error(\`Unsupported evaluation ratio: \${evaluationLayout?.ratio}\`);
      const borderMode = evaluationLayout?.borderMode || randomlySelectedBorderMode;`;
const baselineGeometryTarget = "      const box = fitComponentBox(boardW, boardH, component.ratio, component.scale);";
const baselineGeometryReplacement = `${baselineGeometryTarget}
      const baselineSafeBox = paddedBox(0, 0, box.width, box.height, "large");
      window.__BASELINE_EVALUATION_GEOMETRY__ = {
        viewport: { width: boardW, height: boardH, devicePixelRatio: window.devicePixelRatio || 1 },
        safeBox: {
          x: baselineSafeBox.x,
          y: baselineSafeBox.y,
          width: baselineSafeBox.width,
          height: baselineSafeBox.height
        }
      };`;

assertRuntimeConformance({ playwrightProject: "chromium-http" });
if (!Number.isInteger(scanLimit) || scanLimit < 80) throw new Error("scan limit must be an integer of at least 80");
if ([write, probe, refreshReport].filter(Boolean).length > 1) {
  throw new Error("--write, --probe, and --refresh-report are mutually exclusive");
}
if (write && scanLimit !== officialScanLimit) {
  throw new Error(`official blind corpus writes require exactly ${officialScanLimit} scanned seeds`);
}

const lexicalUseById = new Map(lexicalUses.map(record => [record.id, record]));
const lexicalIdsByTextAndLanguage = new Map();
for (const record of lexicalUses) {
  const key = `${record.language}\u0000${record.text}`;
  if (!lexicalIdsByTextAndLanguage.has(key)) lexicalIdsByTextAndLanguage.set(key, []);
  lexicalIdsByTextAndLanguage.get(key).push(record.id);
}
for (const ids of lexicalIdsByTextAndLanguage.values()) ids.sort();
const scriptsByLanguage = Object.freeze({ en: "latin", ko: "hangul", zh: "han" });
const requiredStratumIds = activeRecipeIds.flatMap(recipeId => ["en", "ko", "zh"].map(language =>
  `${recipeId}/${language}/${scriptsByLanguage[language]}`
));
const activeMotifIds = motifRegistry.map(record => record.id).sort();
const translationErrorLedgerRevision = hashCanonical(translationErrorLedger);
const evaluationTooling = buildEvaluationToolingEvidence(repoRoot, "blind-evaluation-v1");
const requiredVisualCellIds = activeMotifIds.flatMap(motifId =>
  ["requested", "downshifted"].map(finalizationClass => `${motifId}/${finalizationClass}`)
);

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function prepareBaselineArchive() {
  const directory = await mkdtemp(join(tmpdir(), "micro-graphic-baseline-"));
  const archivePath = join(directory, "baseline.tar");
  const treePath = join(directory, "tree");
  await mkdir(treePath);
  const { stdout } = await execFile("git", ["rev-parse", baselineRef], { cwd: repoRoot });
  const baselineCommit = stdout.trim();
  await execFile("git", ["archive", "--format=tar", `--output=${archivePath}`, baselineCommit], { cwd: repoRoot });
  await execFile("tar", ["-xf", archivePath, "-C", treePath]);
  const appPath = join(treePath, "web/micro-graphic-generator/src/app.js");
  const source = await readFile(appPath, "utf8");
  if (!source.includes(baselineAdapterTarget) || !source.includes(baselineGeometryTarget)) {
    throw new Error("baseline adapter target is missing");
  }
  const adaptedSource = source
    .replace(baselineAdapterTarget, baselineAdapterReplacement)
    .replace(baselineGeometryTarget, baselineGeometryReplacement);
  await writeFile(appPath, adaptedSource);
  const adapterRevision = hashCanonical({
    schemaVersion: 1,
    adapterContractVersion: baselineAdapterContractVersion,
    baselineCommit,
    target: baselineAdapterTarget,
    replacement: baselineAdapterReplacement,
    geometryTarget: baselineGeometryTarget,
    geometryReplacement: baselineGeometryReplacement
  });
  return {
    directory,
    treePath,
    baselineCommit,
    adapterRevision,
    baselineRevision: `git:${baselineCommit}+evaluation-adapter:${adapterRevision}`,
    adapterMarker: baselineAdapterMarker
  };
}

async function openEvaluationPage(browser, url, firstSeed, {
  expectedOwnerSnapshotRevision = null,
  expectedAdapterMarker = null
} = {}) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.setDefaultTimeout(0);
  const search = new URLSearchParams({
    test: "1",
    seed: String(firstSeed),
    now: generationTimestamp
  });
  await page.goto(`${url}?${search}`);
  await page.waitForFunction(() => Boolean(window.__MICRO_GRAPHIC_TEST__));
  await page.evaluate(() => window.__MICRO_GRAPHIC_TEST__.ready);
  const loadedIdentity = await page.evaluate(() => ({
    ownerSnapshotRevision: window.__MICRO_GRAPHIC_TEST__.generation?.()?.generationInput?.ownerSnapshotRevision || null,
    adapterMarker: window.__BASELINE_EVALUATION_ADAPTER__ || null
  }));
  if (
    expectedOwnerSnapshotRevision !== null
    && loadedIdentity.ownerSnapshotRevision !== expectedOwnerSnapshotRevision
  ) throw new Error("blind candidate page loaded an unexpected owner snapshot");
  if (expectedAdapterMarker !== null && loadedIdentity.adapterMarker !== expectedAdapterMarker) {
    throw new Error("blind baseline page did not activate the reviewed adapter");
  }
  const grid = page.locator("#grid");
  if (await grid.getAttribute("aria-pressed") === "true") await grid.click();
  await page.addStyleTag({ content: ".controls,.seed{display:none!important}" });
  return { page, errors };
}

async function scanCandidateWorker(browser, seeds) {
  const { page, errors } = await openEvaluationPage(browser, candidateUrl, seeds[0], {
    expectedOwnerSnapshotRevision: OWNER_SNAPSHOT_REVISION
  });
  const records = [];
  for (let offset = 0; offset < seeds.length; offset += 50) {
    const batch = seeds.slice(offset, offset + 50);
    const rows = await page.evaluate(batchSeeds => batchSeeds.map(seed => {
      const hook = window.__MICRO_GRAPHIC_TEST__;
      hook.renderSeed(seed);
      const generation = hook.generation();
      const accepted = hook.telemetry().find(event => event.population === "accepted-output") || null;
      if (!generation || generation.planningFailure || !accepted) return null;
      const component = document.querySelector("svg[data-component]");
      if (!component) return null;
      const hero = component.querySelector('[data-composition-role="hero"][data-lexical-use]');
      const motif = accepted.motifId
        ? component.querySelector(`[data-motif-id="${accepted.motifId}"]`)
        : null;
      if (!hero || (accepted.motifId && !motif)) return null;
      const lexicalUseIds = [...component.querySelectorAll('[data-token-source-kind="lexical"][data-lexical-use]')]
        .map(node => node.getAttribute("data-lexical-use"));
      return {
        seed,
        generationInput: generation.generationInput,
        recipeId: accepted.recipeId,
        heroLanguage: accepted.heroLanguage,
        heroScript: accepted.heroScript,
        heroLexicalUseId: accepted.heroLexicalUseId,
        motifId: accepted.motifId,
        heroFinalizationClass: accepted.heroFinalizationClass,
        ratio: generation.generationInput.ratio,
        borderMode: generation.generationInput.borderMode,
        lexicalUseIds
      };
    }), batch);
    records.push(...rows.filter(Boolean));
  }
  await page.close();
  if (errors.length) throw new Error(`candidate browser errors: ${errors.join(" | ")}`);
  return records;
}

function inferCandidateLanguages(record) {
  const languages = [...new Set(record.lexicalUseIds.map(id => {
    const lexicalUse = lexicalUseById.get(id);
    if (!lexicalUse) throw new Error(`candidate references unknown lexical use ${id}`);
    return lexicalUse.language;
  }))].sort(compareStrings);
  return {
    ...record,
    evaluatedLanguages: languages,
    stratumId: `${record.recipeId}/${record.heroLanguage}/${record.heroScript}`,
    visualCellId: record.motifId ? `${record.motifId}/${record.heroFinalizationClass}` : null
  };
}

async function scanCandidates(browser) {
  const seedsByWorker = Array.from({ length: workerCount }, () => []);
  for (let seed = 0; seed < scanLimit; seed += 1) seedsByWorker[seed % workerCount].push(seed);
  const rows = (await Promise.all(
    seedsByWorker.filter(seeds => seeds.length).map(seeds => scanCandidateWorker(browser, seeds))
  )).flat().map(inferCandidateLanguages);
  return rows.sort((left, right) => left.seed - right.seed);
}

async function scanBaselineWorker(browser, candidateRows) {
  const { page, errors } = await openEvaluationPage(browser, baselineUrl, candidateRows[0].seed, {
    expectedAdapterMarker: baselineAdapterMarker
  });
  const records = [];
  for (let offset = 0; offset < candidateRows.length; offset += 50) {
    const batch = candidateRows.slice(offset, offset + 50);
    const rows = await page.evaluate(items => items.map(item => {
      window.__BASELINE_EVALUATION_LAYOUT__ = { ratio: item.ratio, borderMode: item.borderMode };
      const hook = window.__MICRO_GRAPHIC_TEST__;
      const snapshot = hook.renderSeed(item.seed);
      if (snapshot.fingerprint.componentRatio !== item.ratio || snapshot.fingerprint.borderMode !== item.borderMode) {
        throw new Error(`baseline layout injection failed for seed ${item.seed}`);
      }
      const component = document.querySelector("svg[data-component]");
      if (!component) return null;
      const replayGeometry = window.__BASELINE_EVALUATION_GEOMETRY__;
      if (!replayGeometry?.viewport || !replayGeometry?.safeBox) {
        throw new Error(`baseline geometry capture failed for seed ${item.seed}`);
      }
      const sizeRank = { small: 0, medium: 1, large: 2, xlarge: 3, xxlarge: 4, xxxlarge: 5 };
      function languageFor(text, typeface) {
        if (typeface === "korean") return "ko";
        if (typeface === "chinese" || typeface === "hanja") return "zh";
        if (typeface === "english") return "en";
        if (/\p{Script=Hangul}/u.test(text)) return "ko";
        if (/\p{Script=Han}/u.test(text)) return "zh";
        if (/\p{Script=Latin}/u.test(text)) return "en";
        return null;
      }
      const typography = [...component.querySelectorAll('text[data-token-form="typography"]')]
        .map((textNode, index) => {
          const text = (textNode.textContent || "").trim();
          const language = languageFor(text, textNode.getAttribute("data-token-typeface"));
          if (!language || !/\p{L}/u.test(text)) return null;
          const token = textNode.closest("[data-grid-token]");
          const box = textNode.getBBox();
          return {
            index,
            text,
            language,
            tokenSize: textNode.getAttribute("data-token-size") || token?.getAttribute("data-token-size") || "small",
            fontSize: Number(textNode.getAttribute("font-size") || 0),
            paintedArea: Math.max(0, box.width) * Math.max(0, box.height)
          };
        })
        .filter(Boolean);
      if (!typography.length) return null;
      typography.sort((left, right) =>
        (sizeRank[right.tokenSize] || 0) - (sizeRank[left.tokenSize] || 0)
        || right.fontSize - left.fontSize
        || right.paintedArea - left.paintedArea
        || left.index - right.index
      );
      const hero = typography.find(record => record.language === item.heroLanguage) || null;
      if (!hero) return null;
      const evaluatedLanguages = [...new Set(typography.map(record => record.language))].sort();
      return {
        seed: item.seed,
        heroIndex: hero.index,
        heroLanguage: hero.language,
        typography,
        evaluatedLanguages,
        replayGeometry
      };
    }), batch);
    records.push(...rows.filter(Boolean));
  }
  await page.close();
  if (errors.length) throw new Error(`baseline browser errors: ${errors.join(" | ")}`);
  return records;
}

function lexicalIdForBaseline(record, ordinal) {
  const key = `${record.language}\u0000${record.text}`;
  const approved = lexicalIdsByTextAndLanguage.get(key)?.[0];
  if (approved) return approved;
  return `evaluation.${record.language}.${hashCanonical({ text: record.text, ordinal }).slice("sha256:".length, 20)}`;
}

async function scanEligibleBaselines(browser, candidateRows) {
  const rowsByWorker = Array.from({ length: workerCount }, () => []);
  candidateRows.forEach((row, index) => rowsByWorker[index % workerCount].push(row));
  const baselineRows = (await Promise.all(
    rowsByWorker.filter(rows => rows.length).map(rows => scanBaselineWorker(browser, rows))
  )).flat();
  const baselineBySeed = new Map(baselineRows.map(row => [row.seed, row]));
  const diagnostics = {
    noComparableBaseline: 0,
    heroLanguageMismatch: 0,
    evaluatedLanguageMismatch: 0,
    eligible: 0
  };
  const eligible = candidateRows.flatMap(candidate => {
    const baseline = baselineBySeed.get(candidate.seed);
    if (!baseline) {
      diagnostics.noComparableBaseline += 1;
      return [];
    }
    if (baseline.heroLanguage !== candidate.heroLanguage) {
      diagnostics.heroLanguageMismatch += 1;
      return [];
    }
    if (!sameArray(baseline.evaluatedLanguages, candidate.evaluatedLanguages)) {
      diagnostics.evaluatedLanguageMismatch += 1;
      return [];
    }
    const assignments = baseline.typography
      .sort((left, right) => left.index - right.index)
      .map((record, ordinal) => ({
        index: record.index,
        slotInstanceId: `evaluation-lexical-${ordinal + 1}`,
        lexicalUseId: lexicalIdForBaseline(record, ordinal),
        language: record.language,
        text: record.text
      }));
    const heroAssignment = assignments.find(record => record.index === baseline.heroIndex);
    diagnostics.eligible += 1;
    return [{
      ...candidate,
      baselineAssignments: assignments,
      baselineHeroAssignment: heroAssignment,
      baselineReplayGeometry: baseline.replayGeometry
    }];
  }).sort((left, right) => left.seed - right.seed);
  return { eligible, diagnostics };
}

function coverageSummary(rows) {
  return {
    scanLimit,
    candidateRows: rows.candidates.length,
    baselineEligibleRows: rows.eligible.length,
    baselineEligibility: rows.eligibilityDiagnostics,
    candidateVisualCells: Object.fromEntries(requiredVisualCellIds.map(id => [
      id,
      rows.candidates.filter(row => row.visualCellId === id).length
    ])),
    candidateStrata: Object.fromEntries(requiredStratumIds.map(id => [
      id,
      rows.candidates.filter(row => row.stratumId === id).length
    ])),
    visualCells: Object.fromEntries(requiredVisualCellIds.map(id => [
      id,
      rows.eligible.filter(row => row.visualCellId === id).length
    ])),
    strata: Object.fromEntries(requiredStratumIds.map(id => [
      id,
      rows.eligible.filter(row => row.stratumId === id).length
    ]))
  };
}

function selectedScanRows(selected) {
  return selected.map(row => ({
    fixtureId: row.fixtureId,
    seed: row.seed,
    stratumId: row.stratumId,
    visualCellId: row.visualCellId,
    candidateSide: row.candidateSide
  }));
}

function buildScanEvidence({ baseline, candidates, eligible, summary, selected, candidateRevision }) {
  const selectionRows = selectedScanRows(selected);
  const payload = {
    schemaVersion: 1,
    scanContract: {
      seedStartInclusive: 0,
      seedEndExclusive: officialScanLimit,
      generationTimestamp,
      viewport,
      requiredStratumIds,
      requiredVisualCellIds
    },
    baselineRevision: baseline.baselineRevision,
    baselineAdapterRevision: baseline.adapterRevision,
    candidateRevision,
    ownerSnapshotRevision: OWNER_SNAPSHOT_REVISION,
    candidateRows: {
      count: candidates.length,
      revision: hashCanonical(candidates)
    },
    baselineEligibleRows: {
      count: eligible.length,
      revision: hashCanonical(eligible)
    },
    coverage: summary,
    selectionRows,
    selectionRevision: hashCanonical(selectionRows)
  };
  return {
    ...payload,
    scanEvidenceRevision: hashCanonical(payload)
  };
}

function artifactTextForRepository(text) {
  return text.replace(
    /@import url\("https?:\/\/[^"\n]+\/web\/micro-graphic-generator\/fonts\/fonts\.css"\)/,
    '@import url("../../../../fonts/fonts.css")'
  );
}

async function sanitizeReviewArtifact(page, rawText, sourceHero) {
  return page.evaluate(({ text, expectedHero }) => {
    const documentNode = new DOMParser().parseFromString(text, "image/svg+xml");
    const root = documentNode.documentElement;
    const component = root.querySelector("svg[data-component]");
    if (!component) throw new Error("review artifact has no component root");
    const identityNodes = [...root.querySelectorAll("[data-message-slot][data-lexical-use]")];
    const aliasBySourceIdentity = new Map();
    for (const node of identityNodes) {
      const sourceIdentity = `${node.getAttribute("data-message-slot")}\u0000${node.getAttribute("data-lexical-use")}`;
      if (!aliasBySourceIdentity.has(sourceIdentity)) {
        const ordinal = aliasBySourceIdentity.size + 1;
        aliasBySourceIdentity.set(sourceIdentity, {
          slotInstanceId: `review-node-${String(ordinal).padStart(3, "0")}`,
          lexicalUseId: `review-lexical-${String(ordinal).padStart(3, "0")}`
        });
      }
      const alias = aliasBySourceIdentity.get(sourceIdentity);
      node.setAttribute("data-message-slot", alias.slotInstanceId);
      node.setAttribute("data-lexical-use", alias.lexicalUseId);
      node.setAttribute("data-visible-text", (node.getAttribute("data-visible-text") || node.textContent || "").trim());
    }
    const heroSourceIdentity = `${expectedHero.slotInstanceId}\u0000${expectedHero.lexicalUseId}`;
    const heroAlias = aliasBySourceIdentity.get(heroSourceIdentity);
    if (!heroAlias) throw new Error("review artifact hero has no neutral identity");
    const hero = identityNodes.find(node =>
      node.localName === "text"
      && node.getAttribute("data-message-slot") === heroAlias.slotInstanceId
      && node.getAttribute("data-lexical-use") === heroAlias.lexicalUseId
    ) || identityNodes.find(node =>
      node.getAttribute("data-message-slot") === heroAlias.slotInstanceId
      && node.getAttribute("data-lexical-use") === heroAlias.lexicalUseId
    );
    const allowedDataAttributes = new Set([
      "data-review-component", "data-message-slot", "data-lexical-use", "data-visible-text"
    ]);
    for (const element of [root, ...root.querySelectorAll("*")]) {
      for (const attribute of [...element.attributes]) {
        if (attribute.name.startsWith("data-") && !allowedDataAttributes.has(attribute.name)) {
          element.removeAttribute(attribute.name);
        }
      }
    }
    component.setAttribute("data-review-component", "true");
    function ordinalPath(node) {
      const indices = [];
      let current = node;
      while (current && current !== root) {
        const parent = current.parentElement;
        if (!parent) throw new Error("review hero is outside artifact root");
        indices.push([...parent.children].indexOf(current));
        current = parent;
      }
      if (current !== root) throw new Error("review hero path has no root");
      return `0.${indices.reverse().join(".")}`;
    }
    return {
      text: new XMLSerializer().serializeToString(root),
      expectedHero: {
        slotInstanceId: heroAlias.slotInstanceId,
        lexicalUseId: heroAlias.lexicalUseId,
        rootToNodeOrdinalPath: ordinalPath(hero),
        visibleText: expectedHero.visibleText
      }
    };
  }, { text: rawText, expectedHero: sourceHero });
}

async function candidateCapture(page, selected) {
  const capture = await page.evaluate(({ seed, motifId, heroLexicalUseId }) => {
    const hook = window.__MICRO_GRAPHIC_TEST__;
    hook.renderSeed(seed);
    const generation = hook.generation();
    const accepted = hook.telemetry().find(event => event.population === "accepted-output") || null;
    if (!generation || !accepted) throw new Error(`candidate seed ${seed} did not accept`);
    if (accepted.motifId !== motifId || accepted.heroLexicalUseId !== heroLexicalUseId) {
      throw new Error(`candidate seed ${seed} drifted from the frozen scan result`);
    }
    const artifact = hook.svgArtifact();
    const documentNode = new DOMParser().parseFromString(artifact.text, "image/svg+xml");
    const root = documentNode.documentElement;
    const heroToken = root.querySelector(`[data-composition-role="hero"][data-lexical-use="${heroLexicalUseId}"]`);
    const hero = heroToken?.querySelector("text[data-message-slot][data-lexical-use]") || heroToken;
    if (!hero) throw new Error(`candidate seed ${seed} has no serialized hero node`);
    function ordinalPath(node) {
      const indices = [];
      let current = node;
      while (current && current !== root) {
        const parent = current.parentElement;
        if (!parent) throw new Error("candidate hero is outside artifact root");
        indices.push([...parent.children].indexOf(current));
        current = parent;
      }
      if (current !== root) throw new Error("candidate hero path has no root");
      return `0.${indices.reverse().join(".")}`;
    }
    const component = root.querySelector("svg[data-component]");
    const motifNodes = [...component.querySelectorAll("[data-motif-id]")];
    if (
      (motifId && (motifNodes.length !== 1 || motifNodes[0].getAttribute("data-motif-id") !== motifId))
      || (!motifId && motifNodes.length !== 0)
    ) {
      throw new Error(`candidate seed ${seed} motif identity mismatch`);
    }
    return {
      text: artifact.text,
      fingerprint: artifact.structuralFingerprint,
      generationInput: generation.generationInput,
      expectedHero: {
        slotInstanceId: hero.getAttribute("data-message-slot"),
        lexicalUseId: hero.getAttribute("data-lexical-use"),
        rootToNodeOrdinalPath: ordinalPath(hero),
        visibleText: hero.getAttribute("data-visible-text") || hero.textContent.trim()
      }
    };
  }, selected);
  const png = await page.screenshot({ type: "png", fullPage: false });
  const sanitized = await sanitizeReviewArtifact(page, capture.text, capture.expectedHero);
  return { ...capture, ...sanitized, text: artifactTextForRepository(sanitized.text), png };
}

async function baselineCapture(page, selected) {
  const capture = await page.evaluate(item => {
    window.__BASELINE_EVALUATION_LAYOUT__ = { ratio: item.ratio, borderMode: item.borderMode };
    const hook = window.__MICRO_GRAPHIC_TEST__;
    const snapshot = hook.renderSeed(item.seed);
    if (snapshot.fingerprint.componentRatio !== item.ratio || snapshot.fingerprint.borderMode !== item.borderMode) {
      throw new Error(`baseline seed ${item.seed} layout drifted`);
    }
    const component = document.querySelector("svg[data-component]");
    const replayGeometry = window.__BASELINE_EVALUATION_GEOMETRY__;
    if (
      !replayGeometry
      || JSON.stringify(replayGeometry) !== JSON.stringify(item.baselineReplayGeometry)
    ) throw new Error(`baseline seed ${item.seed} replay geometry drifted`);
    const textNodes = [...component.querySelectorAll('text[data-token-form="typography"]')];
    for (const assignment of item.baselineAssignments) {
      const textNode = textNodes[assignment.index];
      const token = textNode?.closest("[data-grid-token]");
      if (!textNode || !token || textNode.textContent.trim() !== assignment.text) {
        throw new Error(`baseline seed ${item.seed} typography assignment drifted`);
      }
      for (const node of [token, textNode]) {
        node.setAttribute("data-message-slot", assignment.slotInstanceId);
        node.setAttribute("data-lexical-use", assignment.lexicalUseId);
      }
    }
    const artifactText = hook.svgText();
    const documentNode = new DOMParser().parseFromString(artifactText, "image/svg+xml");
    const root = documentNode.documentElement;
    const heroToken = root.querySelector(
      `[data-message-slot="${item.baselineHeroAssignment.slotInstanceId}"]`
      + `[data-lexical-use="${item.baselineHeroAssignment.lexicalUseId}"]`
    );
    const hero = heroToken?.querySelector("text[data-message-slot][data-lexical-use]") || heroToken;
    if (!hero) throw new Error(`baseline seed ${item.seed} has no serialized hero node`);
    function ordinalPath(node) {
      const indices = [];
      let current = node;
      while (current && current !== root) {
        const parent = current.parentElement;
        if (!parent) throw new Error("baseline hero is outside artifact root");
        indices.push([...parent.children].indexOf(current));
        current = parent;
      }
      if (current !== root) throw new Error("baseline hero path has no root");
      return `0.${indices.reverse().join(".")}`;
    }
    return {
      text: artifactText,
      replayGeometry,
      expectedHero: {
        slotInstanceId: item.baselineHeroAssignment.slotInstanceId,
        lexicalUseId: item.baselineHeroAssignment.lexicalUseId,
        rootToNodeOrdinalPath: ordinalPath(hero),
        visibleText: item.baselineHeroAssignment.text
      }
    };
  }, selected);
  const png = await page.screenshot({ type: "png", fullPage: false });
  const sanitized = await sanitizeReviewArtifact(page, capture.text, capture.expectedHero);
  return { ...capture, ...sanitized, text: artifactTextForRepository(sanitized.text), png };
}

async function fingerprintSerializedComponent(candidatePage, svgText) {
  return candidatePage.evaluate(async text => {
    const { svgStructuralFingerprint } = await import("./src/svg.js");
    const documentNode = new DOMParser().parseFromString(text, "image/svg+xml");
    const component = documentNode.querySelector('svg[data-review-component="true"]');
    if (!component) throw new Error("serialized baseline has no component root");
    return svgStructuralFingerprint(component);
  }, svgText);
}

function fixtureIdFor(index) {
  return `blind-${String(index + 1).padStart(3, "0")}`;
}

function artifactDescriptor(fixtureId, displaySide, extension, bytes) {
  const filename = `${fixtureId}.${displaySide}.${extension}`;
  return {
    absolutePath: join(artifactRoot, filename),
    descriptor: {
      path: `${artifactRepositoryRoot}/${filename}`,
      sha256: `sha256:${sha256Hex(bytes)}`,
      byteLength: bytes.byteLength
    }
  };
}

function expectedHeroNode(capture, artifactSha256, language) {
  return {
    slotInstanceId: capture.expectedHero.slotInstanceId,
    lexicalUseId: capture.expectedHero.lexicalUseId,
    language,
    script: scriptsByLanguage[language],
    nodeFingerprint: blindNodeFingerprint({
      artifactSha256,
      rootToNodeOrdinalPath: capture.expectedHero.rootToNodeOrdinalPath,
      slotInstanceId: capture.expectedHero.slotInstanceId,
      lexicalUseId: capture.expectedHero.lexicalUseId
    }),
    rootToNodeOrdinalPath: capture.expectedHero.rootToNodeOrdinalPath,
    visibleText: capture.expectedHero.visibleText
  };
}

async function capturePair(pagePair, row, context) {
  const candidate = await candidateCapture(pagePair.candidate, row);
  const baseline = await baselineCapture(pagePair.baseline, row);
  const baselineFingerprint = await fingerprintSerializedComponent(pagePair.candidate, baseline.text);
  const candidateFingerprint = await fingerprintSerializedComponent(pagePair.candidate, candidate.text);
  const candidateSvgBytes = utf8Bytes(candidate.text);
  const baselineSvgBytes = utf8Bytes(baseline.text);
  const candidateDisplaySide = row.candidateSide;
  const baselineDisplaySide = candidateDisplaySide === "left" ? "right" : "left";
  const files = {
    candidateSvg: artifactDescriptor(row.fixtureId, candidateDisplaySide, "svg", candidateSvgBytes),
    candidatePng: artifactDescriptor(row.fixtureId, candidateDisplaySide, "png", candidate.png),
    baselineSvg: artifactDescriptor(row.fixtureId, baselineDisplaySide, "svg", baselineSvgBytes),
    baselinePng: artifactDescriptor(row.fixtureId, baselineDisplaySide, "png", baseline.png)
  };
  await Promise.all([
    writeFile(files.candidateSvg.absolutePath, candidateSvgBytes),
    writeFile(files.candidatePng.absolutePath, candidate.png),
    writeFile(files.baselineSvg.absolutePath, baselineSvgBytes),
    writeFile(files.baselinePng.absolutePath, baseline.png)
  ]);
  const baselineReplayInput = {
    schemaVersion: 1,
    seed: candidate.generationInput.seed,
    generationTimestamp: candidate.generationInput.generationTimestamp,
    ratio: candidate.generationInput.ratio,
    borderMode: candidate.generationInput.borderMode,
    viewport: baseline.replayGeometry.viewport,
    safeBox: baseline.replayGeometry.safeBox,
    baselineCommit: context.baselineCommit,
    adapterContractVersion: baselineAdapterContractVersion,
    adapterRevision: context.adapterRevision
  };
  const candidateExpectedHero = expectedHeroNode(
    candidate,
    files.candidateSvg.descriptor.sha256,
    row.heroLanguage
  );
  const baselineExpectedHero = expectedHeroNode(
    baseline,
    files.baselineSvg.descriptor.sha256,
    row.heroLanguage
  );
  const pair = {
    schemaVersion: 1,
    fixtureId: row.fixtureId,
    stratum: {
      recipeId: row.recipeId,
      heroLanguage: row.heroLanguage,
      heroScript: row.heroScript
    },
    visualHierarchyCell: row.motifId ? {
      motifId: row.motifId,
      heroFinalizationClass: row.heroFinalizationClass
    } : null,
    candidateSide: row.candidateSide,
    baseline: {
      revision: context.baselineRevision,
      evaluatedLanguages: row.evaluatedLanguages,
      replayInput: baselineReplayInput,
      viewportSafeBoxBasis: "captured-from-baseline-runtime",
      fingerprint: baselineFingerprint,
      expectedHeroNode: baselineExpectedHero,
      svg: files.baselineSvg.descriptor,
      png: files.baselinePng.descriptor
    },
    candidate: {
      revision: context.candidateRevision,
      evaluatedLanguages: row.evaluatedLanguages,
      generationInput: candidate.generationInput,
      viewportSafeBoxBasis: "captured-in-generation-input",
      fingerprint: candidateFingerprint,
      expectedHeroNode: candidateExpectedHero,
      svg: files.candidateSvg.descriptor,
      png: files.candidatePng.descriptor
    }
  };
  return {
    ...pair,
    identityRevision: blindPairIdentityRevision(pair)
  };
}

async function openCapturePair(browser, row) {
  const candidate = await openEvaluationPage(browser, candidateUrl, row.seed, {
    expectedOwnerSnapshotRevision: OWNER_SNAPSHOT_REVISION
  });
  const baseline = await openEvaluationPage(browser, baselineUrl, row.seed, {
    expectedAdapterMarker: baselineAdapterMarker
  });
  return {
    candidate: candidate.page,
    baseline: baseline.page,
    errorSources: [candidate.errors, baseline.errors]
  };
}

async function captureWorker(browser, rows, context) {
  const pages = await openCapturePair(browser, rows[0]);
  const pairs = [];
  try {
    for (const row of rows) pairs.push(await capturePair(pages, row, context));
  } finally {
    await Promise.all([pages.candidate.close(), pages.baseline.close()]);
  }
  const errors = pages.errorSources.flat();
  if (errors.length) throw new Error(`blind artifact browser errors: ${errors.join(" | ")}`);
  return pairs;
}

async function captureCorpus(browser, selectedRows, context) {
  await rm(artifactRoot, { recursive: true, force: true });
  await mkdir(artifactRoot, { recursive: true });
  const captureWorkers = Math.min(4, workerCount, selectedRows.length);
  const rowsByWorker = Array.from({ length: captureWorkers }, () => []);
  selectedRows.forEach((row, index) => rowsByWorker[index % captureWorkers].push(row));
  return (await Promise.all(rowsByWorker.map(rows => captureWorker(browser, rows, context))))
    .flat()
    .sort((left, right) => compareStrings(left.fixtureId, right.fixtureId));
}

function displayManifest(corpus) {
  const manifest = {
    schemaVersion: 1,
    corpusId: corpus.corpusId,
    corpusSha256: hashCanonical(corpus),
    translationErrorLedgerRevision: corpus.translationErrorLedgerRevision,
    frozenAt: corpus.frozenAt,
    fixtures: corpus.pairs.map(pair => {
      const sideSources = pair.candidateSide === "left"
        ? { left: pair.candidate, right: pair.baseline }
        : { left: pair.baseline, right: pair.candidate };
      return {
        fixtureId: pair.fixtureId,
        evaluatedLanguages: pair.candidate.evaluatedLanguages,
        left: {
          fingerprint: sideSources.left.fingerprint,
          svg: sideSources.left.svg,
          png: sideSources.left.png
        },
        right: {
          fingerprint: sideSources.right.fingerprint,
          svg: sideSources.right.svg,
          png: sideSources.right.png
        }
      };
    })
  };
  validateBlindDisplayManifest(manifest, { corpus });
  return manifest;
}

async function readQualificationSet() {
  try {
    const qualificationSet = JSON.parse(await readFile(qualificationPath, "utf8"));
    validateReviewerQualificationSet(qualificationSet);
    return qualificationSet;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        schemaVersion: 1,
        qualificationSetId: "reviewer-qualifications:v1:pending",
        verifiedAt: frozenAt,
        reviewers: []
      };
    }
    throw error;
  }
}

async function readReviewCollection(corpus, qualificationSet, { allowEmptyRebase = false } = {}) {
  try {
    const collection = JSON.parse(await readFile(reviewsPath, "utf8"));
    try {
      validateBlindReviewCollection(collection, corpus, { qualificationSet });
    } catch (error) {
      if (allowEmptyRebase) return rebaseEmptyBlindReviewCollection(collection, corpus);
      throw error;
    }
    return collection;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return emptyBlindReviewCollection(corpus);
    }
    throw error;
  }
}

async function verifyArtifactBytes(corpus) {
  for (const pair of corpus.pairs) {
    for (const source of ["baseline", "candidate"]) {
      for (const kind of ["svg", "png"]) {
        const descriptor = pair[source][kind];
        const bytes = await readFile(join(repoRoot, descriptor.path));
        const digest = `sha256:${sha256Hex(bytes)}`;
        if (digest !== descriptor.sha256) {
          throw new Error(`${pair.fixtureId} ${source} ${kind} byte digest mismatch`);
        }
        if (bytes.byteLength !== descriptor.byteLength) {
          throw new Error(`${pair.fixtureId} ${source} ${kind} byte length mismatch`);
        }
      }
    }
  }
}

async function verifyScanEvidence(corpus) {
  const descriptor = corpus.scanEvidence;
  if (descriptor.path !== scanEvidenceRepositoryPath) {
    throw new Error("blind scan evidence path differs from the official artifact");
  }
  const bytes = await readFile(join(repoRoot, descriptor.path));
  if (`sha256:${sha256Hex(bytes)}` !== descriptor.sha256 || bytes.byteLength !== descriptor.byteLength) {
    throw new Error("blind scan evidence byte identity mismatch");
  }
  const evidence = JSON.parse(bytes.toString("utf8"));
  const { scanEvidenceRevision, ...payload } = evidence;
  if (scanEvidenceRevision !== descriptor.revision || hashCanonical(payload) !== scanEvidenceRevision) {
    throw new Error("blind scan evidence content revision mismatch");
  }
  if (
    evidence.schemaVersion !== 1
    || evidence.scanContract?.seedStartInclusive !== 0
    || evidence.scanContract?.seedEndExclusive !== officialScanLimit
    || evidence.coverage?.scanLimit !== officialScanLimit
  ) throw new Error("blind scan evidence is not an official complete scan");
  if (
    evidence.baselineRevision !== corpus.baselineRevision
    || evidence.candidateRevision !== corpus.candidateRevision
    || evidence.ownerSnapshotRevision !== OWNER_SNAPSHOT_REVISION
  ) throw new Error("blind scan evidence release identity mismatch");
  const corpusSelectionRows = corpus.pairs.map(pair => ({
    fixtureId: pair.fixtureId,
    seed: pair.candidate.generationInput.seed,
    stratumId: `${pair.stratum.recipeId}/${pair.stratum.heroLanguage}/${pair.stratum.heroScript}`,
    visualCellId: pair.visualHierarchyCell
      ? `${pair.visualHierarchyCell.motifId}/${pair.visualHierarchyCell.heroFinalizationClass}`
      : null,
    candidateSide: pair.candidateSide
  }));
  if (canonicalJson(evidence.selectionRows) !== canonicalJson(corpusSelectionRows)) {
    throw new Error("blind corpus pairs differ from complete-scan selection evidence");
  }
}

async function verifyFrozenCorpus() {
  const [corpus, display, report] = await Promise.all([
    readFile(corpusPath, "utf8").then(text => JSON.parse(text)),
    readFile(displayManifestPath, "utf8").then(text => JSON.parse(text)),
    readFile(reportPath, "utf8").then(text => JSON.parse(text))
  ]);
  validateBlindCorpus(corpus, { activeRecipeIds, activeMotifIds });
  await verifyScanEvidence(corpus);
  await verifyArtifactBytes(corpus);
  const qualificationSet = await readQualificationSet();
  const reviews = await readReviewCollection(corpus, qualificationSet);
  const expectedReport = buildBlindEvaluationReport({
    corpus,
    reviewResults: reviews.results,
    translationErrorLedger,
    evaluationTooling,
    lexicalUses,
    reviewerQualificationSet: qualificationSet,
    activeRecipeIds,
    activeMotifIds
  });
  if (canonicalJson(display) !== canonicalJson(displayManifest(corpus))) {
    throw new Error("blind evaluation display manifest is stale");
  }
  if (canonicalJson(report) !== canonicalJson(expectedReport)) {
    if (!refreshReport) throw new Error("blind evaluation report is stale");
    await writeFile(reportPath, `${JSON.stringify(expectedReport, null, 2)}\n`);
  }
  if (requireAcceptance && !expectedReport.acceptance.pass) {
    throw new Error("blind human acceptance gate is pending");
  }
  process.stdout.write(
    `${refreshReport ? "refreshed report for" : "verified"} blind corpus ${corpus.corpusId}; `
    + `human gate: ${expectedReport.acceptance.pass ? "pass" : "pending"}\n`
  );
}

async function generateFrozenCorpus() {
  const baseline = await prepareBaselineArchive();
  let candidateServer;
  let baselineServer;
  let browser;
  try {
    candidateServer = await startOwnedTestServer({ repoRoot });
    baselineServer = await startOwnedTestServer({ repoRoot, root: baseline.treePath });
    candidateUrl = candidateServer.url("/web/micro-graphic-generator/");
    baselineUrl = baselineServer.url("/web/micro-graphic-generator/");
    await Promise.all([candidateServer.assertOwner(), baselineServer.assertOwner()]);
    browser = await chromium.launch();
    const candidates = await scanCandidates(browser);
    const baselineScan = await scanEligibleBaselines(browser, candidates);
    const eligible = baselineScan.eligible;
    const summary = coverageSummary({
      candidates,
      eligible,
      eligibilityDiagnostics: baselineScan.diagnostics
    });
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    const selected = selectCompleteBlindCorpus(eligible, {
      stratumIds: requiredStratumIds,
      visualCellIds: requiredVisualCellIds
    }).map((row, index) => ({ ...row, fixtureId: fixtureIdFor(index) }));
    if (probe) {
      process.stdout.write(`${JSON.stringify({ selectedPairCount: selected.length }, null, 2)}\n`);
      return;
    }
    if (!write) throw new Error("generation requires --write; use no flags to verify frozen artifacts");
    const candidateRevision = `owner:${OWNER_SNAPSHOT_REVISION}`;
    const scanEvidence = buildScanEvidence({
      baseline,
      candidates,
      eligible,
      summary,
      selected,
      candidateRevision
    });
    const scanEvidenceBytes = utf8Bytes(`${JSON.stringify(scanEvidence, null, 2)}\n`);
    const scanEvidenceDescriptor = {
      path: scanEvidenceRepositoryPath,
      sha256: `sha256:${sha256Hex(scanEvidenceBytes)}`,
      byteLength: scanEvidenceBytes.byteLength,
      revision: scanEvidence.scanEvidenceRevision
    };
    const pairs = await captureCorpus(browser, selected, {
      baselineRevision: baseline.baselineRevision,
      baselineCommit: baseline.baselineCommit,
      adapterRevision: baseline.adapterRevision,
      candidateRevision
    });
    const pairIdentityRoot = blindCorpusPairIdentityRoot(pairs);
    const corpus = {
      schemaVersion: 1,
      corpusId: `blind-evaluation:v1:${pairIdentityRoot.slice("sha256:".length, 25)}`,
      frozenAt,
      baselineRevision: baseline.baselineRevision,
      candidateRevision,
      translationErrorLedgerRevision,
      scanEvidence: scanEvidenceDescriptor,
      pairIdentityRoot,
      pairs
    };
    validateBlindCorpus(corpus, { activeRecipeIds, activeMotifIds });
    const qualificationSet = await readQualificationSet();
    const reviews = await readReviewCollection(corpus, qualificationSet, { allowEmptyRebase: true });
    const report = buildBlindEvaluationReport({
      corpus,
      reviewResults: reviews.results,
      translationErrorLedger,
      evaluationTooling,
      lexicalUses,
      reviewerQualificationSet: qualificationSet,
      activeRecipeIds,
      activeMotifIds
    });
    await Promise.all([
      writeFile(corpusPath, `${JSON.stringify(corpus, null, 2)}\n`),
      writeFile(reviewsPath, `${JSON.stringify(reviews, null, 2)}\n`),
      writeFile(qualificationPath, `${JSON.stringify(qualificationSet, null, 2)}\n`),
      writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`),
      writeFile(displayManifestPath, `${JSON.stringify(displayManifest(corpus), null, 2)}\n`),
      writeFile(scanEvidencePath, scanEvidenceBytes)
    ]);
    process.stdout.write(`wrote blind corpus ${corpus.corpusId}; human gate pending ${report.reviewerCoverage.filter(row => !row.pass).length} fixtures\n`);
  } finally {
    await browser?.close();
    await Promise.all([candidateServer?.stop(), baselineServer?.stop()]);
    await rm(baseline.directory, { recursive: true, force: true });
    if (candidateServer?.stderr()) process.stderr.write(candidateServer.stderr());
    if (baselineServer?.stderr()) process.stderr.write(baselineServer.stderr());
  }
}

if (write || probe) await generateFrozenCorpus();
else await verifyFrozenCorpus();
