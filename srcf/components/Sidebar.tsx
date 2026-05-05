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
} from 'lucide-react';
import { useState } from 'react';
import { UserRole } from '../types';

import logo from '../assets/logo.png';
import chronosLogo from '../assets/chronos-logo-dark.png';

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
                { id: 'cycle-history', name: 'Histórico de Ciclos', href: '/cycles/history', icon: History },
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
        }
    ];

    const filterItems = (items: any[]) => {
        return items.filter((item) => {
            if (isMaster) return true;
            return user?.allowedMenus?.includes(item.id);
        });
    };

    const activeCompany = companies.find(
        (c) => (c._id || c.id) === selectedCompanyId
    );

    return (
        <aside
            className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800
        transform transition-transform duration-200 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        xl:translate-x-0
      `}
        >
            {/* Header */}
            <div className="flex items-center justify-between h-24 px-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex-1">
                    <img src={chronosLogo} alt="Metodo Chronos Logo" className="w-full h-auto object-contain" />
                </div>
                <button
                    onClick={onClose}
                    className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 xl:hidden"
                >
                    <X className="w-5 h-5 text-gray-500" />
                </button>
            </div>

            {/* Company Selector */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                <div className="relative">
                    <button
                        onClick={() => setCompanyDropdownOpen(!companyDropdownOpen)}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-500" />
                            <span className="text-gray-700 dark:text-gray-300 truncate">
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
            <nav className="p-4 space-y-6 overflow-y-auto max-h-[calc(100vh-16rem)] scrollbar-thin">
                {menuGroups.map((group) => {
                    const filteredItems = filterItems(group.items);
                    if (filteredItems.length === 0) return null;

                    return (
                        <div key={group.title} className="space-y-1">
                            <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                {group.title}
                            </h3>
                            <div className="space-y-1">
                                {filteredItems.map((item) => (
                                    <NavLink
                                        key={item.id}
                                        to={item.href}
                                        onClick={onClose}
                                        className={({ isActive }) =>
                                            `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive
                                                ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
                                                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white'
                                            }`
                                        }
                                    >
                                        <item.icon className="w-5 h-5" />
                                        {item.name}
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </nav>

            {/* User info at bottom */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center">
                        <span className="text-primary-700 dark:text-primary-400 font-medium text-sm">
                            {user?.name?.charAt(0).toUpperCase()}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                    </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/50 flex flex-col items-center gap-2">
                    <p className="text-[10px] text-center text-gray-400 dark:text-gray-500 font-medium tracking-wider uppercase">
                        Desenvolvido por
                    </p>
                    <img src={logo} alt="BridgeLogic Logo" className="w-full h-auto object-contain transition-all" />
                </div>
            </div>
        </aside>
    );
}

