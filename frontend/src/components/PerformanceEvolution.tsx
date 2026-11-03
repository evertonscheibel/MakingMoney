import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { Company } from '../types';
import type { EvolutionReport } from '../types/evolution';
import { UserRole } from '../types';
import { useAuth } from '../contexts';
import { apiCall } from '../api/client';
import { usersApi } from '../api';
import { getAccessibleSectors } from '../utils/companyAccess';
import { formatPerformanceAverage, performanceSampleLabel } from '../utils/performance';
import { formatEventDate, eventMonth } from '../utils/evolutionDates';
import { buildEvolutionPDF } from '../utils/evolutionPdfExport';
import ReportActions from './ReportActions';

export default function PerformanceEvolution({ company, sector }: { company?: Company; sector: string }) {
    const { user } = useAuth(), client = useQueryClient();
    const [open, setOpen] = useState(true);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const [from, setFrom] = useState(`${today.slice(0, 4)}-01`), [to, setTo] = useState(today.slice(0, 7));
    const [groupBy, setGroupBy] = useState('month'), [userId, setUserId] = useState('');
    const [processId, setProcessId] = useState(''), [category, setCategory] = useState('');
    const [compareFrom, setCompareFrom] = useState(''), [compareTo, setCompareTo] = useState(''), [equivalent, setEquivalent] = useState(true);
    const [eventLimit, setEventLimit] = useState(30), [notice, setNotice] = useState('');
    const [eventType, setEventType] = useState('');
    const [sourceId, setSourceId] = useState(''), [referenceId, setReferenceId] = useState(''), [linkReason, setLinkReason] = useState('');
    const [preview, setPreview] = useState<{ sourceCount: number; referenceCount: number; conflicts: string[]; alreadyLinked?: boolean } | null>(null);
    useEffect(() => { setProcessId(''); setCategory(''); setSourceId(''); setReferenceId(''); setPreview(null); }, [sector, user?.activeCompanyId]);
    const isMaster = user?.roles.includes(UserRole.MASTER), canManage = isMaster || user?.roles.includes(UserRole.MANAGER);
    const params = { from, to, groupBy, sector: sector || undefined, userId: userId || undefined,
        processId: processId || undefined, category: category || undefined, compareFrom: compareFrom || undefined,
        compareTo: compareTo || undefined, equivalent: String(equivalent) };
    const { data, isFetching, isError, error } = useQuery({ queryKey: ['performance-evolution', user?.activeCompanyId, params],
        queryFn: () => apiCall<EvolutionReport>('get', '/reports/performance-history', params), enabled: open && !!user?.activeCompanyId });
    const { data: users } = useQuery({ queryKey: ['users', user?.activeCompanyId], queryFn: () => usersApi.list(), enabled: open });
    const records = data?.records || [], points = data?.series || [], events = data?.events || [];
    const displayedEvents = eventType ? events.filter(e => e.type === eventType) : events;
    const scopes = getAccessibleSectors(user, company);
    const comparison = data?.comparison;
    const invalidate = () => client.invalidateQueries({ queryKey: ['performance-evolution'] });
    const milestone = useMutation({ mutationFn: (payload: Record<string, string>) => apiCall('post', '/reports/milestones', payload),
        onSuccess: () => { setNotice('Marco registrado.'); invalidate(); }, onError: (e: Error) => setNotice(e.message) });
    const link = useMutation({ mutationFn: (dryRun: boolean) => apiCall<{ sourceCount: number; referenceCount: number; conflicts: string[]; alreadyLinked?: boolean }>('post', `/processes/${sourceId}/lineage`, {
        referenceProcessId: referenceId, reason: linkReason, dryRun, expectedCount: preview?.sourceCount,
    }), onSuccess: (result, dryRun) => { if (dryRun) setPreview(result); else { setPreview(null); setNotice('Vínculo histórico confirmado. Notas e snapshots preservados.'); invalidate(); } },
    onError: (e: Error) => setNotice(e.message) });
    const resetComparison = () => { setCompareFrom(''); setCompareTo(''); };
    const recordLabel = (r: typeof records[number]) => `${r.month} · ${r.sector} · ${r.code} — ${r.title}`;
    const markers = [...new Set(displayedEvents.map(e => {
        const month = eventMonth(e.occurredAt);
        return groupBy === 'quarter' ? `${month.slice(0, 4)}-Q${Math.ceil(Number(month.slice(5)) / 3)}` : month;
    }))];
    return <details open className="card space-y-4" onToggle={e => setOpen(e.currentTarget.open)}>
        <summary className="cursor-pointer font-semibold text-lg">Evolução mensal/trimestral, carteira e marcos</summary>
        {open && <>
            <p className="text-sm text-gray-500">Competência pelo ciclo. Média por nota válida; entregas e cobertura de avaliações são indicadores separados. No trimestre, volumes somam ocorrências por competência; carteira comum conta processos distintos. Variações de volume não demonstram causa de desempenho.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <label className="text-sm">De<input aria-label="Evolução de" type="month" className="input" value={from} onChange={e => { setFrom(e.target.value); resetComparison(); }} /></label>
                <label className="text-sm">Até<input aria-label="Evolução até" type="month" className="input" value={to} onChange={e => { setTo(e.target.value); resetComparison(); }} /></label>
                <label className="text-sm">Agrupar<select className="input" aria-label="Agrupamento da evolução" value={groupBy} onChange={e => { setGroupBy(e.target.value); resetComparison(); }}><option value="month">Mês</option><option value="quarter">Trimestre</option></select></label>
                <label className="text-sm">Colaborador<select className="input" value={userId} onChange={e => { setUserId(e.target.value); setProcessId(''); }}><option value="">Todos autorizados</option>{users?.map(u => <option key={u._id || u.id} value={u._id || u.id}>{u.name}</option>)}</select></label>
                <label className="text-sm">Processo<select className="input" value={processId} onChange={e => setProcessId(e.target.value)}><option value="">Todos do recorte</option>{records.map(r => <option key={r.id} value={r.id}>{recordLabel(r)}</option>)}</select></label>
                <label className="text-sm">Categoria<input className="input" maxLength={100} list="evolution-categories" value={category} onChange={e => setCategory(e.target.value)} /><datalist id="evolution-categories">{data?.categories?.map(c => <option key={c} value={c} />)}</datalist></label>
            </div>
            {isFetching && <p role="status" className="text-sm">Atualizando evolução…</p>}
            {isError && <p role="alert" className="text-red-700">{error.message}</p>}
            {data?.series && <>
                <ReportActions build={() => buildEvolutionPDF({ ...data, events: displayedEvents }, company?.name || 'Empresa', [sector || 'Setores autorizados', users?.find(u => (u._id || u.id) === userId)?.name, category, eventType && `Eventos: ${eventType}`].filter(Boolean).join(' · '), user?.name)} filename={`chronos-evolucao-${from}-${to}.pdf`} disabled={isFetching || isError}
                    emailContext={{ title: 'Evolução de desempenho', period: `${from} a ${to}`, sector }} />
                {(!!data.warnings.unconfirmedLineageCount || !!data.warnings.legacyResponsibilityCount) && <p className="text-sm text-amber-800 bg-amber-50 rounded p-3">
                    {data.warnings.unconfirmedLineageCount} registros sem identidade histórica confirmada; {data.warnings.legacyResponsibilityCount} notas usam o responsável do documento legado. Novas avaliações preservam o responsável registrado na entrega.
                </p>}
                <div className="h-80 w-full" aria-label="Gráfico de desempenho, cobertura e volume">
                    <ResponsiveContainer width="100%" height="100%"><ComposedChart data={points} margin={{ top: 20, right: 10, left: 0, bottom: 15 }}>
                        <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" tick={{ fontSize: 11 }} minTickGap={16} tickFormatter={value => String(value).includes('Q') ? `${String(value).slice(5)}/${String(value).slice(2, 4)}` : `${String(value).slice(5)}/${String(value).slice(2, 4)}`} />
                        <YAxis yAxisId="score" width={36} domain={[0, 100]} tick={{ fontSize: 11 }} /><YAxis yAxisId="volume" width={32} orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip /><Legend height={60} iconSize={10} wrapperStyle={{ fontSize: 11 }} /><Bar yAxisId="volume" dataKey="activeProcessCount" name="Processos ativos" fill="#cbd5e1" isAnimationActive={false} maxBarSize={40} />
                        <Line yAxisId="score" dataKey="performanceAverage" name="Média (0–100)" stroke="#15803d" strokeWidth={2} connectNulls={false} isAnimationActive={false} />
                        <Line yAxisId="score" dataKey="coveragePct" name="Cobertura de avaliações (%)" stroke="#2563eb" strokeDasharray="4 4" connectNulls={false} isAnimationActive={false} />
                        {markers.map(period => <ReferenceLine key={period} x={period} yAxisId="score" stroke="#a855f7" strokeDasharray="2 4" label={{ value: 'Evento', position: 'insideTop' }} />)}
                    </ComposedChart></ResponsiveContainer>
                </div>
                <div className="overflow-x-auto"><table className="table text-sm"><thead><tr>{['Período', 'Média / amostra', 'Cobertura', 'Ativos / exigíveis', 'Entregues', 'Variação', 'Inclusões / transferências'].map(t => <th key={t}>{t}</th>)}</tr></thead><tbody>
                    {points.map(p => <tr key={p.period}><td>{p.period}{p.partial && <span className="block text-xs text-amber-700">Parcial</span>}{!p.hasData && <span className="block text-xs">Sem registros</span>}</td>
                        <td>{formatPerformanceAverage(p.performanceAverage)}<span className="block text-xs">{performanceSampleLabel(p)} · {p.observedMonths} mês(es) avaliado(s)</span></td>
                        <td>{p.coveragePct == null ? 'Sem dados' : `${p.coveragePct.toLocaleString('pt-BR')}%`}<span className="block text-xs">{p.assessedEligibleCount ?? 0}/{p.eligibleCount ?? 0} avaliações</span></td>
                        <td>{p.activeProcessCount} / {p.eligibleCount ?? 0}<span className="block text-xs">{p.missingAssessmentCount ?? 0} sem avaliação vencida; {p.pendingAssessmentCount ?? 0} pendentes</span></td>
                        <td>{p.deliveredCount}<span className="block text-xs">{p.deliveryRatePct == null ? 'Sem dados' : `${p.deliveryRatePct}%`}</span></td>
                        <td>{p.deltaPoints == null ? 'Sem comparação' : `${p.deltaPoints > 0 ? '+' : ''}${p.deltaPoints} pontos`}<span className="block text-xs">Volume: {p.processVolumeDelta == null ? '—' : `${p.processVolumeDelta > 0 ? '+' : ''}${p.processVolumeDelta}`}</span></td><td>{p.newProcessCount ?? 'Limitado'} / {p.transferCount ?? 'Limitado'}</td></tr>)}
                </tbody></table></div>
                <p className="text-xs text-gray-500">{data.warnings.deadlinePolicy} Não aplicáveis e inativos ficam fora da cobertura. Inclusões/transferências contam eventos com evidência na data registrada.</p>
                <section className="rounded-lg border p-4 space-y-3"><h3 className="font-semibold">Comparar períodos</h3><div className="flex flex-wrap gap-3">
                    <label className="text-sm">Anterior<select aria-label="Período anterior" className="input" value={compareFrom || comparison?.from || ''} onChange={e => setCompareFrom(e.target.value)}>{points.map(p => <option key={p.period} value={p.period}>{p.period}</option>)}</select></label>
                    <label className="text-sm">Atual<select aria-label="Período atual" className="input" value={compareTo || comparison?.to || ''} onChange={e => setCompareTo(e.target.value)}>{points.map(p => <option key={p.period} value={p.period}>{p.period}</option>)}</select></label>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={equivalent} onChange={e => setEquivalent(e.target.checked)} />Somente carteira equivalente</label></div>
                    {comparison ? <><p>{formatPerformanceAverage(comparison.previous.performanceAverage)} → {formatPerformanceAverage(comparison.current.performanceAverage)} · {comparison.deltaPoints == null ? 'Sem dados para variação' : `${comparison.deltaPoints > 0 ? '+' : ''}${comparison.deltaPoints} pontos na escala 0–100`}. Carteira comum: {comparison.commonProcessCount} processos.</p>
                        {(comparison.compositionChanged || comparison.partialPeriods) && <p className="text-sm text-amber-800">A carteira mudou ou há período parcial. Confira amostra e exclusões antes de comparar.</p>}
                        <details><summary className="cursor-pointer text-sm">Itens fora da carteira comum ({comparison.excluded.length})</summary><ul className="max-h-60 overflow-auto text-sm space-y-1">{comparison.excluded.map((r, i) => <li key={`${r.processId}-${i}`}>{r.period} · {r.code} · {r.title}: {r.reason.replaceAll('_', ' ').toLowerCase()}</li>)}</ul></details></>
                        : <p className="text-sm">Selecione um intervalo com pelo menos dois períodos.</p>}
                </section>
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
        </>}
    </details>;
}
