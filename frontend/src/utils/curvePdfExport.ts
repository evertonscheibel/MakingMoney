import { createReportDocument, reportPeriod, formatReportNumber } from './reportDocument';
import { formatBusinessDate } from './businessDate';

export interface CurveReportData {
    series: { day: number; date: string; planned: number; realized: number; delayed: number; critical: number }[];
    kpis: { totalPlanned: number; deliveredCount: number; onTimePct: number; avgScore: number };
    criticalItems: { code: string; title: string; sector: string; plannedDate: string; limitDate: string; responsible: string }[];
}
export function buildCurvePDF(data: CurveReportData, meta: { companyName: string; period: string; sector?: string; operator?: string; issuedBy?: string; generatedAt?: Date }) {
    const report = createReportDocument({ title: 'Curva de processos', companyName: meta.companyName, period: reportPeriod(meta.period),
        scope: meta.sector || 'Todos os setores autorizados', filters: `Responsável: ${meta.operator || 'Todos os autorizados'}`,
        issuedBy: meta.issuedBy, generatedAt: meta.generatedAt });
    report.heading('01  Indicadores do período');
    report.metrics([
        { label: 'TOTAL PLANEJADO', value: String(data.kpis.totalPlanned) },
        { label: 'ENTREGUES', value: String(data.kpis.deliveredCount) },
        { label: 'NO PRAZO', value: `${formatReportNumber(data.kpis.onTimePct)}%` },
        { label: 'PONTUAÇÃO MÉDIA', value: formatReportNumber(data.kpis.avgScore) },
    ]);
    report.heading('02  Evolução das entregas');
    report.lineChart(data.series);
    report.text('Planejado e realizado são acumulados até cada dia. Atrasados representam a diferença positiva entre planejado e realizado. Críticos incluem processos com limite ultrapassado sem entrega até o dia e entregas realizadas após o limite.');
    report.heading('03  Memória diária');
    report.table(['Dia', 'Planejado acumulado', 'Realizado acumulado', 'Atrasados', 'Críticos'], data.series.map(s => [String(s.day).padStart(2, '0'), s.planned, s.realized, s.delayed, s.critical]), { right: [1, 2, 3, 4] });
    report.heading('04  Processos críticos no período');
    report.table(['Código', 'Processo', 'Setor', 'Responsável', 'Planejado', 'Limite'], data.criticalItems.map(p => [p.code, p.title, p.sector, p.responsible, formatBusinessDate(p.plannedDate), formatBusinessDate(p.limitDate)]), { widths: { 0: 18, 2: 38, 3: 40, 4: 25, 5: 25 } });
    return report.finish();
}
