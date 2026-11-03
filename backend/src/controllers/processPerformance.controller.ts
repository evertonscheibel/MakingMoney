import { Request, Response } from 'express';
import { Process, Cycle } from '../models';
import { asyncHandler, AppError } from '../middleware/errors';
import { businessToday } from '../utils/assessment';
import { monthRange, sectorScope } from './evolution.controller';

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * GET /api/reports/process-performance
 * One row per process (sector + code) with the delivery score of each cycle and the process average.
 * Months without a valid score stay null and never count as zero.
 */
export const getProcessPerformance = asyncHandler(async (req: Request, res: Response) => {
    const today = businessToday();
    const from = String(req.query.from || `${today.slice(0, 4)}-01`), to = String(req.query.to || today.slice(0, 7));
    const months = monthRange(from, to);
    const sector = await sectorScope(req);
    const cycleFilter: any = { companyId: req.companyId, month: { $gte: from, $lte: to } };
    if (sector !== undefined) cycleFilter.sector = sector;
    const cycles = await Cycle.find(cycleFilter).select('_id month').lean();
    const cycleMonth = new Map(cycles.map(c => [String(c._id), c.month]));
    const filter: any = { companyId: req.companyId, cycleId: { $in: cycles.map(c => c._id) } };
    if (req.query.code) filter.code = String(req.query.code);
    const documents: any[] = await Process.find(filter)
        .select('code title sector cycleId score status plannedDate limitDate deliveryDate isActive assessmentRequired responsibleUserId')
        .populate('responsibleUserId', 'name').limit(20001).lean();
    if (documents.length > 20000) throw new AppError('Recorte muito grande. Reduza o intervalo ou selecione um setor.', 400);

    const rows = new Map<string, any>();
    for (const p of documents) {
        const month = cycleMonth.get(String(p.cycleId))!;
        const key = `${p.sector}::${p.code}`;
        const row = rows.get(key) || { key, sector: p.sector, code: p.code, title: p.title, titles: new Set<string>(), latestMonth: '', cells: {} };
        row.titles.add(p.title);
        if (month >= row.latestMonth) { row.latestMonth = month; row.title = p.title; row.responsible = p.responsibleUserId?.name || null; }
        row.cells[month] = {
            processId: String(p._id),
            score: typeof p.score === 'number' && p.isActive !== false && p.assessmentRequired !== false ? p.score : null,
            status: p.status, delivered: p.deliveryDate != null,
            plannedDate: p.plannedDate, limitDate: p.limitDate, deliveryDate: p.deliveryDate,
            inactive: p.isActive === false, notApplicable: p.assessmentRequired === false,
        };
        rows.set(key, row);
    }

    const result = [...rows.values()].map(row => {
        const scores = months.map(m => row.cells[m]?.score).filter((s): s is number => typeof s === 'number');
        const last = scores.length ? scores[scores.length - 1] : null, previous = scores.length > 1 ? scores[scores.length - 2] : null;
        return {
            key: row.key, sector: row.sector, code: row.code, title: row.title, responsible: row.responsible,
            titleChanged: row.titles.size > 1, cells: row.cells, sampleSize: scores.length,
            average: scores.length ? round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
            trend: last != null && previous != null ? round(last - previous) : null,
        };
    }).sort((a, b) => a.sector.localeCompare(b.sector, 'pt-BR') || Number(a.code) - Number(b.code) || a.code.localeCompare(b.code));

    res.json({ success: true, data: { from, to, months, rows: result } });
});
