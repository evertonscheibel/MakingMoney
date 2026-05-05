import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi, companiesApi, usersApi } from '../api';
import { useAuth } from '../contexts';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';
import {
    TrendingUp,
    CheckCircle2,
    AlertTriangle,
    Calendar,
    Filter,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { UserRole } from '../types';

export default function ProcessCurveReport() {
    const { user } = useAuth();
    const [period, setPeriod] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [selectedSector, setSelectedSector] = useState<string>('');
    const [selectedUserId, setSelectedUserId] = useState<string>('');

    const isOperator = user?.roles.includes(UserRole.OPERATOR) && !user?.roles.includes(UserRole.MASTER) && !user?.roles.includes(UserRole.MANAGER);
    const isStrictManager = user?.roles.includes(UserRole.MANAGER) && !user?.roles.includes(UserRole.MASTER);

    // Get all allowed sectors for the user
    const allowedSectors = [
        ...(user?.sectors || []),
        ...(user?.sector ? [user.sector] : [])
    ];

    // Force sector for operators and strict managers if they have assigned sectors
    // If they have multiple, the first one is used as default, or they can maybe select from their allowed ones?
    // For now, let's just make it more resilient.
    const hasSectors = allowedSectors.length > 0;
    const effectiveSector = (isOperator || isStrictManager)
        ? (selectedSector && allowedSectors.includes(selectedSector) ? selectedSector : (allowedSectors[0] || ''))
        : selectedSector;

    // Fetch active company to get sectors list (only for Admins/Masters who can switch sectors)
    const { data: company } = useQuery({
        queryKey: ['company', user?.activeCompanyId],
        queryFn: () => companiesApi.get(user!.activeCompanyId!.toString()),
        enabled: !!user?.activeCompanyId && !isOperator && !isStrictManager,
    });

    const { data: users } = useQuery({
        queryKey: ['users'],
        queryFn: () => usersApi.list(),
        enabled: !isOperator && !!user?.activeCompanyId,
    });

    const { data: curveData, isLoading } = useQuery({
        queryKey: ['process-curve', period, effectiveSector, selectedUserId],
        queryFn: () => reportsApi.getProcessCurve({
            period,
            sector: effectiveSector || undefined,
            userId: selectedUserId || undefined
        }),
        enabled: !!user?.activeCompanyId && !!period,
    });

    const handlePrevMonth = () => {
        const [year, month] = period.split('-').map(Number);
        const date = new Date(year, month - 2, 1);
        setPeriod(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    };

    const handleNextMonth = () => {
        const [year, month] = period.split('-').map(Number);
        const date = new Date(year, month, 1);
        setPeriod(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    const kpis = [
        {
            name: 'Total Planejado',
            value: curveData?.kpis.totalPlanned || 0,
            icon: Calendar,
            color: 'text-primary-600',
            bgColor: 'bg-primary-50',
        },
        {
            name: 'Entregues',
            value: curveData?.kpis.deliveredCount || 0,
            icon: CheckCircle2,
            color: 'text-success-600',
            bgColor: 'bg-success-50',
        },
        {
            name: '% no Prazo',
            value: `${curveData?.kpis.onTimePct || 0}%`,
            icon: TrendingUp,
            color: 'text-indigo-600',
            bgColor: 'bg-indigo-50',
        },
        {
            name: 'Pontuação Média',
            value: curveData?.kpis.avgScore || 0,
            icon: TrendingUp,
            color: 'text-warning-600',
            bgColor: 'bg-warning-50',
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Relatório Curva de Processo</h1>
                    <p className="text-gray-500 dark:text-gray-400">Evolução do planejado vs realizado e indicadores de atraso.</p>
                </div>

                <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                    <button
                        onClick={handlePrevMonth}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="px-4 font-semibold min-w-[120px] text-center">
                        {period}
                    </span>
                    <button
                        onClick={handleNextMonth}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="card flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filtros:</span>
                </div>

                {(isStrictManager || (!isOperator && !isStrictManager)) && (
                    <select
                        value={effectiveSector}
                        onChange={(e) => setSelectedSector(e.target.value)}
                        className="select py-1.5"
                    >
                        {(!isStrictManager) && <option value="">Todos os Setores</option>}
                        {(isStrictManager) ? (
                            allowedSectors.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))
                        ) : (
                            company?.sectors.map(s => (
                                <option key={s.name} value={s.name}>{s.name}</option>
                            ))
                        )}
                    </select>
                )}

                {!isOperator && (
                    <select
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        className="select py-1.5"
                    >
                        <option value="">Todos os Operadores</option>
                        {users?.map(u => (
                            <option key={u._id?.toString()} value={u._id?.toString()}>{u.name}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((stat) => (
                    <div key={stat.name} className="card">
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

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Delivery Curve Chart */}
                <div className="card">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Curva de Entregas (Planejado vs Realizado)</h2>
                    <div className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={curveData?.series}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="day" />
                                <YAxis />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                                    labelFormatter={(label) => `Dia ${label}`}
                                />
                                <Legend />
                                <Line type="monotone" dataKey="planned" name="Planejado" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey="realized" name="Realizado" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Delay and Critical Chart */}
                <div className="card">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Status de Atraso e Crítico</h2>
                    <div className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={curveData?.series}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="day" />
                                <YAxis />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                                    labelFormatter={(label) => `Dia ${label}`}
                                />
                                <Legend />
                                <Line type="monotone" dataKey="delayed" name="Atrasado" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey="critical" name="Crítico" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Critical Items Table */}
            <div className="card overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        Itens Críticos no Período
                    </h3>
                    <span className="text-sm text-gray-500">
                        {curveData?.criticalItems.length || 0} itens identificados
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Processo</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Setor</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prazos</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Responsável</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {curveData?.criticalItems.map((item: any) => (
                                <tr key={item.code} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="font-medium text-gray-900 dark:text-white">{item.code}</div>
                                        <div className="text-sm text-gray-500">{item.title}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {item.sector}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <div>Planejado: {new Date(item.plannedDate).toLocaleDateString()}</div>
                                        <div className="text-red-500 font-medium">Limite: {new Date(item.limitDate).toLocaleDateString()}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {item.responsible}
                                    </td>
                                </tr>
                            ))}
                            {curveData?.criticalItems.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                                        Nenhum item crítico identificado neste período.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

