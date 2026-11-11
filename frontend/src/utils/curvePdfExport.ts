import { createReportDocument, reportPeriod, formatReportNumber } from './reportDocument';
import { formatBusinessDate } from './businessDate';
import type { PerformanceIndicators } from '../types';
import { formatPerformanceAverage, performanceSampleLabel, deliveryRatioLabel, coverageLabel } from './performance';

export interface CurveReportData {
    asOf: string;
    deliveryBreakdown: { key: string; label: string; count: number }[];
    riskBySector: { sector: string; delayedOpen: number; overdueOpen: number }[];
    series: { day: number; date: string; planned: number; realized: number; delayed: number; critical: number; delayedOpen: number; overdueOpen: number }[];
    kpis: PerformanceIndicators & { totalPlanned: number; onTimePct: number; avgScore: number };
    criticalItems: { id: string; code: string; title: string; sector: string; plannedDate: string; limitDate: string; deliveryDate: string | null; responsible: string }[];
}
export function buildCurvePDF(data: CurveReportData, meta: { companyName: string; period: string; sector?: string; operator?: string; issuedBy?: string; generatedAt?: Date }) {
    const report = createReportDocument({ title: 'Curva de processos', companyName: meta.companyName, period: reportPeriod(meta.period),
        scope: meta.sector || 'Todos os setores autorizados', filters: `Responsável: ${meta.operator || 'Todos os autorizados'}`,
        issuedBy: meta.issuedBy, generatedAt: meta.generatedAt });
    report.heading('01  Indicadores do período');
    const timely = data.deliveryBreakdown.filter(band => ['EARLY', 'ON_PLANNED'].includes(band.key))
        .reduce((sum, band) => sum + band.count, 0);
    const timelyPct = data.kpis.deliveredCount ? `${formatReportNumber(timely * 100 / data.kpis.deliveredCount)}%` : '—';
    report.metrics([
        { label: 'TOTAL PLANEJADO', value: String(data.kpis.totalPlanned) },
        { label: 'ENTREGUES', value: String(data.kpis.deliveredCount) },
        { label: 'ATÉ A DATA PLANEJADA', value: timelyPct },
        { label: 'PONTUAÇÃO MÉDIA', value: formatPerformanceAverage(data.kpis.performanceAverage) },
    ]);
    report.text(`Pontualidade: ${timely} de ${data.kpis.deliveredCount} entregas até a data planejada.`);
    report.text(`${performanceSampleLabel(data.kpis)}. ${deliveryRatioLabel(data.kpis)}.`);
    report.text(coverageLabel(data.kpis));
    if (data.deliveryBreakdown) {
        report.heading('02  Entregas por status');
        report.table(['Status da entrega', 'Processos'], data.deliveryBreakdown.map(b => [b.label, b.count]), { right: [1] });
        report.text('Cada processo do mês aparece uma vez, pela data da entrega em relação à data planejada e ao limite.');
    }
    report.heading('03  Evolução das entregas');
    const observed = data.series.filter(day => day.date <= data.asOf);
    if (observed.length) report.lineChart(observed);
    report.text(`Dados observados até ${formatBusinessDate(data.asOf)}. O atraso em aberto começa no dia seguinte ao planejado e o limite vencido começa no dia seguinte ao limite.`);
    report.heading('04  Memória diária');
    report.table(['Dia', 'Planejado acumulado', 'Realizado acumulado', 'Após o planejado', 'Limite vencido'], data.series.map(s => [
        String(s.day).padStart(2, '0'), s.planned, s.date <= data.asOf ? s.realized : '—',
        s.date <= data.asOf ? s.delayedOpen : '—', s.date <= data.asOf ? s.overdueOpen : '—',
    ]), { right: [1, 2, 3, 4] });
    report.heading('05  Processos com limite ultrapassado');
    report.table(['Código', 'Processo', 'Setor', 'Responsável', 'Planejado', 'Limite', 'Entrega'], data.criticalItems.map(p => [
        p.code, p.title, p.sector, p.responsible, formatBusinessDate(p.plannedDate), formatBusinessDate(p.limitDate),
        p.deliveryDate ? formatBusinessDate(p.deliveryDate) : 'Sem entrega',
    ]), { widths: { 0: 18, 2: 32, 3: 35, 4: 24, 5: 24, 6: 25 } });
    return report.finish();
}
