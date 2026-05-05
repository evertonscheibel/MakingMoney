import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi, companiesApi, cyclesApi } from '../api';
import { useAuth } from '../contexts';
import { Printer } from 'lucide-react';
import { ProcessStatus } from '../types';

const STATUS_LABELS = {
    PENDING: 'Pendente',
    ON_TIME: 'No Prazo',
    LATE: 'Atrasado',
    CRITICAL: 'Crítico',
};

export default function Reports() {
    const { user } = useAuth();
    const [selectedSector, setSelectedSector] = useState<string>('');
    const [selectedCycle, setSelectedCycle] = useState<string>('');
    const [selectedStatus, setSelectedStatus] = useState<string>('');

    const { data: company } = useQuery({
        queryKey: ['company', user?.activeCompanyId],
        queryFn: () => companiesApi.get(user!.activeCompanyId!),
        enabled: !!user?.activeCompanyId,
    });

    const { data: cycles } = useQuery({
        queryKey: ['cycles', user?.activeCompanyId],
        queryFn: () => cyclesApi.list(),
        enabled: !!user?.activeCompanyId,
    });

    const { data: summary } = useQuery({
        queryKey: ['summary', selectedCycle, selectedSector, selectedStatus],
        queryFn: () => reportsApi.getSummary(undefined, selectedSector || undefined, selectedCycle || undefined, selectedStatus || undefined),
        enabled: !!user?.activeCompanyId,
    });


    const { data: extract } = useQuery({
        queryKey: ['extract', selectedCycle, selectedSector, selectedStatus],
        queryFn: () => reportsApi.getExtract(undefined, selectedSector || undefined, selectedCycle || undefined, selectedStatus || undefined),
        enabled: !!user?.activeCompanyId,
    });

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


    const handlePrint = () => {
        window.print();
    };

    const uniqueCycles = Array.from(new Set(cycles?.map(c => c.month) || [])).sort().reverse();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
                    <p className="text-gray-500">
                        {selectedCycle ? `Ciclo ${selectedCycle}` : `Ciclo ${summary?.cycle?.month || 'atual'}`}
                        {selectedSector ? ` - Setor: ${selectedSector}` : ''}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handlePrint} className="btn-secondary">
                        <Printer className="w-4 h-4" />
                        Imprimir
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="card bg-gray-50/50">
                <div className="flex flex-wrap items-end gap-4">
                    <div className="w-full sm:w-[calc(50%-1rem)] md:flex-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">
                            Setor
                        </label>
                        <select
                            className="input text-sm w-full"
                            value={selectedSector}
                            onChange={(e) => setSelectedSector(e.target.value)}
                        >
                            <option value="">Todos os Setores</option>
                            {company?.sectors.map(s => (
                                <option key={s.name} value={s.name}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="w-full sm:w-[calc(50%-1rem)] md:flex-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">
                            Ciclo
                        </label>
                        <select
                            className="input text-sm w-full"
                            value={selectedCycle}
                            onChange={(e) => setSelectedCycle(e.target.value)}
                        >
                            <option value="">Ciclo Atual / Todos</option>
                            {uniqueCycles.map(month => (
                                <option key={month} value={month}>{month}</option>
                            ))}
                        </select>
                    </div>

                    <div className="w-full sm:w-[calc(50%-1rem)] md:flex-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">
                            Status do Processo
                        </label>
                        <select
                            className="input text-sm w-full"
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                        >
                            <option value="">Todos os Status</option>
                            <option value={ProcessStatus.ON_TIME}>No Prazo</option>
                            <option value={ProcessStatus.LATE}>Atrasados</option>
                            <option value={ProcessStatus.CRITICAL}>Críticos</option>
                        </select>
                    </div>

                    <div className="w-full sm:w-auto flex justify-end">
                        <button
                            className="text-sm text-primary-600 hover:text-primary-700 font-medium py-2"
                            onClick={() => {
                                setSelectedSector('');
                                setSelectedCycle('');
                                setSelectedStatus('');
                            }}
                        >
                            Limpar Filtros
                        </button>
                    </div>
                </div>
            </div>

            {/* KPIs Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card text-center">
                    <p className="text-3xl font-bold text-primary-600">
                        {summary?.kpis.avgScore?.toFixed(1) || 0}
                    </p>
                    <p className="text-sm text-gray-500">Pontuação Média</p>
                </div>
                <div className="card text-center">
                    <p className="text-3xl font-bold text-success-600">
                        {summary?.kpis.onTimePct || 0}%
                    </p>
                    <p className="text-sm text-gray-500">No Prazo</p>
                </div>
                <div className="card text-center">
                    <p className="text-3xl font-bold text-warning-600">
                        {summary?.kpis.lateCount || 0}
                    </p>
                    <p className="text-sm text-gray-500">Atrasados</p>
                </div>
                <div className="card text-center">
                    <p className="text-3xl font-bold text-danger-600">
                        {summary?.kpis.criticalCount || 0}
                    </p>
                    <p className="text-sm text-gray-500">Críticos</p>
                </div>
            </div>


            {/* Extract Table */}
            <div className="card print:shadow-none print:border">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Extrato Detalhado
                </h2>
                {extract?.bySector && Object.keys(extract.bySector).length > 0 ? (
                    <div className="space-y-6">
                        {Object.entries(extract.bySector).map(([sector, processes]) => (
                            <div key={sector}>
                                <h3 className="font-semibold text-gray-700 mb-2 pb-2 border-b flex justify-between">
                                    <span>{sector} ({processes.length})</span>
                                    {selectedStatus && (
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${selectedStatus === ProcessStatus.ON_TIME ? 'bg-success-100 text-success-700' :
                                            selectedStatus === ProcessStatus.LATE ? 'bg-warning-100 text-warning-700' :
                                                'bg-danger-100 text-danger-700'
                                            }`}>
                                            {STATUS_LABELS[selectedStatus as keyof typeof STATUS_LABELS]}
                                        </span>
                                    )}
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Código</th>
                                                <th>Título</th>
                                                <th>Planejado</th>
                                                <th>Limite</th>
                                                <th>Responsáveis</th>
                                                <th>Entrega</th>
                                                <th>Pontuação</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {processes.map((p) => (
                                                <tr key={p._id}>
                                                    <td className="font-mono text-sm">{p.code}</td>
                                                    <td className="max-w-xs truncate">{p.title}</td>
                                                    <td className="text-sm">
                                                        {new Date(p.plannedDate).toLocaleDateString('pt-BR')}
                                                    </td>
                                                    <td className="text-sm">
                                                        {new Date(p.limitDate).toLocaleDateString('pt-BR')}
                                                    </td>
                                                    <td className="text-sm">
                                                        {typeof p.responsibleUserId === 'object' && p.responsibleUserId !== null
                                                            ? p.responsibleUserId.name
                                                            : '-'}
                                                    </td>
                                                    <td className="text-sm">
                                                        {p.deliveryDate
                                                            ? new Date(p.deliveryDate).toLocaleDateString('pt-BR')
                                                            : '-'}
                                                    </td>
                                                    <td className="font-semibold">
                                                        {p.score !== null ? p.score : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-gray-400 py-8">
                        Nenhum processo encontrado
                    </div>
                )}
            </div>
        </div>
    );
}

