import mongoose from 'mongoose';
import { Company, Cycle, Process, User } from './src/models';

async function importProcesses() {
    try {
        await mongoose.connect('mongodb://localhost:27017/MMdb');
        console.log('Connected to MMdb');

        const company = await Company.findOne({ name: /Frizelo/i });
        const cycle = await Cycle.findOne({ companyId: company?._id, status: 'OPEN' });
        const user = await User.findOne({ name: 'Admin' });

        if (!company || !cycle) {
            console.error('Company or Cycle not found');
            return;
        }

        const processTitles = [
            "CONFERENCIA DE NOTAS FISCAIS (ENTRADA E SAIDA)",
            "ENTRADAS EM NOTAS FISCAIS RECUSADAS",
            "COMPROVANTES NOVILHO PRECOCE",
            "SENAR FUNRURAL TAXA",
            "COURO QUINZENAL",
            "APURAÇÃO DA BARRIGADA",
            "FECHAMENTO DE FRETES",
            "INCLUSÃO FOLHA DE PAGAMENTO",
            "INCLUSÃO FOLHA DE PAGAMENTO NF",
            "FECHAMENTO INDUSTRIAL (PCP)",
            "GUIAS NOVILHO PROAPE",
            "FSW - NOVILHO PRECOCE",
            "COMPLEMENTO RIVER CITY",
            "MOVIMENTAÇÃO ESTOQUE FISICO X FINANCEIRO",
            "CONFERENCIA VENDAS X FINANCEIRO INDUSTRIA",
            // 16 skipped
            "ICMS TAXA",
            "TAXA DE DESOSSA",
            "FECHAMENTO DE PRODUÇÃO",
            "MONITORAMENTO DE ENERGIA",
            "CUSTO DE PRODUÇÃO INDUSTRIAL",
            "PROAPE TAXA",
            "IMPOSTOS RETIDOS RETIDOS EM SERVIÇOS DE ABATE",
            "ICMS REAL",
            "BALANÇO FISCAL",
            "PREVISAO DE IMPOSTOS",
            "CUSTO PROJETADO X EFETIVO",
            "TAXA DE SERVIÇO DE ABATE",
            "INCLUSÃO FINANCEIRA TAXA DE SERVIÇOS DE ABATE",
            "EMAIL SERVIÇO DE ABATE",
            "SALDO COR 06 X FRZ",
            "RESULTADO DESOSSA",
            "TAXA ACUMULADA",
            "RESULTADO SERVIÇO DE ABATE E DESOSSA",
            "CONFERENCIA FINANCEIRA (BANCOS) INDUSTRIA",
            "APURACAO FECHADA DE IMPOSTOS",
            "APURAÇÃO RESULTADOS (DRE/BALANÇO)",
            "COURO QUINZENAL 2",
            "INDICADORES DE DESEMPENHO"
        ];

        const processes = processTitles.map((title, index) => {
            const originalIndex = index + 1;
            const displayIndex = originalIndex >= 16 ? originalIndex + 1 : originalIndex;
            const code = displayIndex.toString().padStart(3, '0');

            return {
                companyId: company._id,
                cycleId: cycle._id,
                code,
                title,
                sector: 'ADM',
                plannedDate: new Date('2026-01-15T09:00:00Z'),
                limitDate: new Date('2026-01-20T18:00:00Z'),
                status: 'PENDING',
                responsibleUserId: user?._id || null,
                deliveryStatus: 'NOT_DELIVERED'
            };
        });

        const result = await Process.insertMany(processes);
        console.log(`Successfully imported ${result.length} processes`);

    } catch (err) {
        console.error('Error importing processes:', err);
    } finally {
        await mongoose.disconnect();
    }
}

importProcesses();
