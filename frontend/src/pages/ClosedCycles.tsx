import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cyclesApi, processesApi, companiesApi } from '../api';
import { Calendar, TrendingUp, Award, AlertCircle, Eye, RefreshCw, Filter } from 'lucide-react';
import { useAuth } from '../contexts';
import { UserRole } from '../types';

interface Cycle {
    _id: string;
    month: string;
    status: string;
    closedAt?: string;
    sector?: string;
    kpis?: {
        avgScore: number;
        onTimePct: number;
        criticalCount: number;
        totalProcesses: number;
        avgDeviationDays: number;
    };
}

export default function ClosedCycles() {
    const [cycles, setCycles] = useState<Cycle[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCycle, setSelectedCycle] = useState<string | null>(null);
    const [selectedSector, setSelectedSector] = useState<string | undefined>(undefined);
    const [processes, setProcesses] = useState<any[]>([]);
    const { user, hasRole } = useAuth();

    const canReopen = (hasRole(UserRole.MASTER) || hasRole(UserRole.MANAGER)) && !user?.roles.includes(UserRole.OPERATOR);
    const isStrictManager = user?.roles.includes(UserRole.MANAGER) && !user?.roles.includes(UserRole.MASTER);

    // Fetch active company to get sectors list (only for Admins/Masters who can switch sectors)
    const { data: activeCompany } = useQuery({
        queryKey: ['company', user?.activeCompanyId],
        queryFn: () => companiesApi.get(user!.activeCompanyId!),
        enabled: !!user?.activeCompanyId && !isStrictManager,
    });

    useEffect(() => {
        loadClosedCycles();
    }, [selectedSector]);

    const loadClosedCycles = async () => {
        try {
            setLoading(true);
            const data = await cyclesApi.list({ status: 'CLOSED', sector: selectedSector });
            setCycles(data as any);
        } catch (error) {
            console.error('Failed to load closed cycles:', error);
        } finally {
            setLoading(false);
        }
    };

    // Consolidation Logic
    const consolidatedCycles = useMemo(() => {
        // Strict filter to ensure only CLOSED cycles are displayed in history
        const closedCycles = cycles.filter(c => c.status === 'CLOSED');

        if (selectedSector) return closedCycles;

        const groups: Record<string, any> = {};
        closedCycles.forEach(cycle => {
            if (!groups[cycle.month]) {
                groups[cycle.month] = {
                    _id: `month-${cycle.month}`,
                    month: cycle.month,
                    status: 'CLOSED',
                    isConsolidated: true,
                    kpis: {
                        avgScore: 0,
                        onTimePct: 0,
                        criticalCount: 0,
                        totalProcesses: 0,
                    },
                    sectorCycles: []
                };
            }
            groups[cycle.month].sectorCycles.push(cycle);

            if (cycle.kpis) {
                const g = groups[cycle.month];
                const oldTotal = g.kpis.totalProcesses;
                const newTotal = oldTotal + cycle.kpis.totalProcesses;

                if (newTotal > 0) {
                    g.kpis.avgScore = ((g.kpis.avgScore * oldTotal) + (cycle.kpis.avgScore * cycle.kpis.totalProcesses)) / newTotal;
                    g.kpis.onTimePct = ((g.kpis.onTimePct * oldTotal) + (cycle.kpis.onTimePct * cycle.kpis.totalProcesses)) / newTotal;
                }

                g.kpis.criticalCount += cycle.kpis.criticalCount;
                g.kpis.totalProcesses = newTotal;
            }
        });

        return Object.values(groups).sort((a, b) => b.month.localeCompare(a.month));
    }, [cycles, selectedSector]);

    const viewCycleProcesses = async (cycleId: string, month?: string) => {
        try {
            setSelectedCycle(cycleId);
            // Also restrict processes to those from CLOSED cycles
            const query: any = { limit: 100, cycleStatus: 'CLOSED' };
            if (cycleId.startsWith('month-')) {
                query.month = month;
            } else {
                query.cycleId = cycleId;
            }

            if (selectedSector) {
                query.sector = selectedSector;
            }

            const response = await processesApi.list(query);
            setProcesses(response.data || []);
        } catch (error) {
            console.error('Failed to load processes:', error);
        }
    };

    const handleReopenCycle = async (item: any) => {
        if (item.isConsolidated) {
            alert('Para reabrir, selecione um setor específico primeiro.');
            return;
        }

        if (!window.confirm(`Tem certeza que deseja reabrir o ciclo de ${formatMonth(item.month)} para o setor ${item.sector}?`)) {
            return;
        }

        try {
            await cyclesApi.reopen(item._id);
            alert('Ciclo reaberto com sucesso!');
            loadClosedCycles();
        } catch (error: any) {
            console.error('Failed to reopen cycle:', error);
            const message = error.response?.data?.error || 'Erro ao reabrir ciclo';
            alert(message);
        }
    };

    const formatMonth = (month: string) => {
        const [year, monthNum] = month.split('-');
        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return `${monthNames[parseInt(monthNum) - 1]}/${year}`;
    };

    const getScoreColor = (score: number) => {
        if (score >= 75) return 'text-green-600';
        if (score >= 50) return 'text-yellow-600';
        if (score >= 25) return 'text-orange-600';
        return 'text-red-600';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    if (selectedCycle) {
        const cycle = consolidatedCycles.find((c: any) => c._id === selectedCycle);
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <button
                            onClick={() => setSelectedCycle(null)}
                            className="text-sm text-gray-600 hover:text-gray-900 mb-2 flex items-center gap-1"
                        >
                            ← Voltar para histórico
                        </button>
                        <h1 className="text-2xl font-bold text-gray-900">
                            Processos - {cycle && formatMonth(cycle.month)}
                            {selectedSector && <span className="text-primary-600 ml-2">({selectedSector})</span>}
                        </h1>
                    </div>
                </div>

                <div className="card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Título</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Setor</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pontuação</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entrega</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {processes.map((process: any) => (
                                    <tr key={process._id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {process.code}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900">{process.title}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{process.sector}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs rounded-full ${process.status === 'ON_TIME' ? 'bg-green-100 text-green-800' :
                                                process.status === 'LATE' ? 'bg-orange-100 text-orange-800' :
                                                    process.status === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                                                        'bg-gray-100 text-gray-800'
                                                }`}>
                                                {process.status === 'ON_TIME' ? 'No Prazo' :
                                                    process.status === 'LATE' ? 'Atrasado' :
                                                        process.status === 'CRITICAL' ? 'Crítico' : 'Pendente'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {process.score !== null ? (
                                                <span className={`font-semibold ${getScoreColor(process.score)}`}>
                                                    {process.score}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {process.deliveryDate ? new Date(process.deliveryDate).toLocaleDateString('pt-BR') : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Histórico de Ciclos</h1>
                    <p className="text-gray-500">Visualize os ciclos fechados e seus indicadores</p>
                </div>

                {!user?.roles.includes(UserRole.OPERATOR) && !isStrictManager && (
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                        <Filter className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-700">Setor:</span>
                        <select
                            value={selectedSector || ''}
                            onChange={(e) => setSelectedSector(e.target.value || undefined)}
                            className="text-sm font-medium text-gray-700 outline-none bg-transparent"
                        >
                            <option value="">Todos os Setores (Consolidado)</option>
                            {activeCompany?.sectors.map((s: any) => (
                                <option key={s.name} value={s.name}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {consolidatedCycles.length === 0 ? (
                <div className="card text-center py-12">
                    <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Nenhum ciclo fechado encontrado</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {consolidatedCycles.map((cycle: any) => (
                        <div key={cycle._id} className="card hover:shadow-lg transition-shadow relative overflow-hidden">
                            {cycle.isConsolidated && (
                                <div className="absolute top-0 right-0 px-2 py-0.5 bg-primary-100 text-primary-700 text-[10px] font-bold uppercase rounded-bl">
                                    Consolidado
                                </div>
                            )}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-5 h-5 text-primary-600" />
                                    <h3 className="text-lg font-semibold text-gray-900">
                                        {formatMonth(cycle.month)}
                                    </h3>
                                </div>
                                <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">
                                    Fechado
                                </span>
                            </div>

                            {cycle.kpis && (
                                <div className="space-y-3 mb-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <Award className="w-4 h-4" />
                                            <span>Pontuação Média</span>
                                        </div>
                                        <span className={`font-semibold ${getScoreColor(cycle.kpis.avgScore)}`}>
                                            {cycle.kpis.avgScore.toFixed(1)}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <TrendingUp className="w-4 h-4" />
                                            <span>No Prazo</span>
                                        </div>
                                        <span className="font-semibold text-green-600">
                                            {cycle.kpis.onTimePct.toFixed(1)}%
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <AlertCircle className="w-4 h-4" />
                                            <span>Críticos</span>
                                        </div>
                                        <span className="font-semibold text-red-600">
                                            {cycle.kpis.criticalCount}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <span>Total de Processos</span>
                                        </div>
                                        <span className="font-semibold text-gray-900">
                                            {cycle.kpis.totalProcesses}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className={`grid ${canReopen && !cycle.isConsolidated ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                                <button
                                    onClick={() => viewCycleProcesses(cycle._id, cycle.month)}
                                    className="btn btn-secondary flex items-center justify-center gap-2"
                                >
                                    <Eye className="w-4 h-4" />
                                    <span>Ver Detalhes</span>
                                </button>
                                {canReopen && !cycle.isConsolidated && (
                                    <button
                                        onClick={() => handleReopenCycle(cycle)}
                                        className="btn bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100 flex items-center justify-center gap-2"
                                        title="Reabrir Ciclo"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        <span>Reabrir</span>
                                    </button>
                                )}
                            </div>

                            {cycle.closedAt && !cycle.isConsolidated && (
                                <p className="text-xs text-gray-400 text-center mt-3">
                                    Fechado em {new Date(cycle.closedAt).toLocaleDateString('pt-BR')}
                                </p>
                            )}

                            {cycle.isConsolidated && (
                                <p className="text-xs text-gray-400 text-center mt-3 italic">
                                    Soma de {cycle.sectorCycles.length} setores
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

