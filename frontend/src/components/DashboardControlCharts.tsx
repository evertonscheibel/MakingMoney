import { useQuery } from '@tanstack/react-query';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { reportsApi } from '../api';
import type { SummaryKPIs } from '../types';

interface Props {
    summary: SummaryKPIs;
    companyId: string;
    sector?: string;
    cycleId?: string;
}

export default function DashboardControlCharts({ summary, companyId, sector, cycleId }: Props) {
    const { kpis } = summary;
    const statuses = [
        { name: 'No prazo', count: kpis.onTimeCount, color: '#16a34a' },
        { name: 'Pendentes', count: kpis.pendingCount, color: '#64748b' },
        { name: 'Atrasados', count: kpis.lateCount, color: '#d97706' },
        { name: 'Críticos', count: kpis.criticalCount, color: '#dc2626' },
    ];
    const { data, isPending, isError } = useQuery({
        queryKey: ['sectorRanking', companyId, sector, cycleId],
        queryFn: () => reportsApi.getSectorRanking(cycleId, sector),
    });
    const ranking = [...(data?.ranking ?? [])].sort((a, b) =>
        (a.coveragePct ?? 101) - (b.coveragePct ?? 101) || a.sector.localeCompare(b.sector, 'pt-BR')
    );

    return <section className="space-y-3" aria-labelledby="control-charts-title">
        <h2 id="control-charts-title" className="text-lg font-semibold">Visão de controle</h2>
        <div className="grid gap-4 lg:grid-cols-2">
            <section className="card min-w-0">
                <h3 className="font-semibold">Situação dos processos</h3>
                <p className="text-xs text-gray-500">{kpis.totalProcesses.toLocaleString('pt-BR')} processos ativos no recorte</p>
                {kpis.totalProcesses > 0 && <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={statuses.filter(status => status.count > 0)} dataKey="count" nameKey="name"
                                innerRadius={49} outerRadius={78} stroke="none" isAnimationActive={false}>
                                {statuses.filter(status => status.count > 0).map(status => <Cell key={status.name} fill={status.color} />)}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>}
                <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    {statuses.map(status => <li key={status.name} className="flex items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: status.color }} />
                        <span>{status.name}</span>
                        <strong className="ml-auto tabular-nums">{status.count}</strong>
                    </li>)}
                </ul>
            </section>
            <section className="card min-w-0">
                <h3 className="font-semibold">Cobertura de avaliações por setor</h3>
                <p className="text-xs text-gray-500">Avaliados sobre exigíveis. Setores com menor cobertura aparecem primeiro.</p>
                {isPending && <p role="status" className="mt-4 text-sm">Carregando cobertura…</p>}
                {isError && <p role="alert" className="mt-4 text-sm text-red-700">Não foi possível carregar a cobertura por setor.</p>}
                {data && !ranking.length && <p className="mt-4 text-sm text-gray-500">Nenhum setor com processos ativos no recorte.</p>}
                <ul className="mt-4 max-h-60 space-y-3 overflow-auto">
                    {ranking.map(row => <li key={row.sector} className="space-y-1 text-sm">
                        <div className="flex flex-wrap justify-between gap-x-3">
                            <span>{row.sector}</span>
                            <strong className="tabular-nums">{row.coveragePct == null ? 'Sem exigíveis' : `${row.coveragePct.toLocaleString('pt-BR')}% · ${row.assessedEligibleCount}/${row.eligibleCount}`}</strong>
                        </div>
                        {row.coveragePct != null && <p className="text-xs text-gray-500">
                            {row.missingAssessmentCount ?? 0} avaliações vencidas · {row.pendingAssessmentCount ?? 0} pendentes no prazo
                        </p>}
                        {row.coveragePct != null && <div aria-hidden="true" className="h-2 rounded-full bg-gray-100 dark:bg-gray-700">
                            <div className="h-full rounded-full bg-primary-600" style={{ width: `${row.coveragePct}%` }} />
                        </div>}
                    </li>)}
                </ul>
            </section>
        </div>
    </section>;
}
