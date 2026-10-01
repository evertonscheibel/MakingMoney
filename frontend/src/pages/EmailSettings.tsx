import { useState, useEffect } from 'react';
import { settingsApi } from '../api';
import { useAuth } from '../contexts';
import { Mail, Shield, Server, User, Key, Save, CheckCircle2, AlertCircle, Loader } from 'lucide-react';
import { SMTPSecurityMode } from '../types';

export default function EmailSettings() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<any>(null);

    const [form, setForm] = useState({
        host: '',
        port: 587,
        securityMode: SMTPSecurityMode.STARTTLS,
        user: '',
        pass: '',
        fromName: 'Metodo Chronos',
        fromEmail: '',
        recipients: [] as string[],
    });

    useEffect(() => {
        if (user?.activeCompanyId) {
            loadConfig();
        }
    }, [user?.activeCompanyId]);

    const loadConfig = async () => {
        try {
            setLoading(true);
            const [config, loadedTemplates] = await Promise.all([settingsApi.email.get(), settingsApi.emailTemplates.list()]);
            setTemplates(loadedTemplates);
            if (config) {
                setForm({
                    host: config.host || '',
                    port: config.port || 587,
                    securityMode: config.securityMode || SMTPSecurityMode.STARTTLS,
                    user: config.auth?.user || '',
                    pass: '********', // Password mask
                    fromName: config.fromName || 'Metodo Chronos',
                    fromEmail: config.fromEmail || '',
                    recipients: config.recipients || [],
                });
            }
        } catch (error) {
            console.error('Failed to load config:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveTemplate = async () => {
        if (!selectedTemplate) return;
        await settingsApi.emailTemplates.update(selectedTemplate.category, selectedTemplate);
        setTemplates(items => items.map(item => item.category === selectedTemplate.category ? selectedTemplate : item));
        alert('Modelo de e-mail salvo. Os próximos envios desta categoria usarão este conteúdo.');
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;

        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setForm(prev => ({
                ...prev,
                securityMode: checked ? SMTPSecurityMode.SSL_TLS : SMTPSecurityMode.STARTTLS
            }));
            return;
        }

        setForm(prev => ({
            ...prev,
            [name]: name === 'port' ? parseInt(value) || 0 : value
        }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setTestResult(null);
        try {
            await settingsApi.email.update(form);
            alert('Configurações salvas com sucesso!');
        } catch (error) {
            alert('Erro ao salvar configurações.');
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            // Include testRecipient as fromEmail for validation
            const result = await settingsApi.email.test({
                ...form,
                testRecipient: form.fromEmail
            });
            setTestResult({ success: true, message: result?.message || 'Conexão SMTP bem sucedida!' });
        } catch (error: any) {
            // The API client interceptor already extracts the error message from the response
            setTestResult({
                success: false,
                message: error?.message || 'Falha na conexão SMTP.'
            });
        } finally {
            setTesting(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando configurações...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Configuração de Email (SMTP)</h1>
                <p className="text-gray-500">Configure o servidor de email para envio de notificações e alertas.</p>
            </div>

            <div className="card">
                <form onSubmit={handleSave} className="space-y-6">
                    {/* Server Settings */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Server className="w-5 h-5 text-gray-500" /> Servidor
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Host SMTP</label>
                                <input
                                    type="text"
                                    name="host"
                                    value={form.host}
                                    onChange={handleChange}
                                    placeholder="smtp.exemplo.com"
                                    className="input w-full"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Porta</label>
                                <input
                                    type="number"
                                    name="port"
                                    value={form.port}
                                    onChange={handleChange}
                                    placeholder="587"
                                    className="input w-full"
                                    required
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="secure"
                                name="secure"
                                checked={form.securityMode === SMTPSecurityMode.SSL_TLS}
                                onChange={handleChange}
                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <label htmlFor="secure" className="text-sm text-gray-700 flex items-center gap-1">
                                <Shield className="w-4 h-4" /> Usar conexão segura (SSL/TLS)
                            </label>
                        </div>
                    </div>

                    <hr />

                    {/* Auth Settings */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Key className="w-5 h-5 text-gray-500" /> Autenticação
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Usuário</label>
                                <div className="relative">
                                    <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                                    <input
                                        type="text"
                                        name="user"
                                        value={form.user}
                                        onChange={handleChange}
                                        className="input w-full pl-9"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                                <div className="relative">
                                    <Key className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                                    <input
                                        type="password"
                                        name="pass"
                                        value={form.pass}
                                        onChange={handleChange}
                                        className="input w-full pl-9"
                                        placeholder={form.pass === '********' ? '********' : 'Nova senha'}
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <hr />

                    {/* Sender Settings */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Mail className="w-5 h-5 text-gray-500" /> Remetente
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Remetente</label>
                                <input
                                    type="text"
                                    name="fromName"
                                    value={form.fromName}
                                    onChange={handleChange}
                                    className="input w-full"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email do Remetente</label>
                                <input
                                    type="email"
                                    name="fromEmail"
                                    value={form.fromEmail}
                                    onChange={handleChange}
                                    className="input w-full"
                                    required
                                />
                                {form.fromEmail && form.user && form.fromEmail !== form.user && (
                                    <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        Atenção: Para Skymail/Outlook, o remetente deve ser igual ao usuário.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>


                    <hr />

                    {/* Recipients Settings */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <User className="w-5 h-5 text-gray-500" /> Destinatários
                        </h2>
                        <p className="text-sm text-gray-500">
                            E-mails que receberão notificações automáticas de processos finalizados.
                        </p>

                        <div className="flex gap-2">
                            <input
                                type="email"
                                id="newRecipient"
                                placeholder="adicionar@email.com"
                                className="input flex-1"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const input = e.currentTarget;
                                        const email = input.value.trim();
                                        if (email && !form.recipients.includes(email)) {
                                            setForm(prev => ({ ...prev, recipients: [...prev.recipients, email] }));
                                            input.value = '';
                                        }
                                    }
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    const input = document.getElementById('newRecipient') as HTMLInputElement;
                                    const email = input.value.trim();
                                    if (email && !form.recipients.includes(email)) {
                                        setForm(prev => ({ ...prev, recipients: [...prev.recipients, email] }));
                                        input.value = '';
                                    }
                                }}
                                className="btn btn-secondary"
                            >
                                Adicionar
                            </button>
                        </div>

                        {form.recipients.length > 0 ? (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {form.recipients.map((email) => (
                                    <div key={email} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full flex items-center gap-2 text-sm">
                                        <span>{email}</span>
                                        <button
                                            type="button"
                                            onClick={() => setForm(prev => ({ ...prev, recipients: prev.recipients.filter(r => r !== email) }))}
                                            className="text-gray-400 hover:text-danger-600 font-bold"
                                        >
                                            &times;
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-400 italic">
                                Nenhum destinatário configurado. (Notificações serão enviadas para Admins por padrão)
                            </p>
                        )}
                    </div>

                    {/* Results / Feedback */}
                    {
                        testResult && (
                            <div className={`p-4 rounded-lg flex items-center gap-3 ${testResult.success ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700'}`}>
                                {testResult.success ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
                                <div className="flex flex-col">
                                    <span className="font-medium">{testResult.message}</span>
                                    {!testResult.success && (
                                        <span className="text-xs mt-1 opacity-80">
                                            Dica: Tente porta 587 (SSL desligado) ou 465 (SSL ligado).
                                        </span>
                                    )}
                                </div>
                            </div>
                        )
                    }

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={handleTest}
                            disabled={testing || saving}
                            className="btn btn-secondary flex items-center gap-2"
                        >
                            {testing ? <Loader className="w-4 h-4 animate-spin" /> : 'Testar Conexão'}
                        </button>
                        <button
                            type="submit"
                            disabled={testing || saving}
                            className="btn btn-primary flex items-center gap-2"
                        >
                            {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Salvar Configuração
                        </button>
                    </div>
                </form >
            </div >

            <div className="card space-y-4">
                <div><h2 className="text-lg font-semibold text-gray-900">Modelos por categoria</h2><p className="text-sm text-gray-500">Personalize assunto e corpo. Variáveis usam o formato <code>{'{{nomeDaVariavel}}'}</code>.</p></div>
                <div className="grid md:grid-cols-[240px_1fr] gap-4">
                    <div className="space-y-2">{templates.map(template => <button type="button" key={template.category} onClick={() => setSelectedTemplate({...template})} className={`w-full text-left rounded-lg border px-3 py-2 text-sm ${selectedTemplate?.category === template.category ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}>{template.label}</button>)}</div>
                    {selectedTemplate ? <div className="space-y-3">
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedTemplate.isActive} onChange={e=>setSelectedTemplate({...selectedTemplate,isActive:e.target.checked})}/> Usar modelo personalizado</label>
                        <div><label className="label">Assunto</label><input className="input" value={selectedTemplate.subject} onChange={e=>setSelectedTemplate({...selectedTemplate,subject:e.target.value})}/></div>
                        <div><label className="label">Corpo do e-mail (HTML)</label><textarea className="input min-h-64 font-mono" value={selectedTemplate.htmlBody} onChange={e=>setSelectedTemplate({...selectedTemplate,htmlBody:e.target.value})}/></div>
                        <div className="flex justify-end"><button type="button" className="btn btn-primary" onClick={saveTemplate}><Save className="w-4 h-4"/>Salvar modelo</button></div>
                    </div> : <p className="text-sm text-gray-500">Selecione uma categoria para editar.</p>}
                </div>
            </div>
        </div >
    );
}

