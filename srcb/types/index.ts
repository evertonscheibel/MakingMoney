import { Types } from 'mongoose';

// ==================== ENUMS ====================
export enum UserRole {
    MASTER = 'master',
    MANAGER = 'manager',
    OPERATOR = 'operator'
}

export interface ICompanyAccess {
    companyId: Types.ObjectId;
    role: UserRole;
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

export enum AuditAction {
    CREATE = 'CREATE',
    UPDATE = 'UPDATE',
    DELETE = 'DELETE',
    CLOSE_CYCLE = 'CLOSE_CYCLE',
    REOPEN_CYCLE = 'REOPEN_CYCLE',
    EMAIL_DELIVERY = 'EMAIL_DELIVERY',
    REVERT_DELIVERY = 'REVERT_DELIVERY'
}

export enum EntityType {
    PROCESS = 'process',
    CYCLE = 'cycle',
    COMPANY = 'company',
    CONFIG = 'config',
    USER = 'user'
}

export enum EmailEventStatus {
    MATCHED = 'MATCHED',
    NO_MATCH = 'NO_MATCH'
}

export interface ISector {
    name: string;
    managerId?: Types.ObjectId | string;
}

// ==================== INTERFACES ====================

export interface IUser {
    _id: Types.ObjectId;
    name: string;
    email: string;
    passwordHash: string;
    roles: UserRole[]; // Global/System roles (optional usage now, or legacy)
    companyAccess: ICompanyAccess[]; // Per-company roles
    activeCompanyId: Types.ObjectId | null;
    isEmailVerified: boolean;
    emailVerificationToken?: string | null;
    emailVerificationExpires?: Date | null;
    resetPasswordToken?: string | null;
    resetPasswordExpires?: Date | null;
    allowedMenus: string[];
    position?: string;
    department?: string;
    sector?: string;
    sectors?: string[];
    createdAt: Date;
    updatedAt: Date;
}

export interface ICompany {
    _id: Types.ObjectId;
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
    sectors: ISector[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface ICycleKPIs {
    avgScore: number;
    onTimePct: number;
    criticalCount: number;
    totalProcesses: number;
    avgDeviationDays: number;
}

export interface ICycle {
    _id: Types.ObjectId;
    companyId: Types.ObjectId;
    sector: string;
    month: string; // 'YYYY-MM' format
    status: CycleStatus;
    openedAt: Date;
    closedAt: Date | null;
    kpis: ICycleKPIs;
}

export interface IProcess {
    _id: Types.ObjectId;
    companyId: Types.ObjectId;
    cycleId: Types.ObjectId;
    code: string;
    title: string;
    sector: string;
    owner: string | null;
    plannedDate: Date;
    limitDate: Date;
    deliveryDate: Date | null;
    deliverySource: DeliverySource | null;
    deliveryEvidence: string | null;
    deliveryStatus: DeliveryStatus;
    emailSentAt: Date | null;
    revertReason: string | null;
    revertedBy: Types.ObjectId | null;
    revertedAt: Date | null;
    score: number | null;
    status: ProcessStatus;
    responsibleUserId: Types.ObjectId | null;
    isActive?: boolean;
}

export interface IEvaluationRules {
    earlyDeliveryScore: number;
    onTimeScore: number;
    halfwayScore: number;
    lateScore: number;
    criticalScore: number;
    toleranceDays: number;
    notificationEmails: string[];
}

export interface IEvaluationConfig {
    _id: Types.ObjectId;
    companyId: Types.ObjectId;
    version: number;
    rules: IEvaluationRules;
    createdBy: Types.ObjectId;
    createdAt: Date;
    isActive: boolean;
}

export interface IAuditLog {
    _id: Types.ObjectId;
    companyId: Types.ObjectId;
    actorUserId: Types.ObjectId;
    action: AuditAction;
    entityType: EntityType;
    entityId: Types.ObjectId;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    meta?: { ip?: string; userAgent?: string } | null;
    createdAt: Date;
}

export interface IEmailEvent {
    _id: Types.ObjectId;
    companyId: Types.ObjectId;
    cycleId: Types.ObjectId | null;
    subject: string;
    from: string;
    receivedAt: Date;
    matchedCode: string | null;
    matchedProcessId: Types.ObjectId | null;
    resultStatus: EmailEventStatus;
    processedAt: Date;
    rawPayload: Record<string, unknown>;
}

// ==================== DTOs ====================

export interface LoginDTO {
    email: string;
    password: string;
}

export interface RegisterDTO {
    name: string;
    email: string;
    password: string;
    position?: string;
    department?: string;
    sector?: string;
    roles?: UserRole[];
    companyAccess?: { companyId: string; role: UserRole }[];
}

export interface CreateCompanyDTO {
    name: string;
    cnpj?: string;
    address?: ICompany['address'];
    contractDuration?: number;
    modality?: string;
    sectors?: string[];
}

export interface UpdateCompanyDTO {
    name?: string;
    cnpj?: string;
    address?: ICompany['address'];
    contractDuration?: number;
    modality?: string;
    sectors?: string[];
    isActive?: boolean;
}

export interface OpenCycleDTO {
    month: string; // 'YYYY-MM'
    sector: string;
}

export interface CreateProcessDTO {
    code: string;
    title: string;
    sector: string;
    owner?: string;
    plannedDate: string; // ISO date
    limitDate: string; // ISO date
    responsibleUserId?: string;
}

export interface UpdateProcessDTO {
    code?: string;
    title?: string;
    sector?: string;
    owner?: string;
    plannedDate?: string;
    limitDate?: string;
    responsibleUserId?: string;
}

export interface DeliverProcessDTO {
    deliveryDate: string; // ISO date
    deliveryEvidence?: string;
}

export interface CreateEvaluationConfigDTO {
    rules: IEvaluationRules;
}

export interface SimulateEmailDTO {
    subject: string;
    from: string;
    receivedAt?: string;
    body?: string;
}

export interface AIChatDTO {
    message: string;
    context?: {
        cycleId?: string;
        includeKPIs?: boolean;
    };
}

// ==================== REQUEST EXTENSIONS ====================

export interface AuthenticatedUser {
    userId: string;
    email: string;
    roles: UserRole[];
    activeCompanyId: string | null;
    companyAccess: { companyId: string; role: string }[];
    position?: string;
    department?: string;
    sector?: string;
    sectors?: string[];
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthenticatedUser;
            companyId?: string;
        }
    }
}

// ==================== SCORING ====================

export interface ScoreResult {
    score: number;
    status: ProcessStatus;
}

// ==================== API RESPONSE ====================

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

