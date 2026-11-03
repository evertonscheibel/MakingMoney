import type { Process } from '../types';
import { assessmentLabels, processAssessmentState } from '../utils/assessment';

export default function AssessmentBadge({ process }: { process: Process }) {
    const state = processAssessmentState(process);
    const color = { AVALIADO: 'text-green-800 bg-green-50', PENDENTE: 'text-amber-800 bg-amber-50',
        SEM_AVALIACAO: 'text-red-800 bg-red-50', NAO_APLICAVEL: 'text-gray-700 bg-gray-100' }[state];
    return <span className={`inline-flex rounded px-2 py-1 text-xs ${color}`} title={process.isActive === false
        ? 'Processo inativo: fora da cobertura. Estado de avaliação preservado.'
        : process.nonApplicableReason || 'Prazo da avaliação: fim da data limite, no calendário de Cuiabá. Nota e envio de e-mail são indicadores separados.'}>
        {assessmentLabels[state]}
    </span>;
}
