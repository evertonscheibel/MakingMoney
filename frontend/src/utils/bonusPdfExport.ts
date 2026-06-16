import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { BonusReportResponse } from '../types';

const QUARTER_LABELS: Record<string, string> = {
    Q1: '1º Trimestre (Jan–Mar)',
    Q2: '2º Trimestre (Abr–Jun)',
    Q3: '3º Trimestre (Jul–Set)',
    Q4: '4º Trimestre (Out–Dez)',
};

const COLORS = {
    PRIMARY: [15, 23, 42] as [number, number, number],      // Slate 900
    ACCENT: [37, 99, 235] as [number, number, number],       // Blue 600
    SUCCESS: [21, 128, 61] as [number, number, number],      // Green 700
    DANGER: [185, 28, 28] as [number, number, number],       // Red 700
    WARNING: [217, 119, 6] as [number, number, number],      // Amber 600
    LIGHT_BG: [248, 250, 252] as [number, number, number],   // Slate 50
    TEXT_DARK: [30, 41, 59] as [number, number, number],     // Slate 800
    TEXT_LIGHT: [100, 116, 139] as [number, number, number], // Slate 500
};

function fmt(v: number): string {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function drawRoundedRect(doc: jsPDF, x: number, y: number, w: number, h: number, r: number, fill: [number, number, number], border?: [number, number, number]) {
    doc.setFillColor(...fill);
    if (border) {
        doc.setDrawColor(...border);
        doc.roundedRect(x, y, w, h, r, r, 'FD');
    } else {
        doc.roundedRect(x, y, w, h, r, r, 'F');
    }
}

function drawIcon(doc: jsPDF, x: number, y: number, type: 'dollar' | 'chart' | 'users' | 'target' | 'check' | 'cross', color: [number, number, number]) {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.5);
    doc.setFillColor(...color);

    if (type === 'dollar') {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('$', x, y + 3, { align: 'center' });
    } else if (type === 'chart') {
        doc.rect(x - 2, y + 1, 1, 2, 'F');
        doc.rect(x, y - 1, 1, 4, 'F');
        doc.rect(x + 2, y - 3, 1, 6, 'F');
    } else if (type === 'users') {
        doc.circle(x, y - 1, 1.5, 'F');
        doc.ellipse(x, y + 2.5, 3, 1.5, 'F');
    } else if (type === 'target') {
        doc.circle(x, y, 3, 'D');
        doc.circle(x, y, 1.5, 'F');
    } else if (type === 'check') {
        doc.setLineWidth(0.8);
        doc.line(x - 2, y, x - 0.5, y + 1.5);
        doc.line(x - 0.5, y + 1.5, x + 2, y - 2);
    } else if (type === 'cross') {
        doc.setLineWidth(0.8);
        doc.line(x - 1.5, y - 1.5, x + 1.5, y + 1.5);
        doc.line(x + 1.5, y - 1.5, x - 1.5, y + 1.5);
    }
}

function addFooter(doc: jsPDF, companyName: string) {
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const pages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.line(14, ph - 15, pw - 14, ph - 15);
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.setFont('helvetica', 'normal');
        doc.text(`${companyName} — Gestão Estratégica de Performance`, 14, ph - 10);
        doc.text(`Página ${i} de ${pages}`, pw - 14, ph - 10, { align: 'right' });
        doc.text(`Documento Gerado em ${new Date().toLocaleString('pt-BR')}`, pw / 2, ph - 10, { align: 'center' });
    }
}

// ── COVER PAGE ──
function drawCover(doc: jsPDF, report: BonusReportResponse, companyName: string) {
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();

    // Background Gradient simulation
    for (let i = 0; i < 50; i++) {
        const r = Math.floor(15 + i * 0.5);
        const g = Math.floor(23 + i * 0.5);
        const b = Math.floor(42 + i * 0.5);
        doc.setFillColor(r, g, b);
        doc.rect(0, (ph * 0.45 / 50) * i, pw, (ph * 0.45 / 50) + 1, 'F');
    }

    // Accent Stripe
    doc.setFillColor(...COLORS.ACCENT);
    doc.rect(0, ph * 0.45, pw, 6, 'F');

    // Content
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('RECURSOS HUMANOS & PERFORMANCE', pw / 2, 40, { align: 'center' });
    
    doc.setFontSize(44);
    doc.text('BONIFICAÇÃO', pw / 2, 70, { align: 'center' });
    doc.setFontSize(36);
    doc.setFont('helvetica', 'normal');
    doc.text('ESTRATÉGICA TRIMESTRAL', pw / 2, 85, { align: 'center' });

    // Period Badge
    const label = QUARTER_LABELS[report.quarter] || report.quarter;
    doc.setFontSize(18);
    doc.setTextColor(147, 197, 253);
    doc.setFont('helvetica', 'bold');
    doc.text(`${label.toUpperCase()} — ${report.year}`, pw / 2, 105, { align: 'center' });

    // Company Logo Placeholder / Name
    doc.setTextColor(255);
    doc.setFontSize(16);
    doc.text(companyName, pw / 2, ph * 0.45 - 20, { align: 'center' });

    // Summary Cards
    const boxY = ph * 0.45 + 35;
    const boxW = (pw - 70) / 4;
    const gap = 12;
    const startX = 14;

    const boxes = [
        { label: 'TOTAL A PAGAR', value: fmt(report.summary.totalBonus), icon: 'dollar', color: COLORS.ACCENT, bg: [240, 246, 255] as [number, number, number] },
        { label: 'MÉDIA GERAL', value: `${report.summary.avgScore.toFixed(1)}%`, icon: 'target', color: COLORS.SUCCESS, bg: [240, 253, 244] as [number, number, number] },
        { label: 'QUALIFICADOS', value: `${report.summary.qualifiedSectors}/${report.summary.totalSectors}`, icon: 'chart', color: [124, 58, 237] as [number, number, number], bg: [245, 243, 255] as [number, number, number] },
        { label: 'EQUIPE', value: `${report.summary.userCount} Membros`, icon: 'users', color: COLORS.WARNING, bg: [255, 251, 235] as [number, number, number] },
    ];

    boxes.forEach((b, i) => {
        const x = startX + i * (boxW + gap);
        // Shadow effect
        doc.setFillColor(226, 232, 240);
        doc.roundedRect(x + 1, boxY + 1, boxW, 45, 4, 4, 'F');
        
        drawRoundedRect(doc, x, boxY, boxW, 45, 4, b.bg, b.color);
        
        // Icon Circle
        doc.setFillColor(255, 255, 255);
        doc.circle(x + boxW / 2, boxY + 12, 6, 'F');
        drawIcon(doc, x + boxW / 2, boxY + 12, b.icon as any, b.color);

        doc.setFontSize(8);
        doc.setTextColor(...b.color);
        doc.setFont('helvetica', 'bold');
        doc.text(b.label, x + boxW / 2, boxY + 24, { align: 'center' });
        
        doc.setFontSize(18);
        doc.setTextColor(...COLORS.TEXT_DARK);
        doc.text(b.value, x + boxW / 2, boxY + 38, { align: 'center' });
    });

    // Methodology Box (Enhanced)
    const methY = ph - 65;
    drawRoundedRect(doc, 14, methY, pw - 28, 40, 4, COLORS.LIGHT_BG, [203, 213, 225]);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.PRIMARY);
    doc.text('POLÍTICA DE BONIFICAÇÃO VIGENTE', 22, methY + 10);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.TEXT_LIGHT);
    const modeLabel = report.calculationMode === 'SECTOR' ? 'Média Global do Setor' : 'Média Individual de Performance';
    const lines = [
        `• Requisito Mínimo: O setor deve atingir uma média trimestral consolidada de pelo menos ${report.sectorMinScore}%.`,
        `• Base de Cálculo: O bônus é calculado sobre 25% do salário anual (Salário Bruto ÷ 4).`,
        `• Distribuição: Aplicado o multiplicador de performance (${modeLabel}) sobre a base trimestral.`,
        `• Bloqueio: Setores abaixo da meta de ${report.sectorMinScore}% têm o pagamento de bônus suspenso integralmente para o período.`
    ];
    lines.forEach((l, i) => doc.text(l, 22, methY + 18 + i * 5));
}

// ── SECTOR OVERVIEW PAGE ──
function drawSectorOverview(doc: jsPDF, report: BonusReportResponse) {
    doc.addPage();
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();

    // Dark Header
    doc.setFillColor(...COLORS.PRIMARY);
    doc.rect(0, 0, pw, 25, 'F');
    doc.setTextColor(255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('VISÃO ESTRATÉGICA POR UNIDADE', 14, 16);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`${QUARTER_LABELS[report.quarter].toUpperCase()} / ${report.year}`, pw - 14, 16, { align: 'right' });

    // Sector Cards
    let y = 35;
    const cardW = (pw - 40) / 2;
    const cardH = 55;

    report.sectors.forEach((s, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 14 + col * (cardW + 12);
        const cy = y + row * (cardH + 10);

        if (cy + cardH > ph - 20) {
            doc.addPage();
            y = 35;
        }

        // Shadow
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(x + 1, cy + 1, cardW, cardH, 4, 4, 'F');

        // Card BG
        const bg: [number, number, number] = s.qualified ? [240, 253, 244] : [254, 242, 242];
        const border: [number, number, number] = s.qualified ? COLORS.SUCCESS : COLORS.DANGER;
        drawRoundedRect(doc, x, cy, cardW, cardH, 4, bg, border);

        // Header Section
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.TEXT_DARK);
        doc.text(s.name, x + 10, cy + 12);

        // Status Badge
        const badgeColor = s.qualified ? COLORS.SUCCESS : COLORS.DANGER;
        doc.setFillColor(...badgeColor);
        doc.roundedRect(x + cardW - 35, cy + 6, 25, 8, 2, 2, 'F');
        doc.setTextColor(255);
        doc.setFontSize(7);
        doc.text(s.qualified ? 'QUALIFICADO' : 'BLOQUEADO', x + cardW - 22.5, cy + 11.5, { align: 'center' });

        // Stats
        const stats = [
            { l: 'MÉDIA', v: `${s.avgScore.toFixed(1)}%`, c: badgeColor },
            { l: 'PROCES.', v: s.processCount, c: COLORS.TEXT_DARK },
            { l: 'EQUIPE', v: s.userCount, c: COLORS.TEXT_DARK },
            { l: 'BÔNUS TOTAL', v: fmt(s.totalBonus), c: COLORS.SUCCESS },
        ];

        stats.forEach((st, si) => {
            const sx = x + 10 + si * (cardW - 20) / 4;
            doc.setFontSize(7);
            doc.setTextColor(...COLORS.TEXT_LIGHT);
            doc.setFont('helvetica', 'normal');
            doc.text(st.l, sx, cy + 25);
            doc.setFontSize(12);
            doc.setTextColor(...st.c);
            doc.setFont('helvetica', 'bold');
            doc.text(String(st.v), sx, cy + 34);
        });

        // Progress Bar
        const barX = x + 10;
        const barY = cy + 42;
        const barW = cardW - 20;
        const barH = 5;
        
        doc.setFillColor(226, 232, 240);
        doc.roundedRect(barX, barY, barW, barH, 2.5, 2.5, 'F');
        
        const fill = Math.min(s.avgScore / 100, 1) * barW;
        doc.setFillColor(...badgeColor);
        doc.roundedRect(barX, barY, fill, barH, 2.5, 2.5, 'F');

        // Threshold Mark (75%)
        const tx = barX + 0.75 * barW;
        doc.setDrawColor(15, 23, 42);
        doc.setLineWidth(0.4);
        doc.line(tx, barY - 2, tx, barY + barH + 2);
        doc.setFontSize(5);
        doc.setTextColor(...COLORS.PRIMARY);
        doc.text('META 75%', tx, barY - 3, { align: 'center' });
    });

    // Performance Chart (Simple Bar)
    const chartY = ph - 70;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.PRIMARY);
    doc.text('COMPARATIVO DE PERFORMANCE POR SETOR (%)', 14, chartY);

    const chartW = pw - 28;
    const chartH = 40;
    const barGap = 10;
    const barW = (chartW - (report.sectors.length - 1) * barGap) / report.sectors.length;

    report.sectors.forEach((s, i) => {
        const x = 14 + i * (barW + barGap);
        const bh = (s.avgScore / 100) * chartH;
        const by = chartY + 10 + (chartH - bh);
        
        const color = s.qualified ? COLORS.SUCCESS : COLORS.DANGER;
        doc.setFillColor(...color);
        doc.roundedRect(x, by, barW, bh, 2, 2, 'F');
        
        doc.setFontSize(6);
        doc.setTextColor(...COLORS.TEXT_DARK);
        doc.text(s.name.substring(0, 12), x + barW / 2, chartY + chartH + 15, { align: 'center', angle: 45 });
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text(`${s.avgScore.toFixed(1)}%`, x + barW / 2, by - 2, { align: 'center' });
    });
}

// ── DETAIL TABLES ──
function drawDetailTables(doc: jsPDF, report: BonusReportResponse) {
    const pw = doc.internal.pageSize.getWidth();

    for (const sector of report.sectors) {
        doc.addPage();

        // Header
        const color = sector.qualified ? COLORS.SUCCESS : COLORS.DANGER;
        doc.setFillColor(...COLORS.PRIMARY);
        doc.rect(0, 0, pw, 25, 'F');
        doc.setTextColor(255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`DETALHAMENTO: ${sector.name.toUpperCase()}`, 14, 16);

        // Status indicator
        doc.setFillColor(...color);
        doc.roundedRect(pw - 55, 7, 41, 10, 2, 2, 'F');
        doc.setFontSize(8);
        doc.text(sector.qualified ? '✓ QUALIFICADO' : '✗ BLOQUEADO', pw - 34.5, 13.5, { align: 'center' });

        // Sector KPIs
        const kpis = [
            { l: 'MÉDIA SETOR', v: `${sector.avgScore.toFixed(1)}%`, c: color },
            { l: 'META', v: `${report.sectorMinScore}%`, c: COLORS.TEXT_LIGHT },
            { l: 'MEMBROS', v: sector.userCount, c: COLORS.PRIMARY },
            { l: 'PROCESSOS', v: sector.processCount, c: COLORS.PRIMARY },
            { l: 'BÔNUS TOTAL', v: fmt(sector.totalBonus), c: color },
        ];

        const kpiW = (pw - 28) / kpis.length;
        kpis.forEach((k, i) => {
            const x = 14 + i * kpiW;
            drawRoundedRect(doc, x + 1, 32, kpiW - 2, 18, 3, COLORS.LIGHT_BG, [226, 232, 240]);
            doc.setFontSize(6);
            doc.setTextColor(...COLORS.TEXT_LIGHT);
            doc.setFont('helvetica', 'normal');
            doc.text(k.l, x + kpiW / 2, 38, { align: 'center' });
            doc.setFontSize(11);
            doc.setTextColor(...k.c);
            doc.setFont('helvetica', 'bold');
            doc.text(String(k.v), x + kpiW / 2, 45, { align: 'center' });
        });

        const sectorUsers = report.users.filter(u => u.sector === sector.name);
        const body = sectorUsers.map((u, idx) => [
            String(idx + 1).padStart(2, '0'),
            u.userName,
            fmt(u.baseSalary),
            fmt(u.quarterBase),
            `${u.avgScore.toFixed(1)}%`,
            u.sectorQualified ? fmt(u.bonusValue) : '—',
        ]);

        const totalBonus = sectorUsers.reduce((s, u) => s + u.bonusValue, 0);
        const avgScore = sectorUsers.length > 0 ? sectorUsers.reduce((s, u) => s + u.avgScore, 0) / sectorUsers.length : 0;
        body.push(['', 'CONSOLIDADO DO SETOR', '', '', `${avgScore.toFixed(1)}%`, fmt(totalBonus)]);

        autoTable(doc, {
            startY: 58,
            head: [['ID', 'COLABORADOR', 'SALÁRIO BRUTO', 'BASE TRIM.', 'PERF. (%)', 'BÔNUS (R$)']],
            body,
            theme: 'grid',
            headStyles: {
                fillColor: COLORS.PRIMARY,
                textColor: [255, 255, 255],
                fontSize: 8,
                fontStyle: 'bold',
                halign: 'center',
                cellPadding: 4,
            },
            bodyStyles: {
                fontSize: 8,
                cellPadding: 3,
                textColor: COLORS.TEXT_DARK,
            },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            columnStyles: {
                0: { halign: 'center', cellWidth: 10 },
                1: { fontStyle: 'bold' },
                2: { halign: 'right' },
                3: { halign: 'right' },
                4: { halign: 'center' },
                5: { halign: 'right', fontStyle: 'bold' },
            },
            didParseCell: (data) => {
                if (data.row.index === body.length - 1) {
                    data.cell.styles.fillColor = [241, 245, 249];
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.textColor = COLORS.PRIMARY;
                    data.cell.styles.fontSize = 9;
                }
                if (!sector.qualified && data.column.index === 5 && data.row.index < body.length - 1) {
                    data.cell.styles.textColor = COLORS.DANGER;
                }
            },
        });
    }
}

// ── MAIN EXPORT FUNCTION ──
export function exportBonusPDF(report: BonusReportResponse, companyName: string) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    drawCover(doc, report, companyName);
    drawSectorOverview(doc, report);
    drawDetailTables(doc, report);
    addFooter(doc, companyName);

    const fileName = `RELATORIO_BONUS_${report.quarter}_${report.year}_${companyName.replace(/\s+/g, '_')}.pdf`;
    doc.save(fileName);
}

