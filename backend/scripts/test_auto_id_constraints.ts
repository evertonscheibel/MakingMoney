
import mongoose from 'mongoose';
import { Company, Cycle, Process, User, UserRole } from '../src/models';
import { createProcess } from '../src/controllers/process.controller'; // We can't easily call controller directly due to req/res mock needing auth.
// Let's interact via Models directly to verify UNIQ index, and simulate logic for auto-id if possible, or just trust code.
// Actually, let's call the API if we can, but mocking req/res is easier here for unit testing the logic.

const MONGODB_URI = 'mongodb://localhost:27017/makingMoney';

async function mockRequest(companyId: any, cycleId: any) {
    return {
        companyId,
        user: { userId: 'mock', roles: [] },
        body: {
            title: 'Auto Process',
            sector: 'Auto Sector',
            plannedDate: new Date(),
            limitDate: new Date(),
        }
    };
}

// We can't run controller easily without full mock.
// I will create a script that primarily tests the MODEL uniqueness constraint.

async function run() {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected');

    try {
        // Setup
        let company = await Company.findOne({ name: 'AutoID Test' });
        if (!company) {
            company = await Company.create({ name: 'AutoID Test', document: '999' });
        }

        let cycle = await Cycle.findOne({ companyId: company._id, month: '2099-01' });
        if (cycle) {
            await Cycle.deleteOne({ _id: cycle._id }); // Cascading delete should kick in!
            console.log('Deleted old cycle (and hopefully processes)');
        }

        cycle = await Cycle.create({
            companyId: company._id,
            month: '2099-01',
            status: 'OPEN'
        });

        // Test Uniqueness manually
        console.log('Creating process 001...');
        await Process.create({
            companyId: company._id,
            cycleId: cycle._id,
            code: '001',
            title: 'Test 1',
            sector: 'Dep',
            plannedDate: new Date(),
            limitDate: new Date()
        });

        console.log('Creating process 001 JOIN...');
        try {
            await Process.create({
                companyId: company._id,
                cycleId: cycle._id,
                code: '001', // Duplicate!
                title: 'Test 1 Duplicate',
                sector: 'Dep',
                plannedDate: new Date(),
                limitDate: new Date()
            });
            console.error('ERROR: Duplicate allowed!');
        } catch (e: any) {
            if (e.code === 11000) {
                console.log('SUCCESS: Duplicate prevented by index.');
            } else {
                console.error('ERROR: Unexpected error:', e);
            }
        }

        // Test Cascade Delete
        console.log('Deleting Cycle...');
        await Cycle.deleteOne({ _id: cycle._id });

        const count = await Process.countDocuments({ cycleId: cycle._id });
        if (count === 0) {
            console.log('SUCCESS: Cascading delete worked. Processes count: 0');
        } else {
            console.error(`FAILURE: Processes remaining: ${count}`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

run();

