import { prisma } from '../../core/prisma';
import { logger } from '../../core/logger';
import { track } from './funnelService';
import { UnitSystem } from '@prisma/client';

export interface RawImportRow {
  name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  mobile?: string;
  notes?: string;
  chest?: string | number;
  waist?: string | number;
  hip?: string | number;
  length?: string | number;
  shoulder?: string | number;
  sleeve?: string | number;
  neck?: string | number;
  [key: string]: any;
}

export class CustomerImportService {
  /**
   * Previews and validates rows for customer import.
   * Performs phone duplication checks against existing database and within batch.
   */
  static async preview(tenantId: string, rows: RawImportRow[], columnMapping?: Record<string, string>) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('No rows provided for import preview');
    }

    const validRows: any[] = [];
    const invalidRows: any[] = [];
    const duplicateRows: any[] = [];
    const errors: string[] = [];

    // Extract all candidate phone numbers to batch-check
    const candidatePhones = rows
      .map(r => {
        const rawPhone = columnMapping?.phone ? r[columnMapping.phone] : (r.phone || r.mobile);
        return String(rawPhone || '').replace(/[^0-9]/g, '');
      })
      .filter(p => p.length >= 10);

    const existingCustomers = await prisma.customer.findMany({
      where: {
        tenantId,
        mobile: { in: candidatePhones },
        isDeleted: false
      },
      select: { mobile: true, firstName: true, lastName: true }
    });

    const existingPhoneMap = new Map(existingCustomers.map(c => [c.mobile, `${c.firstName} ${c.lastName}`]));
    const seenPhonesInBatch = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      // Extract Name
      let firstName = '';
      let lastName = '';

      if (columnMapping?.name && row[columnMapping.name]) {
        const parts = String(row[columnMapping.name]).trim().split(/\s+/);
        firstName = parts[0] || '';
        lastName = parts.slice(1).join(' ') || 'Customer';
      } else if (row.firstName || row.lastName) {
        firstName = String(row.firstName || '').trim();
        lastName = String(row.lastName || 'Customer').trim();
      } else if (row.name) {
        const parts = String(row.name).trim().split(/\s+/);
        firstName = parts[0] || '';
        lastName = parts.slice(1).join(' ') || 'Customer';
      }

      // Extract Phone
      const rawPhone = columnMapping?.phone ? row[columnMapping.phone] : (row.phone || row.mobile);
      const cleanPhone = String(rawPhone || '').replace(/[^0-9]/g, '');

      // Extract Notes
      const notes = columnMapping?.notes ? row[columnMapping.notes] : row.notes;

      // Extract Measurements
      const measurements: Record<string, number> = {};
      const measurementKeys = ['chest', 'waist', 'hip', 'length', 'shoulder', 'sleeve', 'neck'];
      for (const mKey of measurementKeys) {
        const val = columnMapping?.[mKey] ? row[columnMapping[mKey]] : row[mKey];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          const num = parseFloat(String(val).replace(/[^0-9.]/g, ''));
          if (!isNaN(num) && num > 0) {
            const capitalized = mKey.charAt(0).toUpperCase() + mKey.slice(1);
            measurements[capitalized] = num;
          }
        }
      }

      if (!firstName) {
        invalidRows.push({ rowNum, row, reason: 'Missing customer name' });
        errors.push(`Row ${rowNum}: Missing customer name.`);
        continue;
      }

      if (cleanPhone.length < 10) {
        invalidRows.push({ rowNum, row, reason: 'Invalid phone number (must be at least 10 digits)' });
        errors.push(`Row ${rowNum}: Invalid phone number '${rawPhone}'.`);
        continue;
      }

      // Duplicate check in database
      if (existingPhoneMap.has(cleanPhone)) {
        duplicateRows.push({
          rowNum,
          row,
          reason: `Phone already exists for existing customer: ${existingPhoneMap.get(cleanPhone)}`
        });
        errors.push(`Row ${rowNum}: Phone '${cleanPhone}' already exists in your shop.`);
        continue;
      }

      // Duplicate check in current file
      if (seenPhonesInBatch.has(cleanPhone)) {
        duplicateRows.push({ rowNum, row, reason: 'Duplicate phone repeated in this file' });
        errors.push(`Row ${rowNum}: Duplicate phone '${cleanPhone}' repeated in this file.`);
        continue;
      }

      seenPhonesInBatch.add(cleanPhone);
      validRows.push({
        firstName,
        lastName,
        mobile: cleanPhone,
        notes: notes ? String(notes).trim() : null,
        measurements: Object.keys(measurements).length > 0 ? measurements : null
      });
    }

    return {
      totalRows: rows.length,
      validCount: validRows.length,
      invalidCount: invalidRows.length,
      duplicateCount: duplicateRows.length,
      errors: errors.slice(0, 20),
      previewRows: validRows.slice(0, 10),
      canCommit: validRows.length > 0,
      validRows
    };
  }

  /**
   * Atomically commits validated customers.
   * GUARANTEE: Imported records are REAL records (isSample: false).
   */
  static async commit(tenantId: string, validRows: any[], userId?: string) {
    if (!Array.isArray(validRows) || validRows.length === 0) {
      throw new Error('No valid rows to commit');
    }

    // Find or create default garment type for measurement attachments
    let garmentType = await prisma.garmentType.findFirst({ where: { tenantId } });
    if (!garmentType) {
      garmentType = await prisma.garmentType.create({
        data: {
          tenantId,
          name: 'General Sizing',
          code: `GEN-${tenantId.slice(0, 4)}`,
          category: 'UNISEX',
          defaultPrice: 1000
        }
      });
    }

    const insertedCount = await prisma.$transaction(async (tx) => {
      let count = 0;
      const currentTotal = await tx.customer.count({ where: { tenantId } });

      for (const row of validRows) {
        const customerId = `CUST-${(10001 + currentTotal + count).toString()}`;
        const newCustomer = await tx.customer.create({
          data: {
            customerId,
            tenantId,
            firstName: row.firstName,
            lastName: row.lastName,
            mobile: row.mobile,
            notes: row.notes,
            isSample: false, // Explicitly real record!
            isDemo: false
          }
        });

        // If measurements were mapped/provided, create customer measurement record
        if (row.measurements && Object.keys(row.measurements).length > 0) {
          await tx.customerMeasurement.create({
            data: {
              tenantId,
              customerId: newCustomer.id,
              garmentTypeId: garmentType.id,
              name: 'Imported Measurements',
              unit: UnitSystem.INCHES,
              versions: {
                create: {
                  versionNumber: 1,
                  values: row.measurements,
                  notes: 'Imported from customer file'
                }
              }
            }
          });
        }

        count++;
      }
      return count;
    });

    // Track import_completed
    await track(tenantId, 'import_completed', {
      count: insertedCount
    }, userId);

    logger.info(`[CustomerImport] Successfully imported ${insertedCount} real customers for tenant ${tenantId}`);
    return { importedCount: insertedCount };
  }
}
