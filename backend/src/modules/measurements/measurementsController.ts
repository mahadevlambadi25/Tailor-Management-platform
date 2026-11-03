import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../core/prisma';
import { UnitSystem } from '@prisma/client';
import { config } from '../../config';
import { track } from '../conversion/funnelService';

export class MeasurementsController {
  // Save or update customer measurement version
  static async saveCustomerMeasurement(req: Request, res: Response, next: NextFunction) {
    try {
      const { customerId, garmentTypeId, name, unit, values, notes } = req.body;
      const tenantId = req.tenantId;

      if (!tenantId) {
        return res.status(401).json({
          success: false,
          error: { message: 'Authentication required. Missing tenant context.', code: 'UNAUTHORIZED' }
        });
      }

      if (!customerId || !garmentTypeId || !values) {
        return res.status(400).json({ success: false, error: { message: 'Missing customerId, garmentTypeId, or values' } });
      }

      // 1. Strictly verify customer exists and belongs to current tenant (prevent cross-tenant measurement IDOR)
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, tenantId, isDeleted: false }
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          error: { message: 'Customer not found or access denied.', code: 'CUSTOMER_NOT_FOUND' }
        });
      }

      // 2. Strictly verify garment type exists and belongs to current tenant
      const garmentType = await prisma.garmentType.findFirst({
        where: { id: garmentTypeId, tenantId, isActive: true }
      });

      if (!garmentType) {
        return res.status(404).json({
          success: false,
          error: { message: 'Garment type not found or access denied.', code: 'GARMENT_TYPE_NOT_FOUND' }
        });
      }

      // Concurrency-safe profile lookup/create, version recording, and audit logging inside atomic transaction
      let result: { updatedMeasurement: any; newVersion: any } | null = null;
      let attempts = 0;

      while (attempts < 3 && !result) {
        attempts++;
        try {
          result = await prisma.$transaction(async (tx) => {
            // 1. Concurrency-safe profile lookup inside transaction
            let measurement = await tx.customerMeasurement.findFirst({
              where: { tenantId, customerId: customer.id, garmentTypeId: garmentType.id }
            });

            if (!measurement) {
              measurement = await tx.customerMeasurement.create({
                data: {
                  tenantId,
                  customerId: customer.id,
                  garmentTypeId: garmentType.id,
                  name: name || 'Measurement Profile',
                  unit: (unit as UnitSystem) || UnitSystem.INCHES,
                  notes
                }
              });
            } else if (unit || notes) {
              measurement = await tx.customerMeasurement.update({
                where: { id: measurement.id },
                data: { unit: (unit as UnitSystem) || measurement.unit, notes }
              });
            }

            // 2. Fetch latest version and determine next versionNumber
            const latestVersion = await tx.measurementVersion.findFirst({
              where: { customerMeasurementId: measurement.id },
              orderBy: { versionNumber: 'desc' },
              select: { versionNumber: true }
            });

            const nextVersionNumber = (latestVersion?.versionNumber || 0) + 1;

            // 3. Create version record
            const version = await tx.measurementVersion.create({
              data: {
                customerMeasurementId: measurement.id,
                versionNumber: nextVersionNumber,
                values,
                createdById: req.user?.id,
                notes
              }
            });

            // 4. Record audit log entry atomically
            await tx.auditLog.create({
              data: {
                tenantId,
                userId: req.user?.id,
                customerId: customer.id,
                action: 'MEASUREMENT_RECORDED',
                entity: 'CustomerMeasurement',
                entityId: measurement.id,
                details: { versionNumber: nextVersionNumber, values }
              }
            });

            return { updatedMeasurement: measurement, newVersion: version };
          });
        } catch (txErr: any) {
          // If a concurrency collision occurs on CustomerMeasurement or MeasurementVersion versionNumber (P2002),
          // retry so that the concurrent request attaches to the newly committed profile/version without data loss.
          if (txErr.code === 'P2002' && attempts < 3) {
            continue;
          }
          throw txErr;
        }
      }

      if (!result) {
        return res.status(500).json({
          success: false,
          error: { message: 'Failed to record measurement due to concurrent write conflict. Please retry.', code: 'CONCURRENCY_CONFLICT' }
        });
      }

      const { updatedMeasurement, newVersion } = result;

      // Conversion V1: Track first_measurement if this is the first real measurement
      if (config.conversionV1 && !customer.isSample) {
        const count = await prisma.customerMeasurement.count({
          where: {
            tenantId,
            customer: { isSample: { not: true }, isDemo: false }
          }
        });
        if (count === 1) {
          await track(tenantId, 'first_measurement', { measurementId: updatedMeasurement.id }, req.user?.id);
        }
      }

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
      const tenantId = req.tenantId;

      if (!tenantId) {
        return res.status(401).json({
          success: false,
          error: { message: 'Authentication required. Missing tenant context.', code: 'UNAUTHORIZED' }
        });
      }

      // Strictly verify customer exists and belongs to current tenant
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, tenantId, isDeleted: false }
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          error: { message: 'Customer not found or access denied.', code: 'CUSTOMER_NOT_FOUND' }
        });
      }

      const measurements = await prisma.customerMeasurement.findMany({
        where: { tenantId, customerId: customer.id },
        include: {
          garmentType: true,
          versions: { orderBy: { versionNumber: 'desc' } }
        }
      });

      return res.json({ success: true, data: measurements });
    } catch (err) { next(err); }
  }
}
