import { Request, Response } from 'express';
import { query } from 'express-validator';
import { Process, User } from '../models';
import { asyncHandler } from '../middleware/errors';
import { ProcessStatus, UserRole, EntityType, AuditAction } from '../types';
import { auditAction } from '../middleware/audit';
import { Types } from 'mongoose';

export const bonusValidation = [
    query('from').isISO8601().withMessage('From date must be a valid ISO8601 date'),
    query('to').isISO8601().withMessage('To date must be a valid ISO8601 date'),
    query('baseValue').optional().isNumeric().withMessage('Base value must be a number'),
];

/**
 * Calculate bonus preview for a period
 * GET /api/bonus/preview
 */
export const calculateBonusPreview = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { from, to, baseValue = 1000 } = req.query;
    const companyId = req.companyId!;
    const { roles, userId } = req.user!;

    const startDate = new Date(from as string);
    const endDate = new Date(to as string);
    endDate.setHours(23, 59, 59, 999);

    const isOperator = roles.includes(UserRole.OPERATOR) && !roles.includes(UserRole.MASTER) && !roles.includes(UserRole.MANAGER);

    const matchFilter: any = {
        companyId: new Types.ObjectId(companyId.toString()),
        plannedDate: { $gte: startDate, $lte: endDate },
        status: { $ne: ProcessStatus.PENDING },
        isActive: { $ne: false },
    };

    if (isOperator) {
        matchFilter.responsibleUserId = new Types.ObjectId(userId.toString());
    }

    const aggregation = await Process.aggregate([
        { $match: matchFilter },
        {
            $group: {
                _id: '$responsibleUserId',
                avgScore: { $avg: '$score' },
                processCount: { $sum: 1 },
            }
        },
        {
            $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'userInfo'
            }
        },
        {
            $unwind: '$userInfo'
        },
        {
            $project: {
                userId: '$_id',
                userName: '$userInfo.name',
                avgScore: { $round: ['$avgScore', 2] },
                processCount: 1,
                bonus: {
                    $round: [
                        { $multiply: [Number(baseValue), { $divide: ['$avgScore', 100] }] },
                        2
                    ]
                }
            }
        },
        { $sort: { userName: 1 } }
    ]);

    // Audit the calculation
    await auditAction(
        req,
        AuditAction.UPDATE, // Use an existing action from Enum
        EntityType.COMPANY,
        companyId.toString(),
        null,
        { period: { from, to }, baseValue }
    );

    res.json({
        success: true,
        data: aggregation,
    });
});

