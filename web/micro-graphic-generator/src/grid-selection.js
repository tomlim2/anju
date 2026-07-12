import {
  DESIGN_TOKEN_SIZE_ORDER,
  GRID_BLOCK_FOOTPRINTS,
  GRID_BLOCK_POLICY_BY_FOOTPRINT,
  GRID_PRIMARY_CHANCE,
  UNIQUE_GRID_TOKEN_ROLES
} from "./config.js";
import {
  alignedBoxY,
  buildGridBlockLayout,
  gridBlockCells,
  gridTokenFits
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
    typographyBySize: Object.fromEntries(
      DESIGN_TOKEN_SIZE_ORDER.map(size => [size, typographyItems.filter(item => item.size === size)])
    ),
    content: typographyItems.filter(item => item.function === "content" && ["small", "medium"].includes(item.size)),
    data: typographyItems.filter(item => item.function === "data" && ["small", "medium"].includes(item.size)),
    sign: typographyItems.filter(item => item.function === "sign" && ["small", "medium"].includes(item.size)),
    graphic: graphicItems.filter(item => item.function === "data")
  };
}

export function createGridSelectionEngine({ randomSource, typographyMeasurer }) {
  const { pick, chance, shuffled } = randomSource;
  const { measuredTypographyBox, orientedTypographyDimensions } = typographyMeasurer;
  const specializedTokenKinds = {
    "maximum-typography": "block-xxxlarge",
    "centered-hero": "block-xxlarge",
    "oversized-typography": "block-2x2-oversized"
  };

  function blockPolicy(block) {
    const footprint = `${block.width}x${block.height}`;
    const policy = GRID_BLOCK_POLICY_BY_FOOTPRINT.get(footprint);
    if (!policy) throw new Error(`Missing grid block policy: ${footprint}`);
    return policy;
  }

  function policyTypographyItems(policy, pools) {
    return (policy.requestedSizes || []).flatMap(size => pools.typographyBySize[size] || []);
  }

  function secondaryKindsForPolicy(policy) {
    return policy.allowGraphic
      ? ["content", "data", "sign", "graphic"]
      : ["content", "data", "sign"];
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
    const policy = blockPolicy(footprint);
    if (!policy.requestedSizes) return true;
    const items = policyTypographyItems(policy, pools);
    const blockWidth = box.width * footprint.width / 3;
    const blockHeight = box.height * footprint.height / 3;
    const inset = policy.candidatePolicy === "oversized-typography" ? Math.min(
      marginSize(blockWidth, blockHeight, "small"),
      blockWidth * 0.12,
      blockHeight * 0.12
    ) : 0;
    const availableWidth = blockWidth - inset * 2;
    const availableHeight = blockHeight - inset * 2;
    const rotation = policy.rotation;
    const fittingItems = items.filter(item => {
      const dimensions = orientedTypographyDimensions(item, rotation);
      return dimensions.width <= availableWidth && dimensions.height <= availableHeight;
    });
    return fittingItems.length >= (policy.candidatePolicy === "centered-hero" ? 2 : 1);
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
    const primaryCandidates = blocks.filter(block => block.area >= 2);
    let primaryBlock = null;

    if (primaryCandidates.length && chance(GRID_PRIMARY_CHANCE)) {
      const largestArea = Math.max(...primaryCandidates.map(block => block.area));
      primaryBlock = pick(primaryCandidates.filter(block => block.area === largestArea));
    }

    return blocks.map((block, index) => {
      const policy = blockPolicy(block);
      return {
        ...block,
        id: `block-${index + 1}`,
        kind: block === primaryBlock ? "primary" : pick(secondaryKindsForPolicy(policy)),
        cells: gridBlockCells(block)
      };
    });
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
    const policy = blockPolicy(block);
    if (policy.requestedSizes) {
      const candidates = shuffled(
        policyTypographyItems(policy, pools).filter(item => isUnusedTypographyWord(item, selectionState))
      );
      while (candidates.length) {
        const item = candidates.pop();
        const fit = fittingGridTokenItem(item, position, availableBox);
        if (fit) return { ...fit, kind: specializedTokenKinds[policy.candidatePolicy] };
      }
      return null;
    }

    const secondaryKinds = secondaryKindsForPolicy(policy);
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
    const policy = blockPolicy(block);
    const value = String(block.cells?.[0] || 1);
    const sourceSize = policy.requestedSizes?.[0] || "small";
    const kind = specializedTokenKinds[policy.candidatePolicy] || "data";
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
      orientationMode: policy.rotation ? "whole-rotate" : "none",
      forceHeavyXlarge: policy.xlargeWeight === 900
    };
  }

  function gridTokenOrientationMode(block, item) {
    if (item.form !== "typography") return "none";
    const policy = blockPolicy(block);
    const orientationModes = /[A-Za-z]/.test(item.value)
      ? policy.englishOrientationModes || policy.orientationModes
      : policy.orientationModes;
    if (orientationModes.length <= 1) return orientationModes[0] || "none";
    const supportsGlyphStack = hasHangul(item.value) || hasHanja(item.value);
    if (supportsGlyphStack && orientationModes.includes("glyph-sideways-stack") && chance(0.5)) {
      return "glyph-sideways-stack";
    }
    return orientationModes.includes("whole-rotate") ? "whole-rotate" : orientationModes[0];
  }

  function toTokenPlan(selection, block, position) {
    const policy = blockPolicy(block);
    const orientationMode = selection.orientationMode || gridTokenOrientationMode(block, selection.item);
    const forceHeavyXlarge = policy.xlargeWeight === 900;
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
