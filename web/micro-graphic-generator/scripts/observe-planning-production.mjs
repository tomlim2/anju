import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, hashCanonical } from "../src/canonical-hash.js";
import {
  deriveTupleLayoutFacts,
  enumerateCanonicalSemanticTuples,
  validateTupleCompatibility
} from "../src/composition-plan-validator.js";
import { enumerateCanonicalLayouts } from "../src/grid-layout.js";
import {
  buildActivePlanningRelease,
  extractPlanningOwnerRecords
} from "./planning-release-snapshot-lib.mjs";

function valueAfter(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : null;
}

function snapshotInput(activeSnapshot) {
  if (activeSnapshot?.schemaVersion !== 2 || !Array.isArray(activeSnapshot.expectedCertificates)) {
    throw new Error("production planning observer requires active snapshot schema 2");
  }
  const { expectedCertificates: _expectedCertificates, ...input } = activeSnapshot;
  return input;
}

export function observeProductionPlanningSnapshot(activeSnapshot, { ownerRecords } = {}) {
  const release = buildActivePlanningRelease(ownerRecords);
  const committedInput = snapshotInput(activeSnapshot);
  if (canonicalJson(committedInput) !== canonicalJson(release.snapshotInput)) {
    throw new Error("committed planning snapshot differs from active owner records");
  }
  const context = release.context;
  const layoutKeysByBlockCount = Object.fromEntries([2, 3, 4, 5].map(blockCount => {
    const slotIds = Array.from({ length: blockCount }, (_, index) => `slot-${index + 1}`);
    return [blockCount, enumerateCanonicalLayouts(slotIds).map(layout => layout.layoutKey)];
  }));
  const recipes = context.activeRecipeIds.map(recipeId => {
    const counters = {
      canonicalPrefixVisits: 0,
      layoutDecisionExpansions: 0,
      retainedViableDecisions: 0,
      rankedPlans: 0
    };
    const tupleFingerprints = [];
    for (const tuple of enumerateCanonicalSemanticTuples(recipeId, context, counters)) {
      const compatibility = validateTupleCompatibility(tuple, context);
      if (!compatibility.valid) throw new Error(`production observer yielded invalid tuple ${recipeId}`);
      tupleFingerprints.push(compatibility.tupleFingerprint);
      const facts = deriveTupleLayoutFacts(tuple, context, counters);
      counters.rankedPlans += facts.viableDecisions.length;
    }
    return Object.freeze({
      recipeId,
      tupleFingerprints: Object.freeze(tupleFingerprints),
      ...counters
    });
  });
  return Object.freeze({
    schemaVersion: 2,
    snapshotInputRevision: hashCanonical(committedInput),
    allFitPolicy: activeSnapshot.allFitPolicy,
    layoutKeysByBlockCount: Object.freeze(layoutKeysByBlockCount),
    recipes: Object.freeze(recipes)
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const fixturePath = valueAfter(process.argv, "--fixture");
  if (!fixturePath) throw new Error("--fixture is required");
  const ownerRoot = valueAfter(process.argv, "--owner-root");
  const fixture = JSON.parse(readFileSync(resolve(fixturePath), "utf8"));
  const ownerRecords = ownerRoot ? extractPlanningOwnerRecords(ownerRoot) : undefined;
  process.stdout.write(`${JSON.stringify(observeProductionPlanningSnapshot(
    fixture.activeSnapshot,
    { ownerRecords }
  ))}\n`);
}
