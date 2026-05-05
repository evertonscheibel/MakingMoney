import nodemailer from 'nodemailer';
import { EmailQueue, EmailConfig, EmailLog, EmailStatus, EmailLogStatus, SMTPSecurityMode } from '../../models';
import { logger } from '../../config';
import { decrypt } from '../../utils/crypto';

export class EmailWorker {
    private isRunning = false;
    // Check every 10 seconds
    private INTERVAL_MS = 10000;

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        logger.info('[EmailWorker] Started');

        // Initial run
        this.processQueue();

        // Loop
        setInterval(() => {
            this.processQueue();
        }, this.INTERVAL_MS);
    }

    async processQueue() {
        try {
            // Find pending items
            const items = await EmailQueue.find({
                status: { $in: [EmailStatus.PENDING, EmailStatus.RETRY_SCHEDULED] },
                nextAttemptAt: { $lte: new Date() }
            }).limit(10); // Batch size

            if (items.length === 0) return;

            logger.info(`[EmailWorker] Processing ${items.length} items`);

            for (const item of items) {
                await this.processItem(item);
            }
        } catch (error) {
            logger.error(`[EmailWorker] Error processing queue: ${error}`);
        }
    }

    private async processItem(item: any) {
        // Mark as sending to prevent double processing (though should rely on atomic findAndUpdate in robust systems)
        // For simple worker, this checking logic above + synchronous processing loop is "ok" but risky if multiple instances.
        // Better: findOneAndUpdate. 
        // We will update status first.

        try {
            const current = await EmailQueue.findOneAndUpdate(
                { _id: item._id, status: { $in: [EmailStatus.PENDING, EmailStatus.RETRY_SCHEDULED] } },
                { status: EmailStatus.SENDING }
            );

            if (!current) return; // Already picked up

            // Get Config
            const config = await EmailConfig.findOne({ companyId: current.companyId, isActive: true });

            if (!config) {
                throw new Error('No active email configuration found for company');
            }

            // Decrypt password
            const password = decrypt(config.auth.pass);

            // Create Transport
            const transporter = nodemailer.createTransport({
                host: config.host,
                port: config.port,
                secure: config.securityMode === SMTPSecurityMode.SSL_TLS,
                // STARTTLS logic often handled automatically if port 587, or explicit:
                requireTLS: config.securityMode === SMTPSecurityMode.STARTTLS,
                auth: {
                    user: config.auth.user,
                    pass: password,
                },
                tls: {
                    rejectUnauthorized: false // Common fix for self-signed or some provider issues
                }
            });

            // Send
            const info = await transporter.sendMail({
                from: `"${config.fromName}" <${config.fromEmail}>`,
                to: current.to,
                subject: current.subject,
                html: current.body.html, // Ensure Footer injection happening before queueing or here? Here is safer.
                text: current.body.text,
                replyTo: config.replyTo,
            });

            // Success
            await EmailQueue.findByIdAndUpdate(current._id, {
                status: EmailStatus.SENT,
                updatedAt: new Date()
            });

            // Log
            await EmailLog.create({
                companyId: current.companyId,
                queueId: current._id,
                to: current.to,
                subject: current.subject,
                category: current.category,
                status: EmailLogStatus.SENT,
                providerMessageId: info.messageId,
                createdByUserId: current.createdByUserId,
                sentAt: new Date()
            });

        } catch (error: any) {
            logger.error(`[EmailWorker] Failed to send email ${item._id}: ${error.message}`);

            // Handle Retry
            const attempts = item.attempts + 1;
            let newStatus = EmailStatus.RETRY_SCHEDULED;
            let nextAttempt = new Date();

            if (attempts >= item.maxAttempts) {
                newStatus = EmailStatus.FAILED;
            } else {
                // Backoff: 1m, 5m, 15m, 1h...
                const minutes = [1, 5, 15, 60, 360, 720];
                const waitMin = minutes[Math.min(attempts - 1, minutes.length - 1)] || 60;
                nextAttempt = new Date(Date.now() + waitMin * 60000);
            }

            await EmailQueue.findByIdAndUpdate(item._id, {
                status: newStatus,
                attempts,
                nextAttemptAt: nextAttempt,
                lastError: error.message,
                updatedAt: new Date()
            });

            // Log Failure
            await EmailLog.create({
                companyId: item.companyId,
                queueId: item._id,
                to: item.to,
                subject: item.subject,
                category: item.category,
                status: EmailLogStatus.FAILED,
                error: error.message,
                createdByUserId: item.createdByUserId,
                sentAt: new Date()
            });
        }
    }
}

export const emailWorker = new EmailWorker();

