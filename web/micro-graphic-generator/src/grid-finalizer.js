import {
  DESIGN_TOKEN_SIZE_ORDER,
  UNIFORM_TYPOGRAPHY_SIZE_FOOTPRINTS
} from "./config.js";
import { gridTokenFits, uniformTypographyGroupKey } from "./grid-layout.js";

export function gridBlockContentBoxFromNode(block) {
  return {
    x: Number(block.getAttribute("data-grid-content-x")),
    y: Number(block.getAttribute("data-grid-content-y")),
    width: Number(block.getAttribute("data-grid-content-width")),
    height: Number(block.getAttribute("data-grid-content-height"))
  };
}

export function gridBlockPositionFromNode(block) {
  return {
    x: Number(block.getAttribute("data-grid-position-x")),
    y: Number(block.getAttribute("data-grid-position-y")),
    align: block.getAttribute("data-grid-alignment"),
    verticalAlign: block.getAttribute("data-grid-vertical-alignment"),
    rotation: Number(block.getAttribute("data-grid-token-rotation"))
  };
}

export function renderedTokenBox(token) {
  try {
    const bounds = token.getBBox();
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  } catch {
    return null;
  }
}

function nudgeRenderedTokenIntoBox(token, bounds, availableBox) {
  const text = token.querySelector(':scope > text[data-token-form="typography"]');
  if (!text || !bounds || bounds.width > availableBox.width || bounds.height > availableBox.height) {
    return bounds;
  }
  let dx = 0;
  let dy = 0;
  if (bounds.x < availableBox.x) dx = availableBox.x - bounds.x;
  if (bounds.x + bounds.width > availableBox.x + availableBox.width) {
    dx = availableBox.x + availableBox.width - bounds.x - bounds.width;
  }
  if (bounds.y < availableBox.y) dy = availableBox.y - bounds.y;
  if (bounds.y + bounds.height > availableBox.y + availableBox.height) {
    dy = availableBox.y + availableBox.height - bounds.y - bounds.height;
  }
  if (!dx && !dy) return bounds;
  text.setAttribute("x", Number(text.getAttribute("x")) + dx);
  text.setAttribute("y", Number(text.getAttribute("y")) + dy);
  token.setAttribute("data-token-fit-offset", `${dx.toFixed(3)},${dy.toFixed(3)}`);
  return renderedTokenBox(token);
}

export function createGridFinalizer({ applyTypographyGridSelection, renderTypographyGridTokenAtSize }) {
  function correctRenderedGridTokenOverflows(component, fallbackByBlockId) {
    component.querySelectorAll("[data-grid-block]").forEach(block => {
      const token = block.querySelector(':scope > [data-grid-token]:not([data-grid-token-kind="graphic"])');
      let text = token?.querySelector(':scope > text[data-token-form="typography"]');
      if (!token || !text) return;

      const availableBox = gridBlockContentBoxFromNode(block);
      const position = gridBlockPositionFromNode(block);
      const requestedSize = token.getAttribute("data-token-requested-size");
      let sizeIndex = DESIGN_TOKEN_SIZE_ORDER.indexOf(text.getAttribute("data-token-size"));
      let bounds = renderedTokenBox(token);

      while (bounds && !gridTokenFits(bounds, availableBox) && sizeIndex > 0) {
        sizeIndex -= 1;
        const actualSize = DESIGN_TOKEN_SIZE_ORDER[sizeIndex];
        renderTypographyGridTokenAtSize(token, position, actualSize);
        token.setAttribute("data-token-size-fallback", String(requestedSize !== actualSize));
        text = token.querySelector(':scope > text[data-token-form="typography"]');
        bounds = renderedTokenBox(token);
      }

      bounds = nudgeRenderedTokenIntoBox(token, bounds, availableBox);
      const fits = Boolean(bounds && gridTokenFits(bounds, availableBox));
      if (!fits) {
        const fallbackTokenPlan = fallbackByBlockId.get(block.getAttribute("data-grid-block"));
        if (!fallbackTokenPlan) throw new Error("Missing deterministic fallback token plan");
        applyTypographyGridSelection(token, position, fallbackTokenPlan);
        bounds = renderedTokenBox(token);
        bounds = nudgeRenderedTokenIntoBox(token, bounds, availableBox);
      }
      block.setAttribute("data-grid-block-empty", "false");
      token.setAttribute("data-token-fit", String(Boolean(bounds && gridTokenFits(bounds, availableBox))));
    });
  }

  function synchronizeRenderedGridTypographySizes(component) {
    const groups = new Map();
    component.querySelectorAll("[data-grid-block]").forEach(block => {
      const footprint = block.getAttribute("data-grid-footprint");
      if (!UNIFORM_TYPOGRAPHY_SIZE_FOOTPRINTS.has(footprint)) return;
      const token = block.querySelector(':scope > [data-grid-token]:not([data-grid-token-kind="graphic"])');
      const text = token?.querySelector(':scope > text[data-token-form="typography"]');
      if (!token || !text) return;
      const key = uniformTypographyGroupKey(footprint, token.getAttribute("data-token-requested-size"));
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ block, token, text });
    });

    let changed = false;
    groups.forEach(entries => {
      const validIndexes = entries
        .map(({ text }) => DESIGN_TOKEN_SIZE_ORDER.indexOf(text.getAttribute("data-token-size")))
        .filter(index => index >= 0);
      if (!validIndexes.length) return;
      const targetSize = DESIGN_TOKEN_SIZE_ORDER[Math.min(...validIndexes)];

      entries.forEach(({ block, token, text }) => {
        token.setAttribute("data-token-uniform-size", targetSize);
        if (text.getAttribute("data-token-size") === targetSize) return;
        renderTypographyGridTokenAtSize(token, gridBlockPositionFromNode(block), targetSize);
        token.setAttribute("data-token-size-fallback", String(token.getAttribute("data-token-requested-size") !== targetSize));
        changed = true;
      });
    });
    return changed;
  }

  function finalizeRenderedGridTypography(component, gridPlan) {
    if (!component || !gridPlan) return;
    const fallbackByBlockId = new Map(
      gridPlan.blocks.map(({ block, selection }) => [block.id, selection.fallbackTokenPlan])
    );
    for (let pass = 0; pass <= DESIGN_TOKEN_SIZE_ORDER.length; pass += 1) {
      correctRenderedGridTokenOverflows(component, fallbackByBlockId);
      if (!synchronizeRenderedGridTypographySizes(component)) break;
    }
    correctRenderedGridTokenOverflows(component, fallbackByBlockId);
  }

  return { finalizeRenderedGridTypography };
}
