
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function findDuplicateCycles() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to database');

        const Cycle = mongoose.model('Cycle', new mongoose.Schema({}, { strict: false }));

        const duplicates = await Cycle.aggregate([
            {
                $group: {
                    _id: {
                        companyId: '$companyId',
                        month: '$month',
                        sector: '$sector'
                    },
                    count: { $sum: 1 },
                    ids: { $push: '$_id' }
                }
            },
            {
                $match: {
                    count: { $gt: 1 }
                }
            }
        ]);

        console.log(`Found ${duplicates.length} duplicate cycles (same month and sector).`);

        for (const dup of duplicates) {
            console.log(`--- Duplicate Cycle Group ---`);
            console.log(`Month: ${dup._id.month}`);
            console.log(`Sector: ${dup._id.sector}`);
            console.log(`IDs: ${dup.ids.join(', ')}`);
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Diagnostic failed:', error);
        process.exit(1);
    }
}

findDuplicateCycles();
