import { useLocation } from 'react-router-dom';
import { useAuth, useTheme } from '../contexts';
import { Menu, LogOut, Sun, Moon, CalendarDays } from 'lucide-react';

const titles: Record<string, string> = {
    '/': 'Visão geral', '/processes': 'Processos', '/reports': 'Relatórios',
    '/process-curve': 'Curva de processo', '/bonus-report': 'Bonificações',
    '/cycles/history': 'Histórico de ciclos', '/users': 'Usuários',
    '/companies/sectors': 'Setores', '/companies': 'Empresas',
    '/settings/evaluation': 'Parâmetros de avaliação', '/settings/email': 'Configurações de e-mail',
    '/system-logs': 'Logs do sistema', '/email-logs': 'Logs de e-mail', '/help': 'Ajuda',
};

export default function Header({ onMenuClick, cycleMonth }: { onMenuClick: () => void; cycleMonth?: string }) {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { pathname } = useLocation();
    const cycleLabel = cycleMonth ? (() => {
        const [year, month] = cycleMonth.split('-').map(Number);
        return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {month: 'short', year: 'numeric'});
    })() : 'Sem ciclo ativo';
    return (
        <header className="flex-none z-30 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
            <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 py-3">
                <div className="flex items-center gap-3 min-w-0">
                    <button onClick={onMenuClick} className="header-action xl:hidden" aria-label="Abrir menu"><Menu className="w-5 h-5" /></button>
                    <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-[.16em] font-semibold text-gray-500">Método Chronos</p>
                        <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{titles[pathname] || 'Gestão Chronos'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                    <span className="hidden md:inline-flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-gray-900 px-3 py-2 text-xs text-gray-600 dark:text-gray-300" title="Ciclo aberto de referência; o período consultado aparece nos filtros da página">
                        <CalendarDays className="w-4 h-4 text-primary-600" />{cycleLabel}
                    </span>
                    <span className="hidden lg:block text-sm text-gray-600 dark:text-gray-300 max-w-40 truncate">{user?.name}</span>
                    <button onClick={toggleTheme} className="header-action" aria-label={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}>
                        {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                    </button>
                    <button onClick={logout} className="header-action" aria-label="Sair"><LogOut className="w-4 h-4" /></button>
                </div>
            </div>
        </header>
    );
}
