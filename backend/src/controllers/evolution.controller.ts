import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Process, Cycle, AuditLog, EvaluationConfig, User } from '../models';
import { OperationalMilestone } from '../models/OperationalMilestone';
import { asyncHandler, AppError } from '../middleware/errors';
import { getCompanySectorScope, assertSectorAccess } from '../utils/processAccess';
import { calculatePerformance } from '../utils/performance';
import { assessmentIndicators, assessmentState, businessToday } from '../utils/assessment';

const round = (n: number) => Math.round(n * 100) / 100;
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
export function monthRange(from: string, to: string) {
    if (!monthPattern.test(from) || !monthPattern.test(to) || from > to) throw new AppError('Informe intervalo mensal válido.', 400);
    const result: string[] = [];
    const date = new Date(`${from}-01T00:00:00Z`);
    while (date.toISOString().slice(0, 7) <= to) {
        result.push(date.toISOString().slice(0, 7));
        if (result.length > 60) throw new AppError('Selecione no máximo 60 meses.', 400);
        date.setUTCMonth(date.getUTCMonth() + 1);
    }
    return result;
}
const keyFor = (month: string, groupBy: string) => groupBy === 'quarter'
    ? `${month.slice(0, 4)}-Q${Math.ceil(Number(month.slice(5)) / 3)}` : month;

export async function sectorScope(req: Request) {
    const scope = await getCompanySectorScope(req);
    const sector = req.query.sector;
    if (sector !== undefined && (typeof sector !== 'string' || !sector.trim())) throw new AppError('Setor inválido.', 400);
    if (sector && scope !== null && !scope.includes(String(sector))) throw new AppError('Setor não autorizado.', 403);
    return sector ? String(sector) : scope === null ? undefined : { $in: scope };
}

type Row = any;
function lineages(rows: Row[]) {
    const result = new Map<string, Row[]>();
    for (const row of rows) if (row.lineageKey && row.isActive !== false && row.assessmentRequired !== false) {
        const entries = result.get(row.lineageKey) || [];
        entries.push(row); result.set(row.lineageKey, entries);
    }
    return result;
}

function compare(a: any, b: any, equivalent: boolean) {
    if (!a || !b) return null;
    const left = lineages(a.rows), right = lineages(b.rows);
    const ambiguous = (rows: Row[]) => new Set(rows.map(r => r.month)).size !== rows.length;
    const common = [...left.keys()].filter(id => right.has(id) && !ambiguous(left.get(id)!) && !ambiguous(right.get(id)!));
    const commonSet = new Set(common);
    const excluded = [a, b].flatMap(point => point.rows.filter((row: Row) => !commonSet.has(row.lineageKey)
        || row.isActive === false || row.assessmentRequired === false).map((row: Row) => ({
        processId: String(row._id), code: row.code, title: row.title, period: point.period,
        reason: row.isActive === false ? 'INATIVO' : row.assessmentRequired === false ? 'NAO_APLICAVEL'
            : !row.lineageKey ? 'IDENTIDADE_NAO_CONFIRMADA' : 'FORA_DA_CARTEIRA_COMUM_OU_DUPLICADO',
    })));
    const select = (point: any) => point.rows.filter((row: Row) => !equivalent || (commonSet.has(row.lineageKey)
        && row.isActive !== false && row.assessmentRequired !== false));
    const previous = calculatePerformance(select(a)), current = calculatePerformance(select(b));
    return { from: a.period, to: b.period, equivalent, commonProcessCount: common.length, excluded,
        previous, current, deltaPoints: previous.performanceAverage == null || current.performanceAverage == null
            ? null : round(current.performanceAverage - previous.performanceAverage),
        compositionChanged: excluded.length > 0, partialPeriods: a.partial || b.partial };
}

/** Reconstructed series from per-competence documents. Closed KPI snapshots are untouched. */
export const getPerformanceEvolution = asyncHandler(async (req: Request, res: Response) => {
    const now = new Date(), today = businessToday(now);
    const from = String(req.query.from || `${today.slice(0, 4)}-01`), to = String(req.query.to || today.slice(0, 7));
    const months = monthRange(from, to);
    const groupBy = req.query.groupBy || 'month';
    if (!['month', 'quarter'].includes(String(groupBy))) throw new AppError('Agrupamento inválido.', 400);
    for (const field of ['userId', 'processId']) if (req.query[field] !== undefined && !Types.ObjectId.isValid(String(req.query[field]))) throw new AppError(`${field} inválido.`, 400);
    const sector = await sectorScope(req);
    const cycleFilter: any = { companyId: req.companyId, month: { $gte: from, $lte: to } };
    if (sector !== undefined) cycleFilter.sector = sector;
    const cycles = await Cycle.find(cycleFilter).lean();
    const cycleMap = new Map(cycles.map(c => [String(c._id), c]));
    const filter: any = { companyId: req.companyId, cycleId: { $in: cycles.map(c => c._id) } };
    if (req.query.category) filter.category = String(req.query.category);
    let documents: any[] = await Process.find(filter).limit(10001).lean();
    if (documents.length > 10000) throw new AppError('Recorte acima de 10 mil processos. Reduza o intervalo ou selecione um setor.', 400);
    const categories = [...new Set(documents.map(p => p.category).filter(Boolean))].sort();
    const provenRoots = new Set(documents.filter(p => p.lineageId).map(p => String(p.lineageId)));
    let rows: Row[] = documents.map(p => ({ ...p, month: cycleMap.get(String(p.cycleId))!.month,
        lineageKey: p.lineageId ? String(p.lineageId) : provenRoots.has(String(p._id)) ? String(p._id) : null,
        // A rule version marks attribution recorded at delivery, including an explicit "no responsible" (null).
        effectiveResponsibleId: p.score != null && (p.evaluationRuleVersion != null || p.evaluatedResponsibleUserId != null)
            ? (p.evaluatedResponsibleUserId ? String(p.evaluatedResponsibleUserId) : null)
            : p.responsibleUserId ? String(p.responsibleUserId) : null,
        attributionQuality: p.score != null && (p.evaluationRuleVersion != null || p.evaluatedResponsibleUserId != null) ? 'AT_DELIVERY' : 'DOCUMENT',
    }));
    if (req.query.userId) rows = rows.filter(p => p.effectiveResponsibleId === req.query.userId);
    const processOptions = req.query.processId ? rows.map(p => ({
        id: String(p._id), code: p.code, title: p.title, month: p.month, sector: p.sector,
    })) : undefined;
    if (req.query.processId) {
        const selected = rows.find(p => String(p._id) === req.query.processId);
        if (!selected) throw new AppError('Processo fora do recorte autorizado.', 404);
        rows = rows.filter(p => selected.lineageKey ? p.lineageKey === selected.lineageKey : String(p._id) === String(selected._id));
    }
    const processCycles = req.query.processId ? rows.map(p => {
        const cycle = cycleMap.get(String(p.cycleId))!;
        const [year, month] = p.month.split('-').map(Number);
        const cutoff = new Date(Math.min(now.getTime(), Date.UTC(year, month, 1, 3, 59, 59, 999)));
        return {
            id: String(p._id), month: p.month, sector: p.sector, cycleStatus: cycle.status,
            plannedDate: p.plannedDate, limitDate: p.limitDate, deliveryDate: p.deliveryDate ?? null,
            score: p.score ?? null, isActive: p.isActive !== false,
            assessment: p.assessmentRequired === false ? 'NAO_APLICAVEL' : assessmentState(p, cutoff),
            coveragePct: assessmentIndicators([p], cutoff).coveragePct,
        };
    }).sort((a, b) => a.month.localeCompare(b.month) || a.sector.localeCompare(b.sector)) : undefined;
    const actorIds = [...new Set(rows.map(p => p.effectiveResponsibleId).filter(Boolean))];
    const actors = await User.find({ _id: { $in: actorIds }, 'companyAccess.companyId': req.companyId }).select('_id name').lean();
    const names = new Map(actors.map(u => [String(u._id), u.name]));
    const groups = new Map<string, { months: string[]; rows: Row[] }>();
    for (const month of months) {
        const key = keyFor(month, String(groupBy));
        const group = groups.get(key) || { months: [], rows: [] };
        group.months.push(month); group.rows.push(...rows.filter(p => p.month === month)); groups.set(key, group);
    }
    const points = [...groups.entries()].map(([period, group]) => {
        const endMonth = group.months[group.months.length - 1];
        const [year, month] = endMonth.split('-').map(Number);
        const end = new Date(Date.UTC(year, month, 1, 3, 59, 59, 999)); // end of calendar month in Cuiabá
        const cutoff = end < now ? end : now;
        const relevantCycles = cycles.filter(c => group.months.includes(c.month));
        return { period, months: group.months, rows: group.rows,
            ...calculatePerformance(group.rows), ...assessmentIndicators(group.rows, cutoff),
            observedMonths: new Set(group.rows.filter(p => p.isActive !== false && typeof p.score === 'number').map(p => p.month)).size,
            partial: relevantCycles.some(c => c.status === 'OPEN') || (groupBy === 'quarter' && group.months.length < 3)
                || end > now,
            hasData: group.rows.length > 0 };
    });

    const dateStart = new Date(`${from}-01T04:00:00Z`);
    const [endYear, endMonth] = to.split('-').map(Number);
    const dateEnd = new Date(Date.UTC(endYear, endMonth, 1, 3, 59, 59, 999));
    const ids = rows.map(p => p._id), rowMap = new Map(rows.map(p => [String(p._id), p]));
    const [audits, configs, milestones] = await Promise.all([
        AuditLog.find({ companyId: req.companyId, createdAt: { $gte: dateStart, $lte: dateEnd },
            entityType: 'process', entityId: { $in: ids } }).sort({ createdAt: 1 }).limit(2001).lean(),
        EvaluationConfig.find({ companyId: req.companyId, ...(sector && typeof sector === 'object' && !sector.$in.length ? { _id: { $in: [] } } : {}), createdAt: { $gte: dateStart, $lte: dateEnd } }).select('_id version createdAt createdBy').lean(),
        OperationalMilestone.find({ companyId: req.companyId, occurredAt: { $gte: dateStart, $lte: dateEnd },
            ...(sector !== undefined ? { sector } : {}),
            ...((req.query.userId || req.query.processId) ? { processId: { $in: ids } } : {}) }).sort({ occurredAt: 1 }).limit(1001).lean(),
    ]);
    const events: any[] = [];
    for (const audit of audits.slice(0, 2000)) {
        const before: any = audit.before || {}, after: any = audit.after || {}, row = rowMap.get(String(audit.entityId));
        const push = (type: string, description: string) => events.push({ id: `${audit._id}-${type}`, type,
            occurredAt: (audit as any).createdAt, authorId: String(audit.actorUserId), source: 'AUDITORIA',
            processId: String(audit.entityId), reference: row?.code, sector: row?.sector, description });
        if (!audit.before && after.title) push('INCLUSAO', `Inclusão: ${after.title}`);
        if (audit.before && Object.prototype.hasOwnProperty.call(after, 'responsibleUserId')
            && String(before.responsibleUserId || '') !== String(after.responsibleUserId || '')) push('TRANSFERENCIA', `Responsável alterado: ${row?.title || row?.code}`);
        if (audit.before && before.isActive !== after.isActive && typeof after.isActive === 'boolean') push(after.isActive ? 'ATIVACAO' : 'DESATIVACAO', after.deactivationReason || `Situação alterada: ${row?.title}`);
        if (audit.before && before.assessmentRequired !== after.assessmentRequired && typeof after.assessmentRequired === 'boolean') push('APLICABILIDADE', after.assessmentChangeReason || after.nonApplicableReason || 'Aplicabilidade alterada');
    }
    for (const config of configs) events.push({ id: String(config._id), type: 'REGRAS', occurredAt: config.createdAt,
        authorId: String(config.createdBy), description: `Parâmetros de avaliação: versão ${config.version}`, source: 'CONFIGURACAO' });
    for (const milestone of milestones.slice(0, 1000)) events.push({ id: String(milestone._id), type: milestone.type,
        occurredAt: milestone.occurredAt, authorId: String(milestone.authorId), sector: milestone.sector,
        processId: milestone.processId ? String(milestone.processId) : null, description: milestone.description, source: 'REGISTRO_MANUAL' });
    const authors = await User.find({ _id: { $in: [...new Set(events.map(e => e.authorId))] } }).select('_id name').lean();
    const authorNames = new Map(authors.map(u => [String(u._id), u.name]));
    events.forEach(e => { e.author = authorNames.get(e.authorId) || 'Autor não disponível'; });
    events.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
    const series = points.map(({ rows: _rows, ...point }, index) => {
        const periodEvents = events.filter(e => keyFor(businessToday(new Date(e.occurredAt)).slice(0, 7), String(groupBy)) === point.period);
        const previous = points[index - 1];
        const completeEvents = audits.length <= 2000 && milestones.length <= 1000;
        return { ...point, newProcessCount: completeEvents ? periodEvents.filter(e => e.type === 'INCLUSAO').length : null,
            transferCount: completeEvents ? periodEvents.filter(e => e.type === 'TRANSFERENCIA').length : null,
            processVolumeDelta: previous ? point.activeProcessCount - previous.activeProcessCount : null,
            deltaPoints: previous?.performanceAverage != null && point.performanceAverage != null
                ? round(point.performanceAverage - previous.performanceAverage) : null };
    });
    const requestedA = req.query.compareFrom, requestedB = req.query.compareTo;
    const a = requestedA ? points.find(p => p.period === requestedA) : points[points.length - 2];
    const b = requestedB ? points.find(p => p.period === requestedB) : points[points.length - 1];
    if ((requestedA && !a) || (requestedB && !b)) throw new AppError('Períodos de comparação fora do intervalo.', 400);
    const comparison = compare(a, b, req.query.equivalent === 'true');
    res.json({ success: true, data: { from, to, groupBy, series, comparison, events,
        categories, processOptions, processCycles, records: rows.map(p => ({ id: String(p._id), code: p.code, title: p.title, month: p.month,
            sector: p.sector, lineageId: p.lineageKey, responsibleId: p.effectiveResponsibleId,
            responsible: names.get(p.effectiveResponsibleId) || p.owner || 'Não informado', attributionQuality: p.attributionQuality })),
        warnings: { unconfirmedLineageCount: rows.filter(p => !p.lineageKey).length,
            legacyResponsibilityCount: rows.filter(p => p.attributionQuality === 'DOCUMENT' && p.score != null).length,
            eventsTruncated: audits.length > 2000 || milestones.length > 1000,
            source: 'DOCUMENTOS_POR_CICLO', deadlinePolicy: 'Fim da data limite; calendário de Cuiabá. Sem alterar tolerância da pontuação.' } } });
});

export const createMilestone = asyncHandler(async (req: Request, res: Response) => {
    const { sector, processId, type, description, occurredAt } = req.body;
    if (typeof sector !== 'string' || !['IMPLANTACAO', 'MARCO'].includes(type) || typeof description !== 'string'
        || !description.trim() || description.length > 1000 || typeof occurredAt !== 'string'
        || !/^\d{4}-\d{2}-\d{2}T/.test(occurredAt) || !Number.isFinite(new Date(occurredAt).getTime())) throw new AppError('Informe setor, tipo, data/hora e descrição válidos.', 400);
    await assertSectorAccess(req, sector, true);
    let process;
    if (processId) {
        if (!Types.ObjectId.isValid(String(processId))) throw new AppError('Processo inválido.', 400);
        process = await Process.findOne({ _id: processId, companyId: req.companyId, sector });
        if (!process) throw new AppError('Processo não pertence ao setor autorizado.', 404);
    }
    const milestone = await OperationalMilestone.create({ companyId: req.companyId, sector, type,
        description: description.trim(), occurredAt: new Date(occurredAt), processId: process?._id,
        lineageId: process?.lineageId, authorId: req.user!.userId });
    res.status(201).json({ success: true, data: milestone });
});
