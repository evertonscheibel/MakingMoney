import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { logsApi } from '../api';
import { useAuth } from '../contexts';
import {
    FileText,
    Mail,
    Clock,
    User,
    CheckCircle,
    XCircle,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';

export default function AuditLogs() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'audit' | 'email'>('audit');
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');

    const { data: auditData, isLoading: isLoadingAudit } = useQuery({
        queryKey: ['auditLogs', page],
        queryFn: () => logsApi.listAuditLogs({ page, limit: 20 }),
        enabled: activeTab === 'audit' && !!user?.activeCompanyId,
    });

    const { data: emailData, isLoading: isLoadingEmail } = useQuery({
        queryKey: ['emailLogs', page, statusFilter],
        queryFn: () => logsApi.listEmailLogs({ page, limit: 20, status: statusFilter || undefined }),
        enabled: activeTab === 'email' && !!user?.activeCompanyId,
    });

    const formatDate = (date: string) => {
        return new Date(date).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getActionLabel = (action: string) => {
        const labels: Record<string, string> = {
            CREATE: 'Criação',
            UPDATE: 'Atualização',
            DELETE: 'Exclusão',
            CLOSE_CYCLE: 'Fechamento de Ciclo',
            EMAIL_DELIVERY: 'Envio de Email',
            REVERT_DELIVERY: 'Reversão de Entrega',
        };
        return labels[action] || action;
    };

    const getEntityLabel = (type: string) => {
        const labels: Record<string, string> = {
            process: 'Processo',
            cycle: 'Ciclo',
            company: 'Empresa',
            config: 'Configuração',
            user: 'Usuário',
        };
        return labels[type] || type;
    };

    const isLoading = activeTab === 'audit' ? isLoadingAudit : isLoadingEmail;
    const data = activeTab === 'audit' ? auditData : emailData;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Logs de Auditoria</h1>
                <p className="text-gray-500 dark:text-gray-400">
                    Histórico de ações e envios de email
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
                <button
                    onClick={() => { setActiveTab('audit'); setPage(1); }}
                    className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'audit'
                            ? 'border-primary-600 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                >
                    <FileText className="w-4 h-4 inline mr-2" />
                    Trilha de Auditoria
                </button>
                <button
                    onClick={() => { setActiveTab('email'); setPage(1); }}
                    className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'email'
                            ? 'border-primary-600 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                >
                    <Mail className="w-4 h-4 inline mr-2" />
                    Logs de Email
                </button>
            </div>

            {/* Filters for Email Tab */}
            {activeTab === 'email' && (
                <div className="flex gap-4">
                    <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                        className="input w-40 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        <option value="">Todos status</option>
                        <option value="SENT">Enviados</option>
                        <option value="FAILED">Falhas</option>
                    </select>
                </div>
            )}

            {/* Content */}
            <div className="card overflow-hidden p-0">
                {isLoading ? (
                    <div className="flex items-center justify-center h-48">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        {activeTab === 'audit' ? (
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Data</th>
                                        <th>Usuário</th>
                                        <th>Ação</th>
                                        <th>Entidade</th>
                                        <th>IP</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {auditData?.data?.map((log: any) => (
                                        <tr key={log._id}>
                                            <td className="text-sm text-gray-600 dark:text-gray-300">
                                                <Clock className="w-3 h-3 inline mr-1" />
                                                {formatDate(log.createdAt)}
                                            </td>
                                            <td className="text-sm">
                                                <User className="w-3 h-3 inline mr-1 text-gray-400" />
                                                {log.actorUserId?.name || 'Sistema'}
                                            </td>
                                            <td>
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                                    {getActionLabel(log.action)}
                                                </span>
                                            </td>
                                            <td className="text-sm text-gray-600 dark:text-gray-300">
                                                {getEntityLabel(log.entityType)}
                                            </td>
                                            <td className="text-xs text-gray-400 font-mono">
                                                {log.meta?.ip || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                    {(!auditData?.data || auditData.data.length === 0) && (
                                        <tr>
                                            <td colSpan={5} className="text-center text-gray-500 py-8">
                                                Nenhum log encontrado
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        ) : (
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Data</th>
                                        <th>Destinatário</th>
                                        <th>Assunto</th>
                                        <th>Status</th>
                                        <th>Erro</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {emailData?.data?.map((log: any) => (
                                        <tr key={log._id}>
                                            <td className="text-sm text-gray-600 dark:text-gray-300">
                                                <Clock className="w-3 h-3 inline mr-1" />
                                                {formatDate(log.sentAt)}
                                            </td>
                                            <td className="text-sm">{log.to}</td>
                                            <td className="text-sm max-w-xs truncate">{log.subject}</td>
                                            <td>
                                                {log.status === 'SENT' ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                                        <CheckCircle className="w-3 h-3 mr-1" />
                                                        Enviado
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                                        <XCircle className="w-3 h-3 mr-1" />
                                                        Falha
                                                    </span>
                                                )}
                                            </td>
                                            <td className="text-xs text-red-600 dark:text-red-400 max-w-xs truncate">
                                                {log.error || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                    {(!emailData?.data || emailData.data.length === 0) && (
                                        <tr>
                                            <td colSpan={5} className="text-center text-gray-500 py-8">
                                                Nenhum log encontrado
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>

            {/* Pagination */}
            {data?.pagination && data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                        Página {data.pagination.page} de {data.pagination.totalPages} ({data.pagination.total} registros)
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="btn-secondary disabled:opacity-50"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                            disabled={page === data.pagination.totalPages}
                            className="btn-secondary disabled:opacity-50"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

