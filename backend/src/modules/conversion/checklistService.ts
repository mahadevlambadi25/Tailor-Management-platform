import { prisma } from '../../core/prisma';
import { ProductionStageName } from '@prisma/client';
import { track } from './funnelService';

export interface ChecklistState {
  step1_addCustomer: boolean;
  step2_saveMeasurements: boolean;
  step3_createOrder: boolean;
  step4_moveStage: boolean;
  step5_inviteTeam: boolean;
  completedStepsCount: number;
  totalSteps: number;
  allCompleted: boolean;
  isDismissed: boolean;
  customerNameForAha?: string;
  firstRealCustomerCreated: boolean;
  hasSampleData: boolean;
  samplePromptDismissed: boolean;
}

export class ChecklistService {
  /**
   * Evaluates the 5-step First-Win checklist for a tenant based on real database records.
   * STRICT GUARANTEE: Sample records (isSample: true) NEVER complete checklist steps.
   */
  static async getChecklistStatus(tenantId: string): Promise<ChecklistState> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { checklistDismissed: true, samplePromptDismissed: true }
    });

    // 1. Step 1: Real Customer Created
    const realCustomer = await prisma.customer.findFirst({
      where: {
        tenantId,
        isSample: { not: true },
        isDemo: false,
        isDeleted: false
      },
      orderBy: { createdAt: 'asc' }
    });
    const step1 = !!realCustomer;

    // 2. Step 2: Real Measurement Saved
    let step2 = false;
    if (step1) {
      const realMeasurement = await prisma.customerMeasurement.findFirst({
        where: {
          tenantId,
          customer: {
            isSample: { not: true },
            isDemo: false
          }
        }
      });
      step2 = !!realMeasurement;
    }

    // 3. Step 3: Real Order with Delivery Date Created
    const realOrder = await prisma.order.findFirst({
      where: {
        tenantId,
        isSample: { not: true },
        isDemo: false,
        isCancelled: false
      },
      include: {
        customer: { select: { firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'asc' }
    });
    const step3 = !!realOrder && !!realOrder.deliveryDate;

    // 4. Step 4: Real Order Moved to Next Stage
    let step4 = false;
    if (step3) {
      const movedJob = await prisma.productionJob.findFirst({
        where: {
          tenantId,
          orderItem: {
            order: {
              isSample: { not: true },
              isDemo: false
            }
          },
          currentStage: {
            not: ProductionStageName.RECEIVED
          }
        }
      });
      step4 = !!movedJob;
    }

    // 5. Step 5: Team Member Invited (User other than initial shop owner that is not sample)
    const realStaff = await prisma.user.findFirst({
      where: {
        tenantId,
        isSample: { not: true },
        role: { not: 'SHOP_OWNER' }
      }
    });
    const step5 = !!realStaff;

    const completedStepsCount = [step1, step2, step3, step4, step5].filter(Boolean).length;
    const allCompleted = completedStepsCount === 5;

    // Check if sample data is present
    const sampleCustomerCount = await prisma.customer.count({
      where: { tenantId, isSample: true }
    });

    const customerName = realOrder?.customer
      ? `${realOrder.customer.firstName} ${realOrder.customer.lastName}`.trim()
      : realCustomer
      ? `${realCustomer.firstName} ${realCustomer.lastName}`.trim()
      : 'your customer';

    return {
      step1_addCustomer: step1,
      step2_saveMeasurements: step2,
      step3_createOrder: step3,
      step4_moveStage: step4,
      step5_inviteTeam: step5,
      completedStepsCount,
      totalSteps: 5,
      allCompleted,
      isDismissed: tenant?.checklistDismissed || false,
      customerNameForAha: customerName,
      firstRealCustomerCreated: step1,
      hasSampleData: sampleCustomerCount > 0,
      samplePromptDismissed: tenant?.samplePromptDismissed || false
    };
  }

  /**
   * Dismisses the checklist card for this tenant.
   */
  static async dismissChecklist(tenantId: string) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data: { checklistDismissed: true }
    });
  }

  /**
   * Dismisses the one-time sample clear prompt for this tenant.
   */
  static async dismissSamplePrompt(tenantId: string) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data: { samplePromptDismissed: true }
    });
  }
}
