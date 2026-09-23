import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../core/prisma';
import { ReportDateUtils } from '../reports/reportDateUtils';

export class ImportExportController {
  // Validate & Preview CSV Import Data before committing!
  static async previewImport(req: Request, res: Response, next: NextFunction) {
    try {
      const { entity = 'CUSTOMERS', rows } = req.body;
      const tenantId = req.tenantId!;

      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ success: false, error: { message: 'No rows provided for import' } });
      }

      const validRows: any[] = [];
      const invalidRows: any[] = [];
      const errors: string[] = [];

      if (entity === 'CUSTOMERS') {
        // Collect all mobiles to batch-query the database once instead of N+1 sequential round-trips
        const candidateMobiles = rows
          .map(r => String(r.mobile || '').replace(/[^0-9]/g, ''))
          .filter(m => m.length >= 10);

        const existingDbCustomers = await prisma.customer.findMany({
          where: { tenantId, mobile: { in: candidateMobiles }, isDeleted: false },
          select: { mobile: true, firstName: true, lastName: true }
        });

        const existingMobileMap = new Map(
          existingDbCustomers.map(c => [c.mobile, `${c.firstName} ${c.lastName}`])
        );
        const seenMobilesInBatch = new Set<string>();

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowNum = i + 1;

          if (!row.firstName || !row.lastName || !row.mobile) {
            invalidRows.push(row);
            errors.push(`Row ${rowNum}: Missing mandatory fields (firstName, lastName, or mobile).`);
            continue;
          }

          // Check format of mobile
          const cleanMobile = String(row.mobile).replace(/[^0-9]/g, '');
          if (cleanMobile.length < 10) {
            invalidRows.push(row);
            errors.push(`Row ${rowNum}: Mobile '${row.mobile}' is invalid (minimum 10 digits required).`);
            continue;
          }

          // Check duplicate in database
          if (existingMobileMap.has(cleanMobile)) {
            invalidRows.push(row);
            errors.push(`Row ${rowNum}: Mobile '${cleanMobile}' already exists for ${existingMobileMap.get(cleanMobile)}.`);
            continue;
          }

          // Check duplicate within the same uploaded CSV batch
          if (seenMobilesInBatch.has(cleanMobile)) {
            invalidRows.push(row);
            errors.push(`Row ${rowNum}: Duplicate mobile '${cleanMobile}' repeated within this CSV file.`);
            continue;
          }

          seenMobilesInBatch.add(cleanMobile);
          validRows.push({
            ...row,
            mobile: cleanMobile
          });
        }
      }

      return res.json({
        success: true,
        data: {
          totalRows: rows.length,
          validCount: validRows.length,
          invalidCount: invalidRows.length,
          errors,
          validRowsPreview: validRows.slice(0, 10),
          canCommit: validRows.length > 0
        }
      });
    } catch (err) { next(err); }
  }

  // Commit validated rows atomically
  static async commitImport(req: Request, res: Response, next: NextFunction) {
    try {
      const { entity = 'CUSTOMERS', validRows } = req.body;
      const tenantId = req.tenantId!;

      if (!validRows || !Array.isArray(validRows) || validRows.length === 0) {
        return res.status(400).json({ success: false, error: { message: 'No valid rows to commit' } });
      }

      const insertedCount = await prisma.$transaction(async (tx) => {
        let count = 0;
        const currentTotal = await tx.customer.count({ where: { tenantId } });

        for (const row of validRows) {
          const customerId = `CUST-${(10001 + currentTotal + count).toString()}`;
          await tx.customer.create({
            data: {
              customerId,
              tenantId,
              firstName: String(row.firstName).trim(),
              lastName: String(row.lastName).trim(),
              mobile: String(row.mobile).trim(),
              email: row.email ? String(row.email).toLowerCase().trim() : null,
              address: row.address ? String(row.address).trim() : null,
              city: row.city ? String(row.city).trim() : null,
              notes: row.notes ? String(row.notes).trim() : null
            }
          });
          count++;
        }
        return count;
      });

      return res.json({
        success: true,
        message: `Successfully imported ${insertedCount} ${entity.toLowerCase()}.`,
        data: { importedCount: insertedCount }
      });
    } catch (err) { next(err); }
  }

  // Export Data as CSV
  static async exportData(req: Request, res: Response, next: NextFunction) {
    try {
      const { entity = 'CUSTOMERS' } = req.params;
      const tenantId = req.tenantId!;
      const { range, startDate, endDate, branchId } = req.query as {
        range?: string;
        startDate?: string;
        endDate?: string;
        branchId?: string;
      };

      // Validate branch if supplied
      if (branchId) {
        const branch = await prisma.branch.findFirst({ where: { id: branchId, tenantId } });
        if (!branch) {
          return res.status(404).json({
            success: false,
            error: { message: 'Branch not found or does not belong to your shop.', code: 'BRANCH_NOT_FOUND' }
          });
        }
      }

      // Parse date range if supplied
      let dateFilter: { gte: Date; lte: Date } | undefined;
      if (range || (startDate && endDate)) {
        const parsed = ReportDateUtils.parseDateRange({ range, startDate, endDate });
        if (!parsed.valid || !parsed.data) {
          return res.status(400).json({
            success: false,
            error: { message: parsed.error, code: parsed.code }
          });
        }
        dateFilter = { gte: parsed.data.startDate, lte: parsed.data.endDate };
      }

      // RFC 4180 CSV Escaping Helper
      const escapeCsv = (val: any): string => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      if (entity.toUpperCase() === 'CUSTOMERS') {
        const customers = await prisma.customer.findMany({
          where: {
            tenantId,
            isDeleted: false,
            ...(dateFilter ? { createdAt: dateFilter } : {})
          },
          include: { orders: { select: { netAmount: true, balanceAmount: true } } },
          orderBy: { customerId: 'asc' }
        });

        const header = 'CustomerID,FirstName,LastName,Mobile,Email,City,TotalSpend,OutstandingBalance,CreatedAt\n';
        const rows = customers.map(c => {
          const spend = c.orders.reduce((sum, o) => sum + Number(o.netAmount), 0);
          const balance = c.orders.reduce((sum, o) => sum + Number(o.balanceAmount), 0);
          return [
            escapeCsv(c.customerId),
            escapeCsv(c.firstName),
            escapeCsv(c.lastName),
            escapeCsv(c.mobile),
            escapeCsv(c.email || ''),
            escapeCsv(c.city || ''),
            escapeCsv(spend),
            escapeCsv(balance),
            escapeCsv(c.createdAt.toISOString())
          ].join(',');
        }).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="customers_export.csv"');
        return res.send(header + rows);
      }

      if (entity.toUpperCase() === 'ORDERS') {
        const orders = await prisma.order.findMany({
          where: {
            tenantId,
            ...(dateFilter ? { createdAt: dateFilter } : {}),
            ...(branchId ? { branchId } : {})
          },
          include: { customer: true },
          orderBy: { orderNumber: 'asc' }
        });

        const header = 'OrderNumber,Customer,Mobile,Status,Priority,TotalAmount,Discount,NetAmount,PaidAmount,BalanceAmount,DeliveryDate,CreatedAt\n';
        const rows = orders.map(o => {
          const customerName = `${o.customer.firstName} ${o.customer.lastName}`.trim();
          return [
            escapeCsv(o.orderNumber),
            escapeCsv(customerName),
            escapeCsv(o.customer.mobile),
            escapeCsv(o.status),
            escapeCsv(o.priority),
            escapeCsv(o.totalAmount),
            escapeCsv(o.discountAmount),
            escapeCsv(o.netAmount),
            escapeCsv(o.paidAmount),
            escapeCsv(o.balanceAmount),
            escapeCsv(o.deliveryDate.toISOString()),
            escapeCsv(o.createdAt.toISOString())
          ].join(',');
        }).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="orders_export.csv"');
        return res.send(header + rows);
      }

      if (entity.toUpperCase() === 'PAYMENTS') {
        const payments = await prisma.payment.findMany({
          where: {
            tenantId,
            ...(dateFilter ? { createdAt: dateFilter } : {}),
            ...(branchId ? { order: { branchId } } : {})
          },
          include: {
            order: { select: { orderNumber: true } },
            customer: { select: { firstName: true, lastName: true } }
          },
          orderBy: { createdAt: 'desc' }
        });

        const header = 'PaymentID,OrderNumber,Customer,Amount,Method,Reference,CreatedAt\n';
        const rows = payments.map(p => {
          const client = p.customer ? `${p.customer.firstName} ${p.customer.lastName}`.trim() : 'Direct Client';
          const orderNum = p.order?.orderNumber || 'N/A';
          return [
            escapeCsv(p.id),
            escapeCsv(orderNum),
            escapeCsv(client),
            escapeCsv(p.amount),
            escapeCsv(p.paymentMethod),
            escapeCsv(p.referenceNumber || ''),
            escapeCsv(p.createdAt.toISOString())
          ].join(',');
        }).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="payments_export.csv"');
        return res.send(header + rows);
      }

      if (entity.toUpperCase() === 'APPOINTMENTS') {
        const appointments = await prisma.appointment.findMany({
          where: {
            tenantId,
            ...(dateFilter ? { scheduledAt: dateFilter } : {})
          },
          include: { customer: true, staff: true },
          orderBy: { scheduledAt: 'desc' }
        });

        const header = 'AppointmentID,Customer,Mobile,Staff,Type,Status,ScheduledAt,DurationMinutes,Notes\n';
        const rows = appointments.map(a => {
          const client = a.customer ? `${a.customer.firstName} ${a.customer.lastName}`.trim() : 'Walk-in';
          const phone = a.customer?.mobile || '';
          const staffName = a.staff?.name || 'Unassigned';
          return [
            escapeCsv(a.id),
            escapeCsv(client),
            escapeCsv(phone),
            escapeCsv(staffName),
            escapeCsv(a.type),
            escapeCsv(a.status),
            escapeCsv(a.scheduledAt.toISOString()),
            escapeCsv(a.durationMinutes),
            escapeCsv(a.notes || '')
          ].join(',');
        }).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="appointments_export.csv"');
        return res.send(header + rows);
      }

      if (entity.toUpperCase() === 'MEASUREMENTS') {
        const measurements = await prisma.customerMeasurement.findMany({
          where: {
            tenantId,
            ...(dateFilter ? { createdAt: dateFilter } : {})
          },
          include: { customer: true, garmentType: true, versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
          orderBy: { createdAt: 'desc' }
        });

        const header = 'MeasurementID,Customer,GarmentType,Unit,LatestVersion,ValuesSnapshot,CreatedAt\n';
        const rows = measurements.map(m => {
          const client = m.customer ? `${m.customer.firstName} ${m.customer.lastName}`.trim() : '';
          const gName = m.garmentType?.name || '';
          const v = m.versions[0];
          const vals = v ? JSON.stringify(v.values) : '';
          return [
            escapeCsv(m.id),
            escapeCsv(client),
            escapeCsv(gName),
            escapeCsv(m.unit),
            escapeCsv(v?.versionNumber || 1),
            escapeCsv(vals),
            escapeCsv(m.createdAt.toISOString())
          ].join(',');
        }).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="measurements_export.csv"');
        return res.send(header + rows);
      }

      if (entity.toUpperCase() === 'PRODUCTION') {
        const jobs = await prisma.productionJob.findMany({
          where: {
            tenantId,
            ...(dateFilter ? { createdAt: dateFilter } : {}),
            ...(branchId ? { orderItem: { order: { branchId } } } : {})
          },
          include: { orderItem: { include: { order: true, garmentType: true } }, assignedTo: true },
          orderBy: { createdAt: 'desc' }
        });

        const header = 'JobID,OrderNumber,Garment,Stage,AssignedStaff,IsDelayed,DelayReason,DueDate\n';
        const rows = jobs.map(j => {
          const orderNum = j.orderItem?.order?.orderNumber || '';
          const gName = j.orderItem?.garmentType?.name || '';
          const staffName = j.assignedTo?.name || 'Unassigned';
          const dueDate = j.orderItem?.order?.deliveryDate ? j.orderItem.order.deliveryDate.toISOString() : '';
          return [
            escapeCsv(j.id),
            escapeCsv(orderNum),
            escapeCsv(gName),
            escapeCsv(j.currentStage),
            escapeCsv(staffName),
            escapeCsv(j.isDelayed),
            escapeCsv(j.delayReason || ''),
            escapeCsv(dueDate)
          ].join(',');
        }).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="production_export.csv"');
        return res.send(header + rows);
      }

      return res.status(400).json({ success: false, error: { message: 'Unsupported export entity' } });
    } catch (err) { next(err); }
  }
}
