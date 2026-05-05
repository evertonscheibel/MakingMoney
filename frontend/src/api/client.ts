import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const API_URL = '/api';

// Create axios instance
export const api: AxiosInstance = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor - add auth token
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        const companyId = localStorage.getItem('selectedCompanyId');
        if (companyId) {
            config.headers['x-company-id'] = companyId;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor - handle errors
api.interceptors.response.use(
    (response) => response,
    (error: AxiosError<{ error?: string; message?: string }>) => {
        if (error.response?.status === 401) {
            // Token expired or invalid
            localStorage.removeItem('token');
            window.location.href = '/login';
        }

        const message = error.response?.data?.error ||
            error.response?.data?.message ||
            error.message ||
            'An error occurred';

        return Promise.reject(new Error(message));
    }
);

// Helper function for API calls
export async function apiCall<T>(
    method: 'get' | 'post' | 'put' | 'delete',
    url: string,
    data?: unknown
): Promise<T> {
    const response = await api[method]<{ success: boolean; data: T; error?: string; message?: string }>(
        url,
        method === 'get' || method === 'delete' ? { params: data } : data
    );

    if (!response.data.success) {
        throw new Error(response.data.error || response.data.message || 'API Error');
    }

    return response.data.data;
}

export default api;

