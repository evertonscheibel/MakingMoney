import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, ComposedChart, Line, Legend } from 'recharts';
import { Filter, Search, X, FileSpreadsheet, TrendingDown } from 'lucide-react';
import { reportsApi, companiesApi } from '../api';
import { api } from '../api/client';
import { useAuth } from '../contexts';
import { getAccessibleSectors } from '../utils/companyAccess';
import type { ProcessPerformanceReport, ProcessPerformanceRow } from '../types/processPerformance';
import ReportActions from '../components/ReportActions';
import { reportFilename } from '../utils/reportDocument';
import { buildProcessPerformancePDF } from '../utils/processPerformancePdfExport';
import { monthLabel, scoreBand, SCORE_BAND_CLASSES, SCORE_BAND_COLORS, SCORE_BAND_LABELS, type ScoreBand } from '../utils/processPerformance';

const currentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};
const formatScore = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

function emptyCellReason(row: ProcessPerformanceRow, month: string) {
    const cell = row.cells[month];
    if (!cell) return 'Processo não existia neste ciclo';
    if (cell.inactive) return 'Inativo neste ciclo';
    if (cell.notApplicable) return 'Não aplicável neste ciclo';
    return cell.delivered ? 'Entregue sem pontuação' : 'Sem avaliação';
}

export default function ProcessPerformance() {
    const { user } = useAuth();
    const [from, setFrom] = useState(() => `${new Date().getFullYear()}-01`);
    const [to, setTo] = useState(currentMonth);
    const [selectedSector, setSelectedSector] = useState('');
    const [search, setSearch] = useState('');
    const [onlyDrops, setOnlyDrops] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const detailRef = useRef<HTMLDivElement>(null);


    const { data: company } = useQuery({
        queryKey: ['company', user?.activeCompanyId],
        queryFn: () => companiesApi.get(user!.activeCompanyId!.toString()),
        enabled: !!user?.activeCompanyId,
    });
    const sectorOptions = getAccessibleSectors(user, company).map(s => s.name);

    const { data, isLoading, isFetching, isError } = useQuery({
        queryKey: ['process-performance', user?.activeCompanyId, from, to, selectedSector],
        queryFn: () => reportsApi.getProcessPerformance({ from, to, sector: selectedSector || undefined }),
        enabled: !!user?.activeCompanyId && !!from && !!to && from <= to,
    });

    const rows = useMemo(() => {
        const term = search.trim().toLowerCase();
        return (data?.rows || []).filter(r => (!term || r.code.includes(term) || r.title.toLowerCase().includes(term))
            && (!onlyDrops || (r.trend != null && r.trend < 0)));
    }, [data, search, onlyDrops]);
    const dropCount = (data?.rows || []).filter(r => r.trend != null && r.trend < 0).length;

    const exportExcel = async () => {
        setExporting(true);
        try {
            const response = await api.get('/reports/process-performance/export', { responseType: 'blob',
                params: { from, to, sector: selectedSector || undefined, search: search || undefined, onlyDrops: onlyDrops || undefined } });
            const url = URL.createObjectURL(response.data as Blob);
            const link = document.createElement('a');
            link.href = url; link.download = `desempenho_processos_${from}_a_${to}.xlsx`; link.click();
            URL.revokeObjectURL(url);
        } catch {
            alert('Não foi possível gerar a planilha. Tente novamente.');
        } finally {
            setExporting(false);
        }
    };
    const selected = rows.find(r => r.key === selectedKey) || null;
    const showSector = !selectedSector;

    useEffect(() => {
        if (selected) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [selectedKey]); // eslint-disable-line react-hooks/exhaustive-deps

    const buildDocument = () => {
        if (!data || !company) throw new Error('Dados indisponíveis');
        return buildProcessPerformancePDF({ ...data, rows }, { companyName: company.name, sector: selectedSector, search, issuedBy: user?.name });
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Desempenho de Processos</h1>
                <p className="text-gray-500 dark:text-gray-400">Pontuação de cada processo ao longo dos ciclos. Clique em um processo para ver a evolução dele.</p>
            </div>

            <ReportActions build={buildDocument} emailContext={{ title: 'Desempenho de processos', period: to, sector: selectedSector }}
                filename={reportFilename('desempenho_processos', `${from}_a_${to}`)} disabled={!company || !data || isFetching || isError} />
            <button type="button" onClick={exportExcel} disabled={!data || exporting || isFetching} className="btn-secondary inline-flex items-center gap-2 -mt-3 disabled:opacity-50">
                <FileSpreadsheet className="w-4 h-4" />{exporting ? 'Gerando planilha...' : 'Exportar Excel'}
            </button>


            <div className="card flex flex-wrap items-end gap-4">
                <div className="flex items-center gap-2 self-center">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filtros:</span>
                </div>
                <label className="text-sm">De<input type="month" className="input block" value={from} max={to} onChange={e => setFrom(e.target.value)} /></label>
                <label className="text-sm">Até<input type="month" className="input block" value={to} min={from} onChange={e => setTo(e.target.value)} /></label>
                <label className="text-sm">Setor
                    <select className="input block" value={selectedSector} onChange={e => { setSelectedSector(e.target.value); setSelectedKey(null); }}>
                        <option value="">Todos os setores</option>
                        {sectorOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </label>
                <label className="text-sm flex-1 min-w-[200px]">Processo
                    <div className="relative">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input className="input block w-full pl-9" placeholder="Código ou nome" value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                </label>
                <label className="text-sm inline-flex items-center gap-2 self-center cursor-pointer">
                    <input type="checkbox" checked={onlyDrops} onChange={e => setOnlyDrops(e.target.checked)} />
                    <TrendingDown className="w-4 h-4 text-red-500" />Só processos em queda ({dropCount})
                </label>
            </div>

            {data && <VolumeChart data={data} />}

            <div className="flex flex-wrap gap-3 text-xs">
                {(Object.keys(SCORE_BAND_LABELS) as ScoreBand[]).map(band => (
                    <span key={band} className={`px-2 py-1 rounded ${SCORE_BAND_CLASSES[band]}`}>{SCORE_BAND_LABELS[band]}</span>
                ))}
                <span className="px-2 py-1 rounded bg-gray-100 text-gray-500 dark:bg-gray-800">— Sem avaliação (não conta na média)</span>
            </div>

            {isError && <p role="alert" className="text-sm text-red-700">Não foi possível carregar o desempenho dos processos.</p>}

            <div className="card overflow-x-auto p-0">
                {isLoading ? <p className="p-6 text-gray-500">Carregando...</p> : !rows.length ? <p className="p-6 text-gray-500">Nenhum processo no período.</p> : (
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                            <tr>
                                <th className="px-3 py-2 text-left sticky left-0 bg-gray-50 dark:bg-gray-800">Código</th>
                                <th className="px-3 py-2 text-left">Processo</th>
                                {showSector && <th className="px-3 py-2 text-left">Setor</th>}
                                {data!.months.map(m => <th key={m} className="px-2 py-2 text-center whitespace-nowrap">{monthLabel(m)}</th>)}
                                <th className="px-3 py-2 text-center">Média</th>
                                <th className="px-2 py-2 text-center" title="Ciclos avaliados">n</th>
                                <th className="px-2 py-2 text-center" title="Diferença entre os dois últimos ciclos avaliados">Var.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(row => (<Fragment key={row.key}>
                                <tr onClick={() => setSelectedKey(row.key === selectedKey ? null : row.key)}
                                    className={`border-t border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${row.key === selectedKey ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}>
                                    <td className="px-3 py-2 font-mono sticky left-0 bg-inherit">{row.code}</td>
                                    <td className="px-3 py-2 min-w-[220px]" title={row.titleChanged ? 'O nome do processo mudou no período; mostrando o mais recente.' : undefined}>
                                        {row.title}{row.titleChanged && <span className="text-gray-400"> *</span>}
                                    </td>
                                    {showSector && <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{row.sector}</td>}
                                    {data!.months.map(m => {
                                        const score = row.cells[m]?.score;
                                        const dropped = row.drops.includes(m);
                                        return <td key={m} className="px-1 py-1 text-center">
                                            {score != null
                                                ? <span title={dropped ? 'Caiu em relação ao ciclo avaliado anterior' : undefined}
                                                    className={`inline-block min-w-[40px] px-1.5 py-0.5 rounded font-medium ${SCORE_BAND_CLASSES[scoreBand(score)]} ${dropped ? 'ring-2 ring-red-500' : ''}`}>
                                                    {dropped && '▼ '}{formatScore(score)}</span>
                                                : <span className="text-gray-300" title={emptyCellReason(row, m)}>—</span>}
                                        </td>;
                                    })}
                                    <td className="px-3 py-2 text-center">
                                        {row.average != null
                                            ? <span className={`inline-block min-w-[44px] px-1.5 py-0.5 rounded font-bold ${SCORE_BAND_CLASSES[scoreBand(row.average)]}`}>{formatScore(row.average)}</span>
                                            : <span className="text-gray-300">—</span>}
                                    </td>
                                    <td className="px-2 py-2 text-center text-gray-500">{row.sampleSize}</td>
                                    <td className={`px-2 py-2 text-center font-medium whitespace-nowrap ${row.trend == null || row.trend === 0 ? 'text-gray-400' : row.trend < 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                        {row.trend == null ? '—' : row.trend === 0 ? '0' : `${row.trend > 0 ? '▲ +' : '▼ '}${formatScore(row.trend)}`}
                                    </td>
                                </tr>
                                {row.key === selectedKey && (
                                    <tr><td colSpan={data!.months.length + (showSector ? 6 : 5)} className="p-3 bg-gray-50 dark:bg-gray-900/40">
                                        <div ref={detailRef} className="sticky left-0 max-w-[calc(100vw-22rem)]">
                                            <ProcessEvolutionDetail row={row} months={data!.months} onClose={() => setSelectedKey(null)} />
                                        </div>
                                    </td></tr>
                                )}
                            </Fragment>))}
                        </tbody>
                    </table>
                )}
            </div>
            {rows.some(r => r.titleChanged) && <p className="text-xs text-gray-500">* O nome do processo mudou no período; o quadro agrupa pelo setor e código e mostra o nome mais recente.</p>}

        </div>
    );
}

function ProcessEvolutionDetail({ row, months, onClose }: { row: ProcessPerformanceRow; months: string[]; onClose: () => void }) {
    const chartData = months.map(month => ({ month: monthLabel(month), score: row.cells[month]?.score ?? null }));
    return (
        <div className="card">
            <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Evolução do processo {row.code} — {row.title}</h2>
                    <p className="text-sm text-gray-500">
                        {row.sector}{row.responsible ? ` · Responsável atual: ${row.responsible}` : ''} · Média {row.average != null ? formatScore(row.average) : '—'} em {row.sampleSize} ciclo(s)
                        {row.trend != null && ` · Última variação: ${row.trend > 0 ? '+' : ''}${formatScore(row.trend)} pontos`}
                    </p>
                </div>
                <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Fechar evolução"><X className="w-5 h-5" /></button>
            </div>
            <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip cursor={{ fill: 'transparent' }} formatter={(value) => value == null ? 'Sem avaliação' : formatScore(Number(value))} />
                        <Bar dataKey="score" name="Pontuação" radius={[4, 4, 0, 0]}>
                            {chartData.map((point, i) => <Cell key={i} fill={point.score != null ? SCORE_BAND_COLORS[scoreBand(point.score)] : 'transparent'} />)}
                            <LabelList dataKey="score" position="top" formatter={(value: unknown) => value == null ? '' : formatScore(Number(value))} />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <p className="text-xs text-gray-500 mt-2">Ciclos sem barra não tiveram avaliação. Quedas indicam onde investigar: atraso de outro setor, volume, férias, mudança de responsável.</p>
        </div>
    );
}

function VolumeChart({ data }: { data: ProcessPerformanceReport }) {
    const chartData = data.volume.map(v => ({ ...v, label: monthLabel(v.month) }));
    return (
        <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Volume × desempenho</h2>
            <p className="text-sm text-gray-500 mb-4">Barras: processos ativos em cada ciclo. Linha: média das notas avaliadas. Mostra os dois juntos, sem afirmar que um causa o outro.</p>
            <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" />
                        <YAxis yAxisId="volume" allowDecimals={false} />
                        <YAxis yAxisId="score" orientation="right" domain={[0, 100]} />
                        <Tooltip cursor={{ fill: 'transparent' }} formatter={(value, name) => value == null ? 'Sem avaliação' : name === 'Média' ? formatScore(Number(value)) : value} />
                        <Legend />
                        <Bar yAxisId="volume" dataKey="activeProcesses" name="Processos ativos" fill="#94a3b8" radius={[4, 4, 0, 0]}>
                            <LabelList dataKey="activeProcesses" position="top" />
                        </Bar>
                        <Line yAxisId="score" type="monotone" dataKey="average" name="Média" stroke="#2563eb" strokeWidth={3} connectNulls={false} dot={{ r: 4 }} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
