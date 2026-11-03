export interface ProcessPerformanceCell {
    processId: string;
    score: number | null;
    status: string;
    delivered: boolean;
    plannedDate: string;
    limitDate: string;
    deliveryDate: string | null;
    inactive: boolean;
    notApplicable: boolean;
}

export interface ProcessPerformanceRow {
    key: string;
    sector: string;
    code: string;
    title: string;
    responsible: string | null;
    titleChanged: boolean;
    cells: Record<string, ProcessPerformanceCell>;
    sampleSize: number;
    average: number | null;
    trend: number | null;
}

export interface ProcessPerformanceReport {
    from: string;
    to: string;
    months: string[];
    rows: ProcessPerformanceRow[];
}
