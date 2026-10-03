import { getAccessibleSectors } from '../utils/companyAccess';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { processesApi, cyclesApi, usersApi, companiesApi, settingsApi } from '../api';
import { api } from '../api/client';
import { useAuth } from '../contexts';
import type { Process, ProcessForm, DeliverForm } from '../types';
import { ProcessStatus, UserRole, DeliveryStatus } from '../types';
import {
    Search,
    Edit,
    Trash2,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Clock,
    Plus,
    Mail,
    Upload,
    Archive,
    Eye,
    EyeOff,
} from 'lucide-react';
import CloseMonthModal from '../components/CloseMonthModal';

export default function ProcessList() {
    const { user, refreshUser } = useAuth();
    const queryClient = useQueryClient();

    // Fetch active company details to get sectors and managers
    const { data: activeCompany } = useQuery({
        queryKey: ['company', user?.activeCompanyId],
        queryFn: () => companiesApi.get(user!.activeCompanyId!),
        enabled: !!user?.activeCompanyId,
    });

    const accessibleSectors = getAccessibleSectors(user, activeCompany);
    const [notice, setNotice] = useState('');
    const [reasonAction, setReasonAction] = useState<{process: Process; kind: 'revert' | 'active'} | null>(null);
    const [actionReason, setActionReason] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [showDeliverModal, setShowDeliverModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [selectedProcess, setSelectedProcess] = useState<Process | null>(null);
    const [emailTo, setEmailTo] = useState(''); // Controlled state for email recipient
    const [search, setSearch] = useState('');
    const [sectorFilter, setSectorFilter] = useState('');
    const [searchParams] = useSearchParams();
    const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
    const [responsibleFilter, setResponsibleFilter] = useState('');
    const [deliveryMode, setDeliveryMode] = useState<'ALL' | 'DELIVERED_FIRST' | 'NOT_DELIVERED_FIRST' | 'DELIVERED_ONLY' | 'NOT_DELIVERED_ONLY'>('ALL');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [newSectorName, setNewSectorName] = useState('');
    const [isAddingSector, setIsAddingSector] = useState(false);
    const [selectedSector, setSelectedSector] = useState('');

    // Reset sector selection when modal opens/closes
    useEffect(() => {
        if (showModal) {
            setSelectedSector(selectedProcess?.sector || '');
            setIsAddingSector(false);
            setNewSectorName('');
        } else {
            setSelectedSector('');
        }
    }, [showModal, selectedProcess]);

    const isOperator = user?.roles.includes(UserRole.OPERATOR) && !user?.roles.includes(UserRole.MASTER) && !user?.roles.includes(UserRole.MANAGER);
    const isStrictManager = user?.roles.includes(UserRole.MANAGER) && !user?.roles.includes(UserRole.MASTER);
    const isManager = user?.roles.includes(UserRole.MANAGER) || user?.roles.includes(UserRole.MASTER);
    const isMasterUser = user?.roles.includes(UserRole.MASTER);

    const { data: currentCycle, isFetched: isCurrentCycleFetched } = useQuery({
        queryKey: ['currentCycle', sectorFilter],
        queryFn: () => cyclesApi.getCurrent(sectorFilter || undefined),
        enabled: !!user?.activeCompanyId,
    });

    const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);

    const closeCycleMutation = useMutation({
        mutationFn: ({ overrides, openNext, sector }: { overrides?: any[], openNext: boolean, sector?: string }) =>
            cyclesApi.close(overrides, openNext, sector),
        onSuccess: (result) => {
            ['processes', 'currentCycle', 'summary', 'extract', 'myMetrics', 'teamMetrics', 'bonus-report', 'sectorRanking'].forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
            queryClient.invalidateQueries({ queryKey: ['currentCycle'] });
            queryClient.invalidateQueries({ queryKey: ['summary'] });
            setIsCloseModalOpen(false);
            setNotice(result.message || 'Ciclo fechado com sucesso!');
        },
        onError: (error: any) => {
            setNotice(`Erro ao fechar ciclo: ${error.response?.data?.message || error.message}`);
        }
    });

    const handleCloseCycle = () => {
        setIsCloseModalOpen(true);
    };

    const handleConfirmClose = (overrides: any[], openNext: boolean) => {
        closeCycleMutation.mutate({ overrides, openNext, sector: sectorFilter });
    };

    const openCycleMutation = useMutation({
        mutationFn: ({ month, sector }: { month: string; sector: string }) => cyclesApi.open(month, sector),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['currentCycle'] });
            ['processes', 'currentCycle', 'summary', 'extract', 'myMetrics', 'teamMetrics', 'bonus-report', 'sectorRanking'].forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
            setNotice('Ciclo aberto com sucesso!');
        },
        onError: (error: any) => {
            setNotice(`Erro ao abrir ciclo: ${error.response?.data?.message || error.message}`);
        },
    });

    const handleOpenCycle = () => {
        if (!sectorFilter) return;
        const now = new Date();
        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        if (confirm(`Deseja abrir o ciclo de ${month} para o setor "${sectorFilter}"?`)) {
            openCycleMutation.mutate({ month, sector: sectorFilter });
        }
    };

    const { data: processesData, isLoading } = useQuery({
        queryKey: ['processes', { search, sector: sectorFilter, status: statusFilter, responsibleUserId: responsibleFilter, deliveryMode, sortOrder }],
        queryFn: () => processesApi.list({
            search: search || undefined,
            sector: sectorFilter || undefined,
            status: statusFilter || undefined,
            responsibleUserId: responsibleFilter || undefined,
            deliveryMode,
            sortBy: 'plannedDate',
            sortOrder,
        }),
        enabled: !!user?.activeCompanyId,
        refetchInterval: query => query.state.data?.data?.some((p: Process) => p.deliveryStatus === DeliveryStatus.EMAIL_QUEUED) ? 2000 : false,
    });

    const { data: users } = useQuery({
        queryKey: ['users'],
        queryFn: () => usersApi.list(),
        enabled: !!user?.activeCompanyId, // Allow operators to fetch users to display names
    });




    const createMutation = useMutation({
        mutationFn: (data: ProcessForm) => processesApi.create(data),
        onSuccess: () => {
            ['processes', 'currentCycle', 'summary', 'extract', 'myMetrics', 'teamMetrics', 'bonus-report', 'sectorRanking'].forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
            setShowModal(false);
        },
        onError: (error: any) => {
            setNotice(`Erro ao criar processo: ${error.response?.data?.message || error.message}`);
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<ProcessForm> }) =>
            processesApi.update(id, data),
        onSuccess: () => {
            ['processes', 'currentCycle', 'summary', 'extract', 'myMetrics', 'teamMetrics', 'bonus-report', 'sectorRanking'].forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
            setShowModal(false);
            setSelectedProcess(null);
        },
        onError: (error: any) => {
            setNotice(`Erro ao salvar processo: ${error.response?.data?.message || error.message}`);
        },
    });

    const confirmDeliveryMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: DeliverForm }) =>
            processesApi.confirmDelivery(id, data),
        onSuccess: () => {
            ['processes', 'currentCycle', 'summary', 'extract', 'myMetrics', 'teamMetrics', 'bonus-report', 'sectorRanking'].forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
            queryClient.invalidateQueries({ queryKey: ['summary'] });
            setShowDeliverModal(false);
            setSelectedProcess(null);

            setNotice('Entrega confirmada. A notificação por e-mail permanece pendente de envio.');
        },
        onError: (error: any) => {
            setNotice(`Erro ao confirmar entrega: ${error.response?.data?.message || error.message}`);
        },
    });

    const sendDeliveryEmailMutation = useMutation({
        mutationFn: (id: string) => processesApi.sendDeliveryEmail(id),
        onSuccess: () => {
            ['processes', 'currentCycle', 'summary', 'extract', 'myMetrics', 'teamMetrics', 'bonus-report', 'sectorRanking'].forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
            setNotice('E-mail colocado na fila de envio. O status será atualizado após o processamento.');
        },
        onError: (error: any) => {
            setNotice(`Erro ao enviar email: ${error.message}`);
        }
    });

    const revertDeliveryMutation = useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) =>
            processesApi.revertDelivery(id, reason),
        onSuccess: () => {
            ['processes', 'currentCycle', 'summary', 'extract', 'myMetrics', 'teamMetrics', 'bonus-report', 'sectorRanking'].forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
            queryClient.invalidateQueries({ queryKey: ['summary'] });
            setReasonAction(null);
            setActionReason('');
            setNotice('Entrega desfeita com sucesso!');
        },
        onError: (error: Error) => setNotice(error.message),
    });

    const setActiveMutation = useMutation({
        mutationFn: ({ id, isActive, reason }: { id: string; isActive: boolean; reason: string }) =>
            processesApi.setActive(id, isActive, reason),
        onSuccess: () => {
            setReasonAction(null);
            setActionReason('');
            ['processes', 'currentCycle', 'summary', 'extract', 'myMetrics', 'teamMetrics', 'bonus-report', 'sectorRanking'].forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
        },
        onError: (error: any) => {
            setNotice(`Erro ao alterar status do processo: ${error.response?.data?.message || error.message}`);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => processesApi.delete(id),
        onSuccess: () => {
            ['processes', 'currentCycle', 'summary', 'extract', 'myMetrics', 'teamMetrics', 'bonus-report', 'sectorRanking'].forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
        },
        onError: (error: any) => {
            setNotice(`Erro ao excluir processo: ${error.response?.data?.message || error.message}`);
        },
    });

    const importMutation = useMutation({
        mutationFn: (data: { file: File; sector: string; plannedDate: string; limitDate: string; responsibleUserId?: string }) =>
            processesApi.importProcesses(data.file, data),
        onSuccess: (response) => {
            ['processes', 'currentCycle', 'summary', 'extract', 'myMetrics', 'teamMetrics', 'bonus-report', 'sectorRanking'].forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
            setNotice(response.message || 'Processos importados com sucesso!');
            setShowImportModal(false);
        },
        onError: (error: any) => {
            setNotice(`Erro na importação: ${error.response?.data?.error || error.message}`);
        },
    });

    const addSectorMutation = useMutation({
        mutationFn: (sector: string) => companiesApi.addSector(user!.activeCompanyId!, { sector, managerId: null }),
        onSuccess: async () => {
            const newSector = newSectorName.trim();
            // Auto-select the newly added sector FIRST
            setSelectedSector(newSector);
            setNewSectorName('');
            setIsAddingSector(false);
            // Then refresh user data to get updated company with new sector
            await refreshUser();
        },
    });

    const sendEmailMutation = useMutation({
        mutationFn: ({ id, to, message }: { id: string; to: string; message?: string }) =>
            api.post<{ success: boolean; message: string }>(`/processes/${id}/send-email`, { to, message }),
        onSuccess: (response) => {
            setNotice(response.data.message || 'Email enviado com sucesso!');
            setShowEmailModal(false);
            setSelectedProcess(null);
        },
        onError: (error: any) => {
            setNotice(`Erro ao enviar email: ${error.message}`);
        }
    });

    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const activeFilterCount = [sectorFilter, statusFilter, responsibleFilter, deliveryMode !== 'ALL', sortOrder !== 'asc'].filter(Boolean).length;

    const renderActions = (process: Process) => (
                                        <div className="flex items-center justify-center gap-1 flex-wrap md:grid md:grid-cols-3 process-actions">
                                            {/* Delivery Actions based on deliveryStatus */}
                                            {(!isOperator || String(process.responsibleUserId) === String(user?.id || user?._id)) && (!process.deliveryStatus || process.deliveryStatus === DeliveryStatus.NOT_DELIVERED) && (
                                                <button
                                                    onClick={() => {
                                                        setSelectedProcess(process);
                                                        setShowDeliverModal(true);
                                                    }}
                                                    className="p-1 text-success-600 dark:text-success-400 hover:bg-success-50 dark:hover:bg-success-900/20 rounded-md transition-colors"
                                                    title="Confirmar Entrega"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                </button>
                                            )}
                                            {(!isOperator || String(process.responsibleUserId) === String(user?.id || user?._id)) && [DeliveryStatus.CONFIRMED_PENDING_EMAIL, DeliveryStatus.EMAIL_FAILED].includes(process.deliveryStatus!) && (
                                                <>
                                                    <button
                                                        onClick={() => {
                                                            sendDeliveryEmailMutation.mutate(process._id);
                                                        }}
                                                        className="p-1 text-primary-600 dark:text-primary-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                                                        disabled={sendDeliveryEmailMutation.isPending}
                                                        title="Enviar Email de Entrega"
                                                    >
                                                        <Mail className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setActionReason('');
                                                            setReasonAction({process, kind: 'revert'});
                                                        }}
                                                        className="p-1 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-md transition-colors"
                                                        title="Desfazer Confirmação"
                                                    >
                                                        <XCircle className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                            {(!isOperator || String(process.responsibleUserId) === String(user?.id || user?._id)) && [DeliveryStatus.EMAIL_SENT, DeliveryStatus.EMAIL_QUEUED].includes(process.deliveryStatus!) && (
                                                <button
                                                    onClick={() => {
                                                        setActionReason('');
                                                        setReasonAction({process, kind: 'revert'});
                                                    }}
                                                    className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                                    title="Reverter Entrega"
                                                >
                                                    <XCircle className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                onClick={async () => {
                                                    if (isOperator) {
                                                        if (confirm('Deseja enviar os detalhes deste processo para os destinatários configurados?')) {
                                                            setSelectedProcess(process);
                                                            sendEmailMutation.mutate({ id: process._id, to: 'configured' });
                                                        }
                                                    } else {
                                                        setSelectedProcess(process);
                                                        // Force fetch latest settings
                                                        try {
                                                            const settings = await settingsApi.email.get();
                                                            if (settings && settings.recipients) {
                                                                setEmailTo(settings.recipients.join(', '));
                                                            } else {
                                                                setEmailTo('');
                                                            }
                                                        } catch (error) {
                                                            console.error('Failed to fetch email settings:', error);
                                                            setEmailTo('');
                                                        }
                                                        setShowEmailModal(true);
                                                    }
                                                }}
                                                className="p-1 text-primary-600 dark:text-primary-400 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                disabled={(isOperator && String(process.responsibleUserId) !== String(user?.id || user?._id)) || (sendEmailMutation.isPending && selectedProcess?._id === process._id) || (!process.deliveryStatus || process.deliveryStatus === DeliveryStatus.NOT_DELIVERED)}
                                                title={(!process.deliveryStatus || process.deliveryStatus === DeliveryStatus.NOT_DELIVERED)
                                                    ? "Necessário confirmar entrega antes de enviar"
                                                    : (isOperator ? "Enviar por email (destinatários configurados)" : "Enviar por email")}
                                            >
                                                <Mail className="w-4 h-4" />
                                            </button>
                                            {isMasterUser && (
                                                <button
                                                    onClick={() => {
                                                        setActionReason('');
                                                        setReasonAction({process, kind: 'active'});
                                                    }}
                                                    className={`p-1 rounded-md transition-colors ${
                                                        process.isActive === false
                                                            ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                                                            : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700/50 dark:text-gray-400'
                                                    }`}
                                                    title={process.isActive === false ? 'Ativar Processo' : 'Inativar Processo'}
                                                >
                                                    {process.isActive === false ? (
                                                        <Eye className="w-4 h-4" />
                                                    ) : (
                                                        <EyeOff className="w-4 h-4" />
                                                    )}
                                                </button>
                                            )}
                                            {!isOperator && (
                                                <>
                                                    <button
                                                        onClick={() => {
                                                            setSelectedProcess(process);
                                                            setShowModal(true);
                                                        }}
                                                        className="p-1 text-gray-600 dark:text-gray-300 hover:bg-gray-100 rounded-md transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                            {!isOperator && (
                                                <button
                                                    onClick={() => {
                                                        if (confirm('Tem certeza que deseja excluir este processo?')) {
                                                            deleteMutation.mutate(process._id);
                                                        }
                                                    }}
                                                    className="p-1 text-danger-600 dark:text-danger-400 hover:bg-danger-50 rounded-md transition-colors"
                                                    title="Excluir"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
    );

    const getStatusBadge = (process: Process) => {
        if (process.isActive === false) {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                    <EyeOff className="w-3 h-3 mr-1" />
                    Inativo
                </span>
            );
        }
        const status = process.status;
        const badges = {
            [ProcessStatus.PENDING]: { class: 'badge-pending', icon: Clock, text: 'Pendente' },
            [ProcessStatus.ON_TIME]: { class: 'badge-success', icon: CheckCircle, text: 'No Prazo' },
            [ProcessStatus.LATE]: { class: 'badge-warning', icon: AlertTriangle, text: 'Atrasado' },
            [ProcessStatus.CRITICAL]: { class: 'badge-danger', icon: XCircle, text: 'Crítico' },
        };
        const badge = badges[status] || badges[ProcessStatus.PENDING];
        return (
            <span className={badge.class}>
                <badge.icon className="w-3 h-3 mr-1" />
                {badge.text}
            </span>
        );
    };

    useEffect(() => {
        if (!isMasterUser && accessibleSectors.length && !accessibleSectors.some(s => s.name === sectorFilter)) {
            setSectorFilter(accessibleSectors[0].name);
        }
    }, [user?.activeCompanyId, activeCompany, sectorFilter]);

    const getDeliveryStatusBadge = (process: Process) => {
        if (!process.deliveryStatus || process.deliveryStatus === DeliveryStatus.NOT_DELIVERED) {
            return null;
        }
        if (process.deliveryStatus === DeliveryStatus.CONFIRMED_PENDING_EMAIL) {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                    <Clock className="w-3 h-3 mr-1" />
                    Pendente Envio
                </span>
            );
        }
        if (process.deliveryStatus === DeliveryStatus.EMAIL_SENT) {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Email Enviado
                </span>
            );
        }
        if (process.deliveryStatus === DeliveryStatus.EMAIL_QUEUED || process.deliveryStatus === DeliveryStatus.EMAIL_FAILED) {
            return <span className="badge-warning">{process.deliveryStatus === DeliveryStatus.EMAIL_QUEUED ? 'E-mail na fila' : 'Falha no e-mail'}</span>;
        }
        return null;
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data: ProcessForm = {
            code: (formData.get('code') as string) || undefined,
            title: formData.get('title') as string,
            sector: (formData.get('sector') as string) || selectedSector || '',
            owner: formData.get('owner') as string || undefined,
            plannedDate: formData.get('plannedDate') as string,
            limitDate: formData.get('limitDate') as string,
            responsibleUserId: formData.get('responsibleUserId') as string || undefined,
        };

        // isActive is intentionally NOT set here: there is no field for it in this form.
        // Activating/deactivating a process is handled exclusively by the dedicated
        // Eye/EyeOff toggle button below, which sends only { isActive } in its own request.
        // Including it here previously forced every MASTER create/edit to isActive:false.

        if (selectedProcess) {
            updateMutation.mutate({ id: selectedProcess._id, data });
        } else {
            createMutation.mutate(data);
        }
    };

    const handleDeliver = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!selectedProcess) return;

        const formData = new FormData(e.currentTarget);

        let deliveryDate = formData.get('deliveryDate') as string;

        // Fallback for when input is disabled (OPERADOR)
        if (!deliveryDate) {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            deliveryDate = `${year}-${month}-${day}`;
        }

        const data: DeliverForm = {
            deliveryDate,
            deliveryEvidence: formData.get('deliveryEvidence') as string || undefined,
        };

        confirmDeliveryMutation.mutate({ id: selectedProcess._id, data });
    };

    if (!user?.activeCompanyId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Selecione uma empresa
                </h2>
                <p className="text-gray-500 dark:text-gray-400">
                    Use o seletor na barra lateral para escolher uma empresa.
                </p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col gap-4 min-h-0">
            {notice && <div role="alert" className="fixed top-4 right-4 z-[110] max-w-lg rounded-lg bg-white dark:bg-gray-900 border border-primary-300 shadow-xl p-4 flex items-start gap-3"><span>{notice}</span><button aria-label="Fechar mensagem" type="button" onClick={() => setNotice('')}>×</button></div>}
            {reasonAction && (
                <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
                    <form role="dialog" aria-modal="true" aria-label="Motivo da alteração" className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md space-y-4" onSubmit={e => {
                        e.preventDefault();
                        if (!actionReason.trim()) return;
                        const {process, kind} = reasonAction;
                        if (kind === 'revert') revertDeliveryMutation.mutate({id: process._id, reason: actionReason.trim()});
                        else setActiveMutation.mutate({id: process._id, isActive: process.isActive === false, reason: actionReason.trim()});
                    }}>
                        <h2 className="text-lg font-semibold">{reasonAction.kind === 'revert' ? 'Reverter entrega' : 'Alterar atividade do processo'}</h2>
                        <label className="block">Motivo<textarea autoFocus required className="input w-full mt-2" value={actionReason} onChange={e => setActionReason(e.target.value)} /></label>
                        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setReasonAction(null)}>Cancelar</button><button className="btn-primary" disabled={!actionReason.trim() || revertDeliveryMutation.isPending || setActiveMutation.isPending}>Confirmar alteração</button></div>
                    </form>
                </div>
            )}
            {/* Header & Filters - Fixed at top of content area */}
            <div className="flex-none space-y-4 bg-gray-50 dark:bg-gray-950 pt-2 z-20 sticky top-0 sm:static">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Processos</h1>
                        <p className="text-gray-500 dark:text-gray-400">
                            Ciclo {currentCycle?.month || 'N/A'} • {processesData?.data?.length || 0} processos
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                        {!isOperator && (
                            <button
                                onClick={() => setShowImportModal(true)}
                                className="btn-secondary"
                            >
                                <Upload className="w-4 h-4" />
                                Importar Excel
                            </button>
                        )}
                        {isManager && currentCycle && sectorFilter && (
                            <button
                                onClick={handleCloseCycle}
                                disabled={closeCycleMutation.isPending}
                                className="btn-secondary text-orange-600 border-orange-200 hover:bg-orange-50 dark:border-orange-900/40 dark:hover:bg-orange-900/20"
                                title="Fechar ciclo deste setor e preparar próximo mês"
                            >
                                <Archive className="w-4 h-4" />
                                {closeCycleMutation.isPending ? 'Fechando...' : 'Fechar Mês'}
                            </button>
                        )}
                        {!isOperator && (
                            <button
                                onClick={() => {
                                    setSelectedProcess(null);
                                    setShowModal(true);
                                }}
                                className="btn-primary"
                            >
                                <Plus className="w-4 h-4" />
                                Novo Processo
                            </button>
                        )}
                    </div>
                </div>

                {/* Filters */}
                <div className="card dark:bg-gray-800 dark:border-gray-700 !p-4">
                    <p className="section-label mb-3">Filtros de processos</p>
                    <div className="grid grid-cols-1 gap-3 2xl:grid-cols-[minmax(220px,2fr)_minmax(0,5fr)]">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                aria-label="Buscar processos"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar por código ou título..."
                                className="input pl-10 dark:bg-gray-700 dark:border-gray-600 dark:text-white w-full"
                            />
                        </div>
                        <button type="button" className="btn-secondary md:hidden justify-between" aria-expanded={showAdvancedFilters} aria-controls="process-advanced-filters" onClick={() => setShowAdvancedFilters(value => !value)}>
                            {showAdvancedFilters ? 'Ocultar filtros' : 'Filtros avançados'}
                            <span className="badge-pending">{activeFilterCount} {activeFilterCount === 1 ? 'ativo' : 'ativos'}</span>
                        </button>
                        <div id="process-advanced-filters" className={`${showAdvancedFilters ? 'grid' : 'hidden'} md:grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5`}>
                            <select
                                aria-label="Filtrar por setor"
                                value={sectorFilter}
                                onChange={(e) => setSectorFilter(e.target.value)}
                                className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                disabled={accessibleSectors.length === 1 && !isMasterUser}
                            >
                                {!isStrictManager && !isOperator && <option value="">Todos os setores</option>}
                                {(isStrictManager || isOperator) && !sectorFilter && <option value="">Selecione seu setor</option>}
                                {accessibleSectors.map((sector: any) => {
                                    const name = typeof sector === 'string' ? sector : sector.name;
                                    return (
                                        <option key={name} value={name}>{name}</option>
                                    );
                                })}
                            </select>
                            <select
                                aria-label="Filtrar por status"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            >
                                <option value="">Todos status</option>
                                <option value="PENDING">Pendente</option>
                                <option value="ON_TIME">No Prazo</option>
                                <option value="LATE">Atrasado</option>
                                <option value="CRITICAL">Crítico</option>
                            </select>
                            <select
                                aria-label="Filtrar por responsável"
                                value={responsibleFilter}
                                onChange={(e) => setResponsibleFilter(e.target.value)}
                                className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            >
                                <option value="">Todos responsáveis</option>
                                {users?.map((u) => (
                                    <option key={u.id || u._id} value={u.id || u._id}>{u.name}</option>
                                ))}
                            </select>
                            <select
                                aria-label="Filtrar por entrega"
                                value={deliveryMode}
                                onChange={(e) => setDeliveryMode(e.target.value as typeof deliveryMode)}
                                className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            >
                                <option value="ALL">Todas entregas</option>
                                <option value="DELIVERED_FIRST">Entregues primeiro</option>
                                <option value="NOT_DELIVERED_FIRST">Não entregues primeiro</option>
                                <option value="DELIVERED_ONLY">Somente entregues</option>
                                <option value="NOT_DELIVERED_ONLY">Somente não entregues</option>
                            </select>
                            <select
                                aria-label="Ordenar processos"
                                value={sortOrder}
                                onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                                className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            >
                                <option value="asc">Data planejada crescente</option>
                                <option value="desc">Data planejada decrescente</option>
                            </select>
                        </div>
                    </div>
                </div>

                {isManager && sectorFilter && isCurrentCycleFetched && !currentCycle && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-orange-200 dark:border-orange-900/40 bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300">
                        <div className="flex items-center gap-2 text-sm">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            Nenhum ciclo aberto para o setor <strong>{sectorFilter}</strong>. É preciso abrir um ciclo antes de criar processos.
                        </div>
                        <button
                            onClick={handleOpenCycle}
                            disabled={openCycleMutation.isPending}
                            className="btn-secondary text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/40 flex-shrink-0"
                        >
                            {openCycleMutation.isPending ? 'Abrindo...' : 'Abrir Ciclo'}
                        </button>
                    </div>
                )}
            </div>

            {/* Table Container - Scrollable */}
            <div className="flex-1 min-h-0 bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col overflow-hidden">
                <div className="flex-1 overflow-auto scrollbar-thin">
                {isLoading ? (
                    <div className="flex items-center justify-center h-48">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                ) : (
                    <>
                    <div className="process-mobile md:hidden divide-y divide-gray-100 dark:divide-gray-700">
                        {processesData?.data?.map(process => (
                            <article key={process._id} className={`p-4 space-y-3 ${process.isActive === false ? "opacity-50" : ""}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0"><p className="text-xs text-gray-500 mb-1">{process.code} · {process.sector}</p><h2 className="font-semibold text-gray-900 dark:text-white break-words">{process.title}</h2></div>
                                    {getStatusBadge(process)}
                                </div>
                                <dl className="grid grid-cols-2 gap-3 text-sm">
                                    <div><dt className="section-label">Prazo limite</dt><dd className="mt-1">{new Date(process.limitDate).toLocaleDateString("pt-BR", {timeZone: "UTC"})}</dd></div>
                                    <div><dt className="section-label">Responsável</dt><dd className="mt-1 break-words">{typeof process.responsibleUserId === "object" && process.responsibleUserId ? process.responsibleUserId.name : users?.find(u => (u.id || u._id) === process.responsibleUserId)?.name || process.owner || "Não definido"}</dd></div>
                                </dl>
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">{getDeliveryStatusBadge(process)}{renderActions(process)}</div>
                            </article>
                        ))}
                        {!processesData?.data?.length && <p className="p-8 text-center text-gray-500">Nenhum processo encontrado</p>}
                    </div>
                    <table className="table process-table process-desktop hidden md:table table-fixed w-full min-w-[1100px] px-2">
                        <thead className="bg-white dark:bg-gray-800 sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700">
                            <tr>
                                <th className="w-[6%] bg-white dark:bg-gray-800 hidden md:table-cell text-center text-gray-500 dark:text-gray-400 truncate">Código</th>
                                <th className="w-[18%] bg-white dark:bg-gray-800 text-left text-gray-500 dark:text-gray-400 truncate">Título</th>
                                <th className="w-[12%] bg-white dark:bg-gray-800 hidden lg:table-cell text-left text-gray-500 dark:text-gray-400 truncate">Setor</th>
                                <th className="w-[9%] bg-white dark:bg-gray-800 hidden md:table-cell text-center text-gray-500 dark:text-gray-400 truncate">Planejado {sortOrder === 'asc' ? '↑' : '↓'}</th>
                                <th className="w-[9%] bg-white dark:bg-gray-800 text-center text-gray-500 dark:text-gray-400 truncate">Limite</th>
                                <th className="w-[10%] bg-white dark:bg-gray-800 text-center text-gray-500 dark:text-gray-400 truncate">Status</th>
                                <th className="w-[10%] bg-white dark:bg-gray-800 hidden lg:table-cell text-center text-gray-500 dark:text-gray-400 truncate">Entrega</th>
                                <th className="w-[7%] bg-white dark:bg-gray-800 hidden xl:table-cell text-center text-gray-500 dark:text-gray-400 truncate">Pontuação</th>
                                <th className="w-[11%] bg-white dark:bg-gray-800 hidden xl:table-cell text-left text-gray-500 dark:text-gray-400 truncate">Responsável</th>
                                <th className="w-[16%] bg-white dark:bg-gray-800 text-center text-gray-500 dark:text-gray-400 truncate">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {processesData?.data?.map((process) => (
                                <tr key={process._id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${process.isActive === false ? 'opacity-50' : ''}`}>
                                    <td className="font-mono text-sm text-center hidden md:table-cell truncate">{process.code}</td>
                                    <td className="font-semibold text-gray-900 dark:text-white" title={process.title}><span className="block break-words">{process.title}</span><span className="block mt-1 text-xs font-normal text-gray-500">{process.owner || process.code}</span></td>
                                    <td className="truncate hidden lg:table-cell" title={process.sector}>{process.sector}</td>
                                    <td className="text-sm text-center hidden md:table-cell truncate">
                                        {new Date(process.plannedDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                    </td>
                                    <td className="text-sm text-center truncate">
                                        {new Date(process.limitDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                    </td>
                                    <td className="text-center">
                                        <div className="flex justify-center">
                                            {getStatusBadge(process)}
                                        </div>
                                    </td>
                                    <td className="text-sm text-center hidden lg:table-cell">
                                        <div className="flex flex-col gap-1 items-center">
                                            <span>
                                                {process.deliveryDate
                                                    ? new Date(process.deliveryDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
                                                    : '-'}
                                            </span>
                                            {getDeliveryStatusBadge(process)}
                                        </div>
                                    </td>
                                    <td className="font-semibold hidden xl:table-cell text-center truncate">
                                        {process.score !== null ? process.score : '-'}
                                    </td>
                                    <td className="text-sm hidden xl:table-cell truncate">
                                        {(() => {
                                            const userId = typeof process.responsibleUserId === 'object' && process.responsibleUserId !== null
                                                ? (process.responsibleUserId as any)._id || (process.responsibleUserId as any).id
                                                : process.responsibleUserId;
                                            if (!userId) return <span className="text-gray-400">-</span>;

                                            // First check if populated object name is available
                                            if (typeof process.responsibleUserId === 'object' && process.responsibleUserId !== null && (process.responsibleUserId as any).name) {
                                                return (
                                                    <span className="truncate block" title={(process.responsibleUserId as any).name}>
                                                        {(process.responsibleUserId as any).name}
                                                    </span>
                                                );
                                            }

                                            // Fallback to finding in the users list
                                            const foundUser = users?.find(u => (u.id || u._id) === userId);
                                            return (
                                                <span className="truncate block" title={foundUser?.name || 'Carregando...'}>
                                                    {foundUser?.name || 'Carregando...'}
                                                </span>
                                            );
                                        })()}
                                    </td>
                                    <td className="text-center">
                                        {renderActions(process)}
                                    </td>
                                </tr>
                            ))}
                            {(!processesData?.data || processesData.data.length === 0) && (
                                <tr>
                                    <td colSpan={10} className="text-center text-gray-500 py-8">
                                        Nenhum processo encontrado
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    </>
                )}
                </div>
            </div>

            {/* Create/Edit Modal */}
            {
                showModal && (
                    <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 p-4">
                        <div role="dialog" aria-modal="true" aria-label={selectedProcess ? "Editar processo" : "Novo processo"} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90dvh] overflow-y-auto">
                            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    {selectedProcess ? 'Editar Processo' : 'Novo Processo'}
                                </h2>
                            </div>
                            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                <p className="section-label form-section">Identificação e responsabilidade</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="label">Código</label>
                                        <input
                                            name="code"
                                            defaultValue={selectedProcess?.code}
                                            placeholder="Gerado Automaticamente"
                                            className="input bg-gray-100 dark:bg-gray-700 cursor-not-allowed"
                                            readOnly
                                            disabled={!selectedProcess} // Disable if creating, but backend ignores code anyway on create if not provided (Wait, checking logic).
                                        // Actuall backend logic: if code not provided, auto-generate.
                                        // So for new process, we can just leave it empty.
                                        // But for edit, user might want to change it?
                                        // "Os IDs dos processos devem ser fornecidos automaticamente" -> implies user shouldn't change manualy.
                                        // I'll make it readonly always relative to 'auto managed'. But let's verify if user wants to edit it ever.
                                        // "não permita que um ID seja repetido" -> auto logic handles this.
                                        // Safer to disallow editing code manually to avoid mess.
                                        />
                                        {!selectedProcess && <p className="text-xs text-gray-500 mt-1">Gerado automaticamente ao salvar</p>}
                                    </div>
                                    <div>
                                        <label className="label">Setor</label>
                                        {!isAddingSector ? (
                                            <div className="flex gap-2">
                                                <select
                                                    name="sector"
                                                    value={selectedSector || selectedProcess?.sector || ''}
                                                    onChange={(e) => setSelectedSector(e.target.value)}
                                                    className="input flex-1"
                                                    required
                                                >
                                                    <option value="">Selecione...</option>
                                                    {accessibleSectors.map((sector: any) => {
                                                        const name = typeof sector === 'string' ? sector : sector.name;
                                                        return (
                                                            <option key={name} value={name}>{name}</option>
                                                        );
                                                    })}
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsAddingSector(true)}
                                                    className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                                                    disabled={!isMasterUser}
                                                    title="Adicionar novo setor"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {/* Hidden input to preserve sector value while adding new sector */}
                                                <input type="hidden" name="sector" value={selectedSector || selectedProcess?.sector || ''} />
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={newSectorName}
                                                        onChange={(e) => setNewSectorName(e.target.value)}
                                                        placeholder="Nome do novo setor"
                                                        className="input flex-1"
                                                        autoFocus
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (newSectorName.trim()) {
                                                                addSectorMutation.mutate(newSectorName.trim());
                                                            }
                                                        }}
                                                        disabled={!newSectorName.trim() || addSectorMutation.isPending}
                                                        className="px-3 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {addSectorMutation.isPending ? '...' : 'Salvar'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsAddingSector(false);
                                                            setNewSectorName('');
                                                        }}
                                                        className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                                    >
                                                        Cancelar
                                                    </button>
                                                </div>
                                                {addSectorMutation.isError && (
                                                    <p className="text-sm text-red-600 dark:text-red-400">Erro ao adicionar setor. Verifique se já não existe.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="label">Título</label>
                                    <input
                                        name="title"
                                        defaultValue={selectedProcess?.title}
                                        placeholder="Descrição do processo"
                                        className="input"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="label">Responsável</label>
                                    <input
                                        name="owner"
                                        defaultValue={selectedProcess?.owner || ''}
                                        placeholder="Nome do responsável (opcional)"
                                        className="input"
                                    />
                                </div>
                                {!isOperator && (
                                    <div>
                                        <label className="label">Operador Responsável</label>
                                        <select
                                            name="responsibleUserId"
                                            defaultValue={typeof selectedProcess?.responsibleUserId === 'object' ? (selectedProcess.responsibleUserId as any)?._id : (selectedProcess?.responsibleUserId || '')}
                                            className="input"
                                        >
                                            <option value="">Não atribuído</option>
                                            {users?.map((u) => (
                                                <option key={u.id || u._id} value={u.id || u._id}>
                                                    {u.name} ({u.email})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <p className="section-label form-section pt-2">Planejamento e prazos</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="label">Data Planejada</label>
                                        <input
                                            type="date"
                                            name="plannedDate"
                                            defaultValue={selectedProcess?.plannedDate?.split('T')[0]}
                                            className="input"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Data Limite</label>
                                        <input
                                            type="date"
                                            name="limitDate"
                                            defaultValue={selectedProcess?.limitDate?.split('T')[0]}
                                            className="input"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowModal(false);
                                            setSelectedProcess(null);
                                        }}
                                        className="btn-secondary"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={createMutation.isPending || updateMutation.isPending}
                                        className="btn-primary"
                                    >
                                        {createMutation.isPending || updateMutation.isPending
                                            ? 'Salvando...'
                                            : 'Salvar'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Deliver Modal */}
            {
                showDeliverModal && selectedProcess && (
                    <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
                            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Registrar Entrega</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    {selectedProcess.code} - {selectedProcess.title}
                                </p>
                            </div>
                            <form onSubmit={handleDeliver} className="p-6 space-y-4">
                                <div>
                                    <label className="label">Data de Entrega</label>
                                    <input
                                        type="date"
                                        name="deliveryDate"
                                        defaultValue={(() => {
                                            const now = new Date();
                                            const year = now.getFullYear();
                                            const month = String(now.getMonth() + 1).padStart(2, '0');
                                            const day = String(now.getDate()).padStart(2, '0');
                                            return `${year}-${month}-${day}`;
                                        })()}
                                        className="input disabled:opacity-75 disabled:bg-gray-50 dark:disabled:bg-gray-900"
                                        required
                                        disabled={isOperator}
                                    />
                                </div>
                                <div>
                                    <label className="label">Evidência (opcional)</label>
                                    <textarea
                                        name="deliveryEvidence"
                                        placeholder="Descreva a evidência de entrega..."
                                        className="input min-h-[80px]"
                                        rows={3}
                                    />
                                </div>
                                <div className="flex justify-end gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowDeliverModal(false);
                                            setSelectedProcess(null);
                                        }}
                                        className="btn-secondary"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={confirmDeliveryMutation.isPending}
                                        className="btn-success"
                                    >
                                        {confirmDeliveryMutation.isPending ? 'Salvando...' : 'Confirmar Entrega'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Email Modal */}
            {
                showEmailModal && selectedProcess && (
                    <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
                            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Enviar Processo por Email</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    {selectedProcess.code} - {selectedProcess.title}
                                </p>
                            </div>
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    const formData = new FormData(e.currentTarget);
                                    sendEmailMutation.mutate({
                                        id: selectedProcess._id,
                                        to: formData.get('to') as string,
                                        message: formData.get('message') as string || undefined,
                                    });
                                }}
                                className="p-6 space-y-4"
                            >
                                <div>
                                    <label className="label">Email do Destinatário *</label>
                                    <input
                                        name="to"
                                        type="text"
                                        value={emailTo}
                                        onChange={(e) => setEmailTo(e.target.value)}
                                        placeholder="exemplo@email.com, outro@email.com"
                                        className="input"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="label">Mensagem (opcional)</label>
                                    <textarea
                                        name="message"
                                        placeholder="Adicione uma mensagem personalizada..."
                                        className="input"
                                        rows={3}
                                    />
                                </div>
                                {sendEmailMutation.isError && (
                                    <div className="text-sm text-red-600 dark:text-red-400">
                                        Erro ao enviar email. Tente novamente.
                                    </div>
                                )}
                                <div className="flex gap-3 justify-end">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowEmailModal(false);
                                            setSelectedProcess(null);
                                        }}
                                        className="btn-secondary"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={sendEmailMutation.isPending}
                                        className="btn-primary"
                                    >
                                        {sendEmailMutation.isPending ? 'Enviando...' : 'Enviar Email'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 p-4">
                    <div role="dialog" aria-modal="true" aria-label="Importar processos" className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90dvh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Importar Processos (Excel)</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                O arquivo deve conter as colunas "numero do ID" e "nome do Processo" (as colunas agora aceitam variações de letras maiúsculas/minúsculas).
                            </p>
                        </div>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                const formData = new FormData(e.currentTarget);
                                const file = (formData.get('file') as File);
                                if (!file || file.size === 0) {
                                    setNotice('Selecione um arquivo Excel.');
                                    return;
                                }
                                importMutation.mutate({
                                    file,
                                    sector: formData.get('sector') as string,
                                    plannedDate: formData.get('plannedDate') as string,
                                    limitDate: formData.get('limitDate') as string,
                                    responsibleUserId: formData.get('responsibleUserId') as string || undefined,
                                });
                            }}
                            className="p-6 space-y-4"
                        >
                            <div>
                                <label className="label">Arquivo Excel (.xlsx, .xls)</label>
                                <input
                                    type="file"
                                    name="file"
                                    accept=".xlsx, .xls"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Setor para o lote</label>
                                    <select name="sector" className="input" required>
                                        <option value="">Selecione...</option>
                                        {accessibleSectors.map((sector: any) => {
                                            const name = typeof sector === 'string' ? sector : sector.name;
                                            return (
                                                <option key={name} value={name}>{name}</option>

                                            );
                                        })}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Operador (opcional)</label>
                                    <select name="responsibleUserId" className="input">
                                        <option value="">Não atribuído</option>
                                        {users?.map((u) => (
                                            <option key={u.id || u._id} value={u.id || u._id}>{u.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Data Planejada</label>
                                    <input type="date" name="plannedDate" className="input" required />
                                </div>
                                <div>
                                    <label className="label">Data Limite</label>
                                    <input type="date" name="limitDate" className="input" required />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowImportModal(false)}
                                    className="btn-secondary"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={importMutation.isPending}
                                    className="btn-primary"
                                >
                                    {importMutation.isPending ? 'Importando...' : 'Iniciar Importação'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <CloseMonthModal
                isOpen={isCloseModalOpen}
                onClose={() => setIsCloseModalOpen(false)}
                onConfirm={handleConfirmClose}
                isConfirming={closeCycleMutation.isPending}
                sector={sectorFilter}
            />
        </div>
    );
}

