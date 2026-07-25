import { canonicalJson } from "./canonical-hash.js";
import {
  DESIGN_TOKEN_SIZE_ORDER,
  LAYOUT_GRID,
  TYPOGRAPHY_INTRINSIC_FONT_SIZES,
  deriveTypographyWeight
} from "./config.js";
import { validateCompositionPlan } from "./composition-plan-validator.js";
import { renderCompositionMotif } from "./graphics.js";
import { projectCompositionPlan } from "./grid-selection.js";
import { make, rect, textNode } from "./svg.js";
import { tokenSizeAttrs, tokenTaxonomyAttrs } from "./token-model.js";

function numberText(value) {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

function anchorPoint(contentBox, alignment, verticalAlignment) {
  return {
    x: alignment === "left"
      ? contentBox.x
      : alignment === "right"
        ? contentBox.x + contentBox.width
        : contentBox.x + contentBox.width / 2,
    y: verticalAlignment === "top"
      ? contentBox.y
      : verticalAlignment === "bottom"
        ? contentBox.y + contentBox.height
        : contentBox.y + contentBox.height / 2
  };
}

function intrinsicTopLeft(contentBox, alignment, verticalAlignment, intrinsic) {
  return {
    x: alignment === "left"
      ? contentBox.x
      : alignment === "right"
        ? contentBox.x + contentBox.width - intrinsic.width
        : contentBox.x + (contentBox.width - intrinsic.width) / 2,
    y: verticalAlignment === "top"
      ? contentBox.y
      : verticalAlignment === "bottom"
        ? contentBox.y + contentBox.height - intrinsic.height
        : contentBox.y + (contentBox.height - intrinsic.height) / 2
  };
}

function rootMetadata(plan, context) {
  const input = plan.generationInput;
  return {
    "data-component": `component ${input.ratio}`,
    "data-plan-id": plan.planId,
    "data-composition-schema": plan.schemaVersion,
    "data-composition-recipe": plan.recipeId,
    "data-coherence-mode": plan.coherenceMode,
    "data-generation-input-hash": plan.generationInputHash,
    "data-node-conformance-runtime": context.conformance.nodeRuntime,
    "data-browser-conformance-profile": context.conformance.browserProfile,
    "data-vocabulary-version": input.vocabularyVersion,
    "data-recipe-version": input.recipeVersion,
    "data-motif-version": input.motifVersion,
    "data-config-version": input.configVersion,
    "data-composition-engine-version": input.compositionEngineVersion,
    "data-font-metrics-version": input.fontMetricsVersion,
    "data-font-asset-revision": input.fontAssetRevision,
    "data-owner-snapshot-revision": input.ownerSnapshotRevision,
    "data-safe-box": canonicalJson(input.safeBox),
    "data-layout-grid": `${LAYOUT_GRID.columns}x${LAYOUT_GRID.rows}`
  };
}

function commonTokenMetadata(block, slot, candidate) {
  return {
    "data-grid-token": candidate.tokenRole || candidate.motifId,
    "data-grid-token-kind": candidate.sourceKind === "motif" ? "graphic" : "typography",
    "data-token-source-kind": candidate.sourceKind,
    "data-token-placement": "position-only",
    "data-token-scale": "1",
    "data-token-requested-size": block.requestedSize,
    "data-token-requested-weight": block.requestedWeight,
    "data-token-requested-font-weight": block.requestedFontWeight,
    "data-token-footprint": block.footprint,
    "data-token-orientation": block.orientationMode,
    "data-token-rotation": block.orientationMode === "whole-rotate" ? 90 : 0,
    "data-message-slot": slot.id,
    "data-composition-role": slot.compositionRole,
    "data-visual-prominence": slot.prominence,
    "data-candidate-id": slot.candidateId,
    "data-fallback-tier": 0
  };
}

function blockMetadata(block, geometry) {
  const { outerBox, contentBox } = geometry;
  return {
    "data-grid-block": block.id,
    "data-grid-footprint": block.footprint,
    "data-grid-block-area": block.cells.length,
    "data-grid-origin": `${geometry.block.column}:${geometry.block.row}`,
    "data-grid-column": geometry.block.column,
    "data-grid-row": geometry.block.row,
    "data-grid-column-span": geometry.block.width,
    "data-grid-row-span": geometry.block.height,
    "data-grid-cells": block.cells.join(","),
    "data-grid-block-x": numberText(outerBox.x),
    "data-grid-block-y": numberText(outerBox.y),
    "data-grid-block-width": numberText(outerBox.width),
    "data-grid-block-height": numberText(outerBox.height),
    "data-grid-content-x": numberText(contentBox.x),
    "data-grid-content-y": numberText(contentBox.y),
    "data-grid-content-width": numberText(contentBox.width),
    "data-grid-content-height": numberText(contentBox.height),
    "data-grid-alignment": block.alignment,
    "data-grid-vertical-alignment": block.verticalAlignment,
    "data-grid-token-rotation": block.orientationMode === "whole-rotate" ? 90 : 0,
    "data-slot-instance": block.slotInstanceId,
    "data-grid-block-empty": "false"
  };
}

export function createGridRenderer() {
  function setTokenNudge(token, x = 0, y = 0) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("token nudge must be finite");
    const base = token.getAttribute("data-token-base-transform") || "";
    token.setAttribute("data-token-nudge-x", numberText(x));
    token.setAttribute("data-token-nudge-y", numberText(y));
    token.setAttribute("transform", `translate(${numberText(x)} ${numberText(y)}) ${base}`.trim());
  }

  function renderTypographyAtSize(token, size) {
    if (!DESIGN_TOKEN_SIZE_ORDER.includes(size)) throw new Error(`unsupported mounted size ${size}`);
    const text = token.getAttribute("data-visible-text");
    const typeface = token.getAttribute("data-token-typeface");
    const tokenFunction = token.getAttribute("data-token-function");
    const tokenRole = token.getAttribute("data-token-role");
    const compositionRole = token.getAttribute("data-composition-role");
    const footprint = token.getAttribute("data-token-footprint");
    const orientationMode = token.getAttribute("data-token-orientation");
    const alignment = token.getAttribute("data-token-alignment");
    const verticalAlignment = token.getAttribute("data-token-vertical-alignment");
    if (!text || !typeface || !footprint) throw new Error("typography render metadata is incomplete");
    const { tokenWeight, fontWeight } = deriveTypographyWeight({
      tokenFunction,
      compositionRole,
      size,
      footprint
    });
    const fontSize = TYPOGRAPHY_INTRINSIC_FONT_SIZES[size];
    const baseline = verticalAlignment === "top"
      ? fontSize * 0.82
      : verticalAlignment === "bottom"
        ? -fontSize * 0.18
        : fontSize * 0.32;
    const glyphStack = orientationMode === "glyph-sideways-stack";
    const node = textNode(0, glyphStack ? 0 : baseline, text, {
      size: fontSize,
      tokenSize: size,
      tokenFunction,
      tokenRole,
      tokenContext: "component",
      typeface,
      align: alignment,
      fontWeightOverride: fontWeight,
      writingMode: glyphStack ? "vertical-rl" : null,
      textOrientation: glyphStack ? "sideways" : null,
      dominantBaseline: glyphStack ? "central" : null
    });
    node.setAttribute("data-token-weight", tokenWeight);
    node.setAttribute("data-message-slot", token.getAttribute("data-message-slot"));
    node.setAttribute("data-lexical-use", token.getAttribute("data-lexical-use"));
    token.replaceChildren(node);
    Object.entries(tokenSizeAttrs(size)).forEach(([key, value]) => token.setAttribute(key, value));
    token.setAttribute("data-token-weight", tokenWeight);
    token.setAttribute("data-token-actual-size", size);
    token.setAttribute("data-token-actual-font-weight", String(fontWeight));
    token.setAttribute("data-token-size-fallback", String(size !== token.getAttribute("data-token-requested-size")));
    setTokenNudge(token, 0, 0);
    return Object.freeze({ size, tokenWeight, fontWeight });
  }

  function renderLexicalToken(block, slot, candidate, geometry) {
    const anchor = anchorPoint(geometry.contentBox, block.alignment, block.verticalAlignment);
    const rotation = block.orientationMode === "whole-rotate" ? " rotate(90)" : "";
    const baseTransform = `translate(${numberText(anchor.x)} ${numberText(anchor.y)})${rotation}`;
    const token = make("g", {
      ...commonTokenMetadata(block, slot, candidate),
      ...tokenTaxonomyAttrs({
        form: "typography",
        tokenFunction: candidate.tokenFunction,
        role: candidate.tokenRole,
        typeface: candidate.typeface,
        context: "component"
      }),
      "data-lexical-use": slot.lexicalUseId,
      "data-translation-set": slot.translationSetId,
      "data-instance-key": slot.instanceKey,
      "data-phrase-pack": slot.phrasePackId,
      "data-visible-text": candidate.visibleText,
      "data-token-alignment": block.alignment,
      "data-token-vertical-alignment": block.verticalAlignment,
      "data-token-base-transform": baseTransform,
      "data-token-nudge-x": 0,
      "data-token-nudge-y": 0,
      transform: baseTransform
    });
    renderTypographyAtSize(token, block.requestedSize);
    return token;
  }

  function renderMotifToken(block, slot, candidate, geometry) {
    const position = intrinsicTopLeft(
      geometry.contentBox,
      block.alignment,
      block.verticalAlignment,
      candidate.intrinsicBounds
    );
    const baseTransform = `translate(${numberText(position.x)} ${numberText(position.y)})`;
    const token = make("g", {
      ...commonTokenMetadata(block, slot, candidate),
      ...tokenSizeAttrs(block.requestedSize),
      ...tokenTaxonomyAttrs({
        form: "graphic",
        tokenFunction: "data",
        role: candidate.motifId.replace(/^motif\./, ""),
        context: "component"
      }),
      "data-motif-id": slot.motifId,
      "data-motif-candidate": slot.candidateId,
      "data-materialization-key": slot.materializationKey,
      "data-render-params-hash": slot.renderParamsHash,
      "data-occupancy-safety-factor": slot.occupancySafetyFactor,
      "data-occupancy-calibration-revision": slot.occupancyCalibrationRevision,
      "data-motif-factual": "false",
      "data-token-intrinsic-width": candidate.intrinsicBounds.width,
      "data-token-intrinsic-height": candidate.intrinsicBounds.height,
      "data-token-base-transform": baseTransform,
      "data-token-nudge-x": 0,
      "data-token-nudge-y": 0,
      "data-token-actual-size": block.requestedSize,
      transform: baseTransform
    });
    renderCompositionMotif(token, candidate.intrinsicBounds, slot.renderParams);
    return token;
  }

  function renderCompositionPlan(plan, context, options) {
    validateCompositionPlan(plan, context);
    const projection = projectCompositionPlan(plan, context);
    const width = options.width;
    const height = options.height;
    if (![options.x, options.y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
      throw new Error("composition component box is invalid");
    }
    const component = make("svg", {
      x: numberText(options.x),
      y: numberText(options.y),
      width: numberText(options.displayWidth ?? width),
      height: numberText(options.displayHeight ?? height),
      viewBox: `0 0 ${numberText(width)} ${numberText(height)}`,
      overflow: "hidden",
      ...rootMetadata(plan, context)
    });
    const layout = make("g", {
      "data-layout-mode": "composition-blocks",
      "data-grid-columns": LAYOUT_GRID.columns,
      "data-grid-rows": LAYOUT_GRID.rows
    });
    for (const record of projection.blocks) {
      const group = make("g", blockMetadata(record.block, record.geometry));
      const outline = rect(
        record.geometry.outerBox.x,
        record.geometry.outerBox.y,
        record.geometry.outerBox.width,
        record.geometry.outerBox.height,
        { opacity: options.blockOutlinesVisible ? 0.18 : 0 }
      );
      outline.setAttribute("data-grid-block-outline", record.block.id);
      outline.setAttribute("data-structural-exclude", "grid-overlay");
      group.appendChild(outline);
      group.appendChild(record.candidate.sourceKind === "lexical"
        ? renderLexicalToken(record.block, record.slot, record.candidate, record.geometry)
        : renderMotifToken(record.block, record.slot, record.candidate, record.geometry));
      layout.appendChild(group);
    }
    component.appendChild(layout);
    if (options.borderNode) component.appendChild(options.borderNode);
    return component;
  }

  return {
    renderCompositionPlan,
    renderTypographyAtSize,
    setTokenNudge
  };
}
