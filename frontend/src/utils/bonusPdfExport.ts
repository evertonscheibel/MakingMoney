import type { BonusReportResponse } from '../types';
import { createReportDocument, formatReportNumber } from './reportDocument';

const currency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const quarters: Record<string, string> = { Q1: '1º trimestre (jan-mar)', Q2: '2º trimestre (abr-jun)', Q3: '3º trimestre (jul-set)', Q4: '4º trimestre (out-dez)' };
export interface BonusDocumentOptions { issuedBy?: string; generatedAt?: Date; search?: string; qualification?: 'all' | 'qualified' | 'blocked'; sector?: string }

export function buildBonusPDF(data: BonusReportResponse, companyName: string, options: BonusDocumentOptions = {}) {
    const qualification = options.qualification || 'all';
    const users = data.users.filter(u => (!options.search || u.userName.toLocaleLowerCase('pt-BR').includes(options.search.toLocaleLowerCase('pt-BR')))
        && (!options.sector || u.sector === options.sector)
        && (qualification === 'all' || u.sectorQualified === (qualification === 'qualified')));
    const sectors = data.sectors.filter(s => (!options.sector || s.name === options.sector)
        && (qualification === 'all' || s.qualified === (qualification === 'qualified'))
        && (!options.search || users.some(u => u.sector === s.name)));
    const mode = data.calculationMode === 'SECTOR' ? 'Média do setor' : 'Média individual';
    const report = createReportDocument({ title: 'Relatório de bonificações', companyName,
        period: `${quarters[data.quarter] || data.quarter} / ${data.year}`,
        scope: options.sector || 'Todos os setores autorizados',
        filters: `${mode} | Situação: ${qualification === 'all' ? 'Todas' : qualification === 'qualified' ? 'Qualificados' : 'Bloqueados'}${options.search ? ` | Nome: ${options.search}` : ''}`,
        issuedBy: options.issuedBy, generatedAt: options.generatedAt,
    });
    const filtered = !!options.search || qualification !== 'all' || !!options.sector;
    report.heading('01  Resumo da bonificação', filtered ? 'Totais referentes ao recorte indicado no cabeçalho.' : 'Consolidado dos dados autorizados para o trimestre.');
    report.metrics([
        { label: 'BÔNUS CALCULADO', value: currency(users.reduce((sum, u) => sum + u.bonusValue, 0)) },
        { label: 'COLABORADORES', value: String(users.length) },
        { label: 'SETORES NO RELATÓRIO', value: String(sectors.length) },
        { label: 'META DO SETOR', value: `${formatReportNumber(data.sectorMinScore)}%` },
    ]);
    report.heading('02  Critérios de cálculo');
    report.text(`Modo: ${mode}. Base trimestral: salário bruto dividido por 4. Bônus: base trimestral multiplicada pela pontuação aplicável dividida por 100. A liberação depende da média do setor atingir ${data.sectorMinScore}% no trimestre. Valores e elegibilidade são os retornados pelo sistema; este documento não confirma pagamento.`);
    report.heading('03  Visão por setor');
    report.table(['Setor', 'Média do setor', 'Processos', 'Situação', 'Colaboradores no recorte', 'Bônus no recorte'], sectors.map(s => {
        const members = users.filter(u => u.sector === s.name);
        return [s.name, `${formatReportNumber(s.avgScore)}%`, s.processCount, s.qualified ? 'Qualificado' : 'Bloqueado', members.length, currency(members.reduce((sum, u) => sum + u.bonusValue, 0))];
    }), { right: [1, 2, 4, 5] });
    sectors.forEach((s, i) => {
        const members = users.filter(u => u.sector === s.name).sort((a, b) => a.userName.localeCompare(b.userName, 'pt-BR'));
        report.heading(`04.${i + 1}  Colaboradores - ${s.name}`, `Média do setor: ${formatReportNumber(s.avgScore)}% | ${s.qualified ? 'Qualificado' : 'Bloqueado'} | Meta: ${data.sectorMinScore}%`);
        report.table(['Colaborador', 'Salário bruto', 'Base trimestral', 'Pont. individual', 'Pont. aplicada', 'Situação', 'Bônus calculado'], members.map(u => [
            u.userName, currency(u.baseSalary), currency(u.quarterBase), `${formatReportNumber(u.avgScore)}%`,
            `${formatReportNumber((data.calculationMode === 'SECTOR' ? u.sectorAvgScore : u.avgScore))}%`,
            u.sectorQualified ? 'Qualificado' : 'Bloqueado', currency(u.bonusValue),
        ]), { right: [1, 2, 3, 4, 6], widths: { 1: 30, 2: 30, 3: 27, 4: 27, 5: 25, 6: 34 },
            total: ['Total do recorte', '', '', '', '', '', currency(members.reduce((sum, u) => sum + u.bonusValue, 0))] });
    });
    return report.finish();
}
