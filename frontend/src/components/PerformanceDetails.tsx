import type { PerformanceIndicators } from '../types';
import { deliveryRatioLabel, performanceSampleLabel } from '../utils/performance';

export default function PerformanceDetails({ indicators }: { indicators?: Partial<PerformanceIndicators> }) {
    return <div className="mt-2 space-y-1 text-xs text-gray-500 dark:text-gray-400">
        <p>{performanceSampleLabel(indicators)}</p>
        <p>{deliveryRatioLabel(indicators)}</p>
        {indicators?.eligibleCount != null && <p>Cobertura de avaliações: {indicators.assessedEligibleCount ?? 0}/{indicators.eligibleCount} ({indicators.coveragePct == null ? 'sem dados' : `${indicators.coveragePct.toLocaleString('pt-BR')}%`})</p>}
        {!!indicators?.inconsistentAssessmentCount && <p role="alert">{indicators.inconsistentAssessmentCount} registro(s) com nota/entrega inconsistente(s). Conferir dados.</p>}
    </div>;
}
