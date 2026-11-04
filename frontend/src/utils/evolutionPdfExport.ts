import type { EvolutionReport } from '../types/evolution';
import { createReportDocument } from './reportDocument';
import { formatPerformanceAverage, performanceSampleLabel } from './performance';
import { formatEventDate } from './evolutionDates';

export function buildEvolutionPDF(data: EvolutionReport, companyName: string, scope: string, issuedBy?: string) {
    const report = createReportDocument({ title: 'Evolução de desempenho', companyName,
        period: `${data.from} a ${data.to}`, scope, issuedBy });
    report.heading('01  Série por competência');
    report.text('Média das notas válidas, incluindo zero. Cobertura: notas válidas em processos ativos e aplicáveis / processos ativos e aplicáveis. Sem dados não é zero. Inclusões e transferências abaixo usam a data do evento registrado; não indicam causalidade.');
    report.table(['Período', 'Média', 'n', 'Meses avaliados', 'Cobertura', 'Ativos', 'Exigíveis', 'Entregues', 'Inclusões', 'Transferências', 'Situação'], data.series.map(p => [
        p.period, formatPerformanceAverage(p.performanceAverage), p.validScoreCount, p.observedMonths,
        p.coveragePct == null ? 'Sem dados' : `${p.coveragePct}%`, p.activeProcessCount, p.eligibleCount ?? '-',
        p.deliveredCount, p.newProcessCount ?? 'Limitado', p.transferCount ?? 'Limitado', !p.hasData ? 'Sem registros' : p.partial ? 'Parcial' : 'Encerrado',
    ]));
    if (data.comparison) {
        const c = data.comparison;
        report.heading('02  Comparação', `${c.from} para ${c.to}; ${c.equivalent ? 'carteira equivalente' : 'carteira total'}`);
        report.text(`Anterior: ${formatPerformanceAverage(c.previous.performanceAverage)} (${performanceSampleLabel(c.previous)}). Atual: ${formatPerformanceAverage(c.current.performanceAverage)} (${performanceSampleLabel(c.current)}). Variação: ${c.deltaPoints == null ? 'sem dados' : `${c.deltaPoints > 0 ? '+' : ''}${c.deltaPoints} pontos na escala 0–100`}. Carteira comum: ${c.commonProcessCount} processos.`);
        if (c.compositionChanged || c.partialPeriods) report.text('A composição da carteira mudou ou há períodos parciais. Considere as exclusões e a amostra antes de comparar.');
        report.table(['Período', 'Código', 'Processo excluído da carteira comum', 'Motivo'], c.excluded.map(p => [p.period, p.code, p.title, p.reason]));
    }
    report.heading('03  Eventos e marcos registrados');
    report.table(['Data', 'Tipo', 'Setor', 'Descrição', 'Autor', 'Fonte'], data.events.map(e => [formatEventDate(e.occurredAt), e.type, e.sector || 'Empresa', e.description, e.author, e.source]));
    report.text(`Identidades históricas não confirmadas: ${data.warnings.unconfirmedLineageCount}. Notas com responsabilidade legada: ${data.warnings.legacyResponsibilityCount}. Série reconstruída dos documentos por ciclo; snapshots financeiros/históricos não foram regravados.`);
    if (data.warnings.eventsTruncated) report.text('Lista de eventos limitada: reduza o intervalo para consultar os demais.');
    return report.finish();
}
