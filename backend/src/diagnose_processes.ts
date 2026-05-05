
import mongoose from 'mongoose';
import { User, Cycle, Process } from './models';
import { config } from './config';

async function diagnoseProcesses() {
    try {
        await mongoose.connect(config.mongodbUri);
        console.log('Connected to database');

        // 1. Find Joilson again to get his ID
        const joilson = await User.findOne({ email: { $regex: 'joilson.fiscal@frizelo.com.br', $options: 'i' } });
        if (!joilson) {
            console.error('User Joilson not found');
            process.exit(1);
        }
        console.log(`Joilson ID: ${joilson._id}`);

        // 2. Find the Cycle
        const cycle = await Cycle.findOne({
            month: '2026-02',
            sector: 'Contabilidade/Fiscal',
            companyId: joilson.activeCompanyId
        });

        if (!cycle) {
            console.error('Cycle 2026-02 for Contabilidade/Fiscal not found!');
            // List all cycles for this sector to be sure
            const cycles = await Cycle.find({ sector: 'Contabilidade/Fiscal', companyId: joilson.activeCompanyId });
            console.log('Available cycles for Contabilidade/Fiscal:', cycles.map(c => `${c.month} (${c.status})`));
            process.exit(0);
        }

        console.log(`Cycle Found: ${cycle._id} (${cycle.month}) Status: ${cycle.status}`);

        // 3. Find Processes in this cycle
        const processes = await Process.find({ cycleId: cycle._id });
        console.log(`Total Processes in Cycle: ${processes.length}`);

        // 4. Check Assignments
        const assignedToJoilson = processes.filter(p => p.responsibleUserId && p.responsibleUserId.toString() === joilson._id.toString());
        const unassigned = processes.filter(p => !p.responsibleUserId);
        const assignedToOthers = processes.filter(p => p.responsibleUserId && p.responsibleUserId.toString() !== joilson._id.toString());

        console.log(`Processes assigned to Joilson: ${assignedToJoilson.length}`);
        console.log(`Processes Unassigned: ${unassigned.length}`);
        console.log(`Processes Assigned to Others: ${assignedToOthers.length}`);

        if (assignedToOthers.length > 0) {
            console.log('Sample assigned to others:', assignedToOthers.slice(0, 3).map(p => ({
                title: p.title,
                responsibleUserId: p.responsibleUserId
            })));
        }

        if (assignedToJoilson.length === 0 && processes.length > 0) {
            console.log("Joilson has no processes assigned. Listing sample available processes:");
            processes.slice(0, 5).forEach(p => console.log(`- ${p.title} (Responsible: ${p.responsibleUserId})`));
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Diagnosis failed:', error);
        process.exit(1);
    }
}

diagnoseProcesses();
