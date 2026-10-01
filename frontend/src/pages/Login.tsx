import { useState } from 'react';
import { useAuth } from '../contexts';
import { Link, useLocation, Navigate } from 'react-router-dom';
import { AlertCircle, CalendarClock, ChartNoAxesCombined, CheckCircle, Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react';
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

    if (isAuthenticated) return <Navigate to="/" replace />;

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
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
        return <div className="min-h-[100dvh] flex items-center justify-center bg-slate-950"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" /></div>;
    }

    return (
        <div className="min-h-[100dvh] bg-slate-950 text-white lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(440px,0.92fr)] relative overflow-x-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(22,163,74,0.20),transparent_34%),radial-gradient(circle_at_82%_88%,rgba(14,116,144,0.14),transparent_30%)] pointer-events-none" />

            <section className="hidden lg:flex relative z-10 min-h-[100dvh] flex-col justify-between px-10 xl:px-16 py-9 xl:py-12 border-r border-white/10 overflow-hidden">
                <div className="flex items-center gap-4">
                    <div className="rounded-2xl border border-white/10 bg-black/40 p-2.5 shadow-2xl shadow-primary-950/30">
                        <img src={chronosLogo} alt="Método Chronos" className="h-24 xl:h-28 w-auto object-contain" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary-400">Método Chronos</p>
                        <p className="mt-1 text-sm text-slate-400">Making Money Method</p>
                    </div>
                </div>

                <div className="max-w-2xl py-8">
                    <span className="inline-flex items-center gap-2 rounded-full border border-primary-400/20 bg-primary-400/10 px-3 py-1.5 text-xs font-semibold text-primary-300">
                        <ShieldCheck className="h-4 w-4" /> Gestão segura e centralizada
                    </span>
                    <h1 className="mt-6 text-4xl xl:text-5xl font-bold leading-[1.08] tracking-tight">Prazos, processos e performance em uma visão clara.</h1>
                    <p className="mt-5 max-w-xl text-base xl:text-lg leading-relaxed text-slate-300">Organize ciclos, acompanhe entregas e transforme a rotina de cada setor em decisões mais rápidas.</p>

                    <div className="mt-8 grid grid-cols-2 gap-3 max-w-xl">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur-sm">
                            <CalendarClock className="h-5 w-5 text-primary-400" />
                            <p className="mt-3 text-sm font-semibold">Ciclos e prazos</p>
                            <p className="mt-1 text-xs leading-relaxed text-slate-400">Agenda operacional sempre atualizada.</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur-sm">
                            <ChartNoAxesCombined className="h-5 w-5 text-cyan-400" />
                            <p className="mt-3 text-sm font-semibold">Indicadores objetivos</p>
                            <p className="mt-1 text-xs leading-relaxed text-slate-400">Visibilidade para agir no momento certo.</p>
                        </div>
                    </div>
                </div>
                <p className="text-xs text-slate-500">Acesso exclusivo para usuários autorizados.</p>
            </section>

            <main className="relative z-10 flex min-h-[100dvh] items-center justify-center px-4 py-6 sm:px-8 lg:px-10">
                <div className="w-full max-w-md">
                    <div className="mb-5 flex items-center justify-center gap-3 lg:hidden">
                        <div className="rounded-xl border border-white/10 bg-black/40 p-1.5"><img src={chronosLogo} alt="Método Chronos" className="h-14 w-auto object-contain" /></div>
                        <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-400">Método Chronos</p><p className="text-xs text-slate-400">Making Money Method</p></div>
                    </div>

                    <div className="w-full rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-[0_28px_70px_-24px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
                        <div className="mb-7">
                            <p className="text-sm font-semibold text-primary-400">Bem-vindo de volta</p>
                            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">Acesse sua conta</h2>
                            <p className="mt-2 text-sm text-slate-400">Entre para continuar no painel de gestão.</p>
                        </div>

                        {error && <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-lg flex items-center gap-2 text-danger-700 text-sm"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
                        {message && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700 text-sm"><CheckCircle className="w-4 h-4 flex-shrink-0" />{message}</div>}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="label text-slate-200 font-semibold mb-2" htmlFor="email">E-mail</label>
                                <input type="email" id="email" value={email} onChange={(event) => setEmail(event.target.value)} className="input w-full bg-white/5 border-white/10 text-white placeholder-slate-500 py-3 px-4 rounded-xl transition-all focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500/50 outline-none" placeholder="seu@email.com" required autoComplete="email" />
                            </div>
                            <div>
                                <label className="label text-slate-200 font-semibold mb-2" htmlFor="password">Senha</label>
                                <div className="relative">
                                    <input type={showPassword ? 'text' : 'password'} id="password" value={password} onChange={(event) => setPassword(event.target.value)} className="input w-full pr-12 bg-white/5 border-white/10 text-white placeholder-slate-500 py-3 px-4 rounded-xl transition-all focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500/50 outline-none" placeholder="••••••••" required autoComplete="current-password" />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                            <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white py-3.5 rounded-xl font-bold shadow-[0_10px_24px_rgba(22,163,74,0.24)] hover:shadow-[0_14px_28px_rgba(22,163,74,0.32)] transition-all hover:-translate-y-0.5 active:scale-[0.99] disabled:hover:translate-y-0">
                                {loading ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto" /> : <div className="flex items-center justify-center gap-3"><LogIn className="w-5 h-5" />Entrar</div>}
                            </button>
                        </form>

                        <div className="mt-6 border-t border-white/10 pt-5">
                            <Link to="/register" className="block text-center text-sm font-semibold text-slate-400 hover:text-primary-400 transition-colors py-1">Não tem uma conta? <span className="text-primary-500 hover:underline">Crie aqui</span></Link>
                        </div>
                    </div>

                    <div className="mt-5 flex items-center justify-center gap-3 text-slate-500">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.22em]">Desenvolvido por</span>
                        <img src={bridgeLogicLogo} alt="BridgeLogic Tecnologia" className="h-9 w-auto rounded-md opacity-80" />
                    </div>
                </div>
            </main>
        </div>
    );
}
