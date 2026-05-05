
import mongoose from 'mongoose';
import { User, Cycle, Process } from './models';
import { config } from './config';

async function clone() {
    try {
        await mongoose.connect(config.mongodbUri);
        console.log('Connected to database');

        const joilson = await User.findOne({ email: { $regex: 'joilson.fiscal@frizelo.com.br', $options: 'i' } });
        if (!joilson) {
            console.error('Joilson not found');
            process.exit(1);
        }
        console.log(`Joilson ID: ${joilson._id}`);

        const companyId = joilson.activeCompanyId;
        const sourceSector = 'Controladoria';
        const targetSector = 'Contabilidade/Fiscal';
        const month = '2026-02';

        // 1. Find Source Cycle
        const sourceCycle = await Cycle.findOne({
            companyId,
            sector: sourceSector,
            month: month
        });

        if (!sourceCycle) {
            console.error(`Source cycle (${month} - ${sourceSector}) not found!`);
            process.exit(1);
        }

        // 2. Find Target Cycle
        const targetCycle = await Cycle.findOne({
            companyId,
            sector: targetSector,
            month: month
        });

        if (!targetCycle) {
            console.error(`Target cycle (${month} - ${targetSector}) not found!`);
            process.exit(1);
        }

        // 3. Get Processes from Source
        const processes = await Process.find({ cycleId: sourceCycle._id });
        console.log(`Found ${processes.length} processes in source cycle.`);

        if (processes.length === 0) {
            console.error('No processes to clone!');
            process.exit(0);
        }

        // 4. Clone Processes
        const processesToCreate = processes.map(p => {
            const pObj = p.toObject() as any;
            delete pObj._id;
            delete pObj.createdAt;
            delete pObj.updatedAt;
            delete pObj.__v;

            return {
                ...pObj,
                cycleId: targetCycle._id,
                sector: targetSector, // UPDATE SECTOR
                responsibleUserId: joilson._id, // ASSIGN TO JOILSON
                status: 'PENDING',
                deliveryStatus: 'NOT_DELIVERED',
                deliveryDate: null,
                deliverySource: null,
                deliveryEvidence: null,
                score: null,
                emailSentAt: null,
            };
        });

        // 5. Insert
        // Clear existing processes in target cycle first to avoid duplicates/confusion if partial exist
        const deleteResult = await Process.deleteMany({ cycleId: targetCycle._id });
        console.log(`Deleted ${deleteResult.deletedCount} existing processes in target cycle.`);

        await Process.insertMany(processesToCreate);
        console.log(`Successfully created ${processesToCreate.length} processes in ${targetSector} assigned to Joilson.`);

        // 6. Update KPIs
        targetCycle.kpis = {
            avgScore: 0,
            onTimePct: 0,
            criticalCount: 0,
            totalProcesses: processesToCreate.length,
            avgDeviationDays: 0
        };
        await targetCycle.save();

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Clone failed:', error);
        process.exit(1);
    }
}

clone();
