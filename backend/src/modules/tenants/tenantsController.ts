import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../core/prisma';
import { ProductionStageName, OrderStatus, AppointmentStatus } from '@prisma/client';
import '../../middleware/tenantContext';

/**
 * Atomically purges all demo records belonging exclusively to the given tenant.
 * Records where isDemo === true are deleted.
 * All real records (isDemo === false) and other tenants' records are 100% preserved.
 * Cascading relations in PostgreSQL/Prisma ensure all items, measurements, jobs, and payments are cleaned.
 */
export async function purgeTenantDemoData(tenantId: string) {
  return await prisma.$transaction(async (tx) => {
    // 1. Delete all demo orders (cascades items, measurements, jobs, trials, alterations, payments, invoices)
    const deletedOrders = await tx.order.deleteMany({
      where: { tenantId, isDemo: true }
    });

    // 2. Delete demo appointments
    const deletedAppointments = await tx.appointment.deleteMany({
      where: { tenantId, isDemo: true }
    });

    // 3. Delete demo customers (cascades customer measurements, preferences, styles, photos, docs)
    const deletedCustomers = await tx.customer.deleteMany({
      where: { tenantId, isDemo: true }
    });

    return {
      deletedOrdersCount: deletedOrders.count,
      deletedAppointmentsCount: deletedAppointments.count,
      deletedCustomersCount: deletedCustomers.count
    };
  });
}

export class TenantsController {
  static async getTenant(req: Request, res: Response, next: NextFunction) {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId },
        include: {
          subscription: true,
          featureFlags: true,
          branches: { where: { isActive: true } }
        }
      });

      // Count active demo records using indexed isDemo flag
      const [demoOrdersCount, demoCustomersCount, demoAppointmentsCount] = await Promise.all([
        prisma.order.count({
          where: {
            tenantId: req.tenantId,
            isDemo: true
          }
        }),
        prisma.customer.count({
          where: {
            tenantId: req.tenantId,
            isDemo: true
          }
        }),
        prisma.appointment.count({
          where: {
            tenantId: req.tenantId,
            isDemo: true
          }
        })
      ]);

      return res.json({
        success: true,
        data: {
          ...tenant,
          demoStats: {
            demoOrdersCount,
            demoCustomersCount,
            demoAppointmentsCount,
            hasDemoData: demoOrdersCount > 0 || demoCustomersCount > 0 || demoAppointmentsCount > 0
          }
        }
      });
    } catch (err) { next(err); }
  }

  static async updateTenant(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, phone, email, address, city, state, pincode, gstNumber, gstin, defaultUnit, currency } = req.body;
      const dataToUpdate: any = {};
      if (name !== undefined) dataToUpdate.name = name;
      if (phone !== undefined) dataToUpdate.phone = phone;
      if (email !== undefined) dataToUpdate.email = email;
      if (address !== undefined) dataToUpdate.address = address;
      if (city !== undefined) dataToUpdate.city = city;
      if (state !== undefined) dataToUpdate.state = state;
      if (pincode !== undefined) dataToUpdate.pincode = pincode;
      if (gstNumber !== undefined || gstin !== undefined) dataToUpdate.gstNumber = gstNumber || gstin;
      if (defaultUnit !== undefined) dataToUpdate.defaultUnit = defaultUnit;
      if (currency !== undefined) dataToUpdate.currency = currency;

      const updated = await prisma.tenant.update({
        where: { id: req.tenantId },
        data: dataToUpdate
      });
      return res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  }

  static async toggleFeatureFlag(req: Request, res: Response, next: NextFunction) {
    try {
      const { featureKey, isEnabled } = req.body;
      const flag = await prisma.featureFlag.upsert({
        where: { tenantId_featureKey: { tenantId: req.tenantId!, featureKey } },
        update: { isEnabled },
        create: { tenantId: req.tenantId!, featureKey, isEnabled }
      });
      return res.json({ success: true, data: flag });
    } catch (err) { next(err); }
  }

  // Load realistic Demo Data with isDemo: true flag
  static async loadDemoData(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;

      // Get or create default branch
      let branch = await prisma.branch.findFirst({ where: { tenantId, isActive: true } });
      if (!branch) {
        branch = await prisma.branch.create({
          data: { tenantId, name: 'Main Atelier Workshop', code: 'HQ-01', address: 'MG Road', isMain: true }
        });
      }

      // Ensure standard garments exist
      let shirtGarment = await prisma.garmentType.findFirst({ where: { tenantId, code: 'SHIRT' } });
      if (!shirtGarment) {
        shirtGarment = await prisma.garmentType.create({
          data: { tenantId, name: 'Bespoke Shirt', code: 'SHIRT', category: 'MEN', defaultPrice: 3500 }
        });
      }
      let suitGarment = await prisma.garmentType.findFirst({ where: { tenantId, code: 'SUIT' } });
      if (!suitGarment) {
        suitGarment = await prisma.garmentType.create({
          data: { tenantId, name: '2-Piece Lounge Suit', code: 'SUIT', category: 'MEN', defaultPrice: 12000 }
        });
      }
      let blouseGarment = await prisma.garmentType.findFirst({ where: { tenantId, code: 'BLOUSE' } });
      if (!blouseGarment) {
        blouseGarment = await prisma.garmentType.create({
          data: { tenantId, name: 'Embroidered Silk Blouse', code: 'BLOUSE', category: 'WOMEN', defaultPrice: 4500 }
        });
      }

      // Check if demo data already loaded using isDemo flag
      const existingDemoCount = await prisma.customer.count({
        where: { tenantId, isDemo: true }
      });

      if (existingDemoCount > 0) {
        return res.json({
          success: true,
          message: 'Demo data is already active in your atelier.',
          data: { count: existingDemoCount }
        });
      }

      // 1. Create Demo Customers with isDemo: true
      const cust1 = await prisma.customer.create({
        data: {
          tenantId,
          customerId: 'DEMO-1001',
          firstName: 'Vikramaditya',
          lastName: 'Rao',
          mobile: '9988776655',
          email: 'vikram.rao@demo.internal',
          city: 'Bangalore',
          address: '45 Lavelle Road',
          notes: 'Premium bespoke client testing tailoring workflow',
          isDemo: true
        }
      });

      const cust2 = await prisma.customer.create({
        data: {
          tenantId,
          customerId: 'DEMO-1002',
          firstName: 'Ananya',
          lastName: 'Deshmukh',
          mobile: '9876540011',
          email: 'ananya.deshmukh@demo.internal',
          city: 'Bangalore',
          address: '12 Indiranagar 100ft Road',
          notes: 'Bridal couture sample client',
          isDemo: true
        }
      });

      const cust3 = await prisma.customer.create({
        data: {
          tenantId,
          customerId: 'DEMO-1003',
          firstName: 'Karthik',
          lastName: 'Subramanian',
          mobile: '9845099887',
          city: 'Bangalore',
          address: '88 Jayanagar 4th Block',
          notes: 'Corporate formal wardrobe testing',
          isDemo: true
        }
      });

      // 2. Demo Orders & Production Jobs with isDemo: true
      // Order 1: 2-Piece Suit
      await prisma.order.create({
        data: {
          tenantId,
          branchId: branch.id,
          customerId: cust1.id,
          orderNumber: 'DEMO-ORD-9001',
          status: 'IN_PROGRESS',
          priority: 'URGENT',
          deliveryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          totalAmount: 12000,
          discountAmount: 1000,
          netAmount: 11000,
          paidAmount: 6000,
          balanceAmount: 5000,
          paymentStatus: 'PARTIAL',
          internalNotes: 'Premium bespoke suit with canvas padding and Italian horn buttons',
          customerNotes: 'Deliver before weekend cocktail event',
          isDemo: true,
          items: {
            create: {
              tenantId,
              garmentTypeId: suitGarment.id,
              itemPrice: 12000,
              totalItemPrice: 11000,
              quantity: 1,
              status: ProductionStageName.STITCHING,
              internalNotes: 'Hand pad-stitched lapels',
              measurementSnapshot: {
                create: {
                  tenantId,
                  unit: 'INCHES',
                  valuesSnapshot: { Chest: 42, Waist: 36, Neck: 16.5, Sleeve: 26, Shoulder: 19, Length: 31 }
                }
              },
              productionJob: {
                create: {
                  tenantId,
                  currentStage: ProductionStageName.STITCHING,
                  notes: 'Jacket stitching in progress at master workstation'
                }
              }
            }
          },
          payments: {
            create: {
              tenantId,
              customerId: cust1.id,
              amount: 6000,
              paymentMethod: 'UPI',
              referenceNumber: 'UPI-DEMO-001',
              recordedById: req.user?.id || null
            }
          }
        }
      });

      // Order 2: Silk Blouse
      await prisma.order.create({
        data: {
          tenantId,
          branchId: branch.id,
          customerId: cust2.id,
          orderNumber: 'DEMO-ORD-9002',
          status: OrderStatus.TRIAL_PENDING,
          priority: 'REGULAR',
          deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          totalAmount: 4500,
          netAmount: 4500,
          paidAmount: 4500,
          balanceAmount: 0,
          paymentStatus: 'PAID',
          internalNotes: 'Raw silk blouse with golden zardozi embroidery',
          customerNotes: 'Ready for trial fitting',
          isDemo: true,
          items: {
            create: {
              tenantId,
              garmentTypeId: blouseGarment.id,
              itemPrice: 4500,
              totalItemPrice: 4500,
              quantity: 1,
              status: ProductionStageName.TRIAL,
              measurementSnapshot: {
                create: {
                  tenantId,
                  unit: 'INCHES',
                  valuesSnapshot: { Bust: 36, Waist: 30, Shoulder: 14.5, Length: 15 }
                }
              },
              productionJob: {
                create: {
                  tenantId,
                  currentStage: ProductionStageName.TRIAL,
                  notes: 'Awaiting customer fitting trial'
                }
              }
            }
          },
          payments: {
            create: {
              tenantId,
              customerId: cust2.id,
              amount: 4500,
              paymentMethod: 'CARD',
              referenceNumber: 'CARD-DEMO-002',
              recordedById: req.user?.id || null
            }
          }
        }
      });

      // Order 3: Formal Business Shirt
      await prisma.order.create({
        data: {
          tenantId,
          branchId: branch.id,
          customerId: cust3.id,
          orderNumber: 'DEMO-ORD-9003',
          status: OrderStatus.RECEIVED,
          priority: 'REGULAR',
          deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          totalAmount: 3500,
          netAmount: 3500,
          paidAmount: 1500,
          balanceAmount: 2000,
          paymentStatus: 'PARTIAL',
          internalNotes: 'Egyptian cotton white formal business shirt',
          customerNotes: 'French cuff requested',
          isDemo: true,
          items: {
            create: {
              tenantId,
              garmentTypeId: shirtGarment.id,
              itemPrice: 3500,
              totalItemPrice: 3500,
              quantity: 1,
              status: ProductionStageName.CUTTING,
              measurementSnapshot: {
                create: {
                  tenantId,
                  unit: 'INCHES',
                  valuesSnapshot: { Chest: 40, Waist: 34, Neck: 16, Sleeve: 25, Shoulder: 18, Length: 30 }
                }
              },
              productionJob: {
                create: {
                  tenantId,
                  currentStage: ProductionStageName.CUTTING,
                  notes: 'Pattern drafted on fabric'
                }
              }
            }
          },
          payments: {
            create: {
              tenantId,
              customerId: cust3.id,
              amount: 1500,
              paymentMethod: 'CASH',
              referenceNumber: 'CASH-DEMO-003',
              recordedById: req.user?.id || null
            }
          }
        }
      });

      // 3. Demo Appointment with isDemo: true
      await prisma.appointment.create({
        data: {
          tenantId,
          customerId: cust1.id,
          type: 'TRIAL',
          scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          durationMinutes: 45,
          status: AppointmentStatus.SCHEDULED,
          notes: 'First trial fitting for 2-Piece bespoke suit',
          isDemo: true
        }
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: req.user?.id,
          action: 'DEMO_DATA_LOADED',
          entity: 'Tenant',
          entityId: tenantId,
          details: { customers: 3, orders: 3, isDemo: true }
        }
      });

      return res.json({
        success: true,
        message: 'Demo data loaded successfully! Sample clients, orders, production jobs, and appointments are now active in your atelier.',
        data: { customersCreated: 3, ordersCreated: 3, appointmentsCreated: 1 }
      });
    } catch (err) { next(err); }
  }

  // Clear / Purge all Demo Data directly (manual action or maintenance)
  static async clearDemoData(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;

      const purgeResult = await purgeTenantDemoData(tenantId);

      // Audit Log
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: req.user?.id,
          action: 'DEMO_DATA_PURGED',
          entity: 'Tenant',
          entityId: tenantId,
          details: purgeResult
        }
      });

      return res.json({
        success: true,
        message: `All demo data removed successfully! (${purgeResult.deletedOrdersCount} orders, ${purgeResult.deletedCustomersCount} customers, ${purgeResult.deletedAppointmentsCount} appointments deleted). Atelier is clean.`,
        data: purgeResult
      });
    } catch (err) { next(err); }
  }

  // 1. Subscription Checkout: Initiates subscription checkout. Status is PENDING. Demo data is NOT deleted!
  static async checkoutSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { planName = 'PRO_ENTERPRISE' } = req.body;

      const subscription = await prisma.subscription.upsert({
        where: { tenantId },
        update: {
          planName,
          status: 'PENDING'
        },
        create: {
          tenantId,
          planName,
          status: 'PENDING'
        }
      });

      return res.json({
        success: true,
        message: 'Subscription checkout initiated. Payment is pending confirmation. Demo data is retained until payment succeeds.',
        data: {
          subscription,
          checkoutSessionId: `sess_${Date.now()}_${tenantId.substring(0, 6)}`,
          status: 'PENDING',
          demoDataRetained: true
        }
      });
    } catch (err) { next(err); }
  }

  // 2. Subscription Cancel: Customer abandons checkout. Status CANCELLED. Demo data is NOT deleted!
  static async cancelSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;

      const subscription = await prisma.subscription.update({
        where: { tenantId },
        data: { status: 'CANCELLED' }
      });

      return res.json({
        success: true,
        message: 'Subscription checkout was cancelled. No payment charged. Demo data has been retained.',
        data: {
          subscription,
          status: 'CANCELLED',
          demoDataRetained: true
        }
      });
    } catch (err) { next(err); }
  }

  // 3. Subscription Fail: Payment gateway reports card decline or error. Status FAILED. Demo data is NOT deleted!
  static async failSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { reason = 'Payment declined by card issuer' } = req.body;

      const subscription = await prisma.subscription.update({
        where: { tenantId },
        data: { status: 'FAILED' }
      });

      return res.json({
        success: true,
        message: `Subscription payment failed: ${reason}. Demo data has been retained.`,
        data: {
          subscription,
          status: 'FAILED',
          failureReason: reason,
          demoDataRetained: true
        }
      });
    } catch (err) { next(err); }
  }

  // 4. Subscription Confirm: Payment is successfully verified! Status ACTIVE. ONLY NOW is demo data purged!
  static async confirmSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { planName = 'PRO_ENTERPRISE_ACTIVE', paymentId = `PAY_SUCC_${Date.now()}` } = req.body;

      // Update Subscription status to ACTIVE
      const subscription = await prisma.subscription.upsert({
        where: { tenantId },
        update: {
          planName,
          status: 'ACTIVE',
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        },
        create: {
          tenantId,
          planName,
          status: 'ACTIVE',
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        }
      });

      // ONLY AFTER CONFIRMED SUCCESSFUL PAYMENT: Execute atomic deletion of demo data
      const purgeResult = await purgeTenantDemoData(tenantId);

      // Audit Log
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: req.user?.id,
          action: 'SUBSCRIPTION_CONFIRMED_ACTIVE',
          entity: 'Subscription',
          entityId: subscription.id,
          details: { planName, paymentId, ...purgeResult }
        }
      });

      return res.json({
        success: true,
        message: `Subscription payment confirmed and activated! All demo data has been purged (${purgeResult.deletedOrdersCount} orders, ${purgeResult.deletedCustomersCount} clients, ${purgeResult.deletedAppointmentsCount} appointments removed). Your atelier is now ready for real production orders.`,
        data: {
          subscription,
          paymentId,
          purgeResult
        }
      });
    } catch (err) { next(err); }
  }

  // Legacy route alias to confirmSubscription
  static async subscribe(req: Request, res: Response, next: NextFunction) {
    return TenantsController.confirmSubscription(req, res, next);
  }
}
