import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalJson, hashCanonical } from "../src/canonical-hash.js";
import {
  COMPOSITION_POLICY_VERSION,
  deriveTypographyTokenVariant,
  GRID_BLOCK_POLICY_BY_FOOTPRINT
} from "../src/config.js";
import {
  createGenerationInput,
  validateVocabularyRegistry
} from "../src/composition-model.js";
import {
  createPlanningObservationContext,
  PLANNING_ALL_FIT_POLICY
} from "../src/composition-plan-validator.js";
import {
  COMPOSITION_ENGINE_VERSION,
  FONT_ASSET_REVISION
} from "../src/composition-owner-snapshot.js";
import {
  activeRecipeIds,
  compositionRecipes,
  pilotCandidateTranslationSetGroups,
  pilotCandidateTranslationSetIds,
  pilotMetadataLexicalUseIds,
  RECIPE_REGISTRY_VERSION,
  relationEdges
} from "../src/composition-recipes.js";
import {
  COMPOSITION_BASE_PARTITIONS,
  compositionBlockGeometry,
  enumerateCanonicalLayouts
} from "../src/grid-layout.js";
import {
  createMotifCandidateValidator,
  materializeMotifCandidates,
  MOTIF_REGISTRY_VERSION,
  motifRegistry,
  validateMotifRenderParams
} from "../src/motifs.js";
import { createCompositionCandidateInventory } from "../src/token-library.js";
import { FONT_METRICS_VERSION } from "../src/typography-metrics.js";
import {
  lexicalUses,
  translationErrorLedger,
  translationSets,
  VOCABULARY_VERSION
} from "../src/vocabulary.js";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function cloneData(value) {
  if (Array.isArray(value)) return value.map(cloneData);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneData(item)]));
}

export const DEFAULT_PLANNING_OWNER_RECORDS = deepFreeze({
  vocabularyVersion: VOCABULARY_VERSION,
  lexicalUses,
  translationSets,
  translationErrorLedger,
  recipeVersion: RECIPE_REGISTRY_VERSION,
  compositionRecipes,
  activeRecipeIds,
  relationEdges,
  pilotCandidateTranslationSetGroups,
  pilotCandidateTranslationSetIds,
  pilotMetadataLexicalUseIds,
  motifVersion: MOTIF_REGISTRY_VERSION,
  motifRegistry,
  configVersion: COMPOSITION_POLICY_VERSION,
  compositionEngineVersion: COMPOSITION_ENGINE_VERSION,
  fontMetricsVersion: FONT_METRICS_VERSION,
  fontAssetRevision: FONT_ASSET_REVISION
});

const OWNER_MODULE_PATHS = Object.freeze({
  vocabulary: "web/micro-graphic-generator/src/vocabulary.js",
  recipes: "web/micro-graphic-generator/src/composition-recipes.js",
  motifs: "web/micro-graphic-generator/src/motifs.js",
  config: "web/micro-graphic-generator/src/config.js",
  snapshot: "web/micro-graphic-generator/src/composition-owner-snapshot.js",
  metrics: "web/micro-graphic-generator/src/typography-metrics.js"
});

export function extractPlanningOwnerRecords(ownerRoot) {
  const root = resolve(ownerRoot);
  const temporaryRoot = mkdtempSync(join(tmpdir(), "planning-owner-records-"));
  const extractorPath = join(temporaryRoot, "extract.mjs");
  const specifiers = Object.fromEntries(Object.entries(OWNER_MODULE_PATHS).map(([name, path]) => [
    name,
    pathToFileURL(resolve(root, path)).href
  ]));
  const extractorSource = `
import * as vocabulary from ${JSON.stringify(specifiers.vocabulary)};
import * as recipes from ${JSON.stringify(specifiers.recipes)};
import * as motifs from ${JSON.stringify(specifiers.motifs)};
import * as config from ${JSON.stringify(specifiers.config)};
import * as snapshot from ${JSON.stringify(specifiers.snapshot)};
import * as metrics from ${JSON.stringify(specifiers.metrics)};

const records = {
  vocabularyVersion: vocabulary.VOCABULARY_VERSION,
  lexicalUses: vocabulary.lexicalUses,
  translationSets: vocabulary.translationSets,
  translationErrorLedger: vocabulary.translationErrorLedger,
  recipeVersion: recipes.RECIPE_REGISTRY_VERSION,
  compositionRecipes: recipes.compositionRecipes,
  activeRecipeIds: recipes.activeRecipeIds,
  relationEdges: recipes.relationEdges,
  pilotCandidateTranslationSetGroups: recipes.pilotCandidateTranslationSetGroups,
  pilotCandidateTranslationSetIds: recipes.pilotCandidateTranslationSetIds,
  pilotMetadataLexicalUseIds: recipes.pilotMetadataLexicalUseIds,
  motifVersion: motifs.MOTIF_REGISTRY_VERSION,
  motifRegistry: motifs.motifRegistry,
  configVersion: config.COMPOSITION_POLICY_VERSION,
  compositionEngineVersion: snapshot.COMPOSITION_ENGINE_VERSION,
  fontMetricsVersion: metrics.FONT_METRICS_VERSION,
  fontAssetRevision: snapshot.FONT_ASSET_REVISION
};
process.stdout.write(JSON.stringify(records));
`;
  try {
    mkdirSync(temporaryRoot, { recursive: true });
    writeFileSync(extractorPath, extractorSource);
    const stdout = execFileSync(process.execPath, [extractorPath], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    const records = JSON.parse(stdout);
    if (!records || typeof records !== "object" || Array.isArray(records)) {
      throw new Error("candidate planning owner extraction returned invalid records");
    }
    return deepFreeze(records);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export const PLANNING_RELEASE_DOMAIN_POLICY = deepFreeze({
  schemaVersion: 2,
  policyId: "active-owner-max-domain-v2",
  representativeLanguage: "en",
  translationSetIdsByGroup: {
    command: ["upgrade.command"],
    modifier: ["quick.modifier"],
    recovery: ["retry.command"],
    status: ["access-denied.status"],
    subject: ["network.topic", "system.topic"]
  },
  metadataLexicalUseIds: [
    "generic-code.reference.1.en",
    "http-status.reference.200.en"
  ],
  motifCandidateId: "motif.barcode:medium",
  dominanceRules: [
    "group-selection-equals-runtime-max-active",
    "every-command-has-an-explicit-reviewed-subject",
    "command-representative-maximizes-subject-relations",
    "modifier-representative-requires-an-action",
    "status-representative-maximizes-subject-and-recovery-relations",
    "distinct-visible-text-is-worst-case-for-duplicate-pruning",
    "one-candidate-per-runtime-metadata-family",
    "one-active-owner-motif-candidate"
  ]
});

const RELEASE_INPUT_CONTRACT = deepFreeze({
  schemaVersion: 1,
  seed: 0x51a7c0de,
  generationTimestamp: "2026-07-14T00:00:00+09:00",
  ratio: "3:4",
  borderMode: "stroke",
  viewport: { width: 1440, height: 1200, devicePixelRatio: 2 },
  safeBox: { x: 0, y: 0, width: 900, height: 900 },
  ownerSnapshotPolicy: "release-domain-contract-digest"
});

function relationMatchesSet(edge, fromSetId, relation, toSetId) {
  return edge.reviewStatus === "approved"
    && edge.relation === relation
    && edge.from?.translationSetId === fromSetId
    && edge.to?.translationSetId === toSetId;
}

function validateDomainPolicy(owner) {
  const groupsById = new Map(owner.pilotCandidateTranslationSetGroups.map(group => [group.id, group]));
  const policyGroups = Object.keys(PLANNING_RELEASE_DOMAIN_POLICY.translationSetIdsByGroup).sort(compareStrings);
  const ownerGroups = [...groupsById.keys()].sort(compareStrings);
  if (canonicalJson(policyGroups) !== canonicalJson(ownerGroups)) {
    throw new Error("planning release policy group set differs from active owner groups");
  }
  for (const groupId of ownerGroups) {
    const group = groupsById.get(groupId);
    const selected = PLANNING_RELEASE_DOMAIN_POLICY.translationSetIdsByGroup[groupId];
    if (selected.length !== group.maxActive || new Set(selected).size !== selected.length) {
      throw new Error(`planning release group ${groupId} must equal maxActive`);
    }
    if (selected.some(id => !group.ids.includes(id))) {
      throw new Error(`planning release group ${groupId} selects an inactive translation set`);
    }
  }

  const commandGroup = groupsById.get("command");
  const modifierGroup = groupsById.get("modifier");
  const subjectGroup = groupsById.get("subject");
  const commandSubjectCounts = commandGroup.ids.map(commandSetId => ({
    commandSetId,
    count: subjectGroup.ids.filter(subjectSetId =>
      owner.relationEdges.some(edge => relationMatchesSet(edge, commandSetId, "actsOn", subjectSetId))
    ).length
  }));
  if (commandSubjectCounts.some(record => record.count < 1)) {
    throw new Error("every command requires at least one reviewed subject relation");
  }
  const maximumCommandSubjectCount = Math.max(...commandSubjectCounts.map(record => record.count));
  const selectedCommandSetId = PLANNING_RELEASE_DOMAIN_POLICY.translationSetIdsByGroup.command[0];
  if (commandSubjectCounts.find(record => record.commandSetId === selectedCommandSetId)?.count !== maximumCommandSubjectCount) {
    throw new Error("planning release command representative does not maximize subject relations");
  }
  for (const modifierSetId of modifierGroup.ids) {
    if (!owner.relationEdges.some(edge =>
      edge.reviewStatus === "approved"
      && edge.relation === "modifies"
      && edge.from?.translationSetId === modifierSetId
      && edge.to?.tag === "action"
    )) {
      throw new Error(`modifier relation coverage is incomplete for ${modifierSetId}`);
    }
  }
  const recoverySetId = groupsById.get("recovery").ids[0];
  const statusSubjectCounts = groupsById.get("status").ids.map(statusSetId => ({
    statusSetId,
    count: new Set(owner.relationEdges
      .filter(edge =>
        edge.reviewStatus === "approved"
        && ["stateOf", "resultOf"].includes(edge.relation)
        && edge.from?.translationSetId === statusSetId
        && subjectGroup.ids.includes(edge.to?.translationSetId)
      )
      .map(edge => edge.to.translationSetId)).size
  }));
  const recoveryCounts = groupsById.get("status").ids.map(statusSetId => ({
    statusSetId,
    count: owner.relationEdges.filter(edge => relationMatchesSet(
      edge,
      recoverySetId,
      "recoveryFor",
      statusSetId
    )).length
  }));
  const maximumRecoveryCount = Math.max(...recoveryCounts.map(record => record.count));
  const maximumSubjectCount = Math.max(...statusSubjectCounts.map(record => record.count));
  const selectedStatusSetId = PLANNING_RELEASE_DOMAIN_POLICY.translationSetIdsByGroup.status[0];
  if (statusSubjectCounts.find(record => record.statusSetId === selectedStatusSetId)?.count !== maximumSubjectCount) {
    throw new Error("planning release status representative does not maximize subject relations");
  }
  if (recoveryCounts.find(record => record.statusSetId === selectedStatusSetId)?.count !== maximumRecoveryCount) {
    throw new Error("planning release status representative does not maximize recovery relations");
  }
}

function representativeLexicalUseId(translationSetById, setId, owner) {
  const set = translationSetById.get(setId);
  if (!set) throw new Error(`planning release translation set is missing ${setId}`);
  const matches = set.members.filter(member => {
    const use = owner.lexicalUses.find(item => item.id === member.lexicalUseId);
    return use?.language === PLANNING_RELEASE_DOMAIN_POLICY.representativeLanguage
      && use.reviewStatus === "approved";
  });
  if (matches.length !== 1) throw new Error(`planning release set ${setId} needs one approved representative`);
  return matches[0].lexicalUseId;
}

function releaseGenerationInput(owner) {
  const ownerSnapshotRevision = hashCanonical(RELEASE_INPUT_CONTRACT);
  const {
    ownerSnapshotPolicy: _ownerSnapshotPolicy,
    ...generationFields
  } = RELEASE_INPUT_CONTRACT;
  return createGenerationInput({
    ...generationFields,
    vocabularyVersion: owner.vocabularyVersion,
    recipeVersion: owner.recipeVersion,
    motifVersion: owner.motifVersion,
    configVersion: owner.configVersion,
    compositionEngineVersion: owner.compositionEngineVersion,
    fontMetricsVersion: owner.fontMetricsVersion,
    fontAssetRevision: owner.fontAssetRevision,
    ownerSnapshotRevision
  });
}

function releaseCandidates(owner) {
  validateDomainPolicy(owner);
  const generationInput = releaseGenerationInput(owner);
  const vocabulary = validateVocabularyRegistry({
    lexicalUses: owner.lexicalUses,
    translationSets: owner.translationSets,
    translationErrorLedger: owner.translationErrorLedger
  });
  const motifCandidates = materializeMotifCandidates({
    registry: owner.motifRegistry,
    motifVersion: owner.motifVersion
  });
  const inventory = createCompositionCandidateInventory({
    generationInput,
    vocabularyVersion: owner.vocabularyVersion,
    lexicalUses: owner.lexicalUses,
    translationSets: owner.translationSets,
    rankedTranslationSetIds: owner.pilotCandidateTranslationSetIds,
    rankedTranslationSetGroups: owner.pilotCandidateTranslationSetGroups,
    rankedMetadataLexicalUseIds: owner.pilotMetadataLexicalUseIds,
    motifCandidates
  });
  const translationSetById = new Map(owner.translationSets.map(set => [set.id, set]));
  const selectedSetIds = Object.values(PLANNING_RELEASE_DOMAIN_POLICY.translationSetIdsByGroup).flat();
  const selectedLexicalUseIds = [
    ...selectedSetIds.map(setId => representativeLexicalUseId(translationSetById, setId, owner)),
    ...PLANNING_RELEASE_DOMAIN_POLICY.metadataLexicalUseIds
  ];
  const rankedCandidateIds = [
    ...selectedLexicalUseIds.map(lexicalUseId => {
      const candidateId = inventory.candidateIdByLexicalUseId.get(lexicalUseId);
      if (!candidateId) throw new Error(`planning release lexical candidate is missing ${lexicalUseId}`);
      return candidateId;
    }),
    PLANNING_RELEASE_DOMAIN_POLICY.motifCandidateId
  ].sort(compareStrings);
  if (new Set(rankedCandidateIds).size !== rankedCandidateIds.length) {
    throw new Error("planning release candidate IDs must be unique");
  }
  rankedCandidateIds.forEach(candidateId => {
    if (!inventory.candidateById.has(candidateId)) {
      throw new Error(`planning release candidate is not active ${candidateId}`);
    }
  });
  const selectedCandidates = rankedCandidateIds.map(candidateId => inventory.candidateById.get(candidateId));
  const lexicalTexts = selectedCandidates
    .filter(candidate => candidate.sourceKind === "lexical")
    .map(candidate => candidate.normalizedVisibleText);
  if (new Set(lexicalTexts).size !== lexicalTexts.length) {
    throw new Error("planning release representatives must maximize duplicate-pruning branches");
  }
  const translationSetByLexicalUseId = new Map(
    [...vocabulary.lexicalUseToTranslationSet].map(([lexicalUseId, translationSetId]) => [
      lexicalUseId,
      vocabulary.translationSetById.get(translationSetId)
    ])
  );
  return {
    generationInput,
    vocabulary,
    motifCandidates,
    inventory,
    rankedCandidateIds,
    selectedCandidates,
    translationSetByLexicalUseId
  };
}

function releaseCoverageProof(rankedCandidateIds, owner) {
  return {
    schemaVersion: 1,
    policyId: PLANNING_RELEASE_DOMAIN_POLICY.policyId,
    groupSelections: owner.pilotCandidateTranslationSetGroups
      .map(group => ({
        groupId: group.id,
        maxActive: group.maxActive,
        activeSetCount: group.ids.length,
        selectedSetIds: [...PLANNING_RELEASE_DOMAIN_POLICY.translationSetIdsByGroup[group.id]]
      }))
      .sort((left, right) => compareStrings(left.groupId, right.groupId)),
    rankedCandidateIds: [...rankedCandidateIds],
    dominanceRules: [...PLANNING_RELEASE_DOMAIN_POLICY.dominanceRules]
  };
}

export function buildActivePlanningRelease(owner = DEFAULT_PLANNING_OWNER_RECORDS) {
  const release = releaseCandidates(owner);
  const registryVersions = Object.freeze({
    vocabularyVersion: owner.vocabularyVersion,
    recipeVersion: owner.recipeVersion,
    motifVersion: owner.motifVersion,
    configVersion: owner.configVersion,
    compositionEngineVersion: owner.compositionEngineVersion,
    fontMetricsVersion: owner.fontMetricsVersion,
    fontAssetRevision: owner.fontAssetRevision,
    ownerSnapshotRevision: release.generationInput.ownerSnapshotRevision
  });
  const context = createPlanningObservationContext({
    generationInput: release.generationInput,
    registryVersions,
    lexicalUseById: release.vocabulary.lexicalUseById,
    translationSetById: release.vocabulary.translationSetById,
    translationSetByLexicalUseId: release.translationSetByLexicalUseId,
    recipes: owner.compositionRecipes,
    activeRecipeIds: owner.activeRecipeIds,
    relationEdges: owner.relationEdges,
    candidateById: release.inventory.candidateById,
    rankedCandidateIds: release.rankedCandidateIds,
    blockPolicyByFootprint: GRID_BLOCK_POLICY_BY_FOOTPRINT,
    enumerateCanonicalLayouts,
    compositionBlockGeometry,
    deriveTypographyTokenVariant,
    validateMotifRenderParams: owner === DEFAULT_PLANNING_OWNER_RECORDS
      ? validateMotifRenderParams
      : createMotifCandidateValidator({
          registry: owner.motifRegistry,
          motifVersion: owner.motifVersion
        }),
    allFitPolicy: PLANNING_ALL_FIT_POLICY
  });
  const layoutAlternativesByBlockCount = Object.fromEntries([2, 3, 4, 5].map(blockCount => [
    blockCount,
    enumerateCanonicalLayouts(
      Array.from({ length: blockCount }, (_, index) => `slot-${index + 1}`)
    ).length
  ]));
  const requestedSizeAlternativeCountsByFootprint = Object.fromEntries(
    [...GRID_BLOCK_POLICY_BY_FOOTPRINT.entries()]
      .sort(([left], [right]) => compareStrings(left, right))
      .map(([footprint, policy]) => [footprint, policy.requestedSizes?.length || 1])
  );
  const activeRecipes = owner.compositionRecipes
    .filter(recipe => owner.activeRecipeIds.includes(recipe.id))
    .sort((left, right) => compareStrings(left.id, right.id));
  const snapshotInput = deepFreeze({
    schemaVersion: 2,
    releaseInput: cloneData(release.generationInput),
    allFitPolicy: cloneData(PLANNING_ALL_FIT_POLICY),
    coverageProof: releaseCoverageProof(release.rankedCandidateIds, owner),
    basePartitionsByBlockCount: cloneData(COMPOSITION_BASE_PARTITIONS),
    layoutAlternativesByBlockCount,
    requestedSizeAlternativeCountsByFootprint,
    activeRecipeIds: [...owner.activeRecipeIds],
    candidates: release.selectedCandidates.map(cloneData),
    relationEdges: owner.relationEdges.map(cloneData),
    recipes: activeRecipes.map(cloneData)
  });
  return Object.freeze({
    context,
    snapshotInput,
    snapshotInputRevision: hashCanonical(snapshotInput)
  });
}
