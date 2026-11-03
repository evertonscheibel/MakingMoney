import { useEffect, useState } from 'react';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export default function PdfReportPreview({ blob, onReady, onError }: { blob: Blob; onReady: (pages: string[]) => void; onError: (message: string) => void }) {
    const [pages, setPages] = useState<string[]>([]);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        setPages([]);
        setFailed(false);
        let active = true;
        let dispose: (() => void) | undefined;
        (async () => {
            const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
            // Refresh clients that cached the worker with the previous MIME type.
            GlobalWorkerOptions.workerSrc = `${workerUrl}?v=module-20261003`;
            const task = getDocument({ data: new Uint8Array(await blob.arrayBuffer()), useSystemFonts: true });
            dispose = () => { void task.destroy(); };
            const pdf = await task.promise;
            const rendered: string[] = [];
            for (let i = 1; i <= pdf.numPages && active; i++) {
                const page = await pdf.getPage(i);
                // 216 DPI for the A4 print document; no dashboard capture.
                const viewport = page.getViewport({ scale: 3 });
                const canvas = document.createElement('canvas');
                canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
                const context = canvas.getContext('2d');
                if (!context) throw new Error('Canvas indisponível');
                await page.render({ canvasContext: context, viewport }).promise;
                if (!active) return;
                rendered.push(canvas.toDataURL('image/png'));
                setPages([...rendered]);
                page.cleanup();
            }
            if (active) onReady(rendered);
        })().catch(() => { if (active) { setFailed(true); onError('Não foi possível abrir a prévia. Baixe o PDF para visualizar ou imprimir.'); } });
        return () => { active = false; dispose?.(); };
    }, [blob, onReady, onError]);
    return <div className="flex-1 overflow-auto bg-gray-200 dark:bg-gray-800 p-3 sm:p-6 space-y-5" aria-label="Páginas do relatório">
        {!pages.length && !failed && <p role="status" className="text-center text-gray-600 py-8">Preparando páginas do documento...</p>}
        {pages.map((src, i) => <figure key={i} className="max-w-5xl mx-auto"><img src={src} alt={`Página ${i + 1} do relatório`} className="w-full h-auto bg-white shadow-lg" /><figcaption className="text-center text-xs text-gray-600 dark:text-gray-300 mt-2">Página {i + 1}</figcaption></figure>)}
    </div>;
}
