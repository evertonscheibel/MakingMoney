import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts';
import { Mail, ArrowLeft, Send } from 'lucide-react';
import logo from '../assets/logo.png';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { forgotPassword } = useAuth();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await forgotPassword(email);
            setIsSubmitted(true);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Erro ao enviar e-mail de recuperação');
        } finally {
            setIsLoading(false);
        }
    }

    if (isSubmitted) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
                <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                    <div className="mb-6">
                        <p className="text-primary-700 font-bold tracking-widest text-3xl">KRONOS</p>
                    </div>
                    <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                        <div className="rounded-full bg-green-100 p-3 mx-auto w-fit mb-4">
                            <Send className="h-6 w-6 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">E-mail enviado!</h2>
                        <p className="text-gray-600 mb-6">
                            Se o e-mail informado estiver cadastrado, você receberá um link para redefinir sua senha em instantes.
                        </p>
                        <Link
                            to="/login"
                            className="inline-flex items-center text-primary-600 hover:text-primary-500 font-medium"
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Voltar para o login
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="text-center mb-6">
                    <p className="text-primary-700 font-bold tracking-widest text-3xl">KRONOS</p>
                </div>
                <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">
                    Recuperar senha
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Informe seu e-mail para receber um link de redefinição.
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        {error && (
                            <div className="bg-red-50 border-l-4 border-red-400 p-4">
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        )}

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                E-mail
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-10 sm:text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                                    placeholder="seu@e-mail.com"
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                            >
                                {isLoading ? (
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    'Enviar link de recuperação'
                                )}
                            </button>
                        </div>

                        <div className="text-center">
                            <Link to="/login" className="inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-500">
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Voltar para o login
                            </Link>
                        </div>
                    </form>
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

