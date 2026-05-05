import { Types } from 'mongoose';
import nodemailer from 'nodemailer';
import { Request, Response } from 'express';
import { body } from 'express-validator';
import { EmailConfig, SMTPSecurityMode } from '../models';
import { EmailService } from '../services/email.service';
import { asyncHandler } from '../middleware/errors';
import { logger } from '../config';
import { auditAction } from '../middleware/audit';
import { AuditAction, EntityType } from '../types';
import { encrypt, decrypt } from '../utils/crypto';

// Validation Rules
export const emailConfigValidation = [
    body('host').notEmpty().withMessage('Host is required'),
    body('port').isInt().withMessage('Port must be a number'),
    body('securityMode').isIn(Object.values(SMTPSecurityMode)).withMessage('Invalid security mode'),
    body('user').notEmpty().withMessage('User is required'),
    body('fromName').notEmpty().withMessage('From Name is required'),
    body('fromEmail').isEmail().withMessage('Valid From Email is required'),
    body('recipients').optional().isArray().withMessage('Recipients must be an array of emails'),
];

/**
 * Get email config for active company
 * GET /api/settings/email
 */
export const getEmailConfig = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { activeCompanyId } = req.user!;

    const config = await EmailConfig.findOne({ companyId: activeCompanyId });

    if (!config) {
        res.json({ success: true, data: null });
        return;
    }

    const safeConfig = config.toObject();

    // Fallback migration logic: if old 'secure' field exists but no securityMode
    if (!safeConfig.securityMode) {
        // @ts-ignore
        safeConfig.securityMode = safeConfig.secure ? SMTPSecurityMode.SSL_TLS : SMTPSecurityMode.STARTTLS;
    }

    safeConfig.auth.pass = '********';

    res.json({
        success: true,
        data: safeConfig,
    });
});

/**
 * Update or Create email config
 * PUT /api/settings/email
 */
export const updateEmailConfig = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { activeCompanyId } = req.user!;
    const { host, port, securityMode, user, pass, fromName, fromEmail, replyTo, footerText, isActive, recipients } = req.body;

    let config = await EmailConfig.findOne({ companyId: activeCompanyId });
    const isNew = !config;

    if (isNew) {
        config = new EmailConfig({
            companyId: activeCompanyId,
        });
    }

    const beforeConfig = isNew ? null : config!.toObject();

    config!.host = host;
    config!.port = port;
    config!.securityMode = securityMode || SMTPSecurityMode.STARTTLS;
    config!.auth.user = user;

    // Encrypt password if changed
    if (pass && pass !== '********') {
        config!.auth.pass = encrypt(pass);
    }

    config!.fromName = fromName;
    config!.fromEmail = fromEmail;
    config!.replyTo = replyTo;
    config!.footerText = footerText;
    config!.isActive = isActive !== undefined ? isActive : true;
    config!.recipients = recipients || []; // Save default recipients
    config!.updatedBy = new Types.ObjectId(req.user!.userId) as any;

    await config!.save();

    const auditAfter = config!.toObject();
    auditAfter.auth.pass = '********'; // Mask in audit

    await auditAction(
        req,
        isNew ? AuditAction.CREATE : AuditAction.UPDATE,
        EntityType.CONFIG,
        config!._id.toString(),
        beforeConfig as any,
        auditAfter as any
    );

    res.json({
        success: true,
        data: auditAfter, // return safe data
        message: 'Email configuration saved successfully',
    });
});

/**
 * Test SMTP connection - sends a real email to test recipient
 * POST /api/settings/email/test
 */
export const testEmailConnection = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    let { host, port, securityMode, user, pass, fromName, fromEmail, testRecipient, secure } = req.body;
    const { activeCompanyId } = req.user!;

    // Feature: Map frontend 'secure' boolean to backend 'securityMode' if latter is missing
    if (!securityMode && secure !== undefined) {
        securityMode = secure ? SMTPSecurityMode.SSL_TLS : SMTPSecurityMode.STARTTLS;
    }

    if (!testRecipient) {
        // Fallback to sender email if no recipient provided for test
        testRecipient = fromEmail;
    }

    if (!testRecipient) {
        res.status(400).json({ success: false, message: 'Test recipient is required (or fromEmail)' });
        return;
    }

    // Resolve password
    let passwordToUse = pass;
    if (pass === '********') {
        const existing = await EmailConfig.findOne({ companyId: activeCompanyId });
        if (existing) {
            passwordToUse = decrypt(existing.auth.pass);
        }
    }

    // Construct raw config for verification
    const testConfig = {
        host,
        port,
        securityMode: securityMode || SMTPSecurityMode.STARTTLS,
        auth: {
            user,
            pass: passwordToUse,
        }
    };

    try {
        // 1. Verify connection
        logger.info(`[EmailSettings] Testing connection to ${host}:${port} (${securityMode}) for company ${activeCompanyId}`);
        await EmailService.verifyConnection(testConfig);

        // 2. Try to send immediate test email
        const transporter = nodemailer.createTransport({
            host,
            port,
            secure: securityMode === SMTPSecurityMode.SSL_TLS,
            requireTLS: securityMode === SMTPSecurityMode.STARTTLS,
            auth: { user, pass: passwordToUse },
            tls: { rejectUnauthorized: false }
        });

        await transporter.sendMail({
            from: `"${fromName}" <${fromEmail}>`,
            to: testRecipient,
            subject: 'Teste de Conexão SMTP - GestãoPro',
            html: `
                <h3>Teste de Configuração</h3>
                <p>Este é um e-mail de teste para validar suas configurações SMTP no GestãoPro.</p>
                <ul>
                    <li><strong>Host:</strong> ${host}</li>
                    <li><strong>Porta:</strong> ${port}</li>
                    <li><strong>Modo:</strong> ${securityMode}</li>
                </ul>
                <p style="color: green;">✔ Conexão e envio bem sucedidos!</p>
            `
        });

        res.json({
            success: true,
            message: 'Conexão e envio de teste realizados com sucesso!',
            data: { message: 'Conexão e envio de teste realizados com sucesso!' }
        });
    } catch (error: any) {
        logger.error(`[EmailSettings] SMTP Test failed: ${error.message}`, {
            error,
            stack: error.stack,
            config: { host, port, securityMode, user }
        });

        // Provide more descriptive errors based on common SMTP failures
        let userMessage = error.message;
        if (error.code === 'EAUTH') userMessage = 'Autenticação falhou: Usuário ou senha incorretos.';
        if (error.code === 'ECONNREFUSED') userMessage = 'Conexão recusada: Verifique se o host e a porta estão corretos.';
        if (error.code === 'ETIMEDOUT') userMessage = 'Tempo de conexão esgotado: O servidor não respondeu.';
        if (error.command === 'CONN') userMessage = `Falha na conexão: ${error.message}`;

        // Specific hint for Skymail / Relay Denied
        if (error.message.includes('Relay access denied') || error.message.includes('Sender address rejected')) {
            userMessage = 'Relay Negado: O "Email do Remetente" deve ser exatamente igual ao "Usuário" para este servidor.';
        }

        res.status(400).json({
            success: false,
            message: `Falha: ${userMessage}`,
            error: userMessage, // for compatibility
            details: error
        });
    }
});

