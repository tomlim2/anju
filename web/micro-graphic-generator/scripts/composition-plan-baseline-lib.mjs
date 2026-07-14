import { planComposition, plannerResultFingerprint } from "../src/composition-planner.js";
import { deriveSeed, keyedValue } from "../src/random.js";
import { createCompositionTestContext } from "../tests/composition-test-context.mjs";

function representativePlans(result) {
  const plans = [];
  for (const blockCount of [2, 3, 4, 5]) {
    const entry = result.searchQueue.find(candidate => candidate.plan.blocks.length === blockCount);
    if (!entry) throw new Error(`planner queue has no ${blockCount}-block plan`);
    plans.push({ blockCount, plan: entry.plan });
  }
  return plans;
}

function coversPilotBlockCounts(result) {
  const counts = new Set(result.searchQueue.map(entry => entry.plan.blocks.length));
  return [2, 3, 4, 5].every(blockCount => counts.has(blockCount));
}

function baselineCase(seed, recipeId, testContext, result) {
  if (result.initialSelection.selectedRecipeId !== recipeId) {
    throw new Error(`seed ${seed} selected ${result.initialSelection.selectedRecipeId}, expected ${recipeId}`);
  }
  return {
    id: `${recipeId}-pilot`,
    generationInput: testContext.generationInput,
    plannerResultFingerprint: plannerResultFingerprint(result),
    rankedPlanUniverseFingerprint: result.rankedPlanUniverseFingerprint,
    initialSelection: result.initialSelection,
    queue: result.searchQueue.map(entry => ({
      candidateCursor: entry.candidateCursor,
      searchTier: entry.searchTier,
      tupleFingerprint: entry.tupleFingerprint,
      planId: entry.planId
    })),
    representativePlans: representativePlans(result)
  };
}

export function buildCompositionPlanBaseline() {
  const cases = new Map();
  for (let seed = 0; seed < 100 && cases.size < 2; seed += 1) {
    const testContext = createCompositionTestContext({ seed });
    const selectionSeed = deriveSeed(testContext.generationInput, "selection");
    const result = planComposition({
      generationInput: testContext.generationInput,
      validationContext: testContext.context,
      selectionRandomSource: () => keyedValue(selectionSeed, "initial-top-tie")
    });
    const recipeId = result.initialSelection.selectedRecipeId;
    if (recipeId && !cases.has(recipeId) && coversPilotBlockCounts(result)) {
      cases.set(recipeId, baselineCase(seed, recipeId, testContext, result));
    }
  }
  for (const recipeId of ["command", "status"]) {
    if (!cases.has(recipeId)) throw new Error(`could not find ${recipeId} baseline case`);
  }
  const orderedCases = ["command", "status"].map(recipeId => cases.get(recipeId));
  return {
    schemaVersion: 1,
    ownerSnapshotRevision: orderedCases[0].generationInput.ownerSnapshotRevision,
    cases: orderedCases
  };
}
