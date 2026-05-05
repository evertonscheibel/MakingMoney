/**
 * Extract process code from email subject
 * Matches patterns like: FIN-005, RH-012, TI-001
 */
export function extractProcessCode(subject: string): string | null {
    const pattern = /\b([A-Z]{2,5}-\d{3,5})\b/i;
    const match = subject.match(pattern);
    return match ? match[1].toUpperCase() : null;
}

/**
 * Format date to ISO string (YYYY-MM-DD)
 */
export function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

/**
 * Parse date from various formats
 */
export function parseDate(dateStr: string): Date {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        throw new Error(`Invalid date format: ${dateStr}`);
    }
    return date;
}

/**
 * Get first day of month
 */
export function getFirstDayOfMonth(month: string): Date {
    return new Date(`${month}-01T00:00:00.000Z`);
}

/**
 * Get last day of month
 */
export function getLastDayOfMonth(month: string): Date {
    const [year, m] = month.split('-').map(Number);
    // Get first day of next month, subtract 1 day
    const nextMonth = m === 12 ? new Date(year + 1, 0, 1) : new Date(year, m, 1);
    nextMonth.setDate(nextMonth.getDate() - 1);
    return nextMonth;
}

/**
 * Check if date is within month
 */
export function isDateInMonth(date: Date, month: string): boolean {
    const dateMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return dateMonth === month;
}

/**
 * Normalize sector name for comparison
 */
export function normalizeSector(sector: string): string {
    return sector.trim().toLowerCase();
}

/**
 * Generate a unique process code
 */
export function generateProcessCode(sector: string, sequence: number): string {
    const sectorCode = sector.substring(0, 3).toUpperCase();
    return `${sectorCode}-${String(sequence).padStart(3, '0')}`;
}

/**
 * Sanitize string for safe storage
 */
export function sanitize(str: string): string {
    return str.trim().replace(/[<>]/g, '');
}

/**
 * Calculate percentage
 */
export function calculatePercentage(part: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((part / total) * 100 * 100) / 100;
}

/**
 * Calculate average
 */
export function calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const sum = numbers.reduce((acc, n) => acc + n, 0);
    return Math.round((sum / numbers.length) * 100) / 100;
}

