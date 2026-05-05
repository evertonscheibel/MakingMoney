import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import { Process, Cycle, EvaluationConfig, getDefaultRules } from '../models';
import { asyncHandler, AppError } from '../middleware/errors';
import { auditAction } from '../middleware/audit';
import { AuditAction, EntityType, CycleStatus, ProcessStatus, UserRole } from '../types';
import { getPendingStatus } from '../utils';

export const importProcesses = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const companyId = req.companyId!;
    const { sector, plannedDate, limitDate, responsibleUserId } = req.body;

    if (!req.file) {
        throw new AppError('No file uploaded', 400);
    }

    if (!sector || !plannedDate || !limitDate) {
        throw new AppError('Sector, plannedDate, and limitDate are required.', 400);
    }

    // Only masters and managers can import processes
    const { roles, companyAccess } = req.user!;
    const currentCompanyAccess = (companyAccess || []).find(a => a.companyId === companyId);
    const companyRole = currentCompanyAccess?.role || UserRole.OPERATOR;
    
    const isMaster = roles.includes(UserRole.MASTER) || (companyRole as any) === UserRole.MASTER;
    const isManager = roles.includes(UserRole.MANAGER) || (companyRole as any) === UserRole.MANAGER;

    if (!isMaster && !isManager) {
        throw new AppError('Apenas administradores e gestores podem importar processos.', 403);
    }

    // Find current open cycle
    const cycle = await Cycle.findOne({
        companyId,
        sector,
        status: CycleStatus.OPEN,
    });

    if (!cycle) {
        throw new AppError('No open cycle found. Please open a cycle first.', 400);
    }

    // Parse Excel
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet) as any[];

    if (!data || data.length === 0) {
        throw new AppError('The Excel file is empty', 400);
    }

    // Log the actual column names from the first row for debugging
    const firstRowKeys = data.length > 0 ? Object.keys(data[0]) : [];
    console.log('[Excel Import] Detected columns:', firstRowKeys);
    console.log('[Excel Import] First row data:', JSON.stringify(data[0]));

    // Expected columns: "numero do ID" (code) and "nome do Processo" (title)
    const processesToCreate = [];
    const errors: string[] = [];

    const planned = new Date(plannedDate);
    const limit = new Date(limitDate);
    const initialStatus = getPendingStatus(planned, limit);

    for (let i = 0; i < data.length; i++) {
        const row = data[i];

        // Find keys case-insensitively and trim them
        const findValue = (possibleNames: string[]) => {
            const key = Object.keys(row).find(k =>
                possibleNames.some(name => k.toLowerCase().trim() === name.toLowerCase().trim())
            );
            return key ? row[key] : null;
        };

        const code = findValue(['numero do ID', 'numero do id', 'id', 'código', 'codigo'])?.toString().trim();
        const title = findValue(['nome do Processo', 'nome do processo', 'processos', 'processo', 'titulo', 'título', 'nome'])?.toString().trim();

        if (!code || !title) {
            errors.push(`Linha ${i + 2}: Coluna "numero do ID" ou "nome do Processo" não encontrada ou vazia.`);
            continue;
        }

        // Validate code format (numeric, up to 5 digits as per Process model)
        if (!/^\d{1,5}$/.test(code)) {
            errors.push(`Linha ${i + 2}: Formato de ID inválido "${code}". Deve ser numérico (até 5 dígitos).`);
            continue;
        }

        processesToCreate.push({
            companyId,
            cycleId: cycle._id,
            code: code.padStart(3, '0'),
            title,
            sector,
            plannedDate: planned,
            limitDate: limit,
            status: initialStatus,
            responsibleUserId: responsibleUserId || null,
        });
    }

    if (errors.length > 0) {
        throw new AppError(`A importação falhou com os seguintes erros: ${errors.join('; ')}`, 400);
    }

    if (processesToCreate.length === 0) {
        throw new AppError('No valid processes found in the file', 400);
    }

    // Check for duplicate codes in this cycle
    const codes = processesToCreate.map(p => p.code);
    const existing = await Process.find({
        companyId,
        cycleId: cycle._id,
        code: { $in: codes }
    }).select('code');

    if (existing.length > 0) {
        const existingCodes = existing.map(e => e.code).join(', ');
        throw new AppError(`The following process codes already exist in this cycle: ${existingCodes}`, 409);
    }

    // Batch create
    const result = await Process.insertMany(processesToCreate);

    // Audit log
    await auditAction(
        req,
        AuditAction.CREATE,
        EntityType.PROCESS,
        cycle._id.toString(),
        null,
        { count: result.length, codes: result.map(p => p.code) }
    );

    res.status(201).json({
        success: true,
        message: `Successfully imported ${result.length} processes.`,
        data: result
    });
});

