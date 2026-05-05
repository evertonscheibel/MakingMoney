
import mongoose from 'mongoose';
import { User, Cycle, Company } from '../models';
import { config } from '../config';
import { body, validationResult } from 'express-validator';

// Mock request for express-validator
const mockRequest = (bodyData: any) => ({
    body: bodyData,
    get: () => '',
});

async function run() {
    try {
        console.log('Connecting to DB...');
        // @ts-ignore
        await mongoose.connect(config.mongodbUri);
        console.log('Connected.');

        const email = 'anapaula.adm@frizelo.com.br';
        console.log(`Searching for user: ${email}`);
        const user = await User.findOne({ email });

        if (!user) {
            console.log('User not found');
            process.exit(0);
        }

        console.log(`User Company ID: ${user.activeCompanyId}`);
        const activeCompanyId = user.activeCompanyId;

        // 1. Inspect existing cycles
        const cycles = await Cycle.find({ companyId: activeCompanyId }).sort({ month: -1 });
        console.log(`\nFound ${cycles.length} cycles total.`);

        const controlCycles = cycles.filter(c => c.sector === 'Controladoria');
        console.log(`Cycles for 'Controladoria': ${controlCycles.length}`);
        controlCycles.forEach(c => {
            console.log(`- Month: '${c.month}', Status: ${c.status}, ID: ${c._id}`);
        });

        // 2. Simulate next month calculation
        let nextMonth = '';
        if (controlCycles.length > 0) {
            const latest = controlCycles[0].month; // Sorted desc
            console.log(`Latest month in DB: '${latest}'`);

            // Replicate frontend logic
            const [year, monthPart] = latest.split('-').map(Number);
            const nextDate = new Date(year, monthPart, 1); // monthPart is 1-based, so this gets next month
            nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
            console.log(`Calculated Next Month via frontend logic: '${nextMonth}'`);
        } else {
            const now = new Date();
            nextMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            console.log(`No history. Defaulting to current month: '${nextMonth}'`);
        }

        // 3. Simulate Validation
        console.log(`\nSimulating Validation for payload: { month: '${nextMonth}', sector: 'Controladoria' }`);

        const regex = /^\d{4}-(0[1-9]|1[0-2])$/;
        const match = regex.test(nextMonth);
        console.log(`Regex /^\d{4}-(0[1-9]|1[0-2])$/ test result: ${match}`);

        if (!match) {
            console.error('REGEX FAILED! This matches the error pattern.');
        } else {
            console.log('Regex passed. The issue might be somewhere else?');
        }

        // Check for duplicates
        const existing = await Cycle.findOne({
            companyId: activeCompanyId,
            month: nextMonth,
            sector: 'Controladoria',
        });

        if (existing) {
            console.log(`CONFLICT: Cycle for ${nextMonth} already exists! ID: ${existing._id}`);
        } else {
            console.log('No conflict found. Should be allowed.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

run();
