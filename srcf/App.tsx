import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, ThemeProvider } from './contexts';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProcessList from './pages/ProcessList';
import Reports from './pages/Reports';
import EvaluationSettings from './pages/EvaluationSettings';
import EmailSettings from './pages/EmailSettings';

import CompanyRegistration from './pages/CompanyRegistration';
import UserList from './pages/UserList';
import ClosedCycles from './pages/ClosedCycles';
import EmailLogs from './pages/EmailLogs';
import AuditLogs from './pages/AuditLogs';
import ProcessCurveReport from './pages/ProcessCurveReport';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import SectorList from './pages/SectorList';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
    const { isAdmin, isLoading } = useAuth();

    if (isLoading) {
        return null;
    }

    if (!isAdmin) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}

function PermissionRoute({ children, id }: { children: React.ReactNode; id: string }) {
    const { user, isAdmin, isLoading } = useAuth();

    if (isLoading) {
        return null;
    }

    if (isAdmin) {
        return <>{children}</>;
    }

    if (!user?.allowedMenus?.includes(id)) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-gray-900">Acesso Negado</h2>
                    <p className="text-gray-500">Você não tem permissão para acessar esta página.</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}

function App() {
    return (
        <ThemeProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/verify-email" element={<VerifyEmail />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password/:token" element={<ResetPassword />} />
                    <Route
                        path="/*"
                        element={
                            <ProtectedRoute>
                                <Layout>
                                    <Routes>
                                        <Route path="/" element={<PermissionRoute id="dashboard"><Dashboard /></PermissionRoute>} />
                                        <Route path="/processes" element={<PermissionRoute id="processes"><ProcessList /></PermissionRoute>} />
                                        <Route path="/reports" element={<PermissionRoute id="reports"><Reports /></PermissionRoute>} />
                                        <Route path="/cycles/history" element={<PermissionRoute id="cycle-history"><ClosedCycles /></PermissionRoute>} />
                                        <Route path="/email-logs" element={<PermissionRoute id="email-logs"><EmailLogs /></PermissionRoute>} />
                                        <Route path="/process-curve" element={<PermissionRoute id="process-curve"><ProcessCurveReport /></PermissionRoute>} />
                                        <Route path="/system-logs" element={<PermissionRoute id="system-logs"><AuditLogs /></PermissionRoute>} />

                                        {/* Admin-only routes */}
                                        <Route path="/settings/evaluation" element={<AdminRoute><EvaluationSettings /></AdminRoute>} />
                                        <Route path="/settings/email" element={<AdminRoute><EmailSettings /></AdminRoute>} />
                                        <Route path="/companies/sectors" element={<AdminRoute><SectorList /></AdminRoute>} />
                                        <Route path="/companies" element={<AdminRoute><CompanyRegistration /></AdminRoute>} />
                                        <Route path="/users" element={<AdminRoute><UserList /></AdminRoute>} />

                                        <Route path="*" element={<Navigate to="/" replace />} />
                                    </Routes>
                                </Layout>
                            </ProtectedRoute>
                        }
                    />
                </Routes>
            </BrowserRouter>
        </ThemeProvider>
    );
}

export default App;

