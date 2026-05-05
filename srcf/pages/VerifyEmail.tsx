import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { authApi } from '../api';
import { Mail, ArrowLeft, CheckCircle, RefreshCw } from 'lucide-react';
import logo from '../assets/logo.png';

export default function VerifyEmail() {
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const email = location.state?.email || new URLSearchParams(location.search).get('email');

    useEffect(() => {
        if (!email) {
            navigate('/login');
        }
    }, [email, navigate]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (code.length !== 6) {
            setError('O código deve ter 6 dígitos');
            return;
        }

        setError('');
        setIsLoading(true);

        try {
            await authApi.verifyEmail(email, code);
            setMessage('Conta ativada com sucesso!');
            setTimeout(() => navigate('/login', { state: { message: 'Conta ativada com sucesso! Você já pode fazer login.' } }), 2000);
        } catch (err: any) {
            setError(err.message || 'Código inválido ou expirado');
        } finally {
            setIsLoading(false);
        }
    }

    async function handleResend() {
        setError('');
        setMessage('');
        setIsResending(true);

        try {
            const response = await authApi.resendVerificationCode(email);
            setMessage(response.message);
        } catch (err: any) {
            setError(err.message || 'Erro ao reenviar código');
        } finally {
            setIsResending(false);
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="text-center mb-6">
                    <p className="text-primary-700 font-bold tracking-widest text-3xl">KRONOS</p>
                </div>
                <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">
                    Verifique seu e-mail
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Enviamos um código de 6 dígitos para <span className="font-semibold text-gray-900">{email}</span>
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    {message ? (
                        <div className="text-center">
                            <div className="rounded-full bg-green-100 p-3 mx-auto w-fit mb-4">
                                <CheckCircle className="h-6 w-6 text-green-600" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900">{message}</h3>
                            <p className="mt-2 text-sm text-gray-500">Redirecionando para o login...</p>
                        </div>
                    ) : (
                        <form className="space-y-6" onSubmit={handleSubmit}>
                            {error && (
                                <div className="bg-red-50 border-l-4 border-red-400 p-4">
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            )}

                            <div>
                                <label htmlFor="code" className="block text-sm font-medium text-gray-700">
                                    Código de Verificação
                                </label>
                                <div className="mt-1 relative rounded-md shadow-sm">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Mail className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        id="code"
                                        name="code"
                                        type="text"
                                        required
                                        maxLength={6}
                                        value={code}
                                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                                        className="block w-full pl-10 sm:text-lg font-mono tracking-widest text-center border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                                        placeholder="000000"
                                    />
                                </div>
                            </div>

                            <div>
                                <button
                                    type="submit"
                                    disabled={isLoading || code.length !== 6}
                                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                                >
                                    {isLoading ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        'Verificar Código'
                                    )}
                                </button>
                            </div>

                            <div className="flex items-center justify-between">
                                <button
                                    type="button"
                                    disabled={isResending}
                                    onClick={handleResend}
                                    className="text-sm font-medium text-primary-600 hover:text-primary-500 flex items-center"
                                >
                                    {isResending ? (
                                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                    )}
                                    Reenviar código
                                </button>

                                <Link to="/login" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700">
                                    <ArrowLeft className="h-4 w-4 mr-2" />
                                    Voltar para o login
                                </Link>
                            </div>
                        </form>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="mt-12 text-center flex flex-col items-center gap-4">
                <p className="text-gray-500 text-sm font-medium">
                    Desenvolvido Por
                </p>
                <img
                    src={logo}
                    alt="BridgeLogic Logo"
                    className="h-24 w-auto drop-shadow-lg rounded-lg"
                    title="BridgeLogic Tecnologia"
                />
            </div>
        </div>
    );
}


