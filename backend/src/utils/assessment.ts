export const assessmentStates = ['AVALIADO', 'PENDENTE', 'SEM_AVALIACAO', 'NAO_APLICAVEL'] as const;
export type AssessmentState = typeof assessmentStates[number];
type AssessmentProcess = { score?: number | null; deliveryDate?: unknown; isActive?: boolean;
    assessmentRequired?: boolean; limitDate: Date | string; nonApplicableReason?: string | null };

export function businessToday(now = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function assessmentState(process: AssessmentProcess, asOf = new Date()): AssessmentState {
    if (typeof process.score === 'number' && Number.isFinite(process.score)) return 'AVALIADO';
    if (process.assessmentRequired === false) return 'NAO_APLICAVEL';
    return new Date(process.limitDate).toISOString().slice(0, 10) < businessToday(asOf) ? 'SEM_AVALIACAO' : 'PENDENTE';
}

export function assessmentIndicators(processes: readonly AssessmentProcess[], asOf = new Date()) {
    let eligibleCount = 0, assessedEligibleCount = 0, pendingAssessmentCount = 0, missingAssessmentCount = 0,
        notApplicableCount = 0, inactiveCount = 0, inconsistentAssessmentCount = 0;
    for (const process of processes) {
        const state = assessmentState(process, asOf);
        const scored = state === 'AVALIADO';
        if ((scored && process.deliveryDate == null) || (!scored && process.deliveryDate != null)
            || (scored && process.assessmentRequired === false)) inconsistentAssessmentCount++;
        if (process.isActive === false) { inactiveCount++; continue; }
        if (process.assessmentRequired === false) { notApplicableCount++; continue; }
        eligibleCount++;
        if (scored) assessedEligibleCount++;
        else if (state === 'PENDENTE') pendingAssessmentCount++;
        else missingAssessmentCount++;
    }
    return { assessmentVersion: 1 as const, eligibleCount, assessedEligibleCount, pendingAssessmentCount, missingAssessmentCount,
        notApplicableCount, inactiveCount, inconsistentAssessmentCount,
        coveragePct: eligibleCount ? Math.round(assessedEligibleCount * 10000 / eligibleCount) / 100 : null };
}

export function assessmentAccumulators() {
    const eligible = { $ne: ['$assessmentRequired', false] };
    const count = (condition: any) => ({ $sum: { $cond: [condition, 1, 0] } });
    return {
        eligibleCount: count(eligible),
        assessedEligibleCount: count({ $and: [eligible, { $isNumber: '$score' }] }),
        pendingAssessmentCount: count({ $and: [eligible, { $eq: [assessmentExpression(), 'PENDENTE'] }] }),
        missingAssessmentCount: count({ $and: [eligible, { $eq: [assessmentExpression(), 'SEM_AVALIACAO'] }] }),
        notApplicableCount: count({ $eq: ['$assessmentRequired', false] }),
    };
}

export function coverageFromTotals(row: any) {
    const eligibleCount = row?.eligibleCount ?? 0, assessedEligibleCount = row?.assessedEligibleCount ?? 0;
    return { assessmentVersion: 1 as const, eligibleCount, assessedEligibleCount,
        pendingAssessmentCount: row?.pendingAssessmentCount ?? 0, missingAssessmentCount: row?.missingAssessmentCount ?? 0,
        notApplicableCount: row?.notApplicableCount ?? 0,
        coveragePct: eligibleCount ? Math.round(assessedEligibleCount * 10000 / eligibleCount) / 100 : null };
}

/** Filtering and display use the same operational calendar-day deadline. */
export function assessmentExpression(asOf = new Date()): any {
    return { $switch: { branches: [
        { case: { $isNumber: '$score' }, then: 'AVALIADO' },
        { case: { $eq: ['$assessmentRequired', false] }, then: 'NAO_APLICAVEL' },
        { case: { $lt: [{ $dateToString: { date: '$limitDate', format: '%Y-%m-%d', timezone: 'UTC' } }, businessToday(asOf)] }, then: 'SEM_AVALIACAO' },
    ], default: 'PENDENTE' } };
}

export function serializeAssessment(process: any, asOf = new Date()) {
    const value = typeof process.toObject === 'function' ? process.toObject() : process;
    return { ...value, assessmentState: assessmentState(value, asOf),
        assessmentEligible: value.isActive !== false && value.assessmentRequired !== false };
}
