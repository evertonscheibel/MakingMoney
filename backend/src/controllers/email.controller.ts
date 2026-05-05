import { Request, Response } from 'express';
import { body } from 'express-validator';
import { EmailEvent, Process, Cycle, EvaluationConfig, getDefaultRules, EmailConfig, User } from '../models';
import { asyncHandler, NotFoundError } from '../middleware/errors';
import { auditAction } from '../middleware/audit';
import { AuditAction, EntityType, CycleStatus, DeliverySource, EmailEventStatus, UserRole, ProcessStatus } from '../types';
import { extractProcessCode, calculateScore } from '../utils';

// Validation rules
export const simulateEmailValidation = [
    body('subject').trim().notEmpty().withMessage('Subject is required'),
    body('from').trim().isEmail().withMessage('Valid from email is required'),
    body('receivedAt').optional().isISO8601().withMessage('Invalid date format'),
];

/**
 * Simulate receiving an email and process it
 * POST /api/email-events/simulate
 */
export const simulateEmail = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { activeCompanyId } = req.user!;
    const { subject, from, receivedAt, body: emailBody } = req.body;

    // Get current cycle
    const cycle = await Cycle.findOne({
        companyId: activeCompanyId,
        status: CycleStatus.OPEN,
    });

    // Extract process code from subject
    const matchedCode = extractProcessCode(subject);

    let matchedProcess = null;
    let resultStatus = EmailEventStatus.NO_MATCH;

    if (matchedCode && cycle) {
        // Try to find process with this code
        matchedProcess = await Process.findOne({
            companyId: activeCompanyId,
            cycleId: cycle._id,
            code: matchedCode,
        });

        if (matchedProcess && !matchedProcess.deliveryDate) {
            // Get evaluation config
            const evalConfig = await EvaluationConfig.findOne({
                companyId: activeCompanyId,
                isActive: true,
            });
            const rules = evalConfig?.rules || getDefaultRules();

            // Mark as delivered
            const deliveryDate = receivedAt ? new Date(receivedAt) : new Date();
            const before = matchedProcess.toObject();

            const { score, status } = calculateScore(
                matchedProcess.plannedDate,
                matchedProcess.limitDate,
                deliveryDate,
                rules
            );

            matchedProcess.deliveryDate = deliveryDate;
            matchedProcess.deliverySource = DeliverySource.EMAIL;
            matchedProcess.deliveryEvidence = `Email from ${from}: ${subject}`;
            matchedProcess.score = score;
            matchedProcess.status = status;

            await matchedProcess.save();
            resultStatus = EmailEventStatus.MATCHED;

            // Audit the process update
            await auditAction(
                req,
                AuditAction.EMAIL_DELIVERY,
                EntityType.PROCESS,
                matchedProcess._id.toString(),
                before as any,
                matchedProcess.toObject() as any
            );

            // Send notification to admins/recipients about automatic match
            try {
                const { EmailService } = await import('../services/email.service');

                let recipientList: { email: string, nameArg: string }[] = [];
                const config = await EmailConfig.findOne({ companyId: activeCompanyId });

                if (config && config.recipients && config.recipients.length > 0) {
                    recipientList = config.recipients.map(email => ({ email, nameArg: 'Parceiro' }));
                } else {
                    // Fallback to admins
                    const admins = await User.find({
                        allowedCompanyIds: activeCompanyId,
                        roles: UserRole.MASTER,
                    }).select('email name');

                    recipientList = admins.map(u => ({ email: u.email, nameArg: u.name }));
                }

                for (const recipient of recipientList) {
                    const statusText = matchedProcess.status === ProcessStatus.ON_TIME ? 'No Prazo' :
                        matchedProcess.status === ProcessStatus.LATE ? 'Atrasado' : 'Crítico';

                    const emailHtml = `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #16a34a;">Processo Identificado via E-mail</h2>
                            <p>Olá ${recipient.nameArg},</p>
                            <p>Um e-mail foi recebido e vinculado automaticamente a um processo:</p>
                            
                            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <p><strong>Código:</strong> ${matchedProcess.code}</p>
                                <p><strong>Título:</strong> ${matchedProcess.title}</p>
                                <p><strong>De:</strong> ${from}</p>
                                <p><strong>Assunto:</strong> ${subject}</p>
                                <p><strong>Status:</strong> ${statusText}</p>
                                <p><strong>Pontuação:</strong> ${matchedProcess.score}</p>
                            </div>
                            
                            <p style="color: #6b7280; font-size: 14px;">
                                Esta é uma automação do sistema CHRONOS - Making Money Method.
                            </p>
                        </div>
                    `;

                    await EmailService.enqueue(activeCompanyId as any, {
                        to: recipient.email,
                        subject: `Entrega Automática: ${matchedProcess.code}`,
                        html: emailHtml,
                        category: 'email_match'
                    });
                }
            } catch (emailError) {
                // Non-blocking
            }
        }
    }

    // Create email event record
    const emailEvent = await EmailEvent.create({
        companyId: activeCompanyId,
        cycleId: cycle?._id || null,
        subject,
        from,
        receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
        matchedCode,
        matchedProcessId: matchedProcess?._id || null,
        resultStatus,
        processedAt: new Date(),
        rawPayload: { subject, from, body: emailBody },
    });

    res.status(201).json({
        success: true,
        data: {
            emailEvent,
            matched: resultStatus === EmailEventStatus.MATCHED,
            matchedProcess: matchedProcess ? {
                id: matchedProcess._id,
                code: matchedProcess.code,
                title: matchedProcess.title,
                score: matchedProcess.score,
                status: matchedProcess.status,
            } : null,
        },
        message: resultStatus === EmailEventStatus.MATCHED
            ? `Email matched to process ${matchedCode}. Score: ${matchedProcess?.score}`
            : matchedCode
                ? `Code ${matchedCode} found but no pending process matched`
                : 'No process code found in email subject',
    });
});

/**
 * List email events
 * GET /api/email-events
 */
export const listEmailEvents = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { activeCompanyId } = req.user!;
    const { page = '1', limit = '20' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    const [events, total] = await Promise.all([
        EmailEvent.find({ companyId: activeCompanyId })
            .sort({ receivedAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .populate('matchedProcessId', 'code title status score'),
        EmailEvent.countDocuments({ companyId: activeCompanyId }),
    ]);

    res.json({
        success: true,
        data: events,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
        },
    });
});

