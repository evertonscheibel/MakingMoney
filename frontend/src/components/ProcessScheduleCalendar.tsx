import { useAuth } from '../contexts';
import { UserRole } from '../types';
import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { processesApi } from '../api';
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, Info, X } from 'lucide-react';
import { Process, ProcessStatus } from '../types';

interface ProcessScheduleCalendarProps {
    processes: Process[];
    period: string;
    editable?: boolean;
}

const STATUS_STYLES: Record<ProcessStatus, string> = {
    [ProcessStatus.PENDING]: 'bg-gray-400',
    [ProcessStatus.ON_TIME]: 'bg-success-500',
    [ProcessStatus.LATE]: 'bg-warning-500',
    [ProcessStatus.CRITICAL]: 'bg-danger-500',
};

const STATUS_LABELS: Record<ProcessStatus, string> = {
    [ProcessStatus.PENDING]: 'Pendente',
    [ProcessStatus.ON_TIME]: 'No prazo',
    [ProcessStatus.LATE]: 'Atrasado',
    [ProcessStatus.CRITICAL]: 'Crítico',
};

const DATE_MARKERS = {
    planned: { label: 'Planejado', className: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700' },
    limit: { label: 'Limite', className: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800' },
    delivered: { label: 'Entregue', className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800' },
};

function dateKey(value: string | null): string | null {
    if (!value) return null;
    return value.includes('T') ? value.split('T')[0] : value.slice(0, 10);
}

export default function ProcessScheduleCalendar({ processes, period, editable: cycleEditable = true }: ProcessScheduleCalendarProps) {
    const {user} = useAuth();
    const editable = cycleEditable && !user?.roles.includes(UserRole.OPERATOR);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const selected = processes.find(process => process._id === selectedId);
    const today = new Date();
    const isToday = (day: number) => year === today.getFullYear() && month === today.getMonth() + 1 && day === today.getDate();
    const formatDate = (value: string | null) => value ? new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Não informada';
    const [errorMessage, setErrorMessage] = useState('');
    const queryClient = useQueryClient();
    const [dragged, setDragged] = useState<{ processId: string; field: 'plannedDate' | 'limitDate' } | null>(null);
    const reschedule = useMutation({
        mutationFn: ({ processId, field, date }: { processId: string; field: 'plannedDate' | 'limitDate'; date: string }) => processesApi.update(processId, { [field]: date }),
        onSuccess: () => { setErrorMessage(''); queryClient.invalidateQueries({ queryKey: ['extract'] }); queryClient.invalidateQueries({ queryKey: ['summary'] }); queryClient.invalidateQueries({ queryKey: ['processes'] }); queryClient.invalidateQueries({ queryKey: ['myMetrics'] }); queryClient.invalidateQueries({ queryKey: ['teamMetrics'] }); queryClient.invalidateQueries({ queryKey: ['sectorRanking'] }); },
        onError: (error: any) => setErrorMessage(error?.message || 'Não foi possível reagendar o processo.'),
    });
    const [year, month] = period.split('-').map(Number);
    const validPeriod = Number.isFinite(year) && Number.isFinite(month) && month >= 1 && month <= 12;
    const daysInMonth = validPeriod ? new Date(year, month, 0).getDate() : 0;
    const days = Array.from({ length: daysInMonth }, (_, index) => index + 1);
    const sortedProcesses = useMemo(
        () => [...processes].sort((a, b) => a.code.localeCompare(b.code, 'pt-BR', { numeric: true })),
        [processes],
    );
    const monthLabel = validPeriod
        ? new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        : period;
    const concentration = useMemo(() => days.map(day => {
        const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return processes.filter(p => dateKey(p.plannedDate) === key || dateKey(p.limitDate) === key).length;
    }), [daysInMonth, month, processes, year]);
    const maxConcentration = Math.max(1, ...concentration);

    if (!validPeriod) {
        return <div className="card text-center text-gray-500 py-12">Selecione um ciclo para visualizar o cronograma.</div>;
    }

    return (
        <section className="card print:shadow-none print:border" aria-label="Cronograma de processos">
            {errorMessage && <p role="alert" className="text-red-600 mb-3">{errorMessage}</p>}
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between mb-5">
                <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary-50 dark:bg-primary-900/30 p-2.5">
                        <CalendarDays className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Cronograma de Processos</h2>
                        <p className="text-sm text-gray-500 capitalize">{monthLabel} · {processes.length} processos</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-600 dark:text-gray-400">
                    {Object.entries(DATE_MARKERS).map(([key, marker]) => (
                        <span key={key} className="flex items-center gap-1.5">
                            <span className={`w-5 h-5 rounded border flex items-center justify-center font-bold ${marker.className}`}>
                                {key === 'planned' ? 'P' : key === 'limit' ? 'L' : 'E'}
                            </span>
                            {marker.label}
                        </span>
                    ))}
                </div>
            </div>

            {selected && (
                <aside className="mb-5 rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-900/10 p-4" aria-label="Detalhes do processo selecionado">
                    <div className="flex items-start justify-between gap-3">
                        <div><p className="section-label">{selected.code} · {selected.sector}</p><h3 className="mt-1 font-semibold text-gray-900 dark:text-white">{selected.title}</h3></div>
                        <button type="button" className="header-action" aria-label="Fechar detalhes do processo" onClick={() => setSelectedId(null)}><X className="w-4 h-4" /></button>
                    </div>
                    <dl className="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-4 text-sm">
                        <div><dt className="section-label">Responsável</dt><dd className="mt-1">{typeof selected.responsibleUserId === 'object' && selected.responsibleUserId ? selected.responsibleUserId.name : selected.owner || 'Não informado'}</dd></div>
                        <div><dt className="section-label">Planejado</dt><dd className="mt-1">{formatDate(selected.plannedDate)}</dd></div>
                        <div><dt className="section-label">Limite</dt><dd className="mt-1">{formatDate(selected.limitDate)}</dd></div>
                        <div><dt className="section-label">Entrega</dt><dd className="mt-1">{formatDate(selected.deliveryDate)}</dd></div>
                        <div><dt className="section-label">Status</dt><dd className="mt-1">{STATUS_LABELS[selected.status]}</dd></div>
                    </dl>
                </aside>
            )}

            {sortedProcesses.length === 0 ? (
                <div className="rounded-lg border border-dashed py-14 text-center">
                    <CalendarDays className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="font-medium text-gray-600 dark:text-gray-300">Nenhum processo neste período</p>
                    <p className="text-sm text-gray-400">Ajuste os filtros para consultar outro cronograma.</p>
                </div>
            ) : (
                <div className="overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg max-h-[620px] scrollbar-thin">
                    <div className="min-w-max">
                        <div className="flex sticky top-0 z-30 shadow-sm">
                            <div className="w-40 sm:w-64 flex-shrink-0 sticky left-0 z-40 px-3 py-2.5 bg-gray-100 dark:bg-gray-800 border-r border-b font-semibold text-xs uppercase tracking-wider text-gray-600 dark:text-gray-300">
                                Processo
                            </div>
                            {days.map(day => {
                                const date = new Date(year, month - 1, day);
                                const weekend = date.getDay() === 0 || date.getDay() === 6;
                                const count = concentration[day - 1];
                                return (
                                    <div key={day} aria-current={isToday(day) ? "date" : undefined} className={`w-12 flex-shrink-0 py-2 text-center border-r border-b ${isToday(day) ? 'bg-primary-100 dark:bg-primary-900 ring-1 ring-inset ring-primary-500' : weekend ? 'bg-gray-200 dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-800'}`}>
                                        <span className="block text-[10px] uppercase text-gray-400">{date.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3)}</span>
                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{day}</span>
                                        {count > 0 && <span title={`${count} entregas ou limites`} className={`mx-auto mt-1 block w-6 rounded-full text-[9px] font-bold ${count >= maxConcentration * .7 ? 'bg-red-100 text-red-700' : count >= maxConcentration * .4 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>{count}</span>}
                                    </div>
                                );
                            })}
                        </div>

                        {sortedProcesses.map(process => (
                            <div key={process._id} className="flex group">
                                <div className="w-40 sm:w-64 min-h-16 flex-shrink-0 sticky left-0 z-20 bg-white dark:bg-gray-900 group-hover:bg-gray-50 dark:group-hover:bg-gray-800 border-r border-b px-3 py-2 shadow-[4px_0_8px_-6px_rgba(0,0,0,0.35)]">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_STYLES[process.status]}`} title={STATUS_LABELS[process.status]} />
                                        <span className="font-mono text-[11px] font-semibold text-gray-500">{process.code}</span>
                                        <span className="text-[10px] text-gray-400 truncate">{process.sector}</span>
                                    </div>
                                    <button type="button" onClick={() => setSelectedId(process._id)} aria-pressed={selectedId === process._id} className="text-left text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-2 mt-1 hover:text-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500" title={process.title}>{process.title}</button>
                                </div>
                                {days.map(day => {
                                    const date = new Date(year, month - 1, day);
                                    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                    const weekend = date.getDay() === 0 || date.getDay() === 6;
                                    const markers = [
                                        dateKey(process.plannedDate) === key && { code: 'P', ...DATE_MARKERS.planned },
                                        dateKey(process.limitDate) === key && { code: 'L', ...DATE_MARKERS.limit },
                                        dateKey(process.deliveryDate) === key && { code: 'E', ...DATE_MARKERS.delivered },
                                    ].filter(Boolean) as Array<{ code: string; label: string; className: string }>;
                                    return (
                                        <div key={day} onDragOver={(e)=>e.preventDefault()} onDrop={() => { if (dragged) reschedule.mutate({ processId: dragged.processId, field: dragged.field, date: key }); setDragged(null); }} className={`w-12 min-h-16 flex-shrink-0 border-r border-b flex flex-wrap content-center justify-center gap-0.5 p-0.5 group-hover:bg-primary-50/40 dark:group-hover:bg-primary-900/10 ${isToday(day) ? 'bg-primary-50 dark:bg-primary-900/20' : weekend ? 'bg-gray-50 dark:bg-gray-800/40' : 'bg-white dark:bg-gray-900'} ${dragged ? 'hover:ring-2 hover:ring-primary-500' : ''}`}>
                                            {markers.map(marker => (
                                                <button type="button" onClick={() => setSelectedId(process._id)} aria-label={`${marker.label}: ${process.title}`} draggable={editable && marker.code !== 'E'} onDragStart={() => editable && marker.code !== 'E' && setDragged({processId: process._id, field: marker.code === 'P' ? 'plannedDate' : 'limitDate'})} onDragEnd={()=>setDragged(null)} key={marker.code} title={`${marker.label}: ${process.title}${editable && marker.code !== 'E' ? ' — arraste para reagendar' : ''}`} className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-bold ${editable && marker.code !== 'E' ? 'cursor-grab' : 'cursor-help'} ${marker.className}`}>
                                                    {marker.code}
                                                </button>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> {editable ? 'Selecione um evento para ver detalhes. Arraste P ou L para reagendar e notificar os gestores.' : 'Selecione um evento para ver os detalhes do processo.'}</span>
                <span className="flex flex-wrap gap-3">
                    <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-success-500" /> No prazo</span>
                    <span className="flex items-center gap-1"><Clock3 className="w-3.5 h-3.5 text-warning-500" /> Atrasado</span>
                    <span className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-danger-500" /> Crítico</span>
                </span>
            </div>
        </section>
    );
}
