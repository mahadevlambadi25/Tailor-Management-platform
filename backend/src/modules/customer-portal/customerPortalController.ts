import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../core/prisma';

export class CustomerPortalController {
  // Get Customer Own Self-Service Portal Profile
  static async getMyPortal(req: Request, res: Response, next: NextFunction) {
    try {
      const customerId = req.user?.customerId;
      const tenantId = req.tenantId!;

      if (!customerId) {
        return res.status(403).json({
          success: false,
          error: { message: 'Customer portal authentication required', code: 'CUSTOMER_AUTH_REQUIRED' }
        });
      }

      const customer = await prisma.customer.findFirst({
        where: { id: customerId, tenantId, isDeleted: false },
        include: {
          tenant: { select: { name: true, phone: true, email: true, currency: true, address: true } },
          preferences: true,
          photos: { select: { id: true, fileUrl: true, caption: true, createdAt: true } },
          measurements: {
            include: {
              garmentType: { select: { name: true, category: true } },
              versions: { orderBy: { versionNumber: 'desc' }, take: 1 }
            }
          },
          orders: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              deliveryDate: true,
              revisedDeliveryDate: true,
              totalAmount: true,
              discountAmount: true,
              netAmount: true,
              paidAmount: true,
              balanceAmount: true,
              paymentStatus: true,
              customerNotes: true, // Only customer-safe notes!
              // Note: internalNotes and delayReason are intentionally excluded!
              createdAt: true,
              items: {
                select: {
                  id: true,
                  quantity: true,
                  totalItemPrice: true,
                  status: true,
                  customerNotes: true,
                  garmentType: { select: { name: true, category: true } },
                  measurementSnapshot: { select: { valuesSnapshot: true, unit: true } }
                }
              },
              payments: {
                select: {
                  id: true,
                  amount: true,
                  paymentMethod: true,
                  createdAt: true
                }
              }
            },
            orderBy: { createdAt: 'desc' }
          },
          appointments: {
            select: {
              id: true,
              type: true,
              scheduledAt: true,
              status: true,
              notes: true
            },
            orderBy: { scheduledAt: 'desc' }
          }
        }
      });

      if (!customer) {
        return res.status(404).json({ success: false, error: { message: 'Customer profile not found' } });
      }

      const totalSpend = customer.orders.reduce((sum, o) => sum + Number(o.netAmount), 0);
      const outstandingBalance = customer.orders.reduce((sum, o) => sum + Number(o.balanceAmount), 0);

      return res.json({
        success: true,
        data: {
          profile: {
            id: customer.id,
            customerId: customer.customerId,
            firstName: customer.firstName,
            lastName: customer.lastName,
            mobile: customer.mobile,
            email: customer.email,
            address: customer.address,
            shop: customer.tenant
          },
          orders: customer.orders,
          measurements: customer.measurements,
          appointments: customer.appointments,
          photos: customer.photos,
          financials: {
            totalSpend,
            outstandingBalance
          }
        }
      });
    } catch (err) { next(err); }
  }
}
