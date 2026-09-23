import { OrderStatus, ProductionStageName } from '@prisma/client';
import { CraftAssignments } from './productionAssignmentService';

/**
 * Canonical real-world tailoring stage transitions.
 * Normal transitions move garments realistically through the workshop.
 */
export const ALLOWED_STAGE_TRANSITIONS: Record<ProductionStageName, ProductionStageName[]> = {
  [ProductionStageName.RECEIVED]: [
    ProductionStageName.CUTTING
  ],
  [ProductionStageName.CUTTING]: [
    ProductionStageName.STITCHING,
    ProductionStageName.RECEIVED // Revert back to queue
  ],
  [ProductionStageName.STITCHING]: [
    ProductionStageName.FINISHING,
    ProductionStageName.TRIAL, // Trial fitting
    ProductionStageName.READY, // Completed (for garments without separate finishing pass)
    ProductionStageName.CUTTING // Re-cut fabric if needed
  ],
  [ProductionStageName.FINISHING]: [
    ProductionStageName.TRIAL, // Trial fitting after finishing
    ProductionStageName.READY, // Quality pass, completed
    ProductionStageName.STITCHING // Re-stitch if flaw found
  ],
  [ProductionStageName.TRIAL]: [
    ProductionStageName.ALTERATION, // Customer requested adjustments
    ProductionStageName.READY, // Trial approved by customer
    ProductionStageName.STITCHING // Further stitching tweaks
  ],
  [ProductionStageName.ALTERATION]: [
    ProductionStageName.STITCHING, // Alteration tailoring
    ProductionStageName.TRIAL, // Second trial
    ProductionStageName.READY // Alteration complete, passed QC
  ],
  [ProductionStageName.READY]: [
    ProductionStageName.DELIVERED, // Handed over to customer
    ProductionStageName.ALTERATION // Customer tried on at pickup and needs adjustment
  ],
  [ProductionStageName.DELIVERED]: [
    // Normal forward transitions from DELIVERED are disallowed.
    // Transitioning from DELIVERED to ALTERATION is handled strictly via the explicit
    // "Customer Returned for Alteration" endpoint with reason and audit trail!
  ]
};

export class ProductionWorkflowService {
  /**
   * Checks if a transition from fromStage to toStage is permitted by canonical workflow rules.
   */
  static isValidStageTransition(fromStage: ProductionStageName, toStage: ProductionStageName): boolean {
    if (fromStage === toStage) return true;
    const allowed = ALLOWED_STAGE_TRANSITIONS[fromStage] || [];
    return allowed.includes(toStage);
  }

  /**
   * Evaluates master Order status across all OrderItems with strict precedence.
   * Rules:
   * 1. If all items are DELIVERED -> DELIVERED
   * 2. If all items are READY (or combination of READY and DELIVERED) -> READY_FOR_PICKUP
   * 3. If any item is in ALTERATION -> ALTERATION_PENDING (high operational alert)
   * 4. If any item is in TRIAL -> TRIAL_PENDING (requires customer fitting appointment)
   * 5. If any item is in active crafting (CUTTING, STITCHING, FINISHING, or mixed with READY) -> IN_PROGRESS
   * 6. If all items are RECEIVED -> RECEIVED
   */
  static calculateMasterOrderStatus(items: { status: ProductionStageName }[]): OrderStatus {
    if (!items || items.length === 0) {
      return OrderStatus.RECEIVED;
    }

    const allDelivered = items.every(i => i.status === ProductionStageName.DELIVERED);
    if (allDelivered) {
      return OrderStatus.DELIVERED;
    }

    const allReadyOrDelivered = items.every(
      i => i.status === ProductionStageName.READY || i.status === ProductionStageName.DELIVERED
    );
    if (allReadyOrDelivered) {
      return OrderStatus.READY_FOR_PICKUP;
    }

    const anyAlteration = items.some(i => i.status === ProductionStageName.ALTERATION);
    if (anyAlteration) {
      return OrderStatus.ALTERATION_PENDING;
    }

    const anyTrial = items.some(i => i.status === ProductionStageName.TRIAL);
    if (anyTrial) {
      return OrderStatus.TRIAL_PENDING;
    }

    const anyActiveCrafting = items.some(
      i =>
        i.status === ProductionStageName.CUTTING ||
        i.status === ProductionStageName.STITCHING ||
        i.status === ProductionStageName.FINISHING ||
        i.status === ProductionStageName.READY
    );
    if (anyActiveCrafting) {
      return OrderStatus.IN_PROGRESS;
    }

    const allReceived = items.every(i => i.status === ProductionStageName.RECEIVED);
    if (allReceived) {
      return OrderStatus.RECEIVED;
    }

    return OrderStatus.IN_PROGRESS;
  }

  /**
   * Returns the appropriate craftsman ID for the target stage based on craft assignments.
   */
  static getCraftsmanForStage(
    stage: ProductionStageName,
    assignments: CraftAssignments
  ): string | null {
    switch (stage) {
      case ProductionStageName.CUTTING:
        return assignments.cutterId || null;
      case ProductionStageName.STITCHING:
      case ProductionStageName.ALTERATION:
        return assignments.tailorId || null;
      case ProductionStageName.FINISHING:
        return assignments.finisherId || null;
      default:
        return null;
    }
  }
}
