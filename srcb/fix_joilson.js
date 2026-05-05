
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function fix() {
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
        console.log('Found Joilson:', joilson.name);

        // Find source cycle (January 2026 for Contabilidade/Fiscal)
        const sourceCycle = await db.collection('cycles').findOne({
            companyId: joilson.activeCompanyId,
            sector: 'Contabilidade/Fiscal',
            month: '2026-01'
        });

        // Find target cycle (February 2026 for Contabilidade/Fiscal)
        const targetCycle = await db.collection('cycles').findOne({
            companyId: joilson.activeCompanyId,
            sector: 'Contabilidade/Fiscal',
            month: '2026-02',
            status: 'OPEN'
        });

        if (!targetCycle) {
            console.error('Target cycle (Feb 2026) not found!');
            process.exit(1);
        }

        console.log('Target cycle:', targetCycle._id.toString());

        // Check if we have a source cycle to clone from
        if (sourceCycle) {
            const sourceProcesses = await db.collection('processes').find({ cycleId: sourceCycle._id }).toArray();
            console.log(`Found ${sourceProcesses.length} processes in source cycle (Jan 2026).`);

            if (sourceProcesses.length > 0) {
                // Check if target already has processes
                const targetProcessCount = await db.collection('processes').countDocuments({ cycleId: targetCycle._id });
                if (targetProcessCount > 0) {
                    console.log(`Target cycle already has ${targetProcessCount} processes. Skipping clone.`);
                } else {
                    // Clone processes
                    const processesToCreate = sourceProcesses.map(p => {
                        const newP = { ...p };
                        delete newP._id;
                        newP.cycleId = targetCycle._id;

                        // Shift dates by one month
                        if (p.plannedDate) {
                            const planned = new Date(p.plannedDate);
                            planned.setMonth(planned.getMonth() + 1);
                            newP.plannedDate = planned;
                        }
                        if (p.limitDate) {
                            const limit = new Date(p.limitDate);
                            limit.setMonth(limit.getMonth() + 1);
                            newP.limitDate = limit;
                        }

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

                    await db.collection('processes').insertMany(processesToCreate);
                    console.log(`Cloned ${processesToCreate.length} processes to target cycle.`);
                }
            }
        } else {
            console.log('No source cycle (Jan 2026) found. Checking if there are any Contabilidade/Fiscal processes at all...');

            // Check if there are any processes in Contabilidade/Fiscal sector
            const fiscalProcesses = await db.collection('processes').find({
                companyId: joilson.activeCompanyId,
                sector: 'Contabilidade/Fiscal'
            }).toArray();

            console.log(`Found ${fiscalProcesses.length} processes in Contabilidade/Fiscal sector across all cycles.`);
        }

        await mongoose.disconnect();
        console.log('Done!');
        process.exit(0);
    } catch (error) {
        console.error('Fix failed:', error);
        process.exit(1);
    }
}

fix();
