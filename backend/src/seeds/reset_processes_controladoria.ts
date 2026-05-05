import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Company, Cycle, Process } from '../models';
import { ProcessStatus } from '../types';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/metodo_chronos';

const processes = [
    'CONFERENCIA DE NOTAS FISCAIS (ENTRADA E SAIDA)',
    'ENTRADAS EM NOTAS FISCAIS RECUSADAS',
    'COMPROVANTES NOVILHO PRECOCE',
    'SENAR FUNRURAL TAXA',
    'COURO QUINZENAL',
    'APURAÇÃO DA BARRIGADA',
    'FECHAMENTO DE FRETES',
    'INCLUSÃO FOLHA DE PAGAMENTO',
    'INCLUSÃO FOLHA DE PAGAMENTO NF',
    'FECHAMENTO INDUSTRIAL (PCP)',
    'GUIAS NOVILHO PROAPE',
    'FSW - NOVILHO PRECOCE',
    'COMPLEMENTO RIVER CITY',
    'MOVIMENTAÇÃO ESTOQUE FISICO X FINANCEIRO',
    'CONFERENCIA VENDAS X FINANCEIRO INDUSTRIA',
    'ICMS TAXA',
    'TAXA DE DESOSSA',
    'FECHAMENTO DE PRODUÇÃO',
    'MONITORAMENTO DE ENERGIA',
    'CUSTO DE PRODUÇÃO INDUSTRIAL',
    'PROAPE TAXA',
    'IMPOSTOS RETIDOS EM SERVIÇOS TÉCNICOS',
    'ICMS REAL',
    'BALANÇO FISCAL',
    'PREVISAO DE IMPOSTOS',
    'CUSTO PROJETADO X EFETIVO',
    'TAXA DE SERVIÇO GERAL',
    'INCLUSÃO FINANCEIRA TAXA DE SERVIÇOS',
    'EMAIL DE SERVIÇOS',
    'SALDO COR 06 X FRZ',
    'RESULTADO DESOSSA',
    'TAXA ACUMULADA',
    'RESULTADO SERVIÇO GERAL',
    'CONFERENCIA FINANCEIRA (BANCOS) INDUSTRIA',
    'APURACAO FECHADA DE IMPOSTOS',
    'APURAÇÃO RESULTADOS (DRE/BALANÇO)',
    'COURO QUINZENAL 2',
    'INDICADORES DE DESEMPENHO',
];

async function resetProcesses() {
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

        // Add CONTROLADORIA to sectors if not present (case-insensitive check)
        const hasControladoria = company.sectors.some(s => s.toUpperCase() === 'CONTROLADORIA');
        if (!hasControladoria) {
            console.log('🏢 Adding "CONTROLADORIA" sector...');
            company.sectors.push('CONTROLADORIA');
            await company.save();
        }

        console.log('🗑️  Deleting existing processes for this cycle...');
        await Process.deleteMany({ companyId: company._id, cycleId: cycle._id });

        console.log(`🚀 Inserting ${processes.length} processes...`);

        const today = new Date();
        const plannedDate = new Date(today);
        plannedDate.setDate(today.getDate() - 5);
        const limitDate = new Date(today);
        limitDate.setDate(today.getDate() + 5);

        for (let i = 0; i < processes.length; i++) {
            const code = (i + 1).toString().padStart(3, '0');
            try {
                await Process.create({
                    companyId: company._id,
                    cycleId: cycle._id,
                    code,
                    title: processes[i],
                    sector: 'CONTROLADORIA',
                    plannedDate,
                    limitDate,
                    status: ProcessStatus.PENDING,
                });
                console.log(`   [${code}] ${processes[i]}`);
            } catch (err: any) {
                console.error(`❌ Error creating process ${code}:`, JSON.stringify(err, null, 2));
                throw err;
            }
        }

        console.log('✅ Successfully reset all processes to CONTROLADORIA');
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error resetting processes:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

resetProcesses();

