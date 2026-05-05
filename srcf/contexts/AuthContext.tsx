import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { authApi, companiesApi } from '../api';
import { User, Company, UserRole } from '../types';

interface AuthContextType {
    user: User | null;
    companies: Company[];
    selectedCompanyId: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    isAdmin: boolean;
    isOperator: boolean;
    hasRole: (role: UserRole) => boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (data: any) => Promise<void>;
    forgotPassword: (email: string) => Promise<void>;
    resetPassword: (token: string, password: string) => Promise<void>;
    logout: () => void;
    switchCompany: (companyId: string) => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(localStorage.getItem('selectedCompanyId'));
    const [isLoading, setIsLoading] = useState(true);
    const hasAttemptedAutoLogin = useRef(false);

    // Check for existing token on mount
    useEffect(() => {
        if (hasAttemptedAutoLogin.current) return;

        const token = localStorage.getItem('token');
        if (token) {
            loadUser();
        } else {
            hasAttemptedAutoLogin.current = true;
            setIsLoading(false);
        }
    }, [isLoading]);

    async function loadUser() {
        try {
            const [userData, companiesData] = await Promise.all([
                authApi.me(),
                companiesApi.list(),
            ]);

            setUser(userData);
            setCompanies(companiesData);

            // Auto-select company if only one is allowed or if one is already active
            if (userData.activeCompanyId) {
                setSelectedCompanyId(userData.activeCompanyId);
                localStorage.setItem('selectedCompanyId', userData.activeCompanyId);
            } else if (userData.allowedCompanyIds && userData.allowedCompanyIds.length === 1) {
                const autoCompanyId = userData.allowedCompanyIds[0];
                await authApi.switchCompany(autoCompanyId);
                setSelectedCompanyId(autoCompanyId);
                localStorage.setItem('selectedCompanyId', autoCompanyId);
                // Update user state with the new activeCompanyId
                setUser({ ...userData, activeCompanyId: autoCompanyId });
            }
        } catch (error) {
            console.error('Failed to load user:', error);
            localStorage.removeItem('token');
        } finally {
            setIsLoading(false);
        }
    }

    async function login(email: string, password: string) {
        const response = await authApi.login(email, password);
        localStorage.setItem('token', response.token);

        const userData = response.user;
        setUser(userData);

        // Load companies after login
        const companiesData = await companiesApi.list();
        setCompanies(companiesData);

        // Auto-select company on login
        if (userData.activeCompanyId) {
            setSelectedCompanyId(userData.activeCompanyId);
            localStorage.setItem('selectedCompanyId', userData.activeCompanyId);
        } else if (userData.allowedCompanyIds && userData.allowedCompanyIds.length === 1) {
            const autoCompanyId = userData.allowedCompanyIds[0];
            await authApi.switchCompany(autoCompanyId);
            setSelectedCompanyId(autoCompanyId);
            localStorage.setItem('selectedCompanyId', autoCompanyId);
            setUser({ ...userData, activeCompanyId: autoCompanyId });
        }
    }

    async function register(data: any) {
        await authApi.register(data);
    }

    async function forgotPassword(email: string) {
        await authApi.forgotPassword(email);
    }

    async function resetPassword(token: string, password: string) {
        await authApi.resetPassword(token, password);
    }

    function logout() {
        localStorage.removeItem('token');
        setUser(null);
        setCompanies([]);
    }

    async function switchCompany(companyId: string) {
        try {
            await authApi.switchCompany(companyId);
            setSelectedCompanyId(companyId);
            localStorage.setItem('selectedCompanyId', companyId);
        } catch (error) {
            console.error('Failed to switch company:', error);
            throw error; // Let the component handle the error UI
        }
    }

    async function refreshUser() {
        await loadUser();
    }

    function hasRole(role: UserRole): boolean {
        return user?.roles.includes(role) ?? false;
    }

    const isAdmin = hasRole(UserRole.MASTER);
    const isOperator = hasRole(UserRole.OPERATOR) && !isAdmin;

    const value: AuthContextType = {
        user,
        companies,
        selectedCompanyId,
        isLoading,
        isAuthenticated: !!user,
        isAdmin,
        isOperator,
        hasRole,
        login,
        register,
        forgotPassword,
        resetPassword,
        logout,
        switchCompany,
        refreshUser,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

