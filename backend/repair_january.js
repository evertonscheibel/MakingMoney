const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:/Projetos/MakingMoney/backend/.env' });

async function repairCycles() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gestaopro');
        const db = mongoose.connection.db;

        console.log('Iniciando reparo de ciclos...');

        // 1. Localizar o ciclo de Janeiro/2026 da Controladoria
        const janCycle = await db.collection('cycles').findOne({ month: '2026-01', sector: 'Controladoria' });
        if (!janCycle) {
            console.log('Ciclo de Janeiro não encontrado.');
            return;
        }

        // 2. Localizar o ciclo de Fevereiro/2026 da Controladoria
        let febCycle = await db.collection('cycles').findOne({ month: '2026-02', sector: 'Controladoria' });

        if (!febCycle) {
            console.log('Ciclo de Fevereiro não encontrado. Criando...');
            const result = await db.collection('cycles').insertOne({
                companyId: janCycle.companyId,
                month: '2026-02',
                sector: 'Controladoria',
                status: 'OPEN',
                openedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
                kpis: { avgScore: 0, onTimePct: 0, criticalCount: 0, totalProcesses: 0, avgDeviationDays: 0 }
            });
            febCycle = await db.collection('cycles').findOne({ _id: result.insertedId });
        } else if (febCycle.status === 'CLOSED') {
            console.log('Abrindo ciclo de Fevereiro que estava fechado...');
            await db.collection('cycles').updateOne(
                { _id: febCycle._id },
                { $set: { status: 'OPEN', openedAt: new Date() } }
            );
        }

        // 3. Verificar se já existem processos em Fevereiro
        const existingCount = await db.collection('processes').countDocuments({ cycleId: febCycle._id });
        if (existingCount > 0) {
            console.log(`Fevereiro já possui ${existingCount} processos. Abortando clonagem para evitar duplicidade.`);
            return;
        }

        // 4. Clonar processos de Janeiro para Fevereiro
        const janProcesses = await db.collection('processes').find({ cycleId: janCycle._id }).toArray();
        console.log(`Clonando ${janProcesses.length} processos de Janeiro para Fevereiro...`);

        const febProcesses = janProcesses.map(p => {
            const newP = { ...p };
            delete newP._id;
            newP.cycleId = febCycle._id;

            // Ajustar datas (shift +1 month)
            const pDate = new Date(p.plannedDate);
            pDate.setMonth(pDate.getMonth() + 1);
            if (pDate.getDate() !== new Date(p.plannedDate).getDate()) pDate.setDate(0);

            const lDate = new Date(p.limitDate);
            lDate.setMonth(lDate.getMonth() + 1);
            if (lDate.getDate() !== new Date(p.limitDate).getDate()) lDate.setDate(0);

            newP.plannedDate = pDate;
            newP.limitDate = lDate;

            // Resetar campos de entrega
            newP.deliveryDate = null;
            newP.deliverySource = null;
            newP.deliveryEvidence = null;
            newP.deliveryStatus = 'NOT_DELIVERED';
            newP.score = null;
            newP.status = 'PENDING';
            newP.revertReason = null;
            newP.revertedBy = null;
            newP.revertedAt = null;
            newP.emailSentAt = null;
            newP.createdAt = new Date();
            newP.updatedAt = new Date();

            return newP;
        });

        if (febProcesses.length > 0) {
            await db.collection('processes').insertMany(febProcesses);
            console.log('Clonagem concluída com sucesso!');
        }

    } catch (error) {
        console.error('Erro no reparo:', error);
    } finally {
        await mongoose.disconnect();
    }
}

repairCycles();
