import { useState } from 'react';
import { useAuth } from '../contexts';
import { Link, useLocation, Navigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, AlertCircle, CheckCircle } from 'lucide-react';
import chronosLogo from '../assets/chronos-logo-dark.png';
import bridgeLogicLogo from '../assets/logo.png';

export default function Login() {
    const { login, isAuthenticated, isLoading } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const location = useLocation();
    const message = location.state?.message;

    if (isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(email, password);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao fazer login');
        } finally {
            setLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-gray-900 to-slate-950 p-4 relative overflow-hidden">
            {/* Background Accents for depth */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-900/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary-800/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-md flex flex-col items-center relative z-10">
                {/* Logo */}
                <div className="mb-10 transform hover:scale-105 transition-transform duration-500">
                    <div className="p-4 bg-white/5 rounded-2xl backdrop-blur-sm border border-white/5 shadow-inner">
                        <img
                            src={chronosLogo}
                            alt="Metodo Chronos Logo"
                            className="h-40 w-auto drop-shadow-[0_0_20px_rgba(34,197,94,0.4)]"
                        />
                    </div>
                </div>

                {/* Login Card */}
                <div className="w-full bg-slate-900/60 rounded-[2rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] p-10 backdrop-blur-2xl border border-white/10">
                    <h2 className="text-3xl font-bold text-white mb-2 tracking-tight text-center">METODO CHRONOS</h2>
                    <p className="text-primary-500 font-medium mb-8 text-center">Making Money Method</p>

                    {error && (
                        <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-lg flex items-center gap-2 text-danger-700 text-sm">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {message && (
                        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700 text-sm">
                            <CheckCircle className="w-4 h-4 flex-shrink-0" />
                            {message}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="label text-slate-200 font-semibold mb-2 ml-1" htmlFor="email">
                                E-mail
                            </label>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="input w-full bg-white/5 border-white/10 text-white placeholder-slate-500 py-3 px-4 rounded-xl transition-all focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500/50 outline-none"
                                placeholder="seu@email.com"
                                required
                                autoComplete="email"
                            />
                        </div>

                        <div>
                            <label className="label text-slate-200 font-semibold mb-2 ml-1" htmlFor="password">
                                Senha
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="input w-full pr-12 bg-white/5 border-white/10 text-white placeholder-slate-500 py-3 px-4 rounded-xl transition-all focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500/50 outline-none"
                                    placeholder="••••••••"
                                    required
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                                >
                                    {showPassword ? (
                                        <EyeOff className="w-5 h-5" />
                                    ) : (
                                        <Eye className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white py-4 rounded-xl font-bold text-lg shadow-[0_10px_20px_rgba(34,197,94,0.3)] hover:shadow-[0_15px_30px_rgba(34,197,94,0.4)] transition-all transform hover:-translate-y-1 active:scale-[0.98]"
                        >
                            {loading ? (
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto"></div>
                            ) : (
                                <div className="flex items-center justify-center gap-3">
                                    <LogIn className="w-6 h-6" />
                                    Entrar
                                </div>
                            )}
                        </button>
                    </form>

                    <div className="mt-8">
                        <Link
                            to="/register"
                            className="block text-center text-sm font-semibold text-slate-400 hover:text-primary-400 transition-colors py-2"
                        >
                            Não tem uma conta? <span className="text-primary-500 hover:underline">Crie aqui</span>
                        </Link>
                    </div>

                </div>

                {/* Footer */}
                <div className="mt-16 text-center flex flex-col items-center gap-4">
                    <p className="text-slate-400 text-xs font-bold tracking-widest uppercase opacity-80">
                        Desenvolvido por
                    </p>
                    <div className="p-4 bg-white/5 rounded-2xl backdrop-blur-sm border border-white/5 shadow-inner">
                        <img
                            src={bridgeLogicLogo}
                            alt="BridgeLogic Logo"
                            className="h-32 w-auto transition-all duration-500"
                            title="BridgeLogic Tecnologia"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

