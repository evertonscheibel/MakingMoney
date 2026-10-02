import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Check, Mail, RefreshCw, Sparkles, Users, X } from 'lucide-react';
import { useAuth } from '../contexts';
import { UserRole } from '../types';

const NOTICE_VERSION = '2026-10-manager-updates';

const updates = [
    { icon: CalendarDays, title: 'Calendário com reagendamento', description: 'Em Relatórios, arraste os marcadores P (planejado) e L (limite) para ajustar as datas dos processos permitidos. O calendário também destaca os dias com maior concentração de atividades.' },
    { icon: RefreshCw, title: 'Ciclos e regras para domingos', description: 'O fechamento automático e a abertura do próximo ciclo podem ser configurados por setor, com dia, horário e regras para datas que caem no domingo. Após a abertura automática, os gestores recebem um e-mail para revisar o novo ciclo.' },
    { icon: Users, title: 'Mais de um responsável por setor', description: 'Agora é possível cadastrar vários gestores no mesmo setor para compartilhar o acompanhamento e receber as notificações.' },
    { icon: Mail, title: 'E-mails personalizados por categoria', description: 'Nas configurações de e-mail, os usuários com permissão podem personalizar o assunto e o corpo das mensagens de cada categoria.' },
];

export default function ManagerReleaseNotice() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);

    const storageKey = useMemo(() => {
        if (!user) return null;
        return `chronos:release-notice:${NOTICE_VERSION}:${user.id || user._id}:${user.activeCompanyId || 'no-company'}`;
    }, [user]);

    const isSectorManager = useMemo(() => {
        if (!user) return false;
        const userId = user.id || user._id;
        const activeCompanyRole = user.companyAccess?.find(
            access => access.companyId === user.activeCompanyId,
        )?.role;
        const managesRegisteredSector = user.activeCompany?.sectors?.some(
            sector => [...(sector.managerIds || []), ...(sector.managerId ? [sector.managerId] : [])].some(id => String(id) === String(userId)),
        );

        return user.roles.includes(UserRole.MANAGER)
            || activeCompanyRole === UserRole.MANAGER
            || Boolean(managesRegisteredSector);
    }, [user]);

    useEffect(() => {
        setIsOpen(Boolean(storageKey && isSectorManager && !localStorage.getItem(storageKey)));
    }, [isSectorManager, storageKey]);

    const acknowledge = () => {
        if (storageKey) localStorage.setItem(storageKey, new Date().toISOString());
        setIsOpen(false);
    };

    const openReports = () => {
        acknowledge();
        navigate('/reports');
    };

    if (!isOpen || !isSectorManager) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="release-notice-title">
            <div className="absolute inset-0 bg-gray-950/60 backdrop-blur-sm" />
            <div className="relative w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-white/20 dark:border-gray-700">
                <div className="relative bg-gradient-to-br from-primary-700 via-primary-600 to-indigo-600 px-6 py-7 text-white">
                    <div className="absolute -right-10 -top-12 w-40 h-40 rounded-full bg-white/10" />
                    <button
                        type="button"
                        onClick={acknowledge}
                        className="absolute right-4 top-4 rounded-lg p-2 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                        aria-label="Fechar aviso"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="relative flex items-center gap-2 text-sm font-semibold text-white/90 mb-3">
                        <Sparkles className="w-4 h-4" />
                        Novidades no Método Chronos
                    </div>
                    <h2 id="release-notice-title" className="relative text-2xl font-bold text-white">Novas ferramentas para os gestores</h2>
                    <p className="relative mt-2 text-sm leading-6 text-primary-50">
                        Conheça as novidades de outubro para organizar os processos e acompanhar sua equipe.
                    </p>
                </div>

                <div className="p-6 space-y-5">
                    {updates.map(({ icon: Icon, title, description }) => (
                    <div key={title} className="flex gap-4">
                        <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                            <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
                            <p className="mt-1 text-sm leading-5 text-gray-600 dark:text-gray-400">
                                {description}
                            </p>
                        </div>
                    </div>
                    ))}

                    <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-4 py-3 flex items-start gap-2.5 text-xs leading-5 text-gray-600 dark:text-gray-300">
                        <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-success-600" />
                        Revise as datas do novo ciclo e confira com a administração as configurações do seu setor.
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                        <button type="button" onClick={acknowledge} className="btn-secondary">
                            Entendi
                        </button>
                        <button type="button" onClick={openReports} className="btn-primary">
                            <CalendarDays className="w-4 h-4" />
                            Abrir calendário
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
