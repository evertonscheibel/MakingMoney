import { createReportDocument, formatReportNumber } from './reportDocument';
import type { ProcessPerformanceReport } from '../types/processPerformance';
import { monthLabel } from './processPerformance';

export function buildProcessPerformancePDF(data: ProcessPerformanceReport, meta: { companyName: string; sector?: string; search?: string; onlyDrops?: boolean; issuedBy?: string }) {
    const report = createReportDocument({
        title: 'Desempenho de processos', companyName: meta.companyName,
        period: `${monthLabel(data.from)} a ${monthLabel(data.to)}`,
        scope: meta.sector || 'Todos os setores autorizados',
        filters: [meta.search && `Busca: ${meta.search}`, meta.onlyDrops && 'Somente processos com queda na última avaliação'].filter(Boolean).join(' · ') || 'Todos os processos',
        issuedBy: meta.issuedBy,
    });
    report.heading('01  Pontuação por ciclo');
    report.text('Pontuação da entrega em cada ciclo (0 a 100). "—" = sem avaliação no ciclo; não conta como zero. A média usa apenas os ciclos avaliados (n).');
    const showSector = !meta.sector;
    report.table(
        ['Código', 'Processo', ...(showSector ? ['Setor'] : []), ...data.months.map(monthLabel), 'Média', 'n'],
        data.rows.map(row => [
            row.code, row.title, ...(showSector ? [row.sector] : []),
            ...data.months.map(m => row.cells[m]?.score != null ? formatReportNumber(row.cells[m].score!) : '—'),
            row.average != null ? formatReportNumber(row.average) : '—', row.sampleSize,
        ]),
        { right: data.months.map((_, i) => i + (showSector ? 3 : 2)).concat([data.months.length + (showSector ? 3 : 2), data.months.length + (showSector ? 4 : 3)]) },
    );
    return report.finish();
}
