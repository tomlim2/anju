import { hashCanonical } from "./canonical-hash.js";
import { deepFreeze } from "./composition-model.js";
import {
  compareRankKeysDescending,
  deriveCanonicalSearchQueue,
  deriveRankedPlanUniverse,
  validatePlannerResult
} from "./composition-plan-validator.js";

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function selectionDraw(selectionRandomSource) {
  const value = typeof selectionRandomSource === "function"
    ? selectionRandomSource()
    : selectionRandomSource?.random?.();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error("selection random source must return a value in [0, 1)");
  }
  return value;
}

export function planComposition({
  generationInput,
  validationContext,
  knownGoodPlanByRecipeId = new Map(),
  selectionRandomSource
}) {
  if (validationContext.generationInput !== generationInput) {
    throw new Error("planner requires the context GenerationInput object");
  }
  const universe = deriveRankedPlanUniverse(validationContext, knownGoodPlanByRecipeId);
  if (universe.selectedRecipeId === null) {
    const result = deepFreeze({
      schemaVersion: 1,
      generationInputHash: validationContext.generationInputHash,
      rankedPlanUniverseFingerprint: universe.universeFingerprint,
      initialSelection: {
        status: "no-candidate",
        generationInputHash: validationContext.generationInputHash,
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
    });
    validatePlannerResult(result, validationContext, knownGoodPlanByRecipeId);
    return result;
  }

  const topRankKey = universe.rankedPlans[0].rankKey;
  const topTiePlanIds = universe.rankedPlans
    .filter(record => compareRankKeysDescending(record.rankKey, topRankKey) === 0)
    .map(record => record.planId)
    .sort(compareStrings);
  const draw = selectionDraw(selectionRandomSource);
  const selectedTieIndex = Math.min(topTiePlanIds.length - 1, Math.floor(draw * topTiePlanIds.length));
  const selectedPlanId = topTiePlanIds[selectedTieIndex];
  const searchQueue = deriveCanonicalSearchQueue(
    universe,
    selectedPlanId,
    validationContext
  );
  const result = deepFreeze({
    schemaVersion: 1,
    generationInputHash: validationContext.generationInputHash,
    rankedPlanUniverseFingerprint: universe.universeFingerprint,
    initialSelection: {
      status: "selected",
      generationInputHash: validationContext.generationInputHash,
      recipeOrder: universe.recipeOrder,
      recipeStartIndex: universe.recipeStartIndex,
      selectedRecipeId: universe.selectedRecipeId,
      topRankKey,
      topTiePlanIds,
      selectedPlanId,
      selectedTieIndex,
      selectionDrawCount: 1
    },
    searchQueue
  });
  validatePlannerResult(result, validationContext, knownGoodPlanByRecipeId);
  return result;
}

export function plannerResultFingerprint(result) {
  return hashCanonical({
    generationInputHash: result.generationInputHash,
    rankedPlanUniverseFingerprint: result.rankedPlanUniverseFingerprint,
    initialSelection: result.initialSelection,
    queue: result.searchQueue.map(entry => ({
      candidateCursor: entry.candidateCursor,
      searchTier: entry.searchTier,
      tupleFingerprint: entry.tupleFingerprint,
      planId: entry.planId
    }))
  });
}
