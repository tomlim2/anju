import { canonicalJson, hashCanonical } from "../src/canonical-hash.js";
import {
  validateAttemptResult,
  validateGenerationInput,
  validateTerminalGenerationResult
} from "../src/composition-model.js";
import { blindPresentationRunSummary } from "./blind-evaluation-corpus-lib.mjs";

export const EVALUATION_SCHEMA_VERSION = 1;
export const BLIND_EVALUATION_SCHEMA_VERSION = 1;

const LANGUAGES = Object.freeze(["en", "ko", "zh"]);
const SCRIPTS_BY_LANGUAGE = Object.freeze({ en: "latin", ko: "hangul", zh: "han" });
const BLIND_SIDES = Object.freeze(["left", "right"]);
const BLIND_CHOICES = Object.freeze(["left", "right", "tie"]);
const HERO_FINALIZATION_CLASSES = Object.freeze(["requested", "downshifted"]);
const QUALIFICATION_BASES = Object.freeze(["native", "professional", "certified"]);
const RATING_FIELDS = Object.freeze([
  "heroClarity",
  "semanticPlausibility",
  "legibility",
  "visualInterest"
]);
const VERSION_FIELDS = Object.freeze([
  "vocabularyVersion",
  "recipeVersion",
  "motifVersion",
  "configVersion",
  "compositionEngineVersion",
  "fontMetricsVersion",
  "fontAssetRevision",
  "ownerSnapshotRevision"
]);

function fail(path, message) {
  throw new TypeError(`${path}: ${message}`);
}

function assertObject(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(path, "expected object");
}

function assertString(value, path, { nullable = false } = {}) {
  if (nullable && value === null) return;
  if (typeof value !== "string" || value.length === 0) fail(path, "expected non-empty string");
}

function assertArray(value, path) {
  if (!Array.isArray(value)) fail(path, "expected array");
}

function assertExactKeys(value, required, path) {
  const allowed = new Set(required);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(path, `unknown field ${key}`);
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) fail(path, `missing field ${key}`);
  }
}

function assertDigest(value, path) {
  if (typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/.test(value)) fail(path, "invalid digest");
}

function round9(value) {
  const rounded = Math.round(value * 1_000_000_000) / 1_000_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[midpoint]
    : (sorted[midpoint - 1] + sorted[midpoint]) / 2;
}

function versionTuple(input) {
  return Object.fromEntries(VERSION_FIELDS.map(field => [field, input[field]]));
}

function exactVersionTuple(left, right) {
  return VERSION_FIELDS.every(field => left[field] === right[field]);
}

function assertInteger(value, path, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isInteger(value) || value < min || value > max) {
    fail(path, `expected integer in range ${min}-${max}`);
  }
}

function assertEnum(value, values, path) {
  if (!values.includes(value)) fail(path, `unsupported value ${String(value)}`);
}

function assertNullableString(value, path) {
  if (value !== null) assertString(value, path);
}

function assertSortedUniqueStrings(value, path, { allowed = null, min = 0 } = {}) {
  assertArray(value, path);
  if (value.length < min) fail(path, `expected at least ${min} values`);
  const sorted = [...value].sort(compareStrings);
  if (new Set(value).size !== value.length || value.some((entry, index) => entry !== sorted[index])) {
    fail(path, "expected sorted unique strings");
  }
  value.forEach((entry, index) => {
    assertString(entry, `${path}[${index}]`);
    if (allowed && !allowed.includes(entry)) fail(`${path}[${index}]`, `unsupported value ${entry}`);
  });
}

function sameStringArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function validateEvaluationToolingEvidence(evidence, expectedProfile) {
  assertObject(evidence, "evaluationTooling");
  assertExactKeys(evidence, [
    "schemaVersion", "profile", "sourceByteHashes", "revision"
  ], "evaluationTooling");
  if (evidence.schemaVersion !== 1) fail("evaluationTooling.schemaVersion", "expected 1");
  if (evidence.profile !== expectedProfile) fail("evaluationTooling.profile", `expected ${expectedProfile}`);
  assertArray(evidence.sourceByteHashes, "evaluationTooling.sourceByteHashes");
  const paths = [];
  evidence.sourceByteHashes.forEach((record, index) => {
    const path = `evaluationTooling.sourceByteHashes[${index}]`;
    assertObject(record, path);
    assertExactKeys(record, ["path", "sha256Hex"], path);
    assertString(record.path, `${path}.path`);
    if (!/^[0-9a-f]{64}$/.test(record.sha256Hex)) fail(`${path}.sha256Hex`, "invalid raw byte hash");
    paths.push(record.path);
  });
  assertSortedUniqueStrings(paths, "evaluationTooling.sourceByteHashes.paths", { min: 1 });
  assertDigest(evidence.revision, "evaluationTooling.revision");
  const expectedRevision = hashCanonical({
    schemaVersion: evidence.schemaVersion,
    profile: evidence.profile,
    sourceByteHashes: evidence.sourceByteHashes
  });
  if (evidence.revision !== expectedRevision) fail("evaluationTooling.revision", "content digest mismatch");
  return evidence;
}

function mean(values) {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function metricComparison(candidateValues, baselineValues) {
  const candidateMean = mean(candidateValues);
  const baselineMean = mean(baselineValues);
  return {
    observationCount: candidateValues.length,
    candidateMean: candidateMean === null ? null : round9(candidateMean),
    baselineMean: baselineMean === null ? null : round9(baselineMean),
    pass: candidateMean !== null && baselineMean !== null && candidateMean >= baselineMean
  };
}

function counterbalanceRow(id, pairs) {
  const leftCount = pairs.filter(pair => pair.candidateSide === "left").length;
  const rightCount = pairs.length - leftCount;
  return {
    id,
    pairCount: pairs.length,
    leftCount,
    rightCount,
    difference: Math.abs(leftCount - rightCount),
    pass: Math.abs(leftCount - rightCount) <= 1
  };
}

function groupBy(items, keyForItem) {
  const groups = new Map();
  for (const item of items) {
    const key = keyForItem(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

export function validateExpressiveRangeInputFixture(fixture, { expectedCount = null } = {}) {
  assertObject(fixture, "expressiveRangeInputs");
  assertExactKeys(fixture, [
    "schemaVersion", "sampleSeriesId", "generationInputCount", "generationInputs"
  ], "expressiveRangeInputs");
  if (fixture.schemaVersion !== EVALUATION_SCHEMA_VERSION) fail("expressiveRangeInputs.schemaVersion", "expected 1");
  assertString(fixture.sampleSeriesId, "expressiveRangeInputs.sampleSeriesId");
  assertArray(fixture.generationInputs, "expressiveRangeInputs.generationInputs");
  if (fixture.generationInputCount !== fixture.generationInputs.length) {
    fail("expressiveRangeInputs.generationInputCount", "count mismatch");
  }
  if (expectedCount !== null && fixture.generationInputCount !== expectedCount) {
    fail("expressiveRangeInputs.generationInputCount", `expected ${expectedCount}`);
  }
  const inputIds = new Set();
  let tuple = null;
  fixture.generationInputs.forEach((input, index) => {
    validateGenerationInput(input, `expressiveRangeInputs.generationInputs[${index}]`);
    const inputId = hashCanonical(input);
    if (inputIds.has(inputId)) fail("expressiveRangeInputs.generationInputs", `duplicate input ${inputId}`);
    inputIds.add(inputId);
    const currentTuple = versionTuple(input);
    if (tuple && !exactVersionTuple(tuple, currentTuple)) {
      fail(`expressiveRangeInputs.generationInputs[${index}]`, "version tuple differs within series");
    }
    tuple ||= currentTuple;
  });
  return Object.freeze({ inputIds, versionTuple: tuple });
}

function validateInitialSelectionEvent(event, path) {
  assertExactKeys(event, [
    "population", "inputId", "rankedPlanUniverseFingerprint", "recipeOrder", "recipeStartIndex",
    "selectedRecipeId", "status", "topRankKey", "topTiePlanIds", "topTieHeroLexicalUseIds",
    "selectedPlanId", "selectedTieIndex", "selectionDrawCount", "heroLexicalUseId"
  ], path);
  assertDigest(event.inputId, `${path}.inputId`);
  assertDigest(event.rankedPlanUniverseFingerprint, `${path}.rankedPlanUniverseFingerprint`);
  assertArray(event.recipeOrder, `${path}.recipeOrder`);
  if (event.recipeOrder.length === 0 || new Set(event.recipeOrder).size !== event.recipeOrder.length) {
    fail(`${path}.recipeOrder`, "expected unique non-empty recipe order");
  }
  if (!Number.isInteger(event.recipeStartIndex) || event.recipeStartIndex < 0 || event.recipeStartIndex >= event.recipeOrder.length) {
    fail(`${path}.recipeStartIndex`, "out of range");
  }
  assertArray(event.topTiePlanIds, `${path}.topTiePlanIds`);
  assertArray(event.topTieHeroLexicalUseIds, `${path}.topTieHeroLexicalUseIds`);
  if (event.topTiePlanIds.length !== event.topTieHeroLexicalUseIds.length) {
    fail(path, "top tie plan and hero arrays differ");
  }
  if (event.status === "selected") {
    assertString(event.selectedRecipeId, `${path}.selectedRecipeId`);
    assertString(event.selectedPlanId, `${path}.selectedPlanId`);
    assertString(event.heroLexicalUseId, `${path}.heroLexicalUseId`);
    if (!Array.isArray(event.topRankKey) || event.topRankKey.length !== 6) fail(`${path}.topRankKey`, "expected RankKey");
    if (event.topTiePlanIds.length === 0) fail(`${path}.topTiePlanIds`, "selected event needs a tie set");
    if (!Number.isInteger(event.selectedTieIndex) || event.selectedTieIndex < 0 || event.selectedTieIndex >= event.topTiePlanIds.length) {
      fail(`${path}.selectedTieIndex`, "out of range");
    }
    if (event.topTiePlanIds[event.selectedTieIndex] !== event.selectedPlanId) fail(path, "selected plan is not tie member at index");
    if (event.topTieHeroLexicalUseIds[event.selectedTieIndex] !== event.heroLexicalUseId) {
      fail(path, "selected hero is not tie hero at index");
    }
    if (event.topTieHeroLexicalUseIds.some(heroId => typeof heroId !== "string" || heroId.length === 0)) {
      fail(`${path}.topTieHeroLexicalUseIds`, "selected tie heroes must be lexical IDs");
    }
    if (event.selectionDrawCount !== 1) fail(`${path}.selectionDrawCount`, "selected event consumes one draw");
  } else if (event.status === "no-candidate") {
    for (const key of ["selectedRecipeId", "topRankKey", "selectedPlanId", "selectedTieIndex", "heroLexicalUseId"]) {
      if (event[key] !== null) fail(`${path}.${key}`, "no-candidate field must be null");
    }
    if (event.topTiePlanIds.length || event.topTieHeroLexicalUseIds.length || event.selectionDrawCount !== 0) {
      fail(path, "no-candidate tie set and draw count must be empty/zero");
    }
  } else {
    fail(`${path}.status`, "expected selected or no-candidate");
  }
}

function validateAcceptedOutputEvent(event, path) {
  assertExactKeys(event, [
    "population", "inputId", "planId", "structuralFingerprint", "recipeId", "heroLexicalUseId",
    "heroLanguage", "heroScript", "heroFootprint", "heroOrientation", "heroFinalizationClass",
    "motifId", "fallbackSummary"
  ], path);
  assertDigest(event.inputId, `${path}.inputId`);
  if (!/^plan:sha256:[0-9a-f]{64}$/.test(event.planId)) fail(`${path}.planId`, "invalid plan ID");
  assertDigest(event.structuralFingerprint, `${path}.structuralFingerprint`);
  for (const key of ["recipeId", "heroLexicalUseId", "heroFootprint", "heroOrientation"]) {
    assertString(event[key], `${path}.${key}`);
  }
  if (!LANGUAGES.includes(event.heroLanguage)) fail(`${path}.heroLanguage`, "unsupported language");
  if (event.heroScript !== SCRIPTS_BY_LANGUAGE[event.heroLanguage]) fail(`${path}.heroScript`, "language/script mismatch");
  if (!["requested", "downshifted"].includes(event.heroFinalizationClass)) {
    fail(`${path}.heroFinalizationClass`, "unsupported class");
  }
  assertString(event.motifId, `${path}.motifId`, { nullable: true });
  assertObject(event.fallbackSummary, `${path}.fallbackSummary`);
  assertExactKeys(event.fallbackSummary, ["candidateSource", "fallbackTrigger", "rankedAttempts"], `${path}.fallbackSummary`);
}

export function validateTelemetrySeries(inputFixture, events) {
  const inputState = validateExpressiveRangeInputFixture(inputFixture);
  assertArray(events, "telemetryEvents");
  const grouped = new Map([...inputState.inputIds].map(inputId => [inputId, []]));
  events.forEach((event, index) => {
    const path = `telemetryEvents[${index}]`;
    assertObject(event, path);
    assertString(event.population, `${path}.population`);
    assertDigest(event.inputId, `${path}.inputId`);
    if (!grouped.has(event.inputId)) fail(`${path}.inputId`, "event input is not in fixture");
    if (event.population === "initial-selection") validateInitialSelectionEvent(event, path);
    else if (event.population === "attempt") {
      assertExactKeys(event, ["population", "inputId", "attemptResult"], path);
      validateAttemptResult(event.attemptResult, `${path}.attemptResult`);
    } else if (event.population === "accepted-output") validateAcceptedOutputEvent(event, path);
    else if (event.population === "terminal-failure") {
      assertExactKeys(event, ["population", "inputId", "terminalResult"], path);
      validateTerminalGenerationResult(event.terminalResult, `${path}.terminalResult`);
    } else fail(`${path}.population`, "unknown telemetry population");
    grouped.get(event.inputId).push(event);
  });

  for (const [inputId, inputEvents] of grouped) {
    const initial = inputEvents.filter(event => event.population === "initial-selection");
    const attempts = inputEvents.filter(event => event.population === "attempt");
    const accepted = inputEvents.filter(event => event.population === "accepted-output");
    const terminal = inputEvents.filter(event => event.population === "terminal-failure");
    if (initial.length !== 1) fail(`telemetry:${inputId}`, "expected exactly one initial-selection event");
    if (accepted.length > 1 || terminal.length > 1 || accepted.length + terminal.length !== 1) {
      fail(`telemetry:${inputId}`, "expected exactly one accepted-output or terminal-failure event");
    }
    attempts.forEach((event, index) => {
      if (event.attemptResult.envelope.attempt !== index + 1) fail(`telemetry:${inputId}`, "attempt order is not monotone");
    });
    if (accepted.length === 1) {
      const acceptedAttempt = attempts.find(event => event.attemptResult.status === "accept");
      if (!acceptedAttempt || acceptedAttempt.attemptResult.envelope.planId !== accepted[0].planId) {
        fail(`telemetry:${inputId}`, "accepted output has no matching accepted attempt");
      }
    } else {
      const last = attempts.at(-1)?.attemptResult || null;
      const terminalLast = terminal[0].terminalResult.lastAttemptResult;
      if (hashCanonical(last) !== hashCanonical(terminalLast)) fail(`telemetry:${inputId}`, "terminal last attempt differs");
    }
  }
  return Object.freeze({ grouped, versionTuple: inputState.versionTuple });
}

function implementationDistribution(initialEvents) {
  const expected = new Map();
  const observed = new Map();
  let selectedInputCount = 0;
  let noCandidateInputCount = 0;
  for (const event of initialEvents) {
    if (event.status === "no-candidate") {
      noCandidateInputCount += 1;
      continue;
    }
    selectedInputCount += 1;
    const mass = 1 / event.topTieHeroLexicalUseIds.length;
    event.topTieHeroLexicalUseIds.forEach(heroId => expected.set(heroId, (expected.get(heroId) || 0) + mass));
    observed.set(event.heroLexicalUseId, (observed.get(event.heroLexicalUseId) || 0) + 1);
  }
  const heroIds = [...new Set([...expected.keys(), ...observed.keys()])].sort(compareStrings);
  const heroes = heroIds.map(heroLexicalUseId => {
    const expectedCount = expected.get(heroLexicalUseId) || 0;
    const observedCount = observed.get(heroLexicalUseId) || 0;
    const observedExpectedRatio = expectedCount === 0 ? null : observedCount / expectedCount;
    const eligible = expectedCount >= 25;
    const pass = !eligible || (observedExpectedRatio >= 0.5 && observedExpectedRatio <= 2);
    return {
      heroLexicalUseId,
      expectedCount: round9(expectedCount),
      observedCount,
      observedExpectedRatio: observedExpectedRatio === null ? null : round9(observedExpectedRatio),
      eligible,
      pass
    };
  });
  return {
    selectedInputCount,
    noCandidateInputCount,
    heroes,
    failures: heroes.filter(hero => !hero.pass).map(hero => hero.heroLexicalUseId)
  };
}

function concentrationRows(acceptedEvents) {
  const counts = new Map();
  acceptedEvents.forEach(event => counts.set(event.heroLexicalUseId, (counts.get(event.heroLexicalUseId) || 0) + 1));
  const denominator = acceptedEvents.length;
  const nonZeroMedianCount = median([...counts.values()]);
  const nonZeroMedianRate = denominator === 0 ? 0 : nonZeroMedianCount / denominator;
  const heroes = [...counts.entries()]
    .map(([heroLexicalUseId, observedCount]) => ({
      heroLexicalUseId,
      observedCount,
      observedRate: round9(observedCount / denominator),
      medianMultiple: nonZeroMedianCount === 0 ? 0 : round9(observedCount / nonZeroMedianCount),
      concentrationTriggered: nonZeroMedianCount > 0 && observedCount > nonZeroMedianCount * 2
    }))
    .sort((left, right) => right.observedCount - left.observedCount || compareStrings(left.heroLexicalUseId, right.heroLexicalUseId));
  return {
    acceptedOutputCount: denominator,
    nonZeroMedianCount: round9(nonZeroMedianCount),
    nonZeroMedianRate: round9(nonZeroMedianRate),
    topShare: heroes[0]?.observedRate || 0,
    hhi: round9(heroes.reduce((sum, hero) => sum + hero.observedRate ** 2, 0)),
    heroes
  };
}

function mountedOutcomeRow(attemptResults) {
  const acceptedCount = attemptResults.filter(result => result.status === "accept").length;
  const rejectedCount = attemptResults.length - acceptedCount;
  return {
    attemptCount: attemptResults.length,
    acceptedCount,
    rejectedCount,
    acceptanceRate: attemptResults.length ? round9(acceptedCount / attemptResults.length) : 0,
    rejectionRate: attemptResults.length ? round9(rejectedCount / attemptResults.length) : 0
  };
}

export function summarizeMountedOutcomes(attemptEvents, {
  acceptedOutputCount = null,
  populationAttemptCount = null
} = {}) {
  const attempts = attemptEvents.map(event => event.attemptResult);
  const ranked = attempts.filter(result => result.envelope.candidateSource === "ranked");
  const knownGood = attempts.filter(result => result.envelope.candidateSource === "known-good");
  const rejectionReasonCounts = new Map();
  const fallbackTriggerCounts = new Map();
  attempts.filter(result => result.status === "reject").forEach(result => {
    result.rejectionReasons.forEach(reason => {
      rejectionReasonCounts.set(reason, (rejectionReasonCounts.get(reason) || 0) + 1);
    });
  });
  knownGood.forEach(result => {
    const trigger = result.envelope.fallbackTrigger;
    fallbackTriggerCounts.set(trigger, (fallbackTriggerCounts.get(trigger) || 0) + 1);
  });
  const overall = mountedOutcomeRow(attempts);
  const denominatorsPass = (populationAttemptCount === null || overall.attemptCount === populationAttemptCount)
    && (acceptedOutputCount === null || overall.acceptedCount === acceptedOutputCount)
    && overall.attemptCount === ranked.length + knownGood.length;
  return {
    ...overall,
    inputCounts: {
      withMountedAttempt: new Set(attemptEvents.map(event => event.inputId)).size,
      withMountedRejection: new Set(attemptEvents
        .filter(event => event.attemptResult.status === "reject")
        .map(event => event.inputId)).size,
      withKnownGoodAttempt: new Set(attemptEvents
        .filter(event => event.attemptResult.envelope.candidateSource === "known-good")
        .map(event => event.inputId)).size
    },
    ranked: mountedOutcomeRow(ranked),
    knownGood: {
      ...mountedOutcomeRow(knownGood),
      fallbackTriggers: [...fallbackTriggerCounts.entries()]
        .sort(([left], [right]) => compareStrings(left, right))
        .map(([fallbackTrigger, attemptCount]) => ({ fallbackTrigger, attemptCount }))
    },
    rejectionReasons: [...rejectionReasonCounts.entries()]
      .sort(([left], [right]) => compareStrings(left, right))
      .map(([reason, occurrenceCount]) => ({ reason, occurrenceCount })),
    denominatorsPass
  };
}

function openConcentrationReview(reportSeriesId, tuple, concentration, hero) {
  const slug = hero.heroLexicalUseId.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  return {
    schemaVersion: 1,
    id: `concentration:${reportSeriesId}:${slug}`,
    reportSeriesId,
    ...tuple,
    heroLexicalUseId: hero.heroLexicalUseId,
    trigger: {
      observedRate: hero.observedRate,
      nonZeroMedianRate: concentration.nonZeroMedianRate,
      multiple: hero.medianMultiple
    },
    status: "open",
    disposition: null,
    reviewerIds: [],
    evidence: null,
    successorReportSeriesId: null
  };
}

function validateConcentrationReview(review, path) {
  assertObject(review, path);
  assertExactKeys(review, [
    "schemaVersion", "id", "reportSeriesId", ...VERSION_FIELDS, "heroLexicalUseId", "trigger",
    "status", "disposition", "reviewerIds", "evidence", "successorReportSeriesId"
  ], path);
  if (review.schemaVersion !== 1) fail(`${path}.schemaVersion`, "expected 1");
  assertString(review.id, `${path}.id`);
  assertString(review.reportSeriesId, `${path}.reportSeriesId`);
  assertString(review.heroLexicalUseId, `${path}.heroLexicalUseId`);
  assertObject(review.trigger, `${path}.trigger`);
  assertArray(review.reviewerIds, `${path}.reviewerIds`);
  if (review.status === "open") {
    if (
      review.disposition !== null
      || review.reviewerIds.length !== 0
      || review.evidence !== null
      || review.successorReportSeriesId !== null
    ) fail(path, "open review cannot carry a disposition");
  } else if (review.status === "resolved") {
    if (!["approved-curation", "vocabulary-fix", "planner-fix"].includes(review.disposition)) {
      fail(`${path}.disposition`, "unknown resolved disposition");
    }
    assertString(review.evidence, `${path}.evidence`);
    if (review.disposition === "approved-curation") {
      if (review.reviewerIds.length !== 2 || new Set(review.reviewerIds).size !== 2) {
        fail(`${path}.reviewerIds`, "approved curation requires two distinct reviewers");
      }
      if (review.successorReportSeriesId !== null) fail(`${path}.successorReportSeriesId`, "approved curation has no successor");
    } else {
      assertString(review.successorReportSeriesId, `${path}.successorReportSeriesId`);
    }
  } else fail(`${path}.status`, "expected open or resolved");
}

function validateCurationReviewerDirectory(directorySet) {
  assertObject(directorySet, "curationReviewerDirectory");
  assertExactKeys(directorySet, [
    "schemaVersion", "directoryId", "verifiedAt", "reviewers"
  ], "curationReviewerDirectory");
  if (directorySet.schemaVersion !== 1) fail("curationReviewerDirectory.schemaVersion", "expected 1");
  assertString(directorySet.directoryId, "curationReviewerDirectory.directoryId");
  assertString(directorySet.verifiedAt, "curationReviewerDirectory.verifiedAt");
  if (!Number.isFinite(Date.parse(directorySet.verifiedAt))) {
    fail("curationReviewerDirectory.verifiedAt", "expected ISO timestamp");
  }
  const directory = directorySet.reviewers;
  assertArray(directory, "curationReviewerDirectory.reviewers");
  const byId = new Map();
  directory.forEach((record, index) => {
    const path = `curationReviewerDirectory.reviewers[${index}]`;
    assertObject(record, path);
    assertExactKeys(record, ["reviewerId", "role", "verifiedBy", "verifiedAt"], path);
    assertString(record.reviewerId, `${path}.reviewerId`);
    assertEnum(record.role, ["typography", "product"], `${path}.role`);
    assertString(record.verifiedBy, `${path}.verifiedBy`);
    assertString(record.verifiedAt, `${path}.verifiedAt`);
    if (!Number.isFinite(Date.parse(record.verifiedAt))) fail(`${path}.verifiedAt`, "expected ISO timestamp");
    if (byId.has(record.reviewerId)) fail(path, "duplicate reviewer ID");
    byId.set(record.reviewerId, record);
  });
  return byId;
}

function validateSuccessorReportSet(reportSet) {
  assertObject(reportSet, "successorReportSet");
  assertExactKeys(reportSet, ["schemaVersion", "reportSetId", "reports"], "successorReportSet");
  if (reportSet.schemaVersion !== 1) fail("successorReportSet.schemaVersion", "expected 1");
  assertString(reportSet.reportSetId, "successorReportSet.reportSetId");
  assertArray(reportSet.reports, "successorReportSet.reports");
  const reportIds = reportSet.reports.map((report, index) => {
    validateCompleteSuccessorReport(report, `successorReportSet.reports[${index}]`);
    return report.reportSeriesId;
  });
  if (new Set(reportIds).size !== reportIds.length) fail("successorReportSet.reports", "duplicate report series");
  return reportSet.reports;
}

function validateCompleteSuccessorReport(report, path) {
  assertObject(report, path);
  assertExactKeys(report, [
    "schemaVersion", "reportSeriesId", "inputFixtureSha256", "inputCount", "versionTuple",
    "eventArtifact", "evaluationTooling", "curationReviewerDirectoryRevision",
    "successorReportSetRevision", "populationCounts", "implementationDistribution",
    "mountedOutcomeDistribution", "editorialConcentration", "concentrationReviews", "acceptance"
  ], path);
  if (report.schemaVersion !== EVALUATION_SCHEMA_VERSION) fail(`${path}.schemaVersion`, "expected 1");
  assertString(report.reportSeriesId, `${path}.reportSeriesId`);
  assertDigest(report.inputFixtureSha256, `${path}.inputFixtureSha256`);
  if (report.inputCount !== 10_000) fail(`${path}.inputCount`, "successor must contain the official 10,000 inputs");
  assertObject(report.versionTuple, `${path}.versionTuple`);
  assertExactKeys(report.versionTuple, VERSION_FIELDS, `${path}.versionTuple`);
  VERSION_FIELDS.slice(0, 6).forEach(field => assertInteger(
    report.versionTuple[field],
    `${path}.versionTuple.${field}`,
    { min: 1 }
  ));
  assertDigest(report.versionTuple.fontAssetRevision, `${path}.versionTuple.fontAssetRevision`);
  assertDigest(report.versionTuple.ownerSnapshotRevision, `${path}.versionTuple.ownerSnapshotRevision`);
  assertObject(report.eventArtifact, `${path}.eventArtifact`);
  assertExactKeys(report.eventArtifact, ["path", "sha256", "recordCount"], `${path}.eventArtifact`);
  assertString(report.eventArtifact.path, `${path}.eventArtifact.path`);
  assertDigest(report.eventArtifact.sha256, `${path}.eventArtifact.sha256`);
  assertInteger(report.eventArtifact.recordCount, `${path}.eventArtifact.recordCount`, { min: 10_000 });
  validateEvaluationToolingEvidence(report.evaluationTooling, "expressive-range-v1");
  assertDigest(report.curationReviewerDirectoryRevision, `${path}.curationReviewerDirectoryRevision`);
  assertDigest(report.successorReportSetRevision, `${path}.successorReportSetRevision`);
  assertObject(report.populationCounts, `${path}.populationCounts`);
  const populationIds = ["initial-selection", "attempt", "accepted-output", "terminal-failure"];
  assertExactKeys(report.populationCounts, populationIds, `${path}.populationCounts`);
  populationIds.forEach(population => assertInteger(
    report.populationCounts[population],
    `${path}.populationCounts.${population}`,
    { min: 0 }
  ));
  if (
    report.populationCounts["initial-selection"] !== report.inputCount
    || report.populationCounts["accepted-output"] + report.populationCounts["terminal-failure"] !== report.inputCount
    || Object.values(report.populationCounts).reduce((sum, value) => sum + value, 0) !== report.eventArtifact.recordCount
  ) fail(`${path}.populationCounts`, "successor telemetry denominators are incomplete");
  assertObject(report.implementationDistribution, `${path}.implementationDistribution`);
  assertArray(report.implementationDistribution.heroes, `${path}.implementationDistribution.heroes`);
  assertArray(report.implementationDistribution.failures, `${path}.implementationDistribution.failures`);
  if (report.implementationDistribution.failures.length !== 0) {
    fail(`${path}.implementationDistribution.failures`, "successor implementation distribution still fails");
  }
  assertObject(report.mountedOutcomeDistribution, `${path}.mountedOutcomeDistribution`);
  if (
    report.mountedOutcomeDistribution.attemptCount !== report.populationCounts.attempt
    || report.mountedOutcomeDistribution.acceptedCount !== report.populationCounts["accepted-output"]
    || report.mountedOutcomeDistribution.denominatorsPass !== true
  ) fail(`${path}.mountedOutcomeDistribution`, "mounted outcome denominators are incomplete");
  const concentration = report.editorialConcentration;
  assertObject(concentration, `${path}.editorialConcentration`);
  assertExactKeys(concentration, [
    "acceptedOutputCount", "nonZeroMedianCount", "nonZeroMedianRate", "topShare", "hhi", "heroes"
  ], `${path}.editorialConcentration`);
  assertInteger(concentration.acceptedOutputCount, `${path}.editorialConcentration.acceptedOutputCount`, { min: 1 });
  if (concentration.acceptedOutputCount !== report.populationCounts["accepted-output"]) {
    fail(`${path}.editorialConcentration.acceptedOutputCount`, "accepted population mismatch");
  }
  assertArray(concentration.heroes, `${path}.editorialConcentration.heroes`);
  const heroIds = new Set();
  let observedTotal = 0;
  concentration.heroes.forEach((hero, index) => {
    const heroPath = `${path}.editorialConcentration.heroes[${index}]`;
    assertObject(hero, heroPath);
    assertExactKeys(hero, [
      "heroLexicalUseId", "observedCount", "observedRate", "medianMultiple", "concentrationTriggered"
    ], heroPath);
    assertString(hero.heroLexicalUseId, `${heroPath}.heroLexicalUseId`);
    if (heroIds.has(hero.heroLexicalUseId)) fail(heroPath, "duplicate hero ID");
    heroIds.add(hero.heroLexicalUseId);
    assertInteger(hero.observedCount, `${heroPath}.observedCount`, { min: 1 });
    observedTotal += hero.observedCount;
  });
  if (observedTotal !== concentration.acceptedOutputCount) {
    fail(`${path}.editorialConcentration.heroes`, "hero counts do not cover accepted outputs");
  }
  const medianCount = median(concentration.heroes.map(hero => hero.observedCount));
  if (concentration.nonZeroMedianCount !== round9(medianCount)) {
    fail(`${path}.editorialConcentration.nonZeroMedianCount`, "median count mismatch");
  }
  concentration.heroes.forEach((hero, index) => {
    const expectedTriggered = hero.observedCount > medianCount * 2;
    if (hero.concentrationTriggered !== expectedTriggered) {
      fail(`${path}.editorialConcentration.heroes[${index}].concentrationTriggered`, "trigger differs from counts");
    }
  });
  assertArray(report.concentrationReviews, `${path}.concentrationReviews`);
  assertObject(report.acceptance, `${path}.acceptance`);
  if (report.acceptance.pass !== true) fail(`${path}.acceptance.pass`, "successor report must pass all gates");
}

function validateConcentrationResolution(review, {
  successorReports,
  curationReviewerById
}, path) {
  if (review.status !== "resolved") return;
  if (review.disposition === "approved-curation") {
    const roles = review.reviewerIds.map(reviewerId => {
      const reviewer = curationReviewerById.get(reviewerId);
      if (!reviewer) fail(`${path}.reviewerIds`, `unverified reviewer ${reviewerId}`);
      return reviewer.role;
    }).sort(compareStrings);
    if (!sameStringArray(roles, ["product", "typography"])) {
      fail(`${path}.reviewerIds`, "approved curation requires verified product and typography roles");
    }
    return;
  }
  const successor = successorReports.find(report =>
    report?.reportSeriesId === review.successorReportSeriesId
  );
  if (!successor) fail(`${path}.successorReportSeriesId`, "successor report is not available");
  assertObject(successor.versionTuple, `${path}.successor.versionTuple`);
  assertObject(successor.editorialConcentration, `${path}.successor.editorialConcentration`);
  assertArray(successor.editorialConcentration.heroes, `${path}.successor.editorialConcentration.heroes`);
  if (
    successor.reportSeriesId === review.reportSeriesId
    || successor.versionTuple.ownerSnapshotRevision === review.ownerSnapshotRevision
  ) fail(`${path}.successorReportSeriesId`, "successor must use a new series and owner snapshot");
  const versionField = review.disposition === "vocabulary-fix"
    ? "vocabularyVersion"
    : "compositionEngineVersion";
  if (
    !Number.isInteger(successor.versionTuple[versionField])
    || successor.versionTuple[versionField] <= review[versionField]
  ) fail(`${path}.successor.versionTuple.${versionField}`, "corresponding owner version did not increase");
  const successorHeroes = successor.editorialConcentration.heroes.filter(hero =>
    hero.heroLexicalUseId === review.heroLexicalUseId
  );
  if (successorHeroes.length !== 1) {
    fail(`${path}.successorReportSeriesId`, "successor must contain the exact affected hero");
  }
  if (successorHeroes[0].concentrationTriggered) {
    fail(`${path}.successorReportSeriesId`, "successor still triggers the same hero concentration");
  }
}

export function validateConcentrationReviewEvidence({
  review,
  successorReportSet,
  curationReviewerDirectory
}) {
  validateConcentrationReview(review, "concentrationReview");
  const successorReports = validateSuccessorReportSet(successorReportSet);
  const curationReviewerById = validateCurationReviewerDirectory(curationReviewerDirectory);
  validateConcentrationResolution(review, {
    successorReports,
    curationReviewerById
  }, "concentrationReview");
  return true;
}

export function buildExpressiveRangeReport({
  inputFixture,
  events,
  eventArtifact,
  evaluationTooling,
  reviewOverrides = [],
  successorReportSet,
  curationReviewerDirectory
}) {
  const telemetry = validateTelemetrySeries(inputFixture, events);
  assertObject(eventArtifact, "eventArtifact");
  assertExactKeys(eventArtifact, ["path", "sha256", "recordCount"], "eventArtifact");
  assertString(eventArtifact.path, "eventArtifact.path");
  assertDigest(eventArtifact.sha256, "eventArtifact.sha256");
  if (eventArtifact.recordCount !== events.length) fail("eventArtifact.recordCount", "event count mismatch");
  const populations = Object.fromEntries(
    ["initial-selection", "attempt", "accepted-output", "terminal-failure"].map(population => [
      population,
      events.filter(event => event.population === population).length
    ])
  );
  const initialEvents = events.filter(event => event.population === "initial-selection");
  const attemptEvents = events.filter(event => event.population === "attempt");
  const acceptedEvents = events.filter(event => event.population === "accepted-output");
  const implementation = implementationDistribution(initialEvents);
  const concentration = concentrationRows(acceptedEvents);
  const mountedOutcomes = summarizeMountedOutcomes(attemptEvents, {
    acceptedOutputCount: populations["accepted-output"],
    populationAttemptCount: populations.attempt
  });
  validateEvaluationToolingEvidence(evaluationTooling, "expressive-range-v1");
  const successorReports = validateSuccessorReportSet(successorReportSet);
  const curationReviewerById = validateCurationReviewerDirectory(curationReviewerDirectory);
  const overrideByHero = new Map(reviewOverrides.map(review => [review.heroLexicalUseId, review]));
  const concentrationReviews = concentration.heroes
    .filter(hero => hero.concentrationTriggered)
    .map(hero => {
      const review = overrideByHero.get(hero.heroLexicalUseId)
        || openConcentrationReview(inputFixture.sampleSeriesId, telemetry.versionTuple, concentration, hero);
      validateConcentrationReview(review, `concentrationReview:${hero.heroLexicalUseId}`);
      if (
        review.reportSeriesId !== inputFixture.sampleSeriesId
        || review.heroLexicalUseId !== hero.heroLexicalUseId
        || !exactVersionTuple(review, telemetry.versionTuple)
      ) fail(`concentrationReview:${hero.heroLexicalUseId}`, "review identity differs from triggered series");
      validateConcentrationReviewEvidence({
        review,
        successorReportSet,
        curationReviewerDirectory
      });
      return review;
    });
  if (concentrationReviews.length !== overrideByHero.size) {
    const unused = [...overrideByHero.keys()].filter(heroId =>
      !concentrationReviews.some(review => review.heroLexicalUseId === heroId)
    );
    if (unused.length) fail("concentrationReviews", `review without trigger: ${unused.join(", ")}`);
  }
  const openReviewCount = concentrationReviews.filter(review => review.status === "open").length;
  return {
    schemaVersion: EVALUATION_SCHEMA_VERSION,
    reportSeriesId: inputFixture.sampleSeriesId,
    inputFixtureSha256: hashCanonical(inputFixture),
    inputCount: inputFixture.generationInputCount,
    versionTuple: telemetry.versionTuple,
    eventArtifact,
    evaluationTooling,
    curationReviewerDirectoryRevision: hashCanonical(curationReviewerDirectory),
    successorReportSetRevision: hashCanonical(successorReportSet),
    populationCounts: populations,
    implementationDistribution: implementation,
    mountedOutcomeDistribution: mountedOutcomes,
    editorialConcentration: concentration,
    concentrationReviews,
    acceptance: {
      inputCountPass: inputFixture.generationInputCount === 10_000,
      telemetryDenominatorsPass: populations["initial-selection"] === inputFixture.generationInputCount
        && populations["accepted-output"] + populations["terminal-failure"] === inputFixture.generationInputCount,
      implementationDistributionPass: implementation.failures.length === 0,
      mountedOutcomeDenominatorsPass: mountedOutcomes.denominatorsPass,
      openConcentrationReviewCount: openReviewCount,
      pass: inputFixture.generationInputCount === 10_000
        && populations["initial-selection"] === inputFixture.generationInputCount
        && populations["accepted-output"] + populations["terminal-failure"] === inputFixture.generationInputCount
        && implementation.failures.length === 0
        && mountedOutcomes.denominatorsPass
        && openReviewCount === 0
    }
  };
}

export function blindNodeFingerprint({
  artifactSha256,
  rootToNodeOrdinalPath,
  slotInstanceId,
  lexicalUseId
}) {
  assertDigest(artifactSha256, "blindNode.artifactSha256");
  assertString(rootToNodeOrdinalPath, "blindNode.rootToNodeOrdinalPath");
  if (!/^0(?:\.\d+)*$/.test(rootToNodeOrdinalPath)) {
    fail("blindNode.rootToNodeOrdinalPath", "expected a root-relative ordinal path");
  }
  assertString(slotInstanceId, "blindNode.slotInstanceId");
  assertString(lexicalUseId, "blindNode.lexicalUseId");
  return hashCanonical({ artifactSha256, rootToNodeOrdinalPath, slotInstanceId, lexicalUseId });
}

function validateArtifactDescriptor(descriptor, path) {
  assertObject(descriptor, path);
  assertExactKeys(descriptor, ["path", "sha256", "byteLength"], path);
  assertString(descriptor.path, `${path}.path`);
  if (descriptor.path.startsWith("/") || descriptor.path.split("/").includes("..")) {
    fail(`${path}.path`, "artifact path must be repository-relative");
  }
  assertDigest(descriptor.sha256, `${path}.sha256`);
  assertInteger(descriptor.byteLength, `${path}.byteLength`, { min: 1 });
}

function validateScanEvidenceDescriptor(descriptor, path) {
  assertObject(descriptor, path);
  assertExactKeys(descriptor, ["path", "sha256", "byteLength", "revision"], path);
  assertString(descriptor.path, `${path}.path`);
  if (descriptor.path.startsWith("/") || descriptor.path.split("/").includes("..")) {
    fail(`${path}.path`, "artifact path must be repository-relative");
  }
  assertDigest(descriptor.sha256, `${path}.sha256`);
  assertInteger(descriptor.byteLength, `${path}.byteLength`, { min: 1 });
  assertDigest(descriptor.revision, `${path}.revision`);
}

export function validateBlindDisplayManifest(display, { corpus = null } = {}) {
  assertObject(display, "blindDisplay");
  assertExactKeys(display, [
    "schemaVersion", "corpusId", "corpusSha256", "translationErrorLedgerRevision", "frozenAt", "fixtures"
  ], "blindDisplay");
  if (display.schemaVersion !== BLIND_EVALUATION_SCHEMA_VERSION) {
    fail("blindDisplay.schemaVersion", "expected 1");
  }
  assertString(display.corpusId, "blindDisplay.corpusId");
  assertDigest(display.corpusSha256, "blindDisplay.corpusSha256");
  assertDigest(display.translationErrorLedgerRevision, "blindDisplay.translationErrorLedgerRevision");
  assertString(display.frozenAt, "blindDisplay.frozenAt");
  if (!Number.isFinite(Date.parse(display.frozenAt))) fail("blindDisplay.frozenAt", "expected ISO timestamp");
  assertArray(display.fixtures, "blindDisplay.fixtures");
  if (display.fixtures.length === 0) fail("blindDisplay.fixtures", "expected at least one fixture");
  const fixtureIds = new Set();
  const artifactPaths = new Set();
  display.fixtures.forEach((fixture, index) => {
    const path = `blindDisplay.fixtures[${index}]`;
    assertObject(fixture, path);
    assertExactKeys(fixture, ["fixtureId", "evaluatedLanguages", "left", "right"], path);
    if (!/^blind-\d{3,}$/.test(fixture.fixtureId)) fail(`${path}.fixtureId`, "expected opaque blind ID");
    if (fixtureIds.has(fixture.fixtureId)) fail("blindDisplay.fixtures", `duplicate fixture ${fixture.fixtureId}`);
    fixtureIds.add(fixture.fixtureId);
    assertSortedUniqueStrings(fixture.evaluatedLanguages, `${path}.evaluatedLanguages`, {
      allowed: LANGUAGES,
      min: 1
    });
    for (const side of BLIND_SIDES) {
      assertObject(fixture[side], `${path}.${side}`);
      assertExactKeys(fixture[side], ["fingerprint", "svg", "png"], `${path}.${side}`);
      assertDigest(fixture[side].fingerprint, `${path}.${side}.fingerprint`);
      for (const extension of ["svg", "png"]) {
        const descriptor = fixture[side][extension];
        validateArtifactDescriptor(descriptor, `${path}.${side}.${extension}`);
        if (!descriptor.path.endsWith(`/${fixture.fixtureId}.${side}.${extension}`)) {
          fail(`${path}.${side}.${extension}.path`, "path must use only opaque fixture ID and display side");
        }
        if (artifactPaths.has(descriptor.path)) fail("blindDisplay.fixtures", `duplicate artifact path ${descriptor.path}`);
        artifactPaths.add(descriptor.path);
      }
    }
  });
  if (/(candidate|baseline|recipeId|motifId|heroFinalizationClass)/i.test(canonicalJson(display))) {
    fail("blindDisplay", "source or stratum metadata is exposed");
  }
  if (corpus !== null) {
    validateBlindCorpus(corpus);
    if (display.corpusId !== corpus.corpusId || display.frozenAt !== corpus.frozenAt) {
      fail("blindDisplay", "corpus identity differs from frozen corpus");
    }
    if (
      display.corpusSha256 !== hashCanonical(corpus)
      || display.translationErrorLedgerRevision !== corpus.translationErrorLedgerRevision
    ) fail("blindDisplay", "corpus digest or ledger revision differs from frozen corpus");
    if (display.fixtures.length !== corpus.pairs.length) fail("blindDisplay.fixtures", "corpus count mismatch");
    display.fixtures.forEach((fixture, index) => {
      const pair = corpus.pairs[index];
      if (fixture.fixtureId !== pair.fixtureId) fail(`blindDisplay.fixtures[${index}]`, "corpus order mismatch");
      if (!sameStringArray(fixture.evaluatedLanguages, pair.candidate.evaluatedLanguages)) {
        fail(`blindDisplay.fixtures[${index}].evaluatedLanguages`, "corpus language mismatch");
      }
      for (const side of BLIND_SIDES) {
        const source = pair.candidateSide === side ? pair.candidate : pair.baseline;
        if (fixture[side].fingerprint !== source.fingerprint) {
          fail(`blindDisplay.fixtures[${index}].${side}.fingerprint`, "corpus fingerprint mismatch");
        }
      }
    });
  }
  return display;
}

function validateExpectedHeroNode(node, artifactSha256, path) {
  assertObject(node, path);
  assertExactKeys(node, [
    "slotInstanceId", "lexicalUseId", "language", "script", "nodeFingerprint",
    "rootToNodeOrdinalPath", "visibleText"
  ], path);
  for (const field of ["slotInstanceId", "lexicalUseId", "rootToNodeOrdinalPath", "visibleText"]) {
    assertString(node[field], `${path}.${field}`);
  }
  assertDigest(node.nodeFingerprint, `${path}.nodeFingerprint`);
  assertEnum(node.language, LANGUAGES, `${path}.language`);
  if (node.script !== SCRIPTS_BY_LANGUAGE[node.language]) fail(`${path}.script`, "language/script mismatch");
  const expected = blindNodeFingerprint({
    artifactSha256,
    rootToNodeOrdinalPath: node.rootToNodeOrdinalPath,
    slotInstanceId: node.slotInstanceId,
    lexicalUseId: node.lexicalUseId
  });
  if (node.nodeFingerprint !== expected) fail(`${path}.nodeFingerprint`, "does not match stable node identity");
}

function validateBaselineReplayInput(input, path) {
  assertObject(input, path);
  assertExactKeys(input, [
    "schemaVersion", "seed", "generationTimestamp", "ratio", "borderMode", "viewport", "safeBox",
    "baselineCommit", "adapterContractVersion", "adapterRevision"
  ], path);
  if (input.schemaVersion !== 1) fail(`${path}.schemaVersion`, "expected 1");
  assertInteger(input.seed, `${path}.seed`, { min: 0 });
  assertString(input.generationTimestamp, `${path}.generationTimestamp`);
  if (!Number.isFinite(Date.parse(input.generationTimestamp))) fail(`${path}.generationTimestamp`, "expected ISO timestamp");
  assertString(input.ratio, `${path}.ratio`);
  assertString(input.borderMode, `${path}.borderMode`);
  assertObject(input.viewport, `${path}.viewport`);
  assertExactKeys(input.viewport, ["width", "height", "devicePixelRatio"], `${path}.viewport`);
  assertInteger(input.viewport.width, `${path}.viewport.width`, { min: 1 });
  assertInteger(input.viewport.height, `${path}.viewport.height`, { min: 1 });
  if (!Number.isFinite(input.viewport.devicePixelRatio) || input.viewport.devicePixelRatio <= 0) {
    fail(`${path}.viewport.devicePixelRatio`, "expected a finite positive number");
  }
  assertObject(input.safeBox, `${path}.safeBox`);
  assertExactKeys(input.safeBox, ["x", "y", "width", "height"], `${path}.safeBox`);
  for (const field of ["x", "y", "width", "height"]) {
    if (!Number.isFinite(input.safeBox[field]) || input.safeBox[field] < 0) {
      fail(`${path}.safeBox.${field}`, "expected a non-negative finite number");
    }
  }
  assertString(input.baselineCommit, `${path}.baselineCommit`);
  assertInteger(input.adapterContractVersion, `${path}.adapterContractVersion`, { min: 1 });
  assertDigest(input.adapterRevision, `${path}.adapterRevision`);
}

function validateBlindArtifactSide(side, source, path) {
  assertObject(side, path);
  assertExactKeys(side, [
    "revision", "evaluatedLanguages", source === "candidate" ? "generationInput" : "replayInput", "viewportSafeBoxBasis",
    "fingerprint", "expectedHeroNode", "svg", "png"
  ], path);
  assertString(side.revision, `${path}.revision`);
  assertSortedUniqueStrings(side.evaluatedLanguages, `${path}.evaluatedLanguages`, {
    allowed: LANGUAGES,
    min: 1
  });
  if (source === "candidate") {
    validateGenerationInput(side.generationInput, `${path}.generationInput`);
    if (side.viewportSafeBoxBasis !== "captured-in-generation-input") {
      fail(`${path}.viewportSafeBoxBasis`, "expected captured-in-generation-input");
    }
  } else {
    validateBaselineReplayInput(side.replayInput, `${path}.replayInput`);
    if (side.viewportSafeBoxBasis !== "captured-from-baseline-runtime") {
      fail(`${path}.viewportSafeBoxBasis`, "expected captured-from-baseline-runtime");
    }
  }
  assertDigest(side.fingerprint, `${path}.fingerprint`);
  validateArtifactDescriptor(side.svg, `${path}.svg`);
  validateArtifactDescriptor(side.png, `${path}.png`);
  validateExpectedHeroNode(side.expectedHeroNode, side.svg.sha256, `${path}.expectedHeroNode`);
  return side;
}

function stratumId(stratum) {
  return `${stratum.recipeId}/${stratum.heroLanguage}/${stratum.heroScript}`;
}

function visualCellId(cell) {
  return cell ? `${cell.motifId}/${cell.heroFinalizationClass}` : null;
}

export function blindPairIdentityRevision(pair) {
  const { identityRevision: _identityRevision, ...payload } = pair;
  return hashCanonical(payload);
}

export function blindCorpusPairIdentityRoot(pairs) {
  return hashCanonical(pairs.map(pair => ({
    fixtureId: pair.fixtureId,
    identityRevision: pair.identityRevision
  })));
}

export function validateBlindPairFixture(pair, {
  activeRecipeIds = ["command", "status"],
  activeMotifIds = ["motif.barcode", "motif.pseudo-qr", "motif.table", "motif.wave"]
} = {}) {
  assertObject(pair, "blindPair");
  assertExactKeys(pair, [
    "schemaVersion", "fixtureId", "stratum", "visualHierarchyCell", "candidateSide",
    "baseline", "candidate", "identityRevision"
  ], "blindPair");
  if (pair.schemaVersion !== BLIND_EVALUATION_SCHEMA_VERSION) fail("blindPair.schemaVersion", "expected 1");
  assertString(pair.fixtureId, "blindPair.fixtureId");
  assertDigest(pair.identityRevision, "blindPair.identityRevision");
  if (pair.identityRevision !== blindPairIdentityRevision(pair)) {
    fail("blindPair.identityRevision", "pair content identity mismatch");
  }
  assertObject(pair.stratum, "blindPair.stratum");
  assertExactKeys(pair.stratum, ["recipeId", "heroLanguage", "heroScript"], "blindPair.stratum");
  assertEnum(pair.stratum.recipeId, activeRecipeIds, "blindPair.stratum.recipeId");
  assertEnum(pair.stratum.heroLanguage, LANGUAGES, "blindPair.stratum.heroLanguage");
  if (pair.stratum.heroScript !== SCRIPTS_BY_LANGUAGE[pair.stratum.heroLanguage]) {
    fail("blindPair.stratum.heroScript", "language/script mismatch");
  }
  if (pair.visualHierarchyCell !== null) {
    assertObject(pair.visualHierarchyCell, "blindPair.visualHierarchyCell");
    assertExactKeys(pair.visualHierarchyCell, ["motifId", "heroFinalizationClass"], "blindPair.visualHierarchyCell");
    assertEnum(pair.visualHierarchyCell.motifId, activeMotifIds, "blindPair.visualHierarchyCell.motifId");
    assertEnum(
      pair.visualHierarchyCell.heroFinalizationClass,
      HERO_FINALIZATION_CLASSES,
      "blindPair.visualHierarchyCell.heroFinalizationClass"
    );
  }
  assertEnum(pair.candidateSide, BLIND_SIDES, "blindPair.candidateSide");
  validateBlindArtifactSide(pair.baseline, "baseline", "blindPair.baseline");
  validateBlindArtifactSide(pair.candidate, "candidate", "blindPair.candidate");
  const baselineInput = pair.baseline.replayInput;
  const candidateInput = pair.candidate.generationInput;
  for (const field of ["seed", "generationTimestamp", "ratio", "borderMode"]) {
    if (baselineInput[field] !== candidateInput[field]) fail("blindPair", `${field} parity mismatch`);
  }
  if (hashCanonical(baselineInput.viewport) !== hashCanonical(candidateInput.viewport)) {
    fail("blindPair", "viewport parity mismatch");
  }
  if (!sameStringArray(pair.baseline.evaluatedLanguages, pair.candidate.evaluatedLanguages)) {
    fail("blindPair", "evaluated language manifests differ");
  }
  if (!pair.candidate.evaluatedLanguages.includes(pair.stratum.heroLanguage)) {
    fail("blindPair.candidate.evaluatedLanguages", "hero language is missing");
  }
  for (const source of ["baseline", "candidate"]) {
    const expectedHero = pair[source].expectedHeroNode;
    if (
      expectedHero.language !== pair.stratum.heroLanguage
      || expectedHero.script !== pair.stratum.heroScript
    ) fail(`blindPair.${source}.expectedHeroNode`, "hero language/script differs from stratum");
  }
  return pair;
}

export function validateBlindCorpus(corpus, options = {}) {
  assertObject(corpus, "blindCorpus");
  assertExactKeys(corpus, [
    "schemaVersion", "corpusId", "frozenAt", "baselineRevision", "candidateRevision",
    "translationErrorLedgerRevision", "scanEvidence", "pairIdentityRoot", "pairs"
  ], "blindCorpus");
  if (corpus.schemaVersion !== BLIND_EVALUATION_SCHEMA_VERSION) fail("blindCorpus.schemaVersion", "expected 1");
  for (const field of ["corpusId", "frozenAt", "baselineRevision", "candidateRevision"]) {
    assertString(corpus[field], `blindCorpus.${field}`);
  }
  assertDigest(corpus.translationErrorLedgerRevision, "blindCorpus.translationErrorLedgerRevision");
  validateScanEvidenceDescriptor(corpus.scanEvidence, "blindCorpus.scanEvidence");
  assertDigest(corpus.pairIdentityRoot, "blindCorpus.pairIdentityRoot");
  if (!Number.isFinite(Date.parse(corpus.frozenAt))) fail("blindCorpus.frozenAt", "expected ISO timestamp");
  assertArray(corpus.pairs, "blindCorpus.pairs");
  const fixtureIds = new Set();
  corpus.pairs.forEach((pair, index) => {
    validateBlindPairFixture(pair, options);
    if (fixtureIds.has(pair.fixtureId)) fail("blindCorpus.pairs", `duplicate fixture ${pair.fixtureId}`);
    fixtureIds.add(pair.fixtureId);
    if (pair.baseline.revision !== corpus.baselineRevision) fail(`blindCorpus.pairs[${index}]`, "baseline revision mismatch");
    if (pair.candidate.revision !== corpus.candidateRevision) fail(`blindCorpus.pairs[${index}]`, "candidate revision mismatch");
  });
  const expectedPairIdentityRoot = blindCorpusPairIdentityRoot(corpus.pairs);
  if (corpus.pairIdentityRoot !== expectedPairIdentityRoot) {
    fail("blindCorpus.pairIdentityRoot", "ordered pair identity root mismatch");
  }
  const expectedCorpusId = `blind-evaluation:v1:${expectedPairIdentityRoot.slice("sha256:".length, 25)}`;
  if (corpus.corpusId !== expectedCorpusId) fail("blindCorpus.corpusId", "must derive from pair identity root");

  const activeRecipeIds = options.activeRecipeIds || ["command", "status"];
  const activeMotifIds = options.activeMotifIds || [
    "motif.barcode", "motif.pseudo-qr", "motif.table", "motif.wave"
  ];
  const requiredStrata = activeRecipeIds.flatMap(recipeId => LANGUAGES.map(heroLanguage =>
    `${recipeId}/${heroLanguage}/${SCRIPTS_BY_LANGUAGE[heroLanguage]}`
  ));
  const requiredCells = activeMotifIds.flatMap(motifId => HERO_FINALIZATION_CLASSES.map(heroFinalizationClass =>
    `${motifId}/${heroFinalizationClass}`
  ));
  const strataGroups = groupBy(corpus.pairs, pair => stratumId(pair.stratum));
  const cellGroups = groupBy(
    corpus.pairs.filter(pair => pair.visualHierarchyCell !== null),
    pair => visualCellId(pair.visualHierarchyCell)
  );
  const ratioGroups = groupBy(corpus.pairs, pair => pair.candidate.generationInput.ratio);
  const coverage = {
    pairCount: corpus.pairs.length,
    minimumPairCountPass: corpus.pairs.length >= 60,
    presentationRuns: blindPresentationRunSummary(corpus.pairs),
    strata: requiredStrata.map(id => ({ id, pairCount: strataGroups.get(id)?.length || 0 })),
    visualHierarchyCells: requiredCells.map(id => ({ id, pairCount: cellGroups.get(id)?.length || 0 }))
  };
  coverage.linguisticCoveragePass = coverage.strata.every(row => row.pairCount >= 10);
  coverage.visualHierarchyCoveragePass = coverage.visualHierarchyCells.every(row => row.pairCount >= 10);
  const counterbalance = {
    overall: counterbalanceRow("overall", corpus.pairs),
    ratios: [...ratioGroups].sort(([left], [right]) => compareStrings(left, right))
      .map(([id, pairs]) => counterbalanceRow(id, pairs)),
    strata: requiredStrata.map(id => counterbalanceRow(id, strataGroups.get(id) || [])),
    visualHierarchyCells: requiredCells.map(id => counterbalanceRow(id, cellGroups.get(id) || []))
  };
  counterbalance.pass = [
    counterbalance.overall,
    ...counterbalance.ratios,
    ...counterbalance.strata,
    ...counterbalance.visualHierarchyCells
  ].every(row => row.pass);
  if (!coverage.minimumPairCountPass) fail("blindCorpus.pairs", "requires at least 60 pairs");
  if (
    coverage.presentationRuns.maximumGroupRun > 2
    || coverage.presentationRuns.maximumStratumRun > 2
  ) fail("blindCorpus.pairs", "presentation order contains a source-revealing coverage run");
  if (!coverage.linguisticCoveragePass) fail("blindCorpus.pairs", "linguistic stratum coverage is incomplete");
  if (!coverage.visualHierarchyCoveragePass) fail("blindCorpus.pairs", "visual hierarchy coverage is incomplete");
  if (!counterbalance.pass) fail("blindCorpus.pairs", "candidate side assignment is not counterbalanced");
  return Object.freeze({ fixtureIds, coverage, counterbalance });
}

function validateQualificationSnapshot(snapshot, evaluatedLanguages, path, { notAfter = null } = {}) {
  assertArray(snapshot, path);
  const languages = [];
  snapshot.forEach((qualification, index) => {
    const itemPath = `${path}[${index}]`;
    assertObject(qualification, itemPath);
    assertExactKeys(qualification, ["language", "basis", "verifiedBy", "verifiedAt"], itemPath);
    assertEnum(qualification.language, LANGUAGES, `${itemPath}.language`);
    assertEnum(qualification.basis, QUALIFICATION_BASES, `${itemPath}.basis`);
    assertString(qualification.verifiedBy, `${itemPath}.verifiedBy`);
    assertString(qualification.verifiedAt, `${itemPath}.verifiedAt`);
    if (!Number.isFinite(Date.parse(qualification.verifiedAt))) fail(`${itemPath}.verifiedAt`, "expected ISO timestamp");
    if (notAfter !== null && Date.parse(qualification.verifiedAt) > Date.parse(notAfter)) {
      fail(`${itemPath}.verifiedAt`, "qualification must be verified before review submission");
    }
    languages.push(qualification.language);
  });
  languages.sort(compareStrings);
  if (new Set(languages).size !== languages.length || !sameStringArray(languages, evaluatedLanguages)) {
    fail(path, "qualification languages must exactly cover the artifact manifest");
  }
}

export function validateReviewerQualificationSet(qualificationSet) {
  assertObject(qualificationSet, "reviewerQualificationSet");
  assertExactKeys(qualificationSet, [
    "schemaVersion", "qualificationSetId", "verifiedAt", "reviewers"
  ], "reviewerQualificationSet");
  if (qualificationSet.schemaVersion !== BLIND_EVALUATION_SCHEMA_VERSION) {
    fail("reviewerQualificationSet.schemaVersion", "expected 1");
  }
  assertString(qualificationSet.qualificationSetId, "reviewerQualificationSet.qualificationSetId");
  assertString(qualificationSet.verifiedAt, "reviewerQualificationSet.verifiedAt");
  if (!Number.isFinite(Date.parse(qualificationSet.verifiedAt))) {
    fail("reviewerQualificationSet.verifiedAt", "expected ISO timestamp");
  }
  assertArray(qualificationSet.reviewers, "reviewerQualificationSet.reviewers");
  const reviewerById = new Map();
  qualificationSet.reviewers.forEach((reviewer, reviewerIndex) => {
    const path = `reviewerQualificationSet.reviewers[${reviewerIndex}]`;
    assertObject(reviewer, path);
    assertExactKeys(reviewer, ["reviewerId", "qualifications"], path);
    assertString(reviewer.reviewerId, `${path}.reviewerId`);
    if (reviewerById.has(reviewer.reviewerId)) fail(path, "duplicate reviewer ID");
    const languages = [];
    assertArray(reviewer.qualifications, `${path}.qualifications`);
    reviewer.qualifications.forEach((qualification, qualificationIndex) => {
      const qualificationPath = `${path}.qualifications[${qualificationIndex}]`;
      assertObject(qualification, qualificationPath);
      assertExactKeys(qualification, ["language", "basis", "verifiedBy", "verifiedAt"], qualificationPath);
      assertEnum(qualification.language, LANGUAGES, `${qualificationPath}.language`);
      assertEnum(qualification.basis, QUALIFICATION_BASES, `${qualificationPath}.basis`);
      assertString(qualification.verifiedBy, `${qualificationPath}.verifiedBy`);
      assertString(qualification.verifiedAt, `${qualificationPath}.verifiedAt`);
      if (!Number.isFinite(Date.parse(qualification.verifiedAt))) {
        fail(`${qualificationPath}.verifiedAt`, "expected ISO timestamp");
      }
      languages.push(qualification.language);
    });
    const sortedLanguages = [...languages].sort(compareStrings);
    if (new Set(languages).size !== languages.length || !sameStringArray(languages, sortedLanguages)) {
      fail(`${path}.qualifications`, "qualifications must be unique and language-sorted");
    }
    reviewerById.set(reviewer.reviewerId, reviewer);
  });
  return Object.freeze({ reviewerById });
}

function validateRatings(ratings, evaluatedLanguages, path) {
  assertObject(ratings, path);
  const mixed = evaluatedLanguages.length > 1;
  assertExactKeys(ratings, [
    ...RATING_FIELDS,
    "lexicalNaturalnessByLanguage",
    ...(mixed ? ["multilingualNaturalness"] : [])
  ], path);
  RATING_FIELDS.forEach(field => assertInteger(ratings[field], `${path}.${field}`, { min: 1, max: 5 }));
  if (mixed) assertInteger(ratings.multilingualNaturalness, `${path}.multilingualNaturalness`, { min: 1, max: 5 });
  assertObject(ratings.lexicalNaturalnessByLanguage, `${path}.lexicalNaturalnessByLanguage`);
  const languageKeys = Object.keys(ratings.lexicalNaturalnessByLanguage).sort(compareStrings);
  if (!sameStringArray(languageKeys, evaluatedLanguages)) {
    fail(`${path}.lexicalNaturalnessByLanguage`, "language keys differ from artifact manifest");
  }
  languageKeys.forEach(language => assertInteger(
    ratings.lexicalNaturalnessByLanguage[language],
    `${path}.lexicalNaturalnessByLanguage.${language}`,
    { min: 1, max: 5 }
  ));
}

function validateFirstReadRecord(record, path) {
  assertObject(record, path);
  assertExactKeys(record, ["slotInstanceId", "lexicalUseId", "nodeFingerprint", "visibleText"], path);
  for (const field of ["slotInstanceId", "lexicalUseId", "visibleText"]) {
    assertString(record[field], `${path}.${field}`);
  }
  assertDigest(record.nodeFingerprint, `${path}.nodeFingerprint`);
}

export function validateBlindReviewResult(result, pair, {
  qualificationSet = null,
  translationErrorLedgerRevision = null
} = {}) {
  validateBlindPairFixture(pair);
  assertObject(result, "blindReviewResult");
  assertExactKeys(result, [
    "schemaVersion", "fixtureId", "reviewerId", "translationErrorLedgerRevision",
    "qualificationSnapshot", "artifactHashes",
    "ratingsBySide", "firstReadBySide", "firstAttentionSide", "preferenceSide", "submittedAt", "notes"
  ], "blindReviewResult");
  if (result.schemaVersion !== BLIND_EVALUATION_SCHEMA_VERSION) fail("blindReviewResult.schemaVersion", "expected 1");
  if (result.fixtureId !== pair.fixtureId) fail("blindReviewResult.fixtureId", "fixture mismatch");
  assertString(result.reviewerId, "blindReviewResult.reviewerId");
  assertDigest(result.translationErrorLedgerRevision, "blindReviewResult.translationErrorLedgerRevision");
  if (
    translationErrorLedgerRevision !== null
    && result.translationErrorLedgerRevision !== translationErrorLedgerRevision
  ) fail("blindReviewResult.translationErrorLedgerRevision", "ledger revision mismatch");
  assertString(result.submittedAt, "blindReviewResult.submittedAt");
  if (!Number.isFinite(Date.parse(result.submittedAt))) fail("blindReviewResult.submittedAt", "expected ISO timestamp");
  assertNullableString(result.notes, "blindReviewResult.notes");
  validateQualificationSnapshot(
    result.qualificationSnapshot,
    pair.candidate.evaluatedLanguages,
    "blindReviewResult.qualificationSnapshot",
    { notAfter: result.submittedAt }
  );
  if (qualificationSet) {
    const qualificationState = validateReviewerQualificationSet(qualificationSet);
    if (Date.parse(qualificationSet.verifiedAt) > Date.parse(result.submittedAt)) {
      fail("reviewerQualificationSet.verifiedAt", "qualification set must predate review submission");
    }
    const reviewer = qualificationState.reviewerById.get(result.reviewerId);
    if (!reviewer) fail("blindReviewResult.reviewerId", "reviewer is absent from qualification set");
    const expectedSnapshot = reviewer.qualifications.filter(qualification =>
      pair.candidate.evaluatedLanguages.includes(qualification.language)
    );
    if (hashCanonical(expectedSnapshot) !== hashCanonical(result.qualificationSnapshot)) {
      fail("blindReviewResult.qualificationSnapshot", "snapshot differs from verified qualification directory");
    }
  }
  assertObject(result.artifactHashes, "blindReviewResult.artifactHashes");
  assertExactKeys(result.artifactHashes, BLIND_SIDES, "blindReviewResult.artifactHashes");
  assertObject(result.ratingsBySide, "blindReviewResult.ratingsBySide");
  assertExactKeys(result.ratingsBySide, BLIND_SIDES, "blindReviewResult.ratingsBySide");
  assertObject(result.firstReadBySide, "blindReviewResult.firstReadBySide");
  assertExactKeys(result.firstReadBySide, BLIND_SIDES, "blindReviewResult.firstReadBySide");
  const sideToSource = pair.candidateSide === "left"
    ? { left: pair.candidate, right: pair.baseline }
    : { left: pair.baseline, right: pair.candidate };
  BLIND_SIDES.forEach(side => {
    assertDigest(result.artifactHashes[side], `blindReviewResult.artifactHashes.${side}`);
    if (result.artifactHashes[side] !== sideToSource[side].svg.sha256) {
      fail(`blindReviewResult.artifactHashes.${side}`, "artifact hash differs from frozen side");
    }
    validateRatings(
      result.ratingsBySide[side],
      pair.candidate.evaluatedLanguages,
      `blindReviewResult.ratingsBySide.${side}`
    );
    validateFirstReadRecord(result.firstReadBySide[side], `blindReviewResult.firstReadBySide.${side}`);
  });
  assertEnum(result.firstAttentionSide, BLIND_CHOICES, "blindReviewResult.firstAttentionSide");
  assertEnum(result.preferenceSide, BLIND_CHOICES, "blindReviewResult.preferenceSide");
  return result;
}

export function validateBlindReviewCollection(collection, corpus, { qualificationSet = null } = {}) {
  assertObject(collection, "blindReviewCollection");
  assertExactKeys(collection, [
    "schemaVersion", "corpusId", "translationErrorLedgerRevision", "results"
  ], "blindReviewCollection");
  if (collection.schemaVersion !== BLIND_EVALUATION_SCHEMA_VERSION) {
    fail("blindReviewCollection.schemaVersion", "expected 1");
  }
  if (collection.corpusId !== corpus.corpusId) fail("blindReviewCollection.corpusId", "corpus mismatch");
  if (collection.translationErrorLedgerRevision !== corpus.translationErrorLedgerRevision) {
    fail("blindReviewCollection.translationErrorLedgerRevision", "corpus ledger revision mismatch");
  }
  assertArray(collection.results, "blindReviewCollection.results");
  const pairById = new Map(corpus.pairs.map(pair => [pair.fixtureId, pair]));
  const identities = new Set();
  collection.results.forEach((result, index) => {
    const pair = pairById.get(result?.fixtureId);
    if (!pair) fail(`blindReviewCollection.results[${index}].fixtureId`, "unknown fixture");
    validateBlindReviewResult(result, pair, {
      qualificationSet,
      translationErrorLedgerRevision: corpus.translationErrorLedgerRevision
    });
    const identity = `${result.fixtureId}/${result.reviewerId}`;
    if (identities.has(identity)) fail("blindReviewCollection.results", `duplicate result ${identity}`);
    identities.add(identity);
  });
  return collection;
}

function translationLedgerQualificationRows(translationErrorLedger, lexicalUses, qualificationSet) {
  const lexicalUseById = new Map(lexicalUses.map(record => [record.id, record]));
  const reviewerById = qualificationSet
    ? validateReviewerQualificationSet(qualificationSet).reviewerById
    : new Map();
  return translationErrorLedger
    .filter(record => record.status !== "open")
    .map(record => {
      const language = lexicalUseById.get(record.lexicalUseId)?.language || null;
      const missingReviewerIds = record.adjudicatorIds.filter(reviewerId => {
        const reviewer = reviewerById.get(reviewerId);
        return !reviewer || !reviewer.qualifications.some(qualification => qualification.language === language);
      });
      return {
        ledgerRecordId: record.id,
        language,
        adjudicatorIds: [...record.adjudicatorIds],
        missingQualifiedReviewerIds: missingReviewerIds,
        pass: Boolean(language) && missingReviewerIds.length === 0
      };
    });
}

function mappedObservation(pair, result) {
  const candidateSide = pair.candidateSide;
  const baselineSide = candidateSide === "left" ? "right" : "left";
  const expectedHero = pair.candidate.expectedHeroNode;
  const firstRead = result.firstReadBySide[candidateSide];
  const candidateHeroFirstRead = firstRead.slotInstanceId === expectedHero.slotInstanceId
    && firstRead.lexicalUseId === expectedHero.lexicalUseId
    && firstRead.nodeFingerprint === expectedHero.nodeFingerprint;
  const preference = result.preferenceSide === "tie"
    ? "tie"
    : result.preferenceSide === candidateSide ? "candidate" : "baseline";
  const firstAttention = result.firstAttentionSide === "tie"
    ? "tie"
    : result.firstAttentionSide === candidateSide ? "candidate" : "baseline";
  return {
    fixtureId: pair.fixtureId,
    reviewerId: result.reviewerId,
    stratumId: stratumId(pair.stratum),
    visualCellId: visualCellId(pair.visualHierarchyCell),
    candidateHeroFirstRead,
    preference,
    firstAttention,
    candidateRatings: result.ratingsBySide[candidateSide],
    baselineRatings: result.ratingsBySide[baselineSide],
    evaluatedLanguages: pair.candidate.evaluatedLanguages
  };
}

function firstReadRows(ids, observations, key) {
  return ids.map(id => {
    const rows = observations.filter(observation => observation[key] === id);
    const matches = rows.filter(observation => observation.candidateHeroFirstRead).length;
    const rate = rows.length ? matches / rows.length : 0;
    return {
      id,
      observationCount: rows.length,
      heroFirstReadMatchCount: matches,
      heroFirstReadMatchRate: round9(rate),
      pass: rows.length > 0 && rate >= 0.9
    };
  });
}

function legibilityRows(ids, observations, key) {
  return ids.map(id => {
    const rows = observations.filter(observation => observation[key] === id);
    return {
      id,
      ...metricComparison(
        rows.map(row => row.candidateRatings.legibility),
        rows.map(row => row.baselineRatings.legibility)
      )
    };
  });
}

export function buildBlindEvaluationReport({
  corpus,
  reviewResults,
  translationErrorLedger,
  evaluationTooling,
  lexicalUses = [],
  reviewerQualificationSet = null,
  activeRecipeIds = ["command", "status"],
  activeMotifIds = ["motif.barcode", "motif.pseudo-qr", "motif.table", "motif.wave"]
}) {
  validateEvaluationToolingEvidence(evaluationTooling, "blind-evaluation-v1");
  const corpusState = validateBlindCorpus(corpus, { activeRecipeIds, activeMotifIds });
  assertArray(reviewResults, "blindReviewResults");
  assertArray(translationErrorLedger, "translationErrorLedger");
  const translationErrorLedgerRevision = hashCanonical(translationErrorLedger);
  if (translationErrorLedgerRevision !== corpus.translationErrorLedgerRevision) {
    fail("translationErrorLedger", "revision differs from frozen corpus");
  }
  const pairById = new Map(corpus.pairs.map(pair => [pair.fixtureId, pair]));
  const uniqueReviews = new Set();
  const reviewsByFixture = new Map(corpus.pairs.map(pair => [pair.fixtureId, []]));
  reviewResults.forEach((result, index) => {
    const pair = pairById.get(result?.fixtureId);
    if (!pair) fail(`blindReviewResults[${index}].fixtureId`, "unknown fixture");
    validateBlindReviewResult(result, pair, {
      qualificationSet: reviewerQualificationSet,
      translationErrorLedgerRevision
    });
    const key = `${result.fixtureId}/${result.reviewerId}`;
    if (uniqueReviews.has(key)) fail("blindReviewResults", `duplicate reviewer-fixture result ${key}`);
    uniqueReviews.add(key);
    reviewsByFixture.get(result.fixtureId).push(result);
  });
  const reviewerCoverage = corpus.pairs.map(pair => {
    const reviews = reviewsByFixture.get(pair.fixtureId);
    return {
      fixtureId: pair.fixtureId,
      reviewerCount: new Set(reviews.map(result => result.reviewerId)).size,
      pass: new Set(reviews.map(result => result.reviewerId)).size >= 2
    };
  });
  const observations = corpus.pairs.flatMap(pair =>
    reviewsByFixture.get(pair.fixtureId).map(result => mappedObservation(pair, result))
  );
  const stratumIds = corpusState.coverage.strata.map(row => row.id);
  const visualCellIds = corpusState.coverage.visualHierarchyCells.map(row => row.id);
  const stratumFirstRead = firstReadRows(stratumIds, observations, "stratumId");
  const visualCellFirstRead = firstReadRows(visualCellIds, observations, "visualCellId");
  const incoherentCount = observations.filter(row => row.candidateRatings.semanticPlausibility <= 2).length;
  const incoherentRate = observations.length ? incoherentCount / observations.length : 1;
  const preferenceCounts = {
    candidate: observations.filter(row => row.preference === "candidate").length,
    baseline: observations.filter(row => row.preference === "baseline").length,
    tie: observations.filter(row => row.preference === "tie").length
  };
  const preferenceDenominator = preferenceCounts.candidate + preferenceCounts.baseline;
  const candidatePreferenceRate = preferenceDenominator
    ? preferenceCounts.candidate / preferenceDenominator
    : 0;
  const stratumLegibility = legibilityRows(stratumIds, observations, "stratumId");
  const visualCellLegibility = legibilityRows(visualCellIds, observations, "visualCellId");
  const languageNaturalness = LANGUAGES.map(language => {
    const rows = observations.filter(row => row.evaluatedLanguages.includes(language));
    return {
      language,
      ...metricComparison(
        rows.map(row => row.candidateRatings.lexicalNaturalnessByLanguage[language]),
        rows.map(row => row.baselineRatings.lexicalNaturalnessByLanguage[language])
      )
    };
  });
  const disagreements = corpus.pairs.map(pair => {
    const rows = reviewsByFixture.get(pair.fixtureId).map(result => mappedObservation(pair, result));
    return {
      fixtureId: pair.fixtureId,
      preferenceDisagreement: new Set(rows.map(row => row.preference)).size > 1,
      firstAttentionDisagreement: new Set(rows.map(row => row.firstAttention)).size > 1,
      candidateHeroFirstReadDisagreement: new Set(rows.map(row => row.candidateHeroFirstRead)).size > 1
    };
  });
  const openTranslationErrors = translationErrorLedger.filter(record => record.status === "open");
  const ledgerQualificationRows = translationLedgerQualificationRows(
    translationErrorLedger,
    lexicalUses,
    reviewerQualificationSet
  );
  const acceptance = {
    corpusCoveragePass: true,
    counterbalancePass: corpusState.counterbalance.pass,
    reviewerCoveragePass: reviewerCoverage.every(row => row.pass),
    stratumFirstReadPass: stratumFirstRead.every(row => row.pass),
    visualCellFirstReadPass: visualCellFirstRead.every(row => row.pass),
    incoherentRatePass: observations.length > 0 && incoherentRate <= 0.1,
    candidatePreferencePass: preferenceDenominator > 0 && candidatePreferenceRate >= 0.55,
    stratumLegibilityPass: stratumLegibility.every(row => row.pass),
    visualCellLegibilityPass: visualCellLegibility.every(row => row.pass),
    languageNaturalnessPass: languageNaturalness.every(row => row.pass),
    openTranslationErrorCount: openTranslationErrors.length,
    translationLedgerQualificationPass: ledgerQualificationRows.every(row => row.pass)
  };
  acceptance.pass = acceptance.corpusCoveragePass
    && acceptance.counterbalancePass
    && acceptance.reviewerCoveragePass
    && acceptance.stratumFirstReadPass
    && acceptance.visualCellFirstReadPass
    && acceptance.incoherentRatePass
    && acceptance.candidatePreferencePass
    && acceptance.stratumLegibilityPass
    && acceptance.visualCellLegibilityPass
    && acceptance.languageNaturalnessPass
    && acceptance.openTranslationErrorCount === 0
    && acceptance.translationLedgerQualificationPass;
  return {
    schemaVersion: BLIND_EVALUATION_SCHEMA_VERSION,
    corpusId: corpus.corpusId,
    corpusSha256: hashCanonical(corpus),
    translationErrorLedgerRevision,
    evaluationTooling,
    pairCount: corpus.pairs.length,
    reviewResultCount: reviewResults.length,
    observationCount: observations.length,
    corpusCoverage: corpusState.coverage,
    counterbalance: corpusState.counterbalance,
    reviewerCoverage,
    stratumFirstRead,
    visualCellFirstRead,
    incoherence: {
      incoherentCount,
      observationCount: observations.length,
      rate: round9(incoherentRate)
    },
    preference: {
      ...preferenceCounts,
      nonTieDenominator: preferenceDenominator,
      candidateSelectionRate: round9(candidatePreferenceRate)
    },
    stratumLegibility,
    visualCellLegibility,
    languageNaturalness,
    reviewerDisagreement: disagreements,
    openTranslationErrors: openTranslationErrors.map(record => record.id).sort(compareStrings),
    translationLedgerQualifications: ledgerQualificationRows,
    acceptance
  };
}
