import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { createHash } from 'crypto';
import { Types } from 'mongoose';
import { Company, User, EmailConfig, EmailQueue, EmailStatus } from '../models';
import { EmailTemplate } from '../models/EmailTemplate';
import { AppError, ForbiddenError, asyncHandler } from '../middleware/errors';
import { getCompanyRole, getEffectiveSectors, isSectorManager } from '../utils/permissions';
import { UserRole } from '../types';

export const reportEmailDefaults = {
    subject: '{{reportTitle}} - {{period}}',
    htmlBody: '<p>Olá,</p><p>Segue em anexo o relatório <strong>{{reportTitle}}</strong> de {{companyName}}, referente a {{period}}.</p><p>Atenciosamente,<br>{{senderName}}</p>',
};
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function requireReportSender(req: Request, _res: Response, next: NextFunction) {
    const role = getCompanyRole(req.user!, req.companyId!);
    if (![UserRole.MASTER, UserRole.MANAGER].includes(role)) return next(new ForbiddenError('Somente gestores e administradores podem enviar relatórios.'));
    next();
}
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 10, fieldSize: 12000 } }).single('report');
export function uploadReport(req: Request, res: Response, next: NextFunction) {
    upload(req, res, err => err ? next(new AppError('Anexe um único PDF de até 5 MB.', 400)) : next());
}

async function getContext(req: Request) {
    const company = await Company.findById(req.companyId).lean();
    if (!company) throw new AppError('Empresa não encontrada.', 404);
    const master = getCompanyRole(req.user!, req.companyId!) === UserRole.MASTER;
    const sectors = [...new Set([...getEffectiveSectors(req.user!, req.companyId!), ...company.sectors.filter(s => isSectorManager(s, req.user!.userId)).map(s => s.name)])];
    const config = await EmailConfig.findOne({ companyId: req.companyId, isActive: true }).lean();
    const users = await User.find({ 'companyAccess.companyId': req.companyId }).select('name email roles companyAccess sectors sector').lean();
    const recipients = new Map<string, { email: string; name: string }>();
    for (const candidate of users) {
        const access = candidate.companyAccess.find(a => String(a.companyId) === req.companyId);
        const candidateSectors = access?.sectors?.length ? access.sectors : [...(candidate.sectors || []), ...(candidate.sector ? [candidate.sector] : [])];
        if (master || String(candidate._id) === req.user!.userId || access?.role === UserRole.MASTER || candidateSectors.some(s => sectors.includes(s))) {
            recipients.set(candidate.email.toLowerCase(), { email: candidate.email.toLowerCase(), name: candidate.name });
        }
    }
    // Addresses registered by the administrator for the active company.
    for (const email of config?.recipients || []) if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) recipients.set(email.toLowerCase(), { email: email.toLowerCase(), name: 'Destinatário da empresa' });
    const template = await EmailTemplate.findOne({ companyId: req.companyId, category: 'report_share', isActive: true }).lean();
    const sender = await User.findById(req.user!.userId).select('name').lean();
    return { company, config, recipients, master, sectors, senderName: sender?.name || req.user!.email, template: template || reportEmailDefaults };
}

export const getReportEmailOptions = asyncHandler(async (req: Request, res: Response) => {
    const context = await getContext(req);
    res.json({ success: true, data: { configured: !!context.config,
        recipients: [...context.recipients.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        template: { subject: context.template.subject, htmlBody: context.template.htmlBody },
        senderName: context.senderName, companyName: context.company.name,
    } });
});

export const getReportEmailStatus = asyncHandler(async (req: Request, res: Response) => {
    const ids = typeof req.query.ids === 'string' ? [...new Set(req.query.ids.split(','))] : [];
    if (!ids.length || ids.length > 10 || ids.some(id => !Types.ObjectId.isValid(id))) throw new AppError('Envio inválido.', 400);
    const items = await EmailQueue.find({ _id: { $in: ids }, companyId: req.companyId, createdByUserId: req.user!.userId, category: 'report_share' }).select('to status attempts createdAt').lean();
    if (items.length !== ids.length) throw new ForbiddenError('Envio não autorizado.');
    res.json({ success: true, data: items.map(item => ({ id: String(item._id), to: item.to, status: item.status, attempts: item.attempts })) });
});

export const sendReportEmail = asyncHandler(async (req: Request, res: Response) => {
    const { subject, message = '', title, period, sector = '', requestId } = req.body;
    if (typeof requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) throw new AppError('Identificador de envio inválido. Abra novamente a janela de envio.', 400);
    if (typeof subject !== 'string' || !subject.trim() || subject.length > 200 || /[\r\n]/.test(subject)
        || typeof message !== 'string' || message.length > 4000 || typeof title !== 'string' || !title.trim() || title.length > 100
        || typeof period !== 'string' || !period.trim() || period.length > 100 || typeof sector !== 'string') throw new AppError('Confira assunto, período e mensagem (até 4.000 caracteres).', 400);
    if (!req.file || req.file.mimetype !== 'application/pdf' || req.file.buffer.subarray(0, 5).toString() !== '%PDF-') throw new AppError('O anexo deve ser um relatório PDF válido.', 400);
    let emails: unknown;
    try { emails = JSON.parse(req.body.recipients); } catch { throw new AppError('Selecione os destinatários cadastrados.', 400); }
    if (!Array.isArray(emails) || !emails.length || emails.length > 10 || emails.some(e => typeof e !== 'string')) throw new AppError('Selecione de 1 a 10 destinatários.', 400);
    const context = await getContext(req);
    if (!context.config) throw new AppError('Configure o servidor de e-mail da empresa antes de enviar relatórios.', 400);
    if (sector && (!context.company.sectors.some(s => s.name === sector) || (!context.master && !context.sectors.includes(sector)))) throw new ForbiddenError('Setor não autorizado.');
    const recipients = [...new Set((emails as string[]).map(e => e.toLowerCase()))];
    if (recipients.some(email => !context.recipients.has(email))) throw new ForbiddenError('Há destinatários fora dos cadastros permitidos da empresa.');
    const values: Record<string, string> = { reportTitle: title, period, companyName: context.company.name, senderName: context.senderName };
    const render = (body: string) => body.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => values[key] === undefined ? match : escape(values[key]));
    let html = render(context.template.htmlBody);
    if (message.trim()) html += `<hr><p><strong>Mensagem do gestor:</strong></p><p>${escape(message.trim()).replace(/\r?\n/g, '<br>')}</p>`;
    if (context.config.footerText) html += `<hr><p>${escape(context.config.footerText)}</p>`;
    const filename = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120).replace(/\.pdf$/i, '') + '.pdf';
    const reportPayloadHash = createHash('sha256').update(req.file.buffer).update(JSON.stringify({ subject: subject.trim(), html, recipients: [...recipients].sort(), title, period, sector })).digest('hex');
    const batchFilter = { companyId: req.companyId, createdByUserId: req.user!.userId, reportSendId: requestId };
    const existing = await EmailQueue.findOne(batchFilter).select('reportPayloadHash');
    if (existing && existing.reportPayloadHash !== reportPayloadHash) throw new AppError('Este envio já foi registrado. Feche a janela e inicie um novo envio para alterar o conteúdo.', 409);
    const entries = recipients.map(to => ({
        companyId: new Types.ObjectId(req.companyId), to, subject: subject.trim(), body: { html, text: html.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]*>/g, '') },
        category: 'report_share', createdByUserId: new Types.ObjectId(req.user!.userId), status: EmailStatus.PENDING,
        attachments: [{ filename, content: req.file!.buffer, contentType: 'application/pdf' }],
        reportSendId: requestId, reportPayloadHash,
    }));
    for (const entry of entries) await EmailQueue.updateOne({ ...batchFilter, to: entry.to }, { $setOnInsert: entry }, { upsert: true });
    const batch = await EmailQueue.find(batchFilter).select('_id');
    res.status(202).json({ success: true, data: { queued: batch.length, ids: batch.map(item => String(item._id)) }, message: 'Relatório adicionado à fila de e-mail.' });
});
