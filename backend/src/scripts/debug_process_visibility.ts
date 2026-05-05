
import mongoose from 'mongoose';
import { User, Process, Cycle, Company } from '../models';
import { config } from '../config';

async function run() {
    try {
        // @ts-ignore
        await mongoose.connect(config.mongodbUri);

        const email = 'anapaula.adm@frizelo.com.br';
        const user = await User.findOne({ email });
        if (!user) { console.log('User not found'); process.exit(0); }

        const activeCompanyId = user.activeCompanyId;
        const sector = 'Controladoria';

        console.log(`User: ${email}`);
        console.log(`CompanyId: ${activeCompanyId}`);
        console.log(`Sector: ${sector}`);

        // Simulate backend logic: Find OPEN cycle for this sector
        const openCycle = await Cycle.findOne({ companyId: activeCompanyId, sector, status: 'OPEN' }).sort({ month: -1 });
        console.log(`\nOpen Cycle for sector '${sector}':`);
        if (openCycle) {
            console.log(`- ID: ${openCycle._id}, Month: ${openCycle.month}`);
        } else {
            console.log('- No open cycle found.');
        }

        // Check if there are ANY processes for this sector regardless of cycle
        const countTotal = await Process.countDocuments({ companyId: activeCompanyId, sector });
        console.log(`\nTotal processes in DB for '${sector}': ${countTotal}`);

        // List cycles with processes count
        const cycles = await Cycle.find({ companyId: activeCompanyId, sector }).sort({ month: -1 });
        console.log(`\nCycles for '${sector}':`);
        for (const c of cycles) {
            const count = await Process.countDocuments({ cycleId: c._id });
            console.log(`- ${c.month} (${c.status}): ${count} processes. ID: ${c._id}`);
        }

        // Simulate what happens if "All Statuses" and "All Responsibles" are requested for the OPEN cycle (if exists)
        if (openCycle) {
            const procs = await Process.find({ cycleId: openCycle._id }).limit(5);
            console.log(`\nProcesses in OPEN cycle (${procs.length} sample):`);
            procs.forEach(p => console.log(`- ${p.title} (${p.status})`));
        } else {
            console.log('\nCannot list processes for OPEN cycle because none exists.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

run();
