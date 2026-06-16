import { Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import { asyncHandler, NotFoundError, AppError } from '../middleware/errors';
import { auditAction } from '../middleware/audit';
import { AuditAction, EntityType, CycleStatus, DeliverySource, ProcessStatus, UserRole } from '../types';
import { Types } from 'mongoose';
import { calculateScore, getPendingStatus } from '../utils';
import { logger } from '../config';
import { EmailService } from '../services/email.service';
import { getProcessDeliveryEmailTemplate } from '../services/email/templates/processDelivery.template';

// Validation rules
export const createProcessValidation = [
    body('code').optional().matches(/^\d{1,5}$/).withMessage('Code must be numeric (e.g., 001)'),
    body('title').trim().isLength({ min: 3, max: 200 }).withMessage('Title must be 3-200 characters'),
    body('sector').trim().notEmpty().withMessage('Sector is required'),
    body('owner').optional().trim(),
    body('plannedDate').isISO8601().withMessage('Planned date must be a valid date'),
    body('limitDate').isISO8601().withMessage('Limit date must be a valid date'),
    body('responsibleUserId').optional().isMongoId().withMessage('Invalid responsible user ID'),
];

export const updateProcessValidation = [
    param('id').isMongoId().withMessage('Invalid process ID'),
    body('code').optional().matches(/^\d{1,5}$/).withMessage('Invalid code format'),
    body('title').optional().trim().isLength({ min: 3, max: 200 }),
    body('sector').optional().trim().notEmpty(),
    body('plannedDate').optional().isISO8601(),
    body('limitDate').optional().isISO8601(),
    body('responsibleUserId').optional().isMongoId().withMessage('Invalid responsible user ID'),
];

export const deliverProcessValidation = [
    param('id').isMongoId().withMessage('Invalid process ID'),
    body('deliveryDate').isISO8601().withMessage('Delivery date must be a valid date'),
    body('deliveryEvidence').optional().trim(),
];

export const confirmDeliveryValidation = [
    param('id').isMongoId().withMessage('Invalid process ID'),
    body('deliveryDate').isISO8601().withMessage('Delivery date must be a valid date'),
    body('deliveryEvidence').optional().trim(),
];

export const revertDeliveryValidation = [
    param('id').isMongoId().withMessage('Invalid process ID'),
    body('reason').trim().notEmpty().withMessage('Reason is required'),
];

export const listProcessesValidation = [
    query('cycleId').optional().isMongoId().withMessage('Invalid cycle ID'),
    query('sector').optional().trim(),
    query('status').optional().isIn(Object.values(ProcessStatus)),
];

/**
 * List processes with filters
 * GET /api/processes
 */
export const listProcesses = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { roles: globalRoles, userId, sectors: userSectors, sector: legacySector, companyAccess } = req.user!;
    const companyId = req.companyId!;
    const { cycleId, sector, status, search, responsibleUserId, active, page = '1', limit = '100' } = req.query;

    const { Process, Cycle, Company } = await import('../models');

    // Determine role for THIS specific company
    const currentCompanyAccess = (companyAccess || []).find(a => a.companyId === companyId);
    const companyRole = currentCompanyAccess?.role || UserRole.OPERATOR;

    // A user is MASTER if they have the MASTER role globally OR specifically for this company
    const isMaster = globalRoles.includes(UserRole.MASTER) || (companyRole as any) === UserRole.MASTER;
    const isManager = (companyRole as any) === UserRole.MANAGER || globalRoles.includes(UserRole.MANAGER);

    const filter: Record<string, any> = { companyId };

    if (!isMaster) {
        filter.isActive = { $ne: false };
    } else if (active !== undefined) {
        filter.isActive = active === 'true';
    }

    // Fetch company to check sector responsibilities
    const company = await Company.findById(companyId);
    const managedSectors = company?.sectors
        .filter(s => s.managerId && s.managerId.toString() === userId)
        .map(s => s.name) || [];

    const allUserSectors = [...new Set([...managedSectors, ...(userSectors || []), ...(legacySector ? [legacySector] : [])])];

    let allowedSectors: string[] | null = null;
    if (isMaster) {
        allowedSectors = null;
    } else if (allUserSectors.length > 0) {
        allowedSectors = allUserSectors;
    } else {
        res.json({ success: true, data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } });
        return;
    }

    if (allowedSectors !== null) {
        if (sector) {
            if (allowedSectors.includes(sector as string)) { filter.sector = sector; }
            else { res.json({ success: true, data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } }); return; }
        } else {
            filter.sector = { $in: allowedSectors };
        }
    } else if (sector) {
        filter.sector = sector;
    }

    if (globalRoles.includes(UserRole.OPERATOR) && !isMaster && !isManager) {
        if (responsibleUserId) { filter.responsibleUserId = responsibleUserId; }
    } else if (responsibleUserId) {
        filter.responsibleUserId = responsibleUserId;
    }

    if (cycleId) {
        filter.cycleId = cycleId;
    } else if (filter.sector && typeof filter.sector === 'string') {
        const currentCycle = await Cycle.findOne({ companyId, sector: filter.sector, status: CycleStatus.OPEN }).sort({ month: -1 });
        if (currentCycle) { filter.cycleId = currentCycle._id; }
    } else if (!sector) {
        const cycles = await Cycle.find({ companyId, status: CycleStatus.OPEN });
        if (cycles.length > 0) { filter.cycleId = { $in: cycles.map(c => c._id) }; }
    }

    if (status) { filter.status = status; }
    if (search) {
        filter.$or = [{ code: { $regex: search, $options: 'i' } }, { title: { $regex: search, $options: 'i' } }];
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    const [processes, total] = await Promise.all([
        Process.find(filter).sort({ code: 1 }).skip(skip).limit(limitNum),
        Process.countDocuments(filter),
    ]);

    res.json({ success: true, data: processes, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } });
});

/**
 * Get single process
 * GET /api/processes/:id
 */
export const getProcess = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const companyId = req.companyId!;
    const { roles: globalRoles, userId, sectors: userSectors, sector: legacySector, companyAccess } = req.user!;

    const { Process, Company } = await import('../models');

    if (!Types.ObjectId.isValid(id as any)) { throw new NotFoundError('Process'); }

    const process = await Process.findOne({ _id: id, companyId });
    if (!process) { throw new NotFoundError('Process'); }

    const currentCompanyAccess = (companyAccess || []).find(a => a.companyId === companyId);
    const companyRole = currentCompanyAccess?.role || UserRole.OPERATOR;
    const isMaster = globalRoles.includes(UserRole.MASTER) || (companyRole as any) === UserRole.MASTER;

    if (!isMaster) {
        const company = await Company.findById(companyId);
        const managedSectors = company?.sectors.filter(s => s.managerId && s.managerId.toString() === userId).map(s => s.name) || [];
        const allowedSectors = [...new Set([...(userSectors || []), ...(legacySector ? [legacySector] : []), ...managedSectors])];

        if (!allowedSectors.includes(process.sector)) { throw new AppError('Access to this process is denied', 403); }
    }

    res.json({ success: true, data: process });
});

/**
 * Create new process
 * POST /api/processes
 */
export const createProcess = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const companyId = req.companyId!;
    const { code, title, sector, owner, plannedDate, limitDate, responsibleUserId, isActive } = req.body;

    const { Process, Cycle } = await import('../models');
    const { getPendingStatus } = await import('../utils');
    const { roles: globalRoles, companyAccess } = req.user!;

    // Determine role for THIS specific company
    const currentCompanyAccess = (companyAccess || []).find(a => a.companyId === companyId);
    const companyRole = currentCompanyAccess?.role || UserRole.OPERATOR;
    const isMaster = globalRoles.includes(UserRole.MASTER) || (companyRole as any) === UserRole.MASTER;
    const isManager = (companyRole as any) === UserRole.MANAGER || globalRoles.includes(UserRole.MANAGER);

    if (!isMaster && !isManager) {
        throw new AppError('Apenas administradores e gestores podem criar processos.', 403);
    }

    const cycle = await Cycle.findOne({ companyId, sector, status: CycleStatus.OPEN });
    if (!cycle) { throw new AppError('No open cycle for this sector.', 400); }

    const existing = await Process.findOne({ companyId, cycleId: cycle._id, code: code?.toUpperCase() });
    if (code && existing) { throw new AppError(`Processo ${code} já existe neste ciclo para o setor ${sector}.`, 409); }

    const planned = new Date(plannedDate);
    const limit = new Date(limitDate);
    if (limit < planned) { throw new AppError('Limit date cannot be before planned date', 400); }

    let finalCode = code;
    if (!finalCode) {
        const lastProcess = await Process.findOne({ companyId, sector }).sort({ code: -1 }).collation({ locale: "en_US", numericOrdering: true });
        let nextCodeNum = 1;
        if (lastProcess) {
            const lastNum = parseInt(lastProcess.code, 10);
            if (!isNaN(lastNum)) { nextCodeNum = lastNum + 1; }
        }
        finalCode = nextCodeNum.toString().padStart(3, '0');
    }

    const finalIsActive = isActive !== undefined ? (isMaster ? isActive === true || isActive === 'true' : true) : true;

    const process = await Process.create({
        companyId, cycleId: cycle._id, code: finalCode, title, sector, owner: owner || null, plannedDate: planned, limitDate: limit, status: getPendingStatus(planned, limit), responsibleUserId: responsibleUserId || null,
        isActive: finalIsActive,
    });

    await auditAction(req, AuditAction.CREATE, EntityType.PROCESS, process._id.toString(), null, process.toObject() as any);

    res.status(201).json({ success: true, data: process });
});

/**
 * Update process
 * PUT /api/processes/:id
 */
export const updateProcess = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { userId, roles: globalRoles, sectors: userSectors, sector: legacySector, companyAccess } = req.user!;
    const companyId = req.companyId!;
    const updates = req.body;

    const { Process, Cycle, Company } = await import('../models');
    const { getPendingStatus } = await import('../utils');

    const process = await Process.findOne({ _id: id, companyId });
    if (!process) { throw new NotFoundError('Process'); }

    const cycle = await Cycle.findById(process.cycleId);
    if (!cycle || cycle.status !== CycleStatus.OPEN) { throw new AppError('Cannot modify process in a closed cycle', 400); }

    const currentCompanyAccess = (companyAccess || []).find(a => a.companyId === companyId);
    const companyRole = currentCompanyAccess?.role || UserRole.OPERATOR;
    const isMaster = globalRoles.includes(UserRole.MASTER) || (companyRole as any) === UserRole.MASTER;
    const isManager = (companyRole as any) === UserRole.MANAGER || globalRoles.includes(UserRole.MANAGER);

    if (!isMaster && !isManager) {
        throw new AppError('Apenas administradores e gestores podem alterar os dados básicos de processos.', 403);
    }

    if (!isMaster) {
        const company = await Company.findById(companyId);
        const managedSectors = company?.sectors.filter(s => s.managerId && s.managerId.toString() === userId).map(s => s.name) || [];
        const allowedSectors = [...new Set([...(userSectors || []), ...(legacySector ? [legacySector] : []), ...managedSectors])];

        if (!allowedSectors.includes(process.sector)) { throw new AppError('You do not have permission to modify processes in this sector', 403); }
        if (updates.sector && !allowedSectors.includes(updates.sector)) { throw new AppError('You cannot move a process to a sector you do not have access to', 403); }
    }

    const before = process.toObject();
    if (updates.isActive !== undefined) {
        if (!isMaster) {
            throw new AppError('Apenas usuários Master podem ativar ou inativar processos.', 403);
        }
        process.isActive = updates.isActive === true || updates.isActive === 'true';
    }
    if (updates.code) process.code = updates.code.toUpperCase();
    if (updates.title) process.title = updates.title;
    if (updates.sector) process.sector = updates.sector;
    if (updates.owner !== undefined) process.owner = updates.owner || null;
    if (updates.plannedDate) process.plannedDate = new Date(updates.plannedDate);
    if (updates.limitDate) process.limitDate = new Date(updates.limitDate);
    if (updates.responsibleUserId !== undefined) process.responsibleUserId = updates.responsibleUserId as any;

    if (process.limitDate < process.plannedDate) { throw new AppError('Limit date cannot be before planned date', 400); }
    if (!process.deliveryDate) { process.status = getPendingStatus(process.plannedDate, process.limitDate); }

    await process.save();
    await auditAction(req, AuditAction.UPDATE, EntityType.PROCESS, process._id.toString(), before as unknown as Record<string, unknown>, process.toObject() as unknown as Record<string, unknown>);

    res.json({ success: true, data: process });
});

/**
 * Mark process as delivered (manual)
 * PUT /api/processes/:id/deliver
 */
export const deliverProcess = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { userId, roles: globalRoles, sectors: userSectors, sector: legacySector, companyAccess } = req.user!;
    const companyId = req.companyId!;
    const { deliveryDate, deliveryEvidence } = req.body;

    const { Process, EvaluationConfig, Company, User, getDefaultRules } = await import('../models');
    const { calculateScore } = await import('../utils');

    const process = await Process.findOne({ _id: id, companyId });
    if (!process) { throw new NotFoundError('Process'); }

    const currentCompanyAccess = (companyAccess || []).find(a => a.companyId === companyId);
    const companyRole = currentCompanyAccess?.role || UserRole.OPERATOR;
    const isMaster = globalRoles.includes(UserRole.MASTER) || (companyRole as any) === UserRole.MASTER;

    if (!isMaster) {
        const company = await Company.findById(companyId);
        const managedSectors = company?.sectors.filter(s => s.managerId && s.managerId.toString() === userId).map(s => s.name) || [];
        const allowedSectors = [...new Set([...(userSectors || []), ...(legacySector ? [legacySector] : []), ...managedSectors])];
        if (!allowedSectors.includes(process.sector)) { throw new AppError('Access to this process is denied', 403); }
    }

    if (globalRoles.includes(UserRole.OPERATOR) && !globalRoles.includes(UserRole.MASTER) && !globalRoles.includes(UserRole.MANAGER) && process.responsibleUserId?.toString() !== userId) {
        throw new AppError('You can only report delivery for processes assigned to you', 403);
    }

    const evalConfig = await EvaluationConfig.findOne({ companyId, isActive: true });
    const rules = evalConfig?.rules || getDefaultRules();
    const before = process.toObject();
    const delivery = new Date(deliveryDate);
    const { score, status } = calculateScore(process.plannedDate, process.limitDate, delivery, rules);

    process.deliveryDate = delivery;
    process.deliverySource = DeliverySource.MANUAL;
    process.deliveryEvidence = deliveryEvidence || null;
    process.score = score;
    process.status = status;
    await process.save();

    await auditAction(req, AuditAction.UPDATE, EntityType.PROCESS, process._id.toString(), before as unknown as Record<string, unknown>, process.toObject() as unknown as Record<string, unknown>);

    res.json({ success: true, data: process, message: `Process delivered. Score: ${score}` });
});

/**
 * Send process details via email
 * POST /api/processes/:id/send-email
 */
export const sendProcessEmail = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { userId, roles: globalRoles, sectors: userSectors, sector: legacySector, companyAccess } = req.user!;
    const companyId = req.companyId!;
    const { to, message: customMessage } = req.body;

    const { Process, Company, User, EvaluationConfig } = await import('../models');

    const process = await Process.findOne({ _id: id, companyId });
    if (!process) { throw new NotFoundError('Process'); }

    const currentCompanyAccess = (companyAccess || []).find(a => a.companyId === companyId);
    const companyRole = currentCompanyAccess?.role || UserRole.OPERATOR;
    const isMaster = globalRoles.includes(UserRole.MASTER) || (companyRole as any) === UserRole.MASTER;
    const isManager = (companyRole as any) === UserRole.MANAGER || globalRoles.includes(UserRole.MANAGER);
    const isOperator = !isMaster && !isManager;

    const company = await Company.findById(companyId);
    const managedSectors = company?.sectors.filter(s => s.managerId && s.managerId.toString() === userId).map(s => s.name) || [];
    const allowedSectors = [...new Set([...(userSectors || []), ...(legacySector ? [legacySector] : []), ...managedSectors])];

    if (!isMaster) {
        if (!allowedSectors.includes(process.sector)) { throw new AppError('Access to this process is denied', 403); }
    }

    if (isOperator && !allowedSectors.includes(process.sector)) {
        throw new AppError('You only have permission to send emails for processes in your allowed sectors', 403);
    }

    let recipients: string[] = [];
    if (isOperator) {
        const activeConfig = await EvaluationConfig.findOne({ companyId: companyId as any, isActive: true });
        if (!activeConfig || !activeConfig.rules.notificationEmails || activeConfig.rules.notificationEmails.length === 0) {
            res.json({ success: true, message: 'Processo registrado, mas nenhum e-mail de notificação foi enviado pois não há e-mails configurados nos Parâmetros de Avaliação.' });
            return;
        }
        recipients = activeConfig.rules.notificationEmails.map(e => e.trim()).filter(e => e);
    } else {
        if (!to || typeof to !== 'string' || !to.trim()) { throw new AppError('Email recipient is required', 400); }
        recipients = to.split(',').map((e: string) => e.trim()).filter((e: string) => e);
    }

    const sender = await User.findById(userId).select('name email');
    const statusText = process.status === ProcessStatus.ON_TIME ? 'No Prazo' : process.status === ProcessStatus.LATE ? 'Atrasado' : process.status === ProcessStatus.CRITICAL ? 'Crítico' : 'Pendente';

    const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Metodo Chronos - Detalhes do Processo</h2>
            <p>Você recebeu informações sobre um processo.</p>
            ${customMessage ? `<div style="background-color: #f0f9ff; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0;"><p>${customMessage}</p></div>` : ''}
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Código:</strong> ${process.code}</p><p><strong>Título:</strong> ${process.title}</p><p><strong>Setor:</strong> ${process.sector}</p>
                <p><strong>Data Planejada:</strong> ${process.plannedDate.toLocaleDateString('pt-BR')}</p><p><strong>Data Limite:</strong> ${process.limitDate.toLocaleDateString('pt-BR')}</p><p><strong>Status:</strong> ${statusText}</p>
            </div>
            <p style="font-size: 12px;">Enviado por: ${sender?.name} (${sender?.email})</p>
        </div>`;

    for (const recipient of recipients) {
        await EmailService.enqueue(companyId as any, { to: recipient, subject: `Processo: ${process.code} - ${process.title}`, html: emailHtml, category: 'process_share', entityId: process._id.toString(), entityType: 'Process', createdBy: userId });
    }

    res.json({ success: true, message: `Email enqueued for ${recipients.length} recipients` });
});

/**
 * Delete process
 */
export const deleteProcess = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { userId, roles: globalRoles, sectors: userSectors, sector: legacySector, companyAccess } = req.user!;
    const companyId = req.companyId!;

    const { Process, Cycle, Company } = await import('../models');

    const process = await Process.findOne({ _id: id, companyId });
    if (!process) { throw new NotFoundError('Process'); }

    const currentCompanyAccess = (companyAccess || []).find(a => a.companyId === companyId);
    const companyRole = currentCompanyAccess?.role || UserRole.OPERATOR;
    const isMaster = globalRoles.includes(UserRole.MASTER) || (companyRole as any) === UserRole.MASTER;
    const isManager = (companyRole as any) === UserRole.MANAGER || globalRoles.includes(UserRole.MANAGER);

    if (!isMaster) {
        const company = await Company.findById(companyId);
        const managedSectors = company?.sectors.filter(s => s.managerId && s.managerId.toString() === userId).map(s => s.name) || [];
        const allowedSectors = [...new Set([...(userSectors || []), ...(legacySector ? [legacySector] : []), ...managedSectors])];
        if (!allowedSectors.includes(process.sector)) { throw new AppError('You do not have permission to delete processes in this sector', 403); }
        if (!isManager) { throw new AppError('Operators are not allowed to delete processes', 403); }
    }

    const cycle = await Cycle.findById(process.cycleId);
    if (!cycle || cycle.status !== CycleStatus.OPEN) { throw new AppError('Cannot delete process from a closed cycle', 400); }

    const before = process.toObject();
    await process.deleteOne();
    await auditAction(req, AuditAction.DELETE, EntityType.PROCESS, id as string, before as unknown as Record<string, unknown>, null);

    res.json({ success: true, message: 'Process deleted successfully' });
});

/**
 * NEW DELIVERY FLOW HANDLERS
 */
export const confirmDelivery = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { userId, roles: globalRoles, sectors: userSectors, sector: legacySector, companyAccess } = req.user!;
    const companyId = req.companyId!;
    const { deliveryDate, deliveryEvidence } = req.body;

    const { Process, Company, EvaluationConfig, getDefaultRules } = await import('../models');

    const process = await Process.findOne({ _id: id, companyId });
    if (!process) { throw new NotFoundError('Process'); }

    const currentCompanyAccess = (companyAccess || []).find(a => a.companyId === companyId);
    const companyRole = currentCompanyAccess?.role || UserRole.OPERATOR;
    const isMaster = globalRoles.includes(UserRole.MASTER) || (companyRole as any) === UserRole.MASTER;
    const company = await Company.findById(companyId);
    const managedSectors = company?.sectors.filter(s => s.managerId && s.managerId.toString() === userId).map(s => s.name) || [];
    const allowedSectors = [...new Set([...(userSectors || []), ...(legacySector ? [legacySector] : []), ...managedSectors])];

    if (!isMaster && !allowedSectors.includes(process.sector)) {
        throw new AppError('Permission denied for this process sector', 403);
    }

    // Allow confirmation if deliveryStatus is NOT_DELIVERED or undefined (for legacy processes)
    if (process.deliveryStatus && process.deliveryStatus !== 'NOT_DELIVERED') { throw new AppError('Process already confirmed', 400); }

    const evalConfig = await EvaluationConfig.findOne({ companyId, isActive: true });
    const rules = evalConfig?.rules || getDefaultRules();
    const delivery = new Date(deliveryDate);
    const { score, status } = calculateScore(process.plannedDate, process.limitDate, delivery, rules);

    process.deliveryDate = delivery;
    process.deliverySource = DeliverySource.MANUAL;
    process.deliveryEvidence = deliveryEvidence || null;
    process.score = score;
    process.status = status;
    process.deliveryStatus = 'CONFIRMED_PENDING_EMAIL' as any;
    await process.save();

    res.json({ success: true, data: process });
});

export const sendDeliveryEmail = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { userId, roles: globalRoles, sectors: userSectors, sector: legacySector, companyAccess } = req.user!;
    const companyId = req.companyId!;

    const { Process, Company, User } = await import('../models');

    const process = await Process.findOne({ _id: id, companyId });
    if (!process) { throw new NotFoundError('Process'); }

    const currentCompanyAccess = (companyAccess || []).find(a => a.companyId === companyId);
    const companyRole = currentCompanyAccess?.role || UserRole.OPERATOR;
    const isMaster = globalRoles.includes(UserRole.MASTER) || (companyRole as any) === UserRole.MASTER;

    if (!isMaster) {
        const company = await Company.findById(companyId);
        const managedSectors = company?.sectors.filter(s => s.managerId && s.managerId.toString() === userId).map(s => s.name) || [];
        const allowedSectors = [...new Set([...(userSectors || []), ...(legacySector ? [legacySector] : []), ...managedSectors])];
        if (!allowedSectors.includes(process.sector)) { throw new AppError('Permission denied', 403); }
    }

    if (process.deliveryStatus !== 'CONFIRMED_PENDING_EMAIL') { throw new AppError('Confirm before sending email', 400); }

    const admins = await User.find({ 'companyAccess.companyId': companyId, roles: UserRole.MASTER }).select('email name');
    const company = await Company.findById(companyId);
    const sectorConfig = company?.sectors.find(s => s.name === process.sector);
    let manager = sectorConfig?.managerId ? await User.findById(sectorConfig.managerId).select('email name') : null;

    const recipients = admins.map(a => ({ email: a.email, name: a.name }));
    if (manager) { recipients.push({ email: manager.email, name: manager.name }); }

    for (const recipient of recipients) {
        const emailHtml = getProcessDeliveryEmailTemplate({ recipientName: recipient.name, process, statusText: 'Entregue' });
        await EmailService.enqueue(companyId as any, { to: recipient.email, subject: `Processo Entregue: ${process.code}`, html: emailHtml, category: 'process_delivery', entityId: process._id.toString(), entityType: 'Process', createdBy: userId });
    }

    process.deliveryStatus = 'EMAIL_SENT' as any;
    process.emailSentAt = new Date();
    await process.save();

    res.json({ success: true, data: process });
});

export const revertDelivery = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { userId, roles: globalRoles, sectors: userSectors, sector: legacySector, companyAccess } = req.user!;
    const companyId = req.companyId!;
    const { reason } = req.body;

    const { Process, Company } = await import('../models');
    const { getPendingStatus } = await import('../utils');

    const process = await Process.findOne({ _id: id, companyId });
    if (!process) { throw new NotFoundError('Process'); }

    const currentCompanyAccess = (companyAccess || []).find(a => a.companyId === companyId);
    const companyRole = currentCompanyAccess?.role || UserRole.OPERATOR;
    const isMaster = globalRoles.includes(UserRole.MASTER) || (companyRole as any) === UserRole.MASTER;

    if (!isMaster) {
        const company = await Company.findById(companyId);
        const managedSectors = company?.sectors.filter(s => s.managerId && s.managerId.toString() === userId).map(s => s.name) || [];
        const allowedSectors = [...new Set([...(userSectors || []), ...(legacySector ? [legacySector] : []), ...managedSectors])];
        if (!allowedSectors.includes(process.sector)) { throw new AppError('Permission denied', 403); }
    }

    const before = process.toObject();

    // Explicitly use updateOne to bypass any potential Mongoose save issues with null fields
    await Process.updateOne(
        { _id: id, companyId },
        {
            $set: {
                deliveryDate: null,
                deliveryStatus: 'NOT_DELIVERED',
                deliverySource: null,
                deliveryEvidence: null,
                score: null,
                emailSentAt: null,
                status: getPendingStatus(process.plannedDate, process.limitDate),
                revertReason: reason,
                revertedBy: userId,
                revertedAt: new Date()
            }
        }
    );

    const updatedProcess = await Process.findById(id);
    if (!updatedProcess) { throw new AppError('Error following update', 500); }

    await auditAction(req, AuditAction.UPDATE, EntityType.PROCESS, updatedProcess._id.toString(), before as unknown as Record<string, unknown>, updatedProcess.toObject() as unknown as Record<string, unknown>);

    res.json({ success: true, data: updatedProcess });
});
