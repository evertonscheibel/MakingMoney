import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts';
import {
    LayoutDashboard,
    ClipboardList,
    BarChart3,
    Settings,
    Mail,
    X,
    Building2,
    ChevronDown,
    Users,
    MailOpen,
    History,
    CalendarClock,
    Award,
    HelpCircle,
} from 'lucide-react';
import { useState } from 'react';
import { UserRole } from '../types';

import logo from '../assets/bridge-tecnologia.png';
import chronosLogo from '../assets/chronos-logo-dark.png';
import { hasMenuAccess } from '../utils/menuPermissions';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const { user, companies, switchCompany, selectedCompanyId } = useAuth();
    const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
    const [isSwitching, setIsSwitching] = useState(false);

    const isMaster = user?.roles.includes(UserRole.MASTER);

    const menuGroups = [
        {
            title: 'Geral',
            items: [
                { id: 'dashboard', name: 'Dashboard', href: '/', icon: LayoutDashboard },
                { id: 'processes', name: 'Processos', href: '/processes', icon: ClipboardList },
                { id: 'reports', name: 'Relatórios', href: '/reports', icon: BarChart3 },
                { id: 'process-curve', name: 'Curva de Processo', href: '/process-curve', icon: BarChart3 },
                { id: 'bonus-report', name: 'Bonificações', href: '/bonus-report', icon: Award },
                { id: 'cycle-history', name: 'Histórico de Ciclos', href: '/cycles/history', icon: History },
                { id: 'date-changes', name: 'Alterações de Datas', href: '/date-changes', icon: CalendarClock },
            ]
        },
        {
            title: 'Configurações',
            items: [
                { id: 'users', name: 'Usuários', href: '/users', icon: Users },
                { id: 'sectors', name: 'Setores', href: '/companies/sectors', icon: Building2 },
                { id: 'companies', name: 'Empresas', href: '/companies', icon: Building2 },
                { id: 'evaluation-parameters', name: 'Parâmetros de Avaliação', href: '/settings/evaluation', icon: Settings },
                { id: 'email-settings', name: 'Config. Email', href: '/settings/email', icon: Mail },
                { id: 'system-logs', name: 'Logs do Sistema', href: '/system-logs', icon: ClipboardList },
                { id: 'email-logs', name: 'Logs de Email', href: '/email-logs', icon: MailOpen },
            ]
        },
        {
            title: 'Suporte',
            items: [
                { id: 'help', name: 'Ajuda', href: '/help', icon: HelpCircle, alwaysVisible: true },
            ]
        }
    ];

    const filterItems = (items: any[]) => {
        return items.filter((item) => {
            if (item.alwaysVisible) return true;
            if (['system-logs', 'email-logs', 'date-changes'].includes(item.id) && !isMaster) return false;
            if (isMaster) return true;
            return hasMenuAccess(user?.allowedMenus, item.id);
        });
    };

    const activeCompany = companies.find(
        (c) => (c._id || c.id) === selectedCompanyId
    );

    return (
        <aside
            className={`
        fixed inset-y-0 left-0 z-50 w-[min(18rem,88vw)] xl:w-[17rem] bg-white dark:bg-gray-950 border-r border-slate-200 dark:border-slate-800
        transform transition-transform duration-200 ease-in-out
        flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        xl:translate-x-0
      `}
        >
            {/* Header */}
            <div className="relative flex-none h-[9.25rem] overflow-hidden bg-slate-950 border-b border-slate-800">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(22,163,74,0.24),transparent_44%)]" />
                <div className="relative flex h-full items-center justify-between px-4">
                    <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
                        <div className="h-[4.5rem] w-[10rem] flex-none overflow-hidden rounded-2xl border border-white/10 bg-black shadow-lg shadow-black/30">
                            <img src={chronosLogo} alt="Logo Making Money — Método Chronos" className="h-full w-full object-contain" />
                        </div>
                        <div className="min-w-0 w-full text-center">
                            <p className="text-base font-bold leading-tight text-white">Making Money</p>
                            <p className="mt-1 text-sm font-semibold leading-tight text-primary-300">Método Chronos</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="absolute right-2 top-2 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white xl:hidden"
                        aria-label="Fechar menu"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Company Selector */}
            <div className="flex-none px-3 py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="relative">
                    <button
                        onClick={() => setCompanyDropdownOpen(!companyDropdownOpen)}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary-300 hover:bg-white dark:hover:border-primary-800 dark:hover:bg-slate-900 transition-all shadow-sm"
                    >
                        <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-900/30">
                                <Building2 className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                            </span>
                            <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
                                {activeCompany?.name || 'Selecione uma empresa'}
                            </span>
                        </div>
                        <ChevronDown
                            className={`w-4 h-4 text-gray-400 transition-transform ${companyDropdownOpen ? 'rotate-180' : ''
                                }`}
                        />
                    </button>

                    {/* Dropdown */}
                    {companyDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg z-10">
                            {companies.map((company) => (
                                <button
                                    key={company._id || company.id}
                                    disabled={isSwitching}
                                    onClick={async () => {
                                        if (window.confirm(`Deseja alterar para a empresa "${company.name}"? O sistema será atualizado.`)) {
                                            setIsSwitching(true);
                                            try {
                                                await switchCompany(company._id || company.id!);
                                                setCompanyDropdownOpen(false);
                                                window.location.reload();
                                            } catch (error: any) {
                                                alert(`Erro ao trocar de empresa: ${error.message || 'Erro desconhecido'}`);
                                            } finally {
                                                setIsSwitching(false);
                                            }
                                        }
                                    }}
                                    className={`w-full px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-800 first:rounded-t-lg last:rounded-b-lg ${(company._id || company.id) === selectedCompanyId
                                        ? 'bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400'
                                        : 'text-gray-700 dark:text-gray-300'
                                        } ${isSwitching ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {isSwitching ? 'Alterando...' : company.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 min-h-0 px-3 py-4 space-y-5 overflow-y-auto scrollbar-thin">
                {menuGroups.map((group) => {
                    const filteredItems = filterItems(group.items);
                    if (filteredItems.length === 0) return null;

                    return (
                        <div key={group.title} className="space-y-1">
                            <h3 className="px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.16em] mb-2">
                                {group.title}
                            </h3>
                            <div className="space-y-1">
                                {filteredItems.map((item) => (
                                    <NavLink
                                        key={item.id}
                                        to={item.href}
                                        onClick={onClose}
                                        className={({ isActive }) =>
                                            `group flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all ${isActive
                                                ? 'bg-primary-50 text-primary-700 shadow-sm ring-1 ring-primary-100 dark:bg-primary-900/20 dark:text-primary-400 dark:ring-primary-900/40'
                                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white'
                                            }`
                                        }
                                    >
                                        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors group-hover:bg-white group-hover:text-primary-600 dark:bg-slate-900 dark:text-slate-400 dark:group-hover:bg-slate-800 dark:group-hover:text-primary-400">
                                            <item.icon className="w-4 h-4" />
                                        </span>
                                        <span className="leading-tight">{item.name}</span>
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </nav>

            {/* User info at bottom */}
            <div className="flex-none px-3 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950">
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="w-9 h-9 bg-primary-100 dark:bg-primary-900/40 rounded-xl flex items-center justify-center">
                        <span className="text-primary-700 dark:text-primary-400 font-medium text-sm">
                            {user?.name?.charAt(0).toUpperCase()}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                    </div>
                </div>
                <div className="mt-2.5 rounded-xl border border-slate-800 bg-slate-950 p-2">
                    <p className="mb-1.5 text-center text-[9px] text-slate-400 font-semibold tracking-[0.16em] uppercase">Desenvolvido por Bridge Tecnologia</p>
                    <div className="w-full">
                        <img src={logo} alt="Bridge Tecnologia — Padronização, Automação, Indicadores acionáveis, Execução simples, Auditável e Escalável" className="block h-auto w-full rounded-md object-contain" />
                    </div>
                </div>
            </div>
        </aside>
    );
}
