import {
  createGenerationInput,
  validateVocabularyRegistry
} from "../src/composition-model.js";
import {
  COMPOSITION_ENGINE_VERSION,
  FONT_ASSET_REVISION,
  OWNER_SNAPSHOT_MANIFEST,
  OWNER_SNAPSHOT_REVISION
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
  COMPOSITION_POLICY_VERSION,
  deriveTypographyTokenVariant,
  GRID_BLOCK_POLICY_BY_FOOTPRINT
} from "../src/config.js";
import {
  compositionBlockGeometry,
  enumerateCanonicalLayouts
} from "../src/grid-layout.js";
import {
  materializeMotifCandidates,
  MOTIF_REGISTRY_VERSION,
  validateMotifRenderParams
} from "../src/motifs.js";
import { createPlanValidationContext } from "../src/composition-plan-validator.js";
import { createCompositionCandidateInventory } from "../src/token-library.js";
import {
  FONT_METRICS_VERSION,
  measureTypography
} from "../src/typography-metrics.js";
import {
  lexicalUses,
  translationErrorLedger,
  translationSets,
  VOCABULARY_VERSION
} from "../src/vocabulary.js";

export const TEST_COMPOSITION_ENGINE_VERSION = COMPOSITION_ENGINE_VERSION;
export const TEST_FONT_ASSET_REVISION = FONT_ASSET_REVISION;

export function createCompositionTestContext({
  seed = 0x12345678,
  generationTimestamp = "2026-07-14T12:00:00+09:00",
  ratio = "3:4",
  safeBox = { x: 0, y: 0, width: 720, height: 960 },
  rankedCandidateIds: rankedCandidateOverride = null
} = {}) {
  const versionTuple = {
    vocabularyVersion: VOCABULARY_VERSION,
    recipeVersion: RECIPE_REGISTRY_VERSION,
    motifVersion: MOTIF_REGISTRY_VERSION,
    configVersion: COMPOSITION_POLICY_VERSION,
    compositionEngineVersion: COMPOSITION_ENGINE_VERSION,
    fontMetricsVersion: FONT_METRICS_VERSION,
    fontAssetRevision: FONT_ASSET_REVISION
  };
  const generationInput = createGenerationInput({
    schemaVersion: 1,
    seed,
    generationTimestamp,
    ratio,
    borderMode: "corner-stroke",
    viewport: { width: 1440, height: 1200, devicePixelRatio: 2 },
    safeBox,
    ...versionTuple,
    ownerSnapshotRevision: OWNER_SNAPSHOT_REVISION
  });
  const vocabulary = validateVocabularyRegistry({
    lexicalUses,
    translationSets,
    translationErrorLedger
  });
  const motifCandidates = materializeMotifCandidates();
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
  const translationSetByLexicalUseId = new Map(
    [...vocabulary.lexicalUseToTranslationSet].map(([lexicalUseId, translationSetId]) => [
      lexicalUseId,
      vocabulary.translationSetById.get(translationSetId)
    ])
  );
  const rankedCandidateIds = rankedCandidateOverride || inventory.rankedCandidateIds;
  const registryVersions = Object.freeze({
    ...versionTuple,
    ownerSnapshotRevision: OWNER_SNAPSHOT_REVISION
  });
  const context = createPlanValidationContext({
    generationInput,
    ownerSnapshotManifest: OWNER_SNAPSHOT_MANIFEST,
    registryVersions,
    lexicalUseById: vocabulary.lexicalUseById,
    translationSetById: vocabulary.translationSetById,
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
  return Object.freeze({
    generationInput,
    ownerSnapshotManifest: OWNER_SNAPSHOT_MANIFEST,
    context,
    inventory,
    vocabulary,
    motifCandidates
  });
}
