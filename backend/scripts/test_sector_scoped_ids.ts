
import mongoose from 'mongoose';
import { Company, Cycle, Process } from '../src/models';

const MONGODB_URI = 'mongodb://localhost:27017/makingMoney';

async function run() {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected');

    try {
        // Setup
        let company = await Company.findOne({ name: 'SectorID Test' });
        if (!company) {
            company = await Company.create({ name: 'SectorID Test', document: '888' });
        }

        let cycle = await Cycle.findOne({ companyId: company._id, month: '2099-02' });
        if (cycle) {
            await Cycle.deleteOne({ _id: cycle._id }); // Cleanup
        }

        cycle = await Cycle.create({
            companyId: company._id,
            month: '2099-02',
            status: 'OPEN'
        });

        console.log('--- TEST START ---');

        // 1. Create 001 in Sector A
        console.log('Creating 001 in Sector A...');
        await Process.create({
            companyId: company._id,
            cycleId: cycle._id,
            sector: 'Sector A',
            code: '001',
            title: 'Ref A',
            plannedDate: new Date(),
            limitDate: new Date()
        });

        // 2. Create 001 in Sector B (Should Succeed)
        console.log('Creating 001 in Sector B...');
        await Process.create({
            companyId: company._id,
            cycleId: cycle._id,
            sector: 'Sector B',
            code: '001',
            title: 'Ref B',
            plannedDate: new Date(),
            limitDate: new Date()
        });
        console.log('SUCCESS: Sector B allowed duplicate ID.');

        // 3. Create 001 in Sector A AGAIN (Should Fail)
        console.log('Creating 001 in Sector A again...');
        try {
            await Process.create({
                companyId: company._id,
                cycleId: cycle._id,
                sector: 'Sector A',
                code: '001',
                title: 'Ref A Duplicate',
                plannedDate: new Date(),
                limitDate: new Date()
            });
            console.error('FAILURE: Duplicate allowed in same sector!');
        } catch (e: any) {
            if (e.code === 11000) {
                console.log('SUCCESS: Same sector duplicate prevented.');
            } else {
                console.error('ERROR: Unexpected error:', e);
            }
        }

        // Cleanup
        await Cycle.deleteOne({ _id: cycle._id });

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

run();

