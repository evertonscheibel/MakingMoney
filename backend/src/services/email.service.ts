import nodemailer from 'nodemailer';
import { EmailConfig, EmailQueue, EmailStatus, SMTPSecurityMode } from '../models';
import { logger } from '../config';
import { decrypt } from '../utils/crypto';
import { Types } from 'mongoose';

interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
    category?: string;
    entityId?: string;
    entityType?: string;
    createdBy?: string;
}

export class EmailService {
    /**
     * Enqueue an email to be sent by the worker
     */
    static async enqueue(companyId: string, options: EmailOptions): Promise<boolean> {
        try {
            // Check if company has active config
            const config = await EmailConfig.findOne({ companyId, isActive: true });
            if (!config) {
                logger.warn(`[EmailService] No active configuration for company ${companyId}. Email not queued.`);
                return false;
            }

            // LGPD: Add footer info if configured
            let finalHtml = options.html;
            if (config.footerText) {
                finalHtml += `<br><hr><small style="color: #666;">${config.footerText}</small>`;
                // Add opt-out link logic here if needed for marketing categorization
            }

            await EmailQueue.create({
                companyId,
                to: options.to,
                subject: options.subject,
                body: {
                    html: finalHtml,
                    text: options.text || options.html.replace(/<[^>]*>/g, ''),
                },
                category: options.category || 'general',
                entityId: options.entityId ? new Types.ObjectId(options.entityId) : undefined,
                entityType: options.entityType,
                createdByUserId: options.createdBy ? new Types.ObjectId(options.createdBy) : undefined,
                status: EmailStatus.PENDING
            });

            logger.info(`[EmailService] Email queued for ${options.to}`);
            return true;
        } catch (error) {
            logger.error(`[EmailService] Error queuing email: ${error}`);
            throw error;
        }
    }

    /**
     * Send immediately (bypassing queue) - Used for Tests
     */
    static async sendNow(companyId: string, options: EmailOptions): Promise<any> {
        const config = await EmailConfig.findOne({ companyId, isActive: true });
        if (!config) throw new Error('No active email config');

        const password = decrypt(config.auth.pass);

        const transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.securityMode === SMTPSecurityMode.SSL_TLS,
            requireTLS: config.securityMode === SMTPSecurityMode.STARTTLS,
            auth: {
                user: config.auth.user,
                pass: password,
            },
            tls: { rejectUnauthorized: false }
        });

        return transporter.sendMail({
            from: `"${config.fromName}" <${config.fromEmail}>`,
            to: options.to,
            subject: options.subject,
            html: options.html,
            replyTo: config.replyTo
        });
    }

    /**
     * Verify SMTP connection settings (Raw config data)
     */
    static async verifyConnection(configData: any): Promise<boolean> {
        try {
            // If pass is encrypted (from DB update flow), might need decrypting? 
            // Usually this method receives raw input from the form (plaintext password) OR 
            // a mixed object if we are re-testing a saved config.
            // The controller handles fetching the real password if it's currently masked.
            // So we assume configData.auth.pass is the plain text password here.

            const transporter = nodemailer.createTransport({
                host: configData.host,
                port: configData.port,
                secure: configData.securityMode === SMTPSecurityMode.SSL_TLS,
                requireTLS: configData.securityMode === SMTPSecurityMode.STARTTLS,
                auth: {
                    user: configData.auth.user,
                    pass: configData.auth.pass,
                },
                tls: {
                    rejectUnauthorized: false
                }
            });

            await transporter.verify();
            return true;
        } catch (error) {
            logger.error(`[EmailService] Connection verification failed: ${error}`);
            throw error;
        }
    }
}

