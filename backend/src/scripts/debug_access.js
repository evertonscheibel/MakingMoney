
const mongoose = require('mongoose');
const { config } = require('../config');
const { User, Process, Cycle, Company } = require('../models');

async function run() {
    try {
        console.log('Connecting to DB...', config.mongodbUri);
        await mongoose.connect(config.mongodbUri);
        console.log('Connected.');

        const email = process.argv[2];
        if (!email) {
            console.log('Please provide email');
            process.exit(1);
        }

        console.log(`Searching for user: ${email}`);
        const user = await User.findOne({ email });

        if (!user) {
            console.log('User not found');
            process.exit(0);
        }

        console.log('User found:', {
            id: user._id,
            name: user.name,
            roles: user.roles,
            activeCompanyId: user.activeCompanyId,
            sector: user.sector,
            sectors: user.sectors,
            companyAccess: user.companyAccess
        });

        if (user.activeCompanyId) {
            const company = await Company.findById(user.activeCompanyId);
            console.log('Active Company:', {
                id: company?._id,
                name: company?.name,
                sectors: company?.sectors
            });

            // Check managed sectors
            const managedSectors = company?.sectors?.filter(s => s.managerId && s.managerId.toString() === user._id.toString());
            console.log('Managed Sectors found via Company.sectors:', managedSectors);

            // Explicitly search checks
            const sectorName = "Controladoria";

            const processes = await Process.find({
                companyId: user.activeCompanyId,
                sector: { $regex: new RegExp(sectorName, 'i') }
            }).limit(5);

            console.log(`Processes for ${sectorName} (sample 5):`);
            processes.forEach(p => {
                console.log(`- ${p.code}: ${p.title} (Sector: '${p.sector}', CycleId: ${p.cycleId}, Status: ${p.status})`);
            });

            // Check cycles
            const cycles = await Cycle.find({
                companyId: user.activeCompanyId,
                sector: { $regex: new RegExp(sectorName, 'i') }
            }).sort({ month: -1 }).limit(3);

            // Check specific cycle
            const cycleId = '6968f9835472b311ec72ce24';
            const specificCycle = await Cycle.findById(cycleId);
            console.log(`Cycle ${cycleId}:`, specificCycle ? `${specificCycle.month} (${specificCycle.status})` : 'Not found');

            // Check OPEN cycles for Controladoria
            const openCycles = await Cycle.find({
                companyId: user.activeCompanyId,
                sector: { $regex: new RegExp(sectorName, 'i') },
                status: 'OPEN'
            });
            console.log(`OPEN Cycles for ${sectorName}:`, openCycles.map(c => `${c.month} (${c._id})`));
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

run();
