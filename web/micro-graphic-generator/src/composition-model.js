import { canonicalJson, hashCanonical } from "./canonical-hash.js";
import { MAX_MOUNTED_RANKED_ATTEMPTS } from "./config.js";

const LANGUAGE_VALUES = new Set(["en", "ko", "zh"]);
const SCRIPT_VALUES = new Set(["latin", "hangul", "han"]);
const TYPEFACE_VALUES = new Set(["english", "korean", "chinese"]);
const TAG_VALUES = new Set([
  "action", "state", "result", "identity", "topic",
  "modifier", "value", "reference", "greeting"
]);
const DOMAIN_VALUES = new Set([
  "system", "network", "file", "media", "commerce",
  "social", "production", "interface", "nature"
]);
const DISPLAY_CLASS_VALUES = new Set(["short", "medium", "long", "phrase"]);
const REVIEW_STATUS_VALUES = new Set(["approved", "unreviewed", "rejected"]);
const EQUIVALENCE_VALUES = new Set(["exact", "close", "adapted"]);
const LEDGER_STATUS_VALUES = new Set(["open", "resolved", "waived"]);
const COMPOSITION_ROLE_VALUES = new Set(["hero", "support", "metadata", "motif"]);
const PROMINENCE_VALUES = new Set(["primary", "secondary", "tertiary"]);
const RELATION_VALUES = new Set([
  "actsOn", "stateOf", "resultOf", "references", "recoveryFor",
  "modifies", "identifies", "echoOf", "alternateOf"
]);
const LAYOUT_PREFERENCE_VALUES = new Set(["largest-viable-footprint", "edge", "corner"]);

function fail(path, message) {
  throw new TypeError(`${path}: ${message}`);
}

function assertRecord(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(path, "expected object");
}

function assertExactKeys(value, required, optional, path) {
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(path, `unknown field ${key}`);
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) fail(path, `missing field ${key}`);
  }
}

function assertString(value, path, { nullable = false } = {}) {
  if (nullable && value === null) return;
  if (typeof value !== "string" || value.length === 0) fail(path, "expected non-empty string");
}

function assertStringArray(value, path, { min = 0 } = {}) {
  if (!Array.isArray(value) || value.length < min) fail(path, `expected at least ${min} strings`);
  const seen = new Set();
  value.forEach((entry, index) => {
    assertString(entry, `${path}[${index}]`);
    if (seen.has(entry)) fail(path, `duplicate value ${entry}`);
    seen.add(entry);
  });
}

function assertEnum(value, allowed, path) {
  const contains = allowed instanceof Set ? allowed.has(value) : allowed.includes(value);
  if (!contains) fail(path, `unsupported value ${String(value)}`);
}

export function validateLexicalUse(record, path = "lexicalUse") {
  assertRecord(record, path);
  assertExactKeys(record, [
    "id", "text", "language", "script", "typeface", "partOfSpeech",
    "tags", "domains", "marker", "displayClass", "scopeNote", "examples",
    "counterExamples", "phrasePackId", "source", "reviewStatus", "familyId", "materializationOrdinal"
  ], ["instanceKey"], path);
  for (const key of ["id", "text", "partOfSpeech", "scopeNote", "source", "familyId"]) {
    assertString(record[key], `${path}.${key}`);
  }
  assertIntegerRange(record.materializationOrdinal, 0, Number.MAX_SAFE_INTEGER, `${path}.materializationOrdinal`);
  if (Object.hasOwn(record, "instanceKey")) assertString(record.instanceKey, `${path}.instanceKey`);
  assertEnum(record.language, LANGUAGE_VALUES, `${path}.language`);
  assertEnum(record.script, SCRIPT_VALUES, `${path}.script`);
  assertEnum(record.typeface, TYPEFACE_VALUES, `${path}.typeface`);
  assertStringArray(record.tags, `${path}.tags`, { min: 1 });
  record.tags.forEach(tag => assertEnum(tag, TAG_VALUES, `${path}.tags`));
  assertStringArray(record.domains, `${path}.domains`, { min: 1 });
  record.domains.forEach(domain => assertEnum(domain, DOMAIN_VALUES, `${path}.domains`));
  if (record.marker !== null && !["mention", "hashtag"].includes(record.marker)) {
    fail(`${path}.marker`, "expected mention, hashtag, or null");
  }
  if (record.marker === "mention" && (!record.text.startsWith("@") || !record.tags.includes("identity"))) {
    fail(path, "mention must use @ text and identity tag");
  }
  if (record.marker === "hashtag" && (!record.text.startsWith("#") || !record.tags.includes("topic"))) {
    fail(path, "hashtag must use # text and topic tag");
  }
  assertEnum(record.displayClass, DISPLAY_CLASS_VALUES, `${path}.displayClass`);
  assertStringArray(record.examples, `${path}.examples`);
  assertStringArray(record.counterExamples, `${path}.counterExamples`);
  assertString(record.phrasePackId, `${path}.phrasePackId`, { nullable: true });
  assertEnum(record.reviewStatus, REVIEW_STATUS_VALUES, `${path}.reviewStatus`);
  if (record.displayClass === "phrase" && record.phrasePackId === null) {
    fail(path, "phrase display class requires phrasePackId");
  }
  return record;
}

export function validateTranslationSet(record, lexicalUseById, path = "translationSet") {
  assertRecord(record, path);
  assertExactKeys(record, ["id", "gloss", "members"], [], path);
  assertString(record.id, `${path}.id`);
  assertString(record.gloss, `${path}.gloss`);
  if (!Array.isArray(record.members) || record.members.length === 0) fail(`${path}.members`, "expected members");
  const seen = new Set();
  record.members.forEach((member, index) => {
    const memberPath = `${path}.members[${index}]`;
    assertRecord(member, memberPath);
    assertExactKeys(member, ["lexicalUseId", "equivalence"], [], memberPath);
    assertString(member.lexicalUseId, `${memberPath}.lexicalUseId`);
    assertEnum(member.equivalence, EQUIVALENCE_VALUES, `${memberPath}.equivalence`);
    if (!lexicalUseById.has(member.lexicalUseId)) fail(memberPath, "unknown lexicalUseId");
    if (seen.has(member.lexicalUseId)) fail(path, `duplicate member ${member.lexicalUseId}`);
    seen.add(member.lexicalUseId);
  });
  return record;
}

export function validateTranslationErrorLedgerRecord(record, translationSetById, lexicalUseById, path = "translationError") {
  assertRecord(record, path);
  assertExactKeys(record, [
    "id", "translationSetId", "lexicalUseId", "status", "disposition",
    "adjudicatorIds", "evidence"
  ], [], path);
  for (const key of ["id", "translationSetId", "lexicalUseId", "evidence"]) {
    assertString(record[key], `${path}.${key}`);
  }
  if (!translationSetById.has(record.translationSetId)) fail(path, "unknown translationSetId");
  if (!lexicalUseById.has(record.lexicalUseId)) fail(path, "unknown lexicalUseId");
  const set = translationSetById.get(record.translationSetId);
  if (!set.members.some(member => member.lexicalUseId === record.lexicalUseId)) {
    fail(path, "lexical use is not a member of translation set");
  }
  assertEnum(record.status, LEDGER_STATUS_VALUES, `${path}.status`);
  assertString(record.disposition, `${path}.disposition`, { nullable: true });
  assertStringArray(record.adjudicatorIds, `${path}.adjudicatorIds`);
  if (record.status === "open") {
    if (record.disposition !== null || record.adjudicatorIds.length !== 0) {
      fail(path, "open record cannot have a disposition or adjudicators");
    }
  } else if (record.disposition === null || record.adjudicatorIds.length !== 2) {
    fail(path, "resolved and waived records require a disposition and two adjudicators");
  }
  return record;
}

export function createLexicalUseToTranslationSetIndex(translationSets) {
  const index = new Map();
  for (const set of translationSets) {
    for (const member of set.members) {
      if (index.has(member.lexicalUseId)) {
        fail("translationSets", `${member.lexicalUseId} belongs to multiple translation sets`);
      }
      index.set(member.lexicalUseId, set.id);
    }
  }
  return index;
}

export function validateVocabularyRegistry({ lexicalUses, translationSets, translationErrorLedger }) {
  if (!Array.isArray(lexicalUses) || !Array.isArray(translationSets) || !Array.isArray(translationErrorLedger)) {
    fail("vocabularyRegistry", "all registries must be arrays");
  }
  const lexicalUseById = new Map();
  lexicalUses.forEach((record, index) => {
    validateLexicalUse(record, `lexicalUses[${index}]`);
    if (lexicalUseById.has(record.id)) fail("lexicalUses", `duplicate id ${record.id}`);
    lexicalUseById.set(record.id, record);
  });
  const translationSetById = new Map();
  translationSets.forEach((record, index) => {
    validateTranslationSet(record, lexicalUseById, `translationSets[${index}]`);
    if (translationSetById.has(record.id)) fail("translationSets", `duplicate id ${record.id}`);
    translationSetById.set(record.id, record);
  });
  const lexicalUseToTranslationSet = createLexicalUseToTranslationSetIndex(translationSets);
  const ledgerById = new Map();
  translationErrorLedger.forEach((record, index) => {
    validateTranslationErrorLedgerRecord(
      record,
      translationSetById,
      lexicalUseById,
      `translationErrorLedger[${index}]`
    );
    if (ledgerById.has(record.id)) fail("translationErrorLedger", `duplicate id ${record.id}`);
    ledgerById.set(record.id, record);
  });
  return Object.freeze({ lexicalUseById, translationSetById, lexicalUseToTranslationSet, ledgerById });
}

function assertIntegerRange(value, min, max, path) {
  if (!Number.isInteger(value) || value < min || value > max) {
    fail(path, `expected integer in range ${min}-${max}`);
  }
}

function assertFiniteBox(value, path, { positiveOrigin = false } = {}) {
  assertRecord(value, path);
  assertExactKeys(value, ["x", "y", "width", "height"], [], path);
  for (const key of ["x", "y", "width", "height"]) {
    if (!Number.isFinite(value[key])) fail(`${path}.${key}`, "expected finite number");
  }
  if (value.width <= 0 || value.height <= 0) fail(path, "width and height must be positive");
  if (positiveOrigin && (value.x < 0 || value.y < 0)) fail(path, "origin must be non-negative");
}

export function validateGenerationInput(input, path = "generationInput") {
  assertRecord(input, path);
  assertExactKeys(input, [
    "schemaVersion", "seed", "generationTimestamp", "ratio", "borderMode",
    "viewport", "safeBox", "vocabularyVersion", "recipeVersion", "motifVersion",
    "configVersion", "compositionEngineVersion", "fontMetricsVersion",
    "fontAssetRevision", "ownerSnapshotRevision"
  ], [], path);
  if (input.schemaVersion !== 1) fail(`${path}.schemaVersion`, "expected 1");
  assertIntegerRange(input.seed, 0, 0xffffffff, `${path}.seed`);
  assertString(input.generationTimestamp, `${path}.generationTimestamp`);
  if (!Number.isFinite(Date.parse(input.generationTimestamp))) {
    fail(`${path}.generationTimestamp`, "expected an ISO timestamp");
  }
  if (!/^\d+:\d+$/.test(input.ratio)) fail(`${path}.ratio`, "expected width:height");
  if (!["stroke", "no-stroke", "corner-stroke"].includes(input.borderMode)) {
    fail(`${path}.borderMode`, "unsupported border mode");
  }
  assertRecord(input.viewport, `${path}.viewport`);
  assertExactKeys(input.viewport, ["width", "height", "devicePixelRatio"], [], `${path}.viewport`);
  for (const key of ["width", "height", "devicePixelRatio"]) {
    if (!Number.isFinite(input.viewport[key]) || input.viewport[key] <= 0) {
      fail(`${path}.viewport.${key}`, "expected finite positive number");
    }
  }
  assertFiniteBox(input.safeBox, `${path}.safeBox`, { positiveOrigin: true });
  for (const key of [
    "vocabularyVersion", "recipeVersion", "motifVersion", "configVersion",
    "compositionEngineVersion", "fontMetricsVersion"
  ]) {
    assertIntegerRange(input[key], 1, Number.MAX_SAFE_INTEGER, `${path}.${key}`);
  }
  for (const key of ["fontAssetRevision", "ownerSnapshotRevision"]) {
    if (!/^sha256:[0-9a-f]{64}$/.test(input[key])) fail(`${path}.${key}`, "invalid digest");
  }
  return input;
}

export function createGenerationInput(value) {
  validateGenerationInput(value);
  return deepFreeze({
    ...value,
    viewport: { ...value.viewport },
    safeBox: { ...value.safeBox }
  });
}

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const PLAN_ID_PATTERN = /^plan:sha256:[0-9a-f]{64}$/;
const RANKED_SEARCH_TIERS = Object.freeze([
  "same-tuple-layout",
  "approved-alternate",
  "other-replan"
]);
const RANKED_STOP_REASONS = Object.freeze([
  "no-candidate",
  "queue-exhausted",
  "attempt-budget-exhausted"
]);

function assertDigest(value, path, pattern = DIGEST_PATTERN) {
  if (typeof value !== "string" || !pattern.test(value)) fail(path, "invalid identity digest");
}

function assertNullableString(value, path) {
  if (value !== null) assertString(value, path);
}

function assertPositiveFinite(value, path) {
  if (!Number.isFinite(value) || value <= 0) fail(path, "expected finite positive number");
}

export function validateAttemptEnvelope(envelope, path = "attemptEnvelope") {
  assertRecord(envelope, path);
  assertExactKeys(envelope, [
    "attempt", "candidateSource", "candidateCursor", "searchTier", "fallbackTrigger", "planId"
  ], [], path);
  assertEnum(envelope.candidateSource, ["ranked", "known-good"], `${path}.candidateSource`);
  const maximumCursor = envelope.candidateSource === "ranked"
    ? MAX_MOUNTED_RANKED_ATTEMPTS - 1
    : MAX_MOUNTED_RANKED_ATTEMPTS;
  assertIntegerRange(envelope.candidateCursor, 0, maximumCursor, `${path}.candidateCursor`);
  if (envelope.attempt !== envelope.candidateCursor + 1) {
    fail(`${path}.attempt`, "must equal candidateCursor + 1");
  }
  assertDigest(envelope.planId, `${path}.planId`, PLAN_ID_PATTERN);
  if (envelope.candidateSource === "ranked") {
    assertEnum(envelope.searchTier, RANKED_SEARCH_TIERS, `${path}.searchTier`);
    if (envelope.fallbackTrigger !== null) fail(`${path}.fallbackTrigger`, "ranked attempt must use null");
  } else {
    if (envelope.searchTier !== "known-good") fail(`${path}.searchTier`, "known-good tier required");
    assertEnum(envelope.fallbackTrigger, RANKED_STOP_REASONS, `${path}.fallbackTrigger`);
    if (envelope.fallbackTrigger === "no-candidate" && envelope.candidateCursor !== 0) {
      fail(`${path}.candidateCursor`, "no-candidate fallback must start at cursor 0");
    }
    if (
      envelope.fallbackTrigger === "queue-exhausted"
      && (envelope.candidateCursor < 1 || envelope.candidateCursor > MAX_MOUNTED_RANKED_ATTEMPTS)
    ) {
      fail(`${path}.candidateCursor`, "queue-exhausted fallback must follow a ranked attempt");
    }
    if (
      envelope.fallbackTrigger === "attempt-budget-exhausted"
      && envelope.candidateCursor !== MAX_MOUNTED_RANKED_ATTEMPTS
    ) {
      fail(`${path}.candidateCursor`, "attempt-budget-exhausted fallback must follow the full ranked budget");
    }
  }
  return envelope;
}

export function validatePlannerResultShape(result, path = "plannerResult") {
  assertRecord(result, path);
  assertExactKeys(result, [
    "schemaVersion", "generationInputHash", "rankedPlanUniverseFingerprint", "initialSelection", "searchQueue"
  ], [], path);
  if (result.schemaVersion !== 1) fail(`${path}.schemaVersion`, "expected 1");
  assertDigest(result.generationInputHash, `${path}.generationInputHash`);
  assertDigest(result.rankedPlanUniverseFingerprint, `${path}.rankedPlanUniverseFingerprint`);
  const selection = result.initialSelection;
  assertRecord(selection, `${path}.initialSelection`);
  assertExactKeys(selection, [
    "status", "generationInputHash", "recipeOrder", "recipeStartIndex", "selectedRecipeId",
    "topRankKey", "topTiePlanIds", "selectedPlanId", "selectedTieIndex", "selectionDrawCount"
  ], [], `${path}.initialSelection`);
  assertEnum(selection.status, ["selected", "no-candidate"], `${path}.initialSelection.status`);
  assertDigest(selection.generationInputHash, `${path}.initialSelection.generationInputHash`);
  if (selection.generationInputHash !== result.generationInputHash) {
    fail(`${path}.initialSelection.generationInputHash`, "top-level identity mismatch");
  }
  assertStringArray(selection.recipeOrder, `${path}.initialSelection.recipeOrder`, { min: 1 });
  assertIntegerRange(
    selection.recipeStartIndex,
    0,
    selection.recipeOrder.length - 1,
    `${path}.initialSelection.recipeStartIndex`
  );
  if (!Array.isArray(selection.topTiePlanIds)) fail(`${path}.initialSelection.topTiePlanIds`, "expected array");
  selection.topTiePlanIds.forEach((planId, index) =>
    assertDigest(planId, `${path}.initialSelection.topTiePlanIds[${index}]`, PLAN_ID_PATTERN)
  );
  if (new Set(selection.topTiePlanIds).size !== selection.topTiePlanIds.length) {
    fail(`${path}.initialSelection.topTiePlanIds`, "duplicate plan ID");
  }
  if (selection.status === "selected") {
    assertString(selection.selectedRecipeId, `${path}.initialSelection.selectedRecipeId`);
    if (!selection.recipeOrder.includes(selection.selectedRecipeId)) {
      fail(`${path}.initialSelection.selectedRecipeId`, "selected recipe is outside recipe order");
    }
    if (!Array.isArray(selection.topRankKey) || selection.topRankKey.length !== 6) {
      fail(`${path}.initialSelection.topRankKey`, "expected six-number rank key");
    }
    selection.topRankKey.forEach((value, index) => {
      if (!Number.isFinite(value)) fail(`${path}.initialSelection.topRankKey[${index}]`, "expected finite number");
    });
    assertDigest(selection.selectedPlanId, `${path}.initialSelection.selectedPlanId`, PLAN_ID_PATTERN);
    assertIntegerRange(
      selection.selectedTieIndex,
      0,
      selection.topTiePlanIds.length - 1,
      `${path}.initialSelection.selectedTieIndex`
    );
    if (selection.topTiePlanIds[selection.selectedTieIndex] !== selection.selectedPlanId) {
      fail(`${path}.initialSelection.selectedPlanId`, "selected plan differs from tie index");
    }
    if (selection.selectionDrawCount !== 1) fail(`${path}.initialSelection.selectionDrawCount`, "expected one draw");
  } else {
    for (const key of ["selectedRecipeId", "topRankKey", "selectedPlanId", "selectedTieIndex"]) {
      if (selection[key] !== null) fail(`${path}.initialSelection.${key}`, "expected null");
    }
    if (selection.topTiePlanIds.length !== 0 || selection.selectionDrawCount !== 0) {
      fail(`${path}.initialSelection`, "no-candidate selection must have no ties or draws");
    }
  }
  if (!Array.isArray(result.searchQueue)) fail(`${path}.searchQueue`, "expected array");
  result.searchQueue.forEach((entry, index) => {
    const entryPath = `${path}.searchQueue[${index}]`;
    assertRecord(entry, entryPath);
    assertExactKeys(entry, [
      "candidateCursor", "candidateSource", "searchTier", "tupleFingerprint", "planId", "plan"
    ], [], entryPath);
    assertIntegerRange(entry.candidateCursor, 0, Number.MAX_SAFE_INTEGER, `${entryPath}.candidateCursor`);
    if (entry.candidateCursor !== index) fail(`${entryPath}.candidateCursor`, "queue cursor must equal array index");
    if (entry.candidateSource !== "ranked") fail(`${entryPath}.candidateSource`, "expected ranked");
    assertEnum(entry.searchTier, RANKED_SEARCH_TIERS, `${entryPath}.searchTier`);
    assertDigest(entry.tupleFingerprint, `${entryPath}.tupleFingerprint`);
    assertDigest(entry.planId, `${entryPath}.planId`, PLAN_ID_PATTERN);
    assertRecord(entry.plan, `${entryPath}.plan`);
    if (entry.plan.planId !== entry.planId) fail(`${entryPath}.planId`, "nested plan identity mismatch");
  });
  if (selection.status === "no-candidate" && result.searchQueue.length !== 0) {
    fail(`${path}.searchQueue`, "no-candidate result requires an empty queue");
  }
  return result;
}

function validateRenderedBounds(bounds, path) {
  assertRecord(bounds, path);
  assertExactKeys(bounds, ["width", "height"], [], path);
  assertPositiveFinite(bounds.width, `${path}.width`);
  assertPositiveFinite(bounds.height, `${path}.height`);
}

function validateFinalizationBlock(block, path) {
  assertRecord(block, path);
  const shared = [
    "blockId", "slotInstanceId", "sourceKind", "requestedSize", "requestedWeight",
    "requestedFontWeight", "actualSize", "actualWeight", "actualFontWeight", "fallbackTier",
    "renderedBounds", "occupancySafetyFactor", "occupancyCalibrationRevision",
    "mountedOccupancyScore", "fits"
  ];
  assertExactKeys(block, shared, [], path);
  assertString(block.blockId, `${path}.blockId`);
  assertString(block.slotInstanceId, `${path}.slotInstanceId`);
  assertEnum(block.sourceKind, ["lexical", "motif"], `${path}.sourceKind`);
  assertEnum(block.requestedSize, COMPOSITION_MODEL_ENUMS.sizes, `${path}.requestedSize`);
  assertEnum(block.actualSize, COMPOSITION_MODEL_ENUMS.sizes, `${path}.actualSize`);
  assertIntegerRange(block.fallbackTier, 0, COMPOSITION_MODEL_ENUMS.sizes.length - 1, `${path}.fallbackTier`);
  validateRenderedBounds(block.renderedBounds, `${path}.renderedBounds`);
  assertPositiveFinite(block.occupancySafetyFactor, `${path}.occupancySafetyFactor`);
  if (!Number.isFinite(block.mountedOccupancyScore) || block.mountedOccupancyScore < 0) {
    fail(`${path}.mountedOccupancyScore`, "expected finite non-negative number");
  }
  if (typeof block.fits !== "boolean") fail(`${path}.fits`, "expected boolean");
  if (block.sourceKind === "lexical") {
    assertEnum(block.requestedWeight, ["normal", "bold"], `${path}.requestedWeight`);
    assertEnum(block.actualWeight, ["normal", "bold"], `${path}.actualWeight`);
    assertEnum(block.requestedFontWeight, [400, 700, 900], `${path}.requestedFontWeight`);
    assertEnum(block.actualFontWeight, [400, 700, 900], `${path}.actualFontWeight`);
    if (block.occupancySafetyFactor !== 1 || block.occupancyCalibrationRevision !== null) {
      fail(path, "lexical occupancy calibration must be 1/null");
    }
    const requestedIndex = COMPOSITION_MODEL_ENUMS.sizes.indexOf(block.requestedSize);
    const actualIndex = COMPOSITION_MODEL_ENUMS.sizes.indexOf(block.actualSize);
    if (actualIndex > requestedIndex) fail(`${path}.actualSize`, "lexical size cannot be upshifted");
    if (block.fallbackTier !== requestedIndex - actualIndex) {
      fail(`${path}.fallbackTier`, "must equal requested-to-actual size distance");
    }
  } else {
    for (const key of ["requestedWeight", "requestedFontWeight", "actualWeight", "actualFontWeight"]) {
      if (block[key] !== null) fail(`${path}.${key}`, "motif weight must be null");
    }
    assertDigest(block.occupancyCalibrationRevision, `${path}.occupancyCalibrationRevision`);
    if (block.actualSize !== block.requestedSize || block.fallbackTier !== 0) {
      fail(path, "motif size cannot be downshifted");
    }
  }
}

export function validateFinalizationReport(report, path = "finalizationReport") {
  assertRecord(report, path);
  assertExactKeys(report, [
    "schemaVersion", "planId", "attempt", "candidateSource", "candidateCursor", "searchTier",
    "fallbackTrigger", "status", "failedSlotInstanceIds", "rejectionReasons", "blocks"
  ], [], path);
  if (report.schemaVersion !== 1) fail(`${path}.schemaVersion`, "expected 1");
  validateAttemptEnvelope({
    attempt: report.attempt,
    candidateSource: report.candidateSource,
    candidateCursor: report.candidateCursor,
    searchTier: report.searchTier,
    fallbackTrigger: report.fallbackTrigger,
    planId: report.planId
  }, `${path}.envelope`);
  assertEnum(report.status, ["accept", "reject"], `${path}.status`);
  assertStringArray(report.failedSlotInstanceIds, `${path}.failedSlotInstanceIds`);
  assertStringArray(report.rejectionReasons, `${path}.rejectionReasons`);
  if (!Array.isArray(report.blocks) || report.blocks.length < 2 || report.blocks.length > 5) {
    fail(`${path}.blocks`, "expected 2-5 blocks");
  }
  report.blocks.forEach((block, index) => validateFinalizationBlock(block, `${path}.blocks[${index}]`));
  if (new Set(report.blocks.map(block => block.blockId)).size !== report.blocks.length) {
    fail(`${path}.blocks`, "duplicate block ID");
  }
  if (new Set(report.blocks.map(block => block.slotInstanceId)).size !== report.blocks.length) {
    fail(`${path}.blocks`, "duplicate slot instance ID");
  }
  const blockSlotIds = new Set(report.blocks.map(block => block.slotInstanceId));
  const unknownFailedSlotIds = report.failedSlotInstanceIds.filter(id => !blockSlotIds.has(id));
  if (unknownFailedSlotIds.length > 0) {
    fail(`${path}.failedSlotInstanceIds`, `unknown slot ${unknownFailedSlotIds[0]}`);
  }
  const failedSlotIds = new Set(report.failedSlotInstanceIds);
  for (const block of report.blocks) {
    if (!block.fits && !failedSlotIds.has(block.slotInstanceId)) {
      fail(`${path}.failedSlotInstanceIds`, `missing non-fitting slot ${block.slotInstanceId}`);
    }
  }
  const rejected = report.rejectionReasons.length > 0;
  if ((report.status === "reject") !== rejected) fail(`${path}.status`, "does not match rejection reasons");
  if (report.status === "accept") {
    if (report.failedSlotInstanceIds.length !== 0) {
      fail(`${path}.failedSlotInstanceIds`, "accepted report cannot contain failed slots");
    }
    if (report.blocks.some(block => !block.fits)) {
      fail(`${path}.status`, "accepted report requires every block to fit");
    }
  } else if (report.failedSlotInstanceIds.length === 0) {
    fail(`${path}.failedSlotInstanceIds`, "rejected report requires at least one failed slot");
  }
  return report;
}

function validateValidationRecord(record, path) {
  assertRecord(record, path);
  assertExactKeys(record, ["rule", "valid", "nodes", "detail"], [], path);
  assertString(record.rule, `${path}.rule`);
  if (typeof record.valid !== "boolean") fail(`${path}.valid`, "expected boolean");
  assertStringArray(record.nodes, `${path}.nodes`);
  if (typeof record.detail !== "string") fail(`${path}.detail`, "expected string");
}

export function validateAttemptResult(result, path = "attemptResult") {
  assertRecord(result, path);
  assertExactKeys(result, [
    "schemaVersion", "envelope", "finalizationReport", "validation", "status", "rejectionReasons"
  ], [], path);
  if (result.schemaVersion !== 1) fail(`${path}.schemaVersion`, "expected 1");
  validateAttemptEnvelope(result.envelope, `${path}.envelope`);
  validateFinalizationReport(result.finalizationReport, `${path}.finalizationReport`);
  const reportEnvelope = {
    attempt: result.finalizationReport.attempt,
    candidateSource: result.finalizationReport.candidateSource,
    candidateCursor: result.finalizationReport.candidateCursor,
    searchTier: result.finalizationReport.searchTier,
    fallbackTrigger: result.finalizationReport.fallbackTrigger,
    planId: result.finalizationReport.planId
  };
  if (canonicalJson(result.envelope) !== canonicalJson(reportEnvelope)) {
    fail(path, "attempt and finalization envelope mismatch");
  }
  assertRecord(result.validation, `${path}.validation`);
  assertExactKeys(result.validation, ["status", "skipReason", "results"], [], `${path}.validation`);
  assertEnum(result.validation.status, ["not-run", "pass", "fail"], `${path}.validation.status`);
  if (!Array.isArray(result.validation.results)) fail(`${path}.validation.results`, "expected array");
  result.validation.results.forEach((record, index) => validateValidationRecord(record, `${path}.validation.results[${index}]`));
  if (result.validation.status === "not-run") {
    if (result.validation.skipReason !== "finalization-rejected" || result.validation.results.length !== 0) {
      fail(`${path}.validation`, "invalid skipped validation");
    }
    if (result.finalizationReport.status !== "reject") fail(path, "validation skipped after accepted finalization");
  } else {
    if (result.validation.skipReason !== null) fail(`${path}.validation.skipReason`, "expected null");
    const failed = result.validation.results.filter(record => !record.valid);
    if ((result.validation.status === "fail") !== (failed.length > 0)) {
      fail(`${path}.validation.status`, "does not match validation records");
    }
    if (result.finalizationReport.status !== "accept") fail(path, "validation ran after rejected finalization");
  }
  assertEnum(result.status, ["accept", "reject"], `${path}.status`);
  assertStringArray(result.rejectionReasons, `${path}.rejectionReasons`);
  const expectedRejectionReasons = [...new Set([
    ...result.finalizationReport.rejectionReasons,
    ...result.validation.results
      .filter(record => !record.valid)
      .map(record => `validation:${record.rule}`)
  ])];
  if (canonicalJson(result.rejectionReasons) !== canonicalJson(expectedRejectionReasons)) {
    fail(`${path}.rejectionReasons`, "does not match finalization and validation evidence");
  }
  const rejected = expectedRejectionReasons.length > 0;
  if ((result.status === "reject") !== rejected) fail(`${path}.status`, "does not match rejection reasons");
  if (result.status === "accept" && (result.finalizationReport.status !== "accept" || result.validation.status !== "pass")) {
    fail(path, "accepted attempt requires accepted finalization and validation");
  }
  return result;
}

export function validateTerminalGenerationResult(result, path = "terminalResult") {
  assertRecord(result, path);
  assertExactKeys(result, [
    "schemaVersion", "status", "attemptedGenerationInputHash", "terminalReason", "rankedStopReason",
    "displayedPlanId", "displayedStructuralFingerprint", "preservedPrevious", "exportEligible",
    "lastAttemptResult"
  ], [], path);
  if (result.schemaVersion !== 1 || result.status !== "terminal-failure") fail(path, "invalid terminal result identity");
  assertDigest(result.attemptedGenerationInputHash, `${path}.attemptedGenerationInputHash`);
  assertEnum(result.terminalReason, [
    "known-good-rejected", "no-candidate-no-known-good", "queue-exhausted-no-known-good",
    "attempt-budget-exhausted-no-known-good"
  ], `${path}.terminalReason`);
  assertEnum(result.rankedStopReason, RANKED_STOP_REASONS, `${path}.rankedStopReason`);
  if (result.displayedPlanId !== null) assertDigest(result.displayedPlanId, `${path}.displayedPlanId`, PLAN_ID_PATTERN);
  if (result.displayedStructuralFingerprint !== null) {
    assertDigest(result.displayedStructuralFingerprint, `${path}.displayedStructuralFingerprint`);
  }
  for (const key of ["preservedPrevious", "exportEligible"]) {
    if (typeof result[key] !== "boolean") fail(`${path}.${key}`, "expected boolean");
  }
  if ((result.displayedPlanId === null) !== (result.displayedStructuralFingerprint === null)) {
    fail(path, "displayed plan and fingerprint must share nullability");
  }
  const hasDisplayedPrevious = result.displayedPlanId !== null;
  if (result.preservedPrevious !== hasDisplayedPrevious || result.exportEligible !== hasDisplayedPrevious) {
    fail(path, "display preservation and export eligibility must match displayed identity");
  }
  if (result.lastAttemptResult !== null) validateAttemptResult(result.lastAttemptResult, `${path}.lastAttemptResult`);
  const expectedRankedStopReason = {
    "no-candidate-no-known-good": "no-candidate",
    "queue-exhausted-no-known-good": "queue-exhausted",
    "attempt-budget-exhausted-no-known-good": "attempt-budget-exhausted"
  }[result.terminalReason] || null;
  if (expectedRankedStopReason !== null && result.rankedStopReason !== expectedRankedStopReason) {
    fail(`${path}.rankedStopReason`, "does not match terminal branch");
  }
  if (result.terminalReason === "known-good-rejected") {
    if (!result.lastAttemptResult || result.lastAttemptResult.envelope.candidateSource !== "known-good") {
      fail(path, "known-good rejection requires its full attempt result");
    }
    if (
      result.lastAttemptResult.status !== "reject"
      || result.lastAttemptResult.envelope.fallbackTrigger !== result.rankedStopReason
    ) fail(path, "known-good rejection attempt does not match ranked stop reason");
  } else if (result.terminalReason === "no-candidate-no-known-good") {
    if (result.lastAttemptResult !== null) fail(path, "no-candidate branch cannot have an attempt result");
  } else if (
    !result.lastAttemptResult
    || result.lastAttemptResult.status !== "reject"
    || result.lastAttemptResult.envelope.candidateSource !== "ranked"
    || result.lastAttemptResult.envelope.fallbackTrigger !== null
  ) {
    fail(path, "ranked exhaustion branch requires its final rejected ranked attempt");
  }
  return result;
}

export function selectorKey(selector, path = "selector") {
  assertRecord(selector, path);
  const keys = ["lexicalUseId", "translationSetId", "tag"].filter(key => Object.hasOwn(selector, key));
  if (keys.length !== 1 || Object.keys(selector).length !== 1) {
    fail(path, "expected exactly one selector discriminator");
  }
  assertString(selector[keys[0]], `${path}.${keys[0]}`);
  return Object.freeze([keys[0], selector[keys[0]]]);
}

export function candidateMatchesSelector(candidate, selector) {
  const [kind, value] = selectorKey(selector);
  if (candidate?.sourceKind !== "lexical") return false;
  if (kind === "tag") return candidate.tags.includes(value);
  return candidate[kind] === value;
}

export function validateRecipeRegistry({
  recipes,
  activeRecipeIds,
  relationEdges,
  lexicalUseById,
  translationSetById
}) {
  if (!Array.isArray(recipes) || !Array.isArray(activeRecipeIds) || !Array.isArray(relationEdges)) {
    fail("recipeRegistry", "recipes, active IDs, and relation edges must be arrays");
  }
  const recipeById = new Map();
  for (const [recipeIndex, recipe] of recipes.entries()) {
    const path = `recipes[${recipeIndex}]`;
    assertRecord(recipe, path);
    assertExactKeys(recipe, [
      "id", "coherenceMode", "blockCount", "slots", "requiredRelations",
      "pairRules", "layoutPreferences"
    ], [], path);
    assertString(recipe.id, `${path}.id`);
    if (recipeById.has(recipe.id)) fail("recipes", `duplicate id ${recipe.id}`);
    if (!["direct", "evocative"].includes(recipe.coherenceMode)) fail(path, "unsupported coherenceMode");
    assertRecord(recipe.blockCount, `${path}.blockCount`);
    assertExactKeys(recipe.blockCount, ["min", "max"], [], `${path}.blockCount`);
    assertIntegerRange(recipe.blockCount.min, 2, 5, `${path}.blockCount.min`);
    assertIntegerRange(recipe.blockCount.max, recipe.blockCount.min, 5, `${path}.blockCount.max`);
    if (!Array.isArray(recipe.slots) || recipe.slots.length === 0) fail(path, "slots are required");
    const slotById = new Map();
    for (const [slotIndex, slot] of recipe.slots.entries()) {
      const slotPath = `${path}.slots[${slotIndex}]`;
      assertRecord(slot, slotPath);
      assertExactKeys(slot, [
        "id", "compositionRole", "cardinality", "source", "prominence"
      ], ["acceptsAnyTag"], slotPath);
      assertString(slot.id, `${slotPath}.id`);
      if (slotById.has(slot.id)) fail(path, `duplicate slot ${slot.id}`);
      assertEnum(slot.compositionRole, COMPOSITION_ROLE_VALUES, `${slotPath}.compositionRole`);
      assertEnum(slot.prominence, PROMINENCE_VALUES, `${slotPath}.prominence`);
      if (!["lexical", "graphic"].includes(slot.source)) fail(slotPath, "unsupported source");
      assertRecord(slot.cardinality, `${slotPath}.cardinality`);
      assertExactKeys(slot.cardinality, ["min", "max"], [], `${slotPath}.cardinality`);
      assertIntegerRange(slot.cardinality.min, 0, 2, `${slotPath}.cardinality.min`);
      assertIntegerRange(slot.cardinality.max, slot.cardinality.min, 2, `${slotPath}.cardinality.max`);
      if (slot.source === "lexical") {
        assertStringArray(slot.acceptsAnyTag, `${slotPath}.acceptsAnyTag`, { min: 1 });
        slot.acceptsAnyTag.forEach(tag => assertEnum(tag, TAG_VALUES, `${slotPath}.acceptsAnyTag`));
      } else if (Object.hasOwn(slot, "acceptsAnyTag")) {
        fail(slotPath, "graphic slot cannot accept lexical tags");
      }
      if (slot.compositionRole === "hero" && (slot.source !== "lexical" || slot.prominence !== "primary")) {
        fail(slotPath, "hero must be primary lexical typography");
      }
      if (slot.compositionRole === "motif" && slot.prominence === "primary") {
        fail(slotPath, "motif cannot be primary");
      }
      slotById.set(slot.id, slot);
    }
    const heroSlots = recipe.slots.filter(slot => slot.compositionRole === "hero");
    if (heroSlots.length !== 1 || heroSlots[0].cardinality.min !== 1 || heroSlots[0].cardinality.max !== 1) {
      fail(path, "recipe requires exactly one hero");
    }
    if (recipe.slots.filter(slot => slot.prominence === "primary").length !== 1) {
      fail(path, "hero must own primary prominence");
    }
    if (!Array.isArray(recipe.requiredRelations)) fail(path, "requiredRelations must be an array");
    for (const [clauseIndex, clause] of recipe.requiredRelations.entries()) {
      const clausePath = `${path}.requiredRelations[${clauseIndex}]`;
      assertRecord(clause, clausePath);
      assertExactKeys(clause, ["fromSlot", "relations", "toSlot"], ["whenSlotPresent"], clausePath);
      const fromSlot = slotById.get(clause.fromSlot);
      const toSlot = slotById.get(clause.toSlot);
      if (!fromSlot || !toSlot) fail(clausePath, "unknown relation slot");
      if (fromSlot.source !== "lexical" || toSlot.source !== "lexical") {
        fail(clausePath, "required relation endpoints must be lexical");
      }
      if (fromSlot.cardinality.max !== 1 || toSlot.cardinality.max !== 1) {
        fail(clausePath, "required relation endpoints must have max cardinality 1");
      }
      assertStringArray(clause.relations, `${clausePath}.relations`, { min: 1 });
      clause.relations.forEach(relation => assertEnum(relation, RELATION_VALUES, clausePath));
      if (clause.whenSlotPresent !== undefined) {
        if (![clause.fromSlot, clause.toSlot].includes(clause.whenSlotPresent)) {
          fail(clausePath, "conditional slot must be an endpoint");
        }
        const conditional = slotById.get(clause.whenSlotPresent);
        if (conditional.cardinality.min !== 0 || conditional.cardinality.max !== 1) {
          fail(clausePath, "conditional endpoint must be optional max-one");
        }
        const other = conditional === fromSlot ? toSlot : fromSlot;
        if (other.cardinality.min !== 1) fail(clausePath, "opposite endpoint must be required");
      } else if (fromSlot.cardinality.min !== 1 || toSlot.cardinality.min !== 1) {
        fail(clausePath, "unconditional endpoints must be required");
      }
    }
    assertRecord(recipe.pairRules, `${path}.pairRules`);
    assertExactKeys(recipe.pairRules, ["prefer", "avoid"], [], `${path}.pairRules`);
    const ruleIds = new Set();
    const avoidKeys = new Set();
    for (const [ruleIndex, rule] of recipe.pairRules.avoid.entries()) {
      const rulePath = `${path}.pairRules.avoid[${ruleIndex}]`;
      assertRecord(rule, rulePath);
      assertExactKeys(rule, ["id", "from", "to"], [], rulePath);
      assertString(rule.id, `${rulePath}.id`);
      if (ruleIds.has(rule.id)) fail(path, `duplicate pair rule id ${rule.id}`);
      ruleIds.add(rule.id);
      const key = canonicalJson([selectorKey(rule.from), selectorKey(rule.to)]);
      if (avoidKeys.has(key)) fail(path, "duplicate avoid rule");
      avoidKeys.add(key);
    }
    for (const [ruleIndex, rule] of recipe.pairRules.prefer.entries()) {
      const rulePath = `${path}.pairRules.prefer[${ruleIndex}]`;
      assertRecord(rule, rulePath);
      assertExactKeys(rule, ["id", "from", "relation", "to"], [], rulePath);
      assertString(rule.id, `${rulePath}.id`);
      if (ruleIds.has(rule.id)) fail(path, `duplicate pair rule id ${rule.id}`);
      ruleIds.add(rule.id);
      selectorKey(rule.from, `${rulePath}.from`);
      selectorKey(rule.to, `${rulePath}.to`);
      assertEnum(rule.relation, RELATION_VALUES, `${rulePath}.relation`);
    }
    assertRecord(recipe.layoutPreferences, `${path}.layoutPreferences`);
    for (const [slotId, preferences] of Object.entries(recipe.layoutPreferences)) {
      if (!slotById.has(slotId)) fail(path, `unknown layout preference slot ${slotId}`);
      assertStringArray(preferences, `${path}.layoutPreferences.${slotId}`, { min: 1 });
      preferences.forEach(value => assertEnum(value, LAYOUT_PREFERENCE_VALUES, path));
    }
    recipeById.set(recipe.id, recipe);
  }

  const canonicalActiveIds = [...activeRecipeIds].sort();
  if (
    activeRecipeIds.length === 0
    || new Set(activeRecipeIds).size !== activeRecipeIds.length
    || canonicalActiveIds.some((id, index) => id !== activeRecipeIds[index])
  ) {
    fail("activeRecipeIds", "must be non-empty, unique, and ascending");
  }
  activeRecipeIds.forEach(id => {
    if (!recipeById.has(id)) fail("activeRecipeIds", `unknown recipe ${id}`);
  });

  const edgeById = new Map();
  const edgeKeys = new Set();
  for (const [edgeIndex, edge] of relationEdges.entries()) {
    const path = `relationEdges[${edgeIndex}]`;
    assertRecord(edge, path);
    assertExactKeys(edge, [
      "id", "from", "relation", "to", "directed", "reviewStatus"
    ], ["priority"], path);
    assertString(edge.id, `${path}.id`);
    if (edgeById.has(edge.id)) fail("relationEdges", `duplicate id ${edge.id}`);
    const fromKey = selectorKey(edge.from, `${path}.from`);
    const toKey = selectorKey(edge.to, `${path}.to`);
    assertEnum(edge.relation, RELATION_VALUES, `${path}.relation`);
    if (edge.directed !== true) fail(path, "relation edge must be directed");
    if (edge.reviewStatus !== "approved") fail(path, "active relation edge must be approved");
    if (edge.relation === "alternateOf") {
      if (fromKey[0] !== "lexicalUseId" || toKey[0] !== "lexicalUseId") {
        fail(path, "alternateOf requires lexicalUseId endpoints");
      }
      assertIntegerRange(edge.priority, 0, Number.MAX_SAFE_INTEGER, `${path}.priority`);
    } else if (Object.hasOwn(edge, "priority")) {
      fail(path, "priority is only valid for alternateOf");
    }
    for (const [kind, value] of [fromKey, toKey]) {
      if (kind === "lexicalUseId" && !lexicalUseById.has(value)) fail(path, `unknown lexical use ${value}`);
      if (kind === "translationSetId" && !translationSetById.has(value)) fail(path, `unknown translation set ${value}`);
      if (kind === "tag") assertEnum(value, TAG_VALUES, path);
    }
    const edgeKey = canonicalJson([fromKey, edge.relation, toKey]);
    if (edgeKeys.has(edgeKey)) fail("relationEdges", `duplicate edge key ${edgeKey}`);
    edgeKeys.add(edgeKey);
    edgeById.set(edge.id, edge);
  }
  return Object.freeze({ recipeById, edgeById });
}

export function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  if (Array.isArray(value)) value.forEach(item => deepFreeze(item, seen));
  else if (!(value instanceof Map) && !(value instanceof Set)) {
    Object.values(value).forEach(item => deepFreeze(item, seen));
  }
  return Object.freeze(value);
}

export function createPlanId(identityPayload) {
  return `plan:${hashCanonical(identityPayload)}`;
}

export const COMPOSITION_MODEL_ENUMS = Object.freeze({
  languages: Object.freeze([...LANGUAGE_VALUES]),
  scripts: Object.freeze([...SCRIPT_VALUES]),
  tags: Object.freeze([...TAG_VALUES]),
  domains: Object.freeze([...DOMAIN_VALUES]),
  equivalence: Object.freeze([...EQUIVALENCE_VALUES]),
  sizes: Object.freeze(["small", "medium", "large", "xlarge", "xxlarge", "xxxlarge"]),
  rankedSearchTiers: RANKED_SEARCH_TIERS,
  rankedStopReasons: RANKED_STOP_REASONS
});
