import type { AssessmentState, CycleStatus, PerformanceIndicators } from './index';
export interface EvolutionPoint extends PerformanceIndicators {
    period: string; months: string[]; observedMonths: number; partial: boolean; hasData: boolean;
    inactiveCount: number; newProcessCount: number | null; transferCount: number | null;
    processVolumeDelta: number | null; deltaPoints: number | null;
}
export interface EvolutionRecord {
    id: string; code: string; title: string; month: string; sector: string; lineageId: string | null;
    responsibleId: string | null; responsible: string; attributionQuality: string;
}
export interface EvolutionReport {
    from: string; to: string; groupBy: string; series: EvolutionPoint[];
    categories: string[]; records: EvolutionRecord[];
    processOptions?: Pick<EvolutionRecord, 'id' | 'code' | 'title' | 'month' | 'sector'>[];
    processCycles?: { id: string; month: string; sector: string; cycleStatus: CycleStatus;
        plannedDate: string; limitDate: string; deliveryDate: string | null; score: number | null;
        isActive: boolean; assessment: AssessmentState; coveragePct: number | null }[];
    comparison: null | { from: string; to: string; equivalent: boolean; commonProcessCount: number;
        previous: PerformanceIndicators; current: PerformanceIndicators; deltaPoints: number | null;
        compositionChanged: boolean; partialPeriods: boolean;
        excluded: { processId: string; code: string; title: string; period: string; reason: string }[] };
    events: { id: string; type: string; occurredAt: string; author: string; description: string;
        source: string; sector?: string; reference?: string }[];
    warnings: { unconfirmedLineageCount: number; legacyResponsibilityCount: number;
        eventsTruncated: boolean; source: string; deadlinePolicy: string };
}
