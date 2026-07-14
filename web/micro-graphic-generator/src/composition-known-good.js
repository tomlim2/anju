import { canonicalJson, hashCanonical } from "./canonical-hash.js";
import {
  createPlanId,
  deepFreeze,
  validateGenerationInput
} from "./composition-model.js";
import {
  deriveTupleLayoutFacts,
  materializeCompositionPlan,
  validateCompositionPlan,
  validateTupleCompatibility
} from "./composition-plan-validator.js";
import {
  COMPOSITION_ENGINE_VERSION,
  FONT_ASSET_REVISION
} from "./composition-owner-snapshot.js";
import { RECIPE_REGISTRY_VERSION } from "./composition-recipes.js";
import { COMPOSITION_POLICY_VERSION, DESIGN_TOKEN_SIZE_ORDER } from "./config.js";
import { MOTIF_REGISTRY_VERSION } from "./motifs.js";
import { FONT_METRICS_VERSION } from "./typography-metrics.js";
import { VOCABULARY_VERSION } from "./vocabulary.js";

const ALIGNMENTS = Object.freeze(["left", "center", "right"]);
const VERTICAL_ALIGNMENTS = Object.freeze(["top", "middle", "bottom"]);
const ORIENTATIONS = Object.freeze(["none", "whole-rotate", "glyph-sideways-stack"]);
const FORBIDDEN_TEMPLATE_FIELDS = new Set([
  "ownerSnapshotRevision",
  "generationInput",
  "generationInputHash",
  "planId",
  "decisionTrace",
  "tokenId",
  "requestedWeight",
  "requestedFontWeight",
  "actualSize",
  "actualWeight",
  "actualFontWeight",
  "fallbackTier"
]);

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function lockMap(map) {
  for (const method of ["set", "delete", "clear"]) {
    Object.defineProperty(map, method, {
      configurable: false,
      enumerable: false,
      writable: false,
      value() {
        throw new TypeError("known-good plan map is immutable");
      }
    });
  }
  return Object.freeze(map);
}

function assertExactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a record`);
  }
  const actual = Object.keys(value).sort(compareStrings);
  const expected = [...keys].sort(compareStrings);
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new Error(`${label} fields mismatch`);
  }
}

function assertNoForbiddenFields(value, path = "template") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_TEMPLATE_FIELDS.has(key)) throw new Error(`${path}.${key} is forbidden`);
    assertNoForbiddenFields(child, `${path}.${key}`);
  }
}

function cellsToFootprint(cells) {
  const rows = cells.map(cell => Math.floor((cell - 1) / 3));
  const columns = cells.map(cell => (cell - 1) % 3);
  const width = Math.max(...columns) - Math.min(...columns) + 1;
  const height = Math.max(...rows) - Math.min(...rows) + 1;
  if (width * height !== cells.length) throw new Error("template block cells must be rectangular");
  return `${width}x${height}`;
}

function versionKey(recipeId, ratio) {
  return Object.freeze({
    recipeId,
    ratio,
    vocabularyVersion: VOCABULARY_VERSION,
    recipeVersion: RECIPE_REGISTRY_VERSION,
    motifVersion: MOTIF_REGISTRY_VERSION,
    configVersion: COMPOSITION_POLICY_VERSION,
    compositionEngineVersion: COMPOSITION_ENGINE_VERSION,
    fontMetricsVersion: FONT_METRICS_VERSION,
    fontAssetRevision: FONT_ASSET_REVISION
  });
}

const SLOT_CANDIDATES = Object.freeze({
  command: Object.freeze([
    Object.freeze({
      id: "hero-1",
      slotDefinitionId: "hero",
      sourceKind: "lexical",
      candidateScope: "static",
      candidateId: "lexical:lock.command.zh"
    }),
    Object.freeze({
      id: "subject-1",
      slotDefinitionId: "subject",
      sourceKind: "lexical",
      candidateScope: "static",
      candidateId: "lexical:system.topic.zh"
    })
  ]),
  status: Object.freeze([
    Object.freeze({
      id: "hero-1",
      slotDefinitionId: "hero",
      sourceKind: "lexical",
      candidateScope: "static",
      candidateId: "lexical:locked.status.zh"
    }),
    Object.freeze({
      id: "subject-1",
      slotDefinitionId: "subject",
      sourceKind: "lexical",
      candidateScope: "static",
      candidateId: "lexical:system.topic.zh"
    })
  ])
});

function block(id, footprint, cells, slotInstanceId, requestedSize, alignment, verticalAlignment, orientationMode = "none") {
  return Object.freeze({
    id,
    footprint,
    cells: Object.freeze(cells),
    slotInstanceId,
    requestedSize,
    alignment,
    verticalAlignment,
    orientationMode
  });
}

function horizontalBlocks(heroSize, heroFirst = false) {
  const hero = block(
    heroFirst ? "block-1" : "block-2",
    "3x2",
    heroFirst ? [1, 2, 3, 4, 5, 6] : [4, 5, 6, 7, 8, 9],
    "hero-1",
    heroSize,
    "center",
    "middle"
  );
  const subject = block(
    heroFirst ? "block-2" : "block-1",
    "3x1",
    heroFirst ? [7, 8, 9] : [1, 2, 3],
    "subject-1",
    "xxlarge",
    "center",
    "middle"
  );
  return Object.freeze(heroFirst ? [hero, subject] : [subject, hero]);
}

const COMMAND_LAYOUTS = Object.freeze({
  "1:1": horizontalBlocks("xxxlarge"),
  "2:3": horizontalBlocks("xxxlarge"),
  "2:5": horizontalBlocks("xxxlarge", true),
  "3:2": horizontalBlocks("xxxlarge"),
  "5:2": Object.freeze([
    block("block-1", "1x3", [1, 4, 7], "subject-1", "xxlarge", "center", "middle", "glyph-sideways-stack"),
    block("block-2", "2x3", [2, 3, 5, 6, 8, 9], "hero-1", "xxxlarge", "center", "middle")
  ]),
  "4:3": horizontalBlocks("xxxlarge"),
  "3:4": horizontalBlocks("xxxlarge")
});

const STATUS_LAYOUTS = Object.freeze({
  "1:1": horizontalBlocks("xxxlarge", true),
  "2:3": horizontalBlocks("xxxlarge"),
  "2:5": horizontalBlocks("xxxlarge", true),
  "3:2": horizontalBlocks("xxxlarge", true),
  "5:2": horizontalBlocks("xxxlarge"),
  "4:3": horizontalBlocks("xxxlarge", true),
  "3:4": horizontalBlocks("xxxlarge")
});

function makeTemplate(recipeId, ratio, blocks) {
  return deepFreeze({
    schemaVersion: 1,
    templateId: `known-good:${recipeId}:${ratio}`,
    key: versionKey(recipeId, ratio),
    coherenceMode: "direct",
    slots: SLOT_CANDIDATES[recipeId],
    blocks
  });
}

export const knownGoodTemplates = Object.freeze([
  ...Object.entries(COMMAND_LAYOUTS).map(([ratio, blocks]) => makeTemplate("command", ratio, blocks)),
  ...Object.entries(STATUS_LAYOUTS).map(([ratio, blocks]) => makeTemplate("status", ratio, blocks))
].sort((left, right) => compareStrings(left.templateId, right.templateId)));

export function validateKnownGoodTemplateShape(template) {
  assertNoForbiddenFields(template);
  assertExactKeys(template, ["schemaVersion", "templateId", "key", "coherenceMode", "slots", "blocks"], "template");
  if (template.schemaVersion !== 1 || template.coherenceMode !== "direct") {
    throw new Error("known-good template schema mismatch");
  }
  if (typeof template.templateId !== "string" || template.templateId.length === 0) {
    throw new Error("known-good template ID is required");
  }
  assertExactKeys(template.key, [
    "recipeId", "ratio", "vocabularyVersion", "recipeVersion", "motifVersion", "configVersion",
    "compositionEngineVersion", "fontMetricsVersion", "fontAssetRevision"
  ], "template.key");
  if (!/^\d+:\d+$/.test(template.key.ratio)) throw new Error("known-good ratio is invalid");
  for (const key of [
    "vocabularyVersion", "recipeVersion", "motifVersion", "configVersion",
    "compositionEngineVersion", "fontMetricsVersion"
  ]) {
    if (!Number.isInteger(template.key[key]) || template.key[key] < 1) throw new Error(`invalid known-good ${key}`);
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(template.key.fontAssetRevision)) {
    throw new Error("invalid known-good font asset revision");
  }
  if (!Array.isArray(template.slots) || template.slots.length < 2 || template.slots.length > 5) {
    throw new Error("known-good template requires 2-5 slots");
  }
  if (!Array.isArray(template.blocks) || template.blocks.length !== template.slots.length) {
    throw new Error("known-good template slot/block count mismatch");
  }
  const slotIds = new Set();
  for (const slot of template.slots) {
    assertExactKeys(slot, ["id", "slotDefinitionId", "sourceKind", "candidateScope", "candidateId"], "template.slot");
    if (slotIds.has(slot.id)) throw new Error(`duplicate known-good slot ${slot.id}`);
    slotIds.add(slot.id);
    if (!/^[a-z][a-z0-9-]*-\d+$/.test(slot.id)) throw new Error(`invalid known-good slot ${slot.id}`);
    if (!/^[a-z][a-z0-9-]*$/.test(slot.slotDefinitionId)) throw new Error("invalid slot definition ID");
    if (!["lexical", "motif"].includes(slot.sourceKind) || slot.candidateScope !== "static") {
      throw new Error("known-good slot must declare a static candidate");
    }
    if (typeof slot.candidateId !== "string" || slot.candidateId.length === 0) throw new Error("candidate ID is required");
  }
  if (template.slots.filter(slot => slot.slotDefinitionId === "hero").length !== 1) {
    throw new Error("known-good template requires one hero slot");
  }
  const allCells = [];
  const blockIds = new Set();
  const referencedSlots = new Set();
  for (const item of template.blocks) {
    assertExactKeys(item, [
      "id", "footprint", "cells", "slotInstanceId", "requestedSize", "alignment",
      "verticalAlignment", "orientationMode"
    ], "template.block");
    if (blockIds.has(item.id)) throw new Error(`duplicate known-good block ${item.id}`);
    blockIds.add(item.id);
    if (!slotIds.has(item.slotInstanceId) || referencedSlots.has(item.slotInstanceId)) {
      throw new Error("known-good block/slot reference mismatch");
    }
    referencedSlots.add(item.slotInstanceId);
    if (!Array.isArray(item.cells) || item.cells.length === 0 || item.cells.some(cell => !Number.isInteger(cell) || cell < 1 || cell > 9)) {
      throw new Error("invalid known-good cells");
    }
    if (cellsToFootprint(item.cells) !== item.footprint) throw new Error("known-good footprint mismatch");
    if (!DESIGN_TOKEN_SIZE_ORDER.includes(item.requestedSize)) throw new Error("invalid known-good size");
    if (!ALIGNMENTS.includes(item.alignment) || !VERTICAL_ALIGNMENTS.includes(item.verticalAlignment)) {
      throw new Error("invalid known-good alignment");
    }
    if (!ORIENTATIONS.includes(item.orientationMode)) throw new Error("invalid known-good orientation");
    allCells.push(...item.cells);
  }
  if (canonicalJson([...allCells].sort((a, b) => a - b)) !== canonicalJson([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
    throw new Error("known-good blocks must cover the 3x3 grid exactly");
  }
  return template;
}

function templateFullKey(template) {
  return hashCanonical(template.key);
}

export function createKnownGoodRegistry(templates = knownGoodTemplates) {
  const diagnostics = [];
  const accepted = [];
  const seenTemplateIds = new Set();
  const seenKeys = new Set();
  for (const source of templates) {
    try {
      const template = deepFreeze(structuredClone(source));
      validateKnownGoodTemplateShape(template);
      const key = templateFullKey(template);
      if (seenTemplateIds.has(template.templateId)) throw new Error(`duplicate template ID ${template.templateId}`);
      if (seenKeys.has(key)) throw new Error(`duplicate template full key ${key}`);
      seenTemplateIds.add(template.templateId);
      seenKeys.add(key);
      accepted.push(template);
    } catch (error) {
      diagnostics.push(Object.freeze({
        code: "known-good.invalid-template",
        templateId: typeof source?.templateId === "string" ? source.templateId : null,
        detail: String(error?.message || error)
      }));
    }
  }
  accepted.sort((left, right) => compareStrings(left.templateId, right.templateId));
  diagnostics.sort((left, right) => compareStrings(left.templateId || "", right.templateId || "") || compareStrings(left.detail, right.detail));
  return deepFreeze({ schemaVersion: 1, templates: accepted, diagnostics });
}

function expectedTemplateKey(generationInput, recipeId) {
  return {
    recipeId,
    ratio: generationInput.ratio,
    vocabularyVersion: generationInput.vocabularyVersion,
    recipeVersion: generationInput.recipeVersion,
    motifVersion: generationInput.motifVersion,
    configVersion: generationInput.configVersion,
    compositionEngineVersion: generationInput.compositionEngineVersion,
    fontMetricsVersion: generationInput.fontMetricsVersion,
    fontAssetRevision: generationInput.fontAssetRevision
  };
}

export function findKnownGoodTemplate(registry, generationInput, recipeId) {
  validateGenerationInput(generationInput);
  const key = canonicalJson(expectedTemplateKey(generationInput, recipeId));
  return registry.templates.find(template => canonicalJson(template.key) === key) || null;
}

function templateBlockProjection(block) {
  return {
    id: block.id,
    footprint: block.footprint,
    cells: block.cells,
    slotInstanceId: block.slotInstanceId,
    requestedSize: block.requestedSize,
    alignment: block.alignment,
    verticalAlignment: block.verticalAlignment,
    orientationMode: block.orientationMode
  };
}

export function instantiateKnownGoodTemplate(template, generationInput, context) {
  validateKnownGoodTemplateShape(template);
  validateGenerationInput(generationInput);
  if (generationInput !== context.generationInput) throw new Error("known-good requires the context GenerationInput object");
  if (hashCanonical(generationInput) !== context.generationInputHash) throw new Error("known-good input hash mismatch");
  if (context.ownerSnapshotManifest.ownerSnapshotRevision !== generationInput.ownerSnapshotRevision) {
    throw new Error("known-good owner snapshot mismatch");
  }
  if (canonicalJson(template.key) !== canonicalJson(expectedTemplateKey(generationInput, template.key.recipeId))) {
    throw new Error("known-good template version key mismatch");
  }
  const tuple = {
    recipeId: template.key.recipeId,
    slots: template.slots.map(slot => {
      const candidate = context.candidateById.get(slot.candidateId);
      if (!candidate || candidate.sourceKind !== slot.sourceKind) throw new Error(`known-good candidate missing ${slot.candidateId}`);
      if (candidate.sourceKind === "lexical" && candidate.instanceKey !== null) {
        throw new Error(`known-good candidate must be static ${slot.candidateId}`);
      }
      return {
        id: slot.id,
        slotDefinitionId: slot.slotDefinitionId,
        sourceKind: slot.sourceKind,
        candidateId: slot.candidateId
      };
    })
  };
  const compatibility = validateTupleCompatibility(tuple, context);
  if (!compatibility.valid) throw new Error(`known-good tuple invalid: ${compatibility.rejectionReasons.join(", ")}`);
  const facts = deriveTupleLayoutFacts(tuple, context);
  const templateBlocks = canonicalJson(template.blocks.map(templateBlockProjection));
  const matches = facts.viableDecisions.filter(decision =>
    canonicalJson(decision.blocks.map(templateBlockProjection)) === templateBlocks
  );
  if (matches.length !== 1) throw new Error(`known-good decision match count ${matches.length}`);
  const plan = materializeCompositionPlan(tuple, matches[0], context);
  validateCompositionPlan(plan, context);
  const identityPayload = {
    schemaVersion: plan.schemaVersion,
    generationInputHash: plan.generationInputHash,
    recipeId: plan.recipeId,
    coherenceMode: plan.coherenceMode,
    slots: plan.slots,
    blocks: plan.blocks
  };
  if (createPlanId(identityPayload) !== plan.planId) throw new Error("known-good plan identity mismatch");
  return plan;
}

export function instantiateKnownGoodPlanMap(registry, generationInput, context) {
  const plans = new Map();
  const diagnostics = [...registry.diagnostics];
  for (const recipeId of context.activeRecipeIds) {
    const template = findKnownGoodTemplate(registry, generationInput, recipeId);
    if (!template) {
      diagnostics.push(Object.freeze({
        code: "known-good.missing-template",
        templateId: null,
        detail: `${recipeId}/${generationInput.ratio}`
      }));
      continue;
    }
    try {
      const plan = instantiateKnownGoodTemplate(template, generationInput, context);
      if (plans.has(recipeId)) throw new Error(`duplicate known-good recipe ${recipeId}`);
      plans.set(recipeId, plan);
    } catch (error) {
      diagnostics.push(Object.freeze({
        code: "known-good.instantiation-failed",
        templateId: template.templateId,
        detail: String(error?.message || error)
      }));
    }
  }
  diagnostics.sort((left, right) => compareStrings(left.templateId || "", right.templateId || "") || compareStrings(left.detail, right.detail));
  return Object.freeze({ plans: lockMap(plans), diagnostics: Object.freeze(diagnostics) });
}
