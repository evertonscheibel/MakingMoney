import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarClock, Clock, User } from 'lucide-react';
import { logsApi } from '../api';
import { useAuth } from '../contexts';

const formatDay = (day: string | null) => (day ? day.split('-').reverse().join('/') : '-');
const formatMonth = (month: string) => {
    const [year, value] = month.split('-').map(Number);
    const label = new Date(Date.UTC(year, value - 1, 1)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    return label.charAt(0).toUpperCase() + label.slice(1);
};

function DateCell({ from, to }: { from: string | null; to: string | null }) {
    if (from === to) return <span className="text-gray-400">{formatDay(to)}</span>;
    return (
        <span className="inline-flex flex-wrap items-center gap-1 whitespace-nowrap">
            <span className="text-gray-500 line-through">{formatDay(from)}</span>
            <ArrowRight className="w-3 h-3 text-gray-400" />
            <span className="font-semibold text-amber-700 dark:text-amber-400">{formatDay(to)}</span>
        </span>
    );
}

export default function DateChanges() {
    const { user } = useAuth();
    const [month, setMonth] = useState<string | undefined>();
    const [sector, setSector] = useState('');

    const { data, isLoading, error } = useQuery({
        queryKey: ['dateChanges', user?.activeCompanyId, month, sector],
        queryFn: () => logsApi.listDateChanges({ month, sector: sector || undefined }),
        enabled: !!user?.activeCompanyId,
    });

    const changes = data?.changes || [];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Alterações de Datas</h1>
                <p className="text-gray-500 dark:text-gray-400">
                    Mudanças de data planejada e data limite dos processos, mês a mês.
                </p>
            </div>

            {error && <p role="alert" className="text-red-600">Não foi possível consultar as alterações: {(error as Error).message}</p>}

            <div className="flex flex-col sm:flex-row gap-3">
                <select
                    aria-label="Mês da alteração"
                    value={data?.month || ''}
                    onChange={(e) => { setMonth(e.target.value); setSector(''); }}
                    className="input sm:w-64 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                    {(data?.months || []).map((item) => (
                        <option key={item.month} value={item.month}>{formatMonth(item.month)} ({item.total})</option>
                    ))}
                </select>
                <select
                    aria-label="Setor"
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    className="input sm:w-64 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                    <option value="">Todos os setores</option>
                    {(data?.sectors || []).map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
                {data?.month && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 sm:self-center">
                        <CalendarClock className="w-4 h-4 inline mr-1" />
                        {changes.length} alteração(ões) em {formatMonth(data.month)}
                    </p>
                )}
            </div>

            <div className="card overflow-hidden p-0">
                {isLoading ? (
                    <div className="flex items-center justify-center h-48">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Alterado em</th>
                                    <th>Por</th>
                                    <th>Processo</th>
                                    <th>Setor</th>
                                    <th>Ciclo</th>
                                    <th>Data planejada</th>
                                    <th>Data limite</th>
                                </tr>
                            </thead>
                            <tbody>
                                {changes.map((change) => (
                                    <tr key={change.id}>
                                        <td className="text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                                            <Clock className="w-3 h-3 inline mr-1" />
                                            {new Date(change.changedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="text-sm whitespace-nowrap">
                                            <User className="w-3 h-3 inline mr-1 text-gray-400" />
                                            {change.changedBy?.name || 'Sistema'}
                                        </td>
                                        <td className="text-sm min-w-[14rem]">
                                            <span className="font-mono text-gray-500 mr-1">{change.code}</span>
                                            {change.title}
                                        </td>
                                        <td className="text-sm text-gray-600 dark:text-gray-300">{change.sector || '-'}</td>
                                        <td className="text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{change.cycleMonth || '-'}</td>
                                        <td className="text-sm"><DateCell {...change.plannedDate} /></td>
                                        <td className="text-sm"><DateCell {...change.limitDate} /></td>
                                    </tr>
                                ))}
                                {changes.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="text-center text-gray-500 py-8">
                                            Nenhuma alteração de data encontrada
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
