
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function diagnose() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to database');

        const db = mongoose.connection.db;

        // Find all Contabilidade/Fiscal cycles
        const fiscalCycles = await db.collection('cycles').find({
            sector: 'Contabilidade/Fiscal'
        }).toArray();

        console.log('\n=== ALL CONTABILIDADE/FISCAL CYCLES ===');
        for (const c of fiscalCycles) {
            const processCount = await db.collection('processes').countDocuments({ cycleId: c._id });
            console.log(`${c.month} | Status: ${c.status} | Processes: ${processCount} | ID: ${c._id}`);
        }

        // Find all processes in Contabilidade/Fiscal sector
        const fiscalProcesses = await db.collection('processes').find({
            sector: 'Contabilidade/Fiscal'
        }).toArray();

        console.log(`\n=== ALL CONTABILIDADE/FISCAL PROCESSES ===`);
        console.log(`Total: ${fiscalProcesses.length}`);
        fiscalProcesses.slice(0, 10).forEach(p => {
            console.log(`- ${p.code}: ${p.title} (Cycle: ${p.cycleId})`);
        });

        // Let's also check Controladoria to see if there are processes there
        const controladoriaProcesses = await db.collection('processes').find({
            sector: 'Controladoria'
        }).toArray();

        console.log(`\n=== ALL CONTROLADORIA PROCESSES ===`);
        console.log(`Total: ${controladoriaProcesses.length}`);

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Diagnostic failed:', error);
        process.exit(1);
    }
}

diagnose();
