import { performanceAccumulators, performanceFromTotals } from '../utils/performance';
import { assessmentAccumulators, coverageFromTotals } from '../utils/assessment';
import { getCompanySectorScope } from '../utils/processAccess';
import { Request, Response } from 'express';
import { query } from 'express-validator';
import { Process, Cycle } from '../models';
import { asyncHandler } from '../middleware/errors';
import { Types } from 'mongoose';
import { ProcessStatus, CycleStatus, UserRole } from '../types';

export const getMetricsValidation = [
    query('period').optional().matches(/^\d{4}-\d{2}$/).withMessage('Period must be in YYYY-MM format'),
];

/**
 * Get metrics for the current user
 * GET /api/metrics/me
 */
export const getMyMetrics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.user!;
    const companyId = req.companyId!;
    const { period, cycleId } = req.query;

    const matchStage: any = {
        companyId: new Types.ObjectId(companyId.toString()),
        responsibleUserId: new Types.ObjectId(userId.toString()),
        isActive: { $ne: false },
    };

    const scope = await getCompanySectorScope(req);
    if (scope !== null) matchStage.sector = { $in: scope };

    if (cycleId) {
        matchStage.cycleId = new Types.ObjectId(cycleId as string);
    } else if (period) {
        const [year, month] = (period as string).split('-').map(Number);
        const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
        const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
        matchStage.plannedDate = { $gte: startOfMonth, $lte: endOfMonth };
    } else {
        // Default to current open cycle
        const cycles = await Cycle.find({ companyId, status: CycleStatus.OPEN, ...(scope === null ? {} : { sector: { $in: scope } }) }).select('_id');
        matchStage.cycleId = { $in: cycles.map(c => c._id) };
    }

    const metrics = await Process.aggregate([
        {
            $match: matchStage,
        },
        {
            $group: {
                _id: null,
                ...performanceAccumulators(),
                ...assessmentAccumulators(),
                // Preserve legacy count semantics; validScoreCount is the sample size.
                count: { $sum: { $cond: [{ $ne: ['$status', ProcessStatus.PENDING] }, 1, 0] } },
            },
        },
    ]);

    const row = metrics[0];
    const performance = performanceFromTotals({ scoreSum: row?.scoreSum ?? 0,
        validScoreCount: row?.validScoreCount ?? 0, activeProcessCount: row?.activeProcessCount ?? 0,
        deliveredCount: row?.deliveredCount ?? 0 });
    const result = { averageScore: Math.round(performance.performanceAverage ?? 0),
        count: row?.count ?? 0, ...performance, ...coverageFromTotals(row) };

    res.json({
        success: true,
        data: result,
    });
});

/**
 * Get aggregated team metrics
 * GET /api/metrics/team
 */
export const getTeamMetrics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const companyId = req.companyId!;
    const { roles } = req.user!;
    const { period, cycleId } = req.query;

    const matchStage: any = {
        companyId: new Types.ObjectId(companyId.toString()),
        isActive: { $ne: false },
    };

    const scope = await getCompanySectorScope(req);
    if (scope !== null) matchStage.sector = { $in: scope };

    if (cycleId) {
        matchStage.cycleId = new Types.ObjectId(cycleId as string);
    } else if (period) {
        const [year, month] = (period as string).split('-').map(Number);
        const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
        const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
        matchStage.plannedDate = { $gte: startOfMonth, $lte: endOfMonth };
    } else {
        const cycles = await Cycle.find({ companyId, status: CycleStatus.OPEN, ...(scope === null ? {} : { sector: { $in: scope } }) }).select('_id');
        matchStage.cycleId = { $in: cycles.map(c => c._id) };
    }

    const metrics = await Process.aggregate([
        {
            $match: matchStage,
        },
        {
            $group: {
                _id: null,
                ...performanceAccumulators(),
                ...assessmentAccumulators(),
                // Preserve legacy count semantics; validScoreCount is the sample size.
                count: { $sum: { $cond: [{ $ne: ['$status', ProcessStatus.PENDING] }, 1, 0] } },
            },
        },
    ]);

    const row = metrics[0];
    const performance = performanceFromTotals({ scoreSum: row?.scoreSum ?? 0,
        validScoreCount: row?.validScoreCount ?? 0, activeProcessCount: row?.activeProcessCount ?? 0,
        deliveredCount: row?.deliveredCount ?? 0 });
    const result = { averageScore: Math.round(performance.performanceAverage ?? 0),
        count: row?.count ?? 0, ...performance, ...coverageFromTotals(row) };

    res.json({
        success: true,
        data: result,
    });
});

