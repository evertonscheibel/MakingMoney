import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { bonusApi, companiesApi } from '../api';
import { useAuth } from '../contexts';
import {
    FileDown, Award, CheckCircle2, XCircle, TrendingUp,
    Users, Search, Filter, BarChart3, DollarSign, Target,
    Calculator
} from 'lucide-react';
import { BonusCalculationMode } from '../types';
import type { BonusReportUser, BonusSectorSummary } from '../types';
import { exportBonusPDF } from '../utils/bonusPdfExport';

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
const QUARTER_LABELS: Record<string, string> = {
    Q1: '1º Trimestre (Jan–Mar)',
    Q2: '2º Trimestre (Abr–Jun)',
    Q3: '3º Trimestre (Jul–Set)',
    Q4: '4º Trimestre (Out–Dez)',
};

function getCurrentQuarter(): string {
    const m = new Date().getMonth() + 1;
    if (m <= 3) return 'Q1';
    if (m <= 6) return 'Q2';
    if (m <= 9) return 'Q3';
    return 'Q4';
}

function fmt(v: number): string {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function scoreColor(score: number, qualified: boolean): string {
    if (!qualified) return 'text-red-600 dark:text-red-400';
    if (score >= 90) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 80) return 'text-blue-600 dark:text-blue-400';
    return 'text-yellow-600 dark:text-yellow-400';
}

type ViewMode = 'overview' | 'detail';
type StatusFilter = 'all' | 'qualified' | 'blocked';

export default function BonusReport() {
    const { user } = useAuth();
    const [selectedQuarter, setSelectedQuarter] = useState(getCurrentQuarter());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedSector, setSelectedSector] = useState('');
    const [selectedMode, setSelectedMode] = useState<BonusCalculationMode>(BonusCalculationMode.INDIVIDUAL);
    const [searchName, setSearchName] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [viewMode, setViewMode] = useState<ViewMode>('overview');
    const [isExporting, setIsExporting] = useState(false);

    const { data: company } = useQuery({
        queryKey: ['company', user?.activeCompanyId],
        queryFn: () => companiesApi.get(user!.activeCompanyId!),
        enabled: !!user?.activeCompanyId,
    });

    const { data: report, isLoading } = useQuery({
        queryKey: ['bonus-report', selectedQuarter, selectedYear, selectedSector, selectedMode],
        queryFn: () => bonusApi.getReport({
            quarter: selectedQuarter,
            year: selectedYear,
            sector: selectedSector || undefined,
            calculationMode: selectedMode,
        }),
        enabled: !!user?.activeCompanyId,
    });

    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1];

    // Client-side filters
    const filteredUsers = useMemo(() => {
        if (!report) return [];
        let users = report.users;
        if (searchName) {
            const q = searchName.toLowerCase();
            users = users.filter(u => u.userName.toLowerCase().includes(q));
        }
        if (statusFilter === 'qualified') users = users.filter(u => u.sectorQualified);
        if (statusFilter === 'blocked') users = users.filter(u => !u.sectorQualified);
        return users;
    }, [report, searchName, statusFilter]);

    const filteredSectors = useMemo(() => {
        if (!report) return [];
        if (statusFilter === 'qualified') return report.sectors.filter(s => s.qualified);
        if (statusFilter === 'blocked') return report.sectors.filter(s => !s.qualified);
        return report.sectors;
    }, [report, statusFilter]);

    const handleExportPDF = async () => {
        if (!report || report.users.length === 0) return;
        
        setIsExporting(true);
        try {
            const name = company?.name || 'Empresa';
            exportBonusPDF(report, name);
        } catch (e) {
            console.error('Erro ao exportar PDF:', e);
        } finally {
            setIsExporting(false);
        }
    };

    if (!user?.activeCompanyId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Selecione uma empresa</h2>
                <p className="text-gray-500">Use o seletor na barra lateral.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Award className="w-7 h-7 text-amber-500" />
                            Bonificação Trimestral
                        </h1>
                        {report && (
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-400 border border-primary-200 dark:border-primary-800">
                                <Calculator className="w-3.5 h-3.5" />
                                {report.calculationMode === BonusCalculationMode.INDIVIDUAL ? 'MODO INDIVIDUAL' : 'MODO MÉDIA DO SETOR'}
                            </span>
                        )}
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                        Bônus = ({report?.calculationMode === BonusCalculationMode.SECTOR ? 'Média do Setor' : 'Média Individual'} ÷ 100) × (Salário Bruto ÷ 4) — Setor ≥ 75% para liberar
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <button
                            onClick={() => setViewMode('overview')}
                            className={`px-3 py-2 text-xs font-medium transition-colors ${viewMode === 'overview' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50'}`}
                        >
                            <BarChart3 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('detail')}
                            className={`px-3 py-2 text-xs font-medium transition-colors ${viewMode === 'detail' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50'}`}
                        >
                            <Users className="w-4 h-4" />
                        </button>
                    </div>
                    <button
                        onClick={handleExportPDF}
                        disabled={isExporting || !report || report.users.length === 0}
                        className="btn-primary flex items-center gap-2"
                    >
                        <FileDown className="w-4 h-4" />
                        {isExporting ? 'Gerando...' : 'Exportar PDF'}
                    </button>
                </div>
            </div>

            {/* ── Filters ── */}
            <div className="card bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[160px] flex-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Trimestre</label>
                        <select className="input text-sm w-full" value={selectedQuarter} onChange={e => setSelectedQuarter(e.target.value)}>
                            {QUARTERS.map(q => <option key={q} value={q}>{QUARTER_LABELS[q]}</option>)}
                        </select>
                    </div>
                    <div className="min-w-[100px]">
                        <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Ano</label>
                        <select className="input text-sm w-full" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div className="min-w-[160px] flex-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Setor</label>
                        <select className="input text-sm w-full" value={selectedSector} onChange={e => setSelectedSector(e.target.value)}>
                            <option value="">Todos os Setores</option>
                            {company?.sectors.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="min-w-[160px] flex-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider flex items-center gap-1"><Search className="w-3 h-3" /> Operador</label>
                        <input type="text" className="input text-sm w-full" placeholder="Buscar por nome..." value={searchName} onChange={e => setSearchName(e.target.value)} />
                    </div>
                    <div className="min-w-[140px]">
                        <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider flex items-center gap-1"><Filter className="w-3 h-3" /> Status</label>
                        <select className="input text-sm w-full" value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}>
                            <option value="all">Todos</option>
                            <option value="qualified">Qualificados</option>
                            <option value="blocked">Bloqueados</option>
                        </select>
                    </div>
                    <div className="min-w-[180px]">
                        <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider flex items-center gap-1"><Calculator className="w-3 h-3" /> Modo de Cálculo</label>
                        <select className="input text-sm w-full" value={selectedMode} onChange={e => setSelectedMode(e.target.value as BonusCalculationMode)}>
                            <option value={BonusCalculationMode.INDIVIDUAL}>Performance Individual</option>
                            <option value={BonusCalculationMode.SECTOR}>Média do Setor</option>
                        </select>
                    </div>
                    <button className="text-sm text-primary-600 font-medium py-2 hover:underline" onClick={() => { setSelectedQuarter(getCurrentQuarter()); setSelectedYear(currentYear); setSelectedSector(''); setSearchName(''); setStatusFilter('all'); setSelectedMode(BonusCalculationMode.INDIVIDUAL); }}>
                        Limpar
                    </button>
                </div>
            </div>

            {/* ── Rule ── */}
            <div className="card bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/10 border-l-4 border-amber-500 py-3">
                <div className="flex items-start gap-3">
                    <TrendingUp className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-amber-800 dark:text-amber-300">
                        <strong>Regra:</strong> Setor com média trimestral ≥ <strong>75%</strong> libera o bônus.
                        Cálculo atual: <strong>({report?.calculationMode === BonusCalculationMode.SECTOR ? 'Média do Setor' : 'Média Individual'} ÷ 100) × (Salário Bruto ÷ 4)</strong>.
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-16"><div className="animate-spin h-8 w-8 border-b-2 border-primary-600 rounded-full" /></div>
            ) : report ? (
                <>
                    {/* ── Summary KPIs ── */}
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                        <KpiCard icon={<DollarSign className="w-5 h-5" />} label="Total a Pagar" value={fmt(report.summary.totalBonus)} color="blue" />
                        <KpiCard icon={<Target className="w-5 h-5" />} label="Média Geral" value={`${report.summary.avgScore.toFixed(1)}%`} color="emerald" />
                        <KpiCard icon={<CheckCircle2 className="w-5 h-5" />} label="Qualificados" value={`${report.summary.qualifiedSectors}/${report.summary.totalSectors}`} color="violet" />
                        <KpiCard icon={<XCircle className="w-5 h-5" />} label="Bloqueados" value={`${report.summary.totalSectors - report.summary.qualifiedSectors}`} color="red" />
                        <KpiCard icon={<Users className="w-5 h-5" />} label="Colaboradores" value={`${report.summary.userCount}`} color="orange" />
                    </div>

                    {/* ── Sector Overview ── */}
                    {viewMode === 'overview' && filteredSectors.length > 0 && (
                        <div className="card">
                            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <BarChart3 className="w-5 h-5 text-gray-400" /> Situação por Setor
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {filteredSectors.map((s: BonusSectorSummary) => (
                                    <SectorCard key={s.name} sector={s} minScore={report.sectorMinScore} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Detail Table ── */}
                    <div className="card">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">Detalhamento por Colaborador</h2>
                            <span className="text-xs text-gray-400">{filteredUsers.length} resultado(s)</span>
                        </div>
                        {filteredUsers.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="table w-full">
                                    <thead>
                                        <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                                            <th className="pb-3 text-xs font-semibold text-gray-500">#</th>
                                            <th className="pb-3 text-xs font-semibold text-gray-500">Colaborador</th>
                                            <th className="pb-3 text-xs font-semibold text-gray-500">Setor</th>
                                            <th className="pb-3 text-xs font-semibold text-gray-500 text-right">Sal. Bruto</th>
                                            <th className="pb-3 text-xs font-semibold text-gray-500 text-right">Base Trim.</th>
                                            <th className="pb-3 text-xs font-semibold text-gray-500 text-center">Média Indiv.</th>
                                            <th className="pb-3 text-xs font-semibold text-gray-500 text-center">Média Setor</th>
                                            <th className="pb-3 text-xs font-semibold text-gray-500 text-center">Status</th>
                                            <th className="pb-3 text-xs font-semibold text-gray-500 text-right">Bônus</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                        {filteredUsers.map((u: BonusReportUser, idx: number) => (
                                            <tr key={u.userId} className={`hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors ${!u.sectorQualified ? 'opacity-50' : ''}`}>
                                                <td className="py-2.5 text-xs text-gray-400">{idx + 1}</td>
                                                <td className="py-2.5 font-medium text-sm text-gray-900 dark:text-white">{u.userName}</td>
                                                <td className="py-2.5 text-sm text-gray-500">{u.sector}</td>
                                                <td className="py-2.5 text-right text-sm text-gray-600 dark:text-gray-400 font-mono">{fmt(u.baseSalary)}</td>
                                                <td className="py-2.5 text-right text-sm text-gray-600 dark:text-gray-400 font-mono">{fmt(u.quarterBase)}</td>
                                                <td className="py-2.5 text-center"><span className={`font-bold text-sm ${scoreColor(u.avgScore, u.sectorQualified)}`}>{u.avgScore.toFixed(1)}%</span></td>
                                                <td className="py-2.5 text-center"><span className={`font-semibold text-sm ${u.sectorQualified ? 'text-emerald-600' : 'text-red-600'}`}>{u.sectorAvgScore.toFixed(1)}%</span></td>
                                                <td className="py-2.5 text-center">
                                                    {u.sectorQualified
                                                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"><CheckCircle2 className="w-3 h-3" />Liberado</span>
                                                        : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"><XCircle className="w-3 h-3" />Bloqueado</span>
                                                    }
                                                </td>
                                                <td className="py-2.5 text-right font-bold text-sm text-gray-900 dark:text-white font-mono">
                                                    {u.bonusValue > 0 ? fmt(u.bonusValue) : <span className="text-gray-300">—</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="border-t-2 border-gray-200 dark:border-gray-700">
                                        <tr className="font-bold bg-gray-50 dark:bg-gray-800">
                                            <td colSpan={8} className="py-3 text-right text-sm">Total:</td>
                                            <td className="py-3 text-right text-lg text-primary-600 font-mono">{fmt(filteredUsers.reduce((s, u) => s + u.bonusValue, 0))}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-gray-400">Nenhum resultado encontrado</div>
                        )}
                    </div>
                </>
            ) : null}
        </div>
    );
}

// ── Sub-components ──

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
    const colors: Record<string, string> = {
        blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800 text-blue-700 dark:text-blue-400',
        emerald: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400',
        violet: 'bg-violet-50 dark:bg-violet-900/20 border-violet-100 dark:border-violet-800 text-violet-700 dark:text-violet-400',
        red: 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800 text-red-700 dark:text-red-400',
        orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800 text-orange-700 dark:text-orange-400',
    };
    return (
        <div className={`card border text-center py-3 ${colors[color]}`}>
            <div className="flex justify-center mb-1 opacity-60">{icon}</div>
            <p className="text-xl font-bold">{value}</p>
            <p className="text-[10px] mt-0.5 uppercase tracking-wider opacity-70">{label}</p>
        </div>
    );
}

function SectorCard({ sector, minScore }: { sector: BonusSectorSummary; minScore: number }) {
    const pct = Math.min(sector.avgScore, 100);
    return (
        <div className={`p-4 rounded-xl border-2 transition-all ${sector.qualified
            ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/20'
            : 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/20'}`}>
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900 dark:text-white">{sector.name}</h3>
                {sector.qualified
                    ? <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" />QUALIFICADO</span>
                    : <span className="flex items-center gap-1 text-[10px] font-bold text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" />BLOQUEADO</span>
                }
            </div>
            {/* Progress bar */}
            <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full mb-3 overflow-hidden">
                <div className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${sector.qualified ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                <div className="absolute top-0 h-full border-r-2 border-gray-800 dark:border-white" style={{ left: `${minScore}%` }} title={`Mínimo: ${minScore}%`} />
            </div>
            <div className="grid grid-cols-4 gap-1 text-center text-xs">
                <div><p className={`text-base font-bold ${sector.qualified ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{sector.avgScore.toFixed(1)}%</p><p className="text-gray-500 text-[10px]">Média</p></div>
                <div><p className="text-base font-bold text-gray-700 dark:text-gray-300">{sector.processCount}</p><p className="text-gray-500 text-[10px]">Processos</p></div>
                <div><p className="text-base font-bold text-gray-700 dark:text-gray-300">{sector.userCount}</p><p className="text-gray-500 text-[10px]">Operadores</p></div>
                <div><p className={`text-base font-bold ${sector.qualified ? 'text-blue-700 dark:text-blue-400' : 'text-gray-400'}`}>{fmt(sector.totalBonus)}</p><p className="text-gray-500 text-[10px]">Bônus</p></div>
            </div>
        </div>
    );
}
