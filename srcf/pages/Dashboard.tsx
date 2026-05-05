import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportsApi, cyclesApi, processesApi, metricsApi, companiesApi } from '../api';
import { useAuth } from '../contexts';

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CronogramaGlobal from '../components/CronogramaGlobal';
import {
    ClipboardCheck,
    Clock,
    AlertTriangle,
    TrendingUp,
    Calendar,
    Play,
    CheckCircle2,
    Archive,
    ChevronLeft,
    ChevronRight,
    ChevronDown, // Added
    RotateCcw,
    Undo2,
    Unlock, // Added
    Plus, // Added
} from 'lucide-react';
import { UserRole, CycleStatus } from '../types';
import CloseMonthModal from '../components/CloseMonthModal';

const formatMonth = (monthStr: string) => {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

export default function Dashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const isOperator = user?.roles.includes(UserRole.OPERATOR) && !user?.roles.includes(UserRole.MASTER) && !user?.roles.includes(UserRole.MANAGER);
    const isStrictManager = user?.roles.includes(UserRole.MANAGER) && !user?.roles.includes(UserRole.MASTER);

    // Initial state: Operators and Strict Managers MUST start with their sector.
    // Admins/Masters start with undefined (Consolidated view)
    const [selectedSector, setSelectedSector] = useState<string | undefined>(
        (isOperator || isStrictManager) ? user?.sector : undefined
    );

    const [selectedCycleId, setSelectedCycleId] = useState<string | undefined>();
    const isManager = user?.roles.includes(UserRole.MANAGER) || user?.roles.includes(UserRole.MASTER);
    const canCloseCycle = isManager; // Alias for clarity in UI logic

    // Fetch active company to get sectors list (only for Admins/Masters who can switch sectors)
    const { data: activeCompany } = useQuery({
        queryKey: ['company', user?.activeCompanyId],
        queryFn: () => companiesApi.get(user!.activeCompanyId!),
        enabled: !!user?.activeCompanyId && !isOperator && !isStrictManager,
    });

    // Fetch all cycles for navigation
    const { data: cycles } = useQuery({
        queryKey: ['cycles', selectedSector],
        queryFn: () => cyclesApi.list({ sector: selectedSector }),
        enabled: !!user?.activeCompanyId,
        refetchOnMount: 'always',
    });

    const { data: currentCycle, isLoading: cycleLoading } = useQuery({
        queryKey: ['currentCycle', selectedSector],
        queryFn: () => cyclesApi.getCurrent(selectedSector),
        enabled: !!user?.activeCompanyId,
        refetchOnMount: 'always',
    });

    // Initialize selectedCycleId with currentCycle id when available and not set
    // For operators, we explicitly want them to land on the current cycle
    useEffect(() => {
        // Wait until we know if there is a current open cycle
        if (cycleLoading) return;

        if (currentCycle) {
            // Priority 1: Use currently open cycle
            if (!selectedCycleId || isOperator) {
                setSelectedCycleId(currentCycle._id);
            }
        } else if (cycles && cycles.length > 0 && !selectedCycleId) {
            // Priority 2: If no open cycle, auto-select the most recent one from history
            const latest = [...cycles].sort((a, b) => b.month.localeCompare(a.month))[0];
            setSelectedCycleId(latest._id);
        }
    }, [currentCycle, cycleLoading, cycles, selectedCycleId, isOperator]);

    const sortedCycles = cycles?.sort((a, b) => a.month.localeCompare(b.month)) || [];
    const selectedCycleObj = sortedCycles.find(c => c._id === selectedCycleId);

    const { data: summary, isLoading: summaryLoading } = useQuery({
        queryKey: ['summary', selectedCycleId, selectedSector, selectedCycleObj?.month],
        queryFn: () => {
            // If All Sectors mode matches a month, prefer fetching by month to get aggregation
            if (!selectedSector && selectedCycleObj?.month) {
                return reportsApi.getSummary(undefined, undefined, selectedCycleObj.month);
            }
            return reportsApi.getSummary(selectedCycleId, selectedSector);
        },
        enabled: !!user?.activeCompanyId && (!!selectedCycleId || selectedSector === undefined), // Allow fetching consolidated if no cycle/sector selected
        refetchOnMount: 'always',
    });

    const isLoading = summaryLoading || cycleLoading;

    const currentIndex = sortedCycles.findIndex(c => c._id === selectedCycleId);
    const prevCycle = currentIndex > 0 ? sortedCycles[currentIndex - 1] : null;
    const nextCycle = currentIndex < sortedCycles.length - 1 ? sortedCycles[currentIndex + 1] : null;

    const navigateCycle = (cycleId: string) => {
        setSelectedCycleId(cycleId);
    };


    const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);

    const closeCycleMutation = useMutation({
        mutationFn: ({ overrides, openNext, sector }: { overrides?: any[], openNext: boolean, sector?: string }) => cyclesApi.close(overrides, openNext, sector),
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['summary'] });
            queryClient.invalidateQueries({ queryKey: ['currentCycle'] });
            queryClient.invalidateQueries({ queryKey: ['history'] });
            queryClient.invalidateQueries({ queryKey: ['sectorRanking'] });
            queryClient.invalidateQueries({ queryKey: ['processes'] });
            queryClient.invalidateQueries({ queryKey: ['cycles'] });
            setIsCloseModalOpen(false);
            alert(result.message || 'Ciclo fechado com sucesso!');
        },
        onError: (error: any) => {
            alert(`Erro ao fechar ciclo: ${error.response?.data?.message || error.message}`);
        }
    });

    const handleCloseCycle = () => {
        setIsCloseModalOpen(true);
    };

    const handleConfirmClose = (overrides: any[], openNext: boolean) => {
        const sectorToClose = selectedSector || selectedCycleObj?.sector;
        closeCycleMutation.mutate({ overrides, openNext, sector: sectorToClose });
    };

    // Check for restore point
    const { data: restorePointData } = useQuery({
        queryKey: ['restorePoint', selectedCycleId],
        queryFn: () => cyclesApi.checkRestorePoint(selectedCycleId!),
        enabled: !!selectedCycleId && isManager,
    });

    const resetCycleMutation = useMutation({
        mutationFn: (id: string) => cyclesApi.reset(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['summary'] });
            queryClient.invalidateQueries({ queryKey: ['processes'] });
            queryClient.invalidateQueries({ queryKey: ['restorePoint'] });
            queryClient.invalidateQueries({ queryKey: ['myMetrics'] });
            queryClient.invalidateQueries({ queryKey: ['teamMetrics'] });
            alert('Ciclo resetado com sucesso! Você pode desfazer essa ação se necessário.');
        },
        onError: (err: any) => alert(`Erro ao resetar: ${err.message}`)
    });

    const restoreCycleMutation = useMutation({
        mutationFn: (id: string) => cyclesApi.restore(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['summary'] });
            queryClient.invalidateQueries({ queryKey: ['processes'] });
            queryClient.invalidateQueries({ queryKey: ['restorePoint'] });
            queryClient.invalidateQueries({ queryKey: ['myMetrics'] });
            queryClient.invalidateQueries({ queryKey: ['teamMetrics'] });
            alert('Ciclo restaurado com sucesso!');
        },
        onError: (err: any) => alert(`Erro ao restaurar: ${err.message}`)
    });

    const handleReset = () => {
        if (!selectedCycleId) return;
        if (confirm('ATENÇÃO: Isso irá apagar todo o progresso (entregas e pontuações) deste mês. Os processos voltarão para Pendente.\n\nDeseja continuar?')) {
            resetCycleMutation.mutate(selectedCycleId);
        }
    };

    const handleRestore = () => {
        if (!selectedCycleId) return;
        if (confirm('Deseja desfazer o último reset e restaurar os dados anteriores?')) {
            restoreCycleMutation.mutate(selectedCycleId);
        }
    };

    const reopenCycleMutation = useMutation({
        mutationFn: (id: string) => cyclesApi.reopen(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cycles'] });
            queryClient.invalidateQueries({ queryKey: ['currentCycle'] });
            queryClient.invalidateQueries({ queryKey: ['summary'] });
            alert('Ciclo reaberto com sucesso!');
        },
        onError: (err: any) => alert(`Erro ao reabrir: ${err.response?.data?.message || err.message}`)
    });

    const openCycleMutation = useMutation({
        mutationFn: ({ month, sector }: { month: string, sector: string }) => cyclesApi.open(month, sector),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['currentCycle'] });
            queryClient.invalidateQueries({ queryKey: ['cycles'] });
            queryClient.invalidateQueries({ queryKey: ['summary'] });
            alert('Ciclo aberto com sucesso!');
        },
        onError: (err: any) => {
            console.error('Open Cycle Error:', err);
            let msg = err.response?.data?.message || err.message;
            if (err.response?.data?.details) {
                msg += '\n' + err.response.data.details.map((d: any) => `${d.field}: ${d.message}`).join('\n');
            }
            alert(`Erro ao abrir ciclo: ${msg}`);
        }
    });

    const handleOpenInitialCycle = () => {
        if (!selectedSector) return;

        let month = '';
        if (cycles && cycles.length > 0) {
            // Find the latest month in history and suggest the next one
            const latestMonth = [...cycles].sort((a, b) => b.month.localeCompare(a.month))[0].month;
            const [year, monthPart] = latestMonth.split('-').map(Number);
            const nextDate = new Date(year, monthPart, 1); // Month is 1-based in string, so year, monthPart means next month
            month = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
        } else {
            // Fallback to current month if no history
            const now = new Date();
            month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }

        if (confirm(`Deseja iniciar um novo ciclo (${month}) para o setor ${selectedSector}?`)) {
            openCycleMutation.mutate({ month, sector: selectedSector });
        }
    };

    const handleReopen = () => {
        if (!selectedCycleId) return;
        if (confirm('Deseja reabrir este ciclo? Isso definirá o status como ABERTO.\nCertifique-se de que não há outros ciclos abertos.')) {
            reopenCycleMutation.mutate(selectedCycleId);
        }
    };

    const { data: schedule } = useQuery({
        queryKey: ['schedule', selectedCycleObj?.month, selectedSector],
        queryFn: () => processesApi.getSchedule(selectedCycleObj!.month, selectedSector),
        enabled: !!user?.activeCompanyId && !!selectedCycleObj?.month,
        refetchOnMount: 'always',
    });

    const { data: myMetrics } = useQuery({
        queryKey: ['myMetrics', selectedCycleObj?.month, selectedCycleId],
        queryFn: () => metricsApi.getMyMetrics(selectedCycleObj?.month, selectedCycleId),
        enabled: !!user?.activeCompanyId && (!!selectedCycleObj?.month || !!selectedCycleId),
        refetchOnMount: 'always',
    });

    const { data: teamMetrics } = useQuery({
        queryKey: ['teamMetrics', selectedCycleObj?.month, selectedCycleId],
        queryFn: () => metricsApi.getTeamMetrics(selectedCycleObj?.month, selectedCycleId),
        enabled: !!user?.activeCompanyId && (!!selectedCycleObj?.month || !!selectedCycleId),
        refetchOnMount: 'always',
    });

    if (!user?.activeCompanyId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <Calendar className="w-8 h-8 text-gray-400" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Selecione uma empresa
                </h2>
                <p className="text-gray-500 dark:text-gray-400">
                    Use o seletor na barra lateral para escolher uma empresa.
                </p>
            </div>
        );
    }

    if (isLoading && !summary) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    const stats = [
        {
            name: 'Total de Processos',
            value: summary?.kpis.totalProcesses || 0,
            icon: ClipboardCheck,
            color: 'text-primary-600',
            bgColor: 'bg-primary-50',
        },
        {
            name: 'No Prazo',
            value: `${summary?.kpis.onTimePct || 0}%`,
            icon: CheckCircle2,
            color: 'text-success-600',
            bgColor: 'bg-success-50',
        },
        {
            name: 'Atrasados',
            value: summary?.kpis.lateCount || 0,
            icon: Clock,
            color: 'text-warning-600',
            bgColor: 'bg-warning-50',
        },
        {
            name: 'Críticos',
            value: summary?.kpis.criticalCount || 0,
            icon: AlertTriangle,
            color: 'text-danger-600',
            bgColor: 'bg-danger-50',
        },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {isOperator ? 'Meu Desempenho' : 'Dashboard'}
                    </h1>
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                        <p className="text-gray-500 dark:text-gray-400">
                            {isOperator ? 'Meus indicadores do ciclo' : 'Visão geral do ciclo'}
                        </p>

                        {!isOperator && (!isStrictManager || !user?.sector || user?.roles.includes(UserRole.MASTER)) && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Setor:</span>
                                <select
                                    value={selectedSector || ''}
                                    onChange={(e) => {
                                        setSelectedSector(e.target.value || undefined);
                                        setSelectedCycleId(undefined); // Reset cycle to auto-load current for new sector
                                    }}
                                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 rounded-lg px-3 py-1 outline-none focus:ring-2 focus:ring-primary-500/20"
                                >
                                    <option value="">Todos os Setores (Consolidado)</option>
                                    {activeCompany?.sectors.map((s) => (
                                        <option key={s.name} value={s.name}>
                                            {s.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm px-1">
                            <button
                                onClick={() => prevCycle && navigateCycle(prevCycle._id)}
                                disabled={!prevCycle}
                                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="px-2 text-sm font-medium text-gray-900 dark:text-gray-100 min-w-[80px] text-center">
                                {selectedCycleObj?.month || currentCycle?.month}
                            </span>
                            <button
                                onClick={() => nextCycle && navigateCycle(nextCycle._id)}
                                disabled={!nextCycle}
                                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {selectedCycleObj && (
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${selectedCycleObj.status === CycleStatus.OPEN ? 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                            {selectedCycleObj.status === CycleStatus.OPEN ? <Play className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                            <span className="text-sm font-medium">Ciclo {selectedCycleObj.status === CycleStatus.OPEN ? 'Aberto' : 'Fechado'}</span>
                        </div>
                    )}
                    {selectedCycleObj && canCloseCycle && selectedCycleObj.status === CycleStatus.OPEN && (
                        <button
                            onClick={handleCloseCycle}
                            disabled={closeCycleMutation.isPending}
                            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                        >
                            <Archive className="w-4 h-4" />
                            <span className="text-sm font-medium">
                                {closeCycleMutation.isPending ? 'Fechando...' : 'Fechar Mês'}
                            </span>
                        </button>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="xl:col-span-3 space-y-6">
                            <button
                                onClick={() => document.getElementById('cycle-dropdown')?.classList.toggle('hidden')}
                                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                                <Calendar className="w-4 h-4 text-gray-500" />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                    {selectedCycleObj ? formatMonth(selectedCycleObj.month) : 'Selecione um ciclo'}
                                </span>
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                            </button>
                            <div id="cycle-dropdown" className="hidden absolute top-full right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 py-1 max-h-60 overflow-y-auto">
                                {[...new Map((cycles || []).map(item => [item.month, item])).values()]
                                    .sort((a, b) => b.month.localeCompare(a.month))
                                    .map(cycle => (
                                        <button
                                            key={cycle._id}
                                            onClick={() => {
                                                setSelectedCycleId(cycle._id);
                                                document.getElementById('cycle-dropdown')?.classList.add('hidden');
                                            }}
                                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${cycle._id === selectedCycleId ? 'text-primary-600 font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                                        >
                                            {formatMonth(cycle.month)}
                                            {cycle.status === CycleStatus.OPEN && (
                                                <span className="ml-2 text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">Aberto</span>
                                            )}
                                        </button>
                                    ))}
                            </div>
                        </div>

                        {/* Manager Actions */}
                        {isManager && selectedCycleObj?.status === CycleStatus.OPEN && (
                            <div className="flex items-center gap-2 border-l pl-3 border-gray-200 dark:border-gray-700">
                                {restorePointData?.hasRestorePoint && (
                                    <button
                                        onClick={handleRestore}
                                        disabled={restoreCycleMutation.isPending}
                                        className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 transition-colors"
                                        title="Desfazer último reset"
                                    >
                                        <Undo2 className="w-4 h-4" />
                                        <span className="hidden sm:inline">Desfazer</span>
                                    </button>
                                )}

                                <button
                                    onClick={handleReset}
                                    disabled={resetCycleMutation.isPending}
                                    className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 transition-colors"
                                    title="Resetar entregas deste mês"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    <span className="hidden sm:inline">Resetar Mês</span>
                                </button>
                            </div>
                        )}

                        {isManager && selectedCycleObj?.status === CycleStatus.CLOSED && (
                            <div className="flex items-center gap-2 border-l pl-3 border-gray-200 dark:border-gray-700">
                                <button
                                    onClick={handleReopen}
                                    disabled={reopenCycleMutation.isPending}
                                    className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:hover:bg-purple-900/40 transition-colors"
                                    title="Reabrir este ciclo"
                                >
                                    <Unlock className="w-4 h-4" />
                                    <span className="hidden sm:inline">Reabrir Mês</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* KPI Cards or Empty State */}
            {(!selectedCycleId && !currentCycle && selectedSector && (!cycles || cycles.length === 0)) ? (
                <div className="card flex flex-col items-center justify-center py-12 text-center border-dashed border-2">
                    <Calendar className="w-12 h-12 text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Nenhum ciclo encontrado para o setor {selectedSector}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm">
                        Para começar a gerenciar os processos e indicadores deste setor, você precisa abrir o primeiro ciclo.
                    </p>
                    {canCloseCycle && (
                        <button
                            onClick={handleOpenInitialCycle}
                            disabled={openCycleMutation.isPending}
                            className="btn-primary"
                        >
                            {openCycleMutation.isPending ? 'Abrindo...' : 'Abrir Primeiro Ciclo'}
                        </button>
                    )}
                </div>
            ) : !selectedCycleId && cycles && cycles.length > 0 ? (
                <div className="card flex flex-col items-center justify-center py-12 text-center">
                    <Calendar className="w-12 h-12 text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Selecione um ciclo na lista acima
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm">
                        O ciclo atual está fechado. Você pode visualizar o histórico ou abrir um novo ciclo.
                    </p>
                    {canCloseCycle && (
                        <button
                            onClick={handleOpenInitialCycle}
                            disabled={openCycleMutation.isPending}
                            className="btn-primary flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            {openCycleMutation.isPending ? 'Abrindo...' : 'Abrir Novo Ciclo (Próximo Mês)'}
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {stats.map((stat) => (
                        <div
                            key={stat.name}
                            onClick={() => {
                                const params = new URLSearchParams();
                                if (stat.name === 'No Prazo') params.append('status', 'ON_TIME');
                                if (stat.name === 'Atrasados') params.append('status', 'LATE');
                                if (stat.name === 'Críticos') params.append('status', 'CRITICAL');
                                if (selectedSector) params.append('sector', selectedSector);
                                navigate(`/processes?${params.toString()}`);
                            }}
                            className="card hover:shadow-lg transition-shadow duration-200 cursor-pointer"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-xl ${stat.bgColor} dark:bg-opacity-20`}>
                                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{stat.name}</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Benchmark Section */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                <div className="card border-l-4 border-l-primary-500">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Minha Pontuação Média</span>
                        <TrendingUp className="w-5 h-5 text-primary-500" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-gray-900 dark:text-white">
                            {myMetrics?.averageScore?.toFixed(1) || 0}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            pts
                        </span>
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">
                        Baseado em {myMetrics?.count || 0} processos fechados no período
                    </p>
                </div>

                <div className="card border-l-4 border-l-indigo-500">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Média da Equipe (Benchmark)</span>
                        <TrendingUp className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-gray-900 dark:text-white">
                            {teamMetrics?.averageScore?.toFixed(1) || 0}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            pts
                        </span>
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">
                        Baseado em {teamMetrics?.count || 0} processos fechados no geral
                    </p>
                </div>
            </div>

            {/* Global Schedule */}
            {selectedCycleObj?.month && (
                <CronogramaGlobal
                    processes={schedule || []}
                    period={selectedCycleObj.month}
                />
            )}

            {/* Close Month Modal */}

            {/* Close Month Modal */}
            <CloseMonthModal
                isOpen={isCloseModalOpen}
                onClose={() => setIsCloseModalOpen(false)}
                onConfirm={handleConfirmClose}
                isConfirming={closeCycleMutation.isPending}
                sector={selectedSector}
            />
        </div >
    );
}

