import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Process, Cycle } from '../models';
import { asyncHandler, AppError, NotFoundError } from '../middleware/errors';
import { assertOpenProcess, assertSectorAccess } from '../utils/processAccess';
import { getCompanyRole } from '../utils/permissions';
import { AuditAction, EntityType, UserRole } from '../types';
import { auditAction } from '../middleware/audit';
import { serializeAssessment } from '../utils/assessment';

export const setProcessAssessment = asyncHandler(async (req: Request, res: Response) => {
    if (!Types.ObjectId.isValid(String(req.params.id))) throw new AppError('Processo inválido.', 400);
    const process = await Process.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!process) throw new NotFoundError('Process');
    await assertSectorAccess(req, process.sector, true);
    await assertOpenProcess(req, process);
    const { required, reason } = req.body;
    if (typeof required !== 'boolean' || typeof reason !== 'string' || !reason.trim() || reason.length > 1000) {
        throw new AppError('Informe a aplicabilidade e um motivo de até 1000 caracteres.', 400);
    }
    if (!required && (process.score != null || process.deliveryDate != null)) {
        throw new AppError('Reverta a entrega antes de marcar esta competência como não aplicável.', 409);
    }
    const before = process.toObject();
    process.assessmentRequired = required;
    process.nonApplicableReason = required ? null : reason.trim();
    await process.save();
    await auditAction(req, AuditAction.UPDATE, EntityType.PROCESS, String(process._id), before as any,
        { ...process.toObject(), assessmentChangeReason: reason.trim() } as any);
    res.json({ success: true, data: serializeAssessment(process) });
});

/** Explicitly reviewed metadata linkage, including legacy rows. Never match by code. */
export const linkProcessLineage = asyncHandler(async (req: Request, res: Response) => {
    if (getCompanyRole(req.user!, req.companyId!) !== UserRole.MASTER) throw new AppError('Somente Master pode confirmar vínculos históricos.', 403);
    const { referenceProcessId, reason, dryRun, expectedCount } = req.body;
    if (!Types.ObjectId.isValid(String(req.params.id)) || !Types.ObjectId.isValid(String(referenceProcessId)) || typeof reason !== 'string' || !reason.trim() || reason.length > 1000) {
        throw new AppError('Informe processo de referência e motivo do vínculo.', 400);
    }
    const [process, reference] = await Promise.all([
        Process.findOne({ _id: req.params.id, companyId: req.companyId }),
        Process.findOne({ _id: referenceProcessId, companyId: req.companyId }),
    ]);
    if (!process || !reference) throw new NotFoundError('Process');
    const oldLineage = process.lineageId || process._id, newLineage = reference.lineageId || reference._id;
    if (String(oldLineage) === String(newLineage)) { res.json({ success: true, data: { sourceCount: 0, alreadyLinked: true, conflicts: [] } }); return; }
    const [source, target, cycles] = await Promise.all([
        Process.find({ companyId: req.companyId, $or: [{ lineageId: oldLineage }, { _id: oldLineage }] }).lean(),
        Process.find({ companyId: req.companyId, $or: [{ lineageId: newLineage }, { _id: newLineage }] }).lean(),
        Cycle.find({ companyId: req.companyId }).select('_id month').lean(),
    ]);
    const months = new Map(cycles.map(c => [String(c._id), c.month]));
    const seen = new Set<string>(), conflicts: string[] = [];
    for (const member of [...source, ...target]) {
        const month = months.get(String(member.cycleId));
        if (!month || seen.has(month)) conflicts.push(month || 'Ciclo ausente');
        if (month) seen.add(month);
    }
    const preview = { sourceCount: source.length, sourceIds: source.map(p => String(p._id)),
        referenceCount: target.length, newLineageId: String(newLineage), conflicts };
    if (dryRun === true) { res.json({ success: true, data: preview }); return; }
    if (conflicts.length || expectedCount !== source.length || !source.length) throw new AppError('Revise o dry-run: quantidade mudou ou há processos concorrentes na mesma competência.', 409);
    // Standalone MongoDB has no transactions. Guard against concurrent edits and
    // compensate a partial failure before returning; the review never changes scores.
    const changed: typeof source = [];
    try {
        for (const member of [...source, ...target]) {
            if (String(member.lineageId || '') === String(newLineage)) continue;
            const result = await Process.updateOne({ _id: member._id, companyId: req.companyId,
                lineageId: member.lineageId ?? { $exists: false } }, { $set: { lineageId: newLineage } });
            if (result.matchedCount !== 1) throw new AppError('Registro alterado durante a confirmação. Gere nova prévia.', 409);
            changed.push(member);
        }
    } catch (error) {
        for (const member of changed.reverse()) {
            await Process.updateOne({ _id: member._id, companyId: req.companyId, lineageId: newLineage },
                member.lineageId ? { $set: { lineageId: member.lineageId } } : { $unset: { lineageId: '' } });
        }
        throw error;
    }
    for (const member of changed) {
        await auditAction(req, AuditAction.UPDATE, EntityType.PROCESS, String(member._id),
            { lineageId: member.lineageId || null }, { lineageId: newLineage, lineageLinkReason: reason.trim() });
    }
    res.json({ success: true, data: preview });
});
