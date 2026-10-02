import { Request, Response } from 'express';
import { query, param } from 'express-validator';
import { asyncHandler } from '../middleware/errors';
import { AuditLog, Cycle } from '../models';
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

export const listDateChangesValidation = [
    query('month').optional().matches(/^\d{4}-\d{2}$/),
    query('sector').optional().isString(),
];

const DATE_CHANGE_TZ = 'America/Cuiaba';
const toDay = (value: unknown) => (value ? new Date(value as string).toISOString().slice(0, 10) : null);

/**
 * Process date changes (planned/limit), derived from the process audit trail.
 * GET /api/logs/date-changes?month=YYYY-MM&sector=
 * `month` is the month the change was made (Cuiabá time); defaults to the latest month with changes.
 */
export const listDateChanges = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const companyId = new Types.ObjectId(req.companyId!.toString());
    const { month, sector } = req.query as { month?: string; sector?: string };

    const changedDates = {
        companyId,
        entityType: 'process',
        action: { $in: ['UPDATE', 'REVERT_DELIVERY'] },
        'before.plannedDate': { $exists: true },
        'after.plannedDate': { $exists: true },
        $expr: { $or: [{ $ne: ['$before.plannedDate', '$after.plannedDate'] }, { $ne: ['$before.limitDate', '$after.limitDate'] }] },
    };
    const changeMonth = { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: DATE_CHANGE_TZ } };

    const monthCounts = await AuditLog.aggregate([
        { $match: changedDates },
        { $group: { _id: changeMonth, total: { $sum: 1 } } },
        { $sort: { _id: -1 } },
    ]);
    const selectedMonth = month || monthCounts[0]?._id || null;
    if (!selectedMonth) {
        res.json({ success: true, data: { month: null, months: [], sectors: [], changes: [] } });
        return;
    }

    const logs = await AuditLog.aggregate([
        { $match: changedDates },
        { $match: { $expr: { $eq: [changeMonth, selectedMonth] } } },
        { $sort: { createdAt: -1 } },
        { $lookup: { from: 'users', localField: 'actorUserId', foreignField: '_id', as: 'actor', pipeline: [{ $project: { name: 1, email: 1 } }] } },
    ]);

    const cycleIds = [...new Set(logs.map((log) => String(log.after?.cycleId || '')).filter(Boolean))];
    const cycles = await Cycle.find({ _id: { $in: cycleIds } }).select('month').lean();
    const cycleMonth = new Map(cycles.map((cycle: any) => [String(cycle._id), cycle.month]));

    const all = logs.map((log) => ({
        id: String(log._id),
        changedAt: log.createdAt,
        changedBy: log.actor[0] ? { name: log.actor[0].name, email: log.actor[0].email } : null,
        processId: String(log.entityId),
        code: log.after?.code || log.before?.code,
        title: log.after?.title || log.before?.title,
        sector: log.after?.sector || log.before?.sector,
        cycleMonth: cycleMonth.get(String(log.after?.cycleId)) || null,
        plannedDate: { from: toDay(log.before?.plannedDate), to: toDay(log.after?.plannedDate) },
        limitDate: { from: toDay(log.before?.limitDate), to: toDay(log.after?.limitDate) },
    }));
    const sectors = [...new Set(all.map((change) => change.sector).filter(Boolean))].sort();

    res.json({
        success: true,
        data: {
            month: selectedMonth,
            months: monthCounts.map((item) => ({ month: item._id, total: item.total })),
            sectors,
            changes: sector ? all.filter((change) => change.sector === sector) : all,
        },
    });
});
