import { useMemo } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, Info } from 'lucide-react';
import { Process, ProcessStatus } from '../types';

interface ProcessScheduleCalendarProps {
    processes: Process[];
    period: string;
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
    planned: { label: 'Planejado', className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800' },
    limit: { label: 'Limite', className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800' },
    delivered: { label: 'Entregue', className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800' },
};

function dateKey(value: string | null): string | null {
    if (!value) return null;
    return value.includes('T') ? value.split('T')[0] : value.slice(0, 10);
}

export default function ProcessScheduleCalendar({ processes, period }: ProcessScheduleCalendarProps) {
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

    if (!validPeriod) {
        return <div className="card text-center text-gray-500 py-12">Selecione um ciclo para visualizar o cronograma.</div>;
    }

    return (
        <section className="card print:shadow-none print:border" aria-label="Cronograma de processos">
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
                            <div className="w-72 flex-shrink-0 sticky left-0 z-40 px-3 py-2.5 bg-gray-100 dark:bg-gray-800 border-r border-b font-semibold text-xs uppercase tracking-wider text-gray-600 dark:text-gray-300">
                                Processo
                            </div>
                            {days.map(day => {
                                const date = new Date(year, month - 1, day);
                                const weekend = date.getDay() === 0 || date.getDay() === 6;
                                return (
                                    <div key={day} className={`w-12 flex-shrink-0 py-2 text-center border-r border-b ${weekend ? 'bg-gray-200 dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-800'}`}>
                                        <span className="block text-[10px] uppercase text-gray-400">{date.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3)}</span>
                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{day}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {sortedProcesses.map(process => (
                            <div key={process._id} className="flex group">
                                <div className="w-72 min-h-16 flex-shrink-0 sticky left-0 z-20 bg-white dark:bg-gray-900 group-hover:bg-gray-50 dark:group-hover:bg-gray-800 border-r border-b px-3 py-2 shadow-[4px_0_8px_-6px_rgba(0,0,0,0.35)]">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_STYLES[process.status]}`} title={STATUS_LABELS[process.status]} />
                                        <span className="font-mono text-[11px] font-semibold text-gray-500">{process.code}</span>
                                        <span className="text-[10px] text-gray-400 truncate">{process.sector}</span>
                                    </div>
                                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200 line-clamp-2 mt-1" title={process.title}>{process.title}</p>
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
                                        <div key={day} className={`w-12 min-h-16 flex-shrink-0 border-r border-b flex flex-wrap content-center justify-center gap-0.5 p-0.5 group-hover:bg-primary-50/40 dark:group-hover:bg-primary-900/10 ${weekend ? 'bg-gray-50 dark:bg-gray-800/40' : 'bg-white dark:bg-gray-900'}`}>
                                            {markers.map(marker => (
                                                <span key={marker.code} title={`${marker.label}: ${process.title}`} className={`w-5 h-5 rounded border flex items-center justify-center text-[10px] font-bold cursor-help ${marker.className}`}>
                                                    {marker.code}
                                                </span>
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
                <span className="flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Role horizontalmente para navegar pelos dias.</span>
                <span className="flex flex-wrap gap-3">
                    <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-success-500" /> No prazo</span>
                    <span className="flex items-center gap-1"><Clock3 className="w-3.5 h-3.5 text-warning-500" /> Atrasado</span>
                    <span className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-danger-500" /> Crítico</span>
                </span>
            </div>
        </section>
    );
}
