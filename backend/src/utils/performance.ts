/** Version 1: valid numeric scores only; delivery ratio uses all active processes. */
export interface PerformanceIndicators {
    aggregationVersion: 1;
    scoreSum: number;
    validScoreCount: number;
    performanceAverage: number | null;
    activeProcessCount: number;
    deliveredCount: number;
    deliveryRatePct: number | null;
}

const round = (value: number) => Math.round(value * 100) / 100;

export function performanceFromTotals(totals: {
    scoreSum: number; validScoreCount: number; activeProcessCount: number; deliveredCount: number;
}): PerformanceIndicators {
    return {
        ...totals,
        aggregationVersion: 1,
        performanceAverage: totals.validScoreCount ? round(totals.scoreSum / totals.validScoreCount) : null,
        deliveryRatePct: totals.activeProcessCount ? round(totals.deliveredCount * 100 / totals.activeProcessCount) : null,
    };
}

export function calculatePerformance(processes: readonly {
    score?: number | null; deliveryDate?: unknown; isActive?: boolean;
}[]): PerformanceIndicators {
    const totals = { scoreSum: 0, validScoreCount: 0, activeProcessCount: 0, deliveredCount: 0 };
    for (const process of processes) {
        if (process.isActive === false) continue;
        totals.activeProcessCount++;
        if (process.deliveryDate != null) totals.deliveredCount++;
        if (typeof process.score === 'number' && Number.isFinite(process.score)) {
            totals.scoreSum += process.score;
            totals.validScoreCount++;
        }
    }
    return performanceFromTotals(totals);
}

/** Use after matching active processes and the authorized company/sector/user. */
export function performanceAccumulators() {
    return {
        scoreSum: { $sum: '$score' },
        validScoreCount: { $sum: { $cond: [{ $isNumber: '$score' }, 1, 0] } },
        activeProcessCount: { $sum: 1 },
        deliveredCount: { $sum: { $cond: [{ $ne: [{ $ifNull: ['$deliveryDate', null] }, null] }, 1, 0] } },
    };
}
