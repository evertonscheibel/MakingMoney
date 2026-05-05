
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Process, Cycle } from '../models';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/metodo_chronos';

async function deduplicate() {
    console.log('Connecting to MongoDB...');
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected.');

        // Find the target cycle (2026-01) for each company ? 
        // Or just iterate all companies

        // Actually, we just need to target OPEN cycles or specifically 2026-01 since we just reset everything to it.
        // Let's look for processes in 2026-01 cycle.

        const targetCycles = await Cycle.find({ month: '2026-01' });
        console.log(`Found ${targetCycles.length} cycles for 2026-01.`);

        for (const cycle of targetCycles) {
            console.log(`Processing cycle ${cycle._id} for company ${cycle.companyId}`);

            const processes = await Process.find({ cycleId: cycle._id });
            console.log(`  Found ${processes.length} processes total.`);

            const seenCodes = new Set<string>();
            const toDelete: string[] = [];
            const unique: string[] = [];

            // Sort by createdAt desc so we keep the latest? Or asc?
            // User probably wants the "cleanest" one. 
            // Let's sort by createdAt DESC to keep the newest one created.
            // But wait, if they have data in older ones?
            // "Reset" implies we want fresh state. PENDING.
            // So we'll keep the newest one and reset its state if needed (though reset script didn't reset state... duplicates might be mixed status).
            // Let's assume we keep the latest one.

            // We need to fetch sorted
            const sortedProcesses = await Process.find({ cycleId: cycle._id }).sort({ createdAt: -1 });

            for (const p of sortedProcesses) {
                if (seenCodes.has(p.code)) {
                    toDelete.push(p._id.toString());
                } else {
                    seenCodes.add(p.code);
                    unique.push(p._id.toString());
                }
            }

            console.log(`  Unique codes: ${unique.length}`);
            console.log(`  Duplicates to delete: ${toDelete.length}`);

            if (toDelete.length > 0) {
                await Process.deleteMany({ _id: { $in: toDelete } });
                console.log('  ❌ Deleted duplicates.');

                // Also reset status of the remaining ones to PENDING?
                // The user said "start again... put all processes".
                // If I reset cycle, I should probably also reset process status to PENDING/clean slate.
                // My previous script ONLY moved them. It didn't reset status.

                await Process.updateMany(
                    { _id: { $in: unique } },
                    {
                        $set: {
                            status: 'PENDING',
                            deliveryDate: null,
                            deliveryEvidence: null,
                            score: null,
                            deliverySource: null
                        }
                    }
                );
                console.log('  🔄 Reset status of unique processes to PENDING.');
            }
        }

        console.log('\nDeduplication complete.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Failed:', error);
        process.exit(1);
    }
}

deduplicate();

