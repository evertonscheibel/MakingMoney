import express from 'express';
import request from 'supertest';
import { Types } from 'mongoose';
import { Company, Cycle, Process, User, AuditLog } from '../models';
import { OperationalMilestone } from '../models/OperationalMilestone';
import { UserRole, ProcessStatus } from '../types';
import { assessmentState, assessmentIndicators } from '../utils/assessment';
import { getPerformanceEvolution, createMilestone } from '../controllers/evolution.controller';
import { setProcessAssessment, linkProcessLineage } from '../controllers/processAssessment.controller';
import { listProcesses, updateProcess, confirmDelivery } from '../controllers/process.controller';
import { getSummary, getExtract } from '../controllers/report.controller';
import { closeCycle } from '../controllers/cycle.controller';
import { CycleAutomationWorker } from '../services/CycleAutomationWorker';
import { EmailService } from '../services/email.service';

let company: any, otherCompany: any, owner: any, peer: any, auth: any;
const app = express(); app.use(express.json());
app.use((req, _res, next) => { req.companyId = String(company._id); req.user = auth; next(); });
app.get('/evolution', getPerformanceEvolution); app.post('/milestone', createMilestone);
app.patch('/process/:id/assessment', setProcessAssessment); app.post('/process/:id/lineage', linkProcessLineage);
app.patch('/process/:id', updateProcess); app.post('/process/:id/confirm', confirmDelivery);
app.get('/process', listProcesses); app.get('/summary', getSummary); app.get('/extract', getExtract);
app.post('/close', closeCycle);
app.use((error: any, _req: any, res: any, _next: any) => res.status(error.statusCode || 500).json({ error: error.message }));
function role(role: UserRole, sectors = ['Financeiro']) {
    auth = { userId: String(owner._id), roles: [role], email: 'owner@example.invalid', sectors: [], sector: '',
        companyAccess: [{ companyId: String(company._id), role, sectors }] };
}
beforeEach(async () => {
    company = await Company.create({ name: 'Evolucao QA', sectors: [{ name: 'Financeiro' }, { name: 'RH' }] });
    otherCompany = await Company.create({ name: 'Outra QA', sectors: [{ name: 'Financeiro' }] });
    const user = (name: string) => User.create({ name, email: `${name}@example.invalid`, passwordHash: 'synthetic123',
        roles: [UserRole.OPERATOR], baseSalary: 4000, companyAccess: [{ companyId: company._id, role: UserRole.OPERATOR, sectors: ['Financeiro', 'RH'] }] });
    owner = await user('owner'); peer = await user('peer'); role(UserRole.MASTER);
    jest.spyOn(EmailService, 'enqueue').mockResolvedValue(false);
});
afterEach(() => jest.restoreAllMocks());
async function cycle(month: string, sector = 'Financeiro', extra: any = {}) {
    return Cycle.create({ companyId: company._id, sector, month, status: 'CLOSED', ...extra });
}
async function process(c: any, code: string, score: number | null, extra: any = {}) {
    return Process.create({ companyId: c.companyId, cycleId: c._id, sector: c.sector, code,
        title: `Processo ${code}`, score, plannedDate: new Date(`${c.month}-10T00:00:00Z`), limitDate: new Date(`${c.month}-20T00:00:00Z`),
        deliveryDate: score === null ? null : new Date(`${c.month}-09T00:00:00Z`),
        responsibleUserId: owner._id, status: score === null ? ProcessStatus.PENDING : ProcessStatus.ON_TIME, ...extra });
}
const range = { from: '2026-01', to: '2026-03' };

describe('Estados e cobertura de avaliação', () => {
    it('prazo é o fim do dia operacional de Cuiabá, sem alterar pontuação/tolerância', () => {
        const p = { score: null, limitDate: '2026-01-20T00:00:00Z' };
        expect(assessmentState(p, new Date('2026-01-21T03:59:59Z'))).toBe('PENDENTE');
        expect(assessmentState(p, new Date('2026-01-21T04:00:00Z'))).toBe('SEM_AVALIACAO');
        expect(assessmentState({ ...p, score: 0 })).toBe('AVALIADO');
        expect(assessmentState({ ...p, assessmentRequired: false })).toBe('NAO_APLICAVEL');
        const result = assessmentIndicators([{ ...p, score: 0, deliveryDate: new Date() }, p,
            { ...p, assessmentRequired: false }, { ...p, isActive: false }], new Date('2026-02-01'));
        expect(result).toMatchObject({ eligibleCount: 2, assessedEligibleCount: 1, coveragePct: 50,
            missingAssessmentCount: 1, notApplicableCount: 1, inactiveCount: 1 });
        expect(assessmentIndicators([]).coveragePct).toBeNull();
    });

    it('gestor registra motivo de não aplicável e estado não se confunde com inatividade', async () => {
        const c = await cycle('2026-01', 'Financeiro', { status: 'OPEN' }); const p = await process(c, '001', null);
        role(UserRole.MANAGER);
        await request(app).patch(`/process/${p._id}/assessment`).send({ required: false, reason: '' }).expect(400);
        const result = await request(app).patch(`/process/${p._id}/assessment`).send({ required: false, reason: 'Sem movimento nesta competência' }).expect(200);
        expect(result.body.data).toMatchObject({ isActive: true, assessmentState: 'NAO_APLICAVEL', assessmentEligible: false });
        const summary = await request(app).get('/summary').query({ cycleId: String(c._id) }).expect(200);
        expect(summary.body.data.kpis).toMatchObject({ activeProcessCount: 1, eligibleCount: 0, coveragePct: null, notApplicableCount: 1 });
        await request(app).post(`/process/${p._id}/confirm`).send({ deliveryDate: '2026-01-10' }).expect(400);
        const audit = await AuditLog.findOne({ entityId: p._id });
        expect((audit!.after as any).assessmentChangeReason).toBe('Sem movimento nesta competência');
    });

    it('operador, empresa alheia e ciclo fechado não podem alterar aplicabilidade', async () => {
        const c = await cycle('2026-01'); const p = await process(c, '001', null);
        role(UserRole.OPERATOR); await request(app).patch(`/process/${p._id}/assessment`).send({ required: false, reason: 'QA' }).expect(403);
        role(UserRole.MASTER); await request(app).patch(`/process/${p._id}/assessment`).send({ required: false, reason: 'QA' }).expect(400);
        await Process.updateOne({ _id: p._id }, { $set: { companyId: otherCompany._id } });
        await request(app).patch(`/process/${p._id}/assessment`).send({ required: false, reason: 'QA' }).expect(404);
    });

    it('não descarta nota zero já registrada ao marcar não aplicável', async () => {
        const p = await process(await cycle('2026-01', 'Financeiro', { status: 'OPEN' }), '001', 0);
        await request(app).patch(`/process/${p._id}/assessment`).send({ required: false, reason: 'QA' }).expect(409);
        expect((await Process.findById(p._id))!.score).toBe(0);
    });

    it('filtros de lista, resumo e extrato retornam os mesmos avaliados, incluindo zero', async () => {
        const c = await cycle('2026-01', 'Financeiro', { status: 'OPEN' });
        await process(c, '001', 0); await process(c, '002', null);
        const list = await request(app).get('/process').query({ cycleId: String(c._id), assessmentState: 'AVALIADO' }).expect(200);
        expect(list.body.pagination.total).toBe(1); expect(list.body.data[0].assessmentState).toBe('AVALIADO');
        const summary = await request(app).get('/summary').query({ cycleId: String(c._id), assessmentState: 'AVALIADO' }).expect(200);
        expect(summary.body.data.kpis).toMatchObject({ totalProcesses: 1, performanceAverage: 0, coveragePct: 100 });
        const extract = await request(app).get('/extract').query({ cycleId: String(c._id), assessmentState: 'AVALIADO' }).expect(200);
        expect(extract.body.data.bySector.Financeiro).toHaveLength(1);
    });
});

describe('Série mensal/trimestral e carteira equivalente', () => {
    it('mantém opções do recorte ao trocar processos e mostra cobertura de cada ciclo vinculado', async () => {
        const jan = await cycle('2026-01');
        const feb = await cycle('2026-02');
        const root = await process(jan, '001', 0);
        const linked = await process(feb, '001', null, { lineageId: root._id, assessmentRequired: false });
        const other = await process(jan, '002', 90);
        const hidden = await process(await cycle('2026-01', 'RH'), '003', 100);
        role(UserRole.MANAGER);

        const selected = await request(app).get('/evolution').query({
            ...range, groupBy: 'quarter', processId: String(root._id),
        }).expect(200);
        expect(selected.body.data.processOptions.map((row: any) => row.id).sort()).toEqual(
            [root, linked, other].map(row => String(row._id)).sort(),
        );
        expect(selected.body.data.processCycles).toMatchObject([
            { id: String(root._id), month: '2026-01', score: 0, assessment: 'AVALIADO', coveragePct: 100 },
            { id: String(linked._id), month: '2026-02', assessment: 'NAO_APLICAVEL', coveragePct: null },
        ]);

        const switched = await request(app).get('/evolution').query({ ...range, processId: String(other._id) }).expect(200);
        expect(switched.body.data.processCycles).toMatchObject([{ id: String(other._id), score: 90 }]);
        await request(app).get('/evolution').query({ ...range, processId: String(hidden._id) }).expect(404);
    });

    it('trimestre pondera pelas avaliações e mantém lacunas como null', async () => {
        await process(await cycle('2026-01'), '001', 100);
        const c = await cycle('2026-03'); await process(c, '001', 0); await process(c, '002', 0); await process(c, '003', 0);
        const monthly = await request(app).get('/evolution').query(range).expect(200);
        expect(monthly.body.data.series.map((p: any) => [p.period, p.performanceAverage, p.validScoreCount])).toEqual([
            ['2026-01', 100, 1], ['2026-02', null, 0], ['2026-03', 0, 3],
        ]);
        const quarter = await request(app).get('/evolution').query({ ...range, groupBy: 'quarter' }).expect(200);
        expect(quarter.body.data.series[0]).toMatchObject({ period: '2026-Q1', performanceAverage: 25, validScoreCount: 4, observedMonths: 2 });
    });

    it('compara somente identidades comprovadas e informa exclusões e variação em pontos', async () => {
        const lineage = new Types.ObjectId();
        await process(await cycle('2026-01'), '001', 85, { lineageId: lineage });
        const c = await cycle('2026-02'); await process(c, '001', 94, { lineageId: lineage }); await process(c, '002', 0);
        const result = await request(app).get('/evolution').query({ from: '2026-01', to: '2026-02', equivalent: 'true' }).expect(200);
        expect(result.body.data.comparison).toMatchObject({ commonProcessCount: 1, deltaPoints: 9, compositionChanged: true });
        expect(result.body.data.comparison.previous.performanceAverage).toBe(85);
        expect(result.body.data.comparison.current.performanceAverage).toBe(94);
        expect(result.body.data.comparison.excluded).toHaveLength(1);
    });

    it('código igual no legado não implica identidade histórica', async () => {
        const a = await process(await cycle('2026-01'), '001', 85);
        const b = await process(await cycle('2026-02'), '001', 94);
        await Process.collection.updateMany({ _id: { $in: [a._id, b._id] } }, { $unset: { lineageId: '' } });
        const result = await request(app).get('/evolution').query({ from: '2026-01', to: '2026-02', equivalent: 'true' }).expect(200);
        expect(result.body.data.comparison).toMatchObject({ commonProcessCount: 0, deltaPoints: null });
        expect(result.body.data.warnings.unconfirmedLineageCount).toBe(2);
    });

    it('usa competência do ciclo, respeita setor/empresa e filtra categoria', async () => {
        const c = await cycle('2026-01');
        await process(c, '001', 75, { category: 'Fiscal', plannedDate: new Date('2025-12-01') });
        await process(await cycle('2026-01', 'RH'), '001', 10);
        const foreign = await Cycle.create({ companyId: otherCompany._id, sector: 'Financeiro', month: '2026-01' });
        await process(foreign, '001', 99);
        role(UserRole.MANAGER);
        const result = await request(app).get('/evolution').query({ ...range, category: 'Fiscal' }).expect(200);
        expect(result.body.data.series[0]).toMatchObject({ performanceAverage: 75, validScoreCount: 1 });
        expect(result.body.data.records).toHaveLength(1);
        await request(app).get('/evolution').query({ ...range, sector: 'RH' }).expect(403);
    });

    it('separa responsável na entrega de transferência posterior e registra evento', async () => {
        const c = await cycle('2026-01', 'Financeiro', { status: 'OPEN' }), p = await process(c, '001', null);
        await request(app).post(`/process/${p._id}/confirm`).send({ deliveryDate: '2026-01-09' }).expect(200);
        await request(app).patch(`/process/${p._id}`).send({ responsibleUserId: String(peer._id) }).expect(200);
        const result = await request(app).get('/evolution').query({ ...range, userId: String(owner._id) }).expect(200);
        expect(result.body.data.series[0].validScoreCount).toBe(1);
        expect(result.body.data.records[0]).toMatchObject({ responsibleId: String(owner._id), attributionQuality: 'AT_DELIVERY' });
        const changed = await Process.findById(p._id); expect(changed!.responsibleUserId!.toString()).toBe(String(peer._id));
        const other = await request(app).get('/evolution').query({ ...range, userId: String(peer._id) }).expect(200);
        expect(other.body.data.records).toHaveLength(0);
    });

    it('atribui transferência ao mês de Cuiabá e não ao mês UTC do timestamp', async () => {
        const p = await process(await cycle('2026-01'), '001', 75);
        await AuditLog.collection.insertOne({ companyId: company._id, actorUserId: owner._id, action: 'UPDATE',
            entityType: 'process', entityId: p._id, before: { responsibleUserId: owner._id },
            after: { responsibleUserId: peer._id }, createdAt: new Date('2026-02-01T02:00:00Z') });
        const result = await request(app).get('/evolution').query(range).expect(200);
        expect(result.body.data.series[0].transferCount).toBe(1);
        expect(result.body.data.series[1].transferCount).toBe(0);
        expect(result.body.data.events[0]).toMatchObject({ type: 'TRANSFERENCIA', author: 'owner' });
    });

    it.each([{ from: '2026-13', to: '2026-14' }, { from: '2026-04', to: '2026-01' },
        { from: '2010-01', to: '2026-01' }, { ...range, groupBy: 'year' }, { ...range, userId: 'bad' }])('rejeita recorte inválido %j', async query => {
        await request(app).get('/evolution').query(query).expect(400);
    });
});

describe('Vínculos e marcos com autoria', () => {
    it('prévia não escreve; confirmação vincula metadados sem mudar notas e é idempotente', async () => {
        const a = await process(await cycle('2026-01'), '001', 85), b = await process(await cycle('2026-02'), '001', 94);
        const payload = { referenceProcessId: String(a._id), reason: 'Mesmo processo confirmado no roteiro', dryRun: true };
        const preview = await request(app).post(`/process/${b._id}/lineage`).send(payload).expect(200);
        expect(preview.body.data).toMatchObject({ sourceCount: 1, conflicts: [] });
        expect(String((await Process.findById(b._id))!.lineageId)).toBe(String(b._id));
        await request(app).post(`/process/${b._id}/lineage`).send({ ...payload, dryRun: false, expectedCount: 99 }).expect(409);
        await request(app).post(`/process/${b._id}/lineage`).send({ ...payload, dryRun: false, expectedCount: 1 }).expect(200);
        expect((await Process.findById(b._id))!.toObject()).toMatchObject({ lineageId: a.lineageId, score: 94 });
        const again = await request(app).post(`/process/${b._id}/lineage`).send(payload).expect(200);
        expect(again.body.data.alreadyLinked).toBe(true);
    });

    it('bloqueia colisão por competência e operação de gestor', async () => {
        const c = await cycle('2026-01'); const a = await process(c, '001', 85), b = await process(c, '002', 94);
        const body = { referenceProcessId: String(a._id), reason: 'QA', dryRun: true };
        role(UserRole.MANAGER); await request(app).post(`/process/${b._id}/lineage`).send(body).expect(403);
        role(UserRole.MASTER); const preview = await request(app).post(`/process/${b._id}/lineage`).send(body).expect(200);
        expect(preview.body.data.conflicts).toEqual(['2026-01']);
        await request(app).post(`/process/${b._id}/lineage`).send({ ...body, dryRun: false, expectedCount: 1 }).expect(409);
    });

    it('reverte vínculo parcial se a gravação de outra competência falhar', async () => {
        const a = await process(await cycle('2026-01'), '001', 85);
        const b = await process(await cycle('2026-02'), '001', 94, { lineageId: a.lineageId });
        const reference = await process(await cycle('2026-03'), '001', 75);
        const original = Process.updateOne.bind(Process);
        jest.spyOn(Process, 'updateOne')
            .mockImplementationOnce(((filter: any, update: any) => original(filter, update)) as any)
            .mockImplementationOnce((() => { throw new Error('Controlled lineage write failure'); }) as any);
        await request(app).post(`/process/${a._id}/lineage`).send({ referenceProcessId: String(reference._id),
            reason: 'QA de rollback', dryRun: false, expectedCount: 2 }).expect(500);
        expect(String((await Process.findById(a._id))!.lineageId)).toBe(String(a.lineageId));
        expect(String((await Process.findById(b._id))!.lineageId)).toBe(String(a.lineageId));
        expect((await Process.findById(a._id))!.score).toBe(85);
    });

    it('usuário sem setor não recebe eventos de configuração nem dados de outros setores', async () => {
        await process(await cycle('2026-01'), '001', 75);
        role(UserRole.OPERATOR, []);
        const result = await request(app).get('/evolution').query(range).expect(200);
        expect(result.body.data.records).toHaveLength(0); expect(result.body.data.events).toHaveLength(0);
    });

    it('registra marco com autor e data sem inventar implantação a partir de criação', async () => {
        const p = await process(await cycle('2026-01'), '001', null);
        const body = { sector: 'Financeiro', processId: String(p._id), type: 'IMPLANTACAO', description: 'Entrada em operação validada', occurredAt: '2026-01-15T12:00:00-04:00' };
        role(UserRole.OPERATOR); await request(app).post('/milestone').send(body).expect(403);
        role(UserRole.MANAGER); await request(app).post('/milestone').send(body).expect(201);
        expect(await OperationalMilestone.countDocuments()).toBe(1);
        const result = await request(app).get('/evolution').query(range).expect(200);
        expect(result.body.data.events).toEqual([expect.objectContaining({ type: 'IMPLANTACAO', source: 'REGISTRO_MANUAL', author: 'owner', description: body.description })]);
        await request(app).post('/milestone').send({ ...body, sector: 'RH' }).expect(403);
    });

    it.each(['manual', 'automatic'])('clonagem %s preserva linhagem e reinicia aplicabilidade da nova competência', async mode => {
        const c = await cycle('2026-01', 'Financeiro', { status: 'OPEN' }); const p = await process(c, '001', null, { assessmentRequired: false, nonApplicableReason: 'Motivo só de janeiro' });
        if (mode === 'manual') await request(app).post('/close').send({ sector: 'Financeiro', openNext: true }).expect(200);
        else await (new CycleAutomationWorker() as any).closeAndOpen(company, { name: 'Financeiro', cycleAutomation: { sundayPlannedRule: 'KEEP', sundayLimitRule: 'KEEP' } }, c);
        const next = await Cycle.findOne({ companyId: company._id, month: '2026-02' }); const clone = await Process.findOne({ cycleId: next!._id });
        expect(clone!.toObject()).toMatchObject({ lineageId: p.lineageId, sourceProcessId: p._id, assessmentRequired: true, nonApplicableReason: null, evaluatedResponsibleUserId: null });
        expect((await Process.findById(p._id))!.assessmentRequired).toBe(false);
    });
});
