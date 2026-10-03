import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { jsPDF } from 'jspdf';
import { Eye, FileDown, Mail, Printer, X } from 'lucide-react';
import { useAuth } from '../contexts';
import { UserRole } from '../types';
import ReportEmailDialog, { type ReportEmailContext } from './ReportEmailDialog';
import PdfReportPreview from './PdfReportPreview';

interface Props { build: () => jsPDF; filename: string; disabled?: boolean; emailContext: ReportEmailContext }

export default function ReportActions({ build, filename, disabled, emailContext }: Props) {
    const { user } = useAuth();
    const [emailDocument, setEmailDocument] = useState<Blob | null>(null);
    const canSend = user?.roles.some(role => [UserRole.MASTER, UserRole.MANAGER].includes(role));
    const [preview, setPreview] = useState<{ blob: Blob; doc: jsPDF; filename: string } | null>(null);
    const [error, setError] = useState('');
    const [printPages, setPrintPages] = useState<string[]>([]);
    const frame = useRef<HTMLIFrameElement>(null);
    const closeButton = useRef<HTMLButtonElement>(null);
    const opener = useRef<HTMLButtonElement>(null);
    useEffect(() => { setPreview(null); setEmailDocument(null); }, [user?.activeCompanyId]);
    useEffect(() => {
        if (!preview) return;
        closeButton.current?.focus();
        const before = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = before; frame.current?.remove(); opener.current?.focus(); };
    }, [preview]);
    const generate = (view: boolean) => {
        setError('');
        try {
            const doc = build();
            if (view) { setPrintPages([]); setPreview({ doc, filename, blob: doc.output('blob') }); }
            else doc.save(filename);
        } catch (e) {
            console.error('Falha ao gerar relatório', e);
            setError('Não foi possível gerar o relatório. Recarregue os dados e tente novamente.');
        }
    };
    return <>
        <div className="flex flex-wrap items-center gap-2">
            <button className="btn-primary flex items-center gap-2" disabled={disabled} onClick={() => generate(false)}><FileDown className="w-4 h-4" />Exportar PDF</button>
            <button ref={opener} className="btn-secondary flex items-center gap-2" disabled={disabled} onClick={() => generate(true)}><Eye className="w-4 h-4" />Visualizar / Imprimir</button>
            {canSend && <button className="btn-secondary flex items-center gap-2" disabled={disabled} onClick={() => {
                setError(''); try { setEmailDocument(build().output('blob')); } catch { setError('Não foi possível gerar o PDF para envio.'); }
            }}><Mail className="w-4 h-4" />Enviar por e-mail</button>}
            {error && <p role="alert" className="text-sm text-red-700 w-full">{error}</p>}
        </div>
        {emailDocument && <ReportEmailDialog document={emailDocument} filename={filename} context={emailContext} onClose={() => setEmailDocument(null)} />}
        {preview && createPortal(<div className="fixed inset-0 z-[100] bg-black/60 p-2 sm:p-6 flex items-center justify-center" onKeyDown={e => {
            if (e.key === 'Escape') setPreview(null);
            if (e.key === 'Tab') {
                const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
                const first = buttons[0], last = buttons[buttons.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        }}>
            <section role="dialog" aria-modal="true" aria-labelledby="report-preview-title" className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-7xl h-[94vh] flex flex-col shadow-xl overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
                    <div><h2 id="report-preview-title" className="font-semibold text-gray-900 dark:text-white">Documento para impressão</h2><p className="text-xs text-gray-500">A4 horizontal • Cabeçalho e rodapé em todas as páginas</p></div>
                    <div className="flex flex-wrap gap-2">
                        <button className="btn-primary flex items-center gap-2" disabled={!printPages.length} onClick={() => {
                            const iframe = document.createElement('iframe'); frame.current?.remove(); frame.current = iframe;
                            iframe.title = 'Documento de impressão'; iframe.style.cssText = 'position:fixed;width:0;height:0;border:0';
                            iframe.onload = () => {
                                const printWindow = iframe.contentWindow;
                                if (!printWindow) return;
                                Promise.all(Array.from(printWindow.document.images).map(img => img.decode())).then(() => {
                                    printWindow.onafterprint = () => iframe.remove(); printWindow.focus(); printWindow.print();
                                }).catch(() => setError('Baixe o PDF para imprimir. Não foi possível preparar a impressão.'));
                            };
                            iframe.srcdoc = `<!doctype html><html><head><title>Relatório Chronos</title><style>@page{size:A4 landscape;margin:0}body{margin:0}img{display:block;width:297mm;height:210mm;break-after:page}img:last-child{break-after:auto}</style></head><body>${printPages.map(src => `<img src="${src}" alt="Página do relatório">`).join('')}</body></html>`;
                            document.body.appendChild(iframe);
                        }}><Printer className="w-4 h-4" />Imprimir documento</button>
                        <button className="btn-secondary" onClick={() => preview.doc.save(preview.filename)}>Baixar PDF</button>
                        <button ref={closeButton} className="btn-secondary" aria-label="Fechar visualização do relatório" onClick={() => setPreview(null)}><X className="w-5 h-5" /></button>
                    </div>
                </div>
                {error && <p role="alert" className="px-4 py-2 text-sm text-red-700">{error}</p>}
                <PdfReportPreview blob={preview.blob} onReady={setPrintPages} onError={setError} />
            </section>
        </div>, document.body)}
    </>;
}
