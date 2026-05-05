import { Request, Response } from 'express';
import { body } from 'express-validator';
import { EvaluationConfig, getDefaultRules } from '../models';
import { asyncHandler, NotFoundError } from '../middleware/errors';
import { auditAction } from '../middleware/audit';
import { AuditAction, EntityType, IEvaluationRules } from '../types';
import { calculateScore } from '../utils';

// Validation rules
export const createConfigValidation = [
    body('rules').isObject().withMessage('Rules must be an object'),
    body('rules.earlyDeliveryScore').isInt({ min: 0, max: 100 }).withMessage('Invalid score'),
    body('rules.onTimeScore').isInt({ min: 0, max: 100 }).withMessage('Invalid score'),
    body('rules.halfwayScore').isInt({ min: 0, max: 100 }).withMessage('Invalid score'),
    body('rules.lateScore').isInt({ min: 0, max: 100 }).withMessage('Invalid score'),
    body('rules.criticalScore').isInt({ min: 0, max: 100 }).withMessage('Invalid score'),
    body('rules.toleranceDays').isInt({ min: 0 }).withMessage('Tolerance must be >= 0'),
    body('rules.notificationEmails').optional().isArray().withMessage('Emails must be an array'),
];

export const simulateScoreValidation = [
    body('plannedDate').isISO8601().withMessage('Invalid planned date'),
    body('limitDate').isISO8601().withMessage('Invalid limit date'),
    body('deliveryDate').isISO8601().withMessage('Invalid delivery date'),
    body('rules').optional().isObject().withMessage('Rules must be an object'),
];

/**
 * Get active evaluation config
 * GET /api/evaluation/active
 */
export const getActiveConfig = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const activeCompanyId = req.companyId!;

    const config = await EvaluationConfig.findOne({
        companyId: activeCompanyId,
        isActive: true,
    });

    if (!config) {
        // Return default config if none exists
        res.json({
            success: true,
            data: {
                rules: getDefaultRules(),
                version: 0,
                isDefault: true,
            },
        });
        return;
    }

    res.json({
        success: true,
        data: config,
    });
});

/**
 * Create new evaluation config version
 * POST /api/evaluation
 */
export const createConfig = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const activeCompanyId = req.companyId!;
    const { userId } = req.user!;
    const { rules } = req.body;

    // Get current version
    const lastConfig = await EvaluationConfig.findOne({
        companyId: activeCompanyId,
    }).sort({ version: -1 });

    const newVersion = (lastConfig?.version || 0) + 1;

    // Deactivate previous active config
    await EvaluationConfig.updateMany(
        { companyId: activeCompanyId, isActive: true },
        { isActive: false }
    );

    // Create new config
    const config = await EvaluationConfig.create({
        companyId: activeCompanyId,
        version: newVersion,
        rules,
        createdBy: userId,
        isActive: true,
    });

    // Audit log
    await auditAction(
        req,
        AuditAction.CREATE,
        EntityType.CONFIG,
        config._id.toString(),
        lastConfig?.toObject() as any || null,
        config.toObject() as any
    );

    res.status(201).json({
        success: true,
        data: config,
        message: `Evaluation config v${newVersion} created and activated`,
    });
});

/**
 * Get config version history
 * GET /api/evaluation/history
 */
export const getConfigHistory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const activeCompanyId = req.companyId!;

    const configs = await EvaluationConfig.find({
        companyId: activeCompanyId,
    })
        .sort({ version: -1 })
        .limit(10)
        .populate('createdBy', 'name email');

    res.json({
        success: true,
        data: configs,
    });
});

/**
 * Simulate score calculation
 * POST /api/evaluation/simulate
 */
export const simulateScore = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const activeCompanyId = req.companyId!;
    const { plannedDate, limitDate, deliveryDate, rules: customRules } = req.body;

    // Get rules to use
    let rules: IEvaluationRules;

    if (customRules) {
        rules = customRules;
    } else {
        const config = await EvaluationConfig.findOne({
            companyId: activeCompanyId,
            isActive: true,
        });
        rules = config?.rules || getDefaultRules();
    }

    const result = calculateScore(
        new Date(plannedDate),
        new Date(limitDate),
        new Date(deliveryDate),
        rules
    );

    res.json({
        success: true,
        data: {
            plannedDate,
            limitDate,
            deliveryDate,
            rules,
            result,
        },
    });
});

