
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { EmailConfig, SMTPSecurityMode } from '../models'; // Ensure index exports these
import { Company } from '../models/Company';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/metodo_chronos';

async function testPersistence() {
    try {
        await mongoose.connect(MONGODB_URI);

        // 1. Get a company
        const company = await Company.findOne({});
        if (!company) {
            console.log('No company found');
            return;
        }
        console.log(`Using company: ${company.name} (${company._id})`);

        // 2. Update/Create Config
        const updates = {
            companyId: company._id,
            host: 'smtp.test.com',
            port: 587,
            securityMode: SMTPSecurityMode.STARTTLS,
            auth: { user: 'test@test.com', pass: 'encrypted_pass' },
            fromName: 'Test Sender Saved',
            fromEmail: 'saved@test.com',
            isActive: true
        };

        let config = await EmailConfig.findOne({ companyId: company._id });
        if (!config) {
            config = new EmailConfig(updates);
        } else {
            config.fromName = updates.fromName;
            config.fromEmail = updates.fromEmail;
            config.auth.user = updates.auth.user;
        }
        await config.save();
        console.log('Saved config with fromName:', config.fromName);

        // 3. Read it back
        const readBack = await EmailConfig.findOne({ companyId: company._id });
        console.log('Read back fromName:', readBack?.fromName);
        console.log('Read back fromEmail:', readBack?.fromEmail);

        if (readBack?.fromName === 'Test Sender Saved') {
            console.log('✅ Persistence TEST PASSED');
        } else {
            console.log('❌ Persistence TEST FAILED');
        }

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

testPersistence();

