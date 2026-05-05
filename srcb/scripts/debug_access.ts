
import mongoose from 'mongoose';
import { User, Process, Cycle, Company } from '../models';
import { config } from '../config';

async function run() {
    try {
        console.log('Connecting to DB...');
        // @ts-ignore
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
            sectors: (user as any).sectors,
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

            console.log(`Cycles for ${sectorName}:`);
            cycles.forEach(c => {
                console.log(`- ${c.month}: ${c.status} (Id: ${c._id})`);
            });
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

run();
