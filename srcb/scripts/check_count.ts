
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Process, Cycle } from '../models';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/metodo_chronos';

async function count() {
    try {
        await mongoose.connect(MONGODB_URI);
        const cycle = await Cycle.findOne({ month: '2026-01' });
        if (cycle) {
            const count = await Process.countDocuments({ cycleId: cycle._id });
            console.log(`Processes in 2026-01: ${count}`);

            // Check for duplicates by code
            const dups = await Process.aggregate([
                { $match: { cycleId: cycle._id } },
                { $group: { _id: "$code", count: { $sum: 1 } } },
                { $match: { count: { $gt: 1 } } }
            ]);
            console.log(`Codes with duplicates: ${dups.length}`);
        } else {
            console.log('Cycle 2026-01 not found.');
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

count();

