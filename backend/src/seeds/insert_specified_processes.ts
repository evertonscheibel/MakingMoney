import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Company, Cycle, Process } from '../models';
import { ProcessStatus } from '../types';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/metodo_chronos';

const processes = [
    { title: 'CONFERENCIA DE NOTAS FISCAIS (ENTRADA E SAIDA)', sector: 'Fiscal', code: 'FIS-001' },
    { title: 'ENTRADAS EM NOTAS FISCAIS RECUSADAS', sector: 'Fiscal', code: 'FIS-002' },
    { title: 'COMPROVANTES NOVILHO PRECOCE', sector: 'Financeiro', code: 'FIN-003' },
    { title: 'MOVIMENTAÇÃO ESTOQUE FISICO X FINANCEIRO', sector: 'Logística', code: 'LOG-001' },
    { title: 'CONFERENCIA VENDAS X FINANCEIRO INDUSTRIA', sector: 'Comercial', code: 'COM-001' },
    { title: 'FECHAMENTO DE FRETES', sector: 'Logística', code: 'LOG-002' },
    { title: 'APURAÇÃO DA BARRIGADA', sector: 'Produção', code: 'PRD-001' },
    { title: 'INCLUSÃO FOLHA DE PAGAMENTO', sector: 'RH', code: 'RH-001' },
    { title: 'SENAR FUNRURAL TAXA', sector: 'Fiscal', code: 'FIS-003' },
    { title: 'INCLUSÃO FOLHA DE PAGAMENTO NF', sector: 'RH', code: 'RH-002' },
    { title: 'COURO QUINZENAL', sector: 'Produção', code: 'PRD-002' },
    { title: 'COMPLEMENTO RIVER CITY', sector: 'Financeiro', code: 'FIN-004' },
    { title: 'COMPLEMENTO AGRICOLA PANTANAL', sector: 'Financeiro', code: 'FIN-005' },
    { title: 'COMPLEMENTO CANCE', sector: 'Financeiro', code: 'FIN-006' },
    { title: 'MONITORAMENTO DE ENERGIA', sector: 'Administrativo', code: 'ADM-001' },
    { title: 'CUSTO PROJETADO X EFETIVO', sector: 'Controladoria', code: 'CON-001' },
    { title: 'PROAPE TAXA', sector: 'Fiscal', code: 'FIS-004' },
    { title: 'FECHAMENTO DE PRODUÇÃO', sector: 'Produção', code: 'PRD-003' },
    { title: 'ICMS REAL', sector: 'Fiscal', code: 'FIS-005' },
    { title: 'TAXA DE DESOSSA', sector: 'Produção', code: 'PRD-004' },
    { title: 'ICMS TAXA', sector: 'Fiscal', code: 'FIS-006' },
    { title: 'IMPOSTOS RETIDOS EM SERVIÇOS TÉCNICOS', sector: 'Fiscal', code: 'FIS-007' },
    { title: 'PREVISAO DE IMPOSTOS', sector: 'Fiscal', code: 'FIS-008' },
    { title: 'BALANÇO FISCAL', sector: 'Fiscal', code: 'FIS-009' },
    { title: 'TAXA DE SERVIÇO GERAL', sector: 'Produção', code: 'PRD-005' },
    { title: 'CUSTO DE PRODUÇÃO INDUSTRIAL', sector: 'Produção', code: 'PRD-006' },
    { title: 'FECHAMENTO INDUSTRIAL (PCP)', sector: 'Produção', code: 'PRD-007' },
    { title: 'SALDO COR 06 X FRZ', sector: 'Produção', code: 'PRD-008' },
    { title: 'INCLUSÃO FINANCEIRA TAXA DE SERVIÇOS', sector: 'Financeiro', code: 'FIN-007' },
    { title: 'EMAIL DE SERVIÇOS', sector: 'Administrativo', code: 'ADM-002' },
    { title: 'TAXA ACUMULADA', sector: 'Financeiro', code: 'FIN-008' },
    { title: 'COURO QUINZENAL 2', sector: 'Produção', code: 'PRD-009' },
    { title: 'APURACAO FECHADA DE IMPOSTOS', sector: 'Fiscal', code: 'FIS-010' },
    { title: 'CONFERENCIA FINANCEIRA (BANCOS) INDUSTRIA', sector: 'Financeiro', code: 'FIN-009' },
    { title: 'RESULTADO SERVIÇO GERAL', sector: 'Controladoria', code: 'CON-002' },
    { title: 'RESULTADO DESOSSA', sector: 'Controladoria', code: 'CON-003' },
    { title: 'APURAÇÃO RESULTADOS (DRE/BALANÇO)', sector: 'Controladoria', code: 'CON-004' },
    { title: 'INDICADORES DE DESEMPENHO', sector: 'Administrativo', code: 'ADM-003' },
];

async function insertProcesses() {
    try {
        console.log('🌱 Connecting to database...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected');

        const company = await Company.findOne({ name: 'Empresa Demo' });
        if (!company) {
            console.error('❌ Company "Empresa Demo" not found');
            process.exit(1);
        }

        const cycle = await Cycle.findOne({ companyId: company._id, status: 'OPEN' });
        if (!cycle) {
            console.error('❌ Open cycle not found for "Empresa Demo"');
            process.exit(1);
        }

        console.log(`🚀 Inserting ${processes.length} processes into Company: ${company.name}, Cycle: ${cycle.month}...`);

        const today = new Date();
        const plannedDate = new Date(today);
        plannedDate.setDate(today.getDate() - 5);
        const limitDate = new Date(today);
        limitDate.setDate(today.getDate() + 5);

        for (const p of processes) {
            await Process.create({
                companyId: company._id,
                cycleId: cycle._id,
                code: p.code,
                title: p.title,
                sector: p.sector,
                plannedDate,
                limitDate,
                status: ProcessStatus.PENDING,
            });
        }

        console.log('✅ Successfully inserted all processes');
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error inserting processes:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

insertProcesses();

