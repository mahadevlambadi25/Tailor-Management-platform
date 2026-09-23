import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../core/prisma';
import { OrderStatus, ProductionStageName, RoleType } from '@prisma/client';
import { PaymentCalculationService } from '../payments/paymentCalculationService';

export interface CustomerFriendlyStatus {
  stageKey: 'ORDER_RECEIVED' | 'CUTTING' | 'STITCHING' | 'TRIAL' | 'ALTERATION' | 'READY' | 'DELIVERED' | 'CANCELLED';
  title: string;
  description: string;
  stepIndex: number;
}

export class CustomerPortalController {
  /**
   * Helper: Resolves authenticated customer identity.
   * If customer role: strictly uses req.user.customerId from cryptographically verified JWT.
   * If staff role (SHOP_OWNER, MANAGER, RECEPTIONIST): requires explicit customerId query param.
   * Never falls back to arbitrary database records.
   */
  private static async resolveCustomerId(req: Request): Promise<{
    customerId: string | null;
    error?: { status: number; message: string; code: string };
  }> {
    const tenantId = req.tenantId!;
    const user = req.user;

    if (!user) {
      return { customerId: null, error: { status: 401, message: 'Authentication required.', code: 'UNAUTHORIZED' } };
    }

    if (user.role === RoleType.CUSTOMER) {
      if (!user.customerId) {
        return { customerId: null, error: { status: 403, message: 'Customer portal session required.', code: 'CUSTOMER_AUTH_REQUIRED' } };
      }
      return { customerId: user.customerId };
    }

    // Staff preview support: customerId must be explicitly provided
    const staffRoles: RoleType[] = [RoleType.SHOP_OWNER, RoleType.MANAGER, RoleType.RECEPTIONIST, RoleType.SAAS_OWNER];
    if (staffRoles.includes(user.role as RoleType)) {
      const queryCustId = (req.query.customerId as string) || (req.body?.customerId as string);
      if (!queryCustId) {
        return {
          customerId: null,
          error: {
            status: 400,
            message: 'Staff preview requires an explicit customerId query parameter.',
            code: 'CUSTOMER_ID_REQUIRED_FOR_STAFF_PREVIEW'
          }
        };
      }

      // Verify customer belongs to current tenant
      const cust = await prisma.customer.findFirst({
        where: { id: queryCustId, tenantId, isDeleted: false },
        select: { id: true }
      });
      if (!cust) {
        return {
          customerId: null,
          error: { status: 404, message: 'Target customer not found in this shop.', code: 'CUSTOMER_NOT_FOUND' }
        };
      }
      return { customerId: queryCustId };
    }

    return { customerId: null, error: { status: 403, message: 'Forbidden.', code: 'FORBIDDEN_ROLE' } };
  }

  /**
   * Maps internal order status & item stages to a customer-friendly 7-stage representation.
   */
  static mapCustomerFriendlyStatus(order: {
    status: OrderStatus;
    isCancelled?: boolean;
    items?: Array<{ status: ProductionStageName }>;
  }): CustomerFriendlyStatus {
    if (order.isCancelled || order.status === OrderStatus.CANCELLED) {
      return {
        stageKey: 'CANCELLED',
        title: 'Order Cancelled',
        description: 'This booking has been cancelled. Please contact the atelier for details.',
        stepIndex: -1
      };
    }

    if (order.status === OrderStatus.DELIVERED) {
      return {
        stageKey: 'DELIVERED',
        title: 'Delivered',
        description: 'Your bespoke order has been handed over to you.',
        stepIndex: 7
      };
    }

    if (order.status === OrderStatus.READY_FOR_PICKUP) {
      return {
        stageKey: 'READY',
        title: 'Ready for Pickup',
        description: 'Your garments are pressed, inspected, and ready at the store.',
        stepIndex: 6
      };
    }

    if (order.status === OrderStatus.ALTERATION_PENDING) {
      return {
        stageKey: 'ALTERATION',
        title: 'Precision Alterations',
        description: 'Garment adjustments and refinements are in progress based on fitting feedback.',
        stepIndex: 5
      };
    }

    if (order.status === OrderStatus.TRIAL_PENDING) {
      return {
        stageKey: 'TRIAL',
        title: 'Fitting & Trial Ready',
        description: 'Your garment is prepared and ready for your fitting session.',
        stepIndex: 4
      };
    }

    if (order.status === OrderStatus.IN_PROGRESS) {
      const hasCutting = order.items?.some(i => i.status === ProductionStageName.CUTTING);
      if (hasCutting) {
        return {
          stageKey: 'CUTTING',
          title: 'Fabric Cutting & Drafting',
          description: 'Master cutter is drafting and hand-cutting patterns to your measurements.',
          stepIndex: 2
        };
      }
      return {
        stageKey: 'STITCHING',
        title: 'Tailoring & Stitching',
        description: 'Artisan tailors are hand-assembling your garment seams and canvassing.',
        stepIndex: 3
      };
    }

    return {
      stageKey: 'ORDER_RECEIVED',
      title: 'Order Confirmed',
      description: 'Your order is booked and measurements are verified.',
      stepIndex: 1
    };
  }

  // ---------------------------------------------------------------------------
  // 1. Customer Dashboard Summary
  // ---------------------------------------------------------------------------
  static async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const resolved = await CustomerPortalController.resolveCustomerId(req);
      if (resolved.error) {
        return res.status(resolved.error.status).json({
          success: false,
          error: { message: resolved.error.message, code: resolved.error.code }
        });
      }
      const customerId = resolved.customerId!;

      const [customer, activeOrders, readyCount, balanceAggregate, recentOrder] = await Promise.all([
        prisma.customer.findFirst({
          where: { id: customerId, tenantId, isDeleted: false },
          select: {
            id: true,
            customerId: true,
            firstName: true,
            lastName: true,
            mobile: true,
            tenant: { select: { id: true, name: true, phone: true, email: true, address: true, currency: true } }
          }
        }),
        prisma.order.count({
          where: {
            tenantId,
            customerId,
            isCancelled: false,
            status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] }
          }
        }),
        prisma.order.count({
          where: {
            tenantId,
            customerId,
            isCancelled: false,
            status: OrderStatus.READY_FOR_PICKUP
          }
        }),
        prisma.order.aggregate({
          where: {
            tenantId,
            customerId,
            isCancelled: false
          },
          _sum: { balanceAmount: true, netAmount: true, paidAmount: true }
        }),
        prisma.order.findFirst({
          where: {
            tenantId,
            customerId,
            isCancelled: false
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            deliveryDate: true,
            netAmount: true,
            paidAmount: true,
            balanceAmount: true,
            paymentStatus: true,
            createdAt: true,
            items: {
              select: {
                id: true,
                status: true,
                garmentType: { select: { name: true } }
              }
            }
          }
        })
      ]);

      if (!customer) {
        return res.status(404).json({
          success: false,
          error: { message: 'Customer record not found.', code: 'CUSTOMER_NOT_FOUND' }
        });
      }

      const totalBalanceDue = PaymentCalculationService.round2(Number(balanceAggregate._sum.balanceAmount || 0));
      const totalSpend = PaymentCalculationService.round2(Number(balanceAggregate._sum.netAmount || 0));

      let currentOrderSpotlight = null;
      if (recentOrder) {
        const friendlyStatus = CustomerPortalController.mapCustomerFriendlyStatus(recentOrder);
        const garmentNames = recentOrder.items.map(i => i.garmentType.name).join(', ');
        currentOrderSpotlight = {
          id: recentOrder.id,
          orderNumber: recentOrder.orderNumber,
          status: recentOrder.status,
          deliveryDate: recentOrder.deliveryDate.toISOString(),
          createdAt: recentOrder.createdAt.toISOString(),
          garmentSummary: garmentNames || 'Custom Garment',
          itemCount: recentOrder.items.length,
          friendlyStatus,
          netAmount: Number(recentOrder.netAmount),
          balanceAmount: Number(recentOrder.balanceAmount),
          paymentStatus: recentOrder.paymentStatus
        };
      }

      return res.json({
        success: true,
        data: {
          customer: {
            id: customer.id,
            customerId: customer.customerId,
            name: `${customer.firstName} ${customer.lastName}`.trim(),
            mobile: customer.mobile,
            shop: customer.tenant
          },
          kpis: {
            activeOrdersCount: activeOrders,
            readyForPickupCount: readyCount,
            totalBalanceDue,
            totalSpend,
            nearestDeliveryDate: recentOrder?.deliveryDate ? recentOrder.deliveryDate.toISOString() : null
          },
          currentOrderSpotlight
        }
      });
    } catch (err) { next(err); }
  }

  // ---------------------------------------------------------------------------
  // 2. Customer Orders List
  // ---------------------------------------------------------------------------
  static async getOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const resolved = await CustomerPortalController.resolveCustomerId(req);
      if (resolved.error) {
        return res.status(resolved.error.status).json({
          success: false,
          error: { message: resolved.error.message, code: resolved.error.code }
        });
      }
      const customerId = resolved.customerId!;

      const orders = await prisma.order.findMany({
        where: { customerId, tenantId },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          deliveryDate: true,
          totalAmount: true,
          discountAmount: true,
          netAmount: true,
          paidAmount: true,
          balanceAmount: true,
          paymentStatus: true,
          customerNotes: true,
          createdAt: true,
          isCancelled: true,
          items: {
            select: {
              id: true,
              quantity: true,
              totalItemPrice: true,
              status: true,
              garmentType: { select: { name: true, category: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const sanitizedOrders = orders.map(o => {
        const friendlyStatus = CustomerPortalController.mapCustomerFriendlyStatus(o);
        return {
          id: o.id,
          orderNumber: o.orderNumber,
          createdAt: o.createdAt.toISOString(),
          deliveryDate: o.deliveryDate.toISOString(),
          status: o.status,
          friendlyStatus,
          paymentStatus: o.paymentStatus,
          grandTotal: Number(o.netAmount),
          totalPaid: Number(o.paidAmount),
          balanceDue: Number(o.balanceAmount),
          customerNotes: o.customerNotes,
          itemsCount: o.items.length,
          items: o.items.map((it, idx) => ({
            id: it.id,
            itemNumber: `ITEM-${idx + 1}`,
            garmentName: it.garmentType.name,
            category: it.garmentType.category,
            quantity: it.quantity,
            totalPrice: Number(it.totalItemPrice),
            status: it.status
          }))
        };
      });

      return res.json({ success: true, data: sanitizedOrders });
    } catch (err) { next(err); }
  }

  // ---------------------------------------------------------------------------
  // 3. Customer Single Order Details
  // ---------------------------------------------------------------------------
  static async getOrderById(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const resolved = await CustomerPortalController.resolveCustomerId(req);
      if (resolved.error) {
        return res.status(resolved.error.status).json({
          success: false,
          error: { message: resolved.error.message, code: resolved.error.code }
        });
      }
      const customerId = resolved.customerId!;
      const orderIdentifier = req.params.id;

      // Match by UUID or orderNumber, strictly bounded by customerId and tenantId
      const order = await prisma.order.findFirst({
        where: {
          tenantId,
          customerId,
          OR: [{ id: orderIdentifier }, { orderNumber: orderIdentifier }]
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          deliveryDate: true,
          totalAmount: true,
          discountAmount: true,
          netAmount: true,
          paidAmount: true,
          balanceAmount: true,
          paymentStatus: true,
          customerNotes: true,
          createdAt: true,
          isCancelled: true,
          items: {
            select: {
              id: true,
              quantity: true,
              itemPrice: true,
              totalItemPrice: true,
              status: true,
              customerNotes: true,
              garmentType: { select: { name: true, category: true } },
              measurementSnapshot: {
                select: {
                  valuesSnapshot: true,
                  unit: true
                }
              },
              styles: {
                select: {
                  style: { select: { name: true, category: true } },
                  selectedOptions: true
                }
              }
            }
          },
          payments: {
            where: { isRefund: false },
            select: {
              id: true,
              amount: true,
              paymentMethod: true,
              referenceNumber: true,
              createdAt: true,
              receipts: { select: { receiptNumber: true } }
            },
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          error: { message: 'Order not found.', code: 'ORDER_NOT_FOUND' }
        });
      }

      const friendlyStatus = CustomerPortalController.mapCustomerFriendlyStatus(order);

      const items = order.items.map((it, idx) => ({
        id: it.id,
        itemNumber: `ITEM-${idx + 1}`,
        garmentName: it.garmentType.name,
        category: it.garmentType.category,
        quantity: it.quantity,
        unitPrice: Number(it.itemPrice),
        totalPrice: Number(it.totalItemPrice),
        status: it.status,
        customerNotes: it.customerNotes,
        measurementSnapshot: it.measurementSnapshot ? {
          unit: it.measurementSnapshot.unit,
          values: it.measurementSnapshot.valuesSnapshot
        } : null,
        styles: it.styles.map(s => ({
          styleName: s.style.name,
          category: s.style.category,
          options: s.selectedOptions
        }))
      }));

      const paymentRecords = order.payments.map(p => ({
        id: p.id,
        amount: Number(p.amount),
        method: p.paymentMethod,
        receiptNumber: p.receipts[0]?.receiptNumber || null,
        date: p.createdAt.toISOString()
      }));

      return res.json({
        success: true,
        data: {
          id: order.id,
          orderNumber: order.orderNumber,
          createdAt: order.createdAt.toISOString(),
          deliveryDate: order.deliveryDate.toISOString(),
          status: order.status,
          friendlyStatus,
          customerNotes: order.customerNotes,
          billing: {
            grossAmount: Number(order.totalAmount),
            discountAmount: Number(order.discountAmount),
            netAmount: Number(order.netAmount),
            paidAmount: Number(order.paidAmount),
            balanceAmount: Number(order.balanceAmount),
            paymentStatus: order.paymentStatus,
            payments: paymentRecords,
            storeNotice: 'Customer payments are accepted in-store via Cash, UPI, or Card at fitting trial or delivery.'
          },
          items
        }
      });
    } catch (err) { next(err); }
  }

  // ---------------------------------------------------------------------------
  // 4. Customer Order Payments & Receipts
  // ---------------------------------------------------------------------------
  static async getOrderPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const resolved = await CustomerPortalController.resolveCustomerId(req);
      if (resolved.error) {
        return res.status(resolved.error.status).json({
          success: false,
          error: { message: resolved.error.message, code: resolved.error.code }
        });
      }
      const customerId = resolved.customerId!;
      const orderId = req.params.id;

      const order = await prisma.order.findFirst({
        where: {
          tenantId,
          customerId,
          OR: [{ id: orderId }, { orderNumber: orderId }]
        },
        select: {
          id: true,
          orderNumber: true,
          netAmount: true,
          paidAmount: true,
          balanceAmount: true,
          paymentStatus: true,
          payments: {
            where: { isRefund: false },
            select: {
              id: true,
              amount: true,
              paymentMethod: true,
              createdAt: true,
              receipts: { select: { receiptNumber: true } }
            },
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          error: { message: 'Order not found.', code: 'ORDER_NOT_FOUND' }
        });
      }

      return res.json({
        success: true,
        data: {
          orderNumber: order.orderNumber,
          grandTotal: Number(order.netAmount),
          totalPaid: Number(order.paidAmount),
          balanceDue: Number(order.balanceAmount),
          paymentStatus: order.paymentStatus,
          payments: order.payments.map(p => ({
            id: p.id,
            amount: Number(p.amount),
            paymentMethod: p.paymentMethod,
            receiptNumber: p.receipts[0]?.receiptNumber || null,
            date: p.createdAt.toISOString()
          })),
          notice: 'In-store manual payment records only. No online payment gateway is connected.'
        }
      });
    } catch (err) { next(err); }
  }

  // ---------------------------------------------------------------------------
  // 5. Customer Measurements (Master Fit Profile - Read Only)
  // ---------------------------------------------------------------------------
  static async getMeasurements(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const resolved = await CustomerPortalController.resolveCustomerId(req);
      if (resolved.error) {
        return res.status(resolved.error.status).json({
          success: false,
          error: { message: resolved.error.message, code: resolved.error.code }
        });
      }
      const customerId = resolved.customerId!;

      const measurements = await prisma.customerMeasurement.findMany({
        where: { customerId, tenantId, isActive: true },
        include: {
          garmentType: { select: { name: true, category: true } },
          versions: { orderBy: { versionNumber: 'desc' }, take: 1 }
        },
        orderBy: { updatedAt: 'desc' }
      });

      const fitProfiles = measurements.map(m => ({
        id: m.id,
        garmentName: m.garmentType.name,
        category: m.garmentType.category,
        unit: m.unit,
        values: (m.versions[0]?.values as Record<string, any>) || {},
        updatedAt: m.updatedAt.toISOString(),
        isApproved: true
      }));

      return res.json({
        success: true,
        data: {
          fitProfiles,
          readOnlyNotice: 'Dimensions calibrated by the atelier master cutter. To update your measurements, visit the store for a fitting session.'
        }
      });
    } catch (err) { next(err); }
  }

  // ---------------------------------------------------------------------------
  // 6. Customer Profile & Preferences
  // ---------------------------------------------------------------------------
  static async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const resolved = await CustomerPortalController.resolveCustomerId(req);
      if (resolved.error) {
        return res.status(resolved.error.status).json({
          success: false,
          error: { message: resolved.error.message, code: resolved.error.code }
        });
      }
      const customerId = resolved.customerId!;

      const customer = await prisma.customer.findFirst({
        where: { id: customerId, tenantId, isDeleted: false },
        select: {
          id: true,
          customerId: true,
          firstName: true,
          lastName: true,
          mobile: true,
          email: true,
          address: true,
          city: true,
          createdAt: true,
          preferences: {
            select: {
              fitPreference: true,
              preferredContactMethod: true,
              notes: true
            }
          },
          tenant: {
            select: {
              name: true,
              phone: true,
              email: true,
              address: true,
              currency: true
            }
          }
        }
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          error: { message: 'Customer record not found.', code: 'CUSTOMER_NOT_FOUND' }
        });
      }

      return res.json({
        success: true,
        data: {
          id: customer.id,
          customerId: customer.customerId,
          firstName: customer.firstName,
          lastName: customer.lastName,
          mobile: customer.mobile,
          email: customer.email,
          address: customer.address,
          city: customer.city,
          preferences: customer.preferences || {
            fitPreference: 'REGULAR',
            preferredContactMethod: 'WHATSAPP',
            notes: null
          },
          shop: customer.tenant
        }
      });
    } catch (err) { next(err); }
  }

  // ---------------------------------------------------------------------------
  // 7. Customer Safe Self-Service Profile Update
  // ---------------------------------------------------------------------------
  static async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const resolved = await CustomerPortalController.resolveCustomerId(req);
      if (resolved.error) {
        return res.status(resolved.error.status).json({
          success: false,
          error: { message: resolved.error.message, code: resolved.error.code }
        });
      }
      const customerId = resolved.customerId!;

      const { email, address, city, preferences } = req.body;

      // Strict rejection: customer cannot tamper with identity, mobile or tenant
      if (req.body.mobile || req.body.customerId || req.body.tenantId || req.body.id) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Primary identifiers (mobile, customer ID, tenant) are immutable.',
            code: 'IMMUTABLE_IDENTIFIER'
          }
        });
      }

      // Email validation if provided
      if (email && typeof email === 'string' && email.trim() !== '') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
          return res.status(400).json({
            success: false,
            error: { message: 'Invalid email address format.', code: 'INVALID_EMAIL' }
          });
        }
      }

      // Update customer details
      const updatedCustomer = await prisma.$transaction(async (tx) => {
        const cust = await tx.customer.update({
          where: { id: customerId },
          data: {
            ...(email !== undefined ? { email: email ? email.trim().toLowerCase() : null } : {}),
            ...(address !== undefined ? { address: address ? address.trim() : null } : {}),
            ...(city !== undefined ? { city: city ? city.trim() : null } : {})
          },
          select: {
            id: true,
            customerId: true,
            firstName: true,
            lastName: true,
            mobile: true,
            email: true,
            address: true,
            city: true
          }
        });

        // Update preferences if supplied
        if (preferences && typeof preferences === 'object') {
          const prefData = {
            tenantId,
            customerId,
            fitPreference: preferences.fitPreference || 'REGULAR',
            preferredContactMethod: preferences.preferredContactMethod || 'WHATSAPP',
            notes: preferences.notes ? String(preferences.notes).trim() : null
          };

          const existingPref = await tx.customerPreference.findFirst({
            where: { customerId, tenantId }
          });

          if (existingPref) {
            await tx.customerPreference.update({
              where: { id: existingPref.id },
              data: {
                fitPreference: prefData.fitPreference,
                preferredContactMethod: prefData.preferredContactMethod,
                notes: prefData.notes
              }
            });
          } else {
            await tx.customerPreference.create({ data: prefData });
          }
        }

        return cust;
      });

      return res.json({
        success: true,
        message: 'Profile updated successfully.',
        data: updatedCustomer
      });
    } catch (err) { next(err); }
  }
}
