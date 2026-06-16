import { Process, Cycle, User, EvaluationConfig, getDefaultRules } from '../../models';
import { logger } from '../../config';
import { EmailService } from '../email.service';
import { ProcessStatus, CycleStatus, UserRole } from '../../types';

export class AlertWorker {
    private isRunning = false;
    // Check every 24 hours
    private INTERVAL_MS = 24 * 60 * 60 * 1000;

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        logger.info('[AlertWorker] Started');

        // Initial run after a short delay to let things settle
        setTimeout(() => {
            this.runAlerts();
        }, 30000); // 30 seconds after start

        // Loop daily
        setInterval(() => {
            this.runAlerts();
        }, this.INTERVAL_MS);
    }

    async runAlerts() {
        try {
            logger.info('[AlertWorker] Running daily process alerts task...');

            // 1. Find all open cycles
            const openCycles = await Cycle.find({ status: CycleStatus.OPEN });

            for (const cycle of openCycles) {
                await this.processCycleAlerts(cycle);
            }

            logger.info('[AlertWorker] Daily alerts task completed.');
        } catch (error) {
            logger.error(`[AlertWorker] Error in daily alerts: ${error}`);
        }
    }

    private async processCycleAlerts(cycle: any) {
        // 2. Find LATE or CRITICAL processes without delivery date
        const criticalProcesses = await Process.find({
            cycleId: cycle._id,
            status: { $in: [ProcessStatus.LATE, ProcessStatus.CRITICAL] },
            deliveryDate: null,
            isActive: { $ne: false }
        }).populate('responsibleUserId', 'name email');

        if (criticalProcesses.length === 0) return;

        // 3. Group by responsible user
        const userGroups = new Map<string, any[]>();
        const unassignedProcesses: any[] = [];

        for (const p of criticalProcesses) {
            if (p.responsibleUserId && (p.responsibleUserId as any).email) {
                const userId = (p.responsibleUserId as any)._id.toString();
                if (!userGroups.has(userId)) userGroups.set(userId, []);
                userGroups.get(userId)?.push(p);
            } else {
                unassignedProcesses.push(p);
            }
        }

        // 4. Send emails to responsible users
        for (const [userId, processes] of userGroups.entries()) {
            const user = processes[0].responsibleUserId;
            await this.sendUserSummary(cycle.companyId, user, processes, cycle.month);
        }

        // 5. Send unassigned processes to company admins/notification emails
        if (unassignedProcesses.length > 0) {
            await this.sendAdminSummary(cycle.companyId, unassignedProcesses, cycle.month);
        }
    }

    private async sendUserSummary(companyId: string, user: any, processes: any[], month: string) {
        const processList = processes.map(p =>
            `<li><strong>[${p.code}] ${p.title}</strong> - Status: <span style="color: ${p.status === ProcessStatus.CRITICAL ? '#dc2626' : '#eab308'}; font-weight: bold;">${p.status}</span></li>`
        ).join('');

        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #dc2626;">Lembrete: Processos Atrasados ou Críticos</h2>
                <p>Olá ${user.name},</p>
                <p>Você possui processos pendentes que estão <strong>Atrasados</strong> ou em estado <strong>Crítico</strong> no ciclo de <strong>${month}</strong>:</p>
                
                <ul style="background-color: #fef2f2; padding: 20px; border-radius: 8px; list-style-type: none;">
                    ${processList}
                </ul>

                <p>Por favor, realize as entregas no sistema CHRONOS - Making Money Method para regularizar sua pontuação.</p>
                
                <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                    Esta é uma notificação automática do sistema CHRONOS - Making Money Method.
                </p>
            </div>
        `;

        await EmailService.enqueue(companyId, {
            to: user.email,
            subject: `ALERTA: Processos Pendentes - ${month}`,
            html: emailHtml,
            category: 'alert_reminder'
        });
    }

    private async sendAdminSummary(companyId: string, processes: any[], month: string) {
        // Find Admins or use notificationEmails from EvalConfig
        const evalConfig = await EvaluationConfig.findOne({ companyId, isActive: true });
        const recipients = evalConfig?.rules?.notificationEmails?.length
            ? evalConfig.rules.notificationEmails
            : [];

        // If no notification emails, fallback to admins
        if (recipients.length === 0) {
            const admins = await User.find({
                allowedCompanyIds: companyId,
                roles: UserRole.MASTER
            }).select('email');
            recipients.push(...admins.map(a => a.email));
        }

        if (recipients.length === 0) return;

        const processList = processes.map(p =>
            `<li><strong>[${p.code}] ${p.title}</strong> (Sem responsável definido) - Status: ${p.status}</li>`
        ).join('');

        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #dc2626;">Alerta Adm: Processos Críticos sem Responsável</h2>
                <p>Existem processos no ciclo de <strong>${month}</strong> que estão atrasados ou críticos e não possuem um responsável direto associado:</p>
                
                <ul style="background-color: #fef2f2; padding: 20px; border-radius: 8px; list-style-type: none;">
                    ${processList}
                </ul>

                <p>Recomendamos verificar o status desses processos no painel administrativo.</p>
                
                <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                    Esta é uma notificação automática do sistema CHRONOS - Making Money Method.
                </p>
            </div>
        `;

        for (const email of recipients) {
            await EmailService.enqueue(companyId, {
                to: email,
                subject: `Alerta Administrativo: Processos Pendentes - ${month}`,
                html: emailHtml,
                category: 'alert_admin'
            });
        }
    }
}

export const alertWorker = new AlertWorker();

