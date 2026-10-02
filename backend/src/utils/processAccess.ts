import { Request } from 'express';
import { Company, Cycle, User } from '../models';
import { AppError } from '../middleware/errors';
import { CycleStatus, UserRole } from '../types';
import { getCompanyRole, getEffectiveSectors, isSectorManager } from './permissions';

export async function getCompanySectorScope(req: Request): Promise<string[] | null> {
    const company = await Company.findById(req.companyId);
    if (!company) throw new AppError('Empresa não encontrada.', 404);
    if (getCompanyRole(req.user!, req.companyId!) === UserRole.MASTER) return null;
    const assigned = getEffectiveSectors(req.user!, req.companyId!);
    return company.sectors.filter(s => assigned.includes(s.name) || isSectorManager(s, req.user!.userId)).map(s => s.name);
}

export async function assertSectorAccess(req: Request, sector: string, manage = false): Promise<void> {
    const role = getCompanyRole(req.user!, req.companyId!);
    if (manage && role === UserRole.OPERATOR) throw new AppError('Apenas administradores e gestores podem gerenciar processos.', 403);
    const scope = await getCompanySectorScope(req);
    if (scope !== null && !scope.includes(sector)) throw new AppError('Você não tem permissão para este setor nesta empresa.', 403);
    const company = await Company.findById(req.companyId);
    if (!company?.sectors.some(s => s.name === sector)) throw new AppError('Setor não encontrado nesta empresa.', 400);
}

export async function assertOpenProcess(req: Request, process: any, responsibleOnly = false): Promise<void> {
    await assertSectorAccess(req, process.sector);
    if (responsibleOnly && getCompanyRole(req.user!, req.companyId!) === UserRole.OPERATOR && String(process.responsibleUserId) !== req.user!.userId) {
        throw new AppError('Você só pode alterar entregas dos processos sob sua responsabilidade.', 403);
    }
    const cycle = await Cycle.findOne({ _id: process.cycleId, companyId: req.companyId });
    if (!cycle || cycle.status !== CycleStatus.OPEN) throw new AppError('Não é possível alterar processos de um ciclo fechado.', 400);
    if (responsibleOnly && process.isActive === false) throw new AppError('Processo inativo não pode receber ações de entrega.', 400);
}

export async function assertResponsibleAccess(req: Request, responsibleUserId: string | undefined, sector: string): Promise<void> {
    if (!responsibleUserId) return;
    const user = await User.findOne({ _id: responsibleUserId, 'companyAccess.companyId': req.companyId });
    if (!user) throw new AppError('O responsável não tem acesso a esta empresa.', 400);
    const company = await Company.findById(req.companyId);
    const accessUser = {
        roles: user.roles,
        companyAccess: user.companyAccess.map(a => ({ companyId: String(a.companyId), role: a.role, sectors: a.sectors })),
        sectors: user.sectors, sector: user.sector,
    };
    if (getCompanyRole(accessUser as any, req.companyId!) !== UserRole.MASTER &&
        !getEffectiveSectors(accessUser as any, req.companyId!).includes(sector) &&
        !company?.sectors.some(s => s.name === sector && isSectorManager(s, responsibleUserId))) {
        throw new AppError('O responsável não tem acesso ao setor selecionado.', 400);
    }
}
