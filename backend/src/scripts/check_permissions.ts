
import mongoose from 'mongoose';
import { User, Cycle, Company } from '../models';
import { config } from '../config';

async function run() {
    try {
        // @ts-ignore
        await mongoose.connect(config.mongodbUri);

        const email = 'anapaula.adm@frizelo.com.br';
        const user = await User.findOne({ email });

        if (!user) {
            console.log('User not found');
            process.exit(0);
        }

        const activeCompanyId = user.activeCompanyId;
        const company = await Company.findById(activeCompanyId);

        const managedSectors = company?.sectors
            .filter(s => s.managerId && s.managerId.toString() === user._id.toString())
            .map(s => s.name) || [];

        const userSectors = (user as any).sectors || [];
        const legacySector = user.sector;

        const combinedSectors = [...new Set([...userSectors, ...(legacySector ? [legacySector] : []), ...managedSectors])];

        console.log('User Roles:', user.roles);
        console.log('User Legacy Sector:', legacySector);
        console.log('User Sectors (Array):', userSectors);
        console.log('Managed Sectors:', managedSectors);
        console.log('Combined Sectors:', combinedSectors);

        const hasAccess = combinedSectors.includes('Controladoria');
        console.log(`Has access to 'Controladoria'? ${hasAccess}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

run();
