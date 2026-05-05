
import mongoose from 'mongoose';
import { Process, User } from '../models';
import { config } from '../config';

async function run() {
    try {
        // @ts-ignore
        await mongoose.connect(config.mongodbUri);

        const email = 'anapaula.adm@frizelo.com.br';
        const user = await User.findOne({ email });
        if (!user) {
            console.log('User not found');
            return;
        }

        const companyId = user.activeCompanyId;
        console.log(`Deleting all processes for company: ${companyId}`);

        const countBefore = await Process.countDocuments({ companyId });
        console.log(`Found ${countBefore} processes.`);

        const result = await Process.deleteMany({ companyId });
        console.log(`✅ Deleted ${result.deletedCount} processes.`);

    } catch (error) {
        console.error('Error during deletion:', error);
    } finally {
        await mongoose.disconnect();
    }
}

run();
