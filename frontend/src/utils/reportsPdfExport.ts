import type { Process, SummaryKPIs } from '../types';
import { formatBusinessDate } from './businessDate';
import { createReportDocument, reportPeriod, formatReportNumber } from './reportDocument';

export interface OperationalReportData {
    companyName: string;
    cycle: string;
    sector?: string;
    status?: string;
    issuedBy?: string;
    generatedAt?: Date;
    summary: Pick<SummaryKPIs, 'kpis'>;
    extract: { bySector: Record<string, Process[]> };
}
const labels: Record<string, string> = { PENDING: 'Pendente', ON_TIME: 'No prazo', LATE: 'Atrasado', CRITICAL: 'Crítico' };
const date = (value?: string | null) => value ? formatBusinessDate(value) : '-';

export function buildDetailedReportPDF(data: OperationalReportData) {
    const report = createReportDocument({
        title: 'Relatório operacional', companyName: data.companyName,
        period: reportPeriod(data.cycle), scope: data.sector || 'Todos os setores autorizados',
        filters: `Status: ${data.status || 'Todos'} | Processos conforme permissão do usuário`,
        issuedBy: data.issuedBy, generatedAt: data.generatedAt,
    });
    const entries = Object.entries(data.extract.bySector).sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
    const total = entries.reduce((sum, [, rows]) => sum + rows.length, 0);
    report.heading('01  Resumo do período');
    report.metrics([
        { label: 'PROCESSOS', value: String(total) },
        { label: 'PONTUAÇÃO MÉDIA', value: formatReportNumber(data.summary.kpis.avgScore) },
        { label: 'NO PRAZO', value: `${formatReportNumber(data.summary.kpis.onTimePct)}%` },
        { label: 'ATRASADOS', value: String(data.summary.kpis.lateCount) },
        { label: 'CRÍTICOS', value: String(data.summary.kpis.criticalCount) },
    ]);
    report.text('Os indicadores correspondem aos filtros selecionados. Pontuação média considera os processos avaliados. Datas operacionais representam o dia de calendário.');
    report.heading('02  Distribuição por setor');
    report.table(['Setor', 'Processos', 'Entregues', 'Pendentes', 'No prazo', 'Atrasados', 'Críticos'], entries.map(([sector, rows]) => [
        sector, rows.length, rows.filter(p => p.deliveryDate).length, rows.filter(p => !p.deliveryDate).length,
        ...['ON_TIME', 'LATE', 'CRITICAL'].map(status => rows.filter(p => p.status === status).length),
    ]), { right: [1, 2, 3, 4, 5, 6] });
    if (!entries.length) report.text('Não existem processos no período e nos filtros selecionados.');
    entries.forEach(([sector, rows], i) => {
        if (i === 0) report.newPage();
        report.heading(`03.${i + 1}  Processos - ${sector}`, `${rows.length} registro(s). Ordenação por data planejada e código.`);
        const ordered = [...rows].sort((a, b) => a.plannedDate.localeCompare(b.plannedDate) || a.code.localeCompare(b.code, 'pt-BR', { numeric: true }));
        report.table(['Código', 'Processo', 'Responsável', 'Planejado', 'Limite', 'Entrega', 'Status', 'Pont.'], ordered.map(p => [
            p.code, p.title, typeof p.responsibleUserId === 'object' && p.responsibleUserId ? p.responsibleUserId.name : p.owner || '-',
            date(p.plannedDate), date(p.limitDate), date(p.deliveryDate), labels[p.status] || p.status, p.score ?? '-',
        ]), { widths: { 0: 17, 2: 37, 3: 23, 4: 23, 5: 23, 6: 23, 7: 13 }, right: [7] });
    });
    return report.finish();
}
