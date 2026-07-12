import { LAYOUT_GRID } from "./config.js";
import { createGraphicPrimitives } from "./graphics.js";
import { alignedBoxY } from "./grid-layout.js";
import { createReplayRandomSource } from "./random.js";
import { make, rect, textNode } from "./svg.js";
import { tokenSizeAttrs, tokenTaxonomyAttrs, typographyToken } from "./token-model.js";
import { resolveTypographyStyle } from "./typography.js";

export function createGridRenderer({ typographyMeasurer, visualTokens }) {
  const { typographyBaselineY } = typographyMeasurer;

  function renderTypographyGridToken(token, position, item, resolvedStyle = null) {
    const fontSize = resolvedStyle?.fontSize ?? item.intrinsic.fontSize;
    const orientationMode = token.getAttribute("data-token-orientation") ||
      (position.rotation ? "whole-rotate" : "none");
    const isGlyphStack = orientationMode === "glyph-sideways-stack";
    const forceHeavyXlarge = token.getAttribute("data-token-force-heavy-xlarge") === "true" &&
      item.size === "xlarge";
    token.removeAttribute("data-token-fit-offset");
    token.setAttribute("data-token-intrinsic-font-size", fontSize);
    token.replaceChildren(textNode(position.x, isGlyphStack ? position.y : typographyBaselineY(position, item), item.value, {
      align: position.align,
      tokenSize: item.size,
      tokenFunction: item.function,
      tokenRole: item.role,
      tokenContext: "component",
      size: fontSize,
      typeface: item.typeface,
      fontWeightOverride: resolvedStyle?.fontWeight ?? (forceHeavyXlarge ? 900 : null),
      transform: !isGlyphStack && position.rotation ? `rotate(${position.rotation} ${position.x} ${position.y})` : "",
      writingMode: isGlyphStack ? "vertical-rl" : null,
      textOrientation: isGlyphStack ? "sideways" : null,
      dominantBaseline: isGlyphStack ? "central" : null
    }));
  }

  function applyTypographyGridSelection(token, position, selection) {
    const item = selection.tokenPlan;
    token.setAttribute("data-grid-token", item.role);
    token.setAttribute("data-grid-token-kind", selection.kind);
    token.setAttribute("data-token-placement", "position-only");
    token.setAttribute("data-token-scale", "1");
    token.setAttribute("data-token-rotation", position.rotation || 0);
    token.setAttribute("data-token-orientation", selection.orientationMode || (position.rotation ? "whole-rotate" : "none"));
    token.setAttribute("data-token-force-heavy-xlarge", String(Boolean(selection.forceHeavyXlarge)));
    token.setAttribute("data-token-requested-size", selection.requestedSize);
    token.setAttribute("data-token-size-fallback", String(selection.requestedSize !== item.size));
    renderTypographyGridToken(token, position, item, selection.resolvedTypographyStyle);
  }

  function renderTypographyGridTokenAtSize(token, position, size) {
    const text = token.querySelector(':scope > text[data-token-form="typography"]');
    if (!text) throw new Error("Cannot resize a grid token without typography content");
    const item = typographyToken(text.textContent, {
      typeface: text.getAttribute("data-token-typeface"),
      size,
      function: text.getAttribute("data-token-function"),
      role: text.getAttribute("data-token-role"),
      context: "component"
    });
    const resolvedStyle = resolveTypographyStyle({
      token: item,
      orientationMode: token.getAttribute("data-token-orientation") || "none",
      actualSize: size,
      forceHeavyXlarge: token.getAttribute("data-token-force-heavy-xlarge") === "true"
    });
    renderTypographyGridToken(token, position, item, resolvedStyle);
  }

  function intrinsicTokenBox(position, intrinsic) {
    const alignOffset = { left: 0, center: 0.5, right: 1 }[position.align];
    return {
      x: position.x - intrinsic.width * alignOffset,
      y: alignedBoxY(position, intrinsic.height),
      width: intrinsic.width,
      height: intrinsic.height
    };
  }

  function renderGraphicDescriptorAt(group, position, selection) {
    const item = selection.tokenPlan;
    const replay = createReplayRandomSource(selection.graphicRandomValues || []);
    const primitives = createGraphicPrimitives({ randomSource: replay, visualTokens });
    const box = intrinsicTokenBox(position, item.intrinsic);
    if (item.graphicType === "barcode") {
      primitives.barcode(group, box.x, box.y, box.width, box.height, { caption: true, tokenSize: item.size, tokenContext: "component" });
    } else if (item.graphicType === "table") {
      primitives.miniTable(group, box.x, box.y, box.width, { maxHeight: box.height, tokenSize: item.size, tokenContext: "component" });
    } else if (item.graphicType === "wave") {
      primitives.wave(group, box.x, box.y, box.width, box.height, { tokenSize: item.size, tokenContext: "component" });
    } else if (item.graphicType === "pseudo-qr") {
      primitives.pseudoQr(group, box.x, box.y, box.width, 15, { tokenSize: item.size, tokenContext: "component" });
    } else if (item.graphicType === "status-label") {
      primitives.label(group, box.x, box.y, box.width, "STATUS", true, { tokenSize: item.size, tokenFunction: "sign", tokenRole: "status-label", tokenContext: "component", align: "left" });
    } else if (item.graphicType === "metadata-badge") {
      primitives.microBadge(group, box.x, box.y, "REV A", { tokenSize: item.size, tokenContext: "component" });
    } else {
      throw new Error(`Unknown graphic type: ${item.graphicType}`);
    }
    replay.assertExhausted();
  }

  function renderGridBlockToken(group, position, selection) {
    const item = selection.tokenPlan;
    const token = make("g", {
      "data-grid-token": item.role,
      "data-grid-token-kind": selection.kind,
      "data-token-placement": "position-only",
      "data-token-scale": "1",
      "data-token-rotation": position.rotation || 0,
      "data-token-orientation": selection.orientationMode,
      "data-token-force-heavy-xlarge": String(selection.forceHeavyXlarge),
      "data-token-requested-size": selection.requestedSize,
      "data-token-size-fallback": String(selection.requestedSize !== item.size),
      ...(selection.kind === "graphic" ? tokenSizeAttrs(item.size) : {}),
      ...(selection.kind === "graphic" ? tokenTaxonomyAttrs({
        form: "graphic",
        tokenFunction: item.function,
        role: item.role,
        context: "component"
      }) : {})
    });
    if (selection.kind === "graphic") {
      token.setAttribute("data-token-intrinsic-width", item.intrinsic.width);
      token.setAttribute("data-token-intrinsic-height", item.intrinsic.height);
      renderGraphicDescriptorAt(token, position, selection);
    } else {
      renderTypographyGridToken(token, position, item, selection.resolvedTypographyStyle);
    }
    group.appendChild(token);
  }

  function renderGridPlan(gridPlan) {
    const root = make("g", {
      "data-layout-mode": "random-blocks",
      "data-grid-columns": LAYOUT_GRID.columns,
      "data-grid-rows": LAYOUT_GRID.rows
    });

    gridPlan.blocks.forEach(({ block, box, contentBox, position, selection }) => {
      const group = make("g", {
        "data-grid-block": block.id,
        "data-grid-footprint": `${block.width}x${block.height}`,
        "data-grid-block-area": block.area,
        "data-grid-origin": `${block.column}:${block.row}`,
        "data-grid-column": block.column,
        "data-grid-row": block.row,
        "data-grid-column-span": block.width,
        "data-grid-row-span": block.height,
        "data-grid-cells": block.cells.join(","),
        "data-grid-block-x": box.x,
        "data-grid-block-y": box.y,
        "data-grid-block-width": box.width,
        "data-grid-block-height": box.height,
        "data-grid-content-x": contentBox.x,
        "data-grid-content-y": contentBox.y,
        "data-grid-content-width": contentBox.width,
        "data-grid-content-height": contentBox.height,
        "data-grid-position-x": position.x,
        "data-grid-position-y": position.y,
        "data-grid-alignment": position.align,
        "data-grid-vertical-alignment": position.verticalAlign,
        "data-grid-token-rotation": position.rotation,
        "data-grid-block-empty": "false"
      });
      const outline = rect(box.x, box.y, box.width, box.height, { opacity: gridPlan.blockOutlinesVisible ? 0.18 : 0 });
      outline.setAttribute("data-grid-block-outline", block.id);
      group.appendChild(outline);
      renderGridBlockToken(group, position, selection);
      root.appendChild(group);
    });
    return root;
  }

  return { applyTypographyGridSelection, renderGridPlan, renderTypographyGridTokenAtSize };
}
