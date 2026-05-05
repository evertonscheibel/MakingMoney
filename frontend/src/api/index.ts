import { api, apiCall } from './client';
import type {
    User,
    Company,
    Cycle,
    Process,
    EvaluationConfig,
    EmailEvent,
    LoginResponse,
    SummaryKPIs,
    SectorRanking,
    StatusDistribution,
    HistoryPoint,
    ProcessForm,
    DeliverForm,
    EvaluationRules,
    SimulateEmailForm,
    PaginatedResponse,
    RegisterForm,
    BonusReportResponse,
} from '../types';

// ==================== AUTH ====================

export const authApi = {
    login: async (email: string, password: string): Promise<LoginResponse> => {
        const response = await api.post<{ success: boolean; data: LoginResponse }>('/auth/login', { email, password });
        return response.data.data;
    },

    register: async (data: RegisterForm): Promise<{ success: boolean; message: string }> => {
        return apiCall('post', '/auth/register', data);
    },

    verifyEmail: async (email: string, code: string): Promise<{ success: boolean; message: string }> => {
        return apiCall('post', '/auth/verify-email', { email, code });
    },

    resendVerificationCode: async (email: string): Promise<{ success: boolean; message: string }> => {
        return apiCall('post', '/auth/resend-verification', { email });
    },

    forgotPassword: async (email: string): Promise<{ success: boolean; message: string }> => {
        return apiCall('post', '/auth/forgot-password', { email });
    },

    resetPassword: async (token: string, password: string): Promise<{ success: boolean; message: string }> => {
        return apiCall('post', `/auth/reset-password/${token}`, { password });
    },

    me: async (): Promise<User> => {
        return apiCall<User>('get', '/auth/me');
    },

    switchCompany: async (companyId: string): Promise<{ activeCompanyId: string; activeCompany: Company }> => {
        return apiCall('put', `/auth/switch-company/${companyId}`);
    },
};

// ==================== COMPANIES ====================

export const companiesApi = {
    list: async (): Promise<Company[]> => {
        return apiCall<Company[]>('get', '/companies');
    },

    get: async (id: string): Promise<Company> => {
        return apiCall<Company>('get', `/companies/${id}`);
    },

    create: async (data: {
        name: string;
        cnpj?: string;
        address?: {
            street?: string;
            number?: string;
            city?: string;
            state?: string;
            zipCode?: string;
        };
        contractDuration?: number;
        modality?: string;
        sectors?: any[];
    }): Promise<Company> => {
        return apiCall<Company>('post', '/companies', data);
    },

    update: async (id: string, data: Partial<Company>): Promise<Company> => {
        return apiCall<Company>('put', `/companies/${id}`, data);
    },

    delete: async (id: string): Promise<void> => {
        return apiCall<void>('delete', `/companies/${id}`);
    },

    addSector: async (id: string, data: { sector: string; managerId: string | null }): Promise<Company> => {
        return apiCall<Company>('post', `/companies/${id}/sectors`, data);
    },

    updateSector: async (companyId: string, sectorId: string, data: { name: string; managerId: string | null }): Promise<Company> => {
        return apiCall<Company>('put', `/companies/${companyId}/sectors/${sectorId}`, data);
    },

    deleteSector: async (companyId: string, sectorId: string): Promise<Company> => {
        return apiCall<Company>('delete', `/companies/${companyId}/sectors/${sectorId}`);
    },
};

// ==================== CYCLES ====================

export const cyclesApi = {
    list: async (params?: { month?: string; status?: string; sector?: string }): Promise<Cycle[]> => {
        return apiCall<Cycle[]>('get', '/cycles', params);
    },

    getCurrent: async (sector?: string): Promise<Cycle | null> => {
        return apiCall<Cycle | null>('get', '/cycles/current', { sector });
    },

    get: async (id: string): Promise<Cycle> => {
        return apiCall<Cycle>('get', `/cycles/${id}`);
    },

    reset: async (id: string): Promise<{ success: boolean; message: string }> => {
        return apiCall('post', `/cycles/${id}/reset`);
    },

    restore: async (id: string): Promise<{ success: boolean; message: string }> => {
        return apiCall('post', `/cycles/${id}/restore`);
    },

    reopen: async (id: string): Promise<{ success: boolean; message: string }> => {
        return apiCall('post', `/cycles/${id}/reopen`);
    },

    checkRestorePoint: async (id: string): Promise<{ hasRestorePoint: boolean }> => {
        return apiCall('get', `/cycles/${id}/restore-point`);
    },

    open: async (month: string, sector: string): Promise<Cycle> => {
        return apiCall<Cycle>('post', '/cycles/open', { month, sector });
    },

    previewClose: async (sector?: string): Promise<{
        currentCycle: Cycle;
        nextMonth: string;
        processes: any[];
    }> => {
        return apiCall('get', '/cycles/preview-close', { sector });
    },

    close: async (overrides?: any[], openNext: boolean = true, sector?: string): Promise<{ closedCycle: Cycle; newCycle: Cycle | null; clonedProcessCount: number; message?: string }> => {
        return apiCall('post', '/cycles/close', { overrides, openNext, sector });
    },
};

// ==================== PROCESSES ====================

export const processesApi = {
    list: async (params?: {
        cycleId?: string;
        sector?: string;
        status?: string;
        search?: string;
        responsibleUserId?: string;
        page?: number;
        limit?: number;
    }): Promise<PaginatedResponse<Process>> => {
        const response = await api.get<PaginatedResponse<Process>>('/processes', { params });
        return response.data;
    },

    get: async (id: string): Promise<Process> => {
        return apiCall<Process>('get', `/processes/${id}`);
    },

    create: async (data: ProcessForm): Promise<Process> => {
        return apiCall<Process>('post', '/processes', data);
    },

    update: async (id: string, data: Partial<ProcessForm>): Promise<Process> => {
        return apiCall<Process>('put', `/processes/${id}`, data);
    },

    deliver: async (id: string, data: DeliverForm): Promise<Process> => {
        return apiCall<Process>('put', `/processes/${id}/deliver`, data);
    },

    delete: async (id: string): Promise<void> => {
        return apiCall<void>('delete', `/processes/${id}`);
    },

    // NEW: Confirm delivery without email
    confirmDelivery: async (id: string, data: DeliverForm): Promise<Process> => {
        return apiCall<Process>('post', `/processes/${id}/confirm-delivery`, data);
    },

    // NEW: Send delivery email (after confirmation)
    sendDeliveryEmail: async (id: string): Promise<Process> => {
        return apiCall<Process>('post', `/processes/${id}/send-delivery-email`);
    },

    // NEW: Revert delivery
    revertDelivery: async (id: string, reason: string): Promise<Process> => {
        return apiCall<Process>('post', `/processes/${id}/revert-delivery`, { reason });
    },

    importProcesses: async (file: File, data: { sector: string; plannedDate: string; limitDate: string; responsibleUserId?: string }): Promise<any> => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('sector', data.sector);
        formData.append('plannedDate', data.plannedDate);
        formData.append('limitDate', data.limitDate);
        if (data.responsibleUserId) {
            formData.append('responsibleUserId', data.responsibleUserId);
        }

        const response = await api.post('/import/processes', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },
};

// ==================== REPORTS ====================

export const reportsApi = {
    getSummary: async (cycleId?: string, sector?: string, period?: string, status?: string): Promise<SummaryKPIs> => {
        return apiCall<SummaryKPIs>('get', '/reports/summary', { cycleId, sector, period, status });
    },

    getSectorRanking: async (cycleId?: string, sector?: string, period?: string, status?: string): Promise<{ cycleMonth: string; ranking: SectorRanking[] }> => {
        return apiCall('get', '/reports/sector-ranking', { cycleId, sector, period, status });
    },

    getStatusDistribution: async (cycleId?: string, sector?: string, period?: string, status?: string): Promise<{
        cycleMonth: string;
        total: number;
        distribution: StatusDistribution[];
    }> => {
        return apiCall('get', '/reports/status-distribution', { cycleId, sector, period, status });
    },

    getExtract: async (cycleId?: string, sector?: string, period?: string, status?: string): Promise<{
        cycle: { id: string; month: string; status: string };
        totalProcesses: number;
        bySector: Record<string, Process[]>;
        generatedAt: string;
    }> => {
        return apiCall('get', '/reports/extract', { cycleId, sector, period, status });
    },

    getHistory: async (): Promise<HistoryPoint[]> => {
        return apiCall<HistoryPoint[]>('get', '/reports/history');
    },

    getProcessCurve: async (params: { period: string; sector?: string; userId?: string }): Promise<{
        series: any[];
        kpis: any;
        criticalItems: any[];
    }> => {
        return apiCall('get', '/reports/process-curve', params);
    },
};

// ==================== EVALUATION ====================

export const evaluationApi = {
    getActive: async (): Promise<EvaluationConfig> => {
        return apiCall<EvaluationConfig>('get', '/evaluation/active');
    },

    getHistory: async (): Promise<EvaluationConfig[]> => {
        return apiCall<EvaluationConfig[]>('get', '/evaluation/history');
    },

    create: async (rules: EvaluationRules): Promise<EvaluationConfig> => {
        return apiCall<EvaluationConfig>('post', '/evaluation', { rules });
    },

    simulate: async (data: {
        plannedDate: string;
        limitDate: string;
        deliveryDate: string;
        rules?: EvaluationRules;
    }): Promise<{
        plannedDate: string;
        limitDate: string;
        deliveryDate: string;
        rules: EvaluationRules;
        result: { score: number; status: string };
    }> => {
        return apiCall('post', '/evaluation/simulate', data);
    },
};

// ==================== EMAIL ====================

export const emailApi = {
    simulate: async (data: SimulateEmailForm): Promise<{
        emailEvent: EmailEvent;
        matched: boolean;
        matchedProcess: { id: string; code: string; title: string; score: number; status: string } | null;
    }> => {
        return apiCall('post', '/email-events/simulate', data);
    },

    list: async (page = 1, limit = 20): Promise<PaginatedResponse<EmailEvent>> => {
        const response = await api.get<PaginatedResponse<EmailEvent>>('/email-events', {
            params: { page, limit },
        });
        return response.data;
    },
};

// ==================== USERS ====================

export const usersApi = {
    list: async (): Promise<User[]> => {
        return apiCall<User[]>('get', '/users');
    },

    update: async (id: string, data: Partial<User>): Promise<User> => {
        return apiCall<User>('put', `/users/${id}`, data);
    },

    delete: async (id: string): Promise<void> => {
        return apiCall<void>('delete', `/users/${id}`);
    },
};

// ==================== AI ====================

export const aiApi = {
    chat: async (message: string, context?: { cycleId?: string; includeKPIs?: boolean }): Promise<{
        message: string;
        model: string;
    }> => {
        return apiCall('post', '/ai/chat', { message, context });
    },
};

// ==================== SETTINGS ====================

export const settingsApi = {
    email: {
        get: async (): Promise<any> => {
            return apiCall<any>('get', '/settings/email');
        },

        update: async (data: any): Promise<any> => {
            return apiCall<any>('put', '/settings/email', data);
        },

        test: async (data: any): Promise<{ success: boolean; message: string }> => {
            return apiCall('post', '/settings/email/test', data);
        },
    },
};

// ==================== LOGS ====================

export const logsApi = {
    listAuditLogs: async (params?: {
        entityType?: string;
        entityId?: string;
        actorUserId?: string;
        startDate?: string;
        endDate?: string;
        page?: number;
        limit?: number;
    }): Promise<PaginatedResponse<any>> => {
        const response = await api.get<PaginatedResponse<any>>('/logs/audit', { params });
        return response.data;
    },

    listEmailLogs: async (params?: {
        processId?: string;
        status?: string;
        startDate?: string;
        endDate?: string;
        page?: number;
        limit?: number;
    }): Promise<PaginatedResponse<any>> => {
        const response = await api.get<PaginatedResponse<any>>('/logs/email', { params });
        return response.data;
    },

    getProcessLogs: async (processId: string): Promise<{
        auditLogs: any[];
        emailLogs: any[];
        lastEmailSent: any | null;
    }> => {
        return apiCall('get', `/logs/process/${processId}`);
    },
};

// ==================== METRICS ====================

export const metricsApi = {
    getMyMetrics: async (period?: string, cycleId?: string): Promise<{ averageScore: number; count: number }> => {
        return apiCall('get', '/metrics/me', { period, cycleId });
    },

    getTeamMetrics: async (period?: string, cycleId?: string): Promise<{ averageScore: number; count: number }> => {
        return apiCall('get', '/metrics/team', { period, cycleId });
    },
};

// ==================== BONUS ====================

export const bonusApi = {
    getPreview: async (params: { from: string; to: string; baseValue?: number }): Promise<any[]> => {
        return apiCall('get', '/bonus/preview', params);
    },

    getReport: async (params: { quarter?: string; year?: number; sector?: string; calculationMode?: string }): Promise<BonusReportResponse> => {
        return apiCall<BonusReportResponse>('get', '/bonus/report', params);
    },
};

