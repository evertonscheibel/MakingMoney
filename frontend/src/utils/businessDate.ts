/** Operational dates represent calendar days, regardless of the browser timezone. */
export function formatBusinessDate(value: string | Date) {
    return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}
