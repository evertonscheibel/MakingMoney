import express from 'express';
import request from 'supertest';
import { Types } from 'mongoose';
import { Company, Cycle, Process, User } from '../models';
import { CycleStatus, DeliverySource, ProcessStatus, UserRole } from '../types';
import { getHistory, getSummary, getSectorRanking, getProcessCurve } from '../controllers/report.controller';
import { getMyMetrics, getTeamMetrics } from '../controllers/metrics.controller';
import { getBonusReport } from '../controllers/bonus.controller';
import { closeCycle } from '../controllers/cycle.controller';
import { CycleAutomationWorker } from '../services/CycleAutomationWorker';
import { EmailService } from '../services/email.service';

let company: any, operator: any, auth: any;
const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.user = auth; req.companyId = String(company._id); next(); });
app.get('/history', getHistory);
app.get('/summary', getSummary);
app.get('/ranking', getSectorRanking);
app.get('/curve', getProcessCurve);
app.get('/metrics/me', getMyMetrics);
app.get('/metrics/team', getTeamMetrics);
app.get('/bonus', getBonusReport);
app.post('/close', closeCycle);
app.use((error: any, _req: any, res: any, _next: any) => res.status(error.statusCode || 500).json({ error: error.message }));

function asRole(role: UserRole, sectors: string[] = ['Financeiro']) {
    auth = { userId: String(operator._id), roles: [role], email: 'qa@example.invalid',
        companyAccess: [{ companyId: String(company._id), role, sectors }], sectors: [], sector: '' };
}

beforeEach(async () => {
    company = await Company.create({ name: 'Relatorios QA', sectors: [{ name: 'Financeiro' }, { name: 'RH' }] });
    operator = await User.create({ name: 'Operador QA', email: 'qa@example.invalid', passwordHash: 'synthetic123',
        roles: [UserRole.OPERATOR], baseSalary: 4000,
        companyAccess: [{ companyId: company._id, role: UserRole.OPERATOR, sectors: ['Financeiro'] }] });
    asRole(UserRole.MASTER);
    // Exercise closing logic without allowing any external delivery or queue writes.
    jest.spyOn(EmailService, 'enqueue').mockResolvedValue(false);
});
afterEach(() => jest.restoreAllMocks());

async function cycle(month = '2026-10', sector = 'Financeiro', extra: any = {}) {
    return Cycle.create({ companyId: company._id, month, sector, status: CycleStatus.OPEN, ...extra });
}

async function processes(c: any, entries: { score: number | null; active?: boolean }[]) {
    return Process.create(entries.map((entry, i) => ({ companyId: company._id, cycleId: c._id,
        sector: c.sector, code: String(i + 1).padStart(3, '0'), title: `Processo QA ${i + 1}`,
        plannedDate: new Date(`${c.month}-10T12:00:00Z`), limitDate: new Date(`${c.month}-20T12:00:00Z`),
        deliveryDate: entry.score === null ? null : new Date(`${c.month}-09T12:00:00Z`),
        status: entry.score === null || entry.score === 0 ? ProcessStatus.CRITICAL : ProcessStatus.ON_TIME,
        score: entry.score, isActive: entry.active !== false, responsibleUserId: operator._id })));
}

it('separa entregas fora do limite das pendências e mantém o prazo válido no próprio dia', async () => {
    const c = await cycle('2025-10');
    const [late, open, early] = await processes(c, [{ score: 50 }, { score: null }, { score: 100 }]);
    await Process.updateOne({ _id: late._id }, { deliveryDate: new Date('2025-10-22T00:00:00Z'), status: ProcessStatus.ON_TIME });
    await Process.updateOne({ _id: open._id }, { status: ProcessStatus.PENDING });
    await Process.updateOne({ _id: early._id }, {
        plannedDate: new Date('2025-10-09T00:00:00Z'), deliveryDate: new Date('2025-10-10T02:00:00Z'),
        deliverySource: DeliverySource.EMAIL, status: ProcessStatus.CRITICAL,
    });
    const { body: { data } } = await request(app).get('/curve').query({ period: c.month }).expect(200);
    expect(Object.fromEntries(data.deliveryBreakdown.map((band: any) => [band.key, band.count]))).toMatchObject({
        EARLY: 0, ON_PLANNED: 1, CRITICAL: 1, OVERDUE: 1,
    });
    expect(data.series[19]).toMatchObject({ day: 20, delayedOpen: 2, overdueOpen: 0 });
    expect(data.series[20]).toMatchObject({ day: 21, delayedOpen: 0, overdueOpen: 2 });
    expect(data.series[21]).toMatchObject({ day: 22, overdueOpen: 1 });
    expect(data.riskBySector).toEqual([{ sector: 'Financeiro', delayedOpen: 0, overdueOpen: 1 }]);
    expect(data.criticalItems).toMatchObject([{ id: String(open._id), deliveryDate: null }, { id: String(late._id), deliveryDate: '2025-10-22' }]);
});

describe('Nota por avaliações válidas e proporção de entregas (D1 aprovada)', () => {
    it.each([
        { name: '100 e ausência', entries: [{ score: 100 }, { score: null }], valid: 100, sum: 100, count: 2, delivered: 1 },
        { name: 'zero verdadeiro e ausência', entries: [{ score: 0 }, { score: null }], valid: 0, sum: 0, count: 2, delivered: 1 },
        { name: 'nenhum avaliado', entries: [{ score: null }, { score: null }], valid: 0, sum: 0, count: 2, delivered: 0 },
        { name: 'nota inativa excluída', entries: [{ score: 100, active: false }, { score: 50 }, { score: null }], valid: 50, sum: 50, count: 2, delivered: 1 },
        { name: 'arredondamento de três notas incluindo zero', entries: [{ score: 100 }, { score: 75 }, { score: 0 }, { score: null }], valid: 58.33, sum: 175, count: 4, delivered: 3 },
    ])('$name: compara endpoints e os dois fechamentos', async ({ entries, valid, sum, count, delivered }) => {
        const c = await cycle();
        await processes(c, entries);
        const expected = { aggregationVersion: 1, performanceAverage: delivered ? valid : null,
            validScoreCount: delivered, activeProcessCount: count, deliveredCount: delivered,
            deliveryRatePct: delivered * 100 / count, scoreSum: sum };
        const summary = await request(app).get('/summary').query({ cycleId: String(c._id) }).expect(200);
        expect(summary.body.data.kpis).toMatchObject({ avgScore: valid, totalProcesses: count,
            deliveryPct: delivered * 100 / count, ...expected });
        const ranking = await request(app).get('/ranking').query({ cycleId: String(c._id) }).expect(200);
        expect(ranking.body.data.ranking[0]).toMatchObject({ avgScore: valid, totalProcesses: count, ...expected });
        const curve = await request(app).get('/curve').query({ period: '2026-10' }).expect(200);
        expect(curve.body.data.kpis).toMatchObject(expected);
        for (const route of ['/metrics/me', '/metrics/team']) {
            const metrics = await request(app).get(route).query({ cycleId: String(c._id) }).expect(200);
            // CRITICAL without score still counts as a document, not a valid evaluation.
            expect(metrics.body.data).toMatchObject({ averageScore: Math.round(valid), count, ...expected });
        }
        const bonus = await request(app).get('/bonus').query({ year: 2026, quarter: 'Q4' }).expect(200);
        if (delivered) {
            expect(bonus.body.data.users[0]).toMatchObject({ avgScore: valid, processCount: delivered,
                bonusValue: valid >= 75 ? valid * 10 : 0 });
        } else expect(bonus.body.data.users).toEqual([]);

        await request(app).post('/close').send({ sector: 'Financeiro', openNext: false }).expect(200);
        const manualKpis = (await Cycle.findById(c._id))!.toObject().kpis;
        expect(manualKpis).toMatchObject({ avgScore: valid, ...expected });
        // Invoke one closing operation only: never start the scheduler or email workers.
        await (new CycleAutomationWorker() as any).closeAndOpen(company, {
            name: 'Financeiro', cycleAutomation: { sundayPlannedRule: 'KEEP', sundayLimitRule: 'KEEP' },
        }, await Cycle.findById(c._id));
        expect((await Cycle.findById(c._id))!.toObject().kpis).toEqual(manualKpis);
    });

    it('bônus usa avaliações do trimestre, não média das médias mensais', async () => {
        await processes(await cycle('2026-10'), [{ score: 100 }]);
        await processes(await cycle('2026-11'), [{ score: 0 }, { score: 0 }, { score: 0 }]);
        const bonus = await request(app).get('/bonus').query({ year: 2026, quarter: 'Q4' }).expect(200);
        expect(bonus.body.data.users[0]).toMatchObject({ avgScore: 25, processCount: 4, bonusValue: 0 });
    });

    it('proporção de entregas inclui pendentes ativos sem inflar a amostra', async () => {
        const c = await cycle();
        const created = await processes(c, [{ score: 0 }, { score: null }]);
        await Process.updateOne({ _id: created[1]._id }, { $set: { status: ProcessStatus.PENDING } });
        const result = await request(app).get('/metrics/team').query({ cycleId: String(c._id) }).expect(200);
        expect(result.body.data).toMatchObject({ count: 1, activeProcessCount: 2, validScoreCount: 1,
            performanceAverage: 0, deliveredCount: 1, deliveryRatePct: 50 });
    });

    it('ciclo vazio e mês inexistente não produzem falsa nota ou proporção zero', async () => {
        await cycle();
        for (const period of ['2026-10', '2026-12']) {
            const result = await request(app).get('/summary').query({ period }).expect(200);
            expect(result.body.data.kpis).toMatchObject({ avgScore: 0, performanceAverage: null,
                validScoreCount: 0, activeProcessCount: 0, deliveryRatePct: null });
        }
        const metrics = await request(app).get('/metrics/me').query({ period: '2026-12' }).expect(200);
        expect(metrics.body.data).toMatchObject({ averageScore: 0, performanceAverage: null,
            validScoreCount: 0, activeProcessCount: 0, deliveryRatePct: null });
        await request(app).post('/close').send({ sector: 'Financeiro', openNext: false }).expect(200);
        const history = await request(app).get('/history').expect(200);
        expect(history.body.data[0]).toMatchObject({ aggregationVersion: 1, performanceAverage: null,
            validScoreCount: 0, activeProcessCount: 0, deliveredCount: 0, deliveryRatePct: null });
    });

    it('nota zero avaliada fica à frente de setor sem avaliações no ranking', async () => {
        await processes(await cycle(), [{ score: 0 }]);
        await processes(await cycle('2026-10', 'RH'), [{ score: null }]);
        const result = await request(app).get('/ranking').query({ period: '2026-10' }).expect(200);
        expect(result.body.data.ranking.map((r: any) => [r.sector, r.performanceAverage, r.validScoreCount]))
            .toEqual([['Financeiro', 0, 1], ['RH', null, 0]]);
    });
});

describe('Histórico: isolamento de empresa e setor', () => {
    beforeEach(async () => {
        for (const [sector, score] of [['Financeiro', 81], ['RH', 32]] as const) {
            await cycle('2026-09', sector, { status: CycleStatus.CLOSED,
                kpis: { avgScore: score, onTimePct: score, totalProcesses: 3, criticalCount: 0, avgDeviationDays: 0 } });
        }
        await Cycle.create({ companyId: new Types.ObjectId(), sector: 'Financeiro', month: '2026-09',
            status: CycleStatus.CLOSED, kpis: { avgScore: 99 } });
        await cycle('2026-10'); // Open cycles must never leak into the closed snapshot history.
    });

    it('Master vê todos os setores somente da empresa ativa', async () => {
        const result = await request(app).get('/history').expect(200);
        expect(result.body.data.map((p: any) => p.avgScore).sort()).toEqual([32, 81]);
        expect(result.body.data.every((p: any) => !('aggregationVersion' in p) && !('validScoreCount' in p))).toBe(true);
    });

    it.each([UserRole.MANAGER, UserRole.OPERATOR])('%s vê apenas setores autorizados', async role => {
        asRole(role);
        const result = await request(app).get('/history').expect(200);
        expect(result.body.data.map((p: any) => p.avgScore)).toEqual([81]);
    });

    it('gestor nomeado no setor também recebe acesso ao respectivo histórico', async () => {
        await Company.updateOne({ _id: company._id }, { $set: { 'sectors.1.managerIds': [operator._id] } });
        asRole(UserRole.MANAGER, []);
        const result = await request(app).get('/history').expect(200);
        expect(result.body.data.map((p: any) => p.avgScore)).toEqual([32]);
    });

    it('sem setores autorizados retorna histórico vazio', async () => {
        asRole(UserRole.OPERATOR, []);
        const result = await request(app).get('/history').expect(200);
        expect(result.body.data).toEqual([]);
    });

    it('aplica autorização antes de selecionar os cinco ciclos mais recentes', async () => {
        for (let month = 1; month <= 6; month++) {
            await cycle(`2027-${String(month).padStart(2, '0')}`, 'RH', { status: CycleStatus.CLOSED });
        }
        asRole(UserRole.OPERATOR);
        const result = await request(app).get('/history').expect(200);
        expect(result.body.data.map((p: any) => p.avgScore)).toEqual([81]);
    });

    it('mantém o limite de cinco ciclos em ordem cronológica sem recalcular notas', async () => {
        for (let month = 1; month <= 6; month++) {
            await cycle(`2027-${String(month).padStart(2, '0')}`, 'Financeiro', {
                status: CycleStatus.CLOSED, kpis: { avgScore: month },
            });
        }
        asRole(UserRole.OPERATOR);
        const result = await request(app).get('/history').expect(200);
        expect(result.body.data.map((p: any) => [p.month, p.avgScore])).toEqual([
            ['2027-02', 2], ['2027-03', 3], ['2027-04', 4], ['2027-05', 5], ['2027-06', 6],
        ]);
    });

    it.each(['sector=', 'sector=Financeiro&sector=RH', 'sector[name]=RH'])('rejeita filtro inválido: %s', async query => {
        await request(app).get(`/history?${query}`).expect(400);
    });

    it('não aceita selecionar setor fora do escopo', async () => {
        asRole(UserRole.MANAGER);
        await request(app).get('/history').query({ sector: 'RH' }).expect(403);
    });

    it('Master pode filtrar setor sem alterar snapshots fechados', async () => {
        const before = await Cycle.find({ status: CycleStatus.CLOSED }).lean();
        const result = await request(app).get('/history').query({ sector: 'RH' }).expect(200);
        expect(result.body.data.map((p: any) => p.avgScore)).toEqual([32]);
        expect(await Cycle.find({ status: CycleStatus.CLOSED }).lean()).toEqual(before);
    });
});
