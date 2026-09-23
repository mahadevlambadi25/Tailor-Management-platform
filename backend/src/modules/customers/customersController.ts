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
        const orConditions: any[] = [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { mobile: { contains: query } },
          { email: { contains: query, mode: 'insensitive' } },
          { customerId: { contains: query, mode: 'insensitive' } },
          { orders: { some: { orderNumber: { contains: query, mode: 'insensitive' } } } }
        ];

        // Multi-word name search (e.g., "Rajesh Kumar" -> firstName "Rajesh", lastName "Kumar")
        const terms = query.split(/\s+/).filter(Boolean);
        if (terms.length > 1) {
          orConditions.push({
            AND: terms.map(term => ({
              OR: [
                { firstName: { contains: term, mode: 'insensitive' } },
                { lastName: { contains: term, mode: 'insensitive' } },
                { mobile: { contains: term } },
                { email: { contains: term, mode: 'insensitive' } }
              ]
            }))
          });
        }

        // Clean digits phone search (e.g. "+91 98765-43210" or "98765 43210")
        const cleanDigits = query.replace(/\D/g, '');
        if (cleanDigits.length >= 4) {
          orConditions.push({ mobile: { contains: cleanDigits } });
        }

        whereClause.OR = orConditions;
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
        return res.status(404).json({
          success: false,
          error: { message: 'Customer not found or access denied.', code: 'CUSTOMER_NOT_FOUND' }
        });
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
      const {
        firstName,
        lastName,
        mobile,
        whatsapp,
        email,
        gender,
        dob,
        address,
        city,
        state,
        pincode,
        notes,
        preferences
      } = req.body;
      const tenantId = req.tenantId!;

      // 1. Mandatory Fields Validation
      if (!firstName || !firstName.toString().trim() || !lastName || !lastName.toString().trim() || !mobile || !mobile.toString().trim()) {
        return res.status(400).json({
          success: false,
          error: { message: 'First name, last name, and mobile number are mandatory.', code: 'MISSING_FIELDS' }
        });
      }

      // 2. Mobile validation (minimum 7 digits, maximum 15 digits)
      const cleanMobile = mobile.toString().trim();
      const mobileDigits = cleanMobile.replace(/\D/g, '');
      if (mobileDigits.length < 7 || mobileDigits.length > 15) {
        return res.status(400).json({
          success: false,
          error: { message: 'Please enter a valid mobile number (7 to 15 digits).', code: 'INVALID_PHONE' }
        });
      }

      // 3. Email validation if provided
      const cleanEmail = email ? email.toString().trim().toLowerCase() : null;
      if (cleanEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanEmail)) {
          return res.status(400).json({
            success: false,
            error: { message: 'Please provide a valid email address.', code: 'INVALID_EMAIL' }
          });
        }
      }

      // 4. WhatsApp handling & preferences compilation
      const cleanWhatsApp = whatsapp ? whatsapp.toString().trim() : null;
      if (cleanWhatsApp) {
        const waDigits = cleanWhatsApp.replace(/\D/g, '');
        if (waDigits.length < 7 || waDigits.length > 15) {
          return res.status(400).json({
            success: false,
            error: { message: 'Please enter a valid WhatsApp number (7 to 15 digits).', code: 'INVALID_WHATSAPP' }
          });
        }
      }

      // Check duplicate mobile in tenant (both exact trim and digit match)
      const existing = await prisma.customer.findFirst({
        where: {
          tenantId,
          isDeleted: false,
          OR: [
            { mobile: cleanMobile },
            { mobile: mobileDigits }
          ]
        }
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          error: {
            message: `Customer with mobile ${cleanMobile} already exists (${existing.firstName} ${existing.lastName}).`,
            code: 'DUPLICATE_MOBILE',
            existingCustomerId: existing.id,
            existingCustomerName: `${existing.firstName} ${existing.lastName}`
          }
        });
      }

      // Consolidate customer notes (append whatsapp number if distinct from mobile)
      let combinedNotes = notes ? notes.toString().trim() : '';
      if (cleanWhatsApp && cleanWhatsApp !== cleanMobile) {
        const waNote = `WhatsApp: ${cleanWhatsApp}`;
        combinedNotes = combinedNotes ? `${combinedNotes} | ${waNote}` : waNote;
      }

      // Preferred contact method: default to WHATSAPP if WhatsApp provided, otherwise PHONE or user preference
      const preferredContactMethod = preferences?.preferredContactMethod || (cleanWhatsApp ? 'WHATSAPP' : 'PHONE');

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
              firstName: firstName.toString().trim(),
              lastName: lastName.toString().trim(),
              mobile: cleanMobile,
              email: cleanEmail,
              gender: gender ? gender.toString().trim() : null,
              dob: dob ? new Date(dob) : null,
              address: address ? address.toString().trim() : null,
              city: city ? city.toString().trim() : null,
              state: state ? state.toString().trim() : null,
              pincode: pincode ? pincode.toString().trim() : null,
              notes: combinedNotes || null,
              preferences: {
                create: {
                  tenantId,
                  preferredContactMethod,
                  fabricPreferences: preferences?.fabricPreferences || null,
                  fitPreference: preferences?.fitPreference || null,
                  notes: preferences?.notes || (cleanWhatsApp ? `WhatsApp: ${cleanWhatsApp}` : null)
                }
              }
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

      // 1. Verify customer exists within current tenant
      const existing = await prisma.customer.findFirst({
        where: { id, tenantId }
      });
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: { message: 'Customer not found or access denied.', code: 'CUSTOMER_NOT_FOUND' }
        });
      }

      // 2. Validate mobile if updated
      const updateData: any = {};
      if (firstName !== undefined) {
        if (!firstName.toString().trim()) {
          return res.status(400).json({ success: false, error: { message: 'First name cannot be empty.', code: 'INVALID_NAME' } });
        }
        updateData.firstName = firstName.toString().trim();
      }

      if (lastName !== undefined) {
        if (!lastName.toString().trim()) {
          return res.status(400).json({ success: false, error: { message: 'Last name cannot be empty.', code: 'INVALID_NAME' } });
        }
        updateData.lastName = lastName.toString().trim();
      }

      if (mobile !== undefined) {
        const cleanMobile = mobile.toString().trim();
        const digits = cleanMobile.replace(/\D/g, '');
        if (digits.length < 7 || digits.length > 15) {
          return res.status(400).json({
            success: false,
            error: { message: 'Please enter a valid mobile number (7 to 15 digits).', code: 'INVALID_PHONE' }
          });
        }

        if (cleanMobile !== existing.mobile) {
          // Check for duplicate in the same tenant
          const duplicate = await prisma.customer.findFirst({
            where: {
              tenantId,
              isDeleted: false,
              NOT: { id },
              OR: [{ mobile: cleanMobile }, { mobile: digits }]
            }
          });
          if (duplicate) {
            return res.status(409).json({
              success: false,
              error: {
                message: `Another customer with mobile ${cleanMobile} already exists (${duplicate.firstName} ${duplicate.lastName}).`,
                code: 'DUPLICATE_MOBILE',
                existingCustomerId: duplicate.id
              }
            });
          }
        }
        updateData.mobile = cleanMobile;
      }

      if (email !== undefined) {
        const cleanEmail = email ? email.toString().trim().toLowerCase() : null;
        if (cleanEmail) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(cleanEmail)) {
            return res.status(400).json({
              success: false,
              error: { message: 'Please provide a valid email address.', code: 'INVALID_EMAIL' }
            });
          }
        }
        updateData.email = cleanEmail;
      }

      if (gender !== undefined) updateData.gender = gender ? gender.toString().trim() : null;
      if (dob !== undefined) updateData.dob = dob ? new Date(dob) : null;
      if (address !== undefined) updateData.address = address ? address.toString().trim() : null;
      if (city !== undefined) updateData.city = city ? city.toString().trim() : null;
      if (state !== undefined) updateData.state = state ? state.toString().trim() : null;
      if (pincode !== undefined) updateData.pincode = pincode ? pincode.toString().trim() : null;
      if (notes !== undefined) updateData.notes = notes ? notes.toString().trim() : null;

      const customer = await prisma.customer.update({
        where: { id },
        data: updateData,
        include: { preferences: true }
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: req.user?.id,
          customerId: customer.id,
          action: 'CUSTOMER_UPDATED',
          entity: 'Customer',
          entityId: customer.id,
          details: { name: `${customer.firstName} ${customer.lastName}`, mobile: customer.mobile }
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

      const existing = await prisma.customer.findFirst({
        where: { id, tenantId }
      });
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: { message: 'Customer not found or access denied.', code: 'CUSTOMER_NOT_FOUND' }
        });
      }

      const customer = await prisma.customer.update({
        where: { id },
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

      const existing = await prisma.customer.findFirst({
        where: { id, tenantId }
      });
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: { message: 'Customer not found or access denied.', code: 'CUSTOMER_NOT_FOUND' }
        });
      }

      const customer = await prisma.customer.update({
        where: { id },
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

      // Strictly verify customer exists and belongs to this tenant!
      const customer = await prisma.customer.findFirst({
        where: { id, tenantId }
      });
      if (!customer) {
        return res.status(404).json({
          success: false,
          error: { message: 'Customer not found or access denied.', code: 'CUSTOMER_NOT_FOUND' }
        });
      }

      const pref = await prisma.customerPreference.upsert({
        where: { customerId: id },
        update: {
          preferredContactMethod: preferredContactMethod || undefined,
          fabricPreferences: fabricPreferences !== undefined ? fabricPreferences : undefined,
          fitPreference: fitPreference !== undefined ? fitPreference : undefined,
          notes: notes !== undefined ? notes : undefined
        },
        create: {
          customerId: id,
          tenantId,
          preferredContactMethod: preferredContactMethod || 'PHONE',
          fabricPreferences: fabricPreferences || null,
          fitPreference: fitPreference || null,
          notes: notes || null
        }
      });

      return res.json({ success: true, data: pref });
    } catch (err) { next(err); }
  }
}

