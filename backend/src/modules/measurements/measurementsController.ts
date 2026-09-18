import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../core/prisma';
import { UnitSystem } from '@prisma/client';

export class MeasurementsController {
  // Save or update customer measurement version
  static async saveCustomerMeasurement(req: Request, res: Response, next: NextFunction) {
    try {
      const { customerId, garmentTypeId, name, unit, values, notes } = req.body;
      const tenantId = req.tenantId!;

      if (!customerId || !garmentTypeId || !values) {
        return res.status(400).json({ success: false, error: { message: 'Missing customerId, garmentTypeId, or values' } });
      }

      // Check existing customer measurement profile
      let measurement = await prisma.customerMeasurement.findFirst({
        where: { tenantId, customerId, garmentTypeId }
      });

      if (!measurement) {
        measurement = await prisma.customerMeasurement.create({
          data: {
            tenantId,
            customerId,
            garmentTypeId,
            name: name || 'Measurement Profile',
            unit: (unit as UnitSystem) || UnitSystem.INCHES,
            notes
          }
        });
      } else if (unit || notes) {
        measurement = await prisma.customerMeasurement.update({
          where: { id: measurement.id },
          data: { unit: (unit as UnitSystem) || measurement.unit, notes }
        });
      }

      // Determine next version number and record atomically inside transaction
      const { updatedMeasurement, newVersion } = await prisma.$transaction(async (tx) => {
        const latestVersion = await tx.measurementVersion.findFirst({
          where: { customerMeasurementId: measurement.id },
          orderBy: { versionNumber: 'desc' },
          select: { versionNumber: true }
        });

        const nextVersionNumber = (latestVersion?.versionNumber || 0) + 1;

        const version = await tx.measurementVersion.create({
          data: {
            customerMeasurementId: measurement.id,
            versionNumber: nextVersionNumber,
            values,
            createdById: req.user?.id,
            notes
          }
        });

        await tx.auditLog.create({
          data: {
            tenantId,
            userId: req.user?.id,
            customerId,
            action: 'MEASUREMENT_RECORDED',
            entity: 'CustomerMeasurement',
            entityId: measurement.id,
            details: { versionNumber: nextVersionNumber, values }
          }
        });

        return { updatedMeasurement: measurement, newVersion: version };
      });

      return res.status(201).json({
        success: true,
        data: {
          measurement: updatedMeasurement,
          version: newVersion
        }
      });
    } catch (err) { next(err); }
  }

  // Get customer measurements
  static async getByCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const { customerId } = req.params;
      const tenantId = req.tenantId!;

      const measurements = await prisma.customerMeasurement.findMany({
        where: { tenantId, customerId },
        include: {
          garmentType: true,
          versions: { orderBy: { versionNumber: 'desc' } }
        }
      });

      return res.json({ success: true, data: measurements });
    } catch (err) { next(err); }
  }
}
