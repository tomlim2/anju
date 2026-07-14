import {
  DESIGN_TOKEN_SIZE_ORDER,
  GRID_BLOCK_POLICY_BY_FOOTPRINT,
  compositionTypographyFallbackSizes
} from "./config.js";
import {
  deepFreeze,
  validateAttemptEnvelope,
  validateFinalizationReport
} from "./composition-model.js";

const SIZE_RANK = new Map(DESIGN_TOKEN_SIZE_ORDER.map((size, index) => [size, index]));
const BOUNDARY_TOLERANCE = 0.25;

function round6(value) {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function finitePositive(value) {
  return Number.isFinite(value) && value > 0;
}

export function deriveMountedOccupancy({
  sourceKind,
  renderedBounds,
  safeBox,
  occupancySafetyFactor
}) {
  if (!["lexical", "motif"].includes(sourceKind)) throw new Error("unknown occupancy source kind");
  if (!finitePositive(renderedBounds?.width) || !finitePositive(renderedBounds?.height)) {
    throw new Error("occupancy requires positive rendered bounds");
  }
  if (!finitePositive(safeBox?.width) || !finitePositive(safeBox?.height)) {
    throw new Error("occupancy requires a positive safe box");
  }
  if (!finitePositive(occupancySafetyFactor)) throw new Error("occupancy factor must be positive");
  if (sourceKind === "lexical" && occupancySafetyFactor !== 1) {
    throw new Error("lexical occupancy factor must be 1");
  }
  const normalizedArea = round6(
    (renderedBounds.width / safeBox.width) * (renderedBounds.height / safeBox.height)
  );
  return Object.freeze({
    normalizedArea,
    mountedOccupancyScore: round6(normalizedArea * occupancySafetyFactor)
  });
}

function matrixPoint(component, matrix, x, y) {
  const point = component.createSVGPoint();
  point.x = x;
  point.y = y;
  return point.matrixTransform(matrix);
}

export function transformedBoundsInComponent(node, component) {
  try {
    const bounds = node.getBBox();
    const nodeMatrix = node.getScreenCTM();
    const componentMatrix = component.getScreenCTM();
    if (!nodeMatrix || !componentMatrix) return null;
    const relative = componentMatrix.inverse().multiply(nodeMatrix);
    const corners = [
      matrixPoint(component, relative, bounds.x, bounds.y),
      matrixPoint(component, relative, bounds.x + bounds.width, bounds.y),
      matrixPoint(component, relative, bounds.x + bounds.width, bounds.y + bounds.height),
      matrixPoint(component, relative, bounds.x, bounds.y + bounds.height)
    ];
    const xs = corners.map(point => point.x);
    const ys = corners.map(point => point.y);
    const result = {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys)
    };
    return Object.values(result).every(Number.isFinite)
      && finitePositive(result.width)
      && finitePositive(result.height)
      ? result
      : null;
  } catch {
    return null;
  }
}

function contentBox(blockNode) {
  const box = {
    x: Number(blockNode.getAttribute("data-grid-content-x")),
    y: Number(blockNode.getAttribute("data-grid-content-y")),
    width: Number(blockNode.getAttribute("data-grid-content-width")),
    height: Number(blockNode.getAttribute("data-grid-content-height"))
  };
  return Object.values(box).every(Number.isFinite) && finitePositive(box.width) && finitePositive(box.height)
    ? box
    : null;
}

function boundsFit(bounds, box) {
  return Boolean(bounds && box)
    && bounds.x >= box.x - BOUNDARY_TOLERANCE
    && bounds.y >= box.y - BOUNDARY_TOLERANCE
    && bounds.x + bounds.width <= box.x + box.width + BOUNDARY_TOLERANCE
    && bounds.y + bounds.height <= box.y + box.height + BOUNDARY_TOLERANCE;
}

function stableUnique(values) {
  return [...new Set(values)];
}

function tokenForSlot(component, slotInstanceId) {
  return [...component.querySelectorAll("[data-message-slot]")]
    .find(node => node.getAttribute("data-message-slot") === slotInstanceId) || null;
}

function blockNodeForId(component, blockId) {
  return [...component.querySelectorAll("[data-grid-block]")]
    .find(node => node.getAttribute("data-grid-block") === blockId) || null;
}

function hierarchySatisfied(state, heroState) {
  const sizeDifference = SIZE_RANK.get(state.actualSize) - SIZE_RANK.get(heroState.actualSize);
  return sizeDifference < 0 || (sizeDifference === 0 && state.actualFontWeight < heroState.actualFontWeight);
}

export function createGridFinalizer({ renderTypographyAtSize, setTokenNudge }) {
  function measureAndNudge(state, component) {
    setTokenNudge(state.token, 0, 0);
    let bounds = transformedBoundsInComponent(state.token, component);
    if (!bounds || !state.contentBox) return { bounds: null, fits: false };
    if (
      bounds.width > state.contentBox.width + BOUNDARY_TOLERANCE
      || bounds.height > state.contentBox.height + BOUNDARY_TOLERANCE
    ) {
      return { bounds, fits: false };
    }
    let dx = 0;
    let dy = 0;
    if (bounds.x < state.contentBox.x) dx += state.contentBox.x - bounds.x;
    if (bounds.x + bounds.width > state.contentBox.x + state.contentBox.width) {
      dx -= bounds.x + bounds.width - state.contentBox.x - state.contentBox.width;
    }
    if (bounds.y < state.contentBox.y) dy += state.contentBox.y - bounds.y;
    if (bounds.y + bounds.height > state.contentBox.y + state.contentBox.height) {
      dy -= bounds.y + bounds.height - state.contentBox.y - state.contentBox.height;
    }
    if (dx !== 0 || dy !== 0) {
      setTokenNudge(state.token, dx, dy);
      bounds = transformedBoundsInComponent(state.token, component);
    }
    return { bounds, fits: boundsFit(bounds, state.contentBox) };
  }

  function renderLexicalStateAt(state, size, component) {
    const style = renderTypographyAtSize(state.token, size);
    const measured = measureAndNudge(state, component);
    state.actualSize = size;
    state.actualWeight = style.tokenWeight;
    state.actualFontWeight = style.fontWeight;
    state.bounds = measured.bounds;
    state.fits = measured.fits;
    return measured.fits;
  }

  function fitLexicalState(state, component) {
    for (const size of compositionTypographyFallbackSizes(state.block.requestedSize)) {
      if (renderLexicalStateAt(state, size, component)) return true;
    }
    return false;
  }

  function synchronizeGroups(states, component) {
    const groups = new Map();
    for (const state of states.filter(item => item.sourceKind === "lexical" && item.actualSize)) {
      const policy = GRID_BLOCK_POLICY_BY_FOOTPRINT.get(state.block.footprint);
      if (!policy?.sizeSyncScope) continue;
      const key = `${policy.sizeSyncScope}:${state.block.requestedSize}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(state);
    }
    let changed = false;
    for (const group of groups.values()) {
      const targetIndex = Math.min(...group.map(state => SIZE_RANK.get(state.actualSize)));
      const targetSize = DESIGN_TOKEN_SIZE_ORDER[targetIndex];
      for (const state of group) {
        if (state.actualSize === targetSize) continue;
        renderLexicalStateAt(state, targetSize, component);
        changed = true;
      }
    }
    return changed;
  }

  function enforceLexicalHierarchy(states, component) {
    const hero = states.find(state => state.slot.compositionRole === "hero");
    if (!hero?.actualSize) return false;
    let changed = false;
    for (const state of states.filter(item => item.sourceKind === "lexical" && item !== hero && item.actualSize)) {
      while (!hierarchySatisfied(state, hero)) {
        const index = SIZE_RANK.get(state.actualSize);
        if (index <= 0) break;
        renderLexicalStateAt(state, DESIGN_TOKEN_SIZE_ORDER[index - 1], component);
        changed = true;
      }
    }
    return changed;
  }

  function createState(component, plan, block) {
    const slot = plan.slots.find(item => item.id === block.slotInstanceId);
    const blockNode = blockNodeForId(component, block.id);
    const token = tokenForSlot(component, block.slotInstanceId);
    return {
      block,
      slot,
      sourceKind: slot?.sourceKind || null,
      blockNode,
      token,
      contentBox: blockNode ? contentBox(blockNode) : null,
      actualSize: slot?.sourceKind === "motif" ? block.requestedSize : null,
      actualWeight: null,
      actualFontWeight: null,
      bounds: null,
      fits: false
    };
  }

  function finalizeComposition(component, plan, envelope) {
    validateAttemptEnvelope(envelope);
    if (envelope.planId !== plan.planId) throw new Error("finalizer envelope plan mismatch");
    if (component?.getAttribute("data-plan-id") !== plan.planId) throw new Error("mounted component plan mismatch");
    const states = plan.blocks.map(block => createState(component, plan, block));
    const reasons = [];
    const failedSlots = [];
    function reject(slotInstanceId, reason) {
      failedSlots.push(slotInstanceId);
      reasons.push(reason);
    }

    for (const state of states) {
      if (!state.slot || !state.blockNode || !state.token || !state.contentBox) {
        reject(state.block.slotInstanceId, `physical.missing-mounted-node:${state.block.slotInstanceId}`);
        continue;
      }
      if (state.sourceKind === "lexical") {
        if (!fitLexicalState(state, component)) {
          const reason = state.slot.compositionRole === "hero"
            ? "fit.hero-below-small"
            : `fit.lexical-below-small:${state.slot.id}`;
          reject(state.slot.id, reason);
        }
      } else {
        const measured = measureAndNudge(state, component);
        state.bounds = measured.bounds;
        state.fits = measured.fits;
        if (!measured.fits) reject(state.slot.id, `fit.motif-overflow:${state.slot.id}`);
      }
    }

    for (let pass = 0; pass < DESIGN_TOKEN_SIZE_ORDER.length; pass += 1) {
      const synced = synchronizeGroups(states, component);
      const hierarchyChanged = enforceLexicalHierarchy(states, component);
      if (!synced && !hierarchyChanged) break;
    }

    const heroState = states.find(state => state.slot?.compositionRole === "hero");
    if (!heroState?.actualSize || !heroState.fits) {
      if (heroState) reject(heroState.slot.id, `hierarchy.missing-fitted-hero:${heroState.slot.id}`);
    } else {
      for (const state of states.filter(item => item.sourceKind === "lexical" && item !== heroState)) {
        if (!state.actualSize || !state.fits || !hierarchySatisfied(state, heroState)) {
          reject(state.slot.id, `hierarchy.lexical-not-below-hero:${state.slot.id}`);
        }
      }
    }

    for (const state of states) {
      const measured = state.token ? transformedBoundsInComponent(state.token, component) : null;
      state.bounds = measured || state.bounds;
      if (!state.bounds) reject(state.block.slotInstanceId, `physical.invalid-rendered-bounds:${state.block.slotInstanceId}`);
      if (state.contentBox && state.bounds) state.fits = boundsFit(state.bounds, state.contentBox);
      if (state.sourceKind === "lexical" && !state.fits) {
        reject(
          state.block.slotInstanceId,
          state.slot?.compositionRole === "hero"
            ? "fit.hero-below-small"
            : `fit.lexical-below-small:${state.block.slotInstanceId}`
        );
      }
    }

    const reportBlocks = states.map(state => {
      const renderedBounds = state.bounds
        ? { width: round6(state.bounds.width), height: round6(state.bounds.height) }
        : { width: 0.000001, height: 0.000001 };
      const factor = state.sourceKind === "motif" ? state.slot.occupancySafetyFactor : 1;
      const revision = state.sourceKind === "motif" ? state.slot.occupancyCalibrationRevision : null;
      const occupancy = deriveMountedOccupancy({
        sourceKind: state.sourceKind || "lexical",
        renderedBounds,
        safeBox: plan.generationInput.safeBox,
        occupancySafetyFactor: factor
      });
      const requestedIndex = SIZE_RANK.get(state.block.requestedSize);
      const actualIndex = SIZE_RANK.get(state.actualSize || "small");
      return {
        blockId: state.block.id,
        slotInstanceId: state.block.slotInstanceId,
        sourceKind: state.sourceKind || "lexical",
        requestedSize: state.block.requestedSize,
        requestedWeight: state.sourceKind === "motif" ? null : state.block.requestedWeight,
        requestedFontWeight: state.sourceKind === "motif" ? null : state.block.requestedFontWeight,
        actualSize: state.actualSize || "small",
        actualWeight: state.sourceKind === "motif" ? null : (state.actualWeight || "normal"),
        actualFontWeight: state.sourceKind === "motif" ? null : (state.actualFontWeight || 400),
        fallbackTier: state.sourceKind === "motif" ? 0 : Math.max(0, requestedIndex - actualIndex),
        renderedBounds,
        occupancySafetyFactor: factor,
        occupancyCalibrationRevision: revision,
        mountedOccupancyScore: occupancy.mountedOccupancyScore,
        fits: Boolean(state.fits)
      };
    });

    const heroReport = reportBlocks.find(block =>
      plan.slots.find(slot => slot.id === block.slotInstanceId)?.compositionRole === "hero"
    );
    for (const motifReport of reportBlocks.filter(block => block.sourceKind === "motif")) {
      if (!heroReport || motifReport.mountedOccupancyScore >= heroReport.mountedOccupancyScore) {
        reject(motifReport.slotInstanceId, `hierarchy.motif-occupancy-not-below-hero:${motifReport.slotInstanceId}`);
      }
    }

    for (const reportBlock of reportBlocks) {
      const state = states.find(item => item.block.id === reportBlock.blockId);
      if (!state?.token) continue;
      state.token.setAttribute("data-fallback-tier", String(reportBlock.fallbackTier));
      state.token.setAttribute("data-mounted-occupancy-score", String(reportBlock.mountedOccupancyScore));
      state.token.setAttribute("data-rendered-width", String(reportBlock.renderedBounds.width));
      state.token.setAttribute("data-rendered-height", String(reportBlock.renderedBounds.height));
      state.token.setAttribute("data-token-fit", String(reportBlock.fits));
      if (reportBlock.sourceKind === "lexical") {
        state.token.setAttribute("data-token-weight", reportBlock.actualWeight);
        state.token.setAttribute("data-token-actual-font-weight", String(reportBlock.actualFontWeight));
      }
    }

    const rejectionReasons = stableUnique(reasons);
    const report = deepFreeze({
      schemaVersion: 1,
      planId: envelope.planId,
      attempt: envelope.attempt,
      candidateSource: envelope.candidateSource,
      candidateCursor: envelope.candidateCursor,
      searchTier: envelope.searchTier,
      fallbackTrigger: envelope.fallbackTrigger,
      status: rejectionReasons.length ? "reject" : "accept",
      failedSlotInstanceIds: stableUnique(failedSlots),
      rejectionReasons,
      blocks: reportBlocks
    });
    validateFinalizationReport(report);
    return report;
  }

  return { finalizeComposition };
}
