import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalJson,
  hashCanonical,
  sha256Hex
} from "../src/canonical-hash.js";

const PRODUCTION_OBSERVER_PATH = fileURLToPath(
  new URL("./observe-planning-production.mjs", import.meta.url)
);
const ORACLE_SOURCE_PATH = fileURLToPath(import.meta.url);
const ORACLE_REPOSITORY_PATH = "web/micro-graphic-generator/scripts/verify-planning-complexity.mjs";

const ORACLE_CONTRACT = Object.freeze({
  schemaVersion: 3,
  predicates: Object.freeze([
    "total-first-cardinality",
    "source-and-tag-domain",
    "strict-repeated-order",
    "duplicate-text-translation-and-phrase-pack",
    "duplicate-motif-family",
    "selector-based-avoid",
    "selector-based-required-relation",
    "all-fit-layout-upper-bound",
    "rectangular-partition-reference-v1",
    "block-requested-size-cartesian-reference-v1",
    "synthetic-fault-injection-v1",
    "active-owner-domain-coverage-v2",
    "production-active-owner-parity-v3"
  ]),
  allFitPolicy: Object.freeze({
    schemaVersion: 1,
    policyId: "production-all-predicted-fit-v2",
    typographyBounds: Object.freeze({ width: 100, height: 100 }),
    motifBounds: "active-intrinsic",
    knownGoodReservation: "absent",
    rawDecisionCounting: "before-fit-outcome",
    retainedAndRankedAssertion: "oracle-upper-bound"
  })
});

const SYNTHETIC_FAULT_MODES = Object.freeze([
  "skip-prefix-increment",
  "omit-candidate-branch",
  "omit-layout-alternative",
  "omit-retained-peak"
]);

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertSyntheticInput(domainSizes, layoutAlternativesPerTuple) {
  if (
    !Array.isArray(domainSizes)
    || domainSizes.some(size => !Number.isInteger(size) || size < 0)
    || !Number.isInteger(layoutAlternativesPerTuple)
    || layoutAlternativesPerTuple < 0
  ) {
    throw new TypeError("planning oracle expects non-negative integer sizes");
  }
}

export function closedFormCartesianCounters(domainSizes, layoutAlternativesPerTuple) {
  assertSyntheticInput(domainSizes, layoutAlternativesPerTuple);
  let canonicalPrefixVisits = 1;
  let product = 1;
  for (const size of domainSizes) {
    product *= size;
    canonicalPrefixVisits += product;
  }
  return Object.freeze({
    canonicalPrefixVisits,
    completeTuples: product,
    layoutDecisionExpansions: product * layoutAlternativesPerTuple,
    retainedViableDecisions: product > 0 ? layoutAlternativesPerTuple : 0,
    rankedPlans: product * layoutAlternativesPerTuple
  });
}

export function walkSyntheticCartesianCounters(
  domainSizes,
  layoutAlternativesPerTuple,
  { faultMode = null } = {}
) {
  assertSyntheticInput(domainSizes, layoutAlternativesPerTuple);
  if (faultMode !== null && !SYNTHETIC_FAULT_MODES.includes(faultMode)) {
    throw new Error(`unknown synthetic planning fault ${faultMode}`);
  }
  let canonicalPrefixVisits = 0;
  let completeTuples = 0;
  let layoutDecisionExpansions = 0;
  let retainedViableDecisions = 0;
  let rankedPlans = 0;

  function walk(depth) {
    if (!(faultMode === "skip-prefix-increment" && depth === 1)) canonicalPrefixVisits += 1;
    if (depth === domainSizes.length) {
      completeTuples += 1;
      const alternatives = faultMode === "omit-layout-alternative"
        ? Math.max(0, layoutAlternativesPerTuple - 1)
        : layoutAlternativesPerTuple;
      let retainedForTuple = 0;
      for (let index = 0; index < alternatives; index += 1) {
        layoutDecisionExpansions += 1;
        rankedPlans += 1;
        retainedForTuple += 1;
      }
      if (faultMode !== "omit-retained-peak") {
        retainedViableDecisions = Math.max(retainedViableDecisions, retainedForTuple);
      }
      return;
    }
    const branchCount = faultMode === "omit-candidate-branch" && depth === 0
      ? Math.max(0, domainSizes[depth] - 1)
      : domainSizes[depth];
    for (let index = 0; index < branchCount; index += 1) walk(depth + 1);
  }

  walk(0);
  return Object.freeze({
    canonicalPrefixVisits,
    completeTuples,
    layoutDecisionExpansions,
    retainedViableDecisions,
    rankedPlans
  });
}

function assertSyntheticExpected(canary, actual, label = canary.id) {
  for (const [key, expected] of Object.entries(canary.expected)) {
    if (actual[key] !== expected) throw new Error(`${label} mismatch for ${key}`);
  }
}

export function verifyPlanningComplexityCertificate(certificate, limits) {
  const fields = [
    ["maxCanonicalPrefixVisits", limits.maxCanonicalPrefixVisits],
    ["maxLayoutDecisionExpansions", limits.maxLayoutDecisionExpansions],
    ["maxRetainedViableDecisionsPerTuple", limits.maxRetainedViableDecisions],
    ["maxRankedPlans", limits.maxRankedPlans]
  ];
  for (const [certificateField, limit] of fields) {
    const value = certificate[certificateField];
    if (!Number.isInteger(value) || value < 0 || value > limit) {
      throw new Error(`planning certificate exceeds ${certificateField} limit`);
    }
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(certificate.oracleRevision)) {
    throw new Error("invalid planning oracle revision");
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(certificate.fixtureRevision)) {
    throw new Error("invalid planning fixture revision");
  }
  return true;
}

function numericArrayCompare(left, right) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function cardinalityShapes(recipe) {
  const counts = Array(recipe.slots.length).fill(0);
  const shapes = [];
  function visit(index) {
    if (index === recipe.slots.length) {
      const total = counts.reduce((sum, count) => sum + count, 0);
      if (total >= recipe.blockCount.min && total <= recipe.blockCount.max) {
        shapes.push({ counts: [...counts], total, shapeKey: [total, ...counts] });
      }
      return;
    }
    const slot = recipe.slots[index];
    for (let count = slot.cardinality.min; count <= slot.cardinality.max; count += 1) {
      counts[index] = count;
      visit(index + 1);
    }
  }
  visit(0);
  return shapes.sort((left, right) => numericArrayCompare(left.shapeKey, right.shapeKey));
}

function sourceKindForSlot(slot) {
  return slot.source === "graphic" ? "motif" : "lexical";
}

function candidateDomains(snapshot, recipe, shape) {
  const instances = [];
  recipe.slots.forEach((slot, slotIndex) => {
    for (let ordinal = 1; ordinal <= shape.counts[slotIndex]; ordinal += 1) {
      const sourceKind = sourceKindForSlot(slot);
      const candidateIds = snapshot.candidates
        .filter(candidate => candidate.sourceKind === sourceKind && (
          sourceKind === "motif"
          || slot.acceptsAnyTag.some(tag => candidate.tags.includes(tag))
        ))
        .map(candidate => candidate.candidateId)
        .sort(compareStrings);
      instances.push({
        id: `${slot.id}-${ordinal}`,
        slotDefinitionId: slot.id,
        sourceKind,
        candidateIds
      });
    }
  });
  return instances;
}

function transformReferenceCell(cell, transformIndex) {
  const row = Math.floor((cell - 1) / 3);
  const column = (cell - 1) % 3;
  const transforms = [
    [row, column],
    [column, 2 - row],
    [2 - row, 2 - column],
    [2 - column, row]
  ];
  const [nextRow, nextColumn] = transforms[transformIndex];
  return nextRow * 3 + nextColumn + 1;
}

function assertReferencePartition(partition, blockCount) {
  if (!Array.isArray(partition) || partition.length !== blockCount) {
    throw new Error(`planning fixture base partition ${blockCount} has wrong block count`);
  }
  const cells = partition.flat();
  if (
    cells.length !== 9
    || new Set(cells).size !== 9
    || [...cells].sort((left, right) => left - right).some((cell, index) => cell !== index + 1)
  ) {
    throw new Error(`planning fixture base partition ${blockCount} must cover cells 1-9 exactly`);
  }
  for (const block of partition) {
    const rows = block.map(cell => Math.floor((cell - 1) / 3));
    const columns = block.map(cell => (cell - 1) % 3);
    const area = (Math.max(...rows) - Math.min(...rows) + 1)
      * (Math.max(...columns) - Math.min(...columns) + 1);
    if (area !== block.length) throw new Error(`planning fixture base partition ${blockCount} is not rectangular`);
  }
}

function referenceFootprint(cells) {
  const rows = cells.map(cell => Math.floor((cell - 1) / 3));
  const columns = cells.map(cell => (cell - 1) % 3);
  return `${Math.max(...columns) - Math.min(...columns) + 1}x${Math.max(...rows) - Math.min(...rows) + 1}`;
}

function referenceLayouts(snapshot) {
  const result = {};
  for (const blockCount of [2, 3, 4, 5]) {
    const base = snapshot.basePartitionsByBlockCount?.[blockCount];
    assertReferencePartition(base, blockCount);
    const partitions = new Map();
    for (let transformIndex = 0; transformIndex < 4; transformIndex += 1) {
      const transformed = base
        .map(cells => cells.map(cell => transformReferenceCell(cell, transformIndex)).sort((left, right) => left - right))
        .sort((left, right) => left[0] - right[0] || left.length - right.length);
      const partitionKey = transformed.map(cells => cells.join(".")).join("|");
      partitions.set(partitionKey, transformed);
    }
    const slotIds = Array.from({ length: blockCount }, (_, index) => `slot-${index + 1}`);
    const layouts = [];
    for (const [partitionKey, partition] of [...partitions.entries()].sort(([left], [right]) => compareStrings(left, right))) {
      for (let offset = 0; offset < slotIds.length; offset += 1) {
        layouts.push(Object.freeze({
          layoutKey: `layout:${blockCount}:${partitionKey}:${offset}`,
          blocks: Object.freeze(partition.map((cells, blockIndex) => Object.freeze({
            slotIndex: (blockIndex + offset) % blockCount,
            footprint: referenceFootprint(cells)
          })))
        }));
      }
    }
    if (layouts.length !== snapshot.layoutAlternativesByBlockCount[blockCount]) {
      throw new Error(`planning fixture layout alternative count mismatch ${blockCount}`);
    }
    result[blockCount] = Object.freeze(layouts);
  }
  return Object.freeze(result);
}

function selectorMatch(candidate, selector) {
  if (!candidate || candidate.sourceKind !== "lexical" || !selector || typeof selector !== "object") return false;
  const keys = ["lexicalUseId", "translationSetId", "tag"].filter(key => Object.hasOwn(selector, key));
  if (keys.length !== 1 || Object.keys(selector).length !== 1) {
    throw new Error("planning snapshot selector must have one discriminator");
  }
  const [kind] = keys;
  return kind === "tag" ? candidate.tags.includes(selector.tag) : candidate[kind] === selector[kind];
}

function edgeMatches(snapshot, from, relation, to) {
  return snapshot.relationEdges.some(edge =>
    edge.reviewStatus === "approved"
    && edge.relation === relation
    && selectorMatch(from, edge.from)
    && selectorMatch(to, edge.to)
  );
}

function referencePrefixValid(snapshot, recipe, shape, assignments) {
  const candidateById = new Map(snapshot.candidates.map(candidate => [candidate.candidateId, candidate]));
  const byDefinition = new Map();
  for (const assignment of assignments) {
    const values = byDefinition.get(assignment.slotDefinitionId) || [];
    values.push(assignment);
    byDefinition.set(assignment.slotDefinitionId, values);
  }
  for (const values of byDefinition.values()) {
    for (let index = 1; index < values.length; index += 1) {
      if (values[index - 1].candidateId >= values[index].candidateId) return false;
    }
  }

  const lexicalAssignments = assignments.filter(assignment =>
    candidateById.get(assignment.candidateId)?.sourceKind === "lexical"
  );
  for (const fromAssignment of lexicalAssignments) {
    for (const toAssignment of lexicalAssignments) {
      if (fromAssignment.id === toAssignment.id) continue;
      const from = candidateById.get(fromAssignment.candidateId);
      const to = candidateById.get(toAssignment.candidateId);
      if ((recipe.pairRules?.avoid || []).some(rule =>
        selectorMatch(from, rule.from) && selectorMatch(to, rule.to)
      )) return false;
    }
  }
  for (let leftIndex = 0; leftIndex < lexicalAssignments.length; leftIndex += 1) {
    const left = candidateById.get(lexicalAssignments[leftIndex].candidateId);
    for (let rightIndex = leftIndex + 1; rightIndex < lexicalAssignments.length; rightIndex += 1) {
      const right = candidateById.get(lexicalAssignments[rightIndex].candidateId);
      if (left.normalizedVisibleText === right.normalizedVisibleText) return false;
      if (left.translationSetId && left.translationSetId === right.translationSetId) return false;
      if (left.phrasePackId && left.phrasePackId === right.phrasePackId) return false;
    }
  }

  const motifAssignments = assignments.filter(assignment =>
    candidateById.get(assignment.candidateId)?.sourceKind === "motif"
  );
  const motifIds = motifAssignments.map(assignment => candidateById.get(assignment.candidateId).motifId);
  if (new Set(motifIds).size !== motifIds.length) return false;

  for (const clause of recipe.requiredRelations) {
    const conditionalSlotIndex = clause.whenSlotPresent
      ? recipe.slots.findIndex(slot => slot.id === clause.whenSlotPresent)
      : -1;
    if (conditionalSlotIndex >= 0 && shape.counts[conditionalSlotIndex] === 0) continue;
    const from = byDefinition.get(clause.fromSlot) || [];
    const to = byDefinition.get(clause.toSlot) || [];
    if (from.length === 0 || to.length === 0) continue;
    const fromCandidate = candidateById.get(from[0].candidateId);
    const toCandidate = candidateById.get(to[0].candidateId);
    if (!clause.relations.some(relation => edgeMatches(
      snapshot,
      fromCandidate,
      relation,
      toCandidate
    ))) return false;
  }
  return true;
}

function referenceTupleFingerprint(snapshot, recipe, assignments) {
  const candidateById = new Map(snapshot.candidates.map(candidate => [candidate.candidateId, candidate]));
  return hashCanonical({
    recipeId: recipe.id,
    slots: assignments.map(assignment => {
      const candidate = candidateById.get(assignment.candidateId);
      const shared = {
        id: assignment.id,
        slotDefinitionId: assignment.slotDefinitionId,
        sourceKind: candidate.sourceKind,
        candidateId: candidate.candidateId
      };
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
    })
  });
}

function requestedSizeAlternativesForTuple(snapshot, tuple, layouts) {
  const candidateById = new Map(snapshot.candidates.map(candidate => [candidate.candidateId, candidate]));
  let total = 0;
  for (const layout of layouts) {
    let alternatives = 1;
    for (const block of layout.blocks) {
      const assignment = tuple.assignments[block.slotIndex];
      const candidate = candidateById.get(assignment.candidateId);
      if (candidate.sourceKind !== "lexical") continue;
      const count = snapshot.requestedSizeAlternativeCountsByFootprint?.[block.footprint];
      if (!Number.isInteger(count) || count < 1) {
        throw new Error(`planning fixture requested-size alternative count is invalid ${block.footprint}`);
      }
      alternatives *= count;
    }
    total += alternatives;
  }
  return total;
}

function evaluateActiveRecipe(snapshot, recipe, layoutsByBlockCount) {
  let canonicalPrefixVisits = 0;
  const validTuples = [];
  const tupleFingerprints = [];
  for (const shape of cardinalityShapes(recipe)) {
    const domains = candidateDomains(snapshot, recipe, shape);
    function walk(index, assignments) {
      canonicalPrefixVisits += 1;
      if (!referencePrefixValid(snapshot, recipe, shape, assignments)) return;
      if (index === domains.length) {
        const tupleFingerprint = referenceTupleFingerprint(snapshot, recipe, assignments);
        validTuples.push(Object.freeze({
          blockCount: shape.total,
          assignments: Object.freeze(assignments.map(assignment => Object.freeze({ ...assignment }))),
          tupleFingerprint
        }));
        tupleFingerprints.push(tupleFingerprint);
        return;
      }
      const domain = domains[index];
      for (const candidateId of domain.candidateIds) {
        walk(index + 1, [
          ...assignments,
          {
            id: domain.id,
            slotDefinitionId: domain.slotDefinitionId,
            sourceKind: domain.sourceKind,
            candidateId
          }
        ]);
      }
    }
    walk(0, []);
  }
  let layoutDecisionExpansions = 0;
  let retainedViableDecisions = 0;
  for (const tuple of validTuples) {
    const alternatives = requestedSizeAlternativesForTuple(
      snapshot,
      tuple,
      layoutsByBlockCount[tuple.blockCount]
    );
    layoutDecisionExpansions += alternatives;
    retainedViableDecisions = Math.max(retainedViableDecisions, alternatives);
  }
  return Object.freeze({
    certificate: Object.freeze({
      recipeId: recipe.id,
      maxCanonicalPrefixVisits: canonicalPrefixVisits,
      maxLayoutDecisionExpansions: layoutDecisionExpansions,
      maxRetainedViableDecisionsPerTuple: retainedViableDecisions,
      maxRankedPlans: layoutDecisionExpansions
    }),
    observation: Object.freeze({
      recipeId: recipe.id,
      tupleFingerprints: Object.freeze(tupleFingerprints),
      canonicalPrefixVisits,
      layoutDecisionExpansions
    })
  });
}

function snapshotInput(snapshot) {
  const { expectedCertificates: _expectedCertificates, ...input } = snapshot;
  return input;
}

function assertActiveSnapshot(snapshot) {
  if (
    snapshot?.schemaVersion !== 2
    || !Array.isArray(snapshot.recipes)
    || !Array.isArray(snapshot.activeRecipeIds)
    || !Array.isArray(snapshot.candidates)
    || !Array.isArray(snapshot.relationEdges)
    || !snapshot.requestedSizeAlternativeCountsByFootprint
    || typeof snapshot.requestedSizeAlternativeCountsByFootprint !== "object"
  ) throw new Error("active planning snapshot must use schema 2");
  if (canonicalJson(snapshot.allFitPolicy) !== canonicalJson(ORACLE_CONTRACT.allFitPolicy)) {
    throw new Error("active planning snapshot all-fit policy mismatch");
  }
  const candidateIds = snapshot.candidates.map(candidate => candidate.candidateId);
  if (
    new Set(candidateIds).size !== candidateIds.length
    || candidateIds.some((id, index) => index > 0 && candidateIds[index - 1] >= id)
  ) throw new Error("active planning candidate IDs must be unique and ascending");
  const recipeIds = snapshot.recipes.map(recipe => recipe.id);
  if (
    canonicalJson(recipeIds) !== canonicalJson(snapshot.activeRecipeIds)
    || new Set(recipeIds).size !== recipeIds.length
    || recipeIds.some((id, index) => index > 0 && recipeIds[index - 1] >= id)
  ) throw new Error("active planning recipe IDs must be exact and ascending");
  if (snapshot.coverageProof?.policyId !== "active-owner-max-domain-v2") {
    throw new Error("active planning snapshot lacks owner-domain coverage proof");
  }
}

function planningOracleRevision() {
  const sourceByteHashes = [{
    path: ORACLE_REPOSITORY_PATH,
    sha256Hex: sha256Hex(readFileSync(ORACLE_SOURCE_PATH))
  }];
  return hashCanonical({
    oracleContract: ORACLE_CONTRACT,
    sourceByteHashes
  });
}

function deriveActiveEvaluation(snapshot) {
  assertActiveSnapshot(snapshot);
  const layoutsByBlockCount = referenceLayouts(snapshot);
  const layoutKeysByBlockCount = Object.freeze(Object.fromEntries(
    Object.entries(layoutsByBlockCount).map(([blockCount, layouts]) => [
      blockCount,
      Object.freeze(layouts.map(layout => layout.layoutKey))
    ])
  ));
  const evaluations = snapshot.recipes
    .map(recipe => evaluateActiveRecipe(snapshot, recipe, layoutsByBlockCount))
    .sort((left, right) => compareStrings(left.certificate.recipeId, right.certificate.recipeId));
  return {
    layoutKeysByBlockCount,
    evaluations,
    certificates: evaluations.map(evaluation => evaluation.certificate)
  };
}

export function derivePlanningCertificatePayloads(snapshot) {
  return Object.freeze(deriveActiveEvaluation(snapshot).certificates);
}

export function evaluateActivePlanningSnapshot(snapshot) {
  if (!Array.isArray(snapshot.expectedCertificates)) {
    throw new Error("active planning snapshot expected certificates are required");
  }
  const derived = deriveActiveEvaluation(snapshot);
  const expected = [...snapshot.expectedCertificates]
    .sort((left, right) => compareStrings(left.recipeId, right.recipeId));
  if (hashCanonical(derived.certificates) !== hashCanonical(expected)) {
    throw new Error(`active planning certificate mismatch: ${canonicalJson({
      certificates: derived.certificates,
      expected
    })}`);
  }
  const oracleRevision = planningOracleRevision();
  const input = snapshotInput(snapshot);
  const snapshotInputRevision = hashCanonical(input);
  const expectedOracleOutput = { certificates: derived.certificates };
  const fixtureRevision = hashCanonical({
    schemaVersion: 2,
    inputSnapshot: input,
    allFitPolicy: snapshot.allFitPolicy,
    expectedOracleOutput
  });
  return Object.freeze({
    oracleRevision,
    fixtureRevision,
    snapshotInputRevision,
    layoutKeysByBlockCount: derived.layoutKeysByBlockCount,
    observations: Object.freeze(derived.evaluations.map(evaluation => evaluation.observation)),
    certificates: Object.freeze(derived.certificates.map(certificate => Object.freeze({
      ...certificate,
      oracleRevision,
      fixtureRevision
    })))
  });
}

export function runProductionPlanningObserver(fixturePath, { ownerRoot = null } = {}) {
  const args = [
    PRODUCTION_OBSERVER_PATH,
    "--fixture",
    resolve(fixturePath)
  ];
  if (ownerRoot) args.push("--owner-root", resolve(ownerRoot));
  const stdout = execFileSync(process.execPath, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  return JSON.parse(stdout);
}

export function assertProductionPlanningParity(independent, production) {
  if (production?.schemaVersion !== 2 || !Array.isArray(production.recipes)) {
    throw new Error("production planning observation must use schema 2");
  }
  if (production.snapshotInputRevision !== independent.snapshotInputRevision) {
    throw new Error("production active-owner snapshot revision mismatch");
  }
  if (canonicalJson(production.allFitPolicy) !== canonicalJson(ORACLE_CONTRACT.allFitPolicy)) {
    throw new Error("production planning all-fit policy mismatch");
  }
  const productionByRecipeId = new Map(production.recipes.map(record => [record.recipeId, record]));
  if (productionByRecipeId.size !== production.recipes.length) {
    throw new Error("production planning observation has duplicate recipe IDs");
  }
  if (hashCanonical(production.layoutKeysByBlockCount) !== hashCanonical(independent.layoutKeysByBlockCount)) {
    throw new Error("production canonical layout key order mismatch");
  }
  const summaries = independent.observations.map(observation => {
    const actual = productionByRecipeId.get(observation.recipeId);
    const certificate = independent.certificates.find(item => item.recipeId === observation.recipeId);
    if (!actual) throw new Error(`missing production planning observation ${observation.recipeId}`);
    if (hashCanonical(actual.tupleFingerprints) !== hashCanonical(observation.tupleFingerprints)) {
      throw new Error(`production tuple fingerprint order mismatch ${observation.recipeId}`);
    }
    if (actual.canonicalPrefixVisits !== observation.canonicalPrefixVisits) {
      throw new Error(`production prefix visits mismatch ${observation.recipeId}`);
    }
    if (actual.layoutDecisionExpansions !== observation.layoutDecisionExpansions) {
      throw new Error(`production layout expansion mismatch ${observation.recipeId}`);
    }
    if (
      !Number.isInteger(actual.retainedViableDecisions)
      || actual.retainedViableDecisions < 0
      || actual.retainedViableDecisions > certificate.maxRetainedViableDecisionsPerTuple
    ) throw new Error(`production retained decision bound mismatch ${observation.recipeId}`);
    if (
      !Number.isInteger(actual.rankedPlans)
      || actual.rankedPlans < 0
      || actual.rankedPlans > certificate.maxRankedPlans
    ) throw new Error(`production ranked plan bound mismatch ${observation.recipeId}`);
    productionByRecipeId.delete(observation.recipeId);
    return Object.freeze({
      recipeId: observation.recipeId,
      tupleCount: observation.tupleFingerprints.length,
      canonicalPrefixVisits: actual.canonicalPrefixVisits,
      layoutDecisionExpansions: actual.layoutDecisionExpansions,
      retainedViableDecisions: actual.retainedViableDecisions,
      rankedPlans: actual.rankedPlans
    });
  });
  if (productionByRecipeId.size > 0) throw new Error("production planning observation has extra recipe IDs");
  return Object.freeze(summaries);
}

export function verifyPlanningFixtureIndependent(fixture) {
  if (
    fixture?.schemaVersion !== 2
    || fixture.oracleContractVersion !== ORACLE_CONTRACT.schemaVersion
    || !Array.isArray(fixture.syntheticCanaries)
  ) throw new Error("planning fixture must use schema 2");
  const results = fixture.syntheticCanaries.map(canary => {
    const closedForm = closedFormCartesianCounters(
      canary.domainSizes,
      canary.layoutAlternativesPerTuple
    );
    const actual = walkSyntheticCartesianCounters(
      canary.domainSizes,
      canary.layoutAlternativesPerTuple
    );
    assertSyntheticExpected(canary, closedForm, `${canary.id}:closed-form`);
    assertSyntheticExpected(canary, actual, `${canary.id}:walker`);
    return Object.freeze({ id: canary.id, counters: actual });
  });
  const productiveCanary = fixture.syntheticCanaries.find(canary =>
    canary.expected.completeTuples > 0 && canary.layoutAlternativesPerTuple > 0
  );
  if (!productiveCanary) throw new Error("planning fixture needs a productive fault-injection canary");
  const faultRejections = SYNTHETIC_FAULT_MODES.map(faultMode => {
    const faulty = walkSyntheticCartesianCounters(
      productiveCanary.domainSizes,
      productiveCanary.layoutAlternativesPerTuple,
      { faultMode }
    );
    try {
      assertSyntheticExpected(productiveCanary, faulty, `${productiveCanary.id}:${faultMode}`);
    } catch {
      return Object.freeze({ faultMode, rejected: true });
    }
    throw new Error(`planning fault injection was not rejected: ${faultMode}`);
  });
  const active = evaluateActivePlanningSnapshot(fixture.activeSnapshot);
  return Object.freeze({
    fixtureRevision: hashCanonical(fixture),
    results: Object.freeze(results),
    faultRejections: Object.freeze(faultRejections),
    productionParity: null,
    active
  });
}

export function verifyPlanningFixture(fixture, { productionObservation = null } = {}) {
  if (!productionObservation) throw new Error("production planning observation is required");
  const independent = verifyPlanningFixtureIndependent(fixture);
  const productionParity = assertProductionPlanningParity(
    independent.active,
    productionObservation
  );
  return Object.freeze({
    ...independent,
    productionParity
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const fixtureArgIndex = process.argv.indexOf("--fixture");
  if (fixtureArgIndex < 0 || !process.argv[fixtureArgIndex + 1]) {
    throw new Error("--fixture is required");
  }
  const fixturePath = resolve(process.argv[fixtureArgIndex + 1]);
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  const productionObservation = runProductionPlanningObserver(fixturePath);
  const result = verifyPlanningFixture(fixture, { productionObservation });
  process.stdout.write(
    `planning complexity verified (${result.results.length} canaries, ${result.productionParity.length} production recipes)\n`
  );
}
