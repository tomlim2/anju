import { canonicalJson, hashCanonical } from "./canonical-hash.js";
import {
  BROWSER_CONFORMANCE_PROFILE,
  COMPOSITION_POLICY_VERSION,
  DESIGN_TOKEN_SIZE_ORDER,
  MAX_CANONICAL_PREFIX_VISITS_PER_RECIPE,
  MAX_LAYOUT_DECISION_EXPANSIONS_PER_RECIPE,
  MAX_RANKED_PLANS_PER_RECIPE,
  MAX_RETAINED_VIABLE_DECISIONS_PER_TUPLE,
  NODE_CONFORMANCE_RUNTIME
} from "./config.js";
import {
  candidateMatchesSelector,
  createPlanId,
  deepFreeze,
  validateGenerationInput,
  validatePlannerResultShape,
  validateRecipeRegistry
} from "./composition-model.js";
import { deriveSeed, keyedValue } from "./random.js";
import { validateCompositionLexicalCandidate } from "./token-library.js";

const SIZE_RANK = new Map(DESIGN_TOKEN_SIZE_ORDER.map((size, index) => [size, index]));
const WEIGHT_RANK = new Map([[400, 0], [700, 1], [900, 2]]);
const universeDiagnostics = new WeakMap();

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareNumericArrays(left, right) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function compareRankKeysDescending(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    const difference = right[index] - left[index];
    if (difference !== 0) return difference;
  }
  return 0;
}

function round6(value) {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function manifestPayload(manifest) {
  const {
    ownerSnapshotRevision: _ownerSnapshotRevision,
    ...payload
  } = manifest;
  return payload;
}

function assertOwnerManifest(manifest, generationInput) {
  if (!manifest || manifest.schemaVersion !== 1) throw new Error("owner manifest schema mismatch");
  if (hashCanonical(manifestPayload(manifest)) !== manifest.ownerSnapshotRevision) {
    throw new Error("owner manifest root digest mismatch");
  }
  if (manifest.ownerSnapshotRevision !== generationInput.ownerSnapshotRevision) {
    throw new Error("owner snapshot revision mismatch");
  }
  const expectedTuple = {
    vocabularyVersion: generationInput.vocabularyVersion,
    recipeVersion: generationInput.recipeVersion,
    motifVersion: generationInput.motifVersion,
    configVersion: generationInput.configVersion,
    compositionEngineVersion: generationInput.compositionEngineVersion,
    fontMetricsVersion: generationInput.fontMetricsVersion,
    fontAssetRevision: generationInput.fontAssetRevision
  };
  if (canonicalJson(manifest.versionTuple) !== canonicalJson(expectedTuple)) {
    throw new Error("owner manifest version tuple mismatch");
  }
}

function assertAscendingUnique(values, label) {
  if (!Array.isArray(values) || new Set(values).size !== values.length) {
    throw new Error(`${label} must be unique`);
  }
  values.forEach((value, index) => {
    if (index > 0 && values[index - 1] >= value) throw new Error(`${label} must be ascending`);
  });
}

function assertDeepFrozen(value, path, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (!Object.isFrozen(value)) throw new Error(`${path} must be deeply frozen`);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertDeepFrozen(item, `${path}[${index}]`, seen));
    return;
  }
  for (const [key, item] of Object.entries(value)) assertDeepFrozen(item, `${path}.${key}`, seen);
}

function cloneData(value) {
  if (Array.isArray(value)) return value.map(cloneData);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneData(item)]));
}

function readonlyMap(source, { cloneValues = true } = {}) {
  const map = new Map([...source].map(([key, value]) => [
    key,
    cloneValues ? deepFreeze(cloneData(value)) : value
  ]));
  return Object.freeze({
    size: map.size,
    get: key => map.get(key),
    has: key => map.has(key),
    entries: () => map.entries(),
    keys: () => map.keys(),
    values: () => map.values(),
    forEach: callback => map.forEach((value, key) => callback(value, key)),
    [Symbol.iterator]: () => map[Symbol.iterator]()
  });
}

export const PLANNING_ALL_FIT_POLICY = deepFreeze({
  schemaVersion: 1,
  policyId: "production-all-predicted-fit-v2",
  typographyBounds: { width: 100, height: 100 },
  motifBounds: "active-intrinsic",
  knownGoodReservation: "absent",
  rawDecisionCounting: "before-fit-outcome",
  retainedAndRankedAssertion: "oracle-upper-bound"
});

function expectedVersionsForInput(generationInput) {
  return {
    vocabularyVersion: generationInput.vocabularyVersion,
    recipeVersion: generationInput.recipeVersion,
    motifVersion: generationInput.motifVersion,
    configVersion: generationInput.configVersion,
    compositionEngineVersion: generationInput.compositionEngineVersion,
    fontMetricsVersion: generationInput.fontMetricsVersion,
    fontAssetRevision: generationInput.fontAssetRevision,
    ownerSnapshotRevision: generationInput.ownerSnapshotRevision
  };
}

function validatePlanningRegistryInputs({
  generationInput,
  lexicalUseById,
  translationSetById,
  translationSetByLexicalUseId,
  recipes,
  activeRecipeIds,
  relationEdges,
  candidateById,
  rankedCandidateIds,
  validateMotifRenderParams
}) {
  const { recipeById } = validateRecipeRegistry({
    recipes,
    activeRecipeIds,
    relationEdges,
    lexicalUseById,
    translationSetById
  });
  assertAscendingUnique(activeRecipeIds, "active recipe IDs");
  assertAscendingUnique(rankedCandidateIds, "ranked candidate IDs");
  const candidates = new Map(candidateById);
  const familyOrdinals = new Set();
  const materializationKeys = new Set();
  for (const [candidateId, candidate] of candidates) {
    if (candidateId !== candidate.candidateId) throw new Error(`candidate key mismatch ${candidateId}`);
    if (candidate.sourceKind === "lexical") {
      validateCompositionLexicalCandidate(candidate, {
        vocabularyVersion: generationInput.vocabularyVersion,
        lexicalUseById,
        translationSetByLexicalUseId
      });
      const familyOrdinal = `${candidate.tokenFamilyId}\u0000${candidate.materializationOrdinal}`;
      if (familyOrdinals.has(familyOrdinal)) throw new Error(`duplicate family-local ordinal ${familyOrdinal}`);
      familyOrdinals.add(familyOrdinal);
    } else if (candidate.sourceKind === "motif") {
      validateMotifRenderParams(candidate);
    } else {
      throw new Error(`unknown candidate source ${candidateId}`);
    }
    if (materializationKeys.has(candidate.materializationKey)) {
      throw new Error(`duplicate materialization key ${candidate.materializationKey}`);
    }
    materializationKeys.add(candidate.materializationKey);
  }
  rankedCandidateIds.forEach(id => {
    if (!candidates.has(id)) throw new Error(`ranked candidate is missing ${id}`);
  });
  return { recipeById, candidates };
}

function buildPlanningContext({
  generationInput,
  ownerSnapshotManifest,
  expectedVersions,
  lexicalUseById,
  translationSetByLexicalUseId,
  recipeById,
  activeRecipeIds,
  relationEdges,
  candidates,
  rankedCandidateIds,
  certificateByRecipeId,
  blockPolicyByFootprint,
  enumerateCanonicalLayouts,
  compositionBlockGeometry,
  measureTypography,
  deriveTypographyTokenVariant,
  validateMotifRenderParams
}) {
  return Object.freeze({
    generationInput,
    generationInputHash: hashCanonical(generationInput),
    ownerSnapshotManifest,
    versions: Object.freeze({ ...expectedVersions }),
    candidateById: readonlyMap(candidates),
    rankedCandidateIds: Object.freeze([...rankedCandidateIds]),
    lexicalUseById: readonlyMap(lexicalUseById),
    translationSetByLexicalUseId: readonlyMap(translationSetByLexicalUseId),
    recipeById: readonlyMap(recipeById),
    activeRecipeIds: Object.freeze([...activeRecipeIds]),
    planningComplexityCertificateByRecipeId: readonlyMap(certificateByRecipeId),
    relationEdges: deepFreeze(cloneData(relationEdges)),
    blockPolicyByFootprint: readonlyMap(blockPolicyByFootprint),
    enumerateCanonicalLayouts,
    compositionBlockGeometry,
    measureTypography,
    deriveTypographyTokenVariant,
    validateMotifRenderParams,
    conformance: Object.freeze({
      nodeRuntime: NODE_CONFORMANCE_RUNTIME,
      browserProfile: BROWSER_CONFORMANCE_PROFILE
    })
  });
}

export function createPlanValidationContext({
  generationInput,
  ownerSnapshotManifest,
  registryVersions,
  lexicalUseById,
  translationSetById,
  translationSetByLexicalUseId,
  recipes,
  activeRecipeIds,
  relationEdges,
  candidateById,
  rankedCandidateIds,
  blockPolicyByFootprint,
  enumerateCanonicalLayouts,
  compositionBlockGeometry,
  measureTypography,
  deriveTypographyTokenVariant,
  validateMotifRenderParams
}) {
  validateGenerationInput(generationInput);
  assertDeepFrozen(generationInput, "generationInput");
  assertOwnerManifest(ownerSnapshotManifest, generationInput);
  if (generationInput.configVersion !== COMPOSITION_POLICY_VERSION) {
    throw new Error("composition policy version mismatch");
  }
  const expectedVersions = expectedVersionsForInput(generationInput);
  if (canonicalJson(registryVersions) !== canonicalJson(expectedVersions)) {
    throw new Error("validation context version mismatch");
  }

  const { recipeById, candidates } = validatePlanningRegistryInputs({
    generationInput,
    lexicalUseById,
    translationSetById,
    translationSetByLexicalUseId,
    recipes,
    activeRecipeIds,
    relationEdges,
    candidateById,
    rankedCandidateIds,
    validateMotifRenderParams
  });

  const certificates = ownerSnapshotManifest.planningComplexityCertificates || [];
  const certificateKeys = [
    "recipeId", "oracleRevision", "fixtureRevision", "maxCanonicalPrefixVisits",
    "maxLayoutDecisionExpansions", "maxRetainedViableDecisionsPerTuple", "maxRankedPlans"
  ].sort();
  const certificateBounds = {
    maxCanonicalPrefixVisits: MAX_CANONICAL_PREFIX_VISITS_PER_RECIPE,
    maxLayoutDecisionExpansions: MAX_LAYOUT_DECISION_EXPANSIONS_PER_RECIPE,
    maxRetainedViableDecisionsPerTuple: MAX_RETAINED_VIABLE_DECISIONS_PER_TUPLE,
    maxRankedPlans: MAX_RANKED_PLANS_PER_RECIPE
  };
  if (certificates.length !== activeRecipeIds.length) {
    throw new Error("planning certificate count mismatch");
  }
  const certificateByRecipeId = new Map();
  for (let index = 0; index < certificates.length; index += 1) {
    const certificate = certificates[index];
    if (canonicalJson(Object.keys(certificate).sort()) !== canonicalJson(certificateKeys)) {
      throw new Error(`planning certificate schema mismatch at ${index}`);
    }
    if (certificate.recipeId !== activeRecipeIds[index]) {
      throw new Error("planning certificate order mismatch");
    }
    for (const revisionField of ["oracleRevision", "fixtureRevision"]) {
      if (!/^sha256:[0-9a-f]{64}$/.test(certificate[revisionField])) {
        throw new Error(`planning certificate ${revisionField} mismatch`);
      }
    }
    for (const [field, bound] of Object.entries(certificateBounds)) {
      if (!Number.isInteger(certificate[field]) || certificate[field] < 0 || certificate[field] > bound) {
        throw new Error(`planning certificate ${field} exceeds config bound`);
      }
    }
    if (certificateByRecipeId.has(certificate.recipeId)) {
      throw new Error(`duplicate planning certificate ${certificate.recipeId}`);
    }
    certificateByRecipeId.set(certificate.recipeId, certificate);
  }
  if (
    activeRecipeIds.length !== certificateByRecipeId.size
    || activeRecipeIds.some(id => !certificateByRecipeId.has(id))
  ) {
    throw new Error("planning certificate active recipe mismatch");
  }

  return buildPlanningContext({
    generationInput,
    ownerSnapshotManifest,
    expectedVersions,
    lexicalUseById,
    translationSetByLexicalUseId,
    recipeById,
    activeRecipeIds,
    relationEdges,
    candidates,
    rankedCandidateIds,
    certificateByRecipeId,
    blockPolicyByFootprint,
    enumerateCanonicalLayouts,
    compositionBlockGeometry,
    measureTypography,
    deriveTypographyTokenVariant,
    validateMotifRenderParams
  });
}

export function createPlanningObservationContext({
  generationInput,
  registryVersions,
  lexicalUseById,
  translationSetById,
  translationSetByLexicalUseId,
  recipes,
  activeRecipeIds,
  relationEdges,
  candidateById,
  rankedCandidateIds,
  blockPolicyByFootprint,
  enumerateCanonicalLayouts,
  compositionBlockGeometry,
  deriveTypographyTokenVariant,
  validateMotifRenderParams,
  allFitPolicy
}) {
  validateGenerationInput(generationInput);
  assertDeepFrozen(generationInput, "generationInput");
  if (generationInput.configVersion !== COMPOSITION_POLICY_VERSION) {
    throw new Error("composition policy version mismatch");
  }
  if (canonicalJson(allFitPolicy) !== canonicalJson(PLANNING_ALL_FIT_POLICY)) {
    throw new Error("planning all-fit policy mismatch");
  }
  const expectedVersions = expectedVersionsForInput(generationInput);
  if (canonicalJson(registryVersions) !== canonicalJson(expectedVersions)) {
    throw new Error("planning observation version mismatch");
  }
  const { recipeById, candidates } = validatePlanningRegistryInputs({
    generationInput,
    lexicalUseById,
    translationSetById,
    translationSetByLexicalUseId,
    recipes,
    activeRecipeIds,
    relationEdges,
    candidateById,
    rankedCandidateIds,
    validateMotifRenderParams
  });
  const typographyBounds = Object.freeze({ ...PLANNING_ALL_FIT_POLICY.typographyBounds });
  return buildPlanningContext({
    generationInput,
    ownerSnapshotManifest: null,
    expectedVersions,
    lexicalUseById,
    translationSetByLexicalUseId,
    recipeById,
    activeRecipeIds,
    relationEdges,
    candidates,
    rankedCandidateIds,
    certificateByRecipeId: new Map(),
    blockPolicyByFootprint,
    enumerateCanonicalLayouts,
    compositionBlockGeometry,
    measureTypography: () => typographyBounds,
    deriveTypographyTokenVariant,
    validateMotifRenderParams
  });
}

export function deriveCanonicalCardinalityShapes(recipeId, context) {
  const recipe = context.recipeById.get(recipeId);
  if (!recipe) throw new Error(`unknown recipe ${recipeId}`);
  const shapes = [];
  const counts = Array(recipe.slots.length).fill(0);

  function visit(index) {
    if (index === recipe.slots.length) {
      const totalInstanceCount = counts.reduce((sum, count) => sum + count, 0);
      if (totalInstanceCount < recipe.blockCount.min || totalInstanceCount > recipe.blockCount.max) return;
      shapes.push(Object.freeze({
        counts: Object.freeze([...counts]),
        totalInstanceCount,
        shapeKey: Object.freeze([totalInstanceCount, ...counts])
      }));
      return;
    }
    const slot = recipe.slots[index];
    for (let count = slot.cardinality.min; count <= slot.cardinality.max; count += 1) {
      counts[index] = count;
      visit(index + 1);
    }
  }
  visit(0);
  shapes.sort((left, right) => compareNumericArrays(left.shapeKey, right.shapeKey));
  return Object.freeze(shapes);
}

function instancesForShape(recipe, shape) {
  const instances = [];
  recipe.slots.forEach((definition, definitionIndex) => {
    for (let ordinal = 1; ordinal <= shape.counts[definitionIndex]; ordinal += 1) {
      instances.push(Object.freeze({
        id: `${definition.id}-${ordinal}`,
        slotDefinitionId: definition.id,
        definition
      }));
    }
  });
  return Object.freeze(instances);
}

function sourceKindForDefinition(definition) {
  return definition.source === "graphic" ? "motif" : "lexical";
}

function candidatePassesUnary(candidate, instance) {
  const expectedSource = sourceKindForDefinition(instance.definition);
  if (candidate.sourceKind !== expectedSource) return false;
  if (candidate.sourceKind === "lexical") {
    if (candidate.reviewStatus !== "approved") return false;
    return instance.definition.acceptsAnyTag.some(tag => candidate.tags.includes(tag));
  }
  return true;
}

function domainsForShape(recipe, shape, context) {
  return Object.freeze(instancesForShape(recipe, shape).map(instance => Object.freeze({
    slotInstanceId: instance.id,
    slotDefinitionId: instance.slotDefinitionId,
    sourceKind: sourceKindForDefinition(instance.definition),
    candidateIds: Object.freeze(context.rankedCandidateIds.filter(candidateId =>
      candidatePassesUnary(context.candidateById.get(candidateId), instance)
    ))
  })));
}

export function deriveCanonicalSlotDomains(recipeId, context, shape = null) {
  const recipe = context.recipeById.get(recipeId);
  if (!recipe) throw new Error(`unknown recipe ${recipeId}`);
  if (shape) return domainsForShape(recipe, shape, context);
  return Object.freeze(deriveCanonicalCardinalityShapes(recipeId, context).map(cardinalityShape =>
    Object.freeze({
      shape: cardinalityShape,
      domains: domainsForShape(recipe, cardinalityShape, context)
    })
  ));
}

function resolvedSlotProjection(slot, context) {
  const candidate = context.candidateById.get(slot.candidateId);
  const shared = {
    id: slot.id,
    slotDefinitionId: slot.slotDefinitionId,
    sourceKind: slot.sourceKind,
    candidateId: slot.candidateId
  };
  if (!candidate) return shared;
  if (candidate.sourceKind === "lexical") {
    return {
      ...shared,
      lexicalUseId: candidate.lexicalUseId,
      translationSetId: candidate.translationSetId,
      instanceKey: candidate.instanceKey,
      phrasePackId: candidate.phrasePackId
    };
  }
  return {
    ...shared,
    motifId: candidate.motifId,
    materializationKey: candidate.materializationKey
  };
}

function tupleFingerprint(tuple, context) {
  return hashCanonical({
    recipeId: tuple.recipeId,
    slots: tuple.slots.map(slot => resolvedSlotProjection(slot, context))
  });
}

function edgeMatches(fromCandidate, relation, toCandidate, context) {
  return context.relationEdges.some(edge =>
    edge.reviewStatus === "approved"
    && edge.relation === relation
    && candidateMatchesSelector(fromCandidate, edge.from)
    && candidateMatchesSelector(toCandidate, edge.to)
  );
}

function slotsByDefinition(tuple) {
  const result = new Map();
  for (const slot of tuple.slots) {
    const slots = result.get(slot.slotDefinitionId) || [];
    slots.push(slot);
    result.set(slot.slotDefinitionId, slots);
  }
  return result;
}

function collectRepeatedOrderReasons(tuple) {
  const reasons = [];
  const byDefinition = slotsByDefinition(tuple);
  for (const [definitionId, slots] of byDefinition) {
    for (let index = 1; index < slots.length; index += 1) {
      if (slots[index - 1].candidateId >= slots[index].candidateId) {
        reasons.push(`tuple.noncanonical-repeated-slot:${definitionId}`);
        break;
      }
    }
  }
  return reasons;
}

function collectAvoidReasons(tuple, recipe, context) {
  const reasons = [];
  const lexicalSlots = tuple.slots
    .filter(slot => context.candidateById.get(slot.candidateId)?.sourceKind === "lexical")
    .sort((left, right) => compareStrings(left.id, right.id));
  const rules = [...recipe.pairRules.avoid].sort((left, right) => compareStrings(left.id, right.id));
  for (const fromSlot of lexicalSlots) {
    for (const toSlot of lexicalSlots) {
      if (fromSlot.id === toSlot.id) continue;
      const from = context.candidateById.get(fromSlot.candidateId);
      const to = context.candidateById.get(toSlot.candidateId);
      for (const rule of rules) {
        if (candidateMatchesSelector(from, rule.from) && candidateMatchesSelector(to, rule.to)) {
          reasons.push(`avoid:${rule.id}:${fromSlot.id}:${toSlot.id}`);
        }
      }
    }
  }
  return reasons;
}

function collectDuplicateReasons(tuple, context) {
  const reasons = [];
  const lexicalSlots = tuple.slots
    .filter(slot => context.candidateById.get(slot.candidateId)?.sourceKind === "lexical")
    .sort((left, right) => compareStrings(left.id, right.id));
  for (let leftIndex = 0; leftIndex < lexicalSlots.length; leftIndex += 1) {
    const leftSlot = lexicalSlots[leftIndex];
    const left = context.candidateById.get(leftSlot.candidateId);
    for (let rightIndex = leftIndex + 1; rightIndex < lexicalSlots.length; rightIndex += 1) {
      const rightSlot = lexicalSlots[rightIndex];
      const right = context.candidateById.get(rightSlot.candidateId);
      if (left.normalizedVisibleText === right.normalizedVisibleText) {
        reasons.push(`duplicate-text:${leftSlot.id}:${rightSlot.id}`);
      }
      if (left.translationSetId && left.translationSetId === right.translationSetId) {
        reasons.push(`duplicate-translation:${leftSlot.id}:${rightSlot.id}`);
      }
      if (left.phrasePackId && left.phrasePackId === right.phrasePackId) {
        reasons.push(`duplicate-phrase-pack:${leftSlot.id}:${rightSlot.id}`);
      }
    }
  }
  return reasons;
}

function collectRequiredRelationReasons(tuple, recipe, context, { partial = false } = {}) {
  const reasons = [];
  const byDefinition = slotsByDefinition(tuple);
  for (const clause of recipe.requiredRelations) {
    const fromSlots = byDefinition.get(clause.fromSlot) || [];
    const toSlots = byDefinition.get(clause.toSlot) || [];
    if (clause.whenSlotPresent && (byDefinition.get(clause.whenSlotPresent) || []).length === 0) continue;
    if (partial && (fromSlots.length === 0 || toSlots.length === 0)) continue;
    if (fromSlots.length !== 1 || toSlots.length !== 1) {
      if (!partial) reasons.push(`relation-cardinality:${clause.fromSlot}:${clause.toSlot}`);
      continue;
    }
    const from = context.candidateById.get(fromSlots[0].candidateId);
    const to = context.candidateById.get(toSlots[0].candidateId);
    if (!clause.relations.some(relation => edgeMatches(from, relation, to, context))) {
      reasons.push(`relation:${clause.fromSlot}:${clause.relations.join("|")}:${clause.toSlot}`);
    }
  }
  return reasons;
}

function collectMotifReasons(tuple, context) {
  const reasons = [];
  const motifs = tuple.slots
    .map(slot => [slot, context.candidateById.get(slot.candidateId)])
    .filter(([, candidate]) => candidate?.sourceKind === "motif");
  const seen = new Map();
  for (const [slot, candidate] of motifs) {
    if (seen.has(candidate.motifId)) {
      reasons.push(`duplicate-motif:${seen.get(candidate.motifId)}:${slot.id}`);
    } else {
      seen.set(candidate.motifId, slot.id);
    }
  }
  return reasons;
}

function collectUnaryAndShapeReasons(tuple, recipe, context, { partial = false } = {}) {
  const reasons = [];
  const definitionById = new Map(recipe.slots.map(definition => [definition.id, definition]));
  const counts = new Map();
  const seenIds = new Set();
  for (const slot of tuple.slots) {
    if (seenIds.has(slot.id)) reasons.push(`tuple.duplicate-slot-id:${slot.id}`);
    seenIds.add(slot.id);
    const definition = definitionById.get(slot.slotDefinitionId);
    if (!definition) {
      reasons.push(`tuple.unknown-slot-definition:${slot.slotDefinitionId}`);
      continue;
    }
    counts.set(definition.id, (counts.get(definition.id) || 0) + 1);
    const expectedId = `${definition.id}-${counts.get(definition.id)}`;
    if (slot.id !== expectedId) reasons.push(`tuple.slot-id-order:${slot.id}`);
    const candidate = context.candidateById.get(slot.candidateId);
    if (!candidate) {
      reasons.push(`tuple.unknown-candidate:${slot.candidateId}`);
      continue;
    }
    if (slot.sourceKind !== candidate.sourceKind || !candidatePassesUnary(candidate, {
      definition,
      slotDefinitionId: definition.id
    })) {
      reasons.push(`tuple.unary-incompatible:${slot.id}:${slot.candidateId}`);
    }
  }
  if (!partial) {
    for (const definition of recipe.slots) {
      const count = counts.get(definition.id) || 0;
      if (count < definition.cardinality.min || count > definition.cardinality.max) {
        reasons.push(`tuple.cardinality:${definition.id}:${count}`);
      }
    }
    if (tuple.slots.length < recipe.blockCount.min || tuple.slots.length > recipe.blockCount.max) {
      reasons.push(`tuple.block-count:${tuple.slots.length}`);
    }
  }
  return reasons;
}

function compatibilityReasons(tuple, recipe, context, options = {}) {
  return [
    ...collectUnaryAndShapeReasons(tuple, recipe, context, options),
    ...collectRepeatedOrderReasons(tuple),
    ...collectAvoidReasons(tuple, recipe, context),
    ...collectDuplicateReasons(tuple, context),
    ...collectMotifReasons(tuple, context),
    ...collectRequiredRelationReasons(tuple, recipe, context, options)
  ];
}

export function validateTupleCompatibility(tuple, context) {
  const recipe = context.recipeById.get(tuple?.recipeId);
  const fingerprint = tuple?.recipeId && Array.isArray(tuple?.slots)
    ? tupleFingerprint(tuple, context)
    : hashCanonical({ recipeId: tuple?.recipeId || null, slots: [] });
  if (!recipe || !Array.isArray(tuple?.slots)) {
    return deepFreeze({
      valid: false,
      tupleFingerprint: fingerprint,
      compatibleTuple: null,
      rejectionReasons: ["tuple.unknown-recipe-or-shape"]
    });
  }
  const reasons = [...new Set(compatibilityReasons(tuple, recipe, context))];
  if (reasons.length > 0) {
    return deepFreeze({
      valid: false,
      tupleFingerprint: fingerprint,
      compatibleTuple: null,
      rejectionReasons: reasons
    });
  }
  return deepFreeze({
    valid: true,
    tupleFingerprint: fingerprint,
    compatibleTuple: {
      recipeId: tuple.recipeId,
      slots: tuple.slots.map(slot => ({ ...slot }))
    },
    rejectionReasons: []
  });
}

export function validateTupleCompatibilityPrefix(partialAssignment, shape, context) {
  const recipe = context.recipeById.get(partialAssignment?.recipeId);
  if (!recipe || !Array.isArray(partialAssignment?.slots)) {
    return deepFreeze({ status: "reject", rejectionReasons: ["tuple.unknown-recipe-or-shape"] });
  }
  if (shape && partialAssignment.slots.length > shape.totalInstanceCount) {
    return deepFreeze({ status: "reject", rejectionReasons: ["tuple.prefix-overflow"] });
  }
  const reasons = [...new Set(compatibilityReasons(partialAssignment, recipe, context, { partial: true }))];
  return reasons.length > 0
    ? deepFreeze({ status: "reject", rejectionReasons: reasons })
    : deepFreeze({ status: "continue" });
}

export function* enumerateCanonicalSemanticTuples(recipeId, context, instrumentation = null) {
  const recipe = context.recipeById.get(recipeId);
  if (!recipe) throw new Error(`unknown recipe ${recipeId}`);
  for (const shape of deriveCanonicalCardinalityShapes(recipeId, context)) {
    const domains = domainsForShape(recipe, shape, context);
    function* walk(index, slots) {
      if (instrumentation) instrumentation.canonicalPrefixVisits += 1;
      const partial = { recipeId, slots };
      const prefixResult = validateTupleCompatibilityPrefix(partial, shape, context);
      if (prefixResult.status === "reject") return;
      if (index === domains.length) {
        const result = validateTupleCompatibility(partial, context);
        if (result.valid) yield result.compatibleTuple;
        return;
      }
      const domain = domains[index];
      for (const candidateId of domain.candidateIds) {
        yield* walk(index + 1, [
          ...slots,
          {
            id: domain.slotInstanceId,
            slotDefinitionId: domain.slotDefinitionId,
            sourceKind: domain.sourceKind,
            candidateId
          }
        ]);
      }
    }
    yield* walk(0, []);
  }
}

function orientationFor(candidate, policy) {
  if (candidate.sourceKind !== "lexical" || !policy.rotation) return "none";
  if (candidate.script === "hangul" || candidate.script === "han") {
    return policy.cjkOrientationModes?.[0] || "glyph-sideways-stack";
  }
  return policy.englishOrientationModes?.[0] || "whole-rotate";
}

function defaultStartSize(role, area) {
  if (role === "metadata") return "small";
  if (role === "hero") {
    if (area >= 6) return "xxxlarge";
    if (area >= 3) return "xxlarge";
    if (area >= 2) return "xlarge";
    return "large";
  }
  if (area >= 6) return "xxlarge";
  if (area >= 3) return "large";
  if (area >= 2) return "large";
  return "medium";
}

function requestedStartSizes(role, area, policy) {
  const sizes = policy.requestedSizes?.length
    ? [...policy.requestedSizes]
    : [defaultStartSize(role, area)];
  if (new Set(sizes).size !== sizes.length || sizes.some(size => !SIZE_RANK.has(size))) {
    throw new Error(`invalid requested sizes for ${policy.footprint}`);
  }
  return Object.freeze(sizes);
}

function fallbackSizes(startSize, candidate) {
  const startIndex = SIZE_RANK.get(startSize);
  return DESIGN_TOKEN_SIZE_ORDER
    .slice(0, startIndex + 1)
    .reverse()
    .filter(size => candidate.supportedSizes.includes(size));
}

function fitMargin(bounds, contentBox) {
  return round6(Math.min(
    (contentBox.width - bounds.width) / contentBox.width,
    (contentBox.height - bounds.height) / contentBox.height
  ));
}

function predictedOccupancyScore(bounds, safeBox, safetyFactor) {
  const normalizedArea = round6(
    (bounds.width / safeBox.width) * (bounds.height / safeBox.height)
  );
  return round6(normalizedArea * safetyFactor);
}

function lexicalBlockDecision({
  candidate,
  slot,
  layoutBlock,
  geometry,
  policy,
  context,
  startSize,
  heroDecision = null
}) {
  if (!candidate.supportedSizes.includes(startSize)) return null;
  const orientationMode = orientationFor(candidate, policy);
  const supportedFallbackSizes = fallbackSizes(startSize, candidate);
  if (!supportedFallbackSizes.length) return null;
  const requestedVariant = context.deriveTypographyTokenVariant(candidate, {
    requestedSize: startSize,
    footprint: layoutBlock.footprint,
    compositionRole: slot.definition.compositionRole
  });
  for (const predictedActualSize of supportedFallbackSizes) {
    const predictedVariant = context.deriveTypographyTokenVariant(candidate, {
      requestedSize: predictedActualSize,
      footprint: layoutBlock.footprint,
      compositionRole: slot.definition.compositionRole
    });
    if (heroDecision && slot.definition.compositionRole !== "hero") {
      const sizeDifference = SIZE_RANK.get(predictedActualSize) - SIZE_RANK.get(heroDecision.predictedActualSize);
      if (sizeDifference > 0) continue;
      if (
        sizeDifference === 0
        && predictedVariant.requestedFontWeight >= heroDecision.predictedActualFontWeight
      ) continue;
    }
    const bounds = context.measureTypography({
      text: candidate.visibleText,
      typeface: candidate.typeface,
      fontWeight: predictedVariant.requestedFontWeight,
      size: predictedActualSize,
      lineHeight: 1,
      orientationMode
    });
    const margin = fitMargin(bounds, geometry.contentBox);
    if (margin < 0) continue;
    return Object.freeze({
      id: null,
      footprint: layoutBlock.footprint,
      cells: layoutBlock.cells,
      slotInstanceId: slot.id,
      requestedSize: requestedVariant.requestedSize,
      requestedWeight: requestedVariant.requestedWeight,
      requestedFontWeight: requestedVariant.requestedFontWeight,
      alignment: geometry.alignment,
      verticalAlignment: geometry.verticalAlignment,
      orientationMode,
      predictedActualSize,
      predictedActualFontWeight: predictedVariant.requestedFontWeight,
      predictedBounds: bounds,
      fitMargin: margin
    });
  }
  return null;
}

function motifBlockDecision({ candidate, slot, layoutBlock, geometry, policy }) {
  if (!policy.allowGraphic || layoutBlock.cells.length >= 6) return null;
  const margin = fitMargin(candidate.intrinsicBounds, geometry.contentBox);
  if (margin < 0) return null;
  return Object.freeze({
    id: null,
    footprint: layoutBlock.footprint,
    cells: layoutBlock.cells,
    slotInstanceId: slot.id,
    requestedSize: candidate.renderParams.size,
    requestedWeight: null,
    requestedFontWeight: null,
    alignment: geometry.alignment,
    verticalAlignment: geometry.verticalAlignment,
    orientationMode: "none",
    predictedBounds: candidate.intrinsicBounds,
    fitMargin: margin
  });
}

function preliminaryDecision(tuple, layout, context, requestedSizeBySlotId) {
  const recipe = context.recipeById.get(tuple.recipeId);
  const definitionById = new Map(recipe.slots.map(definition => [definition.id, definition]));
  const slotById = new Map(tuple.slots.map(slot => [slot.id, {
    ...slot,
    definition: definitionById.get(slot.slotDefinitionId)
  }]));
  const heroSlot = [...slotById.values()].find(slot => slot.definition.compositionRole === "hero");
  const heroLayoutBlock = layout.blocks.find(block => block.slotInstanceId === heroSlot.id);
  const heroPolicy = context.blockPolicyByFootprint.get(heroLayoutBlock.footprint);
  const heroGeometry = context.compositionBlockGeometry(context.generationInput.safeBox, heroLayoutBlock.cells);
  const heroCandidate = context.candidateById.get(heroSlot.candidateId);
  const heroDecision = lexicalBlockDecision({
    candidate: heroCandidate,
    slot: heroSlot,
    layoutBlock: heroLayoutBlock,
    geometry: heroGeometry,
    policy: heroPolicy,
    context,
    startSize: requestedSizeBySlotId.get(heroSlot.id)
  });
  if (!heroDecision) return null;

  const motifBlocks = layout.blocks.filter(block =>
    context.candidateById.get(slotById.get(block.slotInstanceId).candidateId).sourceKind === "motif"
  );
  if (motifBlocks.some(block => block.cells.length >= heroLayoutBlock.cells.length)) return null;

  const decisions = [];
  for (const layoutBlock of layout.blocks) {
    const slot = slotById.get(layoutBlock.slotInstanceId);
    const candidate = context.candidateById.get(slot.candidateId);
    const policy = context.blockPolicyByFootprint.get(layoutBlock.footprint);
    if (!policy) return null;
    const geometry = context.compositionBlockGeometry(context.generationInput.safeBox, layoutBlock.cells);
    const decision = slot.id === heroSlot.id
      ? heroDecision
      : candidate.sourceKind === "lexical"
        ? lexicalBlockDecision({
            candidate,
            slot,
            layoutBlock,
            geometry,
            policy,
            context,
            startSize: requestedSizeBySlotId.get(slot.id),
            heroDecision
          })
        : motifBlockDecision({ candidate, slot, layoutBlock, geometry, policy });
    if (!decision) return null;
    decisions.push({ ...decision, id: `block-${decisions.length + 1}` });
  }
  const heroOccupancy = predictedOccupancyScore(
    heroDecision.predictedBounds,
    context.generationInput.safeBox,
    1
  );
  for (const decision of decisions) {
    const slot = slotById.get(decision.slotInstanceId);
    const candidate = context.candidateById.get(slot.candidateId);
    if (
      candidate.sourceKind === "motif"
      && predictedOccupancyScore(
        decision.predictedBounds,
        context.generationInput.safeBox,
        candidate.occupancySafetyFactor
      ) >= heroOccupancy
    ) return null;
  }
  return Object.freeze({
    blocks: Object.freeze(decisions.map(block => Object.freeze(block))),
    minNormalizedFitMargin: round6(Math.min(...decisions.map(block => block.fitMargin)))
  });
}

function *enumerateRequestedSizeAssignments(tuple, layout, context) {
  const recipe = context.recipeById.get(tuple.recipeId);
  const definitionById = new Map(recipe.slots.map(definition => [definition.id, definition]));
  const slotById = new Map(tuple.slots.map(slot => [slot.id, slot]));
  const domains = [];
  for (const layoutBlock of layout.blocks) {
    const slot = slotById.get(layoutBlock.slotInstanceId);
    const candidate = context.candidateById.get(slot.candidateId);
    if (candidate.sourceKind !== "lexical") continue;
    const policy = context.blockPolicyByFootprint.get(layoutBlock.footprint);
    if (!policy) throw new Error(`missing block policy ${layoutBlock.footprint}`);
    const definition = definitionById.get(slot.slotDefinitionId);
    domains.push(Object.freeze({
      slotInstanceId: slot.id,
      sizes: requestedStartSizes(
        definition.compositionRole,
        layoutBlock.cells.length,
        policy
      )
    }));
  }

  function *walk(index, assignment) {
    if (index === domains.length) {
      yield new Map(assignment);
      return;
    }
    const domain = domains[index];
    for (const size of domain.sizes) {
      assignment.push([domain.slotInstanceId, size]);
      yield* walk(index + 1, assignment);
      assignment.pop();
    }
  }

  yield* walk(0, []);
}

function preferRuleMatches(recipe, tuple, context) {
  const lexicalCandidates = tuple.slots
    .map(slot => context.candidateById.get(slot.candidateId))
    .filter(candidate => candidate.sourceKind === "lexical");
  const matches = [];
  for (const rule of recipe.pairRules.prefer) {
    const matched = lexicalCandidates.some(from => lexicalCandidates.some(to =>
      from !== to
      && candidateMatchesSelector(from, rule.from)
      && candidateMatchesSelector(to, rule.to)
      && edgeMatches(from, rule.relation, to, context)
    ));
    if (matched) matches.push(rule.id);
  }
  return matches.sort(compareStrings);
}

function touchesEdge(cells) {
  return cells.some(cell => [1, 2, 3, 4, 6, 7, 8, 9].includes(cell));
}

function touchesCorner(cells) {
  return cells.some(cell => [1, 3, 7, 9].includes(cell));
}

export function derivePlanRankFacts({
  tuple,
  blocks,
  minNormalizedFitMargin,
  maxCellCountBySlotInstanceId,
  context
}) {
  const recipe = context.recipeById.get(tuple.recipeId);
  const slotById = new Map(tuple.slots.map(slot => [slot.id, slot]));
  const definitionById = new Map(recipe.slots.map(definition => [definition.id, definition]));
  const heroSlot = tuple.slots.find(slot => definitionById.get(slot.slotDefinitionId).compositionRole === "hero");
  const heroBlock = blocks.find(block => block.slotInstanceId === heroSlot.id);
  const preferRuleMatchIds = preferRuleMatches(recipe, tuple, context);
  const layoutPreferenceMatches = [];
  for (const [slotDefinitionId, preferences] of Object.entries(recipe.layoutPreferences)) {
    const relevantBlocks = blocks.filter(block =>
      slotById.get(block.slotInstanceId)?.slotDefinitionId === slotDefinitionId
    );
    for (const preference of preferences) {
      const matched = relevantBlocks.some(block => {
        if (preference === "largest-viable-footprint") {
          return block.cells.length === maxCellCountBySlotInstanceId[block.slotInstanceId];
        }
        if (preference === "edge") return touchesEdge(block.cells);
        return touchesCorner(block.cells);
      });
      if (matched) layoutPreferenceMatches.push(`${slotDefinitionId}:${preference}`);
    }
  }
  const rankKey = Object.freeze([
    preferRuleMatchIds.length,
    SIZE_RANK.get(heroBlock.requestedSize),
    WEIGHT_RANK.get(heroBlock.requestedFontWeight),
    heroBlock.cells.length,
    round6(minNormalizedFitMargin),
    layoutPreferenceMatches.length
  ]);
  return deepFreeze({
    rankKey,
    preferRuleMatchIds,
    minNormalizedFitMargin: round6(minNormalizedFitMargin),
    layoutPreferenceMatches
  });
}

function publicBlock(block) {
  const {
    predictedActualSize: _predictedActualSize,
    predictedActualFontWeight: _predictedActualFontWeight,
    predictedBounds: _predictedBounds,
    fitMargin: _fitMargin,
    ...result
  } = block;
  return result;
}

export function deriveTupleLayoutFacts(tuple, context, instrumentation = null) {
  const compatibility = validateTupleCompatibility(tuple, context);
  if (!compatibility.valid) throw new Error(`incompatible tuple: ${compatibility.rejectionReasons.join(", ")}`);
  const layouts = context.enumerateCanonicalLayouts(tuple.slots.map(slot => slot.id));
  const preliminary = [];
  for (const layout of layouts) {
    for (const requestedSizeBySlotId of enumerateRequestedSizeAssignments(tuple, layout, context)) {
      if (instrumentation) instrumentation.layoutDecisionExpansions += 1;
      const decision = preliminaryDecision(tuple, layout, context, requestedSizeBySlotId);
      if (decision) preliminary.push(decision);
    }
  }
  const maxCellCountBySlotInstanceId = Object.fromEntries(tuple.slots.map(slot => [
    slot.id,
    Math.max(0, ...preliminary.map(decision =>
      decision.blocks.find(block => block.slotInstanceId === slot.id)?.cells.length || 0
    ))
  ]));
  const viableDecisions = preliminary.map(decision => {
    const blocks = decision.blocks.map(publicBlock);
    const rankFacts = derivePlanRankFacts({
      tuple,
      blocks,
      minNormalizedFitMargin: decision.minNormalizedFitMargin,
      maxCellCountBySlotInstanceId,
      context
    });
    return deepFreeze({
      decisionFingerprint: hashCanonical({ tupleFingerprint: compatibility.tupleFingerprint, blocks }),
      blocks,
      rankFacts
    });
  });
  if (instrumentation) {
    instrumentation.retainedViableDecisions = Math.max(
      instrumentation.retainedViableDecisions,
      viableDecisions.length
    );
  }
  return deepFreeze({
    tupleFingerprint: compatibility.tupleFingerprint,
    viableDecisions,
    maxCellCountBySlotInstanceId
  });
}

function materializePlanSlots(tuple, decision, context) {
  const recipe = context.recipeById.get(tuple.recipeId);
  const definitionById = new Map(recipe.slots.map(definition => [definition.id, definition]));
  return tuple.slots.map(slot => {
    const definition = definitionById.get(slot.slotDefinitionId);
    const candidate = context.candidateById.get(slot.candidateId);
    const block = decision.blocks.find(item => item.slotInstanceId === slot.id);
    const shared = {
      id: slot.id,
      slotDefinitionId: slot.slotDefinitionId,
      compositionRole: definition.compositionRole,
      prominence: definition.prominence,
      sourceKind: candidate.sourceKind
    };
    if (candidate.sourceKind === "lexical") {
      const variant = context.deriveTypographyTokenVariant(candidate, {
        requestedSize: block.requestedSize,
        footprint: block.footprint,
        compositionRole: definition.compositionRole
      });
      return {
        ...shared,
        lexicalUseId: candidate.lexicalUseId,
        translationSetId: candidate.translationSetId,
        candidateId: candidate.candidateId,
        tokenId: variant.tokenId,
        instanceKey: candidate.instanceKey,
        phrasePackId: candidate.phrasePackId
      };
    }
    return {
      ...shared,
      motifId: candidate.motifId,
      candidateId: candidate.candidateId,
      tokenId: candidate.tokenId,
      materializationKey: candidate.materializationKey,
      renderParams: candidate.renderParams,
      renderParamsHash: candidate.renderParamsHash,
      occupancySafetyFactor: candidate.occupancySafetyFactor,
      occupancyCalibrationRevision: candidate.occupancyCalibrationRevision
    };
  });
}

export function materializeCompositionPlan(tuple, decision, context) {
  const recipe = context.recipeById.get(tuple.recipeId);
  const slots = materializePlanSlots(tuple, decision, context);
  const identityPayload = {
    schemaVersion: 3,
    generationInputHash: context.generationInputHash,
    recipeId: tuple.recipeId,
    coherenceMode: recipe.coherenceMode,
    slots: [...slots].sort((left, right) => compareStrings(left.id, right.id)),
    blocks: [...decision.blocks].sort((left, right) => compareStrings(left.id, right.id))
  };
  return deepFreeze({
    schemaVersion: 3,
    planId: createPlanId(identityPayload),
    generationInputHash: context.generationInputHash,
    generationInput: context.generationInput,
    recipeId: tuple.recipeId,
    coherenceMode: recipe.coherenceMode,
    slots,
    blocks: decision.blocks,
    decisionTrace: decision.rankFacts
  });
}

function tupleFromPlan(plan) {
  return {
    recipeId: plan.recipeId,
    slots: plan.slots.map(slot => ({
      id: slot.id,
      slotDefinitionId: slot.slotDefinitionId,
      sourceKind: slot.sourceKind,
      candidateId: slot.candidateId
    }))
  };
}

export function validateCompositionPlan(plan, context) {
  if (plan?.schemaVersion !== 3) throw new Error("composition plan schema mismatch");
  if (plan.generationInput !== context.generationInput) throw new Error("plan GenerationInput object mismatch");
  if (plan.generationInputHash !== context.generationInputHash) throw new Error("plan input hash mismatch");
  const tuple = tupleFromPlan(plan);
  const compatibility = validateTupleCompatibility(tuple, context);
  if (!compatibility.valid) throw new Error(`plan tuple invalid: ${compatibility.rejectionReasons.join(", ")}`);
  const facts = deriveTupleLayoutFacts(tuple, context);
  const matchingDecision = facts.viableDecisions.find(decision =>
    canonicalJson(decision.blocks) === canonicalJson(plan.blocks)
  );
  if (!matchingDecision) throw new Error("plan blocks are not a viable tuple decision");
  const expected = materializeCompositionPlan(tuple, matchingDecision, context);
  if (canonicalJson(expected) !== canonicalJson(plan)) throw new Error("composition plan identity mismatch");
  for (const slot of plan.slots.filter(item => item.sourceKind === "motif")) {
    context.validateMotifRenderParams(context.candidateById.get(slot.candidateId));
  }
  return plan;
}

function assertPlanningCounters(recipeId, counters, context) {
  const limits = {
    canonicalPrefixVisits: MAX_CANONICAL_PREFIX_VISITS_PER_RECIPE,
    layoutDecisionExpansions: MAX_LAYOUT_DECISION_EXPANSIONS_PER_RECIPE,
    retainedViableDecisions: MAX_RETAINED_VIABLE_DECISIONS_PER_TUPLE,
    rankedPlans: MAX_RANKED_PLANS_PER_RECIPE
  };
  for (const [field, limit] of Object.entries(limits)) {
    if (counters[field] > limit) throw new Error(`planning-complexity:${recipeId}:${field}`);
  }
  const certificate = context.planningComplexityCertificateByRecipeId.get(recipeId);
  const certificateFields = {
    canonicalPrefixVisits: "maxCanonicalPrefixVisits",
    layoutDecisionExpansions: "maxLayoutDecisionExpansions",
    retainedViableDecisions: "maxRetainedViableDecisionsPerTuple",
    rankedPlans: "maxRankedPlans"
  };
  for (const [field, certificateField] of Object.entries(certificateFields)) {
    if (!Number.isInteger(certificate[certificateField]) || counters[field] > certificate[certificateField]) {
      throw new Error(`planning-certificate:${recipeId}:${field}`);
    }
  }
}

function recipeRotation(context) {
  const recipeChoiceValue = keyedValue(
    deriveSeed(context.generationInput, "recipe-choice"),
    "active-pilot"
  );
  const recipeStartIndex = Math.min(
    context.activeRecipeIds.length - 1,
    Math.floor(recipeChoiceValue * context.activeRecipeIds.length)
  );
  return {
    recipeStartIndex,
    recipeOrder: Object.freeze([
      ...context.activeRecipeIds.slice(recipeStartIndex),
      ...context.activeRecipeIds.slice(0, recipeStartIndex)
    ])
  };
}

function validateKnownGoodMap(knownGoodPlanByRecipeId, context) {
  if (!(knownGoodPlanByRecipeId instanceof Map)) throw new TypeError("known-good plans must be a Map");
  const reservedPlanIds = [];
  for (const [recipeId, plan] of knownGoodPlanByRecipeId) {
    if (!context.activeRecipeIds.includes(recipeId) || plan.recipeId !== recipeId) {
      throw new Error(`invalid known-good recipe ${recipeId}`);
    }
    validateCompositionPlan(plan, context);
    reservedPlanIds.push(plan.planId);
  }
  assertAscendingUnique(reservedPlanIds.sort(compareStrings), "reserved plan IDs");
  return reservedPlanIds;
}

export function deriveRankedPlanUniverse(context, knownGoodPlanByRecipeId = new Map()) {
  const reservedPlanIds = validateKnownGoodMap(knownGoodPlanByRecipeId, context);
  const reserved = new Set(reservedPlanIds);
  const { recipeOrder, recipeStartIndex } = recipeRotation(context);
  const examinedRecipeIds = [];
  let selectedRecipeId = null;
  let rankedPlans = [];
  const diagnosticsByRecipeId = {};

  for (const recipeId of recipeOrder) {
    examinedRecipeIds.push(recipeId);
    const counters = {
      canonicalPrefixVisits: 0,
      layoutDecisionExpansions: 0,
      retainedViableDecisions: 0,
      rankedPlans: 0
    };
    const planIds = new Set();
    const records = [];
    for (const tuple of enumerateCanonicalSemanticTuples(recipeId, context, counters)) {
      const facts = deriveTupleLayoutFacts(tuple, context, counters);
      for (const decision of facts.viableDecisions) {
        const plan = materializeCompositionPlan(tuple, decision, context);
        if (planIds.has(plan.planId)) throw new Error(`plan identity collision ${plan.planId}`);
        planIds.add(plan.planId);
        if (reserved.has(plan.planId)) continue;
        counters.rankedPlans += 1;
        if (counters.rankedPlans > MAX_RANKED_PLANS_PER_RECIPE) {
          throw new Error(`planning-complexity:${recipeId}:rankedPlans`);
        }
        records.push(deepFreeze({
          planId: plan.planId,
          recipeId,
          tupleFingerprint: facts.tupleFingerprint,
          rankKey: decision.rankFacts.rankKey,
          plan
        }));
      }
    }
    assertPlanningCounters(recipeId, counters, context);
    diagnosticsByRecipeId[recipeId] = Object.freeze({ ...counters });
    if (records.length > 0) {
      selectedRecipeId = recipeId;
      rankedPlans = records.sort((left, right) =>
        compareRankKeysDescending(left.rankKey, right.rankKey)
        || compareStrings(left.planId, right.planId)
      );
      break;
    }
  }

  const rankedRecordIdentities = rankedPlans.map(record => ({
    planId: record.planId,
    tupleFingerprint: record.tupleFingerprint,
    rankKey: record.rankKey
  }));
  const universeFingerprint = hashCanonical({
    generationInputHash: context.generationInputHash,
    recipeOrder,
    recipeStartIndex,
    examinedRecipeIds,
    selectedRecipeId,
    reservedPlanIds,
    rankedRecordIdentities
  });
  const universe = deepFreeze({
    generationInputHash: context.generationInputHash,
    recipeOrder,
    recipeStartIndex,
    examinedRecipeIds,
    selectedRecipeId,
    reservedPlanIds,
    rankedPlans,
    universeFingerprint
  });
  universeDiagnostics.set(universe, Object.freeze(diagnosticsByRecipeId));
  return universe;
}

export function planningCountersForUniverse(universe) {
  return universeDiagnostics.get(universe) || null;
}

function alternatePriority(candidatePlan, initialPlan, context) {
  if (
    candidatePlan.recipeId !== initialPlan.recipeId
    || candidatePlan.slots.length !== initialPlan.slots.length
  ) return null;
  const initialById = new Map(initialPlan.slots.map(slot => [slot.id, slot]));
  const candidateIds = candidatePlan.slots.map(slot => slot.id).sort(compareStrings);
  const initialIds = initialPlan.slots.map(slot => slot.id).sort(compareStrings);
  if (canonicalJson(candidateIds) !== canonicalJson(initialIds)) return null;
  const changed = [];
  let lexicalChangeCount = 0;
  for (const slot of candidatePlan.slots) {
    const initial = initialById.get(slot.id);
    if (
      !initial
      || initial.slotDefinitionId !== slot.slotDefinitionId
      || initial.sourceKind !== slot.sourceKind
    ) return null;
    if (slot.sourceKind === "motif") {
      if (slot.motifId !== initial.motifId || slot.candidateId !== initial.candidateId) return null;
      continue;
    }
    if (slot.lexicalUseId === initial.lexicalUseId) continue;
    lexicalChangeCount += 1;
    const edges = context.relationEdges.filter(edge =>
      edge.relation === "alternateOf"
      && edge.from.lexicalUseId === slot.lexicalUseId
      && edge.to.lexicalUseId === initial.lexicalUseId
    );
    if (edges.length !== 1) return null;
    changed.push([slot.id, edges[0].priority, slot.lexicalUseId]);
  }
  if (lexicalChangeCount === 0) return null;
  changed.sort((left, right) => compareStrings(left[0], right[0]));
  return changed;
}

export function deriveCanonicalSearchQueue(universe, selectedPlanId, context) {
  if (!universe.selectedRecipeId) {
    if (selectedPlanId !== null) throw new Error("no-candidate universe cannot select a plan");
    return Object.freeze([]);
  }
  const selected = universe.rankedPlans.find(record => record.planId === selectedPlanId);
  if (!selected) throw new Error("selected plan is outside ranked universe");
  const remaining = universe.rankedPlans.filter(record => record.planId !== selectedPlanId);
  const sameTuple = remaining.filter(record => record.tupleFingerprint === selected.tupleFingerprint);
  const alternates = [];
  const other = [];
  for (const record of remaining.filter(item => item.tupleFingerprint !== selected.tupleFingerprint)) {
    const priority = alternatePriority(record.plan, selected.plan, context);
    if (priority) alternates.push({ record, priority });
    else other.push(record);
  }
  alternates.sort((left, right) =>
    compareStrings(canonicalJson(left.priority), canonicalJson(right.priority))
    || compareRankKeysDescending(left.record.rankKey, right.record.rankKey)
    || compareStrings(left.record.planId, right.record.planId)
  );
  const tiered = [
    { record: selected, tier: "same-tuple-layout" },
    ...sameTuple.map(record => ({ record, tier: "same-tuple-layout" })),
    ...alternates.map(({ record }) => ({ record, tier: "approved-alternate" })),
    ...other.map(record => ({ record, tier: "other-replan" }))
  ];
  return Object.freeze(tiered.map(({ record, tier }, candidateCursor) => deepFreeze({
    candidateCursor,
    candidateSource: "ranked",
    searchTier: tier,
    tupleFingerprint: record.tupleFingerprint,
    planId: record.planId,
    plan: record.plan
  })));
}

export function validatePlannerResult(result, context, knownGoodPlanByRecipeId = new Map()) {
  validatePlannerResultShape(result);
  if (result.generationInputHash !== context.generationInputHash) {
    throw new Error("planner result base identity mismatch");
  }
  const universe = deriveRankedPlanUniverse(context, knownGoodPlanByRecipeId);
  if (result.rankedPlanUniverseFingerprint !== universe.universeFingerprint) {
    throw new Error("planner result universe fingerprint mismatch");
  }
  if (universe.selectedRecipeId === null) {
    const expected = {
      schemaVersion: 1,
      generationInputHash: context.generationInputHash,
      rankedPlanUniverseFingerprint: universe.universeFingerprint,
      initialSelection: {
        status: "no-candidate",
        generationInputHash: context.generationInputHash,
        recipeOrder: universe.recipeOrder,
        recipeStartIndex: universe.recipeStartIndex,
        selectedRecipeId: null,
        topRankKey: null,
        topTiePlanIds: [],
        selectedPlanId: null,
        selectedTieIndex: null,
        selectionDrawCount: 0
      },
      searchQueue: []
    };
    if (canonicalJson(result) !== canonicalJson(expected)) throw new Error("false no-candidate planner result");
    return result;
  }
  const selection = result.initialSelection;
  if (
    selection?.status !== "selected"
    || selection.selectedRecipeId !== universe.selectedRecipeId
    || selection.selectionDrawCount !== 1
  ) {
    throw new Error("planner initial selection mismatch");
  }
  const topRankKey = universe.rankedPlans[0].rankKey;
  const topTiePlanIds = universe.rankedPlans
    .filter(record => compareNumericArrays(record.rankKey, topRankKey) === 0)
    .map(record => record.planId)
    .sort(compareStrings);
  const expectedSelection = {
    status: "selected",
    generationInputHash: context.generationInputHash,
    recipeOrder: universe.recipeOrder,
    recipeStartIndex: universe.recipeStartIndex,
    selectedRecipeId: universe.selectedRecipeId,
    topRankKey,
    topTiePlanIds,
    selectedPlanId: topTiePlanIds[selection.selectedTieIndex],
    selectedTieIndex: selection.selectedTieIndex,
    selectionDrawCount: 1
  };
  if (canonicalJson(selection) !== canonicalJson(expectedSelection)) {
    throw new Error("planner selected tie identity mismatch");
  }
  const expectedQueue = deriveCanonicalSearchQueue(universe, selection.selectedPlanId, context);
  if (canonicalJson(result.searchQueue) !== canonicalJson(expectedQueue)) {
    throw new Error("planner search queue mismatch");
  }
  return result;
}

export { compareRankKeysDescending };
