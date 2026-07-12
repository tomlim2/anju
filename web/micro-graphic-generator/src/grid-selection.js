import {
  CONTEXTUAL_HEAVY_XLARGE_FOOTPRINTS,
  GRID_BLOCK_FOOTPRINTS,
  GRID_PRIMARY_CHANCE,
  UNIQUE_GRID_TOKEN_ROLES
} from "./config.js";
import {
  alignedBoxY,
  blockTypographyRotation,
  buildGridBlockLayout,
  gridBlockCells,
  gridTokenFits,
  isCenteredXxlargeFootprint,
  isOversizedSquareFootprint,
  isXxxlargeFootprint
} from "./grid-layout.js";
import { marginSize } from "./layout.js";
import {
  typographySizeFallbacks,
  typographyToken,
  typographyTokenAtSize,
  typographyWordKey
} from "./token-model.js";
import { hasHangul, hasHanja, resolveTypographyStyle } from "./typography.js";

export function createSelectionState() {
  return {
    usedUniqueTokenRoles: new Set(),
    usedTypographyWordKeys: new Set()
  };
}

export function createGridTokenPools(typographyItems, graphicItems) {
  return {
    primary: typographyItems.filter(item => item.function === "content" && ["large", "xlarge", "xxlarge"].includes(item.size)),
    xxlargeBlock: typographyItems.filter(item => item.size === "xxlarge"),
    xxxlargeBlock: typographyItems.filter(item => item.size === "xxxlarge"),
    content: typographyItems.filter(item => item.function === "content" && ["small", "medium"].includes(item.size)),
    data: typographyItems.filter(item => item.function === "data" && ["small", "medium"].includes(item.size)),
    sign: typographyItems.filter(item => item.function === "sign" && ["small", "medium"].includes(item.size)),
    graphic: graphicItems.filter(item => item.function === "data")
  };
}

export function createGridSelectionEngine({ randomSource, typographyMeasurer }) {
  const { random, pick, chance, shuffled } = randomSource;
  const { measuredTypographyBox, orientedTypographyDimensions } = typographyMeasurer;

  function intrinsicTokenBox(position, intrinsic) {
    const alignOffset = { left: 0, center: 0.5, right: 1 }[position.align];
    return {
      x: position.x - intrinsic.width * alignOffset,
      y: alignedBoxY(position, intrinsic.height),
      width: intrinsic.width,
      height: intrinsic.height
    };
  }

  function gridTokenIntrinsicBox(position, item) {
    if (item.intrinsic.width && item.intrinsic.height) {
      return intrinsicTokenBox(position, item.intrinsic);
    }
    return measuredTypographyBox(position, item);
  }

  function fittingGridTokenItem(item, position, availableBox) {
    const variants = item.form === "typography"
      ? typographySizeFallbacks(item.size).map(size => typographyTokenAtSize(item, size))
      : [item];
    for (const variant of variants) {
      const bounds = gridTokenIntrinsicBox(position, variant);
      if (gridTokenFits(bounds, availableBox)) {
        return { item: variant, bounds, requestedSize: item.size };
      }
    }
    return null;
  }

  function footprintSupportsRequiredTypography(box, footprint, pools) {
    const items = isXxxlargeFootprint(footprint)
      ? pools.xxxlargeBlock
      : isCenteredXxlargeFootprint(footprint)
        ? pools.xxlargeBlock
        : isOversizedSquareFootprint(footprint)
          ? [...pools.xxlargeBlock, ...pools.xxxlargeBlock]
          : null;
    if (!items) return true;
    const blockWidth = box.width * footprint.width / 3;
    const blockHeight = box.height * footprint.height / 3;
    const inset = isOversizedSquareFootprint(footprint) ? Math.min(
      marginSize(blockWidth, blockHeight, "small"),
      blockWidth * 0.12,
      blockHeight * 0.12
    ) : 0;
    const availableWidth = blockWidth - inset * 2;
    const availableHeight = blockHeight - inset * 2;
    const rotation = blockTypographyRotation(footprint);
    const fittingItems = items.filter(item => {
      const dimensions = orientedTypographyDimensions(item, rotation);
      return dimensions.width <= availableWidth && dimensions.height <= availableHeight;
    });
    return fittingItems.length >= (isCenteredXxlargeFootprint(footprint) ? 2 : 1);
  }

  function planGridBlocks(box, pools) {
    const availableFootprints = GRID_BLOCK_FOOTPRINTS.filter(footprint =>
      footprintSupportsRequiredTypography(box, footprint, pools)
    );
    const preferredCount = pick([2, 3, 3, 4, 4, 5]);
    const countOptions = [preferredCount, ...shuffled([2, 3, 4, 5].filter(count => count !== preferredCount))];
    let blocks = null;
    for (const count of countOptions) {
      blocks = buildGridBlockLayout(count, availableFootprints, randomSource);
      if (blocks) break;
    }
    blocks ||= buildGridBlockLayout(3, availableFootprints, randomSource);
    const secondaryKinds = ["content", "data", "sign", "graphic"];
    const primaryCandidates = blocks.filter(block => block.area >= 2);
    let primaryBlock = null;

    if (primaryCandidates.length && chance(GRID_PRIMARY_CHANCE)) {
      const largestArea = Math.max(...primaryCandidates.map(block => block.area));
      primaryBlock = pick(primaryCandidates.filter(block => block.area === largestArea));
    }

    return blocks.map((block, index) => ({
      ...block,
      id: `block-${index + 1}`,
      kind: block === primaryBlock ? "primary" : pick(secondaryKinds),
      cells: gridBlockCells(block)
    }));
  }

  function isUnusedTypographyWord(item, selectionState) {
    const key = typographyWordKey(item);
    return !key || !selectionState.usedTypographyWordKeys.has(key);
  }

  function blockCandidateGroups(kind, block, candidates) {
    if (kind === "primary") {
      const preferredSizes = block.area >= 6
        ? ["xxlarge", "xlarge", "large"]
        : block.area >= 3
          ? ["xlarge", "large"]
          : ["large"];
      return [
        ...preferredSizes.map(size => candidates.filter(item => item.size === size)),
        candidates.filter(item => !preferredSizes.includes(item.size))
      ].filter(group => group.length);
    }

    const preferredSize = kind === "graphic"
      ? (block.area >= 2 ? "large" : "medium")
      : (block.area >= 2 ? "medium" : "small");
    return [
      candidates.filter(item => item.size === preferredSize),
      candidates.filter(item => item.size !== preferredSize)
    ].filter(group => group.length);
  }

  function pickGridTokenItem(block, position, pools, availableBox, selectionState) {
    if (isXxxlargeFootprint(block)) {
      const candidates = shuffled(pools.xxxlargeBlock.filter(item => isUnusedTypographyWord(item, selectionState)));
      while (candidates.length) {
        const item = candidates.pop();
        const fit = fittingGridTokenItem(item, position, availableBox);
        if (fit) return { ...fit, kind: "block-xxxlarge" };
      }
      return null;
    }

    if (isCenteredXxlargeFootprint(block)) {
      const candidates = shuffled(pools.xxlargeBlock.filter(item => isUnusedTypographyWord(item, selectionState)));
      while (candidates.length) {
        const item = candidates.pop();
        const fit = fittingGridTokenItem(item, position, availableBox);
        if (fit) return { ...fit, kind: "block-xxlarge" };
      }
      return null;
    }

    if (isOversizedSquareFootprint(block)) {
      const candidates = shuffled(
        [...pools.xxlargeBlock, ...pools.xxxlargeBlock]
          .filter(item => isUnusedTypographyWord(item, selectionState))
      );
      while (candidates.length) {
        const item = candidates.pop();
        const fit = fittingGridTokenItem(item, position, availableBox);
        if (fit) return { ...fit, kind: "block-2x2-oversized" };
      }
      return null;
    }

    const secondaryKinds = ["content", "data", "sign", "graphic"];
    const kindOrder = block.kind === "primary"
      ? ["primary", ...shuffled(secondaryKinds)]
      : [block.kind, ...shuffled(secondaryKinds.filter(kind => kind !== block.kind))];

    for (const kind of kindOrder) {
      const candidates = pools[kind].filter(item =>
        (!UNIQUE_GRID_TOKEN_ROLES.includes(item.role) || !selectionState.usedUniqueTokenRoles.has(item.role)) &&
        isUnusedTypographyWord(item, selectionState)
      );
      for (const sourceGroup of blockCandidateGroups(kind, block, candidates)) {
        const group = shuffled(sourceGroup);
        while (group.length) {
          const item = group.pop();
          const fit = fittingGridTokenItem(item, position, availableBox);
          if (fit) return { ...fit, kind };
        }
      }
    }
    return null;
  }

  function guaranteedGridTokenSelection(block, position, availableBox) {
    const footprint = `${block.width}x${block.height}`;
    const value = String(block.cells?.[0] || 1);
    const sourceSize = isXxxlargeFootprint(block)
      ? "xxxlarge"
      : isCenteredXxlargeFootprint(block) || isOversizedSquareFootprint(block)
        ? "xxlarge"
        : "small";
    const kind = isXxxlargeFootprint(block)
      ? "block-xxxlarge"
      : isCenteredXxlargeFootprint(block)
        ? "block-xxlarge"
        : isOversizedSquareFootprint(block)
          ? "block-2x2-oversized"
          : "data";
    const sourceItem = typographyToken(value, {
      typeface: "mono",
      size: sourceSize,
      function: sourceSize === "small" ? "data" : "content",
      role: "cell-index"
    });
    const fit = fittingGridTokenItem(sourceItem, position, availableBox);
    return {
      ...(fit || {
        item: typographyTokenAtSize(sourceItem, "small"),
        bounds: gridTokenIntrinsicBox(position, typographyTokenAtSize(sourceItem, "small")),
        requestedSize: sourceSize
      }),
      kind,
      orientationMode: position.rotation ? "whole-rotate" : "none",
      forceHeavyXlarge: CONTEXTUAL_HEAVY_XLARGE_FOOTPRINTS.has(footprint)
    };
  }

  function gridTokenOrientationMode(block, item) {
    if (item.form !== "typography" || block.width !== 1 || block.height !== 3) return "none";
    const supportsGlyphStack = hasHangul(item.value) || hasHanja(item.value);
    return supportsGlyphStack && chance(0.5) ? "glyph-sideways-stack" : "whole-rotate";
  }

  function toTokenPlan(selection, block, position) {
    const footprint = `${block.width}x${block.height}`;
    const orientationMode = selection.orientationMode || gridTokenOrientationMode(block, selection.item);
    const forceHeavyXlarge = CONTEXTUAL_HEAVY_XLARGE_FOOTPRINTS.has(footprint);
    return {
      tokenPlan: selection.item,
      bounds: selection.bounds,
      kind: selection.kind,
      requestedSize: selection.requestedSize,
      actualSize: selection.item.size,
      orientationMode,
      forceHeavyXlarge,
      resolvedTypographyStyle: selection.item.form === "typography"
        ? resolveTypographyStyle({
            token: selection.item,
            orientationMode,
            actualSize: selection.item.size,
            forceHeavyXlarge
          })
        : null,
      rotation: position.rotation || 0
    };
  }

  function createFallbackTokenPlan(block, position, availableBox) {
    return toTokenPlan(guaranteedGridTokenSelection(block, position, availableBox), block, position);
  }

  function selectTokenForBlock({ block, position, pools, availableBox, selectionState }) {
    const fallbackTokenPlan = createFallbackTokenPlan(block, position, availableBox);
    const selected = pickGridTokenItem(block, position, pools, availableBox, selectionState);
    const tokenPlan = selected ? toTokenPlan(selected, block, position) : fallbackTokenPlan;
    if (UNIQUE_GRID_TOKEN_ROLES.includes(tokenPlan.tokenPlan.role)) {
      selectionState.usedUniqueTokenRoles.add(tokenPlan.tokenPlan.role);
    }
    const wordKey = typographyWordKey(tokenPlan.tokenPlan);
    if (wordKey) selectionState.usedTypographyWordKeys.add(wordKey);
    return { ...tokenPlan, fallbackTokenPlan };
  }

  return {
    createFallbackTokenPlan,
    gridTokenIntrinsicBox,
    planGridBlocks,
    selectTokenForBlock
  };
}
