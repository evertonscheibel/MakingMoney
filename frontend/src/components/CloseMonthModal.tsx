import { useState, useEffect } from 'react';
import { cyclesApi } from '../api';
import { XCircle, Calendar, AlertTriangle, Save, Loader } from 'lucide-react';

interface PreviewProcess {
    originalId: string;
    code: string;
    title: string;
    sector: string;
    owner: string;
    currentPlannedDate: string;
    currentLimitDate: string;
    currentDeliveryDate: string | null;
    newPlannedDate: string;
    newLimitDate: string;
}

interface CloseMonthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (overrides: any[], openNext: boolean) => void;
    isConfirming: boolean;
    sector?: string;
}

export default function CloseMonthModal({ isOpen, onClose, onConfirm, isConfirming, sector }: CloseMonthModalProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [nextMonth, setNextMonth] = useState('');
    const [processes, setProcesses] = useState<PreviewProcess[]>([]);
    const [editedProcesses, setEditedProcesses] = useState<Record<string, { planned: string; limit: string }>>({});
    const [openNext, setOpenNext] = useState(true);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            setError(null);
            cyclesApi.previewClose(sector)
                .then((data) => {
                    setNextMonth(data.nextMonth);
                    setProcesses(data.processes);
                    setLoading(false);
                })
                .catch((err) => {
                    console.error('Error fetching cycle preview:', err);
                    setError('Erro ao carregar pré-visualização do fechamento.');
                    setLoading(false);
                });
        } else {
            setProcesses([]);
            setEditedProcesses({});
        }
    }, [isOpen, sector]);

    if (!isOpen) return null;

    const handleDateChange = (id: string, field: 'planned' | 'limit', value: string) => {
        setEditedProcesses((prev) => {
            const current = prev[id] || {
                planned: processes.find(p => p.originalId === id)?.newPlannedDate || '',
                limit: processes.find(p => p.originalId === id)?.newLimitDate || ''
            };
            return {
                ...prev,
                [id]: { ...current, [field]: value }
            };
        });
    };

    const handleConfirm = () => {
        // Collect overrides
        const overrides = Object.entries(editedProcesses).map(([id, dates]) => ({
            originalId: id,
            plannedDate: dates.planned,
            limitDate: dates.limit
        }));
        onConfirm(overrides, openNext);
    };

    // Format date for input type="date" (YYYY-MM-DD)
    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        return new Date(dateStr).toISOString().split('T')[0];
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Fechar Mês e Clonar Processos</h2>
                        <p className="text-sm text-gray-500">
                            Próximo Ciclo: <span className="font-semibold text-primary-600">{nextMonth}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                        <XCircle className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-40 gap-3">
                            <Loader className="w-8 h-8 text-primary-600 animate-spin" />
                            <p className="text-gray-500">Calculando datas para o próximo ciclo...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-40 gap-3 text-danger-600">
                            <AlertTriangle className="w-8 h-8" />
                            <p>{error}</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-3">
                                <Calendar className="w-5 h-5 text-blue-600 mt-0.5" />
                                <div>
                                    <h3 className="font-medium text-blue-900">Revisão de Datas</h3>
                                    <p className="text-sm text-blue-700">
                                        O sistema calculou automaticamente as datas para o próximo mês.
                                        Você pode ajustá-las manualmente abaixo se necessário.Processos não recorrentes não serão clonados.
                                    </p>
                                </div>
                            </div>

                            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-700 font-medium">
                                        <tr>
                                            <th className="px-4 py-3">Processo</th>
                                            <th className="px-4 py-3">Responsável</th>
                                            <th className="px-4 py-3">Data Planejada (Novo)</th>
                                            <th className="px-4 py-3">Data Limite (Novo)</th>
                                            <th className="px-4 py-3 text-center">Entrega Atu.</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {processes.map((p) => {
                                            const edited = editedProcesses[p.originalId];
                                            const plannedVal = edited?.planned ? formatDate(edited.planned) : formatDate(p.newPlannedDate);
                                            const limitVal = edited?.limit ? formatDate(edited.limit) : formatDate(p.newLimitDate);

                                            return (
                                                <tr key={p.originalId} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium text-gray-900">{p.code} - {p.title}</div>
                                                        <div className="text-xs text-gray-500">{p.sector}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-600">
                                                        {p.owner || '-'}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="date"
                                                            value={plannedVal}
                                                            onChange={(e) => handleDateChange(p.originalId, 'planned', e.target.value)}
                                                            className={`input py-1 px-2 text-sm w-full ${edited?.planned ? 'border-primary-500 bg-primary-50' : ''}`}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="date"
                                                            value={limitVal}
                                                            onChange={(e) => handleDateChange(p.originalId, 'limit', e.target.value)}
                                                            className={`input py-1 px-2 text-sm w-full ${edited?.limit ? 'border-primary-500 bg-primary-50' : ''}`}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        {p.currentDeliveryDate ? (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                                {new Date(p.currentDeliveryDate).toLocaleDateString('pt-BR')}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                                                -
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="btn btn-secondary"
                        disabled={isConfirming}
                    >
                        Cancelar
                    </button>
                    <div className="flex items-center gap-3 mr-auto ml-1">
                        <input
                            type="checkbox"
                            id="openNext"
                            checked={openNext}
                            onChange={(e) => setOpenNext(e.target.checked)}
                            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        />
                        <label htmlFor="openNext" className="text-sm font-medium text-gray-700">
                            Abrir automaticamente o próximo mês?
                        </label>
                    </div>
                    <button
                        onClick={handleConfirm}
                        disabled={loading || !!error || isConfirming}
                        className="btn btn-primary flex items-center gap-2"
                    >
                        {isConfirming ? (
                            <>
                                <Loader className="w-4 h-4 animate-spin" />
                                Processando...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Confirmar e Fechar Mês
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

