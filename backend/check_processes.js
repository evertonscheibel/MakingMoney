
const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:/Projetos/MakingMoney/backend/.env' });

async function checkProcesses() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gestaopro');

        // Find Greice
        const user = await mongoose.connection.db.collection('users').findOne({ email: /greice/i });
        if (!user) {
            console.log('User Greice not found');
            return;
        }
        console.log('User CompanyAccess:', user.companyAccess);
        console.log('User ActiveCompanyId:', user.activeCompanyId);

        const activeCompanyId = user.activeCompanyId; // ObjectId

        // Check for processes in Controladoria AND Company
        const processes = await mongoose.connection.db.collection('processes').find({
            sector: 'Controladoria',
            companyId: activeCompanyId
        }).toArray();

        console.log(`Found ${processes.length} processes for Controladoria in Company ${activeCompanyId}`);

        if (processes.length > 0) {
            console.log('Sample process cycleId:', processes[0].cycleId);

            // Check Cycle
            const cycle = await mongoose.connection.db.collection('cycles').findOne({ _id: processes[0].cycleId });
            console.log('Cycle Month:', cycle ? cycle.month : 'Cycle not found');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkProcesses();
