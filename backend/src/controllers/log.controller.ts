import { Request, Response } from 'express';
import { query, param } from 'express-validator';
import { asyncHandler } from '../middleware/errors';
import { AuditLog } from '../models';
import { EmailLog } from '../models/EmailLog';
import { Types } from 'mongoose';

// Validation rules
export const listAuditLogsValidation = [
    query('entityType').optional().isString(),
    query('entityId').optional().isMongoId(),
    query('actorUserId').optional().isMongoId(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

export const listEmailLogsValidation = [
    query('processId').optional().isMongoId(),
    query('status').optional().isIn(['SENT', 'FAILED']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

export const getProcessLogsValidation = [
    param('id').isMongoId().withMessage('Invalid process ID'),
];

/**
 * List audit logs with filters
 * GET /api/logs/audit
 */
export const listAuditLogs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const companyId = req.companyId!;
    const {
        entityType,
        entityId,
        actorUserId,
        startDate,
        endDate,
        page = 1,
        limit = 20,
    } = req.query;

    const filter: Record<string, any> = { companyId: new Types.ObjectId(companyId.toString()) };

    if (entityType) filter.entityType = entityType;
    if (entityId) filter.entityId = new Types.ObjectId(entityId as string);
    if (actorUserId) filter.actorUserId = new Types.ObjectId(actorUserId as string);
    if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate as string);
        if (endDate) filter.createdAt.$lte = new Date(endDate as string);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [logs, total] = await Promise.all([
        AuditLog.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .populate('actorUserId', 'name email')
            .lean(),
        AuditLog.countDocuments(filter),
    ]);

    res.json({
        success: true,
        data: logs,
        pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit)),
        },
    });
});

/**
 * List email logs with filters
 * GET /api/logs/email
 */
export const listEmailLogs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const companyId = req.companyId!;
    const {
        processId,
        status,
        startDate,
        endDate,
        page = 1,
        limit = 20,
    } = req.query;

    const filter: Record<string, any> = { companyId: new Types.ObjectId(companyId.toString()) };

    if (processId) filter.processId = new Types.ObjectId(processId as string);
    if (status) filter.status = status;
    if (startDate || endDate) {
        filter.sentAt = {};
        if (startDate) filter.sentAt.$gte = new Date(startDate as string);
        if (endDate) filter.sentAt.$lte = new Date(endDate as string);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [logs, total] = await Promise.all([
        EmailLog.find(filter)
            .sort({ sentAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .populate('createdByUserId', 'name email')
            .lean(),
        EmailLog.countDocuments(filter),
    ]);

    res.json({
        success: true,
        data: logs,
        pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit)),
        },
    });
});

/**
 * Get combined logs (audit + email) for a specific process
 * GET /api/logs/process/:id
 */
export const getProcessLogs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const companyId = req.companyId!;
    const id = req.params.id as string;
    const processObjectId = new Types.ObjectId(id);

    const [auditLogs, emailLogs] = await Promise.all([
        AuditLog.find({
            companyId: new Types.ObjectId(companyId.toString()),
            entityType: 'process',
            entityId: processObjectId,
        })
            .sort({ createdAt: -1 })
            .limit(50)
            .populate('actorUserId', 'name email')
            .lean(),
        EmailLog.find({
            companyId: new Types.ObjectId(companyId.toString()),
            processId: processObjectId,
        })
            .sort({ sentAt: -1 })
            .limit(50)
            .populate('createdByUserId', 'name email')
            .lean(),
    ]);

    // Get last email sent
    const lastEmailSent = emailLogs.find(log => log.status === 'SENT') || null;

    res.json({
        success: true,
        data: {
            auditLogs,
            emailLogs,
            lastEmailSent,
        },
    });
});

