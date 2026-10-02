import express from 'express';
import request from 'supertest';
import * as XLSX from 'xlsx';
import { Company, Cycle, Process, User, EmailQueue, EmailConfig, EmailStatus } from '../models';
import { CycleStatus, DeliveryStatus, UserRole } from '../types';
import * as handlers from '../controllers/process.controller';
import { importProcesses } from '../controllers/import.controller';
import { getBonusReport } from '../controllers/bonus.controller';
import { resetCycle, restoreCycle, reopenCycle, previewCloseCycle } from '../controllers/cycle.controller';
import { syncDeliveryEmailStatus } from '../services/email/deliveryStatus';
import { EmailWorker } from '../services/email/EmailWorker';
import { encrypt } from '../utils/crypto';
import nodemailer from 'nodemailer';
import { getMyMetrics, getTeamMetrics } from '../controllers/metrics.controller';

let company: any, manager: any, operator: any, peer: any, open: any, closed: any, own: any, other: any, hidden: any, historic: any;
let auth: any;
const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.user = auth; req.companyId = String(company._id); next(); });
app.post('/process', handlers.createProcess);
app.get('/process', handlers.listProcesses);
app.patch('/process/:id', handlers.updateProcess);
app.post('/process/:id/confirm', handlers.confirmDelivery);
app.post('/process/:id/legacy-deliver', handlers.deliverProcess);
app.post('/process/:id/email', handlers.sendDeliveryEmail);
app.post('/process/:id/revert', handlers.revertDelivery);
app.post('/import', (req, _res, next) => { req.file = {buffer: workbook()} as any; next(); }, importProcesses);
app.get('/bonus', getBonusReport);
app.get('/metrics/me', getMyMetrics);
app.get('/metrics/team', getTeamMetrics);
app.post('/cycle/:id/reset', resetCycle);
app.post('/cycle/:id/restore', restoreCycle);
app.post('/cycle/:id/reopen', reopenCycle);
app.get('/preview', previewCloseCycle);
app.use((error: any, _req: any, res: any, _next: any) => res.status(error.statusCode || 500).json({error: error.message}));

function workbook() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ 'numero do ID': '101', 'nome do Processo': 'Importado' }]), 'Processos');
    return XLSX.write(wb, {type: 'buffer', bookType: 'xlsx'});
}
function asUser(user: any, role = user.roles[0]) {
    auth = {userId: String(user._id), email: user.email, roles: user.roles, activeCompanyId: String(company._id),
        companyAccess: [{companyId: String(company._id), role, sectors: ['Financeiro']}], sectors: ['Legado'], sector: 'Legado'};
}
async function delivery(status = DeliveryStatus.CONFIRMED_PENDING_EMAIL) {
    await Process.updateOne({_id: own._id}, {$set: {deliveryStatus: status, deliveryDate: new Date('2026-10-02')}});
}
async function config() {
    await EmailConfig.create({companyId: company._id, host:'localhost', port:2525, securityMode:'NONE', auth:{user:'qa',pass:encrypt('synthetic')}, fromName:'QA',fromEmail:'qa@example.invalid',isActive:true});
}
beforeEach(async () => {
    company = await Company.create({name:'Alfa QA',sectors:[{name:'Financeiro'},{name:'RH'}]});
    const createUser = (name: string, role: UserRole, sectors = ['Financeiro']) => User.create({name,email:`${name}@example.invalid`,passwordHash:'synthetic123',roles:[role],baseSalary:4000,
        companyAccess:[{companyId:company._id,role,sectors}],sectors:['Legado']});
    manager = await createUser('manager',UserRole.MANAGER); operator = await createUser('operator',UserRole.OPERATOR); peer = await createUser('peer',UserRole.OPERATOR);
    await Company.updateOne({_id:company._id},{$set:{'sectors.0.managerIds':[manager._id]}});
    open = await Cycle.create({companyId:company._id,sector:'Financeiro',month:'2026-11',status:CycleStatus.OPEN});
    closed = await Cycle.create({companyId:company._id,sector:'Financeiro',month:'2026-10',status:CycleStatus.CLOSED});
    const rh = await Cycle.create({companyId:company._id,sector:'RH',month:'2026-11',status:CycleStatus.OPEN});
    const process = (code: string, cycle: any, user: any) => Process.create({companyId:company._id,cycleId:cycle._id,code,title:code,sector:cycle.sector,responsibleUserId:user._id,plannedDate:new Date('2026-10-02'),limitDate:new Date('2026-10-05')});
    own=await process('001',open,operator); other=await process('002',open,peer); hidden=await process('003',rh,operator); historic=await process('004',closed,operator);
    asUser(manager);
});

describe('Company and sector authorization regressions', () => {
    it('rejects unauthorized creation and import without inserting records', async () => {
        const count = await Process.countDocuments();
        const data={title:'Forbidden',sector:'RH',plannedDate:'2026-11-02',limitDate:'2026-11-05'};
        expect((await request(app).post('/process').send(data)).status).toBe(403);
        expect((await request(app).post('/import').send(data)).status).toBe(403);
        expect(await Process.countDocuments()).toBe(count);
    });
    it('uses active-company role instead of the global manager role', async () => {
        asUser(manager, UserRole.OPERATOR);
        expect((await request(app).post('/process').send({title:'Blocked',sector:'Financeiro',plannedDate:'2026-11-02',limitDate:'2026-11-05'})).status).toBe(403);
    });
    it('permits authorized import and blocks reversed dates', async () => {
        const body={sector:'Financeiro',plannedDate:'2026-11-02',limitDate:'2026-11-05',responsibleUserId:String(operator._id)};
        expect((await request(app).post('/import').send({...body,limitDate:'2026-11-01'})).status).toBe(400);
        expect((await request(app).post('/import').send(body)).status).toBe(201);
        expect(await Process.countDocuments({code:'101',sector:'Financeiro'})).toBe(1);
    });
    it('forbids assigning a responsible user from another company', async () => {
        const foreign = await User.create({name:'Foreign',email:'foreign@example.invalid',passwordHash:'synthetic123',roles:[UserRole.OPERATOR],companyAccess:[]});
        expect((await request(app).post('/process').send({title:'Foreign',sector:'Financeiro',plannedDate:'2026-11-02',limitDate:'2026-11-05',responsibleUserId:String(foreign._id)})).status).toBe(400);
    });
    it('operators can confirm their own process, but cannot modify peers or hidden sectors', async () => {
        asUser(operator);
        for (const p of [other,hidden]) expect((await request(app).post(`/process/${p._id}/confirm`).send({deliveryDate:'2026-10-02'})).status).toBe(403);
        expect((await request(app).post(`/process/${own._id}/confirm`).send({deliveryDate:'2026-10-02'})).status).toBe(200);
        expect((await Process.findById(own._id))?.deliveryStatus).toBe(DeliveryStatus.CONFIRMED_PENDING_EMAIL);
    });
    it('blocks delivery and schedule mutations in closed cycles', async () => {
        for (const action of ['confirm','email','revert']) expect((await request(app).post(`/process/${historic._id}/${action}`).send({deliveryDate:'2026-10-02',reason:'QA'})).status).toBe(400);
        expect((await request(app).patch(`/process/${historic._id}`).send({title:'Changed'})).status).toBe(400);
        expect((await request(app).post(`/cycle/${closed._id}/reset`)).status).toBe(400);
        expect((await request(app).post(`/cycle/${closed._id}/restore`)).status).toBe(400);
        expect((await Process.findById(historic._id))?.title).toBe('004');
    });
    it('blocks management of unauthorized cycles and preview', async () => {
        expect((await request(app).post(`/cycle/${hidden.cycleId}/reset`)).status).toBe(403);
        expect((await request(app).get('/preview').query({sector:'RH'})).status).toBe(403);
        expect((await request(app).get('/preview')).status).toBe(400);
    });
    it('history selects closed month, excluding open and unauthorized processes', async () => {
        const result=await request(app).get('/process').query({month:'2026-10',cycleStatus:'CLOSED'});
        expect(result.status).toBe(200); expect(result.body.data.map((p:any)=>p.code)).toEqual(['004']);
    });
    it('metrics use company sectors instead of legacy sectors', async () => {
        await Process.updateMany({_id:{$in:[own._id,other._id,hidden._id]}},{$set:{score:100,status:'ON_TIME'}});
        asUser(operator);
        const mine=await request(app).get('/metrics/me').query({period:'2026-10'});
        const team=await request(app).get('/metrics/team').query({period:'2026-10'});
        expect(mine.body.data.count).toBe(1); expect(team.body.data.count).toBe(2);
    });
    it('legacy delivery follows the same confirmation and closed-cycle guards', async () => {
        asUser(operator);
        expect((await request(app).post(`/process/${own._id}/legacy-deliver`).send({deliveryDate:'2026-10-02'})).status).toBe(200);
        expect((await Process.findById(own._id))?.deliveryStatus).toBe(DeliveryStatus.CONFIRMED_PENDING_EMAIL);
        expect((await request(app).post(`/process/${own._id}/legacy-deliver`).send({deliveryDate:'2026-10-02'})).status).toBe(400);
        expect((await request(app).post(`/process/${historic._id}/legacy-deliver`).send({deliveryDate:'2026-10-02'})).status).toBe(400);
    });
    it('bonus report does not expose unauthorized sectors or peer salaries to operators', async () => {
        await Process.updateMany({},{$set:{score:100,status:'ON_TIME',deliveryDate:new Date('2026-10-02')}});
        const managerReport=await request(app).get('/bonus').query({quarter:'Q4',year:2026});
        expect(managerReport.status).toBe(200); expect(JSON.stringify(managerReport.body.data)).not.toContain('"RH"');
        expect((await request(app).get('/bonus').query({quarter:'Q4',year:2026,sector:'RH'})).status).toBe(403);
        asUser(operator);
        const result=await request(app).get('/bonus').query({quarter:'Q4',year:2026});
        expect(JSON.stringify(result.body.data)).not.toContain('peer@example.invalid');
        expect(JSON.stringify(result.body.data)).not.toContain('"RH"');
        expect(result.body.data.users.every((u: any) => u.userId === String(operator._id) && u.sector === 'Financeiro')).toBe(true);
    });
});

describe('Real email delivery status', () => {
    it('missing SMTP config leaves confirmation pending, without false success', async () => {
        await delivery(); expect((await request(app).post(`/process/${own._id}/email`)).status).toBe(400);
        expect((await Process.findById(own._id))?.deliveryStatus).toBe(DeliveryStatus.CONFIRMED_PENDING_EMAIL);
        expect(await EmailQueue.countDocuments()).toBe(0);
    });
    it('queues once, remains queued until all recipients are actually sent', async () => {
        await config(); await delivery();
        await User.create({name:'QA Admin',email:'admin@example.invalid',passwordHash:'synthetic123',roles:[UserRole.MASTER],companyAccess:[{companyId:company._id,role:UserRole.MASTER}]});
        expect((await request(app).post(`/process/${own._id}/email`)).status).toBe(200);
        expect((await Process.findById(own._id))?.deliveryStatus).toBe(DeliveryStatus.EMAIL_QUEUED);
        expect((await request(app).post(`/process/${own._id}/email`)).status).toBe(400);
        const messages=await EmailQueue.find(); expect(messages.length).toBe(2);
        await EmailQueue.updateOne({_id:messages[0]._id},{$set:{status:EmailStatus.SENT}}); await syncDeliveryEmailStatus(messages[0]);
        expect((await Process.findById(own._id))?.deliveryStatus).toBe(DeliveryStatus.EMAIL_QUEUED);
        await EmailQueue.updateMany({},{$set:{status:EmailStatus.SENT}}); await syncDeliveryEmailStatus(messages[0]);
        expect((await Process.findById(own._id))?.deliveryStatus).toBe(DeliveryStatus.EMAIL_SENT);
        expect((await Process.findById(own._id))?.emailSentAt).not.toBeNull();
    });
    it('final SMTP failure marks failed, and stale batch cannot change a reverted delivery', async () => {
        await config(); await delivery(); await request(app).post(`/process/${own._id}/email`);
        const messages=await EmailQueue.find(); await EmailQueue.updateMany({},{$set:{status:EmailStatus.FAILED}}); await syncDeliveryEmailStatus(messages[0]);
        expect((await Process.findById(own._id))?.deliveryStatus).toBe(DeliveryStatus.EMAIL_FAILED);
        expect((await request(app).post(`/process/${own._id}/revert`).send({reason:'Teste de reversão'})).status).toBe(200);
        await EmailQueue.updateMany({},{$set:{status:EmailStatus.SENT}}); await syncDeliveryEmailStatus(messages[0]);
        expect((await Process.findById(own._id))?.deliveryStatus).toBe(DeliveryStatus.NOT_DELIVERED);
    });
    it('worker records SMTP success and failure using a controlled transport', async () => {
        await config(); await delivery(); await request(app).post(`/process/${own._id}/email`);
        const sendMail=jest.fn().mockResolvedValue({messageId:'qa-controlled'});
        const transport=jest.spyOn(nodemailer,'createTransport').mockReturnValue({sendMail} as any);
        try {
            await new EmailWorker().processQueue();
            expect(sendMail).toHaveBeenCalled(); expect((await Process.findById(own._id))?.deliveryStatus).toBe(DeliveryStatus.EMAIL_SENT);
            await delivery(); await request(app).post(`/process/${own._id}/email`);
            await EmailQueue.updateMany({status:EmailStatus.PENDING},{$set:{maxAttempts:1}});
            sendMail.mockRejectedValue(new Error('Controlled SMTP failure')); await new EmailWorker().processQueue();
            expect((await Process.findById(own._id))?.deliveryStatus).toBe(DeliveryStatus.EMAIL_FAILED);
        } finally {transport.mockRestore();}
    });
    it('worker does not send a cancelled batch', async () => {
        await config(); await delivery(); await request(app).post(`/process/${own._id}/email`);
        await request(app).post(`/process/${own._id}/revert`).send({reason:'Cancelamento antes do envio'});
        const transport=jest.spyOn(nodemailer,'createTransport');
        try { await new EmailWorker().processQueue(); expect(transport).not.toHaveBeenCalled(); }
        finally {transport.mockRestore();}
        expect((await Process.findById(own._id))?.deliveryStatus).toBe(DeliveryStatus.NOT_DELIVERED);
    });
});
