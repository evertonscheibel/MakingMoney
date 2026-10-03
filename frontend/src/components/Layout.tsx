import { ReactNode, useState } from 'react';
import Sidebar from './Sidebar';
import { useQuery } from '@tanstack/react-query';
import { cyclesApi } from '../api';
import { useAuth } from '../contexts';
import Header from './Header';
import ManagerReleaseNotice from './ManagerReleaseNotice';

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

    return (
        <div className="h-screen flex overflow-hidden bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
            <ManagerReleaseNotice />
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
            <div className="flex-1 flex flex-col min-w-0 xl:pl-[17rem]">
                <Header onMenuClick={() => setSidebarOpen(true)} cycleMonth={currentCycle?.month} />

                <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8 chronos-main">
                    {children}
                </main>
            </div>
        </div>
    );
}

