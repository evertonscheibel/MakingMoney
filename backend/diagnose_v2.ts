
import mongoose from 'mongoose';
import { Company, Cycle, Process, User, EvaluationConfig } from './src/models';
import { config } from './src/config';
import { UserRole } from './src/types';

async function diagnose() {
    try {
        await mongoose.connect(config.mongodbUri);
        console.log('--- Database Connected ---');

        const companies = await Company.find({});
        console.log(`Found ${companies.length} companies.`);

        for (const company of companies) {
            console.log(`\nCompany: ${company.name} (${company._id})`);
            
            const evalConfig = await EvaluationConfig.findOne({ companyId: company._id, isActive: true });
            console.log(`- EvaluationConfig: ${evalConfig ? 'Found' : 'NOT FOUND'}`);
            if (evalConfig) {
                console.log(`  - Notification Emails: ${evalConfig.rules.notificationEmails?.join(', ') || 'None'}`);
            }

            const openCycles = await Cycle.find({ companyId: company._id, status: 'OPEN' });
            console.log(`- Open Cycles: ${openCycles.length}`);
            for (const cycle of openCycles) {
                const count = await Process.countDocuments({ cycleId: cycle._id });
                console.log(`  - [${cycle.month}] ${cycle.sector}: ${count} processes`);
            }

            const latestCycles = await Cycle.find({ companyId: company._id }).sort({ month: -1 }).limit(5);
            console.log(`- Latest 5 Cycles:`);
            for (const cycle of latestCycles) {
                const count = await Process.countDocuments({ cycleId: cycle._id });
                console.log(`  - [${cycle.month}] ${cycle.sector} (${cycle.status}): ${count} processes`);
            }

            const operators = await User.find({ 'companyAccess.companyId': company._id });
            const operatorCount = operators.filter(u => u.roles.includes(UserRole.OPERATOR) && !u.roles.includes(UserRole.MASTER) && !u.roles.includes(UserRole.MANAGER)).length;
            console.log(`- Operators found for this company: ${operatorCount}`);
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Diagnosis failed:', error);
        process.exit(1);
    }
}

diagnose();
