
import mongoose from 'mongoose';
import { Process, Cycle } from './models';
import { config } from './config';

async function listProcessCounts() {
    try {
        await mongoose.connect(config.mongodbUri);
        console.log('Connected to database');

        const cycles = await Cycle.find({}).sort({ month: 1, sector: 1 });

        console.log('Cycles and Process Counts:');
        for (const cycle of cycles) {
            const count = await Process.countDocuments({ cycleId: cycle._id });
            if (count > 0) {
                console.log(`- ${cycle.month} | ${cycle.sector} | Status: ${cycle.status} | Processes: ${count}`);
            }
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('List failed:', error);
        process.exit(1);
    }
}

listProcessCounts();
