import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi, companiesApi, usersApi } from '../api';
import { useAuth } from '../contexts';
import ProcessCurveChart from '../components/ProcessCurveChart';
import {
    TrendingUp,
    CheckCircle2,
    AlertTriangle,
    Calendar,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import ReportActions from '../components/ReportActions';
import { buildCurvePDF } from '../utils/curvePdfExport';
import { reportFilename } from '../utils/reportDocument';
import { UserRole } from '../types';
import { getAccessibleSectors } from '../utils/companyAccess';
import { formatBusinessDate } from '../utils/businessDate';
import { formatPerformanceAverage } from '../utils/performance';

const DELIVERY_COLORS: Record<string, string> = {
    EARLY: '#0d9488', ON_PLANNED: '#2563eb', LATE: '#d97706', CRITICAL: '#ea580c', OVERDUE: '#dc2626', PENDING: '#64748b',
};

const percent = (numerator: number, denominator: number) => denominator
    ? (numerator / denominator).toLocaleString('pt-BR', { style: 'percent', maximumFractionDigits: 1 }) : '—';

export default function ProcessCurveReport() {
    const { user } = useAuth();
    const [period, setPeriod] = useState(() => new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date()).slice(0, 7));
    const [selectedSector, setSelectedSector] = useState('');
    const [selectedUserId, setSelectedUserId] = useState('');
    const isOperator = user?.roles.includes(UserRole.OPERATOR);

    const { data: company } = useQuery({
        queryKey: ['company', user?.activeCompanyId],
        queryFn: () => companiesApi.get(user!.activeCompanyId!.toString()),
        enabled: !!user?.activeCompanyId,
    });

    const sectors = getAccessibleSectors(user, company);
    const effectiveSector = sectors.some(sector => sector.name === selectedSector) ? selectedSector : '';

    const { data: users } = useQuery({
        queryKey: ['users', user?.activeCompanyId],
        queryFn: () => usersApi.list(),
        enabled: !isOperator && !!user?.activeCompanyId,
    });

    const { data: curveData, isLoading, isFetching, isError } = useQuery({
        queryKey: ['process-curve', user?.activeCompanyId, period, effectiveSector, selectedUserId],
        queryFn: () => reportsApi.getProcessCurve({
            period,
            sector: effectiveSector || undefined,
            userId: selectedUserId || undefined
        }),
        enabled: !!user?.activeCompanyId && !!period,
    });

    const buildDocument = () => {
        if (!curveData || !company) throw new Error('Dados indisponíveis');
        return buildCurvePDF(curveData, {
            companyName: company.name, period, sector: effectiveSector,
            operator: isOperator ? user?.name : selectedUserId ? users?.find(u => u._id === selectedUserId)?.name || 'Responsável selecionado' : undefined,
            issuedBy: user?.name,
        });
    };

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

    const kpis = curveData?.kpis;
    const breakdown = curveData?.deliveryBreakdown ?? [];
    const count = (key: string) => breakdown.find(item => item.key === key)?.count ?? 0;
    const timely = count('EARLY') + count('ON_PLANNED');
    const risk = curveData?.riskBySector ?? [];
    const overdue = risk.reduce((sum, row) => sum + row.overdueOpen, 0);
    const delayed = risk.reduce((sum, row) => sum + row.delayedOpen, 0);
    const series = (curveData?.series ?? []).map(point => ({
        ...point, realized: point.date <= curveData!.asOf ? point.realized : null,
    }));
    const observed = series.filter(point => point.realized !== null);
    const lastObserved = observed.at(-1);
    const stats = kpis ? [
        { label: 'Entregas registradas', value: percent(kpis.deliveredCount, kpis.totalPlanned), detail: `${kpis.deliveredCount} de ${kpis.totalPlanned} processos planejados`, icon: CheckCircle2 },
        { label: 'Pontualidade das entregas', value: percent(timely, kpis.deliveredCount), detail: `${timely} de ${kpis.deliveredCount} entregas até a data planejada`, icon: Calendar },
        { label: 'Pendências em atraso', value: delayed + overdue, detail: `${delayed} após o planejado · ${overdue} com limite vencido`, icon: AlertTriangle },
        { label: 'Cobertura de avaliações', value: percent(kpis.assessedEligibleCount ?? 0, kpis.eligibleCount ?? 0), detail: `${kpis.assessedEligibleCount ?? 0} de ${kpis.eligibleCount ?? 0} exigíveis · Nota média ${formatPerformanceAverage(kpis.performanceAverage)} (n=${kpis.validScoreCount})`, icon: TrendingUp },
    ] : [];

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Relatório Curva de Processo</h1>
                    <p className="text-gray-500 dark:text-gray-400">Acompanhe o plano, o ritmo das entregas e os prazos que exigem atenção.</p>
                </div>

                <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                    <button
                        aria-label="Mês anterior"
                        onClick={handlePrevMonth}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="px-4 font-semibold min-w-[120px] text-center">
                        {period}
                    </span>
                    <button
                        aria-label="Próximo mês"
                        onClick={handleNextMonth}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <ReportActions build={buildDocument} emailContext={{ title: 'Curva de processos', period, sector: effectiveSector }} filename={reportFilename('curva_processos', period)} disabled={!company || !curveData || isFetching || isError} />
            {isError && <p role="alert" className="text-sm text-red-700">Não foi possível carregar a curva de processos. Recarregue a página para tentar novamente.</p>}
            {!user?.activeCompanyId && <p className="card text-sm">Selecione uma empresa para consultar a curva de processos.</p>}
            <div className="card grid gap-3 sm:grid-cols-2">
                <label className="text-sm">Setor
                    <select className="input" value={effectiveSector} onChange={e => setSelectedSector(e.target.value)}>
                        <option value="">Todos os setores autorizados</option>
                        {sectors.map(sector => <option key={sector.name}>{sector.name}</option>)}
                    </select>
                </label>
                {!isOperator && <label className="text-sm">Responsável
                    <select className="input" value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}>
                        <option value="">Todos os responsáveis</option>
                        {users?.map(u => <option key={u._id || u.id} value={u._id || u.id}>{u.name}</option>)}
                    </select>
                </label>}
            </div>
            {isLoading && <p role="status" className="text-sm">Carregando a curva de processos…</p>}
            {curveData && !kpis?.totalPlanned && <p className="card text-sm">Nenhum processo planejado para este recorte.</p>}
            {!!kpis?.totalPlanned && curveData && <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {stats.map(stat => <div key={stat.label} className="card">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <stat.icon className="h-4 w-4 shrink-0 text-primary-600" />{stat.label}
                        </div>
                        <p className="mt-1 text-2xl font-semibold tabular-nums">{stat.value}</p>
                        <p className="mt-1 text-xs text-gray-500">{stat.detail}</p>
                    </div>)}
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                    <ProcessCurveChart title="Planejado × realizado"
                        description="Volume acumulado no mês. As entregas vão até o dia de referência."
                        data={series} metrics={[
                            { key: 'planned', label: 'Planejados', color: '#64748b', dashed: true },
                            { key: 'realized', label: 'Entregues', color: '#0d9488' },
                        ]}
                        snapshot={lastObserved && {
                            date: lastObserved.date,
                            description: 'Composição do plano mensal, incluindo processos com data planejada futura.',
                            slices: [
                                { name: 'Entregues até a data', count: lastObserved.realized ?? 0, color: '#0d9488' },
                                { name: 'Sem entrega até a data', count: kpis.totalPlanned - (lastObserved.realized ?? 0), color: '#64748b' },
                            ],
                        }} />
                    <ProcessCurveChart title="Pendências por dia"
                        description="Processos sem entrega ao fim de cada dia. Cada pendência aparece em uma faixa."
                        data={observed} metrics={[
                            { key: 'delayedOpen', label: 'Após o planejado', color: '#d97706' },
                            { key: 'overdueOpen', label: 'Limite vencido', color: '#dc2626' },
                        ]}
                        snapshot={lastObserved && {
                            date: lastObserved.date,
                            description: 'Distribuição das pendências em atraso na data.',
                            slices: [
                                { name: 'Após o planejado', count: lastObserved.delayedOpen, color: '#d97706' },
                                { name: 'Limite vencido', count: lastObserved.overdueOpen, color: '#dc2626' },
                            ],
                        }} />
                    <section className="card min-w-0">
                        <h2 className="text-lg font-semibold">Situação dos processos planejados</h2>
                        <p className="text-xs text-gray-500">Percentual sobre os {kpis.totalPlanned} processos do recorte.</p>
                        <ul className="mt-4 space-y-3">
                            {breakdown.map(item => <li key={item.key} className="text-sm">
                                <div className="flex flex-wrap justify-between gap-x-3">
                                    <span>{item.label}</span><strong>{item.count} · {percent(item.count, kpis.totalPlanned)}</strong>
                                </div>
                                <div aria-hidden="true" className="mt-1 h-2 rounded-full bg-gray-100 dark:bg-gray-700">
                                    <div className="h-full rounded-full" style={{ width: `${item.count * 100 / kpis.totalPlanned}%`, background: DELIVERY_COLORS[item.key] }} />
                                </div>
                            </li>)}
                        </ul>
                    </section>
                    <section className="card min-w-0">
                        <h2 className="text-lg font-semibold">Pendências por setor</h2>
                        <p className="text-xs text-gray-500">Em {formatBusinessDate(curveData.asOf)}. Setores com mais limites vencidos aparecem primeiro.</p>
                        {risk.length ? <div className="mt-3 max-h-64 overflow-auto">
                            <table className="table text-sm">
                                <thead><tr><th>Setor</th><th>Após o planejado</th><th>Limite vencido</th></tr></thead>
                                <tbody>{risk.map(row => <tr key={row.sector}>
                                    <td>{row.sector}</td><td>{row.delayedOpen}</td><td className="font-semibold text-danger-600">{row.overdueOpen}</td>
                                </tr>)}</tbody>
                            </table>
                        </div> : <p className="mt-4 text-sm text-gray-500">Nenhuma pendência em atraso neste recorte.</p>}
                    </section>
                </div>
            </>}

            {/* Critical Items Table */}
            {curveData && <div className="card overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        Processos com limite ultrapassado
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
                            {curveData.criticalItems.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="font-medium text-gray-900 dark:text-white">{item.code}</div>
                                        <div className="text-sm text-gray-500">{item.title}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {item.sector}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <div>Planejado: {formatBusinessDate(item.plannedDate)}</div>
                                        <div className="text-red-500 font-medium">Limite: {formatBusinessDate(item.limitDate)}</div>
                                        <div>{item.deliveryDate ? `Entregue em ${formatBusinessDate(item.deliveryDate)}` : 'Sem entrega registrada'}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {item.responsible}
                                    </td>
                                </tr>
                            ))}
                            {curveData?.criticalItems.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                                        Nenhum processo ultrapassou o limite neste recorte.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>}
        </div>
    );
}

