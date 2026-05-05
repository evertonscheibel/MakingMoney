
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function populate() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to database');

        const db = mongoose.connection.db;

        // Find Joilson
        const joilson = await db.collection('users').findOne({ email: { $regex: 'joilson.fiscal', $options: 'i' } });
        if (!joilson) {
            console.error('User Joilson not found!');
            process.exit(1);
        }

        // Find target cycle (February 2026 for Contabilidade/Fiscal)
        const targetCycle = await db.collection('cycles').findOne({
            companyId: joilson.activeCompanyId,
            sector: 'Contabilidade/Fiscal',
            month: '2026-02',
            status: 'OPEN'
        });

        if (!targetCycle) {
            console.error('Target cycle (Feb 2026 Contabilidade/Fiscal) not found!');
            process.exit(1);
        }

        console.log('Target cycle:', targetCycle._id.toString());

        // Find source cycle (February 2026 for Controladoria)
        const sourceCycle = await db.collection('cycles').findOne({
            companyId: joilson.activeCompanyId,
            sector: 'Controladoria',
            month: '2026-02'
        });

        if (!sourceCycle) {
            console.error('Source cycle (Feb 2026 Controladoria) not found!');
            process.exit(1);
        }

        // Get all processes from the source cycle
        const sourceProcesses = await db.collection('processes').find({ cycleId: sourceCycle._id }).toArray();
        console.log(`Found ${sourceProcesses.length} processes in source cycle (Controladoria Feb 2026).`);

        // Check if target already has processes
        const targetProcessCount = await db.collection('processes').countDocuments({ cycleId: targetCycle._id });
        if (targetProcessCount > 0) {
            console.log(`Target cycle already has ${targetProcessCount} processes. Skipping.`);
            process.exit(0);
        }

        // Clone processes to Contabilidade/Fiscal, assigning to Joilson
        const processesToCreate = sourceProcesses.map(p => {
            const newP = { ...p };
            delete newP._id;
            newP.cycleId = targetCycle._id;
            newP.sector = 'Contabilidade/Fiscal';
            newP.responsibleUserId = joilson._id;

            // Reset delivery fields
            newP.deliveryDate = null;
            newP.deliverySource = null;
            newP.deliveryEvidence = null;
            newP.deliveryStatus = 'NOT_DELIVERED';
            newP.score = null;
            newP.status = 'PENDING';
            newP.createdAt = new Date();
            newP.updatedAt = new Date();

            return newP;
        });

        if (processesToCreate.length > 0) {
            await db.collection('processes').insertMany(processesToCreate);
            console.log(`Created ${processesToCreate.length} processes for Joilson in Contabilidade/Fiscal!`);
        } else {
            console.log('No processes to create.');
        }

        await mongoose.disconnect();
        console.log('Done!');
        process.exit(0);
    } catch (error) {
        console.error('Populate failed:', error);
        process.exit(1);
    }
}

populate();
