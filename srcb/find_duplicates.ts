
import mongoose from 'mongoose';
import { Process, Cycle } from './models';
import { config } from './config';

async function findDuplicates() {
    try {
        await mongoose.connect(config.mongodbUri);
        console.log('Connected to database');

        const duplicates = await Process.aggregate([
            {
                $group: {
                    _id: {
                        cycleId: '$cycleId',
                        sector: '$sector',
                        code: '$code'
                    },
                    count: { $sum: 1 },
                    ids: { $push: '$_id' },
                    titles: { $push: '$title' }
                }
            },
            {
                $match: {
                    count: { $gt: 1 }
                }
            }
        ]) as any[];

        console.log(`Found ${duplicates.length} duplicate groups (same cycle, sector, and code).`);

        for (const dup of duplicates) {
            console.log(`--- Duplicate Group ---`);
            console.log(`Cycle ID: ${dup._id.cycleId}`);
            console.log(`Sector: ${dup._id.sector}`);
            console.log(`Code: ${dup._id.code}`);
            console.log(`Count: ${dup.count}`);
            console.log(`Titles: ${dup.titles.join(', ')}`);
            console.log(`IDs: ${dup.ids.join(', ')}`);

            const cycle = await Cycle.findById(dup._id.cycleId);
            if (cycle) {
                console.log(`Cycle Month: ${cycle.month}`);
            }
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Diagnostic failed:', error);
        process.exit(1);
    }
}

findDuplicates();
