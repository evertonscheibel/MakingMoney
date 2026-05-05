const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function cleanup() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const Process = mongoose.model('Process', new mongoose.Schema({}, { strict: false }));
        const Cycle = mongoose.model('Cycle', new mongoose.Schema({}, { strict: false }));

        // We want to find processes in February 2026 (2026-02) 
        // that are in 'Contabilidade/Fiscal' but have the same title/code as in 'Controladoria'

        const cycleFebFiscal = await Cycle.findOne({ month: '2026-02', sector: 'Contabilidade/Fiscal' });
        const cycleFebControladoria = await Cycle.findOne({ month: '2026-02', sector: 'Controladoria' });

        if (!cycleFebFiscal || !cycleFebControladoria) {
            console.log('Cycles not found. Nothing to cleanup.');
            process.exit(0);
        }

        const controladoriaProcesses = await Process.find({ cycleId: cycleFebControladoria._id }).lean();
        const controladoriaTitles = controladoriaProcesses.map(p => p.title);

        const duplicatesInFiscal = await Process.find({
            cycleId: cycleFebFiscal._id,
            title: { $in: controladoriaTitles }
        });

        console.log(`Found ${duplicatesInFiscal.length} duplicates in Contabilidade/Fiscal cycle.`);

        const idsToDelete = duplicatesInFiscal.map(p => p._id);

        if (idsToDelete.length > 0) {
            const result = await Process.deleteMany({ _id: { $in: idsToDelete } });
            console.log(`Deleted ${result.deletedCount} duplicate processes from Contabilidade/Fiscal.`);
        } else {
            console.log('No duplicates found to delete.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

cleanup();
