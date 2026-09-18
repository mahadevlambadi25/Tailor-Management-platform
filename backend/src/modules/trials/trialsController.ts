import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../core/prisma';
import { TrialStatus } from '@prisma/client';

export class TrialsController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { customerId, orderItemId } = req.query;
      const tenantId = req.tenantId!;

      const trials = await prisma.trial.findMany({
        where: {
          tenantId,
          customerId: customerId ? (customerId as string) : undefined,
          orderItemId: orderItemId ? (orderItemId as string) : undefined
        },
        include: {
          customer: { select: { firstName: true, lastName: true, mobile: true } },
          orderItem: { include: { garmentType: true } },
          alterations: true
        },
        orderBy: { trialNumber: 'asc' }
      });
      return res.json({ success: true, data: trials });
    } catch (err) { next(err); }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { orderItemId, customerId, scheduledDate, fitNotes, issues, alterationInstructions } = req.body;

      const trialResult = await prisma.$transaction(async (tx) => {
        const item = await tx.orderItem.findFirst({
          where: { id: orderItemId, tenantId }
        });
        if (!item) {
          throw new Error('Order item not found in this shop');
        }

        const existingCount = await tx.trial.count({
          where: { tenantId, orderItemId }
        });

        const trial = await tx.trial.create({
          data: {
            tenantId,
            orderItemId,
            customerId,
            trialNumber: existingCount + 1,
            scheduledDate: new Date(scheduledDate || Date.now()),
            fitNotes,
            issues,
            alterationInstructions,
            status: alterationInstructions ? TrialStatus.ALTERATION_NEEDED : TrialStatus.SCHEDULED
          }
        });

        if (alterationInstructions) {
          await tx.alteration.create({
            data: {
              tenantId,
              trialId: trial.id,
              orderItemId,
              customerId,
              instructions: alterationInstructions,
              isChargeable: false
            }
          });
        }

        return trial;
      });

      return res.status(201).json({ success: true, data: trialResult });
    } catch (err) { next(err); }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status, fitNotes, issues, alterationInstructions, isChargeable, chargeAmount } = req.body;
      const tenantId = req.tenantId!;

      const updatedTrial = await prisma.$transaction(async (tx) => {
        const existing = await tx.trial.findFirst({
          where: { id, tenantId }
        });
        if (!existing) {
          return null;
        }

        const trial = await tx.trial.update({
          where: { id },
          data: {
            status: status as TrialStatus,
            completedDate: status === TrialStatus.COMPLETED || status === TrialStatus.APPROVED ? new Date() : undefined,
            fitNotes,
            issues,
            alterationInstructions
          }
        });

        if (status === TrialStatus.ALTERATION_NEEDED && alterationInstructions) {
          await tx.alteration.create({
            data: {
              tenantId,
              trialId: trial.id,
              orderItemId: trial.orderItemId,
              customerId: trial.customerId,
              instructions: alterationInstructions,
              isChargeable: isChargeable || false,
              chargeAmount: chargeAmount || 0
            }
          });
        }

        return trial;
      });

      if (!updatedTrial) {
        return res.status(404).json({ success: false, error: { message: 'Trial record not found' } });
      }

      return res.json({ success: true, data: updatedTrial });
    } catch (err) { next(err); }
  }
}
