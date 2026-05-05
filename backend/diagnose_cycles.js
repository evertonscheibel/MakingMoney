const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:/Projetos/MakingMoney/backend/.env' });

async function diagnoseTransition() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gestaopro');
        const db = mongoose.connection.db;

        console.log('--- CICLOS ---');
        const cycles = await db.collection('cycles').find({}).sort({ month: -1 }).toArray();
        for (const cycle of cycles) {
            const processCount = await db.collection('processes').countDocuments({ cycleId: cycle._id });
            console.log(`ID: ${cycle._id} | Mês: ${cycle.month} | Setor: ${cycle.sector} | Status: ${cycle.status} | Processos: ${processCount}`);
        }

        console.log('\n--- ÚLTIMOS PROCESSOS CRIADOS ---');
        const lastProcesses = await db.collection('processes').find({}).sort({ _id: -1 }).limit(5).toArray();
        for (const p of lastProcesses) {
            console.log(`ID: ${p._id} | Código: ${p.code} | Título: ${p.title} | CicloID: ${p.cycleId} | Criado em: ${p._id.getTimestamp()}`);
        }

    } catch (error) {
        console.error('Erro no diagnóstico:', error);
    } finally {
        await mongoose.disconnect();
    }
}

diagnoseTransition();
