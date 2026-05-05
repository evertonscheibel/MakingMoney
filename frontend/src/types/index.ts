// ==================== ENUMS ====================
export enum UserRole {
    MASTER = 'master',
    MANAGER = 'manager',
    OPERATOR = 'operator'
}

export enum CycleStatus {
    OPEN = 'OPEN',
    CLOSED = 'CLOSED'
}

export enum ProcessStatus {
    PENDING = 'PENDING',
    ON_TIME = 'ON_TIME',
    LATE = 'LATE',
    CRITICAL = 'CRITICAL'
}

export enum DeliverySource {
    EMAIL = 'EMAIL',
    MANUAL = 'MANUAL'
}

export enum DeliveryStatus {
    NOT_DELIVERED = 'NOT_DELIVERED',
    CONFIRMED_PENDING_EMAIL = 'CONFIRMED_PENDING_EMAIL',
    EMAIL_SENT = 'EMAIL_SENT'
}

export enum SMTPSecurityMode {
    NONE = 'NONE',
    STARTTLS = 'STARTTLS',
    SSL_TLS = 'SSL_TLS'
}

// ==================== INTERFACES ====================
export interface Sector {
    name: string;
    managerId?: string | null;
}

export interface User {
    id: string;
    _id?: string;
    name: string;
    email: string;
    roles: UserRole[];
    activeCompanyId: string | null;
    activeCompany?: Company | null;
    companyAccess: { companyId: string; role: UserRole }[];
    isEmailVerified: boolean;
    emailVerificationToken?: string | null;
    allowedMenus: string[];
    position?: string;
    department?: string;
    baseSalary?: number;
    sector?: string;
    sectors?: string[];
    allowedCompanyIds: string[];
}

export interface Company {
    id: string;
    _id?: string;
    name: string;
    cnpj?: string;
    address?: {
        street?: string;
        number?: string;
        city?: string;
        state?: string;
        zipCode?: string;
    };
    contractDuration?: number; // Em meses
    modality?: string; // Ex: 'Mensal', 'Anual', 'Premium'
    sectors: Sector[];
    isActive: boolean;
}

export interface CycleKPIs {
    avgScore: number;
    onTimePct: number;
    criticalCount: number;
    totalProcesses: number;
    avgDeviationDays: number;
}

export interface Cycle {
    _id: string;
    companyId: string;
    sector: string;
    month: string;
    status: CycleStatus;
    openedAt: string;
    closedAt: string | null;
    kpis: CycleKPIs;
    processCounts?: {
        pending: number;
        onTime: number;
        late: number;
        critical: number;
    };
}

export interface Process {
    _id: string;
    companyId: string;
    cycleId: string;
    code: string;
    title: string;
    sector: string;
    owner: string | null;
    plannedDate: string;
    limitDate: string;
    deliveryDate: string | null;
    deliverySource: DeliverySource | null;
    deliveryEvidence: string | null;
    deliveryStatus: DeliveryStatus;
    emailSentAt: string | null;
    revertReason: string | null;
    revertedBy: string | null;
    revertedAt: string | null;
    score: number | null;
    status: ProcessStatus;
    responsibleUserId?: string | { _id: string; name: string } | null;
}

export interface EvaluationRules {
    earlyDeliveryScore: number;
    onTimeScore: number;
    halfwayScore: number;
    lateScore: number;
    criticalScore: number;
    toleranceDays: number;
    notificationEmails: string[];
    bonusCalculationMode: BonusCalculationMode;
}

export interface EvaluationConfig {
    _id: string;
    companyId: string;
    version: number;
    rules: EvaluationRules;
    createdBy: { name: string; email: string } | string;
    createdAt: string;
    isActive: boolean;
    isDefault?: boolean;
}

export interface EmailEvent {
    _id: string;
    companyId: string;
    cycleId: string | null;
    subject: string;
    from: string;
    receivedAt: string;
    matchedCode: string | null;
    matchedProcessId: string | null;
    resultStatus: 'MATCHED' | 'NO_MATCH';
    processedAt: string;
}

// ==================== BONUS ====================

export enum BonusCalculationMode {
    INDIVIDUAL = 'INDIVIDUAL',
    SECTOR = 'SECTOR'
}

export interface BonusReportUser {
    userId: string;
    userName: string;
    sector: string;
    baseSalary: number;
    quarterBase: number;
    avgScore: number;
    processCount: number;
    sectorAvgScore: number;
    sectorQualified: boolean;
    bonusValue: number;
}

export interface BonusSectorSummary {
    name: string;
    avgScore: number;
    processCount: number;
    qualified: boolean;
    userCount: number;
    totalBonus: number;
}

export interface BonusReportResponse {
    quarter: string;
    year: number;
    months: string[];
    sectorMinScore: number;
    calculationMode: BonusCalculationMode;
    users: BonusReportUser[];
    sectors: BonusSectorSummary[];
    summary: {
        totalBonus: number;
        avgScore: number;
        userCount: number;
        qualifiedSectors: number;
        totalSectors: number;
    };
}

// ==================== API RESPONSES ====================

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface LoginResponse {
    token: string;
    user: User;
}

export interface SummaryKPIs {
    cycle: {
        id: string;
        month: string;
        sector: string;
        status: CycleStatus;
    };
    kpis: {
        totalProcesses: number;
        deliveredCount: number;
        pendingCount: number;
        onTimeCount: number;
        lateCount: number;
        criticalCount: number;
        avgScore: number;
        onTimePct: number;
        deliveryPct: number;
    };
}

export interface SectorRanking {
    sector: string;
    totalProcesses: number;
    avgScore: number;
    onTimeCount: number;
    criticalCount: number;
    onTimePct: number;
}

export interface StatusDistribution {
    status: string;
    count: number;
    percentage: number;
}

export interface HistoryPoint {
    month: string;
    avgScore: number;
    onTimePct: number;
    totalProcesses: number;
    criticalCount: number;
}

// ==================== FORM TYPES ====================

export interface LoginForm {
    email: string;
    password: string;
}

export interface ProcessForm {
    code?: string;
    title: string;
    sector: string;
    owner?: string;
    plannedDate: string;
    limitDate: string;
    responsibleUserId?: string;
}

export interface DeliverForm {
    deliveryDate: string;
    deliveryEvidence?: string;
}

export interface SimulateEmailForm {
    subject: string;
    from: string;
    receivedAt?: string;
    body?: string;
}

export interface RegisterForm {
    name: string;
    email: string;
    password: string;
    position: string;
    department: string;
}

