import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportData {
    companyName: string;
    cycle: string;
    sector?: string;
    status?: string;
    summary: {
        kpis: {
            avgScore: number;
            onTimePct: number;
            lateCount: number;
            criticalCount: number;
        };
    };
    extract: {
        bySector: Record<string, any[]>;
    };
}

const COLORS = {
    PRIMARY: [15, 23, 42] as [number, number, number],      // Slate 900
    ACCENT: [37, 99, 235] as [number, number, number],       // Blue 600
    SUCCESS: [21, 128, 61] as [number, number, number],      // Green 700
    DANGER: [185, 28, 28] as [number, number, number],       // Red 700
    WARNING: [217, 119, 6] as [number, number, number],      // Amber 600
    LIGHT_BG: [248, 250, 252] as [number, number, number],   // Slate 50
    BORDER: [226, 232, 240] as [number, number, number],    // Slate 200
    TEXT_LIGHT: [100, 116, 139] as [number, number, number], // Slate 500
};

export function exportDetailedReportPDF(data: ReportData) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();

    // ── COVER PAGE ──
    const drawCover = () => {
        // Background Accent
        doc.setFillColor(...COLORS.PRIMARY);
        doc.rect(0, 0, pw, ph * 0.4, 'F');
        
        doc.setFillColor(...COLORS.ACCENT);
        doc.rect(0, ph * 0.4, pw, 5, 'F');

        doc.setTextColor(255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(32);
        doc.text('RELATÓRIO OPERACIONAL', pw / 2, ph * 0.2, { align: 'center' });
        
        doc.setFontSize(16);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(147, 197, 253);
        doc.text(`GESTÃO DE PERFORMANCE — ${data.companyName.toUpperCase()}`, pw / 2, ph * 0.28, { align: 'center' });

        // Summary Boxes on Cover
        const boxY = ph * 0.55;
        const boxes = [
            { label: 'CICLO DE ANÁLISE', value: data.cycle },
            { label: 'SETOR ABRANGIDO', value: data.sector || 'CONSOLIDADO' },
            { label: 'STATUS FILTRADO', value: data.status || 'GERAL' },
            { label: 'DATA DE EMISSÃO', value: new Date().toLocaleDateString('pt-BR') },
        ];

        const w = (pw - 40) / 4;
        boxes.forEach((b, i) => {
            const x = 20 + i * w;
            doc.setDrawColor(...COLORS.BORDER);
            doc.line(x, boxY, x, boxY + 20);
            
            doc.setFontSize(8);
            doc.setTextColor(...COLORS.TEXT_LIGHT);
            doc.setFont('helvetica', 'bold');
            doc.text(b.label, x + 5, boxY + 6);
            
            doc.setFontSize(11);
            doc.setTextColor(...COLORS.PRIMARY);
            doc.setFont('helvetica', 'bold');
            doc.text(String(b.value), x + 5, boxY + 15);
        });

        // Executive Summary Mini-Table
        const sumY = ph * 0.75;
        doc.setFillColor(...COLORS.LIGHT_BG);
        doc.roundedRect(20, sumY, pw - 40, 35, 3, 3, 'F');
        
        doc.setFontSize(12);
        doc.setTextColor(...COLORS.PRIMARY);
        doc.text('RESUMO EXECUTIVO DO PERÍODO', 25, sumY + 12);
        
        const kpis = [
            { l: 'Média de Performance', v: `${data.summary.kpis.avgScore.toFixed(1)} Pts` },
            { l: 'Eficiência (No Prazo)', v: `${data.summary.kpis.onTimePct}%` },
            { l: 'Processos Críticos', v: String(data.summary.kpis.criticalCount) },
            { l: 'Processos Atrasados', v: String(data.summary.kpis.lateCount) },
        ];

        kpis.forEach((k, i) => {
            const kx = 25 + i * (pw - 60) / 4;
            doc.setFontSize(8);
            doc.setTextColor(...COLORS.TEXT_LIGHT);
            doc.text(k.l, kx, sumY + 22);
            doc.setFontSize(10);
            doc.setTextColor(...COLORS.PRIMARY);
            doc.text(k.v, kx, sumY + 28);
        });
    };

    // ── INTERNAL HEADER ──
    const drawHeader = () => {
        doc.setFillColor(...COLORS.PRIMARY);
        doc.rect(0, 0, pw, 22, 'F');
        
        doc.setTextColor(255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('RELATÓRIO OPERACIONAL DETALHADO', 14, 14);
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(`${data.companyName.toUpperCase()} — Ciclo: ${data.cycle}`, pw - 14, 14, { align: 'right' });
    };

    // ── EXECUTION ──
    drawCover();
    
    const sectors = Object.entries(data.extract.bySector);
    sectors.forEach(([sectorName, processes]) => {
        doc.addPage();
        drawHeader();
        
        let currentY = 32;

        // Sector KPI Mini-box
        doc.setFillColor(...COLORS.LIGHT_BG);
        doc.setDrawColor(...COLORS.BORDER);
        doc.roundedRect(14, currentY, pw - 28, 12, 2, 2, 'FD');
        doc.setTextColor(...COLORS.PRIMARY);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`SETOR: ${sectorName.toUpperCase()}`, 20, currentY + 8);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`TOTAL DE PROCESSOS: ${processes.length}`, pw - 20, currentY + 8, { align: 'right' });
        
        currentY += 18;

        autoTable(doc, {
            startY: currentY,
            head: [['CÓDIGO', 'TÍTULO DO PROCESSO', 'PLANEJADO', 'LIMITE', 'RESPONSÁVEL', 'ENTREGA', 'PONT.']],
            body: processes.map(p => [
                p.code,
                p.title,
                new Date(p.plannedDate).toLocaleDateString('pt-BR'),
                new Date(p.limitDate).toLocaleDateString('pt-BR'),
                typeof p.responsibleUserId === 'object' ? p.responsibleUserId.name : '-',
                p.deliveryDate ? new Date(p.deliveryDate).toLocaleDateString('pt-BR') : '-',
                p.score !== null ? p.score : '-'
            ]),
            theme: 'striped',
            headStyles: { 
                fillColor: COLORS.PRIMARY, 
                fontSize: 8, 
                fontStyle: 'bold',
                halign: 'center',
                cellPadding: 3
            },
            bodyStyles: { fontSize: 7, textColor: [50, 50, 50], cellPadding: 2.5 },
            columnStyles: {
                0: { halign: 'center', cellWidth: 20 },
                1: { cellWidth: 'auto' },
                2: { halign: 'center', cellWidth: 25 },
                3: { halign: 'center', cellWidth: 25 },
                4: { cellWidth: 35 },
                5: { halign: 'center', cellWidth: 25 },
                6: { halign: 'center', cellWidth: 15, fontStyle: 'bold' }
            },
            margin: { left: 14, right: 14, bottom: 20 },
            alternateRowStyles: { fillColor: [249, 250, 251] }
        });
    });

    // ── FOOTER ──
    const pages = (doc as any).internal.getNumberOfPages();
    for (let i = 2; i <= pages; i++) { // Skip cover for footer
        doc.setPage(i);
        doc.setDrawColor(...COLORS.BORDER);
        doc.setLineWidth(0.2);
        doc.line(14, ph - 15, pw - 14, ph - 15);
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`${data.companyName} — Gestão de Performance Operacional`, 14, ph - 10);
        doc.text(`Página ${i - 1} de ${pages - 1}`, pw - 14, ph - 10, { align: 'right' });
    }

    const fileName = `RELATORIO_OPERACIONAL_${data.cycle}_${new Date().getTime()}.pdf`;
    doc.save(fileName);
}
