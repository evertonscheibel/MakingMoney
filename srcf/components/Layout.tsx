import { ReactNode, useState } from 'react';
import Sidebar from './Sidebar';
import { useQuery } from '@tanstack/react-query';
import { cyclesApi } from '../api';
import { useAuth } from '../contexts';
import { Calendar, Clock } from 'lucide-react'; // Example icons
import Header from './Header';

interface LayoutProps {
    children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { user } = useAuth(); // Need auth for enabled

    const { data: currentCycle } = useQuery({
        queryKey: ['currentCycle'],
        queryFn: () => cyclesApi.getCurrent(),
        enabled: !!user?.activeCompanyId,
        refetchOnWindowFocus: false, // Dont flicker
    });

    const formatCycleMonth = (monthStr?: string) => {
        if (!monthStr) return 'Nenhum ativo';
        const [year, month] = monthStr.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    };

    return (
        <div className="h-screen flex overflow-hidden bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
            {/* Mobile sidebar backdrop */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-gray-900/50 z-40 xl:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            {/* Main content */}
            <div className="flex-1 flex flex-col min-w-0 xl:pl-64">
                <Header onMenuClick={() => setSidebarOpen(true)} />

                {/* Global Info Bar */}
                <div className="flex-none px-6 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center text-sm gap-3 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                        <Clock className="w-4 h-4 text-primary-500" />
                        <span className="font-medium">Data:</span>
                        <span className="capitalize">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 bg-success-50 dark:bg-success-900/20 px-3 py-1 rounded-full border border-success-100 dark:border-success-800">
                        <Calendar className="w-4 h-4 text-success-600" />
                        <span className="font-medium text-success-700 dark:text-success-300">Ciclo Aberto:</span>
                        <span className="font-bold text-success-700 dark:text-success-300 capitalize">
                            {formatCycleMonth(currentCycle?.month)}
                        </span>
                    </div>
                </div>

                <main className="flex-1 flex flex-col p-6 overflow-hidden">
                    <div className="flex-1 flex flex-col min-h-0">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}

