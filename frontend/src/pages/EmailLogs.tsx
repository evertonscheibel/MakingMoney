import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuth } from '../contexts';
import { Mail, CheckCircle, XCircle, Search, RefreshCw } from 'lucide-react';

interface EmailLog {
    _id: string;
    to: string;
    subject: string;
    category?: string;
    status: 'SENT' | 'FAILED';
    error?: string;
    sentAt: string;
    providerMessageId?: string;
}

interface EmailLogsResponse {
    success: boolean;
    data: EmailLog[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export default function EmailLogs() {
    const { user } = useAuth();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['emailLogs', { search, status: statusFilter, page }],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (search) params.append('search', search);
            if (statusFilter) params.append('status', statusFilter);
            params.append('page', page.toString());
            params.append('limit', '20');

            const response = await api.get<EmailLogsResponse>(`/email-logs?${params.toString()}`);
            return response.data;
        },
        enabled: !!user?.activeCompanyId,
    });

    const getStatusBadge = (status: string) => {
        if (status === 'SENT') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3" />
                    Enviado
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                <XCircle className="w-3 h-3" />
                Falhou
            </span>
        );
    };

    if (!user?.activeCompanyId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    Selecione uma empresa
                </h2>
                <p className="text-gray-500">
                    Use o seletor na barra lateral para escolher uma empresa.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Logs de Email</h1>
                    <p className="text-gray-500">
                        Histórico de emails enviados pelo sistema
                    </p>
                </div>
                <button
                    onClick={() => refetch()}
                    className="btn-secondary flex items-center gap-2"
                >
                    <RefreshCw className="w-4 h-4" />
                    Atualizar
                </button>
            </div>

            {/* Filters */}
            <div className="card">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                            placeholder="Buscar por destinatário ou assunto..."
                            className="input pl-10"
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setPage(1);
                        }}
                        className="input w-full sm:w-48"
                    >
                        <option value="">Todos os status</option>
                        <option value="SENT">Enviado</option>
                        <option value="FAILED">Falhou</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="card overflow-hidden p-0">
                {isLoading ? (
                    <div className="flex items-center justify-center h-48">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Data/Hora</th>
                                        <th>Destinatário</th>
                                        <th>Assunto</th>
                                        <th>Categoria</th>
                                        <th>Status</th>
                                        <th>Detalhes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data?.data?.map((log) => (
                                        <tr key={log._id}>
                                            <td className="text-sm whitespace-nowrap">
                                                {new Date(log.sentAt).toLocaleString('pt-BR')}
                                            </td>
                                            <td className="text-sm">
                                                <div className="flex items-center gap-2">
                                                    <Mail className="w-4 h-4 text-gray-400" />
                                                    {log.to}
                                                </div>
                                            </td>
                                            <td className="max-w-xs truncate">{log.subject}</td>
                                            <td className="text-sm">
                                                <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">
                                                    {log.category || 'general'}
                                                </span>
                                            </td>
                                            <td>{getStatusBadge(log.status)}</td>
                                            <td className="text-sm text-gray-500">
                                                {log.error ? (
                                                    <span className="text-red-600" title={log.error}>
                                                        Erro: {log.error.substring(0, 50)}...
                                                    </span>
                                                ) : log.providerMessageId ? (
                                                    <span className="text-xs text-gray-400">
                                                        ID: {log.providerMessageId.substring(0, 20)}...
                                                    </span>
                                                ) : (
                                                    '-'
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {(!data?.data || data.data.length === 0) && (
                                        <tr>
                                            <td colSpan={6} className="text-center text-gray-500 py-8">
                                                Nenhum log de email encontrado
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {data?.pagination && data.pagination.totalPages > 1 && (
                            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
                                <p className="text-sm text-gray-500">
                                    Mostrando {data.data.length} de {data.pagination.total} registros
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Anterior
                                    </button>
                                    <span className="px-4 py-2 text-sm text-gray-700">
                                        Página {page} de {data.pagination.totalPages}
                                    </span>
                                    <button
                                        onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                                        disabled={page === data.pagination.totalPages}
                                        className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Próxima
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

