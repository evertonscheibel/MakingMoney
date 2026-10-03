import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Mail, X } from 'lucide-react';
import { reportsApi } from '../api';

export interface ReportEmailContext { title: string; period: string; sector?: string }
interface Props { document: Blob; filename: string; context: ReportEmailContext; onClose: () => void }

export default function ReportEmailDialog({ document: pdf, filename, context, onClose }: Props) {
    const [options, setOptions] = useState<Awaited<ReturnType<typeof reportsApi.getEmailOptions>>>();
    const [recipients, setRecipients] = useState<string[]>([]);
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [queued, setQueued] = useState(0);
    const [queueIds, setQueueIds] = useState<string[]>([]);
    const [delivery, setDelivery] = useState<Awaited<ReturnType<typeof reportsApi.getEmailStatus>>>([]);
    const close = useRef<HTMLButtonElement>(null);
    const requestId = useRef(crypto.randomUUID());
    const interpolate = (value: string, data: Awaited<ReturnType<typeof reportsApi.getEmailOptions>>) => {
        const variables: Record<string, string> = { reportTitle: context.title, period: context.period, companyName: data.companyName, senderName: data.senderName };
        return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => variables[key] ?? match);
    };
    useEffect(() => {
        let active = true;
        const focused = window.document.activeElement as HTMLElement;
        close.current?.focus();
        const overflow = window.document.body.style.overflow;
        window.document.body.style.overflow = 'hidden';
        reportsApi.getEmailOptions().then(data => {
            if (!active) return;
            setOptions(data); setSubject(interpolate(data.template.subject, data));
        }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; window.document.body.style.overflow = overflow; focused?.focus(); };
    }, []);
    useEffect(() => {
        if (!queueIds.length) return;
        let active = true;
        let timer: ReturnType<typeof setTimeout>;
        const refresh = async () => {
            try {
                const items = await reportsApi.getEmailStatus(queueIds);
                if (!active) return;
                setDelivery(items);
                if (items.some(item => !['SENT', 'FAILED'].includes(item.status))) timer = setTimeout(refresh, 3000);
            } catch { if (active) setError('Não foi possível consultar o resultado agora. O envio já está na fila.'); }
        };
        void refresh();
        return () => { active = false; clearTimeout(timer); };
    }, [queueIds]);
    const send = async () => {
        setSending(true); setError('');
        try {
            const form = new FormData();
            form.append('report', pdf, filename); form.append('recipients', JSON.stringify(recipients));
            form.append('subject', subject); form.append('message', message); form.append('title', context.title);
            form.append('period', context.period); form.append('sector', context.sector || '');
            form.append('requestId', requestId.current);
            const result = await reportsApi.sendEmail(form); setQueued(result.queued); setQueueIds(result.ids);
        } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao agendar envio. Tente novamente.'); }
        finally { setSending(false); }
    };
    return createPortal(<div className="fixed inset-0 z-[100] bg-black/60 p-3 sm:p-6 flex items-center justify-center" onKeyDown={e => {
        if (e.key === 'Escape' && !sending) onClose();
        if (e.key === 'Tab') {
            const targets = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)'));
            const first = targets[0], last = targets[targets.length - 1];
            if (e.shiftKey && window.document.activeElement === first) { e.preventDefault(); last.focus(); }
            if (!e.shiftKey && window.document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
    }}><section role="dialog" aria-modal="true" aria-labelledby="report-email-title" className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-xl">
        <div className="flex justify-between items-center gap-3"><h2 id="report-email-title" className="text-lg font-semibold">Enviar relatório por e-mail</h2><button ref={close} className="btn-secondary" aria-label="Fechar envio de relatório" disabled={sending} onClick={onClose}><X className="w-5 h-5" /></button></div>
        <p className="text-sm text-gray-500">{context.title} • {context.period}<br />Anexo: {filename} ({Math.ceil(pdf.size / 1024)} KB)</p>
        {loading && <p role="status">Carregando destinatários e mensagem padrão...</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {queued > 0 ? <div role="status" className="rounded-lg bg-green-50 text-green-800 p-4 space-y-2"><p>Relatório colocado na fila para {queued} destinatário(s).</p>
            <p className="text-xs">O resultado é atualizado enquanto esta janela estiver aberta. “Aceito pelo servidor SMTP” confirma a transmissão, sem comprovar leitura ou chegada à caixa de entrada.</p>
            {delivery.map(item => <p key={item.id} className="text-sm break-all"><strong>{item.to}</strong>: {{ PENDING: 'Aguardando envio', SENDING: 'Enviando', SENT: 'Aceito pelo servidor SMTP', FAILED: 'Falha no envio; verifique a configuração SMTP', RETRY_SCHEDULED: 'Falha temporária; nova tentativa agendada' }[item.status] || item.status}</p>)}
        </div> : options && <>
            {!options.configured && <p role="alert" className="text-sm text-amber-700">O servidor de e-mail desta empresa precisa ser configurado em Configurações de e-mail antes do envio.</p>}
            <fieldset disabled={sending || !options.configured} className="space-y-4">
                <div><legend className="label">Destinatários cadastrados ({recipients.length}/10)</legend><div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 p-2 space-y-1">
                    {options.recipients.map(person => <label key={person.email} className="flex items-start gap-2 p-2 text-sm cursor-pointer"><input type="checkbox" aria-label={`${person.name} — ${person.email}`} checked={recipients.includes(person.email)} disabled={!recipients.includes(person.email) && recipients.length >= 10} onChange={e => setRecipients(values => e.target.checked ? [...values, person.email] : values.filter(v => v !== person.email))} className="mt-1" /><span>{person.name}<span className="block text-xs text-gray-500 break-all">{person.email}</span></span></label>)}
                    {!options.recipients.length && <p className="text-sm text-gray-500">Nenhum destinatário cadastrado disponível nesta empresa.</p>}
                </div></div>
                <label className="block"><span className="label">Assunto do envio</span><input className="input" value={subject} maxLength={200} onChange={e => setSubject(e.target.value)} /></label>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3"><p className="text-xs font-semibold text-gray-500 mb-2">Mensagem padrão da empresa</p><p className="text-sm whitespace-pre-line">{interpolate(options.template.htmlBody.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]*>/g, ''), options)}</p></div>
                <label className="block"><span className="label">Mensagem do gestor (opcional)</span><textarea className="input min-h-28" value={message} maxLength={4000} onChange={e => setMessage(e.target.value)} placeholder="Escreva uma orientação ou comentário para este envio..." /><span className="text-xs text-gray-500">Esta mensagem será acrescentada ao texto padrão, sem alterar o modelo da empresa.</span></label>
            </fieldset>
        </>}
        <div className="flex justify-end gap-2"><button className="btn-secondary" disabled={sending} onClick={onClose}>{queued ? 'Concluir' : 'Cancelar'}</button>{!queued && <button className="btn-primary flex items-center gap-2" disabled={loading || sending || !options?.configured || !recipients.length || !subject.trim() || pdf.size > 5 * 1024 * 1024} onClick={send}><Mail className="w-4 h-4" />{sending ? 'Agendando...' : 'Enviar relatório'}</button>}</div>
        {pdf.size > 5 * 1024 * 1024 && <p role="alert" className="text-sm text-red-700">O relatório excede o limite de 5 MB. Reduza os filtros para enviar.</p>}
    </section></div>, window.document.body);
}
