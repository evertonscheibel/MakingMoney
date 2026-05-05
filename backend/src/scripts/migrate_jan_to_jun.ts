
import mongoose from 'mongoose';
import { Cycle, Process, Company, User } from '../models';
import { config } from '../config';

async function run() {
    try {
        // @ts-ignore
        await mongoose.connect(config.mongodbUri);

        const sector = 'Controladoria';
        const companyId = '6968f9815472b311ec72ce04'; // From previous logs
        const targetMonth = '2026-06';

        console.log(`Migrating processes for sector ${sector} to ${targetMonth}...`);

        // 1. Ensure target cycle exists and is OPEN
        let targetCycle = await Cycle.findOne({ companyId, sector, month: targetMonth });

        if (targetCycle) {
            console.log(`Found existing cycle for ${targetMonth}. Status: ${targetCycle.status}`);
            if (targetCycle.status !== 'OPEN') {
                targetCycle.status = 'OPEN' as any;
                await targetCycle.save();
                console.log('Set target cycle status to OPEN.');
            }
        } else {
            targetCycle = await Cycle.create({
                companyId,
                sector,
                month: targetMonth,
                status: 'OPEN' as any,
                openedAt: new Date()
            });
            console.log(`Created new OPEN cycle for ${targetMonth}.`);
        }

        // 2. Find processes in Jan 2026
        const oldCycle = await Cycle.findOne({ companyId, sector, month: '2026-01' });
        if (!oldCycle) {
            console.log('No January 2026 cycle found for migration.');
            return;
        }

        const processes = await Process.find({ cycleId: oldCycle._id });
        console.log(`Found ${processes.length} processes in Jan 2026.`);

        // 3. Move processes and shift dates to JUNE
        // Jan -> June = +5 months
        for (const p of processes) {
            const pDate = new Date(p.plannedDate);
            pDate.setMonth(pDate.getMonth() + 5);

            const lDate = new Date(p.limitDate);
            lDate.setMonth(lDate.getMonth() + 5);

            p.cycleId = targetCycle._id;
            p.plannedDate = pDate;
            p.limitDate = lDate;
            p.deliveryDate = null;
            p.score = null;
            p.status = 'PENDING' as any; // Using string as enum might not be imported correctly in simple ts-node
            await p.save();
        }

        console.log(`✅ Successfully migrated ${processes.length} processes to ${targetMonth}.`);

    } catch (error) {
        console.error('Error during migration:', error);
    } finally {
        await mongoose.disconnect();
    }
}

run();
