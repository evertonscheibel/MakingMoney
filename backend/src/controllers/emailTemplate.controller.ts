import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errors';
import { EmailTemplate } from '../models/EmailTemplate';

const categories = [
    ['process_delivery', 'Processo entregue'], ['process_share', 'Compartilhamento de processo'],
    ['cycle_open', 'Ciclo aberto'],
    ['cycle_close', 'Ciclo encerrado'], ['cycle_review', 'Revisão de datas do ciclo'],
    ['alert_reminder', 'Processos atrasados'], ['alert_admin', 'Alerta administrativo'],
];

export const listEmailTemplates = asyncHandler(async (req: Request, res: Response) => {
    const saved = await EmailTemplate.find({ companyId: req.companyId }).lean();
    res.json({ success: true, data: categories.map(([category, label]) => saved.find(t => t.category === category) || { category, label, subject: '', htmlBody: '', isActive: false }) });
});

export const upsertEmailTemplate = asyncHandler(async (req: Request, res: Response) => {
    const { category, label, subject, htmlBody, isActive = true } = req.body;
    if (!categories.some(([key]) => key === category)) throw new Error('Categoria de e-mail inválida');
    const template = await EmailTemplate.findOneAndUpdate(
        { companyId: req.companyId, category },
        { $set: { label: label || categories.find(([key]) => key === category)?.[1], subject, htmlBody, isActive } },
        { upsert: true, new: true, runValidators: true }
    );
    res.json({ success: true, data: template });
});
