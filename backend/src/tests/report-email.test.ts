import express from 'express';
import request from 'supertest';
import nodemailer from 'nodemailer';
import { Company, User, EmailConfig, EmailQueue, EmailStatus } from '../models';
import { EmailTemplate } from '../models/EmailTemplate';
import { getReportEmailOptions, getReportEmailStatus, requireReportSender, sendReportEmail, uploadReport } from '../controllers/reportEmail.controller';
import { errorHandler } from '../middleware/errors';
import { UserRole } from '../types';
import { encrypt } from '../utils/crypto';
import { EmailWorker } from '../services/email/EmailWorker';
import emailTemplateRouter from '../routes/emailTemplate.routes';
import { generateToken } from '../middleware/auth';

let company: any, manager: any, auth: any;
const pdf = Buffer.from('%PDF-1.4\nReport fixture');
const app = express();
app.use(express.json());
app.use('/templates', emailTemplateRouter);
app.use((req, _res, next) => { req.user = auth; req.companyId = String(company._id); next(); });
app.get('/options', requireReportSender, getReportEmailOptions);
app.get('/status', requireReportSender, getReportEmailStatus);
app.post('/send', requireReportSender, uploadReport, sendReportEmail);
app.use(errorHandler);

beforeEach(async () => {
    company = await Company.create({ name: 'Empresa QA', sectors: [{ name: 'Financeiro' }, { name: 'RH' }] });
    manager = await User.create({ name: 'Gestor QA', email: 'manager@example.invalid', passwordHash: 'qa-only-123', roles: [UserRole.MANAGER], companyAccess: [{ companyId: company._id, role: UserRole.MANAGER, sectors: ['Financeiro'] }] });
    await User.create({ name: 'Operador QA', email: 'operator@example.invalid', passwordHash: 'qa-only-123', roles: [UserRole.OPERATOR], companyAccess: [{ companyId: company._id, role: UserRole.OPERATOR, sectors: ['Financeiro'] }] });
    await User.create({ name: 'RH QA', email: 'rh@example.invalid', passwordHash: 'qa-only-123', roles: [UserRole.OPERATOR], companyAccess: [{ companyId: company._id, role: UserRole.OPERATOR, sectors: ['RH'] }] });
    await User.create({ name: 'Outra empresa', email: 'outside@example.invalid', passwordHash: 'qa-only-123', roles: [UserRole.OPERATOR], companyAccess: [{ companyId: (await Company.create({ name: 'Outra empresa' }))._id, role: UserRole.OPERATOR }] });
    auth = { userId: String(manager._id), email: manager.email, roles: [UserRole.MANAGER], companyAccess: [{ companyId: String(company._id), role: UserRole.MANAGER, sectors: ['Financeiro'] }] };
    await EmailConfig.create({ companyId: company._id, host: 'smtp.example.invalid', port: 587, securityMode: 'STARTTLS', auth: { user: 'qa@example.invalid', pass: encrypt('qa-only') }, fromName: 'QA', fromEmail: 'qa@example.invalid', isActive: true, recipients: ['registered@example.invalid'], footerText: 'Rodapé da empresa' });
});

function send(to = ['operator@example.invalid'], attachment = pdf, sector = 'Financeiro') {
    return request(app).post('/send').field('recipients', JSON.stringify(to)).field('title', 'Relatório operacional').field('period', '2026-10').field('sector', sector)
        .field('requestId', '019c0000-0000-4000-8000-000000000001')
        .field('subject', 'Assunto revisado pelo gestor').field('message', 'Confira <script>alert(1)</script>\nObrigado!').attach('report', attachment, { filename: 'relatorio.pdf', contentType: 'application/pdf' });
}

it('lists only company recipients and sectors allowed for the manager', async () => {
    const response = await request(app).get('/options');
    expect(response.status).toBe(200);
    expect(response.body.data.configured).toBe(true);
    expect(response.body.data.recipients.map((r: any) => r.email).sort()).toEqual(['manager@example.invalid', 'operator@example.invalid', 'registered@example.invalid']);
    expect(JSON.stringify(response.body)).not.toContain('qa-only');
});
it('blocks operators even when the global role says manager', async () => {
    auth.companyAccess[0].role = UserRole.OPERATOR;
    expect((await request(app).get('/options')).status).toBe(403);
    expect((await send()).status).toBe(403);
    expect(await EmailQueue.countDocuments()).toBe(0);
});
it('rejects recipients from another company or an unauthorized sector', async () => {
    expect((await send(['outside@example.invalid'])).status).toBe(403);
    expect((await send(['rh@example.invalid'])).status).toBe(403);
    expect((await send(undefined, pdf, 'RH')).status).toBe(403);
    expect(await EmailQueue.countDocuments()).toBe(0);
});
it('rejects a missing SMTP configuration, invalid PDF and too many recipients', async () => {
    expect((await send(undefined, Buffer.from('not a pdf'))).status).toBe(400);
    expect((await send(Array(11).fill('operator@example.invalid'))).status).toBe(400);
    await EmailConfig.deleteMany({});
    expect((await send()).status).toBe(400);
    expect(await EmailQueue.countDocuments()).toBe(0);
});
it('stores the PDF, escaped comment, default text and author in one queue item per unique recipient', async () => {
    const response = await send(['operator@example.invalid', 'operator@example.invalid', 'registered@example.invalid']);
    expect(response.status).toBe(202); expect(response.body.data.queued).toBe(2);
    const items = await EmailQueue.find({}); expect(items).toHaveLength(2);
    const item = items[0];
    expect(item.subject).toBe('Assunto revisado pelo gestor');
    expect(item.body.html).toContain('Relatório operacional');
    expect(item.body.html).toContain('Empresa QA');
    expect(item.body.html).toContain('&lt;script&gt;');
    expect(item.body.html).not.toContain('<script>');
    expect(item.body.html).toContain('Rodapé da empresa');
    expect(String(item.createdByUserId)).toBe(String(manager._id));
    expect(Buffer.from(item.attachments![0].content)).toEqual(pdf);
});
it('uses the custom fixed message and still includes the sender comment', async () => {
    await EmailTemplate.create({ companyId: company._id, category: 'report_share', label: 'Envio de relatórios', subject: 'Padrão {{period}}', htmlBody: '<p>Texto fixo {{companyName}} / {{reportTitle}} / {{senderName}}</p>', isActive: true });
    const options = await request(app).get('/options'); expect(options.body.data.template.subject).toBe('Padrão {{period}}');
    await send(); const item = await EmailQueue.findOne({});
    expect(item!.body.html).toContain('Texto fixo Empresa QA / Relatório operacional / Gestor QA');
    expect(item!.body.html).toContain('Mensagem do gestor');
    expect(item!.subject).toBe('Assunto revisado pelo gestor');
});
it('does not duplicate a report when the same request is retried', async () => {
    expect((await send()).status).toBe(202);
    expect((await send()).status).toBe(202);
    expect(await EmailQueue.countDocuments()).toBe(1);
    expect((await send(['registered@example.invalid'])).status).toBe(409);
    expect(await EmailQueue.countDocuments()).toBe(1);
});
it('saves the fixed template under the selected company through the authenticated route', async () => {
    manager.roles = [UserRole.MASTER]; await manager.save();
    const token = generateToken({ _id: String(manager._id), email: manager.email, roles: [UserRole.MASTER] });
    const response = await request(app).put('/templates/report_share').set('Authorization', `Bearer ${token}`).set('x-company-id', String(company._id))
        .send({ subject: 'Relatório {{period}}', htmlBody: '<p>Texto fixo da empresa</p>', isActive: true });
    expect(response.status).toBe(200);
    expect(String((await EmailTemplate.findOne({ category: 'report_share' }))!.companyId)).toBe(String(company._id));
    expect(await EmailTemplate.countDocuments({ companyId: null })).toBe(0);
    const options = await request(app).get('/options');
    expect(options.body.data.template.htmlBody).toBe('<p>Texto fixo da empresa</p>');
});
it('shows the queue status only to the author within the active company', async () => {
    const response = await send(); const ids = response.body.data.ids.join(',');
    const status = await request(app).get('/status').query({ ids });
    expect(status.status).toBe(200); expect(status.body.data[0].status).toBe('PENDING');
    expect(JSON.stringify(status.body)).not.toContain('attachments');
    auth.userId = String((await User.findOne({ email: 'operator@example.invalid' }))!._id);
    expect((await request(app).get('/status').query({ ids })).status).toBe(403);
});
it('passes the saved PDF to SMTP and releases attachment storage after a successful send', async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'controlled-report' });
    const spy = jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail } as any);
    try {
        await send(); await new EmailWorker().processQueue();
        const item = await EmailQueue.findOne({}); expect(item!.status).toBe(EmailStatus.SENT);
        expect(sendMail.mock.calls[0][0].attachments[0].content).toEqual(pdf);
        expect(item!.attachments).toHaveLength(0);
    } finally { spy.mockRestore(); }
});
it('retains the attachment for a retry when SMTP fails', async () => {
    const spy = jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail: jest.fn().mockRejectedValue(new Error('Controlled SMTP failure')) } as any);
    try {
        await send(); await new EmailWorker().processQueue();
        const item = await EmailQueue.findOne({}); expect(item!.status).toBe(EmailStatus.RETRY_SCHEDULED);
        expect(Buffer.from(item!.attachments![0].content)).toEqual(pdf);
    } finally { spy.mockRestore(); }
});
