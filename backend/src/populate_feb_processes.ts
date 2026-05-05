
import mongoose from 'mongoose';
import { User, Cycle, Process } from './models';
import { config } from './config';
import { DeliveryStatus, ProcessStatus } from './types';

// Helper to get next month date
function shiftDateToNextMonth(date: Date | null | undefined): Date | null {
    if (!date) return null;
    const result = new Date(date);
    if (isNaN(result.getTime())) return null;
    result.setMonth(result.getMonth() + 1);
    if (result.getDate() !== date.getDate()) {
        result.setDate(0);
    }
    return result;
}

async function populate() {
    try {
        await mongoose.connect(config.mongodbUri);
        console.log('Connected to database');

        const joilson = await User.findOne({ email: { $regex: 'joilson.fiscal@frizelo.com.br', $options: 'i' } });
        if (!joilson) {
            console.error('Joilson not found');
            process.exit(1);
        }

        const companyId = joilson.activeCompanyId;
        const sector = 'Contabilidade/Fiscal';

        // 1. Find Source Cycle (Jan 2026)
        const sourceCycle = await Cycle.findOne({
            companyId,
            sector,
            month: '2026-01'
        });

        if (!sourceCycle) {
            console.error('Source cycle (2026-01) not found!');
            process.exit(1);
        }

        // 2. Find Target Cycle (Feb 2026)
        const targetCycle = await Cycle.findOne({
            companyId,
            sector,
            month: '2026-02'
        });

        if (!targetCycle) {
            console.error('Target cycle (2026-02) not found!');
            process.exit(1);
        }

        // 3. Get Processes from Source
        const processes = await Process.find({ cycleId: sourceCycle._id });
        console.log(`Found ${processes.length} processes in source cycle.`);

        if (processes.length === 0) {
            console.error('No processes to clone!');
            process.exit(0);
        }

        // 4. Check for existing processes in target to avoid duplicates
        const existingTargetProcesses = await Process.find({ cycleId: targetCycle._id });
        const existingCodes = existingTargetProcesses.map(p => p.code);

        // 5. Prepare new processes
        const processesToCreate = processes
            .filter(p => !existingCodes.includes(p.code))
            .map(p => {
                const pObj = p.toObject() as any;
                delete pObj._id;
                delete pObj.createdAt;
                delete pObj.updatedAt;

                const newPlanned = shiftDateToNextMonth(p.plannedDate);
                const newLimit = shiftDateToNextMonth(p.limitDate);

                return {
                    ...pObj,
                    cycleId: targetCycle._id,
                    plannedDate: newPlanned || p.plannedDate,
                    limitDate: newLimit || p.limitDate,
                    deliveryDate: null,
                    deliverySource: null,
                    deliveryEvidence: null,
                    deliveryStatus: 'NOT_DELIVERED', // String literal matching enum
                    score: null,
                    status: 'PENDING', // String literal matching enum
                    revertReason: null,
                    revertedBy: null,
                    revertedAt: null,
                    emailSentAt: null,
                    // Ensure the owner/responsible user is preserved or reassigned if needed. 
                    // For now, keeping original responsibleUserId (which might be Joilson or others).
                };
            });

        if (processesToCreate.length === 0) {
            console.log('All processes already exist in target cycle.');
        } else {
            await Process.insertMany(processesToCreate);
            console.log(`Successfully created ${processesToCreate.length} processes in cycle 2026-02.`);
        }

        // 6. Update target cycle stats just in case (though simple creation doesn't always trigger hooks)
        targetCycle.kpis = {
            avgScore: 0,
            onTimePct: 0,
            criticalCount: 0,
            totalProcesses: (existingTargetProcesses.length + processesToCreate.length),
            avgDeviationDays: 0
        };
        await targetCycle.save();

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Population failed:', error);
        process.exit(1);
    }
}

populate();
