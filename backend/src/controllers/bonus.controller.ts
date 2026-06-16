import { Request, Response } from 'express';
import { query } from 'express-validator';
import { Process, User, EvaluationConfig } from '../models';
import { getDefaultRules } from '../models/EvaluationConfig';
import { asyncHandler } from '../middleware/errors';
import { ProcessStatus, UserRole, EntityType, AuditAction, BonusCalculationMode } from '../types';
import { auditAction } from '../middleware/audit';
import { Types } from 'mongoose';

// ==================== CONSTANTS ====================

const SECTOR_MIN_SCORE = 75; // Setor precisa ter média >= 75% para liberar bônus
const QUARTERS_PER_YEAR = 4; // Salário dividido em 4 trimestres

// ==================== VALIDATIONS ====================

export const bonusValidation = [
    query('from').isISO8601().withMessage('From date must be a valid ISO8601 date'),
    query('to').isISO8601().withMessage('To date must be a valid ISO8601 date'),
    query('baseValue').optional().isNumeric().withMessage('Base value must be a number'),
];

export const reportValidation = [
    query('quarter').optional().isIn(['Q1', 'Q2', 'Q3', 'Q4']).withMessage('Quarter must be Q1, Q2, Q3, or Q4'),
    query('year').optional().isInt({ min: 2020, max: 2100 }).withMessage('Year must be valid'),
    query('sector').optional().isString().withMessage('Sector must be a string'),
];

// ==================== HELPERS ====================

/**
 * Get the 3 months that belong to a quarter.
 * Q1 = Jan, Feb, Mar | Q2 = Apr, May, Jun | Q3 = Jul, Aug, Sep | Q4 = Oct, Nov, Dec
 */
function getQuarterMonths(quarter: string, year: number): string[] {
    const quarterMap: Record<string, number[]> = {
        Q1: [1, 2, 3],
        Q2: [4, 5, 6],
        Q3: [7, 8, 9],
        Q4: [10, 11, 12],
    };
    const months = quarterMap[quarter] || [];
    return months.map((m) => `${year}-${String(m).padStart(2, '0')}`);
}

/**
 * Determine which quarter a given month belongs to.
 */
function getQuarterForMonth(month: number): string {
    if (month <= 3) return 'Q1';
    if (month <= 6) return 'Q2';
    if (month <= 9) return 'Q3';
    return 'Q4';
}

// ==================== HANDLERS ====================

/**
 * Calculate bonus preview for a period (legacy endpoint, kept for backward compat)
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

    if (isOperator && userId) {
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
        { $unwind: '$userInfo' },
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

    res.json({
        success: true,
        data: aggregation,
    });
});

/**
 * Get quarterly bonus report.
 * 
 * REGRA DE BONIFICAÇÃO TRIMESTRAL:
 * - O salário bruto do operador é dividido em 4 (trimestres)
 * - Para o bônus ser liberado, o SETOR precisa ter média >= 75%
 * - Se o setor atinge, cada operador recebe: (média individual / 100) × (salário / 4)
 * - Se o setor NÃO atinge 75%, ninguém daquele setor recebe
 * 
 * GET /api/bonus/report?quarter=Q2&year=2026&sector=Controladoria
 */
export const getBonusReport = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { quarter: qParam, year: yParam, sector: filterSector, calculationMode: modeParam } = req.query;
    const companyId = req.companyId!;
    const { roles, userId: currentUserId } = req.user!;

    // Determine quarter and year (default: current quarter)
    const now = new Date();
    const currentYear = yParam ? Number(yParam) : now.getFullYear();
    const currentQuarter = qParam ? (qParam as string) : getQuarterForMonth(now.getMonth() + 1);
    const quarterMonths = getQuarterMonths(currentQuarter, currentYear);

    // Operators can only see their own data
    const isOperator = roles.includes(UserRole.OPERATOR) && !roles.includes(UserRole.MASTER) && !roles.includes(UserRole.MANAGER);

    // ── Step 1: Get all delivered processes in the quarter ──
    const matchFilter: any = {
        companyId: new Types.ObjectId(companyId.toString()),
        status: { $ne: ProcessStatus.PENDING },
        score: { $ne: null },
        isActive: { $ne: false },
    };

    // Filter by quarter months using cycles
    const startDate = new Date(`${currentYear}-${String(quarterMonths[0].split('-')[1]).padStart(2, '0')}-01T00:00:00Z`);
    const endMonth = Number(quarterMonths[quarterMonths.length - 1].split('-')[1]);
    const endDate = new Date(currentYear, endMonth, 0, 23, 59, 59, 999);

    matchFilter.plannedDate = { $gte: startDate, $lte: endDate };

    if (filterSector) {
        matchFilter.sector = filterSector as string;
    }

    if (isOperator && currentUserId) {
        matchFilter.responsibleUserId = new Types.ObjectId(currentUserId.toString());
    }

    // ── Step 2: Calculate sector averages ──
    const sectorAggregation = await Process.aggregate([
        { $match: { ...matchFilter } },
        {
            $group: {
                _id: '$sector',
                avgScore: { $avg: '$score' },
                processCount: { $sum: 1 },
            }
        },
        { $sort: { _id: 1 } }
    ]);

    // Build map: sector → { avgScore, qualified }
    const sectorMap: Record<string, { avgScore: number; processCount: number; qualified: boolean }> = {};
    for (const s of sectorAggregation) {
        const avg = Math.round(s.avgScore * 100) / 100;
        sectorMap[s._id] = {
            avgScore: avg,
            processCount: s.processCount,
            qualified: avg >= SECTOR_MIN_SCORE,
        };
    }

    // ── Step 3: Calculate per-user averages grouped by sector ──
    const userAggregation = await Process.aggregate([
        { $match: matchFilter },
        {
            $group: {
                _id: { userId: '$responsibleUserId', sector: '$sector' },
                avgScore: { $avg: '$score' },
                processCount: { $sum: 1 },
            }
        },
        {
            $lookup: {
                from: 'users',
                localField: '_id.userId',
                foreignField: '_id',
                as: 'userInfo'
            }
        },
        { $unwind: '$userInfo' },
        {
            $project: {
                userId: '$_id.userId',
                sector: '$_id.sector',
                userName: '$userInfo.name',
                baseSalary: '$userInfo.baseSalary',
                avgScore: { $round: ['$avgScore', 2] },
                processCount: 1,
            }
        },
        { $sort: { sector: 1, userName: 1 } }
    ]);

    // ── Step 4: Get bonus calculation mode (Query param override OR config) ──
    let calcMode: BonusCalculationMode;
    if (modeParam && Object.values(BonusCalculationMode).includes(modeParam as BonusCalculationMode)) {
        calcMode = modeParam as BonusCalculationMode;
    } else {
        const evalConfig = await EvaluationConfig.findOne({ companyId: new Types.ObjectId(companyId.toString()), isActive: true });
        calcMode = evalConfig?.rules?.bonusCalculationMode || BonusCalculationMode.INDIVIDUAL;
    }

    // ── Step 5: Apply quarterly bonus rule ──
    const users = userAggregation.map((row: any) => {
        const sectorInfo = sectorMap[row.sector] || { avgScore: 0, qualified: false };
        const baseSalary = row.baseSalary || 0;
        const quarterBase = Math.round((baseSalary / QUARTERS_PER_YEAR) * 100) / 100;

        let bonusValue = 0;
        if (sectorInfo.qualified) {
            // Mode INDIVIDUAL: uses operator's own avg score
            // Mode SECTOR: uses the sector's avg score for everyone
            const appliedScore = calcMode === BonusCalculationMode.SECTOR
                ? sectorInfo.avgScore
                : row.avgScore;
            bonusValue = Math.round(((appliedScore / 100) * quarterBase) * 100) / 100;
        }

        return {
            userId: row.userId,
            userName: row.userName,
            sector: row.sector,
            baseSalary,
            quarterBase,
            avgScore: row.avgScore,
            processCount: row.processCount,
            sectorAvgScore: sectorInfo.avgScore,
            sectorQualified: sectorInfo.qualified,
            bonusValue,
        };
    });

    // ── Step 5: Build sector summaries ──
    const sectors = Object.entries(sectorMap).map(([name, info]) => {
        const sectorUsers = users.filter(u => u.sector === name);
        const sectorTotalBonus = sectorUsers.reduce((sum, u) => sum + u.bonusValue, 0);
        return {
            name,
            avgScore: info.avgScore,
            processCount: info.processCount,
            qualified: info.qualified,
            userCount: sectorUsers.length,
            totalBonus: Math.round(sectorTotalBonus * 100) / 100,
        };
    });

    const totalBonus = users.reduce((sum, u) => sum + u.bonusValue, 0);
    const overallAvgScore = users.length > 0
        ? Math.round((users.reduce((sum, u) => sum + u.avgScore, 0) / users.length) * 100) / 100
        : 0;

    // Audit
    await auditAction(
        req,
        AuditAction.UPDATE,
        EntityType.COMPANY,
        companyId.toString(),
        null,
        { action: 'bonus_report', filters: { quarter: currentQuarter, year: currentYear, sector: filterSector } }
    );

    res.json({
        success: true,
        data: {
            quarter: currentQuarter,
            year: currentYear,
            months: quarterMonths,
            sectorMinScore: SECTOR_MIN_SCORE,
            calculationMode: calcMode,
            users,
            sectors,
            summary: {
                totalBonus: Math.round(totalBonus * 100) / 100,
                avgScore: overallAvgScore,
                userCount: users.length,
                qualifiedSectors: sectors.filter(s => s.qualified).length,
                totalSectors: sectors.length,
            },
        },
    });
});
