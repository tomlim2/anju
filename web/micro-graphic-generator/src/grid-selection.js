import { deepFreeze } from "./composition-model.js";
import { validateCompositionPlan } from "./composition-plan-validator.js";

export function projectCompositionPlan(plan, context) {
  validateCompositionPlan(plan, context);
  const slotById = new Map(plan.slots.map(slot => [slot.id, slot]));
  const blocks = plan.blocks.map(block => {
    const slot = slotById.get(block.slotInstanceId);
    const candidate = slot ? context.candidateById.get(slot.candidateId) : null;
    if (!slot || !candidate || candidate.sourceKind !== slot.sourceKind) {
      throw new Error(`composition projection cannot resolve ${block.slotInstanceId}`);
    }
    const geometry = context.compositionBlockGeometry(
      context.generationInput.safeBox,
      block.cells
    );
    if (
      geometry.alignment !== block.alignment
      || geometry.verticalAlignment !== block.verticalAlignment
      || `${geometry.block.width}x${geometry.block.height}` !== block.footprint
    ) {
      throw new Error(`composition projection differs from block ${block.id}`);
    }
    return {
      block,
      slot,
      candidate,
      geometry
    };
  });
  return deepFreeze({
    schemaVersion: 1,
    planId: plan.planId,
    generationInputHash: plan.generationInputHash,
    blocks
  });
}
