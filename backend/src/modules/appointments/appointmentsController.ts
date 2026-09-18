import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../core/prisma';
import { AppointmentStatus, AppointmentType } from '@prisma/client';

export class AppointmentsController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate, customerId, page, limit } = req.query;
      const tenantId = req.tenantId!;

      const whereClause: any = { tenantId };
      if (customerId) whereClause.customerId = customerId as string;
      if (startDate && endDate) {
        whereClause.scheduledAt = {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string)
        };
      }

      const limitNum = limit ? parseInt(limit as string, 10) : 100;
      const pageNum = page ? parseInt(page as string, 10) : 1;
      const skip = (pageNum - 1) * limitNum;

      const [total, appointments] = await Promise.all([
        prisma.appointment.count({ where: whereClause }),
        prisma.appointment.findMany({
          where: whereClause,
          include: {
            customer: { select: { id: true, firstName: true, lastName: true, mobile: true } },
            staff: { select: { id: true, name: true, role: true } }
          },
          orderBy: { scheduledAt: 'asc' },
          skip,
          take: limitNum
        })
      ]);

      return res.json({
        success: true,
        data: appointments,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (err) { next(err); }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { customerId, staffId, type, scheduledAt, durationMinutes = 30, bufferMinutes = 10, notes } = req.body;
      const tenantId = req.tenantId!;

      const appt = await prisma.appointment.create({
        data: {
          tenantId,
          customerId,
          staffId: staffId || null,
          type: (type as AppointmentType) || AppointmentType.MEASUREMENT,
          scheduledAt: new Date(scheduledAt),
          durationMinutes: parseInt(durationMinutes, 10),
          bufferMinutes: parseInt(bufferMinutes, 10),
          notes
        },
        include: { customer: true, staff: true }
      });

      return res.status(201).json({ success: true, data: appt });
    } catch (err) { next(err); }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status, scheduledAt, notes } = req.body;
      const tenantId = req.tenantId!;

      const appt = await prisma.appointment.update({
        where: { id, tenantId },
        data: {
          status: status ? (status as AppointmentStatus) : undefined,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
          notes: notes !== undefined ? notes : undefined
        }
      });

      return res.json({ success: true, data: appt });
    } catch (err) { next(err); }
  }
}
