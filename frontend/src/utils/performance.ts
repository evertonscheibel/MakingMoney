import type { PerformanceIndicators } from '../types';

export const formatPerformanceAverage = (value: number | null | undefined) =>
    typeof value === 'number' && Number.isFinite(value)
        ? value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : 'Sem dados';

export const performanceSampleLabel = (data?: Partial<PerformanceIndicators>) =>
    data?.validScoreCount == null ? 'Amostra indisponível'
        : `n=${data.validScoreCount}${data.validScoreCount === 1 ? ' · Amostra reduzida' : ''}`;

export const deliveryRatioLabel = (data?: Partial<PerformanceIndicators>) =>
    data?.activeProcessCount == null ? 'Entregas: sem dados'
        : `Entregas: ${data.deliveredCount ?? 0}/${data.activeProcessCount} processos ativos (${data.deliveryRatePct == null ? 'sem dados' : `${formatPerformanceAverage(data.deliveryRatePct)}%`})`;

export const coverageLabel = (data?: Partial<PerformanceIndicators>) => data?.eligibleCount == null
    ? 'Cobertura de avaliações indisponível'
    : `Cobertura de avaliações: ${data.assessedEligibleCount ?? 0}/${data.eligibleCount} (${data.coveragePct == null ? 'sem dados' : `${formatPerformanceAverage(data.coveragePct)}%`}). Não aplicáveis e inativos ficam fora do denominador.`;
