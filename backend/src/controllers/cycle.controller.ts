import { Request, Response } from 'express';
import { body, query } from 'express-validator';
import { Cycle, Process, getCurrentMonth, getNextMonth } from '../models';
import { asyncHandler, NotFoundError, ConflictError, AppError, UnauthorizedError } from '../middleware/errors';
import { auditAction } from '../middleware/audit';
import { logger } from '../config';
import { AuditAction, EntityType, CycleStatus, ProcessStatus, UserRole, DeliveryStatus } from '../types';
import { Types } from 'mongoose';
import { calculatePercentage, calculateAverage } from '../utils';

// Validation rules
export const openCycleValidation = [
    body('month')
        .matches(/^\d{4}-(0[1-9]|1[0-2])$/)
        .withMessage('Month must be in YYYY-MM format'),
    body('sector').trim().notEmpty().withMessage('Sector is required'),
];

export const listCyclesValidation = [
    query('month').optional().matches(/^\d{4}-(0[1-9]|1[0-2])$/).withMessage('Invalid month format'),
    query('sector').optional().trim(),
];

/**
 * List cycles for current company
 * GET /api/cycles
 */
export const listCycles = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const activeCompanyId = req.companyId!;
    let { month, status, sector } = req.query;

    const { roles, userId, sectors: userSectors, sector: legacySector } = req.user!;
    const isAdminOrMaster = roles.includes(UserRole.MASTER);

    // Get all allowed sectors for this user
    const company = await (await import('../models')).Company.findById(activeCompanyId);
    const managedSectors = company?.sectors
        .filter(s => s.managerId && s.managerId.toString() === userId)
        .map(s => s.name) || [];

    const combinedSectors = [...new Set([...(userSectors || []), ...(legacySector ? [legacySector] : []), ...managedSectors])];

    // Enforce sector restriction
    if (!isAdminOrMaster) {
        if (combinedSectors.length === 0) {
            res.json({ success: true, data: [] });
            return;
        }

        if (sector) {
            if (!combinedSectors.includes(sector as string)) {
                throw new AppError('Access to requested sector is denied', 403);
            }
        } else {
            sector = { $in: combinedSectors } as any;
        }
    }

    const filter: Record<string, any> = { companyId: activeCompanyId };

    if (month) {
        filter.month = month;
    }

    if (status) {
        filter.status = status;
    }

    if (sector) {
        filter.sector = sector;
    }

    console.log('[listCycles] Filter:', JSON.stringify(filter, null, 2));
    console.log('[listCycles] User:', { userId, roles, combinedSectors });

    const cycles = await Cycle.find(filter).sort({ month: -1 }).limit(100);
    console.log('[listCycles] Found:', cycles.length);

    res.json({
        success: true,
        data: cycles,
    });
});

/**
 * Get current open cycle
 * GET /api/cycles/current
 */
export const getCurrentCycle = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const activeCompanyId = req.companyId!;

    let { sector } = req.query;

    const { roles, userId, sectors: userSectors, sector: legacySector } = req.user!;
    const isAdminOrMaster = roles.includes(UserRole.MASTER);

    // Get all allowed sectors for this user
    const company = await (await import('../models')).Company.findById(activeCompanyId);
    const managedSectors = company?.sectors
        .filter(s => s.managerId && s.managerId.toString() === userId)
        .map(s => s.name) || [];

    const combinedSectors = [...new Set([...(userSectors || []), ...(legacySector ? [legacySector] : []), ...managedSectors])];

    // Enforce sector restriction
    if (!isAdminOrMaster) {
        if (combinedSectors.length === 0) {
            res.json({ success: true, data: null });
            return;
        }

        if (sector) {
            if (!combinedSectors.includes(sector as string)) {
                res.json({ success: true, data: null });
                return;
            }
        } else {
            // If no sector requested, default to all combined sectors
            sector = { $in: combinedSectors } as any;
        }
    }

    const filter: Record<string, any> = {
        companyId: activeCompanyId,
        status: CycleStatus.OPEN,
    };

    if (sector) {
        filter.sector = sector;
    }

    const cycle = await Cycle.findOne(filter).sort({ month: -1 });

    if (!cycle) {
        // Return null if no open cycle
        res.json({
            success: true,
            data: null,
            message: 'No open cycle found',
        });
        return;
    }

    // Get process counts for this cycle
    const processCounts = await Process.aggregate([
        { $match: { cycleId: cycle._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const statusCounts = processCounts.reduce((acc, { _id, count }) => {
        acc[_id] = count;
        return acc;
    }, {} as Record<string, number>);

    res.json({
        success: true,
        data: {
            ...cycle.toObject(),
            processCounts: {
                pending: statusCounts[ProcessStatus.PENDING] || 0,
                onTime: statusCounts[ProcessStatus.ON_TIME] || 0,
                late: statusCounts[ProcessStatus.LATE] || 0,
                critical: statusCounts[ProcessStatus.CRITICAL] || 0,
            },
        },
    });
});

/**
 * Open a new cycle
 * POST /api/cycles/open
 */
export const openCycle = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { roles } = req.user!;
    const activeCompanyId = req.companyId!;
    const { month, sector } = req.body;

    // Check permissions
    if (roles.includes(UserRole.OPERATOR) && !roles.includes(UserRole.MASTER) && !roles.includes(UserRole.MANAGER)) {
        throw new AppError('Operators are not allowed to open cycles', 403);
    }

    // Check if cycle already exists for this month AND sector
    const existing = await Cycle.findOne({
        companyId: activeCompanyId,
        month,
        sector,
    });

    if (existing) {
        throw new ConflictError(`Cycle for ${month} already exists`);
    }

    // Check if there's an open cycle for this SPECIFIC sector
    const openCycle = await Cycle.findOne({
        companyId: activeCompanyId,
        sector,
        status: CycleStatus.OPEN,
    });

    if (openCycle) {
        throw new AppError(`Please close the cycle for sector ${sector} (month ${openCycle.month}) before opening a new one`, 400);
    }

    // Create new cycle
    const cycle = await Cycle.create({
        companyId: activeCompanyId,
        month,
        sector,
        status: CycleStatus.OPEN,
        openedAt: new Date(),
    });

    // Audit log
    await auditAction(
        req,
        AuditAction.CREATE,
        EntityType.CYCLE,
        cycle._id.toString(),
        null,
        cycle.toObject() as any
    );

    // Send email notification to administrators
    try {
        const { User } = await import('../models');
        const { EmailService } = await import('../services/email.service');
        const { UserRole } = await import('../types');

        const admins = await User.find({
            allowedCompanyIds: activeCompanyId,
            roles: UserRole.MASTER,
        }).select('email name');

        for (const admin of admins) {
            const emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">Novo Ciclo Aberto</h2>
                    <p>Olá ${admin.name},</p>
                    <p>Um novo ciclo de processos foi aberto para o mês: <strong>${month}</strong>.</p>
                    <p>Os processos planejados já estão disponíveis para lançamento no sistema.</p>
                    <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                        Esta é uma notificação automática do sistema CHRONOS - Making Money Method.
                    </p>
                </div>
            `;

            await EmailService.enqueue(activeCompanyId as any, {
                to: admin.email,
                subject: `Ciclo Aberto: ${month}`,
                html: emailHtml,
                category: 'cycle_open'
            });
        }
    } catch (emailError) {
        logger.error(`Failed to send cycle opening notification: ${emailError}`);
    }

    res.status(201).json({
        success: true,
        data: cycle,
        message: `Cycle ${month} opened successfully`,
    });
});

/**
 * Preview closing current cycle and cloning processes
 * GET /api/cycles/preview-close
 */
export const previewCloseCycle = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const activeCompanyId = req.companyId!;

    const { sector } = req.query;

    const filter: any = {
        companyId: activeCompanyId,
        status: CycleStatus.OPEN,
    };

    if (sector) {
        filter.sector = sector;
    }

    // Find open cycle
    const cycle = await Cycle.findOne(filter);

    if (!cycle) {
        throw new NotFoundError('Open cycle');
    }

    logger.info(`Previewing cycle closure for company ${activeCompanyId}, cycle ${cycle.month} (${cycle._id})`);

    // Get all processes for this cycle
    const processes = await Process.find({ cycleId: cycle._id }).sort({ sector: 1, title: 1 });

    // Calculate next month's dates
    const nextMonth = getNextMonth(cycle.month);

    logger.info(`Found ${processes.length} processes for preview. Next month: ${nextMonth}`);

    try {
        const previewProcesses = processes.map((p) => ({
            originalId: p._id,
            code: p.code,
            title: p.title,
            sector: p.sector,
            owner: p.owner,
            responsibleUserId: p.responsibleUserId,
            currentPlannedDate: p.plannedDate,
            currentLimitDate: p.limitDate,
            currentDeliveryDate: p.deliveryDate,
            newPlannedDate: shiftDateToNextMonth(p.plannedDate),
            newLimitDate: shiftDateToNextMonth(p.limitDate),
        }));

        res.json({
            success: true,
            data: {
                currentCycle: cycle,
                nextMonth,
                processes: previewProcesses,
            },
        });
    } catch (error: any) {
        logger.error('Error calculating preview processes:', error);
        throw new AppError(`Erro ao calcular pré-visualização: ${error.message}`, 500);
    }
});

/**
 * Close current cycle and clone processes to next month
 * POST /api/cycles/close
 */
export const closeCycle = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { userId, roles } = req.user!;
    const activeCompanyId = req.companyId!;
    const { overrides, openNext = true, sector } = req.body; // Array of { originalId, plannedDate, limitDate }

    // Check permissions
    if (roles.includes(UserRole.OPERATOR) && !roles.includes(UserRole.MASTER) && !roles.includes(UserRole.MANAGER)) {
        throw new AppError('Operators are not allowed to close cycles', 403);
    }

    if (!sector) {
        throw new AppError('Explicit sector is required to close a cycle', 400);
    }

    const filter: any = {
        companyId: activeCompanyId,
        status: CycleStatus.OPEN,
    };

    if (sector) {
        filter.sector = sector;
    }

    // Find open cycle
    const cycle = await Cycle.findOne(filter);

    if (!cycle) {
        throw new NotFoundError('Open cycle');
    }

    // Get all processes for this cycle
    const processes = await Process.find({ cycleId: cycle._id });

    // Calculate KPIs
    const activeProcessesForKpi = processes.filter((p) => p.isActive !== false);

    const scores = activeProcessesForKpi
        .filter((p) => p.score !== null)
        .map((p) => p.score!);

    const onTimeCount = activeProcessesForKpi.filter(
        (p) => p.status === ProcessStatus.ON_TIME
    ).length;

    const criticalCount = activeProcessesForKpi.filter(
        (p) => p.status === ProcessStatus.CRITICAL
    ).length;

    const avgScore = calculateAverage(scores);
    const onTimePct = calculatePercentage(onTimeCount, activeProcessesForKpi.length);

    // Calculate average deviation
    const deviations = activeProcessesForKpi
        .filter((p) => p.deliveryDate !== null)
        .map((p) => {
            const diff = p.deliveryDate!.getTime() - p.plannedDate.getTime();
            return Math.round(diff / (24 * 60 * 60 * 1000));
        });
    const avgDeviationDays = calculateAverage(deviations);

    // Update cycle with KPIs and close it
    const before = cycle.toObject();

    cycle.status = CycleStatus.CLOSED;
    cycle.closedAt = new Date();
    cycle.kpis = {
        avgScore,
        onTimePct,
        criticalCount,
        totalProcesses: activeProcessesForKpi.length,
        avgDeviationDays,
    };

    await cycle.save();

    let nextCycle = null;
    let clonedProcesses: any[] = [];
    const nextMonth = getNextMonth(cycle.month);

    if (openNext) {
        // Find or create next month's cycle
        nextCycle = await Cycle.findOneAndUpdate(
            { companyId: activeCompanyId, month: nextMonth, sector: (sector as string) || cycle.sector },
            {
                $set: {
                    status: CycleStatus.OPEN,
                    openedAt: new Date(),
                    closedAt: null,
                    // Reset KPIs for the new/reopened cycle
                    kpis: {
                        avgScore: 0,
                        onTimePct: 0,
                        criticalCount: 0,
                        totalProcesses: 0,
                        avgDeviationDays: 0,
                    }
                }
            },
            { upsert: true, new: true }
        );

        // CLONE existing processes to the new cycle
        // This preserves history in the current cycle
        const processesToCreate = processes.map(p => {
            const override = overrides?.find((o: any) => o.originalId === (p._id as any).toString());

            let newPlannedDate = shiftDateToNextMonth(p.plannedDate);
            let newLimitDate = shiftDateToNextMonth(p.limitDate);

            if (override) {
                if (override.plannedDate) newPlannedDate = new Date(override.plannedDate);
                if (override.limitDate) newLimitDate = new Date(override.limitDate);
            }

            // Create a new process document data (strip _id and timestamps)
            const pObj = p.toObject() as any;
            delete pObj._id;
            delete pObj.createdAt;
            delete pObj.updatedAt;

            return {
                ...pObj,
                cycleId: nextCycle!._id,
                plannedDate: newPlannedDate || p.plannedDate,
                limitDate: newLimitDate || p.limitDate,
                deliveryDate: null,
                deliverySource: null,
                deliveryEvidence: null,
                deliveryStatus: DeliveryStatus.NOT_DELIVERED,
                score: null,
                status: ProcessStatus.PENDING,
                revertReason: null,
                revertedBy: null,
                revertedAt: null,
                emailSentAt: null,
            };
        });

        if (processesToCreate.length > 0) {
            // Check for potential duplicates before inserting
            const targetCycleId = nextCycle!._id;
            const existingProcessCodes = await Process.find({
                cycleId: targetCycleId,
                companyId: activeCompanyId,
                sector: (sector as string) || cycle.sector
            }).distinct('code');

            const filteredProcessesToCreate = processesToCreate.filter(p => !existingProcessCodes.includes(p.code));

            if (filteredProcessesToCreate.length > 0) {
                clonedProcesses = await Process.insertMany(filteredProcessesToCreate);
                logger.info(`Cloned ${clonedProcesses.length} processes to next cycle ${nextCycle!.month} for sector ${sector}. skipped ${processesToCreate.length - clonedProcesses.length} duplicates.`);
            } else {
                logger.info(`All ${processesToCreate.length} processes already exist in next cycle ${nextCycle!.month} for sector ${sector}. Skipping cloning.`);
            }
        }
    }

    // Audit log
    await auditAction(
        req,
        AuditAction.CLOSE_CYCLE,
        EntityType.CYCLE,
        cycle._id.toString(),
        before as any,
        cycle.toObject() as any
    );

    // Send email notification to administrators with KPIs
    try {
        const { User } = await import('../models');
        const { EmailService } = await import('../services/email.service');
        const { UserRole } = await import('../types');

        const admins = await User.find({
            allowedCompanyIds: activeCompanyId,
            roles: UserRole.MASTER,
        }).select('email name');

        for (const admin of admins) {
            const emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">Ciclo Encerrado: ${cycle.month}</h2>
                    <p>Olá ${admin.name},</p>
                    <p>O ciclo do mês de ${cycle.month} foi encerrado. Confira o resumo dos resultados:</p>
                    
                    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Total de Processos:</strong> ${processes.length}</p>
                        <p><strong>Pontuação Média:</strong> <span style="font-weight: bold; color: ${avgScore >= 75 ? '#16a34a' : avgScore >= 50 ? '#eab308' : '#dc2626'};">${avgScore.toFixed(1)}</span></p>
                        <p><strong>Entregas no Prazo:</strong> ${onTimePct.toFixed(1)}%</p>
                        <p><strong>Processos Críticos:</strong> ${criticalCount}</p>
                        <p><strong>Desvio Médio:</strong> ${avgDeviationDays.toFixed(1)} dias</p>
                    </div>

                    <p>Um novo ciclo para <strong>${nextMonth}</strong> foi aberto automaticamente com os processos clonados.</p>
                    
                    <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                        Esta é uma notificação automática do sistema CHRONOS - Making Money Method.
                    </p>
                </div>
            `;

            await EmailService.enqueue(activeCompanyId as any, {
                to: admin.email,
                subject: `Resumo do Ciclo Encerrado: ${cycle.month}`,
                html: emailHtml,
                category: 'cycle_close'
            });
        }
    } catch (emailError) {
        logger.error(`Failed to send cycle closure notification: ${emailError}`);
    }

    res.json({
        success: true,
        data: {
            closedCycle: cycle,
            newCycle: nextCycle,
            clonedProcessCount: clonedProcesses.length,
        },
        message: openNext
            ? `Ciclo de ${cycle.month} fechado com sucesso. O ciclo de ${nextCycle?.month} foi aberto com ${clonedProcesses.length} processos clonados.`
            : `Ciclo de ${cycle.month} encerrado permanentemente. Nenhum novo ciclo foi aberto.`,
    });
});

/**
 * Shift date to next month (keeping same day)
 */
function shiftDateToNextMonth(date: Date | null | undefined): Date | null {
    if (!date) return null;

    const result = new Date(date);
    if (isNaN(result.getTime())) return null;

    result.setMonth(result.getMonth() + 1);

    // Handle edge case where day doesn't exist in next month
    if (result.getDate() !== date.getDate()) {
        // Set to last day of the previous month (which is next month - 1 day)
        result.setDate(0);
    }

    return result;
}

/**
 * Get cycle by ID
 * GET /api/cycles/:id
 */
export const getCycle = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const activeCompanyId = req.companyId!;

    if (!id || !Types.ObjectId.isValid(id as string)) {
        throw new NotFoundError('Cycle');
    }

    const cycle = await Cycle.findOne({
        _id: id as string,
        companyId: activeCompanyId,
    });

    if (!cycle) {
        throw new NotFoundError('Cycle');
    }

    res.json({
        success: true,
        data: cycle,
    });
});

/**
 * Reset cycle (Manager only)
 * Creates a restore point and resets all processes to pending
 * POST /api/cycles/:id/reset
 */
export const resetCycle = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { userId } = req.user!;
    const activeCompanyId = req.companyId!;

    // Check permissions (Manager or Admin)
    const { UserRole } = await import('../types');
    if (!req.user!.roles.includes(UserRole.MANAGER) && !req.user!.roles.includes(UserRole.MASTER)) {
        throw new AppError('Only Managers or Admins can reset a cycle', 403);
    }

    const cycle = await Cycle.findOne({ _id: id, companyId: activeCompanyId });
    if (!cycle) throw new NotFoundError('Cycle');

    if (cycle.status !== CycleStatus.OPEN) {
        throw new AppError('Only open cycles can be reset', 400);
    }

    // Get all processes
    const processes = await Process.find({ cycleId: cycle._id }).lean();

    // Create restore point
    const { CycleRestorePoint } = await import('../models/CycleRestorePoint');
    await CycleRestorePoint.create({
        companyId: activeCompanyId,
        cycleId: cycle._id,
        createdByUserId: userId,
        timestamp: new Date(),
        processes: processes,
        cycleKPIs: cycle.kpis,
    });

    // Reset processes
    await Process.updateMany(
        { cycleId: cycle._id },
        {
            $set: {
                status: ProcessStatus.PENDING,
                deliveryStatus: 'NOT_DELIVERED', // Using string literal as enum imports might be tricky here
                deliveryDate: null,
                deliverySource: null,
                deliveryEvidence: null,
                score: null,
                emailSentAt: null,
                revertReason: null,
                revertedBy: null,
                revertedAt: null,
            }
        }
    );

    // Reset Cycle KPIs
    cycle.kpis = {
        avgScore: 0,
        onTimePct: 0,
        criticalCount: 0,
        totalProcesses: processes.length, // Count remains
        avgDeviationDays: 0,
    };

    // Also reset process counts in cycle if your schema stores them (it seems dynamic in getCurrentCycle but static in Cycle model)
    // The Cycle model has a default for kpis but processCounts is dynamic in getCurrentCycle. 
    // However, let's just save the cycle.
    await cycle.save();

    await auditAction(
        req,
        AuditAction.UPDATE, // Effectively an update
        EntityType.CYCLE,
        cycle._id.toString(),
        { action: 'RESET_MONTH_BEFORE' },
        { action: 'RESET_MONTH_AFTER' }
    );

    res.json({
        success: true,
        message: 'Cycle reset successfully. You can undo this action.',
    });
});

/**
 * Restore cycle from restore point
 * POST /api/cycles/:id/restore
 */
export const restoreCycle = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const activeCompanyId = req.companyId!;
    const { UserRole } = await import('../types');

    if (!req.user!.roles.includes(UserRole.MANAGER) && !req.user!.roles.includes(UserRole.MASTER)) {
        throw new AppError('Only Managers or Admins can restore a cycle', 403);
    }

    const { CycleRestorePoint } = await import('../models/CycleRestorePoint');

    // Find latest restore point
    const restorePoint = await CycleRestorePoint.findOne({
        cycleId: id,
        companyId: activeCompanyId
    }).sort({ createdAt: -1 });

    if (!restorePoint) {
        throw new AppError('No restore point found for this cycle', 404);
    }

    const cycle = await Cycle.findOne({ _id: id, companyId: activeCompanyId });
    if (!cycle) throw new NotFoundError('Cycle');

    // Restore processes
    // We do this in bulk for efficiency
    const bulkOps = restorePoint.processes.map((p: any) => ({
        updateOne: {
            filter: { _id: p._id },
            update: { $set: p } // Restore all fields from snapshot
        }
    }));

    if (bulkOps.length > 0) {
        await Process.bulkWrite(bulkOps);
    }

    // Restore Cycle KPIs
    cycle.kpis = restorePoint.cycleKPIs;
    await cycle.save();

    // Delete restore point (consume it)
    await restorePoint.deleteOne();

    await auditAction(
        req,
        AuditAction.UPDATE,
        EntityType.CYCLE,
        cycle._id.toString(),
        { action: 'RESTORE_MONTH_BEFORE' },
        { action: 'RESTORE_MONTH_AFTER' }
    );

    res.json({
        success: true,
        message: 'Cycle restored successfully.',
    });
});

/**
 * Check if restore point exists
 * GET /api/cycles/:id/restore-point
 */
export const checkRestorePoint = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const activeCompanyId = req.companyId!;
    const { CycleRestorePoint } = await import('../models/CycleRestorePoint');

    const exists = await CycleRestorePoint.exists({
        cycleId: id,
        companyId: activeCompanyId
    });

    res.json({
        success: true,
        data: { hasRestorePoint: !!exists }
    });
});

/**
 * Reopen a closed cycle
 * POST /api/cycles/:id/reopen
 */
export const reopenCycle = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { roles } = req.user!;
    const activeCompanyId = req.companyId!;
    const { UserRole } = await import('../types');

    if (roles.includes(UserRole.OPERATOR) && !roles.includes(UserRole.MASTER) && !roles.includes(UserRole.MANAGER)) {
        throw new AppError('Operators are not allowed to reopen cycles', 403);
    }

    if (!roles.includes(UserRole.MANAGER) && !roles.includes(UserRole.MASTER) && !roles.includes(UserRole.MASTER)) {
        throw new AppError('Only Managers, Admins or Masters can reopen a cycle', 403);
    }

    const cycle = await Cycle.findOne({ _id: id, companyId: activeCompanyId });
    if (!cycle) throw new NotFoundError('Cycle');

    if (cycle.status === CycleStatus.OPEN) {
        throw new AppError('Cycle is already open', 400);
    }

    // Check if there's another open cycle in the SAME SECTOR
    const openCycle = await Cycle.findOne({
        companyId: activeCompanyId,
        sector: cycle.sector,
        status: CycleStatus.OPEN,
        _id: { $ne: cycle._id }
    });

    if (openCycle) {
        throw new AppError(`Não é possível reabrir este ciclo porque o ciclo de ${openCycle.month} para o setor ${cycle.sector} está aberto. Por favor, feche-o primeiro.`, 409);
    }

    cycle.status = CycleStatus.OPEN;
    cycle.closedAt = null; // Ensure closedAt is cleared when reopening
    await cycle.save();

    await auditAction(
        req,
        AuditAction.REOPEN_CYCLE,
        EntityType.CYCLE,
        cycle._id.toString(),
        { action: 'REOPEN_CYCLE', month: cycle.month },
        { status: CycleStatus.OPEN }
    );

    res.json({
        success: true,
        message: 'Cycle reopened successfully.',
        data: cycle
    });
});

