const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function diagnose() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const Process = mongoose.model('Process', new mongoose.Schema({}, { strict: false }));
        const Cycle = mongoose.model('Cycle', new mongoose.Schema({}, { strict: false }));
        const duplicateTitlesGlobal = await Process.aggregate([
            {
                $group: {
                    _id: {
                        companyId: '$companyId',
                        title: '$title'
                    },
                    count: { $sum: 1 },
                    instances: {
                        $push: {
                            code: '$code',
                            sector: '$sector',
                            cycleId: '$cycleId'
                        }
                    }
                }
            },
            {
                $match: {
                    count: { $gt: 1 }
                }
            }
        ]);

        console.log(`Found ${duplicateTitlesGlobal.length} sets of duplicate titles globally.`);

        for (const set of duplicateTitlesGlobal) {
            console.log('--- Duplicate Title Global ---');
            console.log('Title:', set._id.title);
            for (const inst of set.instances) {
                const cycle = await Cycle.findById(inst.cycleId).lean();
                console.log(`  - Code: ${inst.code}, Sector: ${inst.sector}, Cycle: ${cycle ? cycle.month : 'Unknown'}`);
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

diagnose();
