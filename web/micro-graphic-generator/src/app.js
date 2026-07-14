import { canonicalJson, hashCanonical } from "./canonical-hash.js";
import { createCatalogRenderer } from "./catalog-renderer.js";
import {
  createKnownGoodRegistry,
  instantiateKnownGoodPlanMap
} from "./composition-known-good.js";
import {
  COMPOSITION_ENGINE_VERSION,
  FONT_ASSET_REVISION,
  OWNER_SNAPSHOT_MANIFEST,
  OWNER_SNAPSHOT_REVISION
} from "./composition-owner-snapshot.js";
import {
  createGenerationInput,
  deepFreeze,
  validateAttemptResult,
  validateTerminalGenerationResult,
  validateVocabularyRegistry
} from "./composition-model.js";
import { createPlanValidationContext } from "./composition-plan-validator.js";
import { planComposition, plannerResultFingerprint } from "./composition-planner.js";
import {
  activeRecipeIds,
  compositionRecipes,
  pilotCandidateTranslationSetGroups,
  pilotCandidateTranslationSetIds,
  pilotMetadataLexicalUseIds,
  RECIPE_REGISTRY_VERSION,
  relationEdges
} from "./composition-recipes.js";
import {
  BROWSER_CONFORMANCE_PROFILE,
  CANONICAL_COMPONENT_MAX_DIMENSION,
  COMPOSITION_POLICY_VERSION,
  LAYOUT_GRID,
  MAX_MOUNTED_RANKED_ATTEMPTS,
  MIN_VIEWPORT,
  NODE_CONFORMANCE_RUNTIME,
  componentBorderModes,
  deriveTypographyTokenVariant,
  GRID_BLOCK_POLICY_BY_FOOTPRINT
} from "./config.js";
import { createArtworkExporter } from "./export.js";
import { createGraphicPrimitives } from "./graphics.js";
import { createGridFinalizer } from "./grid-finalizer.js";
import {
  compositionBlockGeometry,
  enumerateCanonicalLayouts,
  uniformTypographyGroupKey
} from "./grid-layout.js";
import { createGridRenderer } from "./grid-renderer.js";
import {
  alignedTextX,
  fitComponentBox,
  normalizeTokenAlign,
  paddedBox
} from "./layout.js";
import {
  materializeMotifCandidates,
  MOTIF_REGISTRY_VERSION,
  validateMotifRenderParams
} from "./motifs.js";
import { createRandomSource, deriveSeed, keyedValue } from "./random.js";
import { line, make, rect, svgStructuralFingerprint, textNode } from "./svg.js";
import {
  createCompositionCandidateInventory,
  createTokenLibrary
} from "./token-library.js";
import { normalizeDesignTokenSize } from "./token-model.js";
import { FONT_METRICS_VERSION, measureTypography } from "./typography-metrics.js";
import { validateRenderedTokenRules as runValidationRules } from "./validation.js";
import {
  lexicalUses,
  translationErrorLedger,
  translationSets,
  visualTokens,
  VOCABULARY_VERSION
} from "./vocabulary.js";

const art = document.querySelector("#art");
const seedLabel = document.querySelector("#seedLabel");
const controls = {
  random: document.querySelector("#random"),
  mode: document.querySelector("#mode"),
  grid: document.querySelector("#grid"),
  png: document.querySelector("#png"),
  svg: document.querySelector("#svg"),
  tone: document.querySelector("#tone")
};
const urlParameters = new URLSearchParams(window.location.search);
const testMode = urlParameters.get("test") === "1";
const requestedTestSeed = urlParameters.has("seed") ? Number(urlParameters.get("seed")) : null;
const requestedTestNow = urlParameters.get("now");
const fixedGenerationDate = testMode && requestedTestNow && !Number.isNaN(Date.parse(requestedTestNow))
  ? new Date(requestedTestNow)
  : null;
let testRejectionMode = testMode ? urlParameters.get("reject") || "none" : "none";
let testRankedCandidateMode = testMode ? urlParameters.get("rankedCandidates") || "normal" : "normal";
let testKnownGoodMode = testMode ? urlParameters.get("knownGood") || "normal" : "normal";
let testPlanningFailureMode = testMode ? urlParameters.get("planningFailure") || "none" : "none";
let testContextFailureMode = testMode ? urlParameters.get("contextFailure") || "none" : "none";
let testFontFailureMode = testMode ? urlParameters.get("fontFailure") || "none" : "none";
if (!["none", "forced"].includes(testFontFailureMode)) testFontFailureMode = "none";

function randomSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0] >>> 0;
}

function generationDate() {
  return fixedGenerationDate ? new Date(fixedGenerationDate.getTime()) : new Date();
}

let seed = testMode && Number.isFinite(requestedTestSeed)
  ? requestedTestSeed >>> 0
  : randomSeed();
let generationTimestamp = generationDate().toISOString();
let activeComponentRatio = "";
let activeBorderMode = "";
let activeBlockLayout = "";
let blockOutlinesVisible = true;
let appMode = "random";
let dark = false;
let renderVersion = 0;
let activePlan = null;
let activeFinalizationReport = null;
let activeAttemptResult = null;
let activeStructuralFingerprint = null;
let activeValidationContext = null;
let activeComponent = null;
let acceptedDisplayState = null;
let activeGenerationSnapshot = null;
let terminalResult = null;
let lastAttemptResult = null;
let exportEligible = false;
let telemetryEvents = [];
let fontLoadFailure = null;
let fontRuntimeState = "loading";

function seedHex() {
  return seed.toString(16).toUpperCase().padStart(8, "0");
}

function seedSlug() {
  return seed.toString(16);
}

function cssVar(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

const legacyRandomSource = createRandomSource(seed);
const graphicPrimitives = createGraphicPrimitives({ randomSource: legacyRandomSource, visualTokens });
const catalogTokenLibrary = createTokenLibrary({
  randomSource: legacyRandomSource,
  visualTokens,
  generationDate,
  measureBadgeWidth: graphicPrimitives.microBadgeWidth
});
const catalogRenderer = createCatalogRenderer({
  randomSource: legacyRandomSource,
  graphicPrimitives,
  renderTypographySample: stackTextToken
});
const gridRenderer = createGridRenderer();
const gridFinalizer = createGridFinalizer({
  renderTypographyAtSize: gridRenderer.renderTypographyAtSize,
  setTokenNudge: gridRenderer.setTokenNudge
});
const vocabularyRegistry = validateVocabularyRegistry({
  lexicalUses,
  translationSets,
  translationErrorLedger
});
const translationSetByLexicalUseId = new Map(
  [...vocabularyRegistry.lexicalUseToTranslationSet].map(([lexicalUseId, translationSetId]) => [
    lexicalUseId,
    vocabularyRegistry.translationSetById.get(translationSetId)
  ])
);
const motifCandidates = materializeMotifCandidates();
const knownGoodRegistry = createKnownGoodRegistry();

const artworkExporter = createArtworkExporter({
  art,
  getViewport: () => ({ width: window.innerWidth, height: window.innerHeight }),
  cssVariable: cssVar,
  filenameSlug: seedSlug,
  getExportState: () => {
    if (appMode === "composable-tokens") return { exportEligible: true, planId: null };
    const mounted = art.querySelector("svg[data-component]");
    const planId = mounted?.getAttribute("data-plan-id") || null;
    return {
      exportEligible: Boolean(
        exportEligible
        && mounted
        && mounted === activeComponent
        && activePlan
        && planId === activePlan.planId
      ),
      planId
    };
  }
});

function textSpinTransform(x, y, angle = 0) {
  if (!angle) return "";
  return `rotate(${angle.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)})`;
}

function stackTextToken(group, zone, value, attrs = {}) {
  const align = normalizeTokenAlign(attrs.align || "left");
  const tokenSize = normalizeDesignTokenSize(attrs.tokenSize || "medium");
  const y = zone.y + zone.height * (attrs.baseline ?? 0.72);
  const x = alignedTextX(zone, align);
  group.appendChild(textNode(x, y, value, {
    ...attrs,
    align,
    tokenSize,
    maxWidth: attrs.maxWidth || zone.width,
    transform: attrs.transform || textSpinTransform(x, y, attrs.spin || 0)
  }));
}

const componentTemplates = Object.freeze([
  Object.freeze({ label: "component 1:1", ratio: "1:1", width: 1, height: 1, scale: 0.72 }),
  Object.freeze({ label: "component 2:3", ratio: "2:3", width: 2, height: 3, scale: 0.78 }),
  Object.freeze({ label: "component 2:5", ratio: "2:5", width: 2, height: 5, scale: 0.82 }),
  Object.freeze({ label: "component 3:2", ratio: "3:2", width: 3, height: 2, scale: 0.78 }),
  Object.freeze({ label: "component 5:2", ratio: "5:2", width: 5, height: 2, scale: 0.82 }),
  Object.freeze({ label: "component 4:3", ratio: "4:3", width: 4, height: 3, scale: 0.8 }),
  Object.freeze({ label: "component 3:4", ratio: "3:4", width: 3, height: 4, scale: 0.8 })
]);

function keyedPick(items, input, label) {
  const index = Math.min(items.length - 1, Math.floor(keyedValue(input, label) * items.length));
  return items[index];
}

function canonicalComponentSize(template) {
  if (template.width >= template.height) {
    return {
      width: CANONICAL_COMPONENT_MAX_DIMENSION,
      height: CANONICAL_COMPONENT_MAX_DIMENSION * template.height / template.width
    };
  }
  return {
    width: CANONICAL_COMPONENT_MAX_DIMENSION * template.width / template.height,
    height: CANONICAL_COMPONENT_MAX_DIMENSION
  };
}

function canonicalSafeBox(width, height) {
  const box = paddedBox(0, 0, width, height, "large");
  return { x: box.x, y: box.y, width: box.width, height: box.height };
}

function renderComponentBorder(width, height, mode) {
  const group = make("g", { "data-border": mode });
  if (mode === "no-stroke") return group;
  if (mode === "stroke") {
    group.appendChild(rect(1, 1, width - 2, height - 2, { opacity: 0.9 }));
    return group;
  }
  const inset = 8;
  const x0 = inset;
  const y0 = inset;
  const x1 = width - inset;
  const y1 = height - inset;
  const length = Math.min(72, Math.max(38, Math.min(width, height) * 0.18));
  const attrs = { opacity: 0.94 };
  group.append(
    line(x0, y0, x0 + length, y0, attrs),
    line(x0, y0, x0, y0 + length, attrs),
    line(x1, y0, x1 - length, y0, attrs),
    line(x1, y0, x1, y0 + length, attrs),
    line(x0, y1, x0 + length, y1, attrs),
    line(x0, y1, x0, y1 - length, attrs),
    line(x1, y1, x1 - length, y1, attrs),
    line(x1, y1, x1, y1 - length, attrs)
  );
  return group;
}

function createGenerationContext(width, height) {
  const viewport = Object.freeze({
    width,
    height,
    devicePixelRatio: window.devicePixelRatio || 1
  });
  const layoutSeedInput = deepFreeze({
    schemaVersion: 1,
    seed,
    generationTimestamp,
    viewport,
    vocabularyVersion: VOCABULARY_VERSION,
    recipeVersion: RECIPE_REGISTRY_VERSION,
    motifVersion: MOTIF_REGISTRY_VERSION,
    configVersion: COMPOSITION_POLICY_VERSION,
    compositionEngineVersion: COMPOSITION_ENGINE_VERSION,
    fontMetricsVersion: FONT_METRICS_VERSION,
    fontAssetRevision: FONT_ASSET_REVISION,
    ownerSnapshotRevision: OWNER_SNAPSHOT_REVISION
  });
  const layoutSeed = deriveSeed(layoutSeedInput, "app-layout");
  const template = keyedPick(componentTemplates, layoutSeed, "ratio");
  const borderMode = keyedPick(componentBorderModes, layoutSeed, "borderMode");
  const canonicalSize = canonicalComponentSize(template);
  const safeBox = canonicalSafeBox(canonicalSize.width, canonicalSize.height);
  const displayBox = fitComponentBox(
    width,
    height,
    { width: template.width, height: template.height },
    template.scale
  );
  const generationInput = createGenerationInput({
    schemaVersion: 1,
    seed,
    generationTimestamp,
    ratio: template.ratio,
    borderMode,
    viewport,
    safeBox,
    vocabularyVersion: VOCABULARY_VERSION,
    recipeVersion: RECIPE_REGISTRY_VERSION,
    motifVersion: MOTIF_REGISTRY_VERSION,
    configVersion: COMPOSITION_POLICY_VERSION,
    compositionEngineVersion: COMPOSITION_ENGINE_VERSION,
    fontMetricsVersion: FONT_METRICS_VERSION,
    fontAssetRevision: FONT_ASSET_REVISION,
    ownerSnapshotRevision: OWNER_SNAPSHOT_REVISION
  });
  if (testContextFailureMode === "construction") {
    const error = new Error("context-construction:test");
    error.generationInput = generationInput;
    throw error;
  }
  const inventory = createCompositionCandidateInventory({
    generationInput,
    vocabularyVersion: VOCABULARY_VERSION,
    lexicalUses,
    translationSets,
    rankedTranslationSetIds: pilotCandidateTranslationSetIds,
    rankedTranslationSetGroups: pilotCandidateTranslationSetGroups,
    rankedMetadataLexicalUseIds: pilotMetadataLexicalUseIds,
    motifCandidates
  });
  const rankedCandidateIds = testRankedCandidateMode === "none"
    ? Object.freeze([])
    : inventory.rankedCandidateIds;
  const registryVersions = Object.freeze({
    vocabularyVersion: VOCABULARY_VERSION,
    recipeVersion: RECIPE_REGISTRY_VERSION,
    motifVersion: MOTIF_REGISTRY_VERSION,
    configVersion: COMPOSITION_POLICY_VERSION,
    compositionEngineVersion: COMPOSITION_ENGINE_VERSION,
    fontMetricsVersion: FONT_METRICS_VERSION,
    fontAssetRevision: FONT_ASSET_REVISION,
    ownerSnapshotRevision: OWNER_SNAPSHOT_REVISION
  });
  const validationContext = createPlanValidationContext({
    generationInput,
    ownerSnapshotManifest: OWNER_SNAPSHOT_MANIFEST,
    registryVersions,
    lexicalUseById: vocabularyRegistry.lexicalUseById,
    translationSetById: vocabularyRegistry.translationSetById,
    translationSetByLexicalUseId,
    recipes: compositionRecipes,
    activeRecipeIds,
    relationEdges,
    candidateById: inventory.candidateById,
    rankedCandidateIds,
    blockPolicyByFootprint: GRID_BLOCK_POLICY_BY_FOOTPRINT,
    enumerateCanonicalLayouts,
    compositionBlockGeometry,
    measureTypography,
    deriveTypographyTokenVariant,
    validateMotifRenderParams
  });
  const instantiatedKnownGood = instantiateKnownGoodPlanMap(
    knownGoodRegistry,
    generationInput,
    validationContext
  );
  const knownGood = testKnownGoodMode === "none"
    ? Object.freeze({ plans: new Map(), diagnostics: instantiatedKnownGood.diagnostics })
    : instantiatedKnownGood;
  return Object.freeze({
    template,
    borderMode,
    canonicalSize: Object.freeze(canonicalSize),
    displayBox: Object.freeze(displayBox),
    generationInput,
    inventory,
    validationContext,
    knownGood
  });
}

function reportValidationResults(target, validation) {
  target.setAttribute("data-rule-violations", String(validation.violations.length));
  target.setAttribute("data-rule-violation-list", validation.violations.join(","));
  return validation;
}

function stableUnique(values) {
  return [...new Set(values)];
}

function forcedValidationRecord(envelope) {
  const shouldReject = testRejectionMode === "all"
    || (testRejectionMode === "ranked" && envelope.candidateSource === "ranked")
    || (testRejectionMode === "known-good" && envelope.candidateSource === "known-good");
  return shouldReject
    ? Object.freeze({
        rule: "test.forced-reject",
        valid: false,
        nodes: Object.freeze([envelope.planId]),
        detail: `Forced ${envelope.candidateSource} rejection in test mode.`
      })
    : null;
}

function assembleAttemptResult(envelope, finalizationReport, validationResult = null) {
  let validation;
  if (finalizationReport.status === "reject") {
    validation = { status: "not-run", skipReason: "finalization-rejected", results: [] };
  } else {
    const results = [...validationResult.results];
    const forced = forcedValidationRecord(envelope);
    if (forced) results.push(forced);
    validation = {
      status: results.some(result => !result.valid) ? "fail" : "pass",
      skipReason: null,
      results
    };
  }
  const rejectionReasons = stableUnique([
    ...finalizationReport.rejectionReasons,
    ...validation.results.filter(result => !result.valid).map(result => `validation:${result.rule}`)
  ]);
  const result = deepFreeze({
    schemaVersion: 1,
    envelope,
    finalizationReport,
    validation,
    status: rejectionReasons.length ? "reject" : "accept",
    rejectionReasons
  });
  validateAttemptResult(result);
  return result;
}

function backgroundNode(width, height) {
  return make("rect", {
    x: 0,
    y: 0,
    width,
    height,
    fill: "var(--bg)",
    "data-art-background": "true"
  });
}

function mountAttempt(plan, envelope, generation) {
  const existing = art.querySelector("svg[data-component]");
  if (existing) existing.remove();
  const component = gridRenderer.renderCompositionPlan(plan, generation.validationContext, {
    x: generation.displayBox.x,
    y: generation.displayBox.y,
    width: generation.canonicalSize.width,
    height: generation.canonicalSize.height,
    displayWidth: generation.displayBox.width,
    displayHeight: generation.displayBox.height,
    blockOutlinesVisible,
    borderNode: renderComponentBorder(
      generation.canonicalSize.width,
      generation.canonicalSize.height,
      generation.borderMode
    )
  });
  art.appendChild(component);
  const finalizationReport = gridFinalizer.finalizeComposition(component, plan, envelope);
  const renderedValidation = finalizationReport.status === "accept"
    ? runValidationRules(art, {
        expectedMode: "random",
        plan,
        finalizationReport,
        validationContext: generation.validationContext
      })
    : null;
  const attemptResult = assembleAttemptResult(envelope, finalizationReport, renderedValidation);
  if (attemptResult.status === "reject") component.remove();
  return { component, attemptResult };
}

function rankedEnvelope(entry) {
  return deepFreeze({
    attempt: entry.candidateCursor + 1,
    candidateSource: "ranked",
    candidateCursor: entry.candidateCursor,
    searchTier: entry.searchTier,
    fallbackTrigger: null,
    planId: entry.planId
  });
}

function knownGoodEnvelope(plan, candidateCursor, fallbackTrigger) {
  return deepFreeze({
    attempt: candidateCursor + 1,
    candidateSource: "known-good",
    candidateCursor,
    searchTier: "known-good",
    fallbackTrigger,
    planId: plan.planId
  });
}

function previousDisplayState() {
  return {
    component: activeComponent,
    plan: activePlan,
    finalizationReport: activeFinalizationReport,
    attemptResult: activeAttemptResult,
    structuralFingerprint: activeStructuralFingerprint,
    validationContext: activeValidationContext,
    exportEligible,
    acceptedDisplayState,
    componentRatio: acceptedDisplayState?.componentRatio || "",
    borderMode: acceptedDisplayState?.borderMode || "",
    blockLayout: acceptedDisplayState?.blockLayout || ""
  };
}

function restorePrevious(previous) {
  const current = art.querySelector("svg[data-component]");
  if (current) current.remove();
  if (previous.component) art.appendChild(previous.component);
  activePlan = previous.plan;
  activeFinalizationReport = previous.finalizationReport;
  activeAttemptResult = previous.attemptResult;
  activeStructuralFingerprint = previous.structuralFingerprint;
  activeValidationContext = previous.validationContext;
  activeComponent = previous.component;
  exportEligible = previous.exportEligible;
  acceptedDisplayState = previous.acceptedDisplayState;
  if (acceptedDisplayState) {
    seed = acceptedDisplayState.seed;
    generationTimestamp = acceptedDisplayState.generationTimestamp;
  }
  activeComponentRatio = previous.componentRatio;
  activeBorderMode = previous.borderMode;
  activeBlockLayout = previous.blockLayout;
}

function terminalFailure(reason, rankedStopReason, previous, attemptResult) {
  restorePrevious(previous);
  const result = deepFreeze({
    schemaVersion: 1,
    status: "terminal-failure",
    attemptedGenerationInputHash: activeGenerationSnapshot.plannerResult.generationInputHash,
    terminalReason: reason,
    rankedStopReason,
    displayedPlanId: previous.plan?.planId || null,
    displayedStructuralFingerprint: previous.structuralFingerprint,
    preservedPrevious: Boolean(previous.plan && previous.component),
    exportEligible: Boolean(previous.exportEligible),
    lastAttemptResult: attemptResult
  });
  validateTerminalGenerationResult(result);
  terminalResult = result;
  lastAttemptResult = attemptResult;
  return result;
}

function acceptAttempt(component, plan, attemptResult, validationContext) {
  const fingerprint = svgStructuralFingerprint(component);
  activePlan = plan;
  activeFinalizationReport = attemptResult.finalizationReport;
  activeAttemptResult = attemptResult;
  activeStructuralFingerprint = fingerprint;
  activeValidationContext = validationContext;
  activeComponent = component;
  exportEligible = true;
  terminalResult = null;
  lastAttemptResult = attemptResult;
  reportValidationResults(art, {
    valid: true,
    violations: [],
    results: attemptResult.validation.results
  });
  return fingerprint;
}

function createTelemetryInitial(inputId, plannerResult) {
  const selection = plannerResult.initialSelection;
  const selectedEntry = plannerResult.searchQueue.find(entry => entry.planId === selection.selectedPlanId);
  const hero = selectedEntry?.plan.slots.find(slot => slot.compositionRole === "hero") || null;
  const queueByPlanId = new Map(plannerResult.searchQueue.map(entry => [entry.planId, entry]));
  const topTieHeroLexicalUseIds = selection.topTiePlanIds.map(planId =>
    queueByPlanId.get(planId)?.plan.slots.find(slot => slot.compositionRole === "hero")?.lexicalUseId || null
  );
  return deepFreeze({
    population: "initial-selection",
    inputId,
    rankedPlanUniverseFingerprint: plannerResult.rankedPlanUniverseFingerprint,
    recipeOrder: selection.recipeOrder,
    recipeStartIndex: selection.recipeStartIndex,
    selectedRecipeId: selection.selectedRecipeId,
    status: selection.status,
    topRankKey: selection.topRankKey,
    topTiePlanIds: selection.topTiePlanIds,
    topTieHeroLexicalUseIds,
    selectedPlanId: selection.selectedPlanId,
    selectedTieIndex: selection.selectedTieIndex,
    selectionDrawCount: selection.selectionDrawCount,
    heroLexicalUseId: hero?.lexicalUseId || null
  });
}

function executeCompositionGeneration(createGeneration) {
  const previous = previousDisplayState();
  let generation = null;
  let plannerResult;
  try {
    generation = createGeneration();
    if (testPlanningFailureMode === "complexity") {
      throw new Error("planning-complexity:test:rankedPlans");
    }
    const selectionSeed = deriveSeed(generation.generationInput, "selection");
    plannerResult = planComposition({
      generationInput: generation.generationInput,
      validationContext: generation.validationContext,
      knownGoodPlanByRecipeId: generation.knownGood.plans,
      selectionRandomSource: () => keyedValue(selectionSeed, "initial-top-tie")
    });
  } catch (error) {
    restorePrevious(previous);
    const planningFailure = String(error?.message || error);
    const attemptedGenerationInput = error?.generationInput || generation?.generationInput || null;
    telemetryEvents = [];
    activeGenerationSnapshot = deepFreeze({
      schemaVersion: 1,
      generationInput: attemptedGenerationInput,
      plannerResult: null,
      plannerResultFingerprint: null,
      knownGoodPlanIds: generation
        ? [...generation.knownGood.plans.values()].map(plan => plan.planId).sort()
        : [],
      knownGoodDiagnostics: generation?.knownGood.diagnostics || [],
      attempts: [],
      rankedAttemptLimit: 0,
      planningFailure,
      terminalResult: null,
      lastAttemptResult: null,
      displayedPlanId: activePlan?.planId || null,
      displayedStructuralFingerprint: activeStructuralFingerprint,
      exportPlanId: exportEligible ? activePlan?.planId || null : null,
      telemetryEvents
    });
    terminalResult = null;
    lastAttemptResult = null;
    art.removeAttribute("data-generation-failure");
    document.body.setAttribute("data-generation-failure", planningFailure);
    return;
  }

  const inputId = hashCanonical(generation.generationInput);
  const attempts = [];
  telemetryEvents = [createTelemetryInitial(inputId, plannerResult)];
  activeGenerationSnapshot = {
    schemaVersion: 1,
    generationInput: generation.generationInput,
    plannerResult,
    plannerResultFingerprint: plannerResultFingerprint(plannerResult),
    knownGoodPlanIds: [...generation.knownGood.plans.values()].map(plan => plan.planId).sort(),
    knownGoodDiagnostics: generation.knownGood.diagnostics,
    attempts,
    planningFailure: null
  };
  art.removeAttribute("data-generation-failure");
  document.body.removeAttribute("data-generation-failure");

  const rankedAttemptLimit = Math.min(plannerResult.searchQueue.length, MAX_MOUNTED_RANKED_ATTEMPTS);
  let accepted = null;
  let stopReason = null;

  if (plannerResult.initialSelection.status === "selected") {
    for (let cursor = 0; cursor < rankedAttemptLimit; cursor += 1) {
      const entry = plannerResult.searchQueue[cursor];
      const mounted = mountAttempt(entry.plan, rankedEnvelope(entry), generation);
      attempts.push(mounted.attemptResult);
      telemetryEvents.push(deepFreeze({ population: "attempt", inputId, attemptResult: mounted.attemptResult }));
      lastAttemptResult = mounted.attemptResult;
      if (mounted.attemptResult.status === "accept") {
        accepted = { component: mounted.component, plan: entry.plan, attemptResult: mounted.attemptResult };
        break;
      }
    }
    if (!accepted) {
      stopReason = rankedAttemptLimit < plannerResult.searchQueue.length
        ? "attempt-budget-exhausted"
        : "queue-exhausted";
    }
  } else {
    stopReason = "no-candidate";
  }

  if (!accepted && stopReason) {
    const recipeId = plannerResult.initialSelection.selectedRecipeId
      || plannerResult.initialSelection.recipeOrder.find(id => generation.knownGood.plans.has(id));
    const knownGoodPlan = recipeId ? generation.knownGood.plans.get(recipeId) : null;
    if (knownGoodPlan) {
      const cursor = stopReason === "no-candidate" ? 0 : rankedAttemptLimit;
      const mounted = mountAttempt(
        knownGoodPlan,
        knownGoodEnvelope(knownGoodPlan, cursor, stopReason),
        generation
      );
      attempts.push(mounted.attemptResult);
      telemetryEvents.push(deepFreeze({ population: "attempt", inputId, attemptResult: mounted.attemptResult }));
      lastAttemptResult = mounted.attemptResult;
      if (mounted.attemptResult.status === "accept") {
        accepted = { component: mounted.component, plan: knownGoodPlan, attemptResult: mounted.attemptResult };
      } else {
        terminalFailure("known-good-rejected", stopReason, previous, mounted.attemptResult);
      }
    } else {
      const reason = stopReason === "no-candidate"
        ? "no-candidate-no-known-good"
        : `${stopReason}-no-known-good`;
      terminalFailure(reason, stopReason, previous, attempts.at(-1) || null);
    }
  }

  if (accepted) {
    const fingerprint = acceptAttempt(
      accepted.component,
      accepted.plan,
      accepted.attemptResult,
      generation.validationContext
    );
    const heroSlot = accepted.plan.slots.find(slot => slot.compositionRole === "hero");
    const heroBlock = accepted.plan.blocks.find(block => block.slotInstanceId === heroSlot.id);
    const heroReport = accepted.attemptResult.finalizationReport.blocks.find(block => block.slotInstanceId === heroSlot.id);
    const motifSlot = accepted.plan.slots.find(slot => slot.sourceKind === "motif") || null;
    telemetryEvents.push(deepFreeze({
      population: "accepted-output",
      inputId,
      planId: accepted.plan.planId,
      structuralFingerprint: fingerprint,
      recipeId: accepted.plan.recipeId,
      heroLexicalUseId: heroSlot.lexicalUseId,
      heroLanguage: generation.inventory.candidateById.get(heroSlot.candidateId).language,
      heroScript: generation.inventory.candidateById.get(heroSlot.candidateId).script,
      heroFootprint: heroBlock.footprint,
      heroOrientation: heroBlock.orientationMode,
      heroFinalizationClass: heroReport.fallbackTier === 0 ? "requested" : "downshifted",
      motifId: motifSlot?.motifId || null,
      fallbackSummary: {
        candidateSource: accepted.attemptResult.envelope.candidateSource,
        fallbackTrigger: accepted.attemptResult.envelope.fallbackTrigger,
        rankedAttempts: attempts.filter(result => result.envelope.candidateSource === "ranked").length
      }
    }));
    activeComponentRatio = generation.template.ratio;
    activeBorderMode = generation.borderMode;
    activeBlockLayout = activePlan.blocks.map(block => block.footprint).join("+");
    acceptedDisplayState = Object.freeze({
      seed,
      generationTimestamp,
      componentRatio: activeComponentRatio,
      borderMode: activeBorderMode,
      blockLayout: activeBlockLayout
    });
  } else if (terminalResult) {
    telemetryEvents.push(deepFreeze({
      population: "terminal-failure",
      inputId,
      terminalResult
    }));
  }

  activeGenerationSnapshot = deepFreeze({
    ...activeGenerationSnapshot,
    rankedAttemptLimit,
    attempts,
    terminalResult,
    lastAttemptResult,
    displayedPlanId: activePlan?.planId || null,
    displayedStructuralFingerprint: activeStructuralFingerprint,
    exportPlanId: exportEligible ? activePlan?.planId || null : null,
    telemetryEvents
  });
  const displayRatio = activeComponentRatio || "none";
  const displayLayout = activeBlockLayout || "none";
  seedLabel.textContent = `SEED ${seedHex()} / ${displayRatio} / ${activePlan?.recipeId?.toUpperCase() || "FAILED"} / ${displayLayout}`;
}

function exportTargetAvailable() {
  if (fontRuntimeState !== "ready") return false;
  if (appMode === "composable-tokens") return true;
  const mounted = art.querySelector("svg[data-component]");
  return Boolean(exportEligible && activePlan && mounted && mounted === activeComponent);
}

function syncGenerationAvailability() {
  const disabled = fontRuntimeState !== "ready";
  for (const control of [controls.random, controls.mode]) {
    control.disabled = disabled;
    control.setAttribute("aria-disabled", String(disabled));
  }
}

function syncExportAvailability() {
  const disabled = !exportTargetAvailable();
  for (const control of [controls.png, controls.svg]) {
    control.disabled = disabled;
    control.setAttribute("aria-disabled", String(disabled));
  }
}

function renderCatalog(width, height) {
  legacyRandomSource.reset(seed);
  art.replaceChildren(backgroundNode(width, height));
  art.appendChild(catalogRenderer.renderComposableTokensMode(
    width,
    height,
    catalogTokenLibrary.createCategoryDefinitions()
  ));
  activeComponentRatio = "composable categories";
  activeBorderMode = "catalog";
  activeBlockLayout = "catalog";
  reportValidationResults(art, runValidationRules(art, { expectedMode: "composable-tokens" }));
  seedLabel.textContent = `MODE COMPOSABLE CATEGORIES / SEED ${seedHex()}`;
}

function render(nextSeed = seed, { newGeneration = false } = {}) {
  if (fontRuntimeState !== "ready") {
    syncGenerationAvailability();
    syncExportAvailability();
    return;
  }
  const normalizedSeed = Number(nextSeed) >>> 0;
  if (newGeneration || normalizedSeed !== seed) generationTimestamp = generationDate().toISOString();
  seed = normalizedSeed;
  legacyRandomSource.reset(seed);
  const width = Math.max(MIN_VIEWPORT.width, window.innerWidth);
  const height = Math.max(MIN_VIEWPORT.height, window.innerHeight);
  art.setAttribute("viewBox", `0 0 ${width} ${height}`);
  art.setAttribute("style", "color: var(--ink)");
  art.setAttribute("data-grid-outlines", blockOutlinesVisible ? "visible" : "hidden");
  document.body.classList.toggle("is-dark", dark);

  if (appMode === "composable-tokens") {
    renderCatalog(width, height);
  } else {
    const previous = art.querySelector("svg[data-component]") || activeComponent;
    const background = art.querySelector("[data-art-background]") || backgroundNode(width, height);
    background.setAttribute("width", String(width));
    background.setAttribute("height", String(height));
    art.replaceChildren(background, ...(previous ? [previous] : []));
    executeCompositionGeneration(() => createGenerationContext(width, height));
  }
  renderVersion += 1;
  syncExportAvailability();
}

function syncBlockOutlineVisibility() {
  art.setAttribute("data-grid-outlines", blockOutlinesVisible ? "visible" : "hidden");
  art.querySelectorAll("[data-grid-block-outline]").forEach(outline => {
    outline.setAttribute("opacity", blockOutlinesVisible ? "0.18" : "0");
  });
  controls.grid.setAttribute("aria-pressed", String(blockOutlinesVisible));
}

function bindEvents() {
  controls.random.addEventListener("click", () => render(randomSeed(), { newGeneration: true }));
  controls.mode.addEventListener("click", () => {
    if (fontRuntimeState !== "ready") return;
    appMode = appMode === "random" ? "composable-tokens" : "random";
    controls.mode.textContent = appMode === "composable-tokens" ? "Generator" : "Compose";
    controls.mode.setAttribute("aria-pressed", String(appMode === "composable-tokens"));
    render(seed);
  });
  controls.grid.addEventListener("click", () => {
    blockOutlinesVisible = !blockOutlinesVisible;
    syncBlockOutlineVisibility();
  });
  const runExport = operation => {
    document.body.removeAttribute("data-export-failure");
    Promise.resolve().then(operation).catch(error => {
      document.body.setAttribute("data-export-failure", String(error?.message || error));
    });
  };
  controls.png.addEventListener("click", () => runExport(artworkExporter.exportPng));
  controls.svg.addEventListener("click", () => runExport(artworkExporter.exportSvg));
  controls.tone.addEventListener("click", () => {
    dark = !dark;
    document.body.classList.toggle("is-dark", dark);
  });
  art.addEventListener("click", () => render(randomSeed(), { newGeneration: true }));
  window.addEventListener("resize", () => render(seed));
}

function currentTestSnapshot() {
  const component = art.querySelector("svg[data-component]");
  const mountedPlan = component
    && activePlan
    && component.getAttribute("data-plan-id") === activePlan.planId
    ? activePlan
    : null;
  const blocks = component ? [...component.querySelectorAll("[data-grid-block]")].map(block => {
    const token = [...block.children].find(child => child.hasAttribute("data-message-slot"));
    const sourceKind = token?.getAttribute("data-token-source-kind") || null;
    const text = sourceKind === "lexical"
      ? token?.querySelector(':scope > text[data-token-form="typography"]')
      : null;
    return {
      blockId: block.getAttribute("data-grid-block"),
      footprint: block.getAttribute("data-grid-footprint"),
      cells: (block.getAttribute("data-grid-cells") || "").split(",").filter(Boolean).map(Number),
      slotInstanceId: token?.getAttribute("data-message-slot") || null,
      compositionRole: token?.getAttribute("data-composition-role") || null,
      prominence: token?.getAttribute("data-visual-prominence") || null,
      sourceKind,
      lexicalUseId: token?.getAttribute("data-lexical-use") || null,
      motifId: token?.getAttribute("data-motif-id") || null,
      value: text?.textContent || token?.getAttribute("data-motif-id") || null,
      requestedSize: token?.getAttribute("data-token-requested-size") || null,
      actualSize: token?.getAttribute("data-token-actual-size") || null,
      fontWeight: text ? Number(text.getAttribute("font-weight")) : null,
      fallbackTier: Number(token?.getAttribute("data-fallback-tier") || 0),
      orientation: token?.getAttribute("data-token-orientation") || null,
      fit: token?.getAttribute("data-token-fit") === "true"
    };
  }) : [];
  const fingerprint = {
    mode: appMode,
    tone: dark ? "dark" : "light",
    grid: blockOutlinesVisible,
    componentRatio: activeComponentRatio,
    borderMode: activeBorderMode,
    blockLayout: activeBlockLayout,
    recipeId: mountedPlan?.recipeId || null,
    planId: mountedPlan?.planId || null,
    blocks
  };
  const structural = {
    mode: appMode,
    componentRatio: activeComponentRatio,
    borderMode: activeBorderMode,
    blockLayout: activeBlockLayout,
    recipeId: mountedPlan?.recipeId || null,
    planId: mountedPlan?.planId || null,
    blocks
  };
  return {
    schemaVersion: 2,
    seed,
    seedHex: seedHex(),
    renderVersion,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    prng: legacyRandomSource.snapshot(),
    violations: Number(art.getAttribute("data-rule-violations") || 0),
    violationList: (art.getAttribute("data-rule-violation-list") || "").split(",").filter(Boolean),
    fingerprint,
    normalizedFingerprint: canonicalJson(fingerprint),
    structuralFingerprint: canonicalJson(structural),
    svgStructuralFingerprint: component ? svgStructuralFingerprint(component) : null,
    plannerResultFingerprint: activeGenerationSnapshot?.plannerResultFingerprint || null,
    attemptCount: activeGenerationSnapshot?.attempts?.length || 0,
    rankedAttemptLimit: activeGenerationSnapshot?.rankedAttemptLimit ?? null,
    terminalReason: activeGenerationSnapshot?.terminalResult?.terminalReason || null,
    displayedPlanId: mountedPlan?.planId || null,
    exportPlanId: exportEligible && mountedPlan && component === activeComponent
      ? mountedPlan.planId
      : null
  };
}

async function loadTypefaces() {
  if (testFontFailureMode === "forced") throw new Error("Forced approved font load failure");
  if (!document.fonts) throw new Error("Font Loading API is required");
  const families = ["SUIT", "Noto Sans Mono", "Glow Sans SC"];
  const descriptors = families.flatMap(family =>
    [400, 700, 900].map(weight => `${weight} 80px "${family}"`)
  );
  const loaded = await Promise.all(descriptors.map(descriptor => document.fonts.load(descriptor)));
  await document.fonts.ready;
  if (loaded.some(records => records.length === 0) || descriptors.some(descriptor => !document.fonts.check(descriptor))) {
    throw new Error("Approved composition fonts failed to load");
  }
}

async function start() {
  syncGenerationAvailability();
  bindEvents();
  syncExportAvailability();
  try {
    await loadTypefaces();
  } catch (error) {
    fontLoadFailure = String(error?.message || error);
    fontRuntimeState = "failed";
    document.body.setAttribute("data-font-load-failure", fontLoadFailure);
    syncGenerationAvailability();
    syncExportAvailability();
    return;
  }
  fontRuntimeState = "ready";
  syncGenerationAvailability();
  render(seed);
}

const startPromise = start();
if (testMode) {
  const ready = startPromise.then(async () => {
    if (fontLoadFailure) throw new Error(fontLoadFailure);
    if (document.fonts) await document.fonts.ready;
    render(seed);
    return currentTestSnapshot();
  });
  void ready.catch(() => {});
  Object.defineProperty(window, "__MICRO_GRAPHIC_TEST__", {
    configurable: false,
    enumerable: false,
    value: Object.freeze({
      ready,
      snapshot: currentTestSnapshot,
      generation: () => activeGenerationSnapshot,
      telemetry: () => telemetryEvents,
      fontState: () => Object.freeze({ state: fontRuntimeState, failure: fontLoadFailure }),
      renderSeed(nextSeed) {
        if (!Number.isFinite(Number(nextSeed))) throw new TypeError("Seed must be a finite number");
        render(Number(nextSeed) >>> 0, { newGeneration: true });
        return currentTestSnapshot();
      },
      setRejectionMode(mode) {
        if (!["none", "ranked", "known-good", "all"].includes(mode)) throw new Error("Unknown rejection mode");
        testRejectionMode = mode;
      },
      setCandidateModes({ rankedCandidates = "normal", knownGood = "normal" } = {}) {
        if (!["normal", "none"].includes(rankedCandidates)) throw new Error("Unknown ranked candidate mode");
        if (!["normal", "none"].includes(knownGood)) throw new Error("Unknown known-good mode");
        testRankedCandidateMode = rankedCandidates;
        testKnownGoodMode = knownGood;
      },
      setPlanningFailureMode(mode) {
        if (!["none", "complexity"].includes(mode)) throw new Error("Unknown planning failure mode");
        testPlanningFailureMode = mode;
      },
      setContextFailureMode(mode) {
        if (!["none", "construction"].includes(mode)) throw new Error("Unknown context failure mode");
        testContextFailureMode = mode;
      },
      validate() {
        if (appMode === "composable-tokens" || !activePlan || !activeFinalizationReport) {
          return reportValidationResults(art, runValidationRules(art, { expectedMode: appMode }));
        }
        return reportValidationResults(art, runValidationRules(art, {
          expectedMode: appMode,
          plan: activePlan,
          finalizationReport: activeFinalizationReport,
          validationContext: activeValidationContext
        }));
      },
      refinalizeActive() {
        const component = art.querySelector("svg[data-component]");
        if (!component || !activePlan || !activeAttemptResult) return null;
        return gridFinalizer.finalizeComposition(
          component,
          activePlan,
          activeAttemptResult.envelope
        );
      },
      uniformTypographyGroupKey,
      exportPng: artworkExporter.exportPng,
      exportSvg: artworkExporter.exportSvg,
      svgText: artworkExporter.svgText,
      svgArtifact: artworkExporter.svgArtifact,
      conformance: Object.freeze({
        nodeRuntime: NODE_CONFORMANCE_RUNTIME,
        browserProfile: BROWSER_CONFORMANCE_PROFILE
      })
    })
  });
}
