
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Company, Cycle, Process } from '../models';
import { CycleStatus } from '../types';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/metodo_chronos';

async function migrate() {
    console.log('Connecting to MongoDB...');
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected.');

        const companies = await Company.find({});
        console.log(`Found ${companies.length} companies.`);

        for (const company of companies) {
            console.log(`\nProcessing company: ${company.name} (${company._id})`);

            const targetMonth = '2026-01'; // Jan 2026

            // 1. Find or Create Target Cycle
            let cycle = await Cycle.findOne({
                companyId: company._id,
                month: targetMonth
            });

            if (!cycle) {
                console.log(`  Creating new cycle for ${targetMonth}`);
                cycle = await Cycle.create({
                    companyId: company._id,
                    month: targetMonth,
                    status: CycleStatus.OPEN,
                    openedAt: new Date('2026-01-01T00:00:00Z'),
                    kpis: {
                        avgScore: 0,
                        onTimePct: 0,
                        criticalCount: 0,
                        totalProcesses: 0,
                        avgDeviationDays: 0
                    }
                });
            } else {
                console.log(`  Cycle ${targetMonth} already exists. Ensuring it is OPEN.`);
                cycle.status = CycleStatus.OPEN;
                await cycle.save();
            }

            console.log(`  Target Cycle ID: ${cycle._id}`);

            // 2. Move ALL processes to this cycle
            const result = await Process.updateMany(
                { companyId: company._id },
                { $set: { cycleId: cycle._id } }
            );

            console.log(`  Moved ${result.modifiedCount} processes to cycle ${targetMonth}`);

            // 3. Close other cycles
            const closeResult = await Cycle.updateMany(
                { companyId: company._id, _id: { $ne: cycle._id } },
                { $set: { status: CycleStatus.CLOSED } }
            );
            console.log(`  Closed ${closeResult.modifiedCount} other cycles.`);
        }

        console.log('\nMigration complete.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();

