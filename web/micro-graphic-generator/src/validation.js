import { canonicalJson } from "./canonical-hash.js";
import {
  ACTIVE_STROKE_WEIGHTS,
  DESIGN_TOKEN_SIZE_ORDER,
  LAYOUT_GRID,
  STROKE_WEIGHTS
} from "./config.js";
import { transformedBoundsInComponent } from "./grid-finalizer.js";

function record(rule, valid, nodes = [], detail = "") {
  return Object.freeze({
    rule,
    valid: Boolean(valid),
    nodes: Object.freeze(valid ? [] : [...nodes]),
    detail: valid ? "" : detail
  });
}

function nodeId(node, fallback = "node") {
  return node?.getAttribute?.("data-message-slot")
    || node?.getAttribute?.("data-grid-block")
    || node?.getAttribute?.("data-token-role")
    || fallback;
}

function componentFor(art) {
  return art?.matches?.("svg[data-component]")
    ? art
    : art?.querySelector?.("svg[data-component]") || null;
}

function componentRoots(art) {
  if (!art?.querySelectorAll) return [];
  return art.matches?.("svg[data-component]")
    ? [art]
    : [...art.querySelectorAll("svg[data-component]")];
}

function attributeOrNull(node, name) {
  return node?.hasAttribute(name) ? node.getAttribute(name) : null;
}

function tokenRoots(component) {
  return component ? [...component.querySelectorAll("[data-message-slot]")].filter(node =>
    node.parentElement?.hasAttribute("data-grid-block")
  ) : [];
}

function validateTaxonomy(art) {
  const invalid = [...art.querySelectorAll("[data-token-size]")].filter(node =>
    !node.hasAttribute("data-token-form")
  );
  return record(
    "taxonomy.classified",
    invalid.length === 0,
    invalid.map(nodeId),
    `${invalid.length} sized nodes have no form`
  );
}

function validateTypeface(art) {
  const invalid = [...art.querySelectorAll('[data-token-form="typography"]')].filter(node =>
    !node.hasAttribute("data-token-typeface")
  );
  return record(
    "typography.typeface",
    invalid.length === 0,
    invalid.map(nodeId),
    `${invalid.length} typography nodes have no typeface`
  );
}

function validateDiscreteTypography(art) {
  const invalid = [...art.querySelectorAll('text[data-token-form="typography"]')].filter(node =>
    !DESIGN_TOKEN_SIZE_ORDER.includes(node.getAttribute("data-token-size"))
    || node.hasAttribute("textLength")
    || node.hasAttribute("lengthAdjust")
    || !["400", "700", "900"].includes(node.getAttribute("font-weight"))
  );
  return record(
    "typography.discrete-no-distortion",
    invalid.length === 0,
    invalid.map(nodeId),
    `${invalid.length} typography nodes violate discrete size/weight/no-distortion rules`
  );
}

function validateLineHeight(art) {
  const invalid = [...art.querySelectorAll("text")].filter(node => node.getAttribute("line-height") !== "1");
  return record(
    "typography.line-height",
    invalid.length === 0,
    invalid.map(nodeId),
    `${invalid.length} text nodes do not use line-height 1`
  );
}

function validateNoScale(art) {
  const invalid = [...art.querySelectorAll("[transform]")].filter(node =>
    /\bscale\s*\(/.test(node.getAttribute("transform") || "")
  );
  return record(
    "geometry.no-scale",
    invalid.length === 0,
    invalid.map(nodeId),
    `${invalid.length} nodes use scale transforms`
  );
}

function validateStroke(art) {
  const invalid = [...art.querySelectorAll('[stroke]:not([stroke="none"])')].filter(node => {
    const weight = node.getAttribute("data-stroke-weight");
    return !ACTIVE_STROKE_WEIGHTS.includes(weight)
      || node.getAttribute("stroke-width") !== String(STROKE_WEIGHTS[weight]);
  });
  return record(
    "stroke.active-weight",
    invalid.length === 0,
    invalid.map(nodeId),
    `${invalid.length} stroked nodes use an inactive weight`
  );
}

function validateRootMetadata(component, plan, context) {
  if (!plan || !context) return record("composition.root-metadata", true);
  const input = plan.generationInput;
  const expected = {
    "data-plan-id": plan.planId,
    "data-composition-schema": String(plan.schemaVersion),
    "data-composition-recipe": plan.recipeId,
    "data-coherence-mode": plan.coherenceMode,
    "data-generation-input-hash": plan.generationInputHash,
    "data-node-conformance-runtime": context.conformance.nodeRuntime,
    "data-browser-conformance-profile": context.conformance.browserProfile,
    "data-vocabulary-version": String(input.vocabularyVersion),
    "data-recipe-version": String(input.recipeVersion),
    "data-motif-version": String(input.motifVersion),
    "data-config-version": String(input.configVersion),
    "data-composition-engine-version": String(input.compositionEngineVersion),
    "data-font-metrics-version": String(input.fontMetricsVersion),
    "data-font-asset-revision": input.fontAssetRevision,
    "data-owner-snapshot-revision": input.ownerSnapshotRevision,
    "data-safe-box": canonicalJson(input.safeBox)
  };
  const mismatches = Object.entries(expected)
    .filter(([key, value]) => component?.getAttribute(key) !== value)
    .map(([key]) => key);
  return record(
    "composition.root-metadata",
    Boolean(component) && mismatches.length === 0,
    mismatches,
    `Component root metadata mismatch: ${mismatches.join(", ")}`
  );
}

function validateSingleComponent(art, plan) {
  if (!plan) return record("composition.single-component", true);
  const components = componentRoots(art);
  return record(
    "composition.single-component",
    components.length === 1,
    components.map((node, index) => node.getAttribute("data-plan-id") || `component-${index + 1}`),
    `Expected one mounted component, found ${components.length}`
  );
}

function validateGridCoverage(component, plan) {
  if (!plan) return record("composition.grid-coverage", true);
  const blockNodes = component ? [...component.querySelectorAll("[data-grid-block]")] : [];
  const cells = blockNodes.flatMap(node => (node.getAttribute("data-grid-cells") || "")
    .split(",")
    .filter(Boolean)
    .map(Number));
  const valid = blockNodes.length === plan.blocks.length
    && blockNodes.length >= 2
    && blockNodes.length <= 5
    && component?.getAttribute("data-layout-grid") === `${LAYOUT_GRID.columns}x${LAYOUT_GRID.rows}`
    && canonicalJson([...cells].sort((a, b) => a - b)) === canonicalJson([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  return record(
    "composition.grid-coverage",
    valid,
    ["component"],
    "Rendered blocks do not cover each 3x3 cell exactly once"
  );
}

function validateSlotBlock(component, plan) {
  if (!plan) return record("composition.slot-block", true);
  const failures = [];
  for (const block of plan.blocks) {
    const node = [...(component?.querySelectorAll("[data-grid-block]") || [])]
      .find(item => item.getAttribute("data-grid-block") === block.id);
    const directTokens = node
      ? [...node.children].filter(child => child.hasAttribute("data-message-slot"))
      : [];
    if (
      !node
      || directTokens.length !== 1
      || directTokens[0].getAttribute("data-message-slot") !== block.slotInstanceId
      || node.getAttribute("data-slot-instance") !== block.slotInstanceId
      || node.getAttribute("data-grid-footprint") !== block.footprint
      || node.getAttribute("data-grid-cells") !== block.cells.join(",")
    ) failures.push(block.id);
  }
  return record(
    "composition.slot-block",
    failures.length === 0,
    failures,
    `${failures.length} block/slot projections differ from the plan`
  );
}

function nearlyEqualAttribute(node, name, expected, tolerance = 0.000001) {
  const actual = Number(node?.getAttribute(name));
  return Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance;
}

function boundsInside(bounds, box, tolerance = 0.25) {
  return Boolean(bounds && box)
    && bounds.x >= box.x - tolerance
    && bounds.y >= box.y - tolerance
    && bounds.x + bounds.width <= box.x + box.width + tolerance
    && bounds.y + bounds.height <= box.y + box.height + tolerance;
}

function validatePhysicalBlockGeometry(component, plan, context, report) {
  if (!plan || !context) return record("composition.physical-block-geometry", true);
  const failures = [];
  for (const block of plan.blocks) {
    const node = [...(component?.querySelectorAll("[data-grid-block]") || [])]
      .find(item => item.getAttribute("data-grid-block") === block.id);
    const geometry = context.compositionBlockGeometry(context.generationInput.safeBox, block.cells);
    const outline = node?.querySelector(`:scope > [data-grid-block-outline="${block.id}"]`);
    const token = node
      ? [...node.children].find(child => child.hasAttribute("data-message-slot"))
      : null;
    const tokenBounds = token && component
      ? transformedBoundsInComponent(token, component)
      : null;
    const blockReport = report?.blocks?.find(item => item.blockId === block.id) || null;
    const transform = node?.getAttribute("transform") || "";
    if (
      !node
      || transform.trim() !== ""
      || !nearlyEqualAttribute(node, "data-grid-block-x", geometry.outerBox.x)
      || !nearlyEqualAttribute(node, "data-grid-block-y", geometry.outerBox.y)
      || !nearlyEqualAttribute(node, "data-grid-block-width", geometry.outerBox.width)
      || !nearlyEqualAttribute(node, "data-grid-block-height", geometry.outerBox.height)
      || !nearlyEqualAttribute(node, "data-grid-content-x", geometry.contentBox.x)
      || !nearlyEqualAttribute(node, "data-grid-content-y", geometry.contentBox.y)
      || !nearlyEqualAttribute(node, "data-grid-content-width", geometry.contentBox.width)
      || !nearlyEqualAttribute(node, "data-grid-content-height", geometry.contentBox.height)
      || !outline
      || !nearlyEqualAttribute(outline, "x", geometry.outerBox.x)
      || !nearlyEqualAttribute(outline, "y", geometry.outerBox.y)
      || !nearlyEqualAttribute(outline, "width", geometry.outerBox.width)
      || !nearlyEqualAttribute(outline, "height", geometry.outerBox.height)
      || !token
      || !boundsInside(tokenBounds, geometry.contentBox)
      || (blockReport && (
        Math.abs(tokenBounds.width - blockReport.renderedBounds.width) > 0.25
        || Math.abs(tokenBounds.height - blockReport.renderedBounds.height) > 0.25
      ))
    ) failures.push(block.id);
  }
  return record(
    "composition.physical-block-geometry",
    failures.length === 0,
    failures,
    `${failures.length} rendered block geometries differ from the planned safe-box projection`
  );
}

function validateHero(component, plan) {
  if (!plan) return record("composition.hero", true);
  const roots = tokenRoots(component);
  const heroes = roots.filter(node => node.getAttribute("data-composition-role") === "hero");
  const primary = roots.filter(node => node.getAttribute("data-visual-prominence") === "primary");
  const invalid = heroes.length !== 1
    || primary.length !== 1
    || heroes[0] !== primary[0]
    || heroes[0]?.getAttribute("data-token-source-kind") !== "lexical";
  return record(
    "composition.hero",
    !invalid,
    invalid ? roots.map(nodeId) : [],
    "Composition requires exactly one lexical hero that exclusively owns primary prominence"
  );
}

function validateConditionalIdentity(component, plan, context) {
  if (!plan) return record("composition.conditional-identity", true);
  const failures = [];
  for (const slot of plan.slots) {
    const node = tokenRoots(component).find(token => token.getAttribute("data-message-slot") === slot.id);
    const candidate = context?.candidateById?.get(slot.candidateId) || null;
    if (!node || !candidate) {
      failures.push(slot.id);
      continue;
    }
    const lexicalAttributes = ["data-lexical-use", "data-translation-set", "data-instance-key", "data-phrase-pack"];
    const motifAttributes = [
      "data-motif-id", "data-motif-candidate", "data-materialization-key", "data-render-params-hash",
      "data-occupancy-safety-factor", "data-occupancy-calibration-revision", "data-motif-factual"
    ];
    if (slot.sourceKind === "lexical") {
      const text = node.querySelector(':scope > text[data-token-form="typography"]');
      if (
        candidate.sourceKind !== "lexical"
        || node.getAttribute("data-token-source-kind") !== "lexical"
        || node.getAttribute("data-candidate-id") !== slot.candidateId
        || node.getAttribute("data-lexical-use") !== slot.lexicalUseId
        || attributeOrNull(node, "data-translation-set") !== slot.translationSetId
        || attributeOrNull(node, "data-instance-key") !== slot.instanceKey
        || attributeOrNull(node, "data-phrase-pack") !== slot.phrasePackId
        || candidate.lexicalUseId !== slot.lexicalUseId
        || candidate.translationSetId !== slot.translationSetId
        || candidate.instanceKey !== slot.instanceKey
        || candidate.phrasePackId !== slot.phrasePackId
        || node.getAttribute("data-visible-text") !== candidate.visibleText
        || text?.textContent !== candidate.visibleText
        || text?.getAttribute("data-lexical-use") !== slot.lexicalUseId
        || motifAttributes.some(attribute => node.hasAttribute(attribute))
      ) failures.push(slot.id);
    } else if (
      candidate.sourceKind !== "motif"
      || node.getAttribute("data-token-source-kind") !== "motif"
      || node.getAttribute("data-candidate-id") !== slot.candidateId
      || lexicalAttributes.some(attribute => node.hasAttribute(attribute))
      || node.getAttribute("data-motif-id") !== slot.motifId
      || node.getAttribute("data-motif-candidate") !== slot.candidateId
      || node.getAttribute("data-materialization-key") !== slot.materializationKey
      || node.getAttribute("data-render-params-hash") !== slot.renderParamsHash
      || candidate.motifId !== slot.motifId
      || candidate.materializationKey !== slot.materializationKey
      || candidate.renderParamsHash !== slot.renderParamsHash
      || node.getAttribute("data-motif-factual") !== "false"
    ) failures.push(slot.id);
  }
  return record(
    "composition.conditional-identity",
    failures.length === 0,
    failures,
    `${failures.length} token roots mix or omit conditional identity metadata`
  );
}

function normalizeVisibleText(value) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toUpperCase();
}

function validateDuplicateText(component, plan) {
  if (!plan) return record("composition.duplicate-visible-text", true);
  const seen = new Set();
  const failures = [];
  for (const node of tokenRoots(component).filter(token => token.getAttribute("data-token-source-kind") === "lexical")) {
    const value = normalizeVisibleText(node.getAttribute("data-visible-text") || "");
    if (seen.has(value)) failures.push(nodeId(node));
    seen.add(value);
  }
  return record(
    "composition.duplicate-visible-text",
    failures.length === 0,
    failures,
    `${failures.length} visible lexical tokens are duplicates`
  );
}

function validateFinalizationMetadata(component, plan, report) {
  if (!plan || !report) return record("composition.finalization-metadata", true);
  const failures = [];
  if (report.status !== "accept" || report.planId !== plan.planId) failures.push("report");
  for (const blockReport of report.blocks) {
    const slot = plan.slots.find(item => item.id === blockReport.slotInstanceId);
    const node = tokenRoots(component).find(token => token.getAttribute("data-message-slot") === blockReport.slotInstanceId);
    const text = node?.querySelector(':scope > text[data-token-form="typography"]');
    if (
      !slot
      || !node
      || node.getAttribute("data-visual-prominence") !== slot.prominence
      || node.getAttribute("data-mounted-occupancy-score") !== String(blockReport.mountedOccupancyScore)
      || node.getAttribute("data-rendered-width") !== String(blockReport.renderedBounds.width)
      || node.getAttribute("data-rendered-height") !== String(blockReport.renderedBounds.height)
      || node.getAttribute("data-fallback-tier") !== String(blockReport.fallbackTier)
      || node.getAttribute("data-token-fit") !== "true"
      || (slot.sourceKind === "lexical" && (
        node.getAttribute("data-token-weight") !== blockReport.actualWeight
        || text?.getAttribute("data-token-weight") !== blockReport.actualWeight
        || text?.getAttribute("font-weight") !== String(blockReport.actualFontWeight)
        || text?.getAttribute("data-token-size") !== blockReport.actualSize
      ))
      || (slot.sourceKind === "motif" && (
        node.getAttribute("data-occupancy-safety-factor") !== String(blockReport.occupancySafetyFactor)
        || node.getAttribute("data-occupancy-calibration-revision") !== blockReport.occupancyCalibrationRevision
      ))
    ) failures.push(blockReport.slotInstanceId);
  }
  return record(
    "composition.finalization-metadata",
    failures.length === 0,
    failures,
    `${failures.length} mounted token reports differ from SVG metadata`
  );
}

function validateOrientation(component, plan) {
  if (!plan) return record("composition.orientation", true);
  const failures = [];
  for (const block of plan.blocks) {
    const slot = plan.slots.find(item => item.id === block.slotInstanceId);
    if (slot?.sourceKind !== "lexical") continue;
    const node = tokenRoots(component).find(token => token.getAttribute("data-message-slot") === slot.id);
    const text = node?.querySelector(":scope > text");
    const glyphStack = block.orientationMode === "glyph-sideways-stack";
    const wholeRotate = block.orientationMode === "whole-rotate";
    if (
      !node
      || node.getAttribute("data-token-orientation") !== block.orientationMode
      || (glyphStack && (
        text?.getAttribute("writing-mode") !== "vertical-rl"
        || text?.getAttribute("text-orientation") !== "sideways"
        || text?.getAttribute("dominant-baseline") !== "central"
      ))
      || (wholeRotate && !(node.getAttribute("data-token-base-transform") || "").includes("rotate(90)"))
      || (!glyphStack && text?.hasAttribute("writing-mode"))
    ) failures.push(slot.id);
  }
  return record(
    "composition.orientation",
    failures.length === 0,
    failures,
    `${failures.length} token orientations differ from the plan`
  );
}

export function validateRenderedTokenRules(art, options = {}) {
  const component = componentFor(art);
  const plan = options.plan || null;
  const report = options.finalizationReport || null;
  const context = options.validationContext || null;
  const results = [
    validateTaxonomy(art),
    validateTypeface(art),
    validateDiscreteTypography(art),
    validateLineHeight(art),
    validateNoScale(art),
    validateStroke(art),
    validateSingleComponent(art, plan),
    validateRootMetadata(component, plan, context),
    validateGridCoverage(component, plan),
    validateSlotBlock(component, plan),
    validatePhysicalBlockGeometry(component, plan, context, report),
    validateHero(component, plan),
    validateConditionalIdentity(component, plan, context),
    validateDuplicateText(component, plan),
    validateFinalizationMetadata(component, plan, report),
    validateOrientation(component, plan)
  ];
  const violations = results.filter(result => !result.valid).map(result => result.rule);
  return Object.freeze({
    valid: violations.length === 0,
    violations: Object.freeze(violations),
    results: Object.freeze(results)
  });
}
