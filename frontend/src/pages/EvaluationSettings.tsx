import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { evaluationApi } from '../api';
import { useAuth } from '../contexts';
import type { EvaluationRules } from '../types';
import { Settings, Play, History, Save, Plus, Trash2, Mail } from 'lucide-react';

export default function EvaluationSettings() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const [rules, setRules] = useState<EvaluationRules>({
        earlyDeliveryScore: 100,
        onTimeScore: 75,
        halfwayScore: 50,
        lateScore: 25,
        criticalScore: 0,
        toleranceDays: 0,
        notificationEmails: [],
        bonusCalculationMode: BonusCalculationMode.INDIVIDUAL,
    });

    const [simulateData, setSimulateData] = useState({
        plannedDate: '',
        limitDate: '',
        deliveryDate: '',
    });

    const [simulateResult, setSimulateResult] = useState<{
        score: number;
        status: string;
    } | null>(null);

    const { data: activeConfig, isLoading } = useQuery({
        queryKey: ['evaluationActive'],
        queryFn: () => evaluationApi.getActive(),
        enabled: !!user?.activeCompanyId,
    });

    const { data: configHistory } = useQuery({
        queryKey: ['evaluationHistory'],
        queryFn: () => evaluationApi.getHistory(),
        enabled: !!user?.activeCompanyId,
    });

    // Initialize rules from active config
    useEffect(() => {
        if (activeConfig?.rules) {
            setRules({
                ...activeConfig.rules,
                notificationEmails: activeConfig.rules.notificationEmails || [],
            });
        }
    }, [activeConfig]);

    const createMutation = useMutation({
        mutationFn: (newRules: EvaluationRules) => evaluationApi.create(newRules),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['evaluationActive'] });
            queryClient.invalidateQueries({ queryKey: ['evaluationHistory'] });
        },
    });

    const simulateMutation = useMutation({
        mutationFn: (data: {
            plannedDate: string;
            limitDate: string;
            deliveryDate: string;
            rules?: EvaluationRules;
        }) => evaluationApi.simulate(data),
        onSuccess: (result) => {
            setSimulateResult(result.result);
        },
    });

    const handleRuleChange = (key: keyof EvaluationRules, value: number) => {
        setRules((prev) => ({ ...prev, [key]: value }));
    };

    const handleSaveRules = () => {
        createMutation.mutate(rules);
    };

    const handleSimulate = () => {
        if (!simulateData.plannedDate || !simulateData.limitDate || !simulateData.deliveryDate) {
            return;
        }
        simulateMutation.mutate({
            ...simulateData,
            rules,
        });
    };

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

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Parâmetros de Avaliação</h1>
                    <p className="text-gray-500">
                        Versão atual: {activeConfig?.version || 'Padrão'}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Rules Config */}
                <div className="card">
                    <div className="flex items-center gap-2 mb-6">
                        <Settings className="w-5 h-5 text-primary-600" />
                        <h2 className="text-lg font-semibold">Regras de Pontuação</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="label flex justify-between">
                                <span>Entrega Antecipada</span>
                                <span className="text-primary-600 font-mono">{rules.earlyDeliveryScore}</span>
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={rules.earlyDeliveryScore}
                                onChange={(e) => handleRuleChange('earlyDeliveryScore', Number(e.target.value))}
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label className="label flex justify-between">
                                <span>No Prazo (Data Planejada)</span>
                                <span className="text-primary-600 font-mono">{rules.onTimeScore}</span>
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={rules.onTimeScore}
                                onChange={(e) => handleRuleChange('onTimeScore', Number(e.target.value))}
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label className="label flex justify-between">
                                <span>Primeira Metade do Intervalo</span>
                                <span className="text-warning-600 font-mono">{rules.halfwayScore}</span>
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={rules.halfwayScore}
                                onChange={(e) => handleRuleChange('halfwayScore', Number(e.target.value))}
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label className="label flex justify-between">
                                <span>Segunda Metade do Intervalo</span>
                                <span className="text-warning-600 font-mono">{rules.lateScore}</span>
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={rules.lateScore}
                                onChange={(e) => handleRuleChange('lateScore', Number(e.target.value))}
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label className="label flex justify-between">
                                <span>Após Limite (Crítico)</span>
                                <span className="text-danger-600 font-mono">{rules.criticalScore}</span>
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={rules.criticalScore}
                                onChange={(e) => handleRuleChange('criticalScore', Number(e.target.value))}
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label className="label">Dias de Tolerância</label>
                            <input
                                type="number"
                                min="0"
                                value={rules.toleranceDays}
                                onChange={(e) => handleRuleChange('toleranceDays', Number(e.target.value))}
                                className="input w-24"
                            />
                        </div>

                        <div className="pt-4 border-t border-gray-100">
                            <label className="label flex items-center gap-2 mb-2">
                                <Mail className="w-4 h-4 text-gray-400" />
                                <span>Emails para Notificação (Operadores)</span>
                            </label>
                            <div className="space-y-2">
                                {rules.notificationEmails.map((email, index) => (
                                    <div key={index} className="flex gap-2">
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => {
                                                const newEmails = [...rules.notificationEmails];
                                                newEmails[index] = e.target.value;
                                                setRules({ ...rules, notificationEmails: newEmails });
                                            }}
                                            className="input flex-1"
                                            placeholder="exemplo@empresa.com"
                                        />
                                        <button
                                            onClick={() => {
                                                const newEmails = rules.notificationEmails.filter((_, i) => i !== index);
                                                setRules({ ...rules, notificationEmails: newEmails });
                                            }}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                                            title="Remover"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={() => setRules({ ...rules, notificationEmails: [...rules.notificationEmails, ''] })}
                                    className="btn-secondary w-full py-2 flex items-center justify-center gap-1 text-sm border-dashed"
                                >
                                    <Plus className="w-4 h-4" />
                                    Adicionar Email
                                </button>
                                <p className="text-xs text-gray-500 italic mt-2">
                                    Os operadores enviarão os processos automaticamente para estes endereços.
                                </p>
                            </div>
                        </div>



                        <button
                            onClick={handleSaveRules}
                            disabled={createMutation.isPending}
                            className="btn-primary w-full mt-4"
                        >
                            <Save className="w-4 h-4" />
                            {createMutation.isPending ? 'Salvando...' : 'Salvar Nova Versão'}
                        </button>

                        {createMutation.isSuccess && (
                            <p className="text-sm text-success-600 text-center">
                                Configuração salva com sucesso!
                            </p>
                        )}
                    </div>
                </div>

                {/* Simulator */}
                <div className="space-y-6">
                    <div className="card">
                        <div className="flex items-center gap-2 mb-6">
                            <Play className="w-5 h-5 text-primary-600" />
                            <h2 className="text-lg font-semibold">Simulador de Pontuação</h2>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="label">Data Planejada</label>
                                <input
                                    type="date"
                                    value={simulateData.plannedDate}
                                    onChange={(e) =>
                                        setSimulateData((prev) => ({ ...prev, plannedDate: e.target.value }))
                                    }
                                    className="input"
                                />
                            </div>
                            <div>
                                <label className="label">Data Limite</label>
                                <input
                                    type="date"
                                    value={simulateData.limitDate}
                                    onChange={(e) =>
                                        setSimulateData((prev) => ({ ...prev, limitDate: e.target.value }))
                                    }
                                    className="input"
                                />
                            </div>
                            <div>
                                <label className="label">Data de Entrega</label>
                                <input
                                    type="date"
                                    value={simulateData.deliveryDate}
                                    onChange={(e) =>
                                        setSimulateData((prev) => ({ ...prev, deliveryDate: e.target.value }))
                                    }
                                    className="input"
                                />
                            </div>

                            <button
                                onClick={handleSimulate}
                                disabled={simulateMutation.isPending}
                                className="btn-secondary w-full"
                            >
                                <Play className="w-4 h-4" />
                                Simular
                            </button>

                            {simulateResult && (
                                <div className="mt-4 p-4 bg-gray-50 rounded-lg text-center">
                                    <p className="text-4xl font-bold text-primary-600">
                                        {simulateResult.score}
                                    </p>
                                    <p className="text-sm text-gray-500 mt-1">
                                        Status: {simulateResult.status}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* History */}
                    <div className="card">
                        <div className="flex items-center gap-2 mb-4">
                            <History className="w-5 h-5 text-primary-600" />
                            <h2 className="text-lg font-semibold">Histórico de Versões</h2>
                        </div>

                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {configHistory?.map((config) => (
                                <div
                                    key={config._id}
                                    className={`p-3 rounded-lg border ${config.isActive
                                        ? 'bg-primary-50 border-primary-200'
                                        : 'bg-gray-50 border-gray-200'
                                        }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className="font-medium">Versão {config.version}</span>
                                        {config.isActive && (
                                            <span className="text-xs bg-primary-600 text-white px-2 py-0.5 rounded">
                                                Ativa
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {new Date(config.createdAt).toLocaleDateString('pt-BR')} -{' '}
                                        {typeof config.createdBy === 'object'
                                            ? config.createdBy.name
                                            : 'Sistema'}
                                    </p>
                                </div>
                            ))}
                            {(!configHistory || configHistory.length === 0) && (
                                <p className="text-sm text-gray-400 text-center py-4">
                                    Nenhuma versão anterior
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

