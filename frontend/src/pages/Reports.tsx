import { formatBusinessDate } from '../utils/businessDate';
import { getAccessibleSectors } from '../utils/companyAccess';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi, companiesApi, cyclesApi } from '../api';
import { useAuth } from '../contexts';
import { List, CalendarDays } from 'lucide-react';
import { ProcessStatus } from '../types';
import { buildDetailedReportPDF } from '../utils/reportsPdfExport';
import ReportActions from '../components/ReportActions';
import { reportFilename } from '../utils/reportDocument';
import ProcessScheduleCalendar from '../components/ProcessScheduleCalendar';
import PerformanceDetails from '../components/PerformanceDetails';
import { formatPerformanceAverage } from '../utils/performance';
import PerformanceEvolution from '../components/PerformanceEvolution';
import AssessmentBadge from '../components/AssessmentBadge';
import { assessmentLabels } from '../utils/assessment';

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
    const [selectedAssessment, setSelectedAssessment] = useState('');
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

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

    const { data: summary, isFetching: summaryFetching, isError: summaryError } = useQuery({
        queryKey: ['summary', user?.activeCompanyId, selectedCycle, selectedSector, selectedStatus, selectedAssessment],
        queryFn: () => reportsApi.getSummary(undefined, selectedSector || undefined, selectedCycle || undefined, selectedStatus || undefined, selectedAssessment || undefined),
        enabled: !!user?.activeCompanyId,
    });


    const { data: extract, isFetching: extractFetching, isError: extractError } = useQuery({
        queryKey: ['extract', user?.activeCompanyId, selectedCycle, selectedSector, selectedStatus, selectedAssessment],
        queryFn: () => reportsApi.getExtract(undefined, selectedSector || undefined, selectedCycle || undefined, selectedStatus || undefined, selectedAssessment || undefined),
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


    const buildDocument = () => {
        if (!summary || !extract || !company) throw new Error('Dados indisponíveis');
        return buildDetailedReportPDF({
            companyName: company.name,
            cycle: documentPeriod,
            sector: selectedSector,
            status: selectedStatus ? STATUS_LABELS[selectedStatus as keyof typeof STATUS_LABELS] : undefined,
            assessment: selectedAssessment ? assessmentLabels[selectedAssessment as keyof typeof assessmentLabels] : undefined,
            issuedBy: user.name,
            summary, extract,
        });
    };

    const uniqueCycles = Array.from(new Set(cycles?.map(c => c.month) || [])).sort().reverse();
    const openMonths = Array.from(new Set(cycles?.filter(c => c.status === 'OPEN').map(c => c.month) || []));
    const summaryMonth = summary?.cycle?.month;
    const documentPeriod = selectedCycle || (summaryMonth && /^\d{4}-\d{2}$/.test(summaryMonth) ? summaryMonth : openMonths.length === 1 ? openMonths[0] : 'Ciclos abertos por setor');
    const calendarPeriod = selectedCycle || (summaryMonth && /^\d{4}-\d{2}$/.test(summaryMonth)
        ? summaryMonth : openMonths.length === 1 ? openMonths[0] : '');
    const filteredProcesses = extract?.bySector ? Object.values(extract.bySector).flat() : [];

    return (
        <div className="space-y-6">
            <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Relatórios</h1><p className="text-sm text-gray-500">Acompanhe a evolução das avaliações e consulte os processos do ciclo.</p></div>
            <PerformanceEvolution company={company} sector={selectedSector} sectorFilter={
                <label className="min-w-0 text-sm">Setor
                    <select className="input" value={selectedSector} aria-describedby="reports-sector-scope" onChange={e => setSelectedSector(e.target.value)}>
                        <option value="">Todos os setores autorizados</option>
                        {getAccessibleSectors(user, company).map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </select>
                    <span id="reports-sector-scope" className="text-xs text-gray-500">Aplica-se aos gráficos e ao relatório operacional.</span>
                </label>
            } />

            <div className="card space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold">Relatório operacional</h2>
                        <p className="text-sm text-gray-500">{documentPeriod}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 p-1 print:hidden" role="group" aria-label="Modo de exibição">
                            <button
                                type="button"
                                onClick={() => setViewMode('list')}
                                aria-pressed={viewMode === 'list'}
                                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 text-primary-700 dark:text-primary-300 shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'}`}
                            >
                                <List className="w-4 h-4" />
                                Lista
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('calendar')}
                                aria-pressed={viewMode === 'calendar'}
                                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'calendar' ? 'bg-white dark:bg-gray-700 text-primary-700 dark:text-primary-300 shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'}`}
                            >
                                <CalendarDays className="w-4 h-4" />
                                Calendário
                            </button>
                        </div>
                        <ReportActions build={buildDocument}
                            emailContext={{ title: 'Relatório operacional', period: documentPeriod, sector: selectedSector }}
                            filename={reportFilename('operacional', selectedCycle || 'ciclos_abertos')}
                            disabled={!company || !summary || !extract || summaryFetching || extractFetching || summaryError || extractError} />
                    </div>
                </div>
                <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
                    <label className="min-w-0 text-sm">Ciclo
                        <select className="input" value={selectedCycle} onChange={e => setSelectedCycle(e.target.value)}>
                            <option value="">Ciclos abertos por setor</option>
                            {uniqueCycles.map(month => <option key={month} value={month}>{month}</option>)}
                        </select>
                    </label>
                    <label className="min-w-0 text-sm">Status do processo
                        <select className="input" value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}>
                            <option value="">Todos os status</option>
                            <option value={ProcessStatus.ON_TIME}>No prazo</option>
                            <option value={ProcessStatus.LATE}>Atrasados</option>
                            <option value={ProcessStatus.CRITICAL}>Críticos</option>
                        </select>
                    </label>
                    <label className="min-w-0 text-sm">Avaliação
                        <select className="input" value={selectedAssessment} onChange={e => setSelectedAssessment(e.target.value)}>
                            <option value="">Todas as avaliações</option>
                            {Object.entries(assessmentLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                        </select>
                    </label>
                    <button type="button" className="py-2 text-sm font-medium text-primary-600 sm:justify-self-start" onClick={() => {
                        setSelectedCycle(''); setSelectedStatus(''); setSelectedAssessment('');
                    }}>Limpar filtros operacionais</button>
                </div>
                {(summaryError || extractError) && <p role="alert" className="text-sm text-red-700">Não foi possível carregar os dados do relatório. Recarregue a página para tentar novamente.</p>}
            </div>

            {summary && <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card text-center">
                    <p className="text-3xl font-bold text-primary-600">
                        {formatPerformanceAverage(summary?.kpis.performanceAverage)}
                    </p>
                    <p className="text-sm text-gray-500">Pontuação Média</p>
                    <PerformanceDetails indicators={summary?.kpis} />
                </div>
                <div className="card text-center">
                    <p className="text-3xl font-bold text-success-600">
                        {summary.kpis.totalProcesses ? `${formatPerformanceAverage(summary.kpis.onTimePct)}%` : '—'}
                    </p>
                    <p className="text-sm text-gray-500">No prazo</p>
                    <p className="mt-1 text-xs text-gray-500">{summary.kpis.onTimeCount} de {summary.kpis.totalProcesses} processos ativos no recorte</p>
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
            </div>}

            {/* Report visualization */}
            {viewMode === 'calendar' ? (
                <ProcessScheduleCalendar processes={filteredProcesses} period={calendarPeriod} editable={!cycles?.some(c => c.month === calendarPeriod && (!selectedSector || c.sector === selectedSector) && c.status === 'CLOSED')} />
            ) : (
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
                                                <th>Pontuação / avaliação</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {processes.map((p) => (
                                                <tr key={p._id}>
                                                    <td className="font-mono text-sm">{p.code}</td>
                                                    <td className="max-w-xs truncate">{p.title}</td>
                                                    <td className="text-sm">
                                                        {formatBusinessDate(p.plannedDate)}
                                                    </td>
                                                    <td className="text-sm">
                                                        {formatBusinessDate(p.limitDate)}
                                                    </td>
                                                    <td className="text-sm">
                                                        {typeof p.responsibleUserId === 'object' && p.responsibleUserId !== null
                                                            ? p.responsibleUserId.name
                                                            : '-'}
                                                    </td>
                                                    <td className="text-sm">
                                                        {p.deliveryDate
                                                            ? formatBusinessDate(p.deliveryDate)
                                                            : '-'}
                                                    </td>
                                                    <td className="font-semibold">
                                                        {p.score !== null ? p.score : '-'}
                                                        <div className="mt-1"><AssessmentBadge process={p} /></div>
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
            )}
        </div>
    );
}

