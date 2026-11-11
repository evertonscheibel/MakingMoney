import type { Process } from '../types';
export type AssessmentState = 'AVALIADO' | 'PENDENTE' | 'SEM_AVALIACAO' | 'NAO_APLICAVEL';
export const assessmentLabels: Record<AssessmentState, string> = {
    AVALIADO: 'Avaliado', PENDENTE: 'Avaliação pendente', SEM_AVALIACAO: 'Sem avaliação (vencida)', NAO_APLICAVEL: 'Não aplicável',
};
export function processAssessmentState(process: Process): AssessmentState {
    if (process.assessmentState) return process.assessmentState;
    if (typeof process.score === 'number') return 'AVALIADO';
    if (process.assessmentRequired === false) return 'NAO_APLICAVEL';
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    return process.limitDate.slice(0, 10) < today ? 'SEM_AVALIACAO' : 'PENDENTE';
}
