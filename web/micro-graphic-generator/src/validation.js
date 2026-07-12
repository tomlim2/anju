import {
  ACTIVE_STROKE_WEIGHTS,
  ALLOW_EMPTY_GRID_BLOCKS,
  DESIGN_TOKEN_SIZE_ORDER,
  GRAPHIC_TOKEN_SIZES,
  GRID_BLOCK_POLICY_BY_FOOTPRINT,
  LAYOUT_GRID,
  MAJOR_TOKEN_RULES,
  STROKE_WEIGHTS,
  TOKEN_ALIGNMENTS,
  TOKEN_ORIENTATIONS,
  TOKEN_VERTICAL_ALIGNMENTS,
  TYPOGRAPHY_INTRINSIC_FONT_SIZES,
  UNIQUE_GRID_TOKEN_ROLES
} from "./config.js";
import {
  blockHorizontalAlignment,
  blockVerticalAlignment,
  gridBlockCells,
  gridTokenFits,
  uniformTypographyGroupKey
} from "./grid-layout.js";
import { typographyWordKey } from "./token-model.js";
import { resolveTypographyStyle } from "./typography.js";

function nodeReference(node, index = 0) {
  return node?.getAttribute?.("data-grid-block") ||
    node?.getAttribute?.("data-grid-token") ||
    node?.getAttribute?.("data-token-role") ||
    `${node?.tagName?.toLowerCase?.() || "node"}:${index}`;
}

function invalidNodesResult(rule, nodes, detail) {
  return {
    rule,
    valid: nodes.length === 0,
    nodes: nodes.map(nodeReference),
    detail: nodes.length ? detail(nodes) : ""
  };
}

function conditionResult(rule, valid, nodes, detail) {
  return {
    rule,
    valid,
    nodes: valid ? [] : nodes,
    detail: valid ? "" : detail
  };
}

function directGridTokens(block) {
  return [...block.children].filter(child => child.hasAttribute("data-grid-token"));
}

function blockContentBox(block) {
  return {
    x: Number(block.getAttribute("data-grid-content-x")),
    y: Number(block.getAttribute("data-grid-content-y")),
    width: Number(block.getAttribute("data-grid-content-width")),
    height: Number(block.getAttribute("data-grid-content-height"))
  };
}

function renderedTokenBox(token) {
  try {
    const bounds = token.getBBox();
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  } catch {
    return null;
  }
}

function typographyStyleForNode(node) {
  const token = node.closest("[data-grid-token]");
  const size = node.getAttribute("data-token-size");
  return resolveTypographyStyle({
    token: {
      value: node.textContent || "",
      size,
      function: node.getAttribute("data-token-function"),
      typeface: node.getAttribute("data-token-typeface")
    },
    orientationMode: token?.getAttribute("data-token-orientation") || "none",
    actualSize: size,
    forceHeavyXlarge: token?.getAttribute("data-token-force-heavy-xlarge") === "true"
  });
}

function createValidationContext(art) {
  const component = art.querySelector("svg[data-component]");
  const gridBlocks = component ? [...component.querySelectorAll("[data-grid-block]")] : [];
  return {
    art,
    classified: [...art.querySelectorAll("[data-token-form]")],
    component,
    layout: component?.querySelector('[data-layout-mode="random-blocks"]') || null,
    gridBlocks,
    allBlockCells: gridBlocks.flatMap(block =>
      (block.getAttribute("data-grid-cells") || "").split(",").filter(Boolean).map(Number)
    )
  };
}

function validateTaxonomy({ art }) {
  const nodes = [...art.querySelectorAll("[data-token-size]")]
    .filter(node => !node.hasAttribute("data-token-form"));
  return invalidNodesResult(
    "taxonomy.classified",
    nodes,
    failures => `${failures.length} sized token nodes have no token form`
  );
}

function validateTypeface({ classified }) {
  const nodes = classified.filter(node =>
    node.getAttribute("data-token-form") === "typography" &&
    !node.hasAttribute("data-token-typeface")
  );
  return invalidNodesResult(
    "typography.typeface",
    nodes,
    failures => `${failures.length} typography nodes have no typeface role`
  );
}

function validateWeight({ classified }) {
  const nodes = classified.filter(node => {
    if (node.getAttribute("data-token-form") !== "typography") return false;
    const expected = typographyStyleForNode(node);
    return node.getAttribute("data-token-weight") !== expected.tokenWeight ||
      node.getAttribute("font-weight") !== String(expected.fontWeight);
  });
  return invalidNodesResult(
    "typography.weight",
    nodes,
    failures => `${failures.length} typography nodes differ from resolveTypographyStyle()`
  );
}

function validateLineHeight({ art }) {
  const nodes = [...art.querySelectorAll("text")].filter(node => {
    if (node.getAttribute("data-token-form") !== "typography") {
      return node.getAttribute("line-height") !== "1";
    }
    return node.getAttribute("line-height") !== String(typographyStyleForNode(node).lineHeight);
  });
  return invalidNodesResult(
    "typography.line-height",
    nodes,
    failures => `${failures.length} text nodes differ from the resolved line height`
  );
}

function validateStroke({ art }) {
  const nodes = [...art.querySelectorAll('[stroke]:not([stroke="none"])')].filter(node => {
    const weight = node.getAttribute("data-stroke-weight");
    return !ACTIVE_STROKE_WEIGHTS.includes(weight) ||
      node.getAttribute("stroke-width") !== String(STROKE_WEIGHTS[weight]);
  });
  return invalidNodesResult(
    "stroke.active-weight",
    nodes,
    failures => `${failures.length} stroked nodes use an inactive or mismatched weight`
  );
}

function validateGridStructure({ component, layout, gridBlocks }) {
  if (!component) return conditionResult("grid.structure", true, [], "");
  const primaryCount = component.querySelectorAll('[data-grid-token-kind="primary"]').length;
  const valid = component.getAttribute("data-layout-grid") === `${LAYOUT_GRID.columns}x${LAYOUT_GRID.rows}` &&
    Boolean(layout) &&
    gridBlocks.length >= 2 &&
    gridBlocks.length <= 5 &&
    primaryCount <= 1;
  return conditionResult(
    "grid.structure",
    valid,
    ["component"],
    `Expected a ${LAYOUT_GRID.columns}x${LAYOUT_GRID.rows} layout with 2-5 blocks and at most one primary token`
  );
}

function validateBlockTokenCount({ component, gridBlocks }) {
  if (!component) return conditionResult("grid.block-token-count", true, [], "");
  const nodes = gridBlocks.filter(block => directGridTokens(block).length !== 1);
  return invalidNodesResult(
    "grid.block-token-count",
    nodes,
    failures => `${failures.length} blocks do not contain exactly one direct token`
  );
}

function validateBlockEmptyState({ component, gridBlocks }) {
  if (!component) return conditionResult("grid.block-empty-state", true, [], "");
  const nodes = gridBlocks.filter(block =>
    block.getAttribute("data-grid-block-empty") !== String(directGridTokens(block).length === 0)
  );
  return invalidNodesResult(
    "grid.block-empty-state",
    nodes,
    failures => `${failures.length} blocks have stale empty-state metadata`
  );
}

function validateBlockPosition({ component, gridBlocks }) {
  if (!component) return conditionResult("grid.block-position", true, [], "");
  const numericAttributes = [
    "data-grid-position-x",
    "data-grid-position-y",
    "data-grid-content-x",
    "data-grid-content-y",
    "data-grid-content-width",
    "data-grid-content-height"
  ];
  const nodes = gridBlocks.filter(block =>
    numericAttributes.some(attribute => !Number.isFinite(Number(block.getAttribute(attribute)))) ||
    !TOKEN_ALIGNMENTS.includes(block.getAttribute("data-grid-alignment")) ||
    !TOKEN_VERTICAL_ALIGNMENTS.includes(block.getAttribute("data-grid-vertical-alignment"))
  );
  return invalidNodesResult(
    "grid.block-position",
    nodes,
    failures => `${failures.length} blocks have invalid position or alignment metadata`
  );
}

function validateBlockFootprint({ component, gridBlocks }) {
  if (!component) return conditionResult("grid.block-footprint", true, [], "");
  const nodes = gridBlocks.filter(block => {
    const column = Number(block.getAttribute("data-grid-column"));
    const row = Number(block.getAttribute("data-grid-row"));
    const width = Number(block.getAttribute("data-grid-column-span"));
    const height = Number(block.getAttribute("data-grid-row-span"));
    const footprint = `${width}x${height}`;
    const policy = GRID_BLOCK_POLICY_BY_FOOTPRINT.get(footprint);
    const expectedBlock = { column, row, width, height };
    const expectedAlign = policy?.align === "center" ? "center" : blockHorizontalAlignment(expectedBlock);
    const expectedVerticalAlign = policy?.verticalAlign === "middle" ? "middle" : blockVerticalAlignment(expectedBlock);
    return !policy ||
      block.getAttribute("data-grid-footprint") !== footprint ||
      block.getAttribute("data-grid-block-area") !== String(width * height) ||
      block.getAttribute("data-grid-origin") !== `${column}:${row}` ||
      column < 0 || row < 0 ||
      column + width > LAYOUT_GRID.columns ||
      row + height > LAYOUT_GRID.rows ||
      block.getAttribute("data-grid-cells") !== gridBlockCells(expectedBlock).join(",") ||
      block.getAttribute("data-grid-alignment") !== expectedAlign ||
      block.getAttribute("data-grid-vertical-alignment") !== expectedVerticalAlign ||
      block.getAttribute("data-grid-token-rotation") !== String(policy.rotation) ||
      block.querySelectorAll(":scope > [data-grid-block-outline]").length !== 1;
  });
  return invalidNodesResult(
    "grid.block-footprint",
    nodes,
    failures => `${failures.length} blocks differ from their ordered footprint policy`
  );
}

function validateMaximumTokenPolicy({ component, gridBlocks }) {
  if (!component) return conditionResult("grid.maximum-token-policy", true, [], "");
  const nodes = gridBlocks.filter(block => {
    const policy = GRID_BLOCK_POLICY_BY_FOOTPRINT.get(block.getAttribute("data-grid-footprint"));
    if (policy?.candidatePolicy !== "maximum-typography") return false;
    if (ALLOW_EMPTY_GRID_BLOCKS && block.getAttribute("data-grid-block-empty") === "true") return false;
    const token = block.querySelector(":scope > [data-grid-token]");
    const typography = token?.querySelector(':scope > text[data-token-form="typography"]');
    return block.getAttribute("data-grid-alignment") !== policy.align ||
      block.getAttribute("data-grid-vertical-alignment") !== policy.verticalAlign ||
      !token ||
      token.getAttribute("data-grid-token-kind") !== "block-xxxlarge" ||
      !typography ||
      token.getAttribute("data-token-requested-size") !== policy.requestedSizes[0];
  });
  return invalidNodesResult(
    "grid.maximum-token-policy",
    nodes,
    failures => `${failures.length} maximum blocks differ from their typography policy`
  );
}

function validateCenteredTokenPolicy({ component, gridBlocks }) {
  if (!component) return conditionResult("grid.centered-token-policy", true, [], "");
  const nodes = gridBlocks.filter(block => {
    const policy = GRID_BLOCK_POLICY_BY_FOOTPRINT.get(block.getAttribute("data-grid-footprint"));
    if (policy?.candidatePolicy !== "centered-hero") return false;
    if (ALLOW_EMPTY_GRID_BLOCKS && block.getAttribute("data-grid-block-empty") === "true") return false;
    const token = block.querySelector(":scope > [data-grid-token]");
    const typography = token?.querySelector(':scope > text[data-token-form="typography"]');
    const orientationMode = token?.getAttribute("data-token-orientation");
    const isGlyphStack = orientationMode === "glyph-sideways-stack";
    const validOrientation = policy.orientationModes.includes(orientationMode);
    const invalidGlyphStack = isGlyphStack && (
      /[A-Za-z]/.test(typography?.textContent || "") ||
      typography?.getAttribute("writing-mode") !== "vertical-rl" ||
      typography?.getAttribute("text-orientation") !== "sideways" ||
      typography?.getAttribute("dominant-baseline") !== "central" ||
      Boolean(typography?.getAttribute("transform"))
    );
    return block.getAttribute("data-grid-alignment") !== policy.align ||
      block.getAttribute("data-grid-vertical-alignment") !== policy.verticalAlign ||
      block.getAttribute("data-grid-token-rotation") !== String(policy.rotation) ||
      !token ||
      token.getAttribute("data-grid-token-kind") !== "block-xxlarge" ||
      token.getAttribute("data-token-rotation") !== String(policy.rotation) ||
      !validOrientation ||
      !typography ||
      token.getAttribute("data-token-requested-size") !== policy.requestedSizes[0] ||
      invalidGlyphStack ||
      (policy.rotation === 90 && orientationMode === "whole-rotate" &&
        !(typography.getAttribute("transform") || "").startsWith("rotate(90 "));
  });
  return invalidNodesResult(
    "grid.centered-token-policy",
    nodes,
    failures => `${failures.length} centered hero blocks differ from their typography policy`
  );
}

function validateSquareTokenPolicy({ component, gridBlocks }) {
  if (!component) return conditionResult("grid.square-token-policy", true, [], "");
  const nodes = gridBlocks.filter(block => {
    const policy = GRID_BLOCK_POLICY_BY_FOOTPRINT.get(block.getAttribute("data-grid-footprint"));
    if (policy?.candidatePolicy !== "oversized-typography") return false;
    if (ALLOW_EMPTY_GRID_BLOCKS && block.getAttribute("data-grid-block-empty") === "true") return false;
    const token = block.querySelector(":scope > [data-grid-token]");
    const typography = token?.querySelector(':scope > text[data-token-form="typography"]');
    return !token ||
      token.getAttribute("data-grid-token-kind") !== "block-2x2-oversized" ||
      !typography ||
      !policy.requestedSizes.includes(token.getAttribute("data-token-requested-size"));
  });
  return invalidNodesResult(
    "grid.square-token-policy",
    nodes,
    failures => `${failures.length} square blocks differ from their oversized typography policy`
  );
}

function validateSizeFallback({ component }) {
  if (!component) return conditionResult("grid.size-fallback", true, [], "");
  const nodes = [...component.querySelectorAll("[data-grid-token]")].filter(token => {
    const requestedSize = token.getAttribute("data-token-requested-size");
    const kind = token.getAttribute("data-grid-token-kind");
    const sizedElement = kind === "graphic"
      ? token
      : token.querySelector(':scope > text[data-token-form="typography"]');
    const actualSize = sizedElement?.getAttribute("data-token-size");
    const requestedIndex = DESIGN_TOKEN_SIZE_ORDER.indexOf(requestedSize);
    const actualIndex = DESIGN_TOKEN_SIZE_ORDER.indexOf(actualSize);
    return requestedIndex < 0 ||
      actualIndex < 0 ||
      actualIndex > requestedIndex ||
      token.getAttribute("data-token-size-fallback") !== String(requestedSize !== actualSize);
  });
  return invalidNodesResult(
    "grid.size-fallback",
    nodes,
    failures => `${failures.length} tokens violate monotonic size fallback metadata`
  );
}

function validatePositionOnly({ component }) {
  if (!component) return conditionResult("grid.position-only", true, [], "");
  const nodes = [...component.querySelectorAll("[data-grid-token]")].filter(token =>
    token.getAttribute("data-token-placement") !== "position-only" ||
    token.getAttribute("data-token-scale") !== "1" ||
    (token.getAttribute("transform") || "").includes("scale(")
  );
  return invalidNodesResult(
    "grid.position-only",
    nodes,
    failures => `${failures.length} tokens use scale or non-positional placement`
  );
}

function validateOrientation({ component }) {
  if (!component) return conditionResult("grid.orientation", true, [], "");
  const nodes = [...component.querySelectorAll('[data-grid-token]:not([data-grid-token-kind="graphic"])')].filter(token => {
    const orientationMode = token.getAttribute("data-token-orientation");
    const rotation = token.getAttribute("data-token-rotation");
    const text = token.querySelector(':scope > text[data-token-form="typography"]');
    if (!TOKEN_ORIENTATIONS.includes(orientationMode) || !text) return true;
    if (orientationMode === "none") return rotation !== "0";
    if (orientationMode === "whole-rotate") return rotation !== "90";
    return rotation !== "90" || /[A-Za-z]/.test(text.textContent || "");
  });
  return invalidNodesResult(
    "grid.orientation",
    nodes,
    failures => `${failures.length} typography tokens use an invalid orientation`
  );
}

function validateContextualHeavy({ component, gridBlocks }) {
  if (!component) return conditionResult("grid.contextual-heavy", true, [], "");
  const nodes = gridBlocks.filter(block => {
    const token = block.querySelector(":scope > [data-grid-token]");
    if (!token) return false;
    const policy = GRID_BLOCK_POLICY_BY_FOOTPRINT.get(block.getAttribute("data-grid-footprint"));
    const expectsHeavyXlarge = policy?.xlargeWeight === 900 &&
      token.getAttribute("data-grid-token-kind") !== "graphic";
    return token.getAttribute("data-token-force-heavy-xlarge") !== String(expectsHeavyXlarge);
  });
  return invalidNodesResult(
    "grid.contextual-heavy",
    nodes,
    failures => `${failures.length} blocks have incorrect contextual xlarge weight metadata`
  );
}

function validateUniformSize({ component, gridBlocks }) {
  if (!component) return conditionResult("grid.uniform-size", true, [], "");
  const groups = new Map();
  const nodes = [];
  gridBlocks.forEach(block => {
    const policy = GRID_BLOCK_POLICY_BY_FOOTPRINT.get(block.getAttribute("data-grid-footprint"));
    if (!policy?.sizeSyncScope) return;
    const token = block.querySelector(':scope > [data-grid-token]:not([data-grid-token-kind="graphic"])');
    const text = token?.querySelector(':scope > text[data-token-form="typography"]');
    const key = uniformTypographyGroupKey(
      block.getAttribute("data-grid-footprint"),
      token?.getAttribute("data-token-requested-size")
    );
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ block, token, text });
    if (!token || !text || token.getAttribute("data-token-uniform-size") !== text.getAttribute("data-token-size")) {
      nodes.push(block);
    }
  });
  groups.forEach(entries => {
    if (new Set(entries.map(({ text }) => text?.getAttribute("data-token-size")).filter(Boolean)).size > 1) {
      entries.forEach(({ block }) => nodes.push(block));
    }
  });
  return invalidNodesResult(
    "grid.uniform-size",
    [...new Set(nodes)],
    failures => `${failures.length} blocks disagree with their footprint-specific size group`
  );
}

function validateTypographyFit({ component, gridBlocks }) {
  if (!component) return conditionResult("grid.typography-fit", true, [], "");
  const nodes = gridBlocks.filter(block => {
    const token = block.querySelector(':scope > [data-grid-token]:not([data-grid-token-kind="graphic"])');
    if (!token) return false;
    const bounds = renderedTokenBox(token);
    return token.getAttribute("data-token-fit") !== "true" ||
      !bounds ||
      !gridTokenFits(bounds, blockContentBox(block));
  });
  return invalidNodesResult(
    "grid.typography-fit",
    nodes,
    failures => `${failures.length} typography tokens extend outside their content box`
  );
}

function validateIntrinsicSize({ component }) {
  if (!component) return conditionResult("grid.intrinsic-size", true, [], "");
  const nodes = [...component.querySelectorAll('[data-grid-token]:not([data-grid-token-kind="graphic"])')].filter(token => {
    const text = token.querySelector(":scope > text");
    const expectedSize = TYPOGRAPHY_INTRINSIC_FONT_SIZES[text?.getAttribute("data-token-size")];
    return !text ||
      token.getAttribute("data-token-intrinsic-font-size") !== String(expectedSize) ||
      text.getAttribute("font-size") !== String(expectedSize);
  });
  return invalidNodesResult(
    "grid.intrinsic-size",
    nodes,
    failures => `${failures.length} tokens differ from the intrinsic typography size scale`
  );
}

function validateUniqueRole({ component }) {
  if (!component) return conditionResult("grid.unique-role", true, [], "");
  const roles = UNIQUE_GRID_TOKEN_ROLES.filter(role =>
    component.querySelectorAll(`[data-grid-token="${role}"]`).length > 1
  );
  return conditionResult(
    "grid.unique-role",
    roles.length === 0,
    roles,
    `Duplicate unique roles: ${roles.join(", ")}`
  );
}

function validateUniqueWord({ component }) {
  if (!component) return conditionResult("grid.unique-word", true, [], "");
  const seen = new Set();
  const nodes = [...component.querySelectorAll('[data-grid-token]:not([data-grid-token-kind="graphic"]) > text[data-token-form="typography"]')]
    .filter(node => {
      const key = typographyWordKey({ value: node.textContent });
      if (!key) return false;
      if (seen.has(key)) return true;
      seen.add(key);
      return false;
    });
  return invalidNodesResult(
    "grid.unique-word",
    nodes,
    failures => `${failures.length} typography words repeat within the component`
  );
}

function validateGraphicSize({ component }) {
  if (!component) return conditionResult("grid.graphic-size", true, [], "");
  const nodes = [...component.querySelectorAll('[data-grid-token-kind="graphic"]')].filter(token => {
    const size = token.getAttribute("data-token-size");
    const primitive = token.querySelector(':scope > [data-token-form="graphic"]');
    return !GRAPHIC_TOKEN_SIZES.includes(size) ||
      !primitive ||
      primitive.getAttribute("data-token-size") !== size;
  });
  return invalidNodesResult(
    "grid.graphic-size",
    nodes,
    failures => `${failures.length} graphic tokens use an invalid or mismatched size`
  );
}

function validateBarcodeCaption({ component }) {
  if (!component) return conditionResult("grid.barcode-caption", true, [], "");
  const expectedSize = "small";
  const expectedFontSize = String(TYPOGRAPHY_INTRINSIC_FONT_SIZES[expectedSize]);
  const nodes = [...component.querySelectorAll('[data-grid-token="barcode"]')].filter(token => {
    const captions = [...token.querySelectorAll('[data-token-role="barcode-caption"]')];
    return captions.length !== 4 || captions.some(caption =>
      caption.getAttribute("data-token-size") !== expectedSize ||
      caption.getAttribute("font-size") !== expectedFontSize
    );
  });
  return invalidNodesResult(
    "grid.barcode-caption",
    nodes,
    failures => `${failures.length} barcode tokens do not use four small 8px captions`
  );
}

function validateCoverage({ component, allBlockCells }) {
  if (!component) return conditionResult("grid.coverage", true, [], "");
  const cellCount = LAYOUT_GRID.columns * LAYOUT_GRID.rows;
  const valid = allBlockCells.length === cellCount &&
    new Set(allBlockCells).size === allBlockCells.length &&
    allBlockCells.every(cell => cell >= 1 && cell <= cellCount);
  return conditionResult(
    "grid.coverage",
    valid,
    ["component"],
    `Expected each of the ${cellCount} cells exactly once`
  );
}

function validateMajorCount({ component }) {
  if (!component) return conditionResult("typography.major-count", true, [], "");
  const majorStart = DESIGN_TOKEN_SIZE_ORDER.indexOf(MAJOR_TOKEN_RULES.minSize);
  const majorSizes = DESIGN_TOKEN_SIZE_ORDER.slice(majorStart);
  const nodes = [...component.querySelectorAll('text[data-token-form="typography"][data-token-context="component"]')]
    .filter(node => majorSizes.includes(node.getAttribute("data-token-size")))
    .filter(node =>
      !node.closest('[data-grid-token-kind="block-xxlarge"], [data-grid-token-kind="block-xxxlarge"], [data-grid-token-kind="block-2x2-oversized"]')
    );
  return conditionResult(
    "typography.major-count",
    nodes.length <= MAJOR_TOKEN_RULES.maxPerLayout,
    nodes.map(nodeReference),
    `Expected at most ${MAJOR_TOKEN_RULES.maxPerLayout} ordinary major token, found ${nodes.length}`
  );
}

export const VALIDATION_RULES = Object.freeze([
  validateTaxonomy,
  validateTypeface,
  validateWeight,
  validateLineHeight,
  validateStroke,
  validateGridStructure,
  validateBlockTokenCount,
  validateBlockEmptyState,
  validateBlockPosition,
  validateBlockFootprint,
  validateMaximumTokenPolicy,
  validateCenteredTokenPolicy,
  validateSquareTokenPolicy,
  validateSizeFallback,
  validatePositionOnly,
  validateOrientation,
  validateContextualHeavy,
  validateUniformSize,
  validateTypographyFit,
  validateIntrinsicSize,
  validateUniqueRole,
  validateUniqueWord,
  validateGraphicSize,
  validateBarcodeCaption,
  validateCoverage,
  validateMajorCount
]);

export function validateRenderedTokenRules(art) {
  const context = createValidationContext(art);
  const results = VALIDATION_RULES.map(validate => validate(context));
  const violations = results.filter(result => !result.valid).map(result => result.rule);
  return {
    valid: violations.length === 0,
    violations,
    results
  };
}
