import { useState, useEffect, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LineChart, BarChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { Company } from '../types';
import type { EvolutionReport } from '../types/evolution';
import { CycleStatus, UserRole } from '../types';
import { useAuth } from '../contexts';
import { apiCall } from '../api/client';
import { usersApi } from '../api';
import { getAccessibleSectors } from '../utils/companyAccess';
import { formatPerformanceAverage, performanceSampleLabel } from '../utils/performance';
import { formatEventDate, eventMonth } from '../utils/evolutionDates';
import { buildEvolutionPDF } from '../utils/evolutionPdfExport';
import ReportActions from './ReportActions';
import { assessmentLabels } from '../utils/assessment';
import { formatBusinessDate } from '../utils/businessDate';

export default function PerformanceEvolution({ company, sector, sectorFilter }: { company?: Company; sector: string; sectorFilter: ReactNode }) {
    const { user } = useAuth(), client = useQueryClient();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const currentMonth = today.slice(0, 7);
    const firstMonth = `${today.slice(0, 4)}-01`;
    const [from, setFrom] = useState(firstMonth), [to, setTo] = useState(currentMonth);
    const [groupBy, setGroupBy] = useState('month'), [userId, setUserId] = useState('');
    const [processId, setProcessId] = useState(''), [category, setCategory] = useState('');
    const [eventLimit, setEventLimit] = useState(30), [notice, setNotice] = useState('');
    const [eventType, setEventType] = useState('');
    const [sourceId, setSourceId] = useState(''), [referenceId, setReferenceId] = useState(''), [linkReason, setLinkReason] = useState('');
    const [preview, setPreview] = useState<{ sourceCount: number; referenceCount: number; conflicts: string[]; alreadyLinked?: boolean } | null>(null);
    useEffect(() => { setUserId(''); }, [user?.activeCompanyId]);
    useEffect(() => { setProcessId(''); setCategory(''); setSourceId(''); setReferenceId(''); setPreview(null); }, [sector, user?.activeCompanyId]);
    const isMaster = user?.roles.includes(UserRole.MASTER), canManage = isMaster || user?.roles.includes(UserRole.MANAGER);
    const scope = { from, to, sector: sector || undefined, userId: userId || undefined, category: category.trim() || undefined };
    const scopeKey = JSON.stringify(scope);
    const validPeriod = !!from && !!to && from <= to;
    const { data: result, isPlaceholderData, isFetching, isError, error } = useQuery({
        queryKey: ['performance-evolution', user?.activeCompanyId, scopeKey, groupBy, processId],
        queryFn: () => apiCall<EvolutionReport>('get', '/reports/performance-history', {
            ...scope, groupBy, processId: processId || undefined, equivalent: 'true',
        }),
        placeholderData: (previous, query) => query && query.queryKey[1] === user?.activeCompanyId
            && query.queryKey[2] === scopeKey ? previous : undefined,
        enabled: validPeriod && !!user?.activeCompanyId,
    });
    const data = isPlaceholderData ? undefined : result;
    const processOptions = result?.processOptions ?? result?.records ?? [];
    const { data: users } = useQuery({ queryKey: ['users', user?.activeCompanyId], queryFn: () => usersApi.list(), enabled: !!user?.activeCompanyId });
    const records = data?.records || [], points = data?.series || [], events = data?.events || [];
    const displayedEvents = eventType ? events.filter(e => e.type === eventType) : events;
    const scopes = getAccessibleSectors(user, company);
    const invalidate = () => client.invalidateQueries({ queryKey: ['performance-evolution'] });
    const milestone = useMutation({ mutationFn: (payload: Record<string, string>) => apiCall('post', '/reports/milestones', payload),
        onSuccess: () => { setNotice('Marco registrado.'); invalidate(); }, onError: (e: Error) => setNotice(e.message) });
    const link = useMutation({ mutationFn: (dryRun: boolean) => apiCall<{ sourceCount: number; referenceCount: number; conflicts: string[]; alreadyLinked?: boolean }>('post', `/processes/${sourceId}/lineage`, {
        referenceProcessId: referenceId, reason: linkReason, dryRun, expectedCount: preview?.sourceCount,
    }), onSuccess: (result, dryRun) => { if (dryRun) setPreview(result); else { setPreview(null); setNotice('Vínculo histórico confirmado. Notas e snapshots preservados.'); invalidate(); } },
    onError: (e: Error) => setNotice(e.message) });
    const recordLabel = (r: typeof processOptions[number]) => `${r.month} · ${r.sector} · ${r.code} — ${r.title}`;
    const markers = [...new Set(displayedEvents.map(e => {
        const month = eventMonth(e.occurredAt);
        return groupBy === 'quarter' ? `${month.slice(0, 4)}-Q${Math.ceil(Number(month.slice(5)) / 3)}` : month;
    }))];
    const periodLabel = (value: string) => `${value.slice(5)}/${value.slice(2, 4)}`;
    const hasAdvancedFilters = !!(userId || processId || category);
    return <section className="space-y-4" aria-labelledby="evolution-title">
            <div className="card space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 id="evolution-title" className="font-semibold text-lg">Evolução do desempenho</h2>
                    <button type="button" className="text-sm font-medium text-primary-600" onClick={() => {
                        setFrom(firstMonth); setTo(currentMonth); setGroupBy('month');
                        setUserId(''); setProcessId(''); setCategory('');
                    }}>Restaurar período e filtros da evolução</button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {sectorFilter}
                    <label className="min-w-0 text-sm">De<input aria-label="Evolução de" type="month" className="input" value={from} max={to || undefined} onChange={e => { setFrom(e.target.value); setProcessId(''); }} /></label>
                    <label className="min-w-0 text-sm">Até<input aria-label="Evolução até" type="month" className="input" value={to} min={from || undefined} onChange={e => { setTo(e.target.value); setProcessId(''); }} /></label>
                    <label className="min-w-0 text-sm">Agrupar<select className="input" aria-label="Agrupamento da evolução" value={groupBy} onChange={e => setGroupBy(e.target.value)}><option value="month">Mês</option><option value="quarter">Trimestre</option></select></label>
                </div>
                <details>
                    <summary className="cursor-pointer text-sm font-medium">Filtros da evolução{hasAdvancedFilters && ' · ativos'}</summary>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <label className="min-w-0 text-sm">Colaborador<select className="input" value={userId} onChange={e => { setUserId(e.target.value); setProcessId(''); }}><option value="">Todos autorizados</option>{users?.map(u => <option key={u._id || u.id} value={u._id || u.id}>{u.name}</option>)}</select></label>
                        <label className="min-w-0 text-sm">Processo<select className="input" value={processId} onChange={e => setProcessId(e.target.value)}><option value="">Todos do recorte</option>{processOptions.map(r => <option key={r.id} value={r.id}>{recordLabel(r)}</option>)}</select></label>
                        <label className="min-w-0 text-sm">Categoria<input className="input" maxLength={100} list="evolution-categories" value={category} onChange={e => { setCategory(e.target.value); setProcessId(''); }} /><datalist id="evolution-categories">{result?.categories?.map(c => <option key={c} value={c} />)}</datalist></label>
                    </div>
                </details>
                {!validPeriod && <p role="alert" className="text-sm text-red-700">Informe um período válido para consultar a evolução.</p>}
            </div>
            {isFetching && <p role="status" className="text-sm">Atualizando evolução…</p>}
            {isError && <p role="alert" className="text-red-700">{error.message}</p>}
            {validPeriod && data && (points.some(point => point.hasData) ? (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                    <section className="card min-w-0">
                        <h3 className="font-semibold">Pontuação e cobertura</h3>
                        <p className="text-xs text-gray-500">Média das notas válidas e percentual de avaliações</p>
                        <div className="mt-3 h-56 w-full">
                            <ResponsiveContainer width="100%" height="100%"><LineChart data={points} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
                                <XAxis dataKey="period" tick={{ fontSize: 11 }} minTickGap={16} tickFormatter={periodLabel} />
                                <YAxis width={32} domain={[0, 100]} tick={{ fontSize: 11 }} />
                                <Tooltip labelFormatter={periodLabel} /><Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                                <Line dataKey="performanceAverage" name="Pontuação média" stroke="#16a34a" strokeWidth={2} isAnimationActive={false} />
                                <Line dataKey="coveragePct" name="Cobertura (%)" stroke="#2563eb" strokeWidth={2} strokeDasharray="4 4" isAnimationActive={false} />
                                {markers.map(period => <ReferenceLine key={period} x={period} stroke="#a855f7" strokeDasharray="2 4" />)}
                            </LineChart></ResponsiveContainer>
                        </div>
                    </section>
                    {processId ? <section className="card min-w-0">
                        <h3 className="font-semibold">Cobertura por ciclo do processo</h3>
                        <p className="text-xs text-gray-500">Avaliações dos ciclos registrados no recorte.</p>
                        <div className="mt-3 max-h-56 overflow-auto">
                            <table className="table text-xs">
                                <thead><tr>{['Ciclo', 'Prazo / entrega', 'Avaliação'].map(label => <th key={label}>{label}</th>)}</tr></thead>
                                <tbody>{data.processCycles?.map(cycle => <tr key={cycle.id}>
                                    <td><strong>{periodLabel(cycle.month)}</strong><span className="block">{cycle.sector} · {cycle.cycleStatus === CycleStatus.OPEN ? 'Aberto' : 'Encerrado'}</span></td>
                                    <td><span className="block">Previsto: {formatBusinessDate(cycle.plannedDate)}</span><span className="block">Limite: {formatBusinessDate(cycle.limitDate)}</span><span className="block">Entrega: {cycle.deliveryDate ? formatBusinessDate(cycle.deliveryDate) : 'Sem entrega registrada'}</span></td>
                                    <td>{cycle.isActive ? assessmentLabels[cycle.assessment] : 'Inativo'}<span className="block">{cycle.coveragePct == null ? 'Fora da cobertura' : `${cycle.coveragePct}% de cobertura`}</span>{cycle.score != null && <span className="block">Nota: {formatPerformanceAverage(cycle.score)}</span>}</td>
                                </tr>)}</tbody>
                            </table>
                        </div>
                    </section> : <section className="card min-w-0">
                        <h3 className="font-semibold">Volume de processos</h3>
                        <p className="text-xs text-gray-500">Ativos e entregues por competência</p>
                        <div className="mt-3 h-56 w-full">
                            <ResponsiveContainer width="100%" height="100%"><BarChart data={points} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
                                <XAxis dataKey="period" tick={{ fontSize: 11 }} minTickGap={16} tickFormatter={periodLabel} />
                                <YAxis width={36} allowDecimals={false} tick={{ fontSize: 11 }} />
                                <Tooltip labelFormatter={periodLabel} /><Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                                <Bar dataKey="activeProcessCount" name="Ativos" fill="#2563eb" maxBarSize={24} isAnimationActive={false} />
                                <Bar dataKey="deliveredCount" name="Entregues" fill="#0d9488" maxBarSize={24} isAnimationActive={false} />
                            </BarChart></ResponsiveContainer>
                        </div>
                    </section>}
                </div>
            ) : <p className="card text-sm text-gray-500">Nenhum dado de evolução para os filtros selecionados.</p>)}
            <details className="card space-y-4">
                <summary className="cursor-pointer font-semibold">Detalhes da evolução e linha do tempo</summary>
            <p className="text-xs text-gray-500">As linhas roxas no gráfico marcam períodos com eventos registrados.</p>
            {validPeriod && data && <>
                <ReportActions build={() => buildEvolutionPDF({ ...data, events: displayedEvents }, company?.name || 'Empresa', [sector || 'Setores autorizados', users?.find(u => (u._id || u.id) === userId)?.name, category, eventType && `Eventos: ${eventType}`].filter(Boolean).join(' · '), user?.name)} filename={`chronos-evolucao-${from}-${to}.pdf`} disabled={isFetching || isError}
                    emailContext={{ title: 'Evolução de desempenho', period: `${from} a ${to}`, sector }} />
                {(!!data.warnings.unconfirmedLineageCount || !!data.warnings.legacyResponsibilityCount) && <p className="text-sm text-amber-800 bg-amber-50 rounded p-3">
                    {data.warnings.unconfirmedLineageCount} registros sem identidade histórica confirmada; {data.warnings.legacyResponsibilityCount} notas usam o responsável do documento legado. Novas avaliações preservam o responsável registrado na entrega.
                </p>}
                <div className="overflow-x-auto"><table className="table text-sm"><thead><tr>{['Período', 'Média / amostra', 'Cobertura', 'Ativos / exigíveis', 'Entregues', 'Variação', 'Inclusões / transferências'].map(t => <th key={t}>{t}</th>)}</tr></thead><tbody>
                    {points.map(p => <tr key={p.period}><td>{p.period}{p.partial && <span className="block text-xs text-amber-700">Parcial</span>}{!p.hasData && <span className="block text-xs">Sem registros</span>}</td>
                        <td>{formatPerformanceAverage(p.performanceAverage)}<span className="block text-xs">{performanceSampleLabel(p)} · {p.observedMonths} mês(es) avaliado(s)</span></td>
                        <td>{p.coveragePct == null ? 'Sem dados' : `${p.coveragePct.toLocaleString('pt-BR')}%`}<span className="block text-xs">{p.assessedEligibleCount ?? 0}/{p.eligibleCount ?? 0} avaliações</span></td>
                        <td>{p.activeProcessCount} / {p.eligibleCount ?? 0}<span className="block text-xs">{p.missingAssessmentCount ?? 0} sem avaliação vencida; {p.pendingAssessmentCount ?? 0} pendentes</span></td>
                        <td>{p.deliveredCount}<span className="block text-xs">{p.deliveryRatePct == null ? 'Sem dados' : `${p.deliveryRatePct}%`}</span></td>
                        <td>{p.deltaPoints == null ? 'Sem comparação' : `${p.deltaPoints > 0 ? '+' : ''}${p.deltaPoints} pontos`}<span className="block text-xs">Volume: {p.processVolumeDelta == null ? '—' : `${p.processVolumeDelta > 0 ? '+' : ''}${p.processVolumeDelta}`}</span></td><td>{p.newProcessCount ?? 'Limitado'} / {p.transferCount ?? 'Limitado'}</td></tr>)}
                </tbody></table></div>
                <p className="text-xs text-gray-500">{data.warnings.deadlinePolicy} Não aplicáveis e inativos ficam fora da cobertura. Inclusões/transferências contam eventos com evidência na data registrada.</p>
                <section className="space-y-3"><h3 className="font-semibold">Linha do tempo</h3>
                    <label className="block text-sm max-w-sm">Filtrar linha do tempo<select aria-label="Tipo de evento" className="input" value={eventType} onChange={e => { setEventType(e.target.value); setEventLimit(30); }}>
                        <option value="">Todos os eventos</option>{[...new Set(events.map(e => e.type))].sort().map(type => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}
                    </select></label>
                    {!displayedEvents.length && <p className="text-sm text-gray-500">Nenhum evento comprovado neste recorte. Datas de implantação não são presumidas a partir de importações.</p>}
                    {displayedEvents.slice(0, eventLimit).map(e => <article key={e.id} className="border-l-2 border-purple-300 pl-3 text-sm"><p className="font-medium">{formatEventDate(e.occurredAt)} · {e.type} {e.sector && `· ${e.sector}`}</p><p>{e.description}</p><p className="text-xs text-gray-500">{e.author} · {e.source}{e.reference && ` · Processo ${e.reference}`}</p></article>)}
                    {displayedEvents.length > eventLimit && <button className="btn-secondary" onClick={() => setEventLimit(n => n + 30)}>Mostrar mais eventos</button>}
                    {data.warnings.eventsTruncated && <p role="alert" className="text-sm text-amber-800">Lista limitada: reduza o intervalo para consultar os demais eventos.</p>}
                </section>
            </>}
            {notice && <p role="status" className="text-sm">{notice}</p>}
            {canManage && <details className="border rounded-lg p-4"><summary className="cursor-pointer font-medium">Registrar implantação ou marco</summary>
                <form className="grid sm:grid-cols-2 gap-3 mt-3" onSubmit={e => { e.preventDefault(); const form = e.currentTarget; const values = new FormData(form);
                    milestone.mutate({ sector: String(values.get('sector')), type: String(values.get('type')), description: String(values.get('description')),
                        occurredAt: `${values.get('day')}T12:00:00-04:00`, ...(values.get('process') ? { processId: String(values.get('process')) } : {}) }); }}>
                    <label className="text-sm">Setor<select name="sector" className="input" required defaultValue={sector}><option value="">Selecione</option>{scopes.map(s => <option key={s.name}>{s.name}</option>)}</select></label>
                    <label className="text-sm">Tipo<select name="type" className="input"><option value="IMPLANTACAO">Implantação</option><option value="MARCO">Marco operacional</option></select></label>
                    <label className="text-sm">Data (Cuiabá)<input name="day" type="date" className="input" required defaultValue={today} /></label>
                    <label className="text-sm">Processo (opcional)<select name="process" className="input"><option value="">Marco do setor</option>{records.map(r => <option key={r.id} value={r.id}>{recordLabel(r)}</option>)}</select></label>
                    <label className="text-sm sm:col-span-2">Descrição<textarea name="description" className="input" required maxLength={1000} /></label><button className="btn-primary justify-self-start" disabled={milestone.isPending}>Registrar marco</button>
                </form>
            </details>}
            {isMaster && <details className="border rounded-lg p-4"><summary className="cursor-pointer font-medium">Confirmar identidade entre competências</summary>
                <p className="text-sm mt-3">Use apenas quando os registros representam o mesmo processo. A prévia aponta conflitos e o número de competências afetadas. Códigos iguais não provam identidade.</p>
                <div className="grid sm:grid-cols-2 gap-3 mt-3">
                    <label className="text-sm">Processo a vincular<select aria-label="Processo a vincular" className="input" value={sourceId} onChange={e => { setSourceId(e.target.value); setPreview(null); }}><option value="">Selecione</option>{records.map(r => <option key={r.id} value={r.id}>{recordLabel(r)}</option>)}</select></label>
                    <label className="text-sm">Processo de referência<select aria-label="Processo de referência" className="input" value={referenceId} onChange={e => { setReferenceId(e.target.value); setPreview(null); }}><option value="">Selecione</option>{records.map(r => <option key={r.id} value={r.id}>{recordLabel(r)}</option>)}</select></label>
                    <label className="text-sm sm:col-span-2">Motivo do vínculo<textarea className="input" maxLength={1000} value={linkReason} onChange={e => { setLinkReason(e.target.value); setPreview(null); }} /></label>
                    <button className="btn-secondary justify-self-start" disabled={!sourceId || !referenceId || !linkReason.trim() || link.isPending} onClick={() => link.mutate(true)}>Revisar prévia do vínculo</button>
                </div>
                {preview && <div className="mt-3 text-sm space-y-2"><p>{preview.alreadyLinked ? 'Registros já vinculados.' : `${preview.sourceCount} competência(s) serão ligadas à carteira de referência (${preview.referenceCount} registros).`}</p>
                    {!!preview.conflicts.length && <p role="alert" className="text-red-700">Conflitos: {preview.conflicts.join(', ')}. Nenhuma alteração aplicada.</p>}
                    {!preview.alreadyLinked && !preview.conflicts.length && <button className="btn-primary" disabled={link.isPending} onClick={() => link.mutate(false)}>Confirmar vínculo revisado</button>}
                </div>}
            </details>}
            </details>
    </section>;
}
