import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ReportMetadata {
    title: string;
    companyName: string;
    period: string;
    scope?: string;
    filters?: string;
    issuedBy?: string;
    generatedAt?: Date;
}

export const REPORT_COLORS = {
    ink: [35, 45, 43] as [number, number, number],
    green: [22, 101, 52] as [number, number, number],
    muted: [91, 105, 99] as [number, number, number],
    border: [215, 224, 219] as [number, number, number],
    pale: [245, 248, 246] as [number, number, number],
};

export function reportPeriod(value: string) {
    if (!/^\d{4}-\d{2}$/.test(value)) return value || 'Ciclos abertos';
    return new Date(`${value}-01T12:00:00Z`).toLocaleDateString('pt-BR', {
        month: 'long', year: 'numeric', timeZone: 'UTC',
    });
}

export function reportFilename(kind: string, period: string) {
    return `chronos_${kind}_${period.replace(/[^\w-]/g, '_')}.pdf`;
}
export const formatReportNumber = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** A single, vector document layout, independent of the dashboard DOM. */
export function createReportDocument(meta: ReportMetadata) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const margin = 14;
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    const usable = width - margin * 2;
    const generatedAt = meta.generatedAt || new Date();
    const stamp = generatedAt.toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' });
    doc.setProperties({ title: meta.title, subject: `${meta.companyName} - ${meta.period}`, author: meta.issuedBy || 'Método Chronos', creator: 'Método Chronos' });
    doc.setFontSize(10);
    const companyLines = doc.splitTextToSize(meta.companyName, usable) as string[];
    doc.setFontSize(8);
    const details = [
        { label: 'PERÍODO', value: meta.period },
        { label: 'ABRANGÊNCIA', value: meta.scope || 'Setores autorizados' },
        { label: 'FILTROS', value: meta.filters || 'Sem filtros adicionais' },
    ].map(d => ({ ...d, lines: doc.splitTextToSize(d.value, usable / 3 - 8) as string[] }));
    const detailsY = 32 + companyLines.length * 4;
    const top = detailsY + 7 + Math.max(...details.map(d => d.lines.length)) * 3.8 + 6;
    const bottom = height - 22;
    let y = top;
    let sectionTitle = '';

    const header = () => {
        doc.setFillColor(...REPORT_COLORS.green);
        doc.rect(margin, 10, 2, 18, 'F');
        doc.setTextColor(...REPORT_COLORS.green);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('MÉTODO CHRONOS  /  RELATÓRIOS DE GESTÃO', margin + 6, 14);
        doc.setTextColor(...REPORT_COLORS.ink);
        doc.setFontSize(17);
        doc.text(meta.title, margin + 6, 24);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(companyLines, margin, 32);
        details.forEach((d, i) => {
            const x = margin + i * usable / 3;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(...REPORT_COLORS.muted);
            doc.text(d.label, x, detailsY + 3);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...REPORT_COLORS.ink);
            doc.text(d.lines, x, detailsY + 8);
        });
        doc.setDrawColor(...REPORT_COLORS.border);
        doc.setLineWidth(0.25);
        doc.line(margin, top - 3, width - margin, top - 3);
    };
    const newPage = () => { doc.addPage(); y = top; };
    const ensure = (space: number) => { if (y + space > bottom) newPage(); };
    const text = (content: string) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        const lines = doc.splitTextToSize(content, usable) as string[];
        for (const line of lines) {
            ensure(5);
            doc.setTextColor(...REPORT_COLORS.muted);
            doc.text(line, margin, y + 3);
            y += 4.2;
        }
        y += 4;
    };
    const heading = (title: string, detail?: string) => {
        sectionTitle = title;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        const lines = doc.splitTextToSize(title, usable) as string[];
        ensure(lines.length * 5 + 24);
        doc.setTextColor(...REPORT_COLORS.ink);
        doc.text(lines, margin, y + 5);
        y += lines.length * 5 + 5;
        if (detail) text(detail);
    };
    const metrics = (items: { label: string; value: string }[]) => {
        ensure(25);
        const w = usable / items.length;
        items.forEach((item, i) => {
            const x = margin + i * w;
            doc.setFillColor(...REPORT_COLORS.pale);
            doc.rect(x, y, w - 3, 22, 'F');
            doc.setTextColor(...REPORT_COLORS.muted);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.text(item.label, x + 4, y + 6);
            doc.setTextColor(...REPORT_COLORS.green);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(15);
            const valueWidth = doc.getTextWidth(item.value);
            if (valueWidth > w - 8) doc.setFontSize(15 * (w - 8) / valueWidth);
            doc.text(item.value, x + 4, y + 16);
        });
        y += 29;
    };
    const table = (head: string[], rows: (string | number)[][], options?: { widths?: Record<number, number>; right?: number[]; total?: string[] }) => {
        if (!rows.length) { text('Nenhum registro encontrado para os filtros informados.'); return; }
        ensure(22);
        const columnStyles: Record<number, { cellWidth?: number; halign?: 'right' }> = {};
        Object.entries(options?.widths || {}).forEach(([index, cellWidth]) => { columnStyles[Number(index)] = { cellWidth }; });
        options?.right?.forEach(index => { columnStyles[index] = { ...columnStyles[index], halign: 'right' }; });
        const firstPage = doc.getCurrentPageInfo().pageNumber;
        doc.setFontSize(9);
        const continuation = doc.splitTextToSize(`${sectionTitle} (continuação)`, usable) as string[];
        autoTable(doc, {
            startY: y,
            head: [head], body: rows,
            foot: options?.total ? [options.total] : undefined,
            showFoot: 'lastPage', showHead: 'everyPage', rowPageBreak: 'avoid',
            theme: 'plain',
            margin: { top: top + continuation.length * 4 + 4, bottom: height - bottom, left: margin, right: margin },
            didDrawPage: () => {
                if (doc.getCurrentPageInfo().pageNumber > firstPage) {
                    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...REPORT_COLORS.ink);
                    doc.text(continuation, margin, top + 3);
                }
            },
            styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.5, overflow: 'linebreak', textColor: REPORT_COLORS.ink, lineWidth: { bottom: 0.15 }, lineColor: REPORT_COLORS.border },
            headStyles: { fillColor: REPORT_COLORS.green, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
            footStyles: { fillColor: REPORT_COLORS.pale, fontStyle: 'bold', textColor: REPORT_COLORS.ink },
            alternateRowStyles: { fillColor: REPORT_COLORS.pale }, columnStyles,
        });
        y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    };
    const lineChart = (series: { day: number; planned: number; realized: number }[]) => {
        ensure(71);
        const x = margin + 10, chartY = y + 3, w = usable - 14, h = 44;
        const max = Math.max(4, Math.ceil(Math.max(0, ...series.flatMap(p => [p.planned, p.realized])) / 4) * 4);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
        for (let i = 0; i <= 4; i++) {
            const cy = chartY + h - h * i / 4;
            doc.setDrawColor(...REPORT_COLORS.border); doc.setLineWidth(0.2); doc.line(x, cy, x + w, cy);
            doc.setTextColor(...REPORT_COLORS.muted); doc.text(String(Math.round(max * i / 4)), x - 3, cy + 1, { align: 'right' });
        }
        const coordinateX = (i: number) => x + (series.length <= 1 ? w / 2 : i * w / (series.length - 1));
        for (const [key, color] of [['planned', REPORT_COLORS.muted], ['realized', REPORT_COLORS.green]] as const) {
            doc.setDrawColor(...color); doc.setFillColor(...color); doc.setLineWidth(0.7);
            doc.setLineDashPattern(key === 'planned' ? [2, 1] : [], 0);
            series.forEach((point, i) => {
                const cy = chartY + h - point[key] / max * h;
                doc.circle(coordinateX(i), cy, 0.6, 'F');
                if (i) doc.line(coordinateX(i - 1), chartY + h - series[i - 1][key] / max * h, coordinateX(i), cy);
            });
        }
        doc.setLineDashPattern([], 0);
        series.forEach((point, i) => { if (i === 0 || i === series.length - 1 || point.day % 5 === 0) { doc.setTextColor(...REPORT_COLORS.muted); doc.text(String(point.day), coordinateX(i), chartY + h + 5, { align: 'center' }); } });
        doc.setTextColor(...REPORT_COLORS.muted); doc.text('Planejado (tracejado)  /  Realizado (contínuo) - acumulado por dia do mês', x, chartY + h + 12);
        y += 68;
    };
    const finish = () => {
        const pages = doc.getNumberOfPages();
        for (let page = 1; page <= pages; page++) {
            doc.setPage(page); header();
            doc.setDrawColor(...REPORT_COLORS.border); doc.line(margin, height - 17, width - margin, height - 17);
            doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...REPORT_COLORS.muted);
            const author = doc.splitTextToSize(`Emitido por: ${meta.issuedBy || 'Usuário autorizado'} | Uso interno`, usable - 45) as string[];
            doc.text(author.slice(0, 1), margin, height - 12);
            doc.text(`Emissão: ${stamp} (Cuiabá) | Fonte: Método Chronos`, margin, height - 8);
            doc.setFont('helvetica', 'bold'); doc.text(`Página ${page} de ${pages}`, width - margin, height - 10, { align: 'right' });
        }
        return doc;
    };
    return { doc, heading, metrics, text, table, lineChart, finish, newPage };
}
