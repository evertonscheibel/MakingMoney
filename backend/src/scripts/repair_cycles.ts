
import mongoose from 'mongoose';
import { Cycle, Company } from '../models';
import { config } from '../config';

async function run() {
    try {
        // @ts-ignore
        await mongoose.connect(config.mongodbUri);

        const sector = 'Controladoria';
        console.log(`Checking cycles for sector: ${sector}`);

        // Find stale open cycle
        const openCycle = await Cycle.findOne({
            sector,
            status: 'OPEN',
            month: '2026-01' // Targeting the specific problematic cycle
        });

        if (openCycle) {
            console.log(`Found stale open cycle: ${openCycle.month} (${openCycle._id})`);

            // Close it manually
            openCycle.status = 'CLOSED' as any;
            openCycle.closedAt = new Date();
            await openCycle.save();

            console.log('✅ Cycle 2026-01 status updated to CLOSED.');
            console.log('User should now be able to open a new cycle (e.g., 2026-06).');
        } else {
            console.log('No stale open cycle found for 2026-01.');
        }

        // Verify latest status
        const latest = await Cycle.findOne({ sector }).sort({ month: -1 });
        console.log(`Latest cycle in DB: ${latest?.month} (${latest?.status})`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

run();
