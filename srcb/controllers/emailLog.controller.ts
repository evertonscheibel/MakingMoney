import { Request, Response } from 'express';
import { EmailLog, EmailQueue, EmailStatus } from '../models';
import { asyncHandler, NotFoundError } from '../middleware/errors';

/**
 * List Email Logs
 * GET /api/settings/email/logs
 */
export const listEmailLogs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email, roles } = req.user!;
    const activeCompanyId = req.companyId!;
    const { page = 1, limit = 20, status, search } = req.query;

    const query: any = { companyId: activeCompanyId };

    // Operators can only see emails they created
    const { UserRole } = await import('../types');
    if (roles.includes(UserRole.OPERATOR) && !roles.includes(UserRole.MASTER) && !roles.includes(UserRole.MANAGER)) {
        query.createdByUserId = req.user!.userId;
    }

    if (status) {
        query.status = status;
    }

    if (search) {
        query.$or = [
            { to: { $regex: search, $options: 'i' } },
            { subject: { $regex: search, $options: 'i' } }
        ];
    }

    const logs = await EmailLog.find(query)
        .sort({ sentAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .populate('queueId', 'attempts nextAttemptAt');

    const total = await EmailLog.countDocuments(query);

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
 * Resend a failed email
 * POST /api/settings/email/logs/:id/resend
 */
export const resendEmail = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { activeCompanyId } = req.user!;

    const log = await EmailLog.findOne({ _id: id, companyId: activeCompanyId });
    if (!log) {
        throw new NotFoundError('Log entry');
    }

    // Clone to queue
    // Note: We need the original body. 
    // If EmailLog doesn't store body (to save space), we might need to fetch from EmailQueue if it still exists.
    // If EmailQueue item is gone (archived?), we can't resend unless we stored body in Log.
    // Current design: EmailQueue items stay? Or Log has metadata?
    // Let's check if queue item exists.

    let originalBody: { html: string; text?: string } = { html: '', text: '' };

    if (log.queueId) {
        const queueItem = await EmailQueue.findById(log.queueId);
        if (queueItem) {
            originalBody = queueItem.body;
        }
    }

    if (!originalBody.html) {
        // Use a placeholder or error if we can't recover content
        // In "Complete Module" we should probably store body in log (maybe truncated) OR keep failed queue items.
        // Let's assume queue item persist for FAILED state.
        throw new Error('Original content not found. Cannot resend.');
    }

    // Create new queue item
    await EmailQueue.create({
        companyId: activeCompanyId,
        to: log.to,
        subject: log.subject,
        body: originalBody,
        category: log.category || 'resend',
        status: EmailStatus.PENDING,
        metadata: { originalLogId: log._id }
    });

    res.json({
        success: true,
        message: 'Email queued for resending'
    });
});

