
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function diagnose() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to database');

        const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
        const Cycle = mongoose.model('Cycle', new mongoose.Schema({}, { strict: false }));
        const Process = mongoose.model('Process', new mongoose.Schema({}, { strict: false }));

        // Find Joilson
        const joilson = await User.findOne({ email: { $regex: 'joilson.fiscal', $options: 'i' } }).lean();
        if (!joilson) {
            console.error('User Joilson not found!');
            process.exit(1);
        }

        console.log('\n=== JOILSON USER DATA ===');
        console.log('ID:', joilson._id);
        console.log('Name:', joilson.name);
        console.log('Email:', joilson.email);
        console.log('Active Company ID:', joilson.activeCompanyId);
        console.log('Roles:', joilson.roles);
        console.log('Sector (legacy):', joilson.sector);
        console.log('Sectors (new):', joilson.sectors);
        console.log('Allowed Company IDs:', joilson.allowedCompanyIds);

        // Find open cycles for Joilson's sector(s)
        const sectors = [...(joilson.sectors || []), ...(joilson.sector ? [joilson.sector] : [])];
        console.log('\n=== SECTORS ===');
        console.log('Combined sectors:', sectors);

        const openCycles = await Cycle.find({
            companyId: joilson.activeCompanyId,
            status: 'OPEN',
            sector: { $in: sectors }
        }).lean();

        console.log('\n=== OPEN CYCLES FOR JOILSON\'S SECTORS ===');
        openCycles.forEach(c => {
            console.log(`Cycle: ${c.month} | Sector: ${c.sector} | ID: ${c._id}`);
        });

        // Find processes assigned to Joilson
        const assignedProcesses = await Process.find({
            responsibleUserId: joilson._id
        }).lean();

        console.log('\n=== PROCESSES ASSIGNED TO JOILSON ===');
        console.log(`Total: ${assignedProcesses.length}`);
        assignedProcesses.slice(0, 5).forEach(p => {
            console.log(`- ${p.code}: ${p.title} (Cycle: ${p.cycleId}, Sector: ${p.sector})`);
        });

        // Find processes in Joilson's sectors
        if (openCycles.length > 0) {
            const cycleIds = openCycles.map(c => c._id);
            const sectorProcesses = await Process.find({
                cycleId: { $in: cycleIds }
            }).lean();

            console.log('\n=== PROCESSES IN JOILSON\'S OPEN CYCLES ===');
            console.log(`Total: ${sectorProcesses.length}`);
            sectorProcesses.slice(0, 5).forEach(p => {
                console.log(`- ${p.code}: ${p.title} (Responsible: ${p.responsibleUserId})`);
            });
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Diagnostic failed:', error);
        process.exit(1);
    }
}

diagnose();
