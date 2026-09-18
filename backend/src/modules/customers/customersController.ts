import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../core/prisma';

export class CustomersController {
  // List & Global Search
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, page = '1', limit = '20', includeDeleted } = req.query;
      const tenantId = req.tenantId!;
      const take = parseInt(limit as string, 10);
      const skip = (parseInt(page as string, 10) - 1) * take;

      const whereClause: any = {
        tenantId,
        isDeleted: includeDeleted === 'true' ? undefined : false
      };

      if (search) {
        const query = (search as string).trim();
        whereClause.OR = [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { mobile: { contains: query } },
          { email: { contains: query, mode: 'insensitive' } },
          { customerId: { contains: query, mode: 'insensitive' } },
          { orders: { some: { orderNumber: { contains: query, mode: 'insensitive' } } } }
        ];
      }

      const [total, customers] = await Promise.all([
        prisma.customer.count({ where: whereClause }),
        prisma.customer.findMany({
          where: whereClause,
          include: {
            orders: {
              select: { id: true, netAmount: true, paidAmount: true, balanceAmount: true, createdAt: true },
              orderBy: { createdAt: 'desc' },
              take: 5
            },
            _count: {
              select: { orders: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take
        })
      ]);

      // Calculate aggregated metrics for each customer
      const enriched = customers.map(c => {
        const totalSpend = c.orders.reduce((sum, o) => sum + Number(o.netAmount), 0);
        const outstandingBalance = c.orders.reduce((sum, o) => sum + Number(o.balanceAmount), 0);
        const lastOrderDate = c.orders[0]?.createdAt || null;
        return {
          ...c,
          totalSpend,
          outstandingBalance,
          lastOrderDate,
          orderCount: (c as any)._count?.orders ?? c.orders.length
        };
      });

      return res.json({
        success: true,
        data: {
          customers: enriched,
          pagination: { total, page: parseInt(page as string, 10), limit: take, pages: Math.ceil(total / take) }
        }
      });
    } catch (err) { next(err); }
  }

  // Get Customer Full Profile (11 Tabs)
  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;

      const customer = await prisma.customer.findFirst({
        where: { id, tenantId },
        include: {
          preferences: true,
          photos: { orderBy: { createdAt: 'desc' } },
          documents: { orderBy: { createdAt: 'desc' } },
          measurements: {
            include: {
              garmentType: true,
              versions: { orderBy: { versionNumber: 'desc' } }
            }
          },
          customerStyles: {
            include: { style: { include: { garmentType: true } } }
          },
          orders: {
            include: {
              items: {
                include: {
                  garmentType: true,
                  measurementSnapshot: true,
                  productionJob: true
                }
              },
              payments: true
            },
            orderBy: { createdAt: 'desc' }
          },
          payments: { orderBy: { createdAt: 'desc' } },
          trials: {
            include: { orderItem: { include: { garmentType: true } }, alterations: true },
            orderBy: { createdAt: 'desc' }
          },
          alterations: { orderBy: { createdAt: 'desc' } },
          appointments: {
            include: { staff: { select: { name: true } } },
            orderBy: { scheduledAt: 'desc' }
          },
          auditLogs: {
            include: { user: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 30
          }
        }
      });

      if (!customer) {
        return res.status(404).json({ success: false, error: { message: 'Customer not found' } });
      }

      const totalSpend = customer.orders.reduce((sum, o) => sum + Number(o.netAmount), 0);
      const outstandingBalance = customer.orders.reduce((sum, o) => sum + Number(o.balanceAmount), 0);

      return res.json({
        success: true,
        data: {
          ...customer,
          totalSpend,
          outstandingBalance
        }
      });
    } catch (err) { next(err); }
  }

  // Create Customer
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { firstName, lastName, mobile, email, gender, dob, address, city, state, pincode, notes, preferences } = req.body;
      const tenantId = req.tenantId!;

      if (!firstName || !lastName || !mobile) {
        return res.status(400).json({
          success: false,
          error: { message: 'First name, last name, and mobile number are mandatory.', code: 'MISSING_FIELDS' }
        });
      }

      // Check duplicate mobile in tenant
      const existing = await prisma.customer.findFirst({
        where: { tenantId, mobile, isDeleted: false }
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          error: { message: `Customer with mobile ${mobile} already exists (${existing.firstName} ${existing.lastName}).`, code: 'DUPLICATE_MOBILE', existingCustomerId: existing.id }
        });
      }

      // Generate next customer ID collision-safe with concurrency retry
      let customer: any = null;
      let attempts = 0;
      const baseCount = await prisma.customer.count({ where: { tenantId } });

      while (attempts < 5 && !customer) {
        attempts++;
        const candidateSeq = 10001 + baseCount + (attempts - 1);
        const customerId = `CUST-${candidateSeq}`;
        try {
          customer = await prisma.customer.create({
            data: {
              customerId,
              tenantId,
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              mobile: mobile.trim(),
              email: email ? email.toLowerCase().trim() : null,
              gender,
              dob: dob ? new Date(dob) : null,
              address,
              city,
              state,
              pincode,
              notes,
              preferences: preferences ? {
                create: {
                  tenantId,
                  preferredContactMethod: preferences.preferredContactMethod || 'PHONE',
                  fabricPreferences: preferences.fabricPreferences,
                  fitPreference: preferences.fitPreference,
                  notes: preferences.notes
                }
              } : undefined
            },
            include: { preferences: true }
          });
        } catch (err: any) {
          if (err.code === 'P2002' && attempts < 5) {
            continue; // Retry with incremented sequence
          }
          throw err;
        }
      }

      // Audit Log
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: req.user?.id,
          customerId: customer.id,
          action: 'CUSTOMER_CREATED',
          entity: 'Customer',
          entityId: customer.id,
          details: { name: `${customer.firstName} ${customer.lastName}`, mobile: customer.mobile }
        }
      });

      return res.status(201).json({ success: true, data: customer });
    } catch (err) { next(err); }
  }

  // Update Customer
  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { firstName, lastName, mobile, email, gender, dob, address, city, state, pincode, notes } = req.body;
      const tenantId = req.tenantId!;

      const customer = await prisma.customer.update({
        where: { id, tenantId },
        data: {
          firstName,
          lastName,
          mobile,
          email,
          gender,
          dob: dob ? new Date(dob) : undefined,
          address,
          city,
          state,
          pincode,
          notes
        }
      });

      return res.json({ success: true, data: customer });
    } catch (err) { next(err); }
  }

  // Soft Delete Customer
  static async softDelete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { deletionReason } = req.body;
      const tenantId = req.tenantId!;

      const customer = await prisma.customer.update({
        where: { id, tenantId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: req.user?.id || 'Unknown',
          deletionReason: deletionReason || 'Requested by staff'
        }
      });

      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: req.user?.id,
          customerId: customer.id,
          action: 'CUSTOMER_DELETED',
          entity: 'Customer',
          entityId: customer.id,
          details: { deletionReason }
        }
      });

      return res.json({ success: true, message: 'Customer soft-deleted successfully', data: customer });
    } catch (err) { next(err); }
  }

  // Restore Customer
  static async restore(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;

      const customer = await prisma.customer.update({
        where: { id, tenantId },
        data: {
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
          deletionReason: null
        }
      });

      return res.json({ success: true, message: 'Customer restored successfully', data: customer });
    } catch (err) { next(err); }
  }

  // Update Customer Preferences
  static async updatePreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { preferredContactMethod, fabricPreferences, fitPreference, notes } = req.body;
      const tenantId = req.tenantId!;

      const pref = await prisma.customerPreference.upsert({
        where: { customerId: id },
        update: { preferredContactMethod, fabricPreferences, fitPreference, notes },
        create: { customerId: id, tenantId, preferredContactMethod, fabricPreferences, fitPreference, notes }
      });

      return res.json({ success: true, data: pref });
    } catch (err) { next(err); }
  }
}
