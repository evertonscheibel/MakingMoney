import { Company, Cycle, Process, User } from '../models';
import { CycleStatus, ProcessStatus } from '../types';
import { EmailService } from './email.service';
import { logger } from '../config';

type SundayRule = 'KEEP' | 'PREVIOUS_DAY' | 'PREVIOUS_BUSINESS_DAY' | 'NEXT_DAY' | 'NEXT_BUSINESS_DAY';

function localParts(timezone: string) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts(new Date());
    return Object.fromEntries(parts.map(p => [p.type, p.value]));
}

function nextMonth(month: string) {
    const [year, value] = month.split('-').map(Number);
    const date = new Date(Date.UTC(year, value, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function moveMonth(date: Date) {
    const year = date.getUTCFullYear(); const month = date.getUTCMonth(); const day = date.getUTCDate();
    const lastTargetDay = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();
    return new Date(Date.UTC(year, month + 1, Math.min(day, lastTargetDay)));
}
function applySunday(date: Date, rule: SundayRule) {
    if (date.getUTCDay() !== 0 || rule === 'KEEP') return date;
    const result = new Date(date);
    const backwards = rule.startsWith('PREVIOUS');
    result.setUTCDate(result.getUTCDate() + (backwards ? -1 : 1));
    if (rule.endsWith('BUSINESS_DAY') && result.getUTCDay() === 6) result.setUTCDate(result.getUTCDate() - 1);
    return result;
}

export class CycleAutomationWorker {
    private timer?: NodeJS.Timeout;
    start() { if (this.timer) return; this.run(); this.timer = setInterval(() => this.run(), 60_000); logger.info('[CycleAutomationWorker] Started'); }
    async run() {
        try {
            const companies = await Company.find({ isActive: true });
            for (const company of companies) for (const sector of company.sectors as any[]) {
                const cfg = sector.cycleAutomation;
                if (!cfg?.enabled) continue;
                const now = localParts(cfg.timezone || 'America/Cuiaba');
                const lastDay = new Date(Number(now.year), Number(now.month), 0).getDate();
                const effectiveClosingDay = Math.min(Number(cfg.closingDay || 1), lastDay);
                if (Number(now.day) !== effectiveClosingDay || `${now.hour}:${now.minute}` < (cfg.closingTime || '00:00')) continue;
                const currentMonth = `${now.year}-${now.month}`;
                const cycle = await Cycle.findOne({ companyId: company._id, sector: sector.name, status: CycleStatus.OPEN, month: { $lt: currentMonth } }).sort({ month: 1 });
                if (!cycle) continue;
                await this.closeAndOpen(company, sector, cycle);
            }
        } catch (error) { logger.error(`[CycleAutomationWorker] ${error}`); }
    }
    private async closeAndOpen(company: any, sector: any, cycle: any) {
        const processes = await Process.find({ cycleId: cycle._id });
        cycle.status = CycleStatus.CLOSED; cycle.closedAt = new Date();
        const active = processes.filter(p => p.isActive !== false);
        cycle.kpis = { avgScore: active.length ? active.reduce((n,p)=>n+(p.score || 0),0)/active.length : 0, onTimePct: active.length ? active.filter(p=>p.status===ProcessStatus.ON_TIME).length*100/active.length : 0, criticalCount: active.filter(p=>p.status===ProcessStatus.CRITICAL).length, totalProcesses: active.length, avgDeviationDays: 0 };
        await cycle.save();
        const month = nextMonth(cycle.month);
        const target = await Cycle.findOneAndUpdate({ companyId: company._id, sector: sector.name, month }, { $set: { status: CycleStatus.OPEN, openedAt: new Date(), closedAt: null } }, { upsert: true, new: true });
        const existing = new Set(await Process.find({ cycleId: target._id }).distinct('code'));
        const clones = processes.filter(p=>!existing.has(p.code)).map(p => { const value:any=p.toObject(); delete value._id; delete value.createdAt; delete value.updatedAt; return {...value,cycleId:target._id,plannedDate:applySunday(moveMonth(p.plannedDate),sector.cycleAutomation.sundayPlannedRule),limitDate:applySunday(moveMonth(p.limitDate),sector.cycleAutomation.sundayLimitRule),deliveryDate:null,deliverySource:null,deliveryEvidence:null,deliveryStatus:'NOT_DELIVERED',score:null,status:ProcessStatus.PENDING,emailSentAt:null}; });
        if (clones.length) await Process.insertMany(clones);
        const ids=[...new Set([...(sector.managerIds||[]),...(sector.managerId?[sector.managerId]:[])].map(String))];
        const managers=await User.find({_id:{$in:ids}}).select('name email');
        for(const manager of managers) await EmailService.enqueue(company._id.toString(),{to:manager.email,subject:`Revise as datas do ciclo ${month}`,html:`<p>Olá ${manager.name},</p><p>O ciclo de <strong>${sector.name}</strong> foi aberto automaticamente. Revise as datas planejadas e limite no calendário.</p>`,category:'cycle_review',templateData:{managerName:manager.name,sectorName:sector.name,cycleMonth:month}});
        logger.info(`[CycleAutomationWorker] ${company.name}/${sector.name}: ${cycle.month} -> ${month}, ${clones.length} processes`);
    }
}
export const cycleAutomationWorker = new CycleAutomationWorker();
