import { logger } from '../config';
import fs from 'fs';
import path from 'path';
import { EmailService } from '../services/email.service';

const LOG_DIR = path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'email_logs.txt');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

const writeEmailToLog = (subject: string, to: string, content: string) => {
    const timestamp = new Date().toISOString();
    const logEntry = `
================================================
TIME: ${timestamp}
TO: ${to}
SUBJECT: ${subject}
------------------------------------------------
${content}
================================================
`;
    fs.appendFileSync(LOG_FILE, logEntry);
    console.log(logEntry);
};

/**
 * Send Verification Email
 */
export const sendVerificationEmail = async (email: string, code: string, name: string, companyId?: string): Promise<void> => {
    const subject = 'Código de Verificação - GestãoPro';
    const content = `Olá ${name},
Obrigado por se cadastrar no GestãoPro.
Seu código para ativar sua conta é:

       [ ${code} ]

O código expira em 24 horas.`;
    const html = `<p>Olá ${name},</p>
<p>Obrigado por se cadastrar no CHRONOS - Making Money Method.</p>
<p>Seu código para ativar sua conta é:</p>
<h2 style="color: #4A90E2; letter-spacing: 5px;">${code}</h2>
<p>O código expira em 24 horas.</p>`;

    if (companyId) {
        try {
            await EmailService.enqueue(companyId, {
                to: email,
                subject,
                html,
                text: content,
                category: 'system'
            });
            logger.info(`📧 [EMAIL] Verification email queued for ${email}`);
            return;
        } catch (error) {
            logger.error(`Failed to queue verification email: ${error}`);
        }
    }

    logger.info(`📧 [EMAIL SIMULADO] Enviando código de verificação para ${email} (Fallback Log)`);
    writeEmailToLog(subject, `${name} <${email}>`, content);
};

export const sendWelcomeEmail = async (email: string, name: string, companyId?: string): Promise<void> => {
    const subject = 'Bem-vindo ao CHRONOS - Making Money Method!';
    const content = `Olá ${name},
Sua conta foi verificada com sucesso.
Agora você já pode acessar todos os recursos do sistema.`;
    const html = `<p>Olá ${name},</p>
<p>Sua conta foi verificada com sucesso.</p>
<p>Agora você já pode acessar todos os recursos do sistema.</p>`;

    if (companyId) {
        try {
            await EmailService.enqueue(companyId, {
                to: email,
                subject,
                html,
                text: content,
                category: 'system'
            });
            logger.info(`📧 [EMAIL] Welcome email queued for ${email}`);
            return;
        } catch (error) {
            logger.error(`Failed to queue welcome email: ${error}`);
        }
    }

    logger.info(`📧 [EMAIL SIMULADO] Enviando boas-vindas para ${email} (Fallback Log)`);
    writeEmailToLog(subject, `${name} <${email}>`, content);
};

export const sendPasswordResetEmail = async (email: string, token: string, name: string, companyId?: string): Promise<void> => {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${token}`;
    const subject = 'Recuperação de Senha - CHRONOS - Making Money Method';
    const content = `Olá ${name},
Você solicitou a recuperação de senha da sua conta.
Para criar uma nova senha, clique no link abaixo:
${resetUrl}
Este link expira em 1 hora.`;
    const html = `<p>Olá ${name},</p>
<p>Você solicitou a recuperação de senha da sua conta.</p>
<p>Para criar uma nova senha, clique no link abaixo:</p>
<p><a href="${resetUrl}" style="background-color: #4A90E2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Redefinir Senha</a></p>
<p><small>${resetUrl}</small></p>
<p>Este link expira em 1 hora.</p>`;

    if (companyId) {
        try {
            await EmailService.enqueue(companyId, {
                to: email,
                subject,
                html,
                text: content,
                category: 'system'
            });
            logger.info(`📧 [EMAIL] Reset password email queued for ${email}`);
            return;
        } catch (error) {
            logger.error(`Failed to queue reset password email: ${error}`);
        }
    }

    logger.info(`📧 [EMAIL SIMULADO] Enviando recuperação de senha para ${email} (Fallback Log)`);
    writeEmailToLog(subject, `${name} <${email}>`, content);
};

