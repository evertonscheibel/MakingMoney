const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const monthLabel = (month: string) => `${MONTHS[Number(month.slice(5)) - 1]}/${month.slice(2, 4)}`;

/** Three bands requested in the review meeting: blue = good, yellow = attention, red = critical. */
export type ScoreBand = 'good' | 'attention' | 'critical';
export const scoreBand = (score: number): ScoreBand => score >= 75 ? 'good' : score >= 50 ? 'attention' : 'critical';

export const SCORE_BAND_COLORS: Record<ScoreBand, string> = { good: '#2563eb', attention: '#eab308', critical: '#ef4444' };
export const SCORE_BAND_CLASSES: Record<ScoreBand, string> = {
    good: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
    attention: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200',
    critical: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
};
export const SCORE_BAND_LABELS: Record<ScoreBand, string> = { good: 'Bom (75 a 100)', attention: 'Atenção (50 a 74)', critical: 'Crítico (abaixo de 50)' };
