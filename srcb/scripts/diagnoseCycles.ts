import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/makingmoney';

async function main() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!\n');

    const Cycle = mongoose.connection.collection('cycles');
    const Process = mongoose.connection.collection('processes');

    // Check cycles
    console.log('=== CYCLES STATUS ===\n');

    const allCycles = await Cycle.find({}).sort({ sector: 1, month: -1 }).toArray();

    const grouped: Record<string, any[]> = {};
    for (const c of allCycles) {
        if (!grouped[c.sector]) grouped[c.sector] = [];
        grouped[c.sector].push(c);
    }

    for (const [sector, cycles] of Object.entries(grouped)) {
        console.log(`📁 Sector: ${sector}`);
        for (const c of cycles) {
            const processCount = await Process.countDocuments({ cycleId: c._id });
            const status = c.status === 'OPEN' ? '🟢 OPEN' : '🔴 CLOSED';
            console.log(`   ${status} | Month: ${c.month} | Processes: ${processCount}`);
        }
        console.log('');
    }

    // Summary
    const openCycles = allCycles.filter(c => c.status === 'OPEN');
    const closedCycles = allCycles.filter(c => c.status === 'CLOSED');

    console.log('=== SUMMARY ===');
    console.log(`Total Cycles: ${allCycles.length}`);
    console.log(`Open: ${openCycles.length}`);
    console.log(`Closed: ${closedCycles.length}`);

    if (openCycles.length === 0) {
        console.log('\n⚠️  WARNING: No open cycles found! Users need to open new cycles.');
    }

    await mongoose.disconnect();
    console.log('\nDone!');
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});

