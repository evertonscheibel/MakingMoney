import { useMemo } from 'react';
import { Process, ProcessStatus } from '../types';
import {
    Calendar,
    Clock,
    AlertTriangle,
    CheckCircle2,
    Info,
} from 'lucide-react';

interface CronogramaGlobalProps {
    processes: Process[];
    period: string; // YYYY-MM
}

export default function CronogramaGlobal({ processes, period }: CronogramaGlobalProps) {
    const [year, month] = period.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);



    const getProcessStatusColor = (status: ProcessStatus) => {
        switch (status) {
            case ProcessStatus.ON_TIME:
                return 'bg-success-500';
            case ProcessStatus.LATE:
                return 'bg-warning-500';
            case ProcessStatus.CRITICAL:
                return 'bg-danger-500';
            default:
                return 'bg-gray-400';
        }
    };

    const getStatusIcon = (status: ProcessStatus) => {
        switch (status) {
            case ProcessStatus.ON_TIME:
                return <CheckCircle2 className="w-3 h-3 text-white" />;
            case ProcessStatus.LATE:
                return <Clock className="w-3 h-3 text-white" />;
            case ProcessStatus.CRITICAL:
                return <AlertTriangle className="w-3 h-3 text-white" />;
            default:
                return null;
        }
    };

    return (
        <div className="card overflow-hidden flex flex-col h-[500px]">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary-600" />
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Cronograma Global de Processos
                    </h2>
                </div>
                <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                        <span className="flex items-center justify-center w-5 h-5 rounded bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200">1</span>
                        <span className="text-gray-600 dark:text-gray-400">Planejada</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="flex items-center justify-center w-5 h-5 rounded bg-orange-100 text-orange-700 text-xs font-bold border border-orange-200">2</span>
                        <span className="text-gray-600 dark:text-gray-400">Limite</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="flex items-center justify-center w-5 h-5 rounded bg-green-100 text-green-700 text-xs font-bold border border-green-200">3</span>
                        <span className="text-gray-600 dark:text-gray-400">Entregue</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto border border-gray-300 dark:border-gray-600 rounded-lg relative shadow-sm">
                <div className="min-w-max">
                    {/* Header: Days */}
                    <div className="flex sticky top-0 z-20 shadow-sm">
                        <div className="w-64 bg-gray-100 dark:bg-gray-700 border-b border-r border-gray-300 dark:border-gray-600 p-2 font-bold text-xs text-gray-700 dark:text-gray-200 sticky left-0 z-30">
                            Processo
                        </div>
                        {days.map((day) => {
                            const date = new Date(year, month - 1, day);
                            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                            return (
                                <div
                                    key={day}
                                    className={`w-12 flex-shrink-0 border-b border-r border-gray-300 dark:border-gray-600 p-2 text-center font-bold text-xs ${isWeekend ? 'bg-gray-200/70 dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-800'
                                        } text-gray-700 dark:text-gray-300`}
                                >
                                    {day}
                                </div>
                            );
                        })}
                    </div>

                    {/* Body: Processes */}
                    {processes.length > 0 ? (
                        processes
                            .sort((a, b) => a.code.localeCompare(b.code))
                            .map((process) => (
                                <div key={process._id} className="flex">
                                    <div className="w-64 bg-white dark:bg-gray-800 border-b border-r border-gray-300 dark:border-gray-600 p-2 font-semibold text-xs text-gray-800 dark:text-gray-200 sticky left-0 z-10 flex items-center shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)] truncate" title={`[${process.code}] ${process.title} - ${process.sector}`}>
                                        <div className="flex flex-col">
                                            <span>[{process.code}] {process.title}</span>
                                            <span className="text-[10px] text-gray-500 font-normal">{process.sector}</span>
                                        </div>
                                    </div>
                                    {days.map((day) => {
                                        const date = new Date(year, month - 1, day);
                                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                                        // Helper to format date as YYYY-MM-DD for comparison
                                        const formatDateKey = (date: Date | string | null | undefined) => {
                                            if (!date) return null;
                                            const d = new Date(date);
                                            // Adjust for UTC to avoid timezone shifts if the backend sends UTC midnight
                                            // Assuming backend sends YYYY-MM-DD or ISO.
                                            // Best way: Use UTC methods or string manipulation if ISO.
                                            // Let's use simple string slice if it's an ISO string, otherwise UTC.
                                            if (typeof date === 'string' && date.includes('T')) {
                                                return date.split('T')[0];
                                            }
                                            // Fallback for Date objects or simple strings
                                            return d.toISOString().split('T')[0];
                                        };

                                        const todayKey = new Date(year, month - 1, day).toLocaleDateString('en-CA'); // YYYY-MM-DD in local time works if we constructed it from local year/month/day
                                        // Actually, let's construct "targetKey" safely.
                                        // The 'days' loop uses 'new Date(year, month-1, day)'. This creates a local midnight date.
                                        // We should align everything to local or everything to UTC.
                                        // Backend dates usually come as ISO UTC (e.g. 2026-02-25T00:00:00.000Z).
                                        // If we display 25th, we mean 25th.

                                        const targetDateObj = new Date(year, month - 1, day);
                                        const targetYear = targetDateObj.getFullYear();
                                        const targetMonth = targetDateObj.getMonth();
                                        const targetDay = targetDateObj.getDate();

                                        const checkDate = (d: string | Date | null) => {
                                            if (!d) return false;

                                            // Format incoming date to YYYY-MM-DD in UTC
                                            const incomingDate = new Date(d);
                                            const incomingDateStr = incomingDate.toISOString().split('T')[0];

                                            // Construct target date string for this specific day
                                            // Month is 0-indexed in Date constructor, so +1 is not needed if we want YYYY-MM-DD
                                            const targetDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

                                            return incomingDateStr === targetDateStr;
                                        };

                                        const isPlanned = checkDate(process.plannedDate);
                                        const isLimit = checkDate(process.limitDate);
                                        const isDelivered = checkDate(process.deliveryDate);

                                        const markers = [];
                                        if (isPlanned) markers.push({ num: '1', color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Planejada' });
                                        if (isLimit) markers.push({ num: '2', color: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Limite' });
                                        if (isDelivered) markers.push({ num: '3', color: 'bg-green-100 text-green-700 border-green-200', label: 'Entregue' });

                                        return (
                                            <div
                                                key={day}
                                                className={`w-12 min-h-[3.5rem] h-auto flex-shrink-0 border-b border-r border-gray-300 dark:border-gray-600 relative p-0.5 ${isWeekend ? 'bg-gray-100 dark:bg-gray-800/40' : 'bg-white dark:bg-gray-900'
                                                    } hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex flex-wrap items-center justify-center content-center gap-0.5`}
                                            >
                                                {markers.map((m) => (
                                                    <div
                                                        key={m.num}
                                                        className={`group relative w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold border ${m.color} cursor-help shadow-sm hover:scale-110 transition-transform z-10`}
                                                    >
                                                        {m.num}

                                                        {/* Tooltip */}
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max p-1.5 bg-gray-900 text-white text-[10px] rounded shadow-lg hidden group-hover:block z-50 pointer-events-none whitespace-nowrap">
                                                            <p className="font-semibold">{m.label}</p>
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))
                    ) : (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                            Nenhum processo planejado para este período.
                        </div>
                    )}
                </div>
            </div>
            <div className="mt-4 flex-shrink-0 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <Info className="w-3 h-3" />
                Dica: Passe o mouse sobre os itens para ver detalhes do processo. Use o scroll para navegar.
            </div>
        </div>
    );
}

