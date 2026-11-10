import { businessToday } from '../utils/assessment';
import { Request, Response } from 'express';
import { query } from 'express-validator';
// Dynamic imports used inside functions to avoid circular dependencies
// import { Cycle, Process, Company } from '../models';
import { asyncHandler, AppError, NotFoundError, UnauthorizedError, ForbiddenError } from '../middleware/errors';
import { getCompanySectorScope } from '../utils/processAccess';
import { calculatePerformance, performanceAccumulators, performanceFromTotals } from '../utils/performance';
import { assessmentIndicators, assessmentAccumulators, coverageFromTotals, serializeAssessment, assessmentStates, assessmentExpression } from '../utils/assessment';
import { CycleStatus, DeliverySource, ProcessStatus, UserRole } from '../types';
import { calculatePercentage, getEffectiveSectors, isSectorManager } from '../utils';

export const reportValidation = [
    query('assessmentState').optional().isIn(assessmentStates),
    query('cycleId').optional().isMongoId().withMessage('Invalid cycle ID'),
    query('period').optional().matches(/^\d{4}-\d{2}$/).withMessage('Period must be in YYYY-MM format'),
    query('status').optional().isIn(Object.values(ProcessStatus)).withMessage('Invalid status'),
];

/**
 * Helper to resolve cycles based on request parameters
 */
const resolveCycles = async (req: Request, isAdminOrMaster: boolean, combinedSectors: string[]) => {
    const { Cycle, Process } = await import('../models');
    const { cycleId, sector, period } = req.query;
    const activeCompanyId = req.companyId!;

    let cycles = [];
    if (cycleId) {
        const query: any = { _id: cycleId, companyId: activeCompanyId };
        if (!isAdminOrMaster && combinedSectors.length > 0) { query.sector = { $in: combinedSectors }; }
        const cycle = await Cycle.findOne(query);
        if (cycle) cycles.push(cycle);
    } else if (sector && period) {
        const cycle = await Cycle.findOne({
            companyId: activeCompanyId,
            sector: sector as string,
            month: period as string
        });
        if (cycle) cycles.push(cycle);
    } else if (sector) {
        // Try OPEN cycle first
        const cycle = await Cycle.findOne({
            companyId: activeCompanyId,
            sector: sector as string,
            status: CycleStatus.OPEN,
        }).sort({ month: -1 });
        
        if (cycle) {
            cycles.push(cycle);
        } else {
            // Fallback: Find the latest cycle that actually has processes
            // to avoid showing empty future cycles.
            const allCyclesForSector = await Cycle.find({
                companyId: activeCompanyId,
                sector: sector as string
            }).sort({ month: -1 });

            for (const c of allCyclesForSector) {
                const hasProcesses = await Process.exists({ cycleId: c._id });
                if (hasProcesses) {
                    cycles.push(c);
                    break;
                }
            }
            
            // If still nothing, just take the absolute latest
            if (cycles.length === 0 && allCyclesForSector.length > 0) {
                cycles.push(allCyclesForSector[0]);
            }
        }
    } else {
        const filter: any = { companyId: activeCompanyId };
        if (period) { 
            filter.month = period; 
            if (!isAdminOrMaster) { filter.sector = { $in: combinedSectors }; }
            cycles = await Cycle.find(filter);
        } else {
            filter.status = CycleStatus.OPEN; 
            if (!isAdminOrMaster) { filter.sector = { $in: combinedSectors }; }
            cycles = await Cycle.find(filter);
            
            // Fallback: If no OPEN cycles, or all OPEN cycles are empty, 
            // find the latest month that has processes.
            if (cycles.length === 0) {
                const latestMonths = await Cycle.distinct('month', { companyId: activeCompanyId });
                latestMonths.sort().reverse();

                for (const m of latestMonths) {
                    const fallbackFilter: any = { companyId: activeCompanyId, month: m };
                    if (!isAdminOrMaster) { fallbackFilter.sector = { $in: combinedSectors }; }
                    const monthCycles = await Cycle.find(fallbackFilter);
                    
                    let monthHasProcesses = false;
                    for (const c of monthCycles) {
                        if (await Process.exists({ cycleId: c._id })) {
                            monthHasProcesses = true;
                            break;
                        }
                    }

                    if (monthHasProcesses) {
                        cycles = monthCycles;
                        break;
                    }
                }
                
                // Final fallback if absolutely no processes found anywhere
                if (cycles.length === 0 && latestMonths.length > 0) {
                     const fallbackFilter: any = { companyId: activeCompanyId, month: latestMonths[0] };
                     if (!isAdminOrMaster) { fallbackFilter.sector = { $in: combinedSectors }; }
                     cycles = await Cycle.find(fallbackFilter);
                }
            }
        }
    }
    return cycles;
};

/**
 * Get summary KPIs for a cycle
 * GET /api/reports/summary
 */
export const getSummary = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { roles: globalRoles, sector: legacySector, sectors: userSectors, userId, companyAccess } = req.user!;
    const activeCompanyId = req.companyId!;
    let { sector, period } = req.query;

    const { Company, Process } = await import('../models');

    // Determine role for THIS specific company
    const currentCompanyAccess = (companyAccess || []).find(a => a.companyId === activeCompanyId);
    const companyRole = currentCompanyAccess?.role || UserRole.OPERATOR;

    // A user is MASTER if they have the MASTER role globally OR specifically for this company
    const isAdminOrMaster = globalRoles.includes(UserRole.MASTER) || (companyRole as any) === UserRole.MASTER;

    // Get all allowed sectors for this user
    const company = await Company.findById(activeCompanyId);
    const managedSectors = company?.sectors
        .filter(s => isSectorManager(s, userId))
        .map(s => s.name) || [];

    const combinedSectors = [...new Set([...managedSectors, ...getEffectiveSectors(req.user!, activeCompanyId)])];

    // Enforce sector restriction for non-masters
    if (!isAdminOrMaster) {
        if (combinedSectors.length === 0) {
            res.json({ success: true, data: { cycle: { id: 'none', month: 'Nenhum Ciclo', sector: 'N/A', status: CycleStatus.CLOSED }, kpis: { totalProcesses: 0, pendingCount: 0, onTimeCount: 0, lateCount: 0, criticalCount: 0, avgScore: 0, onTimePct: 0, deliveryPct: 0, ...calculatePerformance([]), ...assessmentIndicators([]) } } });
            return;
        }

        if (sector) {
            if (!combinedSectors.includes(sector as string)) {
                throw new ForbiddenError('Access to requested sector is denied');
            }
        }
    }

    const cycles = await resolveCycles(req, isAdminOrMaster, combinedSectors);

    if (cycles.length === 0) {
        res.json({
            success: true,
            data: {
                cycle: {
                    id: 'none',
                    month: period ? (period as string) : 'Nenhum Ciclo',
                    sector: (!isAdminOrMaster && combinedSectors.length > 0) ? combinedSectors[0] : 'N/A',
                    status: CycleStatus.CLOSED,
                },
                kpis: {
                    totalProcesses: 0,
                    pendingCount: 0,
                    onTimeCount: 0,
                    lateCount: 0,
                    criticalCount: 0,
                    avgScore: 0,
                    onTimePct: 0,
                    deliveryPct: 0,
                    ...calculatePerformance([]), ...assessmentIndicators([]),
                },
            },
        });
        return;
    }


    const filter: Record<string, any> = { cycleId: { $in: cycles.map(c => c._id) }, isActive: { $ne: false } };

    // Sector filter should be applied for everyone if provided
    if (sector && sector !== 'Todos') {
        filter.sector = sector;
    }

    // For Summary indicators, we show sector-wide data even for operators
    // to avoid "zeroed" indicators if they have no specific processes assigned.
    // In getExtract we will still keep the restriction if needed.

    if (req.query.status) filter.status = req.query.status;
    if (req.query.assessmentState) filter.$expr = { $eq: [assessmentExpression(), req.query.assessmentState] };
    const processes = await Process.find(filter);

    // Calculate KPIs
    const totalProcesses = processes.length;
    const onTimeCount = processes.filter((p) => p.status === ProcessStatus.ON_TIME).length;
    const lateCount = processes.filter((p) => p.status === ProcessStatus.LATE).length;
    const criticalCount = processes.filter((p) => p.status === ProcessStatus.CRITICAL).length;
    const pendingCount = processes.filter((p) => p.status === ProcessStatus.PENDING).length;

    const performance = { ...calculatePerformance(processes), ...assessmentIndicators(processes) };
    const avgScore = performance.performanceAverage ?? 0; // Numeric legacy field.
    const onTimePct = calculatePercentage(onTimeCount, totalProcesses);
    const deliveryPct = performance.deliveryRatePct ?? 0;

    res.json({
        success: true,
        data: {
            cycle: cycles.length === 1 ? {
                id: cycles[0]._id,
                month: cycles[0].month,
                sector: cycles[0].sector,
                status: cycles[0].status,
            } : {
                id: 'consolidated',
                month: period ? (period as string) : 'Consolidado',
                sector: sector ? (sector as string) : 'Todos',
                status: CycleStatus.OPEN,
            },
            kpis: {
                totalProcesses,
                pendingCount,
                onTimeCount,
                lateCount,
                criticalCount,
                avgScore,
                onTimePct,
                deliveryPct,
                ...performance,
            },
        },
    });
});

/**
 * Get sector ranking
 * GET /api/reports/sector-ranking
 */
export const getSectorRanking = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { roles: globalRoles, sector: legacySector, sectors: userSectors, userId, companyAccess } = req.user!;
    const activeCompanyId = req.companyId!;
    let { sector, period } = req.query;

    const { Company, Process } = await import('../models');

    const currentCompanyAccess = (companyAccess || []).find(a => a.companyId === activeCompanyId);
    const companyRole = currentCompanyAccess?.role || UserRole.OPERATOR;
    const isAdminOrMaster = globalRoles.includes(UserRole.MASTER) || (companyRole as any) === UserRole.MASTER;

    const company = await Company.findById(activeCompanyId);
    const managedSectors = company?.sectors
        .filter(s => isSectorManager(s, userId))
        .map(s => s.name) || [];

    const combinedSectors = [...new Set([...managedSectors, ...getEffectiveSectors(req.user!, activeCompanyId)])];

    if (!isAdminOrMaster) {
        if (combinedSectors.length === 0) {
            throw new ForbiddenError('No sectors assigned to this user');
        }
        if (sector) {
            if (!combinedSectors.includes(sector as string)) {
                throw new ForbiddenError('Access to requested sector is denied');
            }
        }
    }

    const cycles = await resolveCycles(req, isAdminOrMaster, combinedSectors);

    if (cycles.length === 0) {
        res.json({
            success: true,
            data: {
                cycleMonth: period ? period as string : 'Nenhum Ciclo',
                ranking: [],
            },
        });
        return;
    }

    const filter: Record<string, any> = { cycleId: { $in: cycles.map(c => c._id) }, isActive: { $ne: false } };

    // Ranking always shows sector data
    if (req.query.status) filter.status = req.query.status;
    if (req.query.assessmentState) filter.$expr = { $eq: [assessmentExpression(), req.query.assessmentState] };

    const rows = await Process.aggregate([
        { $match: filter },
        {
            $group: {
                _id: '$sector',
                ...performanceAccumulators(),
                ...assessmentAccumulators(),
                onTimeCount: { $sum: { $cond: [{ $eq: ['$status', ProcessStatus.ON_TIME] }, 1, 0] } },
                criticalCount: { $sum: { $cond: [{ $eq: ['$status', ProcessStatus.CRITICAL] }, 1, 0] } },
            },
        },
    ]);
    const ranking = rows.map(row => {
        const performance = performanceFromTotals({ scoreSum: row.scoreSum, validScoreCount: row.validScoreCount,
            activeProcessCount: row.activeProcessCount, deliveredCount: row.deliveredCount });
        return { _id: row._id, sector: row._id, totalProcesses: row.activeProcessCount,
            avgScore: performance.performanceAverage ?? 0, onTimeCount: row.onTimeCount,
            criticalCount: row.criticalCount, onTimePct: calculatePercentage(row.onTimeCount, row.activeProcessCount),
            ...performance, ...coverageFromTotals(row) };
    }).sort((a, b) => (b.performanceAverage ?? -1) - (a.performanceAverage ?? -1));

    res.json({
        success: true,
        data: {
            cycleMonth: cycles.length === 1 ? cycles[0].month : (period ? period as string : 'Consolidado'),
            ranking,
        },
    });
});

/**
 * Get status distribution
 * GET /api/reports/status-distribution
 */
export const getStatusDistribution = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { roles: globalRoles, sector: legacySector, sectors: userSectors, userId, companyAccess } = req.user!;
    const activeCompanyId = req.companyId!;
    let { sector, period } = req.query;

    const { Company, Process } = await import('../models');

    const currentCompanyAccess = (companyAccess || []).find(a => a.companyId === activeCompanyId);
    const companyRole = currentCompanyAccess?.role || UserRole.OPERATOR;
    const isAdminOrMaster = globalRoles.includes(UserRole.MASTER) || (companyRole as any) === UserRole.MASTER;

    const company = await Company.findById(activeCompanyId);
    const managedSectors = company?.sectors
        .filter(s => isSectorManager(s, userId))
        .map(s => s.name) || [];

    const combinedSectors = [...new Set([...managedSectors, ...getEffectiveSectors(req.user!, activeCompanyId)])];

    if (!isAdminOrMaster) {
        if (combinedSectors.length === 0) { throw new ForbiddenError('No sectors assigned to this user'); }
        if (sector) {
            if (!combinedSectors.includes(sector as string)) { throw new ForbiddenError('Access to requested sector is denied'); }
        }
    }

    const cycles = await resolveCycles(req, isAdminOrMaster, combinedSectors);

    if (cycles.length === 0) {
        res.json({
            success: true,
            data: {
                cycleMonth: period ? period as string : 'Nenhum Ciclo',
                total: 0,
                distribution: Object.values(ProcessStatus).map((status) => ({ status, count: 0, percentage: 0 })),
            },
        });
        return;
    }

    const filter: Record<string, any> = { cycleId: { $in: cycles.map(c => c._id) }, isActive: { $ne: false } };

    // Apply sector filter for everyone if provided
    if (sector && sector !== 'Todos') {
        filter.sector = sector;
    }

    // Status distribution shows sector metrics

    const distribution = await Process.aggregate([
        { $match: filter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
    ]);

    const total = distribution.reduce((sum, d) => sum + d.count, 0);
    const result = {
        [ProcessStatus.PENDING]: 0,
        [ProcessStatus.ON_TIME]: 0,
        [ProcessStatus.LATE]: 0,
        [ProcessStatus.CRITICAL]: 0,
    };

    distribution.forEach(({ _id, count }) => {
        result[_id as ProcessStatus] = count;
    });

    const withPercentages = Object.entries(result).map(([status, count]) => ({
        status,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100 * 100) / 100 : 0,
    }));

    res.json({
        success: true,
        data: {
            cycleMonth: cycles.length === 1 ? cycles[0].month : (period ? period as string : 'Consolidado'),
            total,
            distribution: withPercentages,
        },
    });
});

/**
 * Get detailed extract for printing
 * GET /api/reports/extract
 */
export const getExtract = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { roles: globalRoles, sector: legacySector, sectors: userSectors, userId, companyAccess } = req.user!;
    const activeCompanyId = req.companyId!;
    let { sector, period } = req.query;

    const { Company, Process } = await import('../models');

    const currentCompanyAccess = (companyAccess || []).find(a => a.companyId === activeCompanyId);
    const companyRole = currentCompanyAccess?.role || UserRole.OPERATOR;
    const isAdminOrMaster = globalRoles.includes(UserRole.MASTER) || (companyRole as any) === UserRole.MASTER;

    const company = await Company.findById(activeCompanyId);
    const managedSectors = company?.sectors
        .filter(s => isSectorManager(s, userId))
        .map(s => s.name) || [];

    const combinedSectors = [...new Set([...managedSectors, ...getEffectiveSectors(req.user!, activeCompanyId)])];

    if (!isAdminOrMaster) {
        if (combinedSectors.length === 0) { throw new ForbiddenError('No sectors assigned to this user'); }
        if (sector) {
            if (!combinedSectors.includes(sector as string)) { throw new ForbiddenError('Access to requested sector is denied'); }
        }
    }

    const cycles = await resolveCycles(req, isAdminOrMaster, combinedSectors);

    if (cycles.length === 0) {
        res.json({
            success: true,
            data: {
                cycle: { id: 'none', month: 'Nenhum Ciclo', status: CycleStatus.CLOSED },
                totalProcesses: 0,
                bySector: {},
                generatedAt: new Date().toISOString(),
            },
        });
        return;
    }

    const filter: Record<string, any> = { cycleId: { $in: cycles.map(c => c._id) }, isActive: { $ne: false } };
    if (sector) { filter.sector = sector; }
    if (req.query.status) { filter.status = req.query.status; }
    if (req.query.assessmentState) filter.$expr = { $eq: [assessmentExpression(), req.query.assessmentState] };

    if (globalRoles.includes(UserRole.OPERATOR) && !globalRoles.includes(UserRole.MASTER) && !globalRoles.includes(UserRole.MANAGER)) {
        if (legacySector) { filter.sector = legacySector; } else { filter.responsibleUserId = userId; }
    }

    const processes = await Process.find(filter)
        .populate('responsibleUserId', 'name')
        .sort({ sector: 1, code: 1 });

    const bySector: Record<string, typeof processes> = {};
    processes.forEach((p) => {
        if (!bySector[p.sector]) { bySector[p.sector] = []; }
        bySector[p.sector].push(serializeAssessment(p) as any);
    });

    res.json({
        success: true,
        data: {
            cycle: cycles.length === 1 ? { id: cycles[0]._id, month: cycles[0].month, status: cycles[0].status } : { id: 'consolidated', month: (period ? period as string : 'Consolidado'), status: CycleStatus.OPEN },
            totalProcesses: processes.length,
            bySector,
            generatedAt: new Date().toISOString(),
        },
    });
});

/**
 * Get history (last 5 months trend)
 * GET /api/reports/history
 */
export const getHistory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const activeCompanyId = req.companyId!;
    const { Cycle } = await import('../models');
    const { sector } = req.query;
    if (sector !== undefined && (typeof sector !== 'string' || !sector.trim())) {
        throw new AppError('Sector must be a non-empty string', 400);
    }

    const scope = await getCompanySectorScope(req);
    if (sector !== undefined && scope !== null && !scope.includes(sector as string)) {
        throw new ForbiddenError('Access to requested sector is denied');
    }
    const filter: Record<string, any> = {
        companyId: activeCompanyId,
        status: CycleStatus.CLOSED,
    };
    if (scope !== null) filter.sector = { $in: scope };
    if (sector !== undefined) filter.sector = sector;

    // Scope before applying the limit: hidden sectors must not consume visible slots.
    // Keep the existing five-cycle/snapshot contract; monthly consolidation is separate.
    const cycles = await Cycle.find(filter)
        .sort({ month: -1, sector: 1, _id: 1 })
        .limit(5);

    const history = cycles.map((c) => ({
        month: c.month,
        avgScore: c.kpis.avgScore,
        onTimePct: c.kpis.onTimePct,
        totalProcesses: c.kpis.totalProcesses,
        criticalCount: c.kpis.criticalCount,
        // Old snapshots remain old snapshots: never infer their sample from totalProcesses.
        ...(c.kpis.aggregationVersion === 1 ? {
            aggregationVersion: c.kpis.aggregationVersion, scoreSum: c.kpis.scoreSum,
            validScoreCount: c.kpis.validScoreCount, performanceAverage: c.kpis.performanceAverage,
            activeProcessCount: c.kpis.activeProcessCount, deliveredCount: c.kpis.deliveredCount,
            deliveryRatePct: c.kpis.deliveryRatePct,
        } : {}),
    }));

    history.reverse();
    res.json({ success: true, data: history });
});

/**
 * Get process curve data (Planned vs Realized vs Delayed vs Critical)
 * GET /api/reports/process-curve
 */
export const getProcessCurve = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const activeCompanyId = req.companyId!;
    const { period, sector, userId: filterUserId } = req.query;

    if (!period || typeof period !== 'string') { throw new NotFoundError('Period is required'); }

    const { Company, Process } = await import('../models');

    const [year, month] = period.split('-').map(Number);
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const lastDayDate = new Date(Date.UTC(year, month, 0));
    const lastDay = lastDayDate.getUTCDate();
    const endOfMonth = new Date(Date.UTC(year, month - 1, lastDay, 23, 59, 59, 999));

    const filter: Record<string, any> = {
        companyId: activeCompanyId,
        plannedDate: { $gte: startOfMonth, $lte: endOfMonth },
        isActive: { $ne: false },
    };

    const { roles: globalRoles, userId, sector: legacySector, sectors: userSectors, companyAccess } = req.user!;
    const currentCompanyAccess = (companyAccess || []).find(a => a.companyId === activeCompanyId);
    const companyRole = currentCompanyAccess?.role || UserRole.OPERATOR;
    const isAdminOrMaster = globalRoles.includes(UserRole.MASTER) || (companyRole as any) === UserRole.MASTER;

    const company = await Company.findById(activeCompanyId);
    const managedSectors = company?.sectors
        .filter(s => isSectorManager(s, userId))
        .map(s => s.name) || [];

    const combinedSectors = [...new Set([...managedSectors, ...getEffectiveSectors(req.user!, activeCompanyId)])];

    if (!isAdminOrMaster) {
        if (combinedSectors.length === 0) { throw new ForbiddenError('No sectors assigned to this user'); }
        if (sector) {
            if (!combinedSectors.includes(sector as string)) { throw new ForbiddenError('Access to requested sector is denied'); }
            filter.sector = sector;
        } else {
            filter.sector = { $in: combinedSectors };
        }
    } else if (sector) {
        filter.sector = sector;
    }

    if (!isAdminOrMaster && companyRole !== UserRole.MANAGER) {
        filter.responsibleUserId = userId;
    } else if (filterUserId) {
        filter.responsibleUserId = filterUserId;
    }

    const processes = await Process.find(filter).populate('responsibleUserId', 'name');
    const asOf = businessToday();
    // Planned and manual delivery dates are calendar days. Email deliveries are timestamps.
    const rows = processes.map(process => ({
        process,
        planned: process.plannedDate.toISOString().slice(0, 10),
        limit: process.limitDate.toISOString().slice(0, 10),
        delivered: process.deliveryDate && process.deliverySource === DeliverySource.EMAIL
            ? businessToday(process.deliveryDate) : process.deliveryDate?.toISOString().slice(0, 10),
    }));
    const series = [];
    for (let day = 1; day <= lastDay; day++) {
        const date = `${period}-${String(day).padStart(2, '0')}`;
        const planned = rows.filter(row => row.planned <= date).length;
        const realized = rows.filter(row => row.delivered && row.delivered <= date).length;
        const open = rows.filter(row => !row.delivered || row.delivered > date);
        const delayedOpen = open.filter(row => row.planned < date && row.limit >= date).length;
        const overdueOpen = open.filter(row => row.limit < date).length;
        const critical = overdueOpen + rows.filter(row => row.delivered && row.delivered > row.limit && row.delivered <= date).length;
        series.push({ day, date, planned, realized, delayed: Math.max(0, planned - realized), critical, delayedOpen, overdueOpen });
    }

    const totalPlanned = processes.length;
    const onTimeCount = processes.filter(p => p.status === ProcessStatus.ON_TIME).length;
    const performance = { ...calculatePerformance(processes), ...assessmentIndicators(processes) };
    const avgScore = performance.performanceAverage ?? 0;
    const onTimePct = calculatePercentage(onTimeCount, totalPlanned);
    const bands = [
        { key: 'EARLY', label: 'Antes do planejado', count: 0 },
        { key: 'ON_PLANNED', label: 'Na data planejada', count: 0 },
        { key: 'LATE', label: 'Após o planejado, até o limite', count: 0 },
        { key: 'CRITICAL', label: 'Entregue após o limite', count: 0 },
        { key: 'OVERDUE', label: 'Sem entrega, limite vencido', count: 0 },
        { key: 'PENDING', label: 'Sem entrega, dentro do limite', count: 0 },
    ];
    const criticalItems = [];
    const sectorRisk = new Map<string, { sector: string; delayedOpen: number; overdueOpen: number }>();
    for (const { process, planned, limit, delivered } of rows) {
        const index = delivered == null ? (asOf > limit ? 4 : 5)
            : delivered < planned ? 0 : delivered === planned ? 1 : delivered <= limit ? 2 : 3;
        bands[index].count++;
        if (!delivered && asOf > planned) {
            const risk = sectorRisk.get(process.sector) ?? { sector: process.sector, delayedOpen: 0, overdueOpen: 0 };
            if (asOf > limit) risk.overdueOpen++;
            else risk.delayedOpen++;
            sectorRisk.set(process.sector, risk);
        }
        if (index === 3 || index === 4) {
            criticalItems.push({
                id: String(process._id), code: process.code, title: process.title, sector: process.sector,
                plannedDate: planned, limitDate: limit, deliveryDate: delivered ?? null,
                responsible: (process.responsibleUserId as any)?.name || 'Não informado',
            });
        }
    }
    criticalItems.sort((a, b) => Number(!!a.deliveryDate) - Number(!!b.deliveryDate) || a.limitDate.localeCompare(b.limitDate));
    const riskBySector = [...sectorRisk.values()].sort((a, b) =>
        b.overdueOpen - a.overdueOpen || b.delayedOpen - a.delayedOpen || a.sector.localeCompare(b.sector));
    res.json({ success: true, data: {
        asOf, series, deliveryBreakdown: bands, riskBySector,
        kpis: { totalPlanned, onTimePct, avgScore, ...performance }, criticalItems,
    } });
});
